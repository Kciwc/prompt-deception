const { phaseScale } = require('../config');
const { broadcastRoomState, broadcastLobbyList } = require('../socket/broadcast');

// Default phase durations (ms). Scaled by PD_PHASE_SCALE for dev/testing.
const PHASE_DURATIONS_MS = {
  1: 60_000, // prompt gen — write your bluff
  2: 30_000, // intra-team voting — pick the team's bluff
  3: 45_000, // main vote — guess which is real
  4: 30_000, // reveal + thumbs feedback
  5: 60_000, // podium
};

const FAST_FORWARD_REMAINING_MS = 10_000;
const MAX_UNDO_DEPTH = 3;
const MIN_REMAINING_AFTER_PAUSE_MS = 250;

function durationFor(phase) {
  const base = PHASE_DURATIONS_MS[phase] ?? 30_000;
  return Math.max(1000, Math.round(base * (phaseScale || 1)));
}

class PhaseMachine {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    this.timer = null;
    this.undoStack = []; // [{ phase, currentRoundIdx, deadlineMs, snapshotAt }]
  }

  // Start the game from lobby → phase 1, round 0.
  start() {
    if (this.room.status !== 'lobby') return false;
    this.room.status = 'playing';
    this.room.currentRoundIdx = 0;
    this.room.rounds = [this.room.rounds[0] || makeEmptyRound()];
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

  // Called when every active player has locked in for the current phase.
  fastForwardIfNeeded() {
    if (this.room.paused || !this.room.phaseDeadlineMs) return false;
    const remaining = this.room.phaseDeadlineMs - Date.now();
    if (remaining <= FAST_FORWARD_REMAINING_MS) return false;
    this.room.phaseDeadlineMs = Date.now() + FAST_FORWARD_REMAINING_MS;
    this._reschedule();
    this._broadcast();
    return true;
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
    // Skip directly to next round (start a new round at phase 1, fresh timer).
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

  // Internal: enter a specific phase, set deadline, schedule auto-advance.
  _enterPhase(phase) {
    this._snapshotForUndo();
    this.room.phase = phase;
    this.room.paused = false;
    this.room.pausedRemainingMs = null;
    const dur = durationFor(phase);
    this.room.phaseDeadlineMs = Date.now() + dur;
    this._scheduleAdvance(dur);
    this._broadcast();
  }

  _onDeadline() {
    // Server-side automatic advance.
    const cur = this.room.phase;
    if (cur < 4) {
      this._enterPhase(cur + 1);
    } else if (cur === 4) {
      this._advanceToNextRoundOrPodium();
    } else if (cur === 5) {
      // Auto-end after podium timer.
      this.endGame();
    }
  }

  _advanceToNextRoundOrPodium() {
    const completedNonTrashed = this.room.rounds.filter((r) => !r.trashed).length;
    const target = this.room.config.rounds;
    if (completedNonTrashed >= target) {
      this._enterPhase(5); // podium
      return;
    }
    // Start a new round at phase 1.
    this.room.rounds.push(makeEmptyRound());
    this.room.currentRoundIdx = this.room.rounds.length - 1;
    this._enterPhase(1);
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

  // Cleanup when room is destroyed.
  destroy() {
    this._clearTimer();
  }
}

function makeEmptyRound() {
  return {
    imageKey: null,
    realPrompt: null,
    perPlayerBluffs: new Map(),
    intraVotes: new Map(),
    teamBluffs: { 1: null, 2: null, 3: null },
    mainVotes: new Map(),
    feedback: new Map(),
    trashed: false,
  };
}

module.exports = { PhaseMachine, PHASE_DURATIONS_MS, durationFor };
