const { phaseScale } = require('../config');
const { broadcastRoomState, broadcastLobbyList } = require('../socket/broadcast');
const contentLibrary = require('../db/contentLibrary');
const { applyRoundScores } = require('./scoring');

const PHASE_DURATIONS_MS = {
  1: 60_000,
  2: 30_000,
  3: 45_000,
  4: 30_000,
  5: 60_000,
};

const FAST_FORWARD_REMAINING_MS = 10_000;
const MAX_UNDO_DEPTH = 3;
const MIN_REMAINING_AFTER_PAUSE_MS = 250;
const EMPTY_TEAM_BLUFF = 'no bluff';

function durationFor(phase) {
  const base = PHASE_DURATIONS_MS[phase] ?? 30_000;
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
    this.room.rounds = [this._makeRound()];
    this._enterPhase(1);
    return true;
  }

  pause() {
    if (this.room.paused || !this.room.phaseDeadlineMs) return false;
    this.room.paused = true;
    this.room.pausedRemainingMs = Math.max(0, this.room.phaseDeadlineMs - Date.now());
    this._clearTimer();
    this._broadcast();
    return true;
  }

  resume() {
    if (!this.room.paused) return false;
    this.room.paused = false;
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

  // Called from gameHandler when an input event lands. Decides whether
  // every active player is "locked" for the current phase and triggers
  // the 10s fast-forward.
  checkEarlyLock() {
    const r = this.room.rounds[this.room.currentRoundIdx];
    if (!r) return;
    const active = Array.from(this.room.players.values()).filter((p) => p.isConnected);
    if (active.length === 0) return;

    let allLocked = false;
    if (this.room.phase === 1) {
      allLocked = active.every((p) => {
        const playerId = this._playerIdOf(p);
        return r.perPlayerBluffs.has(playerId);
      });
    } else if (this.room.phase === 2) {
      // Each player needs to have cast an intra-vote.
      // Players on a team with only 1 submitted bluff don't need to vote;
      // we treat them as auto-locked.
      const teamSubs = this._teamSubmissionCounts(r);
      allLocked = active.every((p) => {
        const playerId = this._playerIdOf(p);
        if (teamSubs[p.teamSlot] <= 1) return true;
        return r.intraVotes.has(playerId);
      });
    } else if (this.room.phase === 3) {
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
    const dur = durationFor(snap.phase);
    this.room.phaseDeadlineMs = Date.now() + dur;
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
    this.room.phase = 5;
    this.room.phaseDeadlineMs = null;
    this.room.paused = false;
    this.room.pausedRemainingMs = null;
    this._broadcast();
    broadcastLobbyList(this.io);
  }

  _enterPhase(phase) {
    // Phase-specific transition prep (computes derived round state).
    if (phase === 3) this._finalizeTeamBluffs();
    if (phase === 4) this._scoreRound();

    this._snapshotForUndo();
    this.room.phase = phase;
    this.room.paused = false;
    this.room.pausedRemainingMs = null;
    const dur = durationFor(phase);
    this.room.phaseStartMs = Date.now();
    this.room.phaseDurationMs = dur;
    this.room.phaseDeadlineMs = this.room.phaseStartMs + dur;
    this._scheduleAdvance(dur);
    this._broadcast();
  }

  _onDeadline() {
    const cur = this.room.phase;
    if (cur < 4) {
      this._enterPhase(cur + 1);
    } else if (cur === 4) {
      this._advanceToNextRoundOrPodium();
    } else if (cur === 5) {
      this.endGame();
    }
  }

  _advanceToNextRoundOrPodium() {
    const completedNonTrashed = this.room.rounds.filter((r) => !r.trashed).length;
    const target = this.room.config.rounds;
    if (completedNonTrashed >= target) {
      this._enterPhase(5);
      return;
    }
    this.room.rounds.push(this._makeRound());
    this.room.currentRoundIdx = this.room.rounds.length - 1;
    this._enterPhase(1);
  }

  // Build a new round, pulling content from the library. If the library
  // is empty or exhausted, fall back to a placeholder so the game still
  // runs (useful for dev / before any uploads).
  _makeRound() {
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
      intraVotes: new Map(),
      teamBluffs: { 1: null, 2: null, 3: null },
      autoEmpty: { 1: false, 2: false, 3: false },
      mainVotes: new Map(),
      feedback: new Map(),
      candidatesOrder: null, // [{id: 'team:1' | 'real', text: '...'}], populated at phase 2→3
      scoreDelta: null,      // populated at phase 3→4
      trashed: false,
    };
  }

  _finalizeTeamBluffs() {
    const r = this.room.rounds[this.room.currentRoundIdx];
    if (!r) return;
    for (const slot of [1, 2, 3]) {
      const teamPlayers = Array.from(this.room.players.entries())
        .filter(([_, p]) => p.teamSlot === slot && p.isConnected);
      const submissions = teamPlayers
        .map(([pid]) => ({ pid, text: r.perPlayerBluffs.get(pid) }))
        .filter((s) => typeof s.text === 'string' && s.text.length > 0);

      if (submissions.length === 0) {
        r.teamBluffs[slot] = EMPTY_TEAM_BLUFF;
        r.autoEmpty[slot] = true;
        continue;
      }
      if (submissions.length === 1) {
        r.teamBluffs[slot] = submissions[0].text;
        continue;
      }
      // Tally intra-team votes (target playerId → vote count).
      const tally = new Map();
      for (const [voterId, targetPid] of r.intraVotes) {
        const voter = this.room.players.get(voterId);
        if (!voter || voter.teamSlot !== slot) continue;
        if (!submissions.find((s) => s.pid === targetPid)) continue;
        tally.set(targetPid, (tally.get(targetPid) ?? 0) + 1);
      }
      let bestPid = null;
      let bestCount = -1;
      const tied = [];
      for (const s of submissions) {
        const c = tally.get(s.pid) ?? 0;
        if (c > bestCount) {
          bestCount = c;
          bestPid = s.pid;
          tied.length = 0;
          tied.push(s.pid);
        } else if (c === bestCount) {
          tied.push(s.pid);
        }
      }
      const winnerPid = tied.length > 1
        ? tied[Math.floor(Math.random() * tied.length)]
        : bestPid;
      r.teamBluffs[slot] = submissions.find((s) => s.pid === winnerPid).text;
    }

    // Build the candidates list and shuffle it.
    const candidates = [
      { id: 'team:1', text: r.teamBluffs[1], autoEmpty: r.autoEmpty[1] },
      { id: 'team:2', text: r.teamBluffs[2], autoEmpty: r.autoEmpty[2] },
      { id: 'team:3', text: r.teamBluffs[3], autoEmpty: r.autoEmpty[3] },
      { id: 'real', text: r.realPrompt, autoEmpty: false },
    ];
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    r.candidatesOrder = candidates;
  }

  _scoreRound() {
    const delta = applyRoundScores(this.room);
    return delta;
  }

  _teamSubmissionCounts(round) {
    const out = { 1: 0, 2: 0, 3: 0 };
    for (const [pid, _text] of round.perPlayerBluffs) {
      const p = this.room.players.get(pid);
      if (!p || !p.isConnected) continue;
      out[p.teamSlot]++;
    }
    return out;
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
}

module.exports = { PhaseMachine, PHASE_DURATIONS_MS, durationFor, EMPTY_TEAM_BLUFF };
