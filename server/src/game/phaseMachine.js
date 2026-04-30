const { phaseScale } = require('../config');
const { broadcastRoomState, broadcastLobbyList } = require('../socket/broadcast');
const contentLibrary = require('../db/contentLibrary');
const { applyRoundScores } = require('./scoring');

// New phase model (post-merge):
//   0 = lobby
//   1 = write + intra-vote (combined collaborative phase)
//   2 = main vote
//   3 = reveal + thumbs + trash talk vote
//   4 = podium
//
// Per-speed durations in milliseconds. PD_PHASE_SCALE multiplies on top
// for dev/testing.
const SPEED_DURATIONS = {
  quick:    { 1: 90_000,  2: 45_000,  3: 30_000, 4: 45_000 },
  standard: { 1: 180_000, 2: 90_000,  3: 30_000, 4: 60_000 },
  long:     { 1: 300_000, 2: 180_000, 3: 30_000, 4: 90_000 },
};

const FAST_FORWARD_REMAINING_MS = 10_000;
const MAX_UNDO_DEPTH = 3;
const MIN_REMAINING_AFTER_PAUSE_MS = 250;
const EMPTY_TEAM_BLUFF = 'no bluff';
const MIN_BLUFF_FINAL_LEN = 5;
const TRASH_TALK_PER_ROUND = 1; // a vote is worth 1 leaderboard point

function durationFor(phase, speed = 'standard', isPractice = false) {
  // Practice rounds always use Long timings so players have room to read
  // the explanation overlays and try things without pressure.
  const effectiveSpeed = isPractice ? 'long' : speed;
  const set = SPEED_DURATIONS[effectiveSpeed] ?? SPEED_DURATIONS.standard;
  const base = set[phase] ?? 30_000;
  return Math.max(1000, Math.round(base * (phaseScale || 1)));
}

class PhaseMachine {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.timer = null;
    this.undoStack = [];
  }

  start() {
    if (this.room.status !== 'lobby') return false;
    this.room.status = 'playing';
    this.room.usedImageIds = [];
    this.room.currentRoundIdx = 0;
    // First round is a practice round if the host enabled it.
    this.room.rounds = [this._makeRound({ isPractice: !!this.room.config.practiceRound })];
    this._enterPhase(1);
    return true;
  }

  pause() {
    if (this.room.paused || !this.room.phaseDeadlineMs) return false;
    this.room.paused = true;
    this.room.pausedReason = 'host';
    this.room.pausedRemainingMs = Math.max(0, this.room.phaseDeadlineMs - Date.now());
    this._clearTimer();
    this._broadcast();
    return true;
  }

  resume() {
    if (!this.room.paused) return false;
    this.room.paused = false;
    this.room.pausedReason = null;
    const remaining = Math.max(MIN_REMAINING_AFTER_PAUSE_MS, this.room.pausedRemainingMs ?? 0);
    this.room.phaseDeadlineMs = Date.now() + remaining;
    this.room.pausedRemainingMs = null;
    this._scheduleAdvance(remaining);
    this._broadcast();
    return true;
  }

  addSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    if (this.room.paused) {
      this.room.pausedRemainingMs = (this.room.pausedRemainingMs ?? 0) + seconds * 1000;
    } else if (this.room.phaseDeadlineMs) {
      this.room.phaseDeadlineMs += seconds * 1000;
      this._reschedule();
    } else {
      return false;
    }
    this._broadcast();
    return true;
  }

  fastForwardIfNeeded() {
    if (this.room.paused || !this.room.phaseDeadlineMs) return false;
    const remaining = this.room.phaseDeadlineMs - Date.now();
    if (remaining <= FAST_FORWARD_REMAINING_MS) return false;
    this.room.phaseDeadlineMs = Date.now() + FAST_FORWARD_REMAINING_MS;
    this._reschedule();
    this._broadcast();
    return true;
  }

  // Called when a player input lands. Decides whether the phase can fast-forward.
  checkEarlyLock() {
    const r = this.room.rounds[this.room.currentRoundIdx];
    if (!r) return;
    const active = Array.from(this.room.players.values()).filter((p) => p.isConnected);
    if (active.length === 0) return;

    let allLocked = false;
    if (this.room.phase === 1) {
      // In the merged phase, "locked" = either submitted a non-empty bluff OR cast an intra-vote.
      // Players who do nothing keep us on the timer; one tap suffices.
      allLocked = active.every((p) => {
        const playerId = this._playerIdOf(p);
        const text = r.perPlayerBluffs.get(playerId);
        const hasBluff = typeof text === 'string' && text.trim().length >= MIN_BLUFF_FINAL_LEN;
        const hasVote = r.intraVotes.has(playerId);
        return hasBluff || hasVote;
      });
    } else if (this.room.phase === 2) {
      allLocked = active.every((p) => {
        const playerId = this._playerIdOf(p);
        return r.mainVotes.has(playerId);
      });
    }
    if (allLocked) this.fastForwardIfNeeded();
  }

  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    this.room.phase = snap.phase;
    this.room.currentRoundIdx = snap.currentRoundIdx;
    this._clearTimer();
    this.room.paused = false;
    this.room.pausedRemainingMs = null;
    const dur = durationFor(snap.phase, this.room.config.speed);
    this.room.phaseStartMs = Date.now();
    this.room.phaseDurationMs = dur;
    this.room.phaseDeadlineMs = this.room.phaseStartMs + dur;
    this._scheduleAdvance(dur);
    this._broadcast();
    return true;
  }

  trashCurrentRound() {
    if (this.room.status !== 'playing') return false;
    const round = this.room.rounds[this.room.currentRoundIdx];
    if (!round) return false;
    round.trashed = true;
    this._snapshotForUndo();
    this._advanceToNextRoundOrPodium();
    return true;
  }

  endGame() {
    this._clearTimer();
    this.room.status = 'finished';
    this.room.phase = 4;
    this.room.phaseDeadlineMs = null;
    this.room.phaseStartMs = null;
    this.room.phaseDurationMs = null;
    this.room.paused = false;
    this.room.pausedRemainingMs = null;
    this._broadcast();
    broadcastLobbyList(this.io);
  }

  _enterPhase(phase) {
    const round = this.room.rounds[this.room.currentRoundIdx];
    const isPractice = !!round?.isPractice;

    // Phase-specific transition prep. Practice rounds skip scoring + trash
    // talk tallying so they don't pollute the real game.
    if (phase === 2) this._finalizeTeamBluffs();
    if (phase === 3 && !isPractice) this._scoreRound();
    if (phase === 4 && this.room.status === 'playing' && !isPractice) {
      this._tallyTrashTalkForCurrentRound();
    }

    this._snapshotForUndo();
    this.room.phase = phase;
    this.room.paused = false;
    this.room.pausedRemainingMs = null;
    const dur = durationFor(phase, this.room.config.speed, isPractice);
    this.room.phaseStartMs = Date.now();
    this.room.phaseDurationMs = dur;
    this.room.phaseDeadlineMs = this.room.phaseStartMs + dur;
    this._scheduleAdvance(dur);

    if (!this.room.hostSocketId && phase < 4 && this.room.status === 'playing') {
      this.room.paused = true;
      this.room.pausedReason = 'host_disconnected';
      this.room.pausedRemainingMs = dur;
      this._clearTimer();
    }

    this._broadcast();
  }

  _onDeadline() {
    const cur = this.room.phase;
    if (cur < 3) {
      this._enterPhase(cur + 1);
    } else if (cur === 3) {
      // Reveal phase ended — tally trash talk before next round / podium.
      this._tallyTrashTalkForCurrentRound();
      this._advanceToNextRoundOrPodium();
    } else if (cur === 4) {
      this.endGame();
    }
  }

  _advanceToNextRoundOrPodium() {
    // Practice rounds don't count toward the target.
    const completedNonTrashed = this.room.rounds
      .filter((r) => !r.trashed && !r.isPractice).length;
    const target = this.room.config.rounds;
    if (completedNonTrashed >= target) {
      this._enterPhase(4); // podium
      return;
    }
    this.room.rounds.push(this._makeRound());
    this.room.currentRoundIdx = this.room.rounds.length - 1;
    this._enterPhase(1);
  }

  _makeRound({ isPractice = false } = {}) {
    const used = this.room.usedImageIds || [];
    const pick = contentLibrary.pickUnused(used);
    if (pick) {
      used.push(pick.id);
      this.room.usedImageIds = used;
    }
    return {
      contentId: pick?.id ?? null,
      imageKey: pick?.imageKey ?? null,
      imageUrl: pick?.imageUrl ?? null,
      realPrompt: pick?.realPrompt ?? '(no content uploaded — visit /admin)',
      perPlayerBluffs: new Map(),
      bluffTypingAt: new Map(),
      intraVotes: new Map(),
      teamBluffs: { 1: null, 2: null, 3: null },
      autoEmpty: { 1: false, 2: false, 3: false },
      mainVotes: new Map(),
      feedback: new Map(),
      candidatesOrder: null,
      scoreDelta: null,
      trashTalkVotes: new Map(),
      trashTalkRoundCounts: null,
      trashTalkRoundWinner: null,
      trashed: false,
      isPractice,
    };
  }

  _finalizeTeamBluffs() {
    const r = this.room.rounds[this.room.currentRoundIdx];
    if (!r) return;
    for (const slot of [1, 2, 3]) {
      const teamPlayers = Array.from(this.room.players.entries())
        .filter(([_, p]) => p.teamSlot === slot && p.isConnected);
      // Filter to non-trivial submissions only (drafts < MIN_BLUFF_FINAL_LEN are dropped).
      const submissions = teamPlayers
        .map(([pid]) => ({ pid, text: r.perPlayerBluffs.get(pid) }))
        .filter((s) => typeof s.text === 'string' && s.text.trim().length >= MIN_BLUFF_FINAL_LEN);

      if (submissions.length === 0) {
        r.teamBluffs[slot] = EMPTY_TEAM_BLUFF;
        r.autoEmpty[slot] = true;
        continue;
      }
      if (submissions.length === 1) {
        r.teamBluffs[slot] = submissions[0].text.trim();
        continue;
      }
      // Tally intra-team votes — votes targeting empty/dropped bluffs are silently ignored.
      const validPids = new Set(submissions.map((s) => s.pid));
      const tally = new Map();
      for (const [voterId, targetPid] of r.intraVotes) {
        const voter = this.room.players.get(voterId);
        if (!voter || voter.teamSlot !== slot) continue;
        if (!validPids.has(targetPid)) continue;
        tally.set(targetPid, (tally.get(targetPid) ?? 0) + 1);
      }
      let bestCount = -1;
      const tied = [];
      for (const s of submissions) {
        const c = tally.get(s.pid) ?? 0;
        if (c > bestCount) {
          bestCount = c;
          tied.length = 0;
          tied.push(s.pid);
        } else if (c === bestCount) {
          tied.push(s.pid);
        }
      }
      const winnerPid = tied.length > 1
        ? tied[Math.floor(Math.random() * tied.length)]
        : tied[0];
      r.teamBluffs[slot] = submissions.find((s) => s.pid === winnerPid).text.trim();
    }

    const candidates = [
      { id: 'team:1', text: r.teamBluffs[1], autoEmpty: r.autoEmpty[1] },
      { id: 'team:2', text: r.teamBluffs[2], autoEmpty: r.autoEmpty[2] },
      { id: 'team:3', text: r.teamBluffs[3], autoEmpty: r.autoEmpty[3] },
      { id: 'real',   text: r.realPrompt,    autoEmpty: false },
    ];
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    r.candidatesOrder = candidates;
  }

  _scoreRound() {
    return applyRoundScores(this.room);
  }

  // Tally the round's trash talk votes into round.trashTalkRoundCounts and
  // bump the cumulative leaderboard. Idempotent — safe to call multiple times.
  _tallyTrashTalkForCurrentRound() {
    const r = this.room.rounds[this.room.currentRoundIdx];
    if (!r) return;
    if (r.trashTalkRoundCounts) return; // already tallied
    if (!this.room.config.trashTalkEnabled) {
      r.trashTalkRoundCounts = {};
      r.trashTalkRoundWinner = null;
      return;
    }

    const counts = {};
    for (const [_voter, target] of r.trashTalkVotes) {
      if (typeof target !== 'string') continue;
      counts[target] = (counts[target] ?? 0) + 1;
    }
    r.trashTalkRoundCounts = counts;

    // Determine round winner (random tiebreak).
    let bestCount = 0;
    const tied = [];
    for (const [pid, c] of Object.entries(counts)) {
      if (c > bestCount) { bestCount = c; tied.length = 0; tied.push(pid); }
      else if (c === bestCount) tied.push(pid);
    }
    if (bestCount > 0 && tied.length > 0) {
      const winner = tied.length > 1
        ? tied[Math.floor(Math.random() * tied.length)]
        : tied[0];
      r.trashTalkRoundWinner = { playerId: winner, votes: bestCount };
    } else {
      r.trashTalkRoundWinner = null;
    }

    // Cumulative leaderboard: every vote earned counts toward total
    // (so the all-time MVP is whoever got the most votes across rounds,
    // not whoever won the most rounds).
    for (const [pid, c] of Object.entries(counts)) {
      const prev = this.room.trashTalkLeaderboard.get(pid) ?? 0;
      this.room.trashTalkLeaderboard.set(pid, prev + c * TRASH_TALK_PER_ROUND);
    }
  }

  _playerIdOf(playerObj) {
    for (const [id, p] of this.room.players) if (p === playerObj) return id;
    return null;
  }

  _snapshotForUndo() {
    this.undoStack.push({
      phase: this.room.phase,
      currentRoundIdx: this.room.currentRoundIdx,
      snapshotAt: Date.now(),
    });
    if (this.undoStack.length > MAX_UNDO_DEPTH) this.undoStack.shift();
  }

  _scheduleAdvance(durationMs) {
    this._clearTimer();
    this.timer = setTimeout(() => this._onDeadline(), durationMs);
  }

  _reschedule() {
    if (this.room.paused || !this.room.phaseDeadlineMs) return;
    const remaining = Math.max(0, this.room.phaseDeadlineMs - Date.now());
    this._scheduleAdvance(remaining);
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  _broadcast() {
    broadcastRoomState(this.io, this.room);
  }

  destroy() {
    this._clearTimer();
  }

  // Called when the room is being reused for a fresh game.
  resetForReplay() {
    this._clearTimer();
    this.undoStack = [];
  }
}

module.exports = { PhaseMachine, SPEED_DURATIONS, durationFor, EMPTY_TEAM_BLUFF };
