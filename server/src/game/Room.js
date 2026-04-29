const TEAM_COLORS = ['cyan', 'magenta', 'amber'];
const DEFAULT_TEAM_NAMES = ['Team Cyan', 'Team Magenta', 'Team Amber'];

const MIN_ROUNDS = 3;
const MAX_ROUNDS = 7;
const DEFAULT_ROUNDS = 5;
const VALID_SPEEDS = ['quick', 'standard', 'long'];
const DEFAULT_SPEED = 'standard';

function clampRounds(n) {
  const r = Number.isFinite(n) ? Math.floor(n) : DEFAULT_ROUNDS;
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, r));
}

function clampSpeed(s) {
  return VALID_SPEEDS.includes(s) ? s : DEFAULT_SPEED;
}

class Room {
  constructor({ code, isPublic, config }) {
    this.code = code;
    this.isPublic = !!isPublic;
    this.createdAt = Date.now();
    this.status = 'lobby'; // 'lobby' | 'playing' | 'finished'
    this.phase = 0;
    this.phaseDeadlineMs = null;
    this.paused = false;
    this.config = {
      rounds: clampRounds(config?.rounds),
      speed: clampSpeed(config?.speed),
      doublePoints: !!config?.doublePoints,
      trashTalkEnabled: config?.trashTalkEnabled !== false, // default ON
    };

    this.hostSocketId = null;
    this.hostRemoteSocketId = null;

    this.players = new Map();
    this.teams = TEAM_COLORS.map((color, i) => ({
      slot: i + 1,
      color,
      name: DEFAULT_TEAM_NAMES[i],
      score: 0,
    }));

    this.rounds = [];
    this.currentRoundIdx = -1;
    // Cumulative trash talk votes across rounds: playerId -> count.
    this.trashTalkLeaderboard = new Map();
  }

  // Reset everything that's specific to a played game, keep the lobby
  // membership intact: players, team slots, config. Players have to
  // re-ready, since they're consenting to a fresh game.
  resetForReplay() {
    this.status = 'lobby';
    this.phase = 0;
    this.phaseDeadlineMs = null;
    this.phaseStartMs = null;
    this.phaseDurationMs = null;
    this.paused = false;
    this.pausedRemainingMs = null;
    this.rounds = [];
    this.currentRoundIdx = -1;
    this.usedImageIds = [];
    this.trashTalkLeaderboard = new Map();
    for (const team of this.teams) team.score = 0;
    for (const p of this.players.values()) p.ready = false;
  }

  applyConfigPatch(patch) {
    if (this.status !== 'lobby') return false;
    let changed = false;
    if (patch.rounds !== undefined) {
      const v = clampRounds(patch.rounds);
      if (v !== this.config.rounds) { this.config.rounds = v; changed = true; }
    }
    if (patch.speed !== undefined) {
      const v = clampSpeed(patch.speed);
      if (v !== this.config.speed) { this.config.speed = v; changed = true; }
    }
    if (patch.doublePoints !== undefined) {
      const v = !!patch.doublePoints;
      if (v !== this.config.doublePoints) { this.config.doublePoints = v; changed = true; }
    }
    if (patch.trashTalkEnabled !== undefined) {
      const v = !!patch.trashTalkEnabled;
      if (v !== this.config.trashTalkEnabled) { this.config.trashTalkEnabled = v; changed = true; }
    }
    if (changed) {
      // Settings changed under players' feet — re-confirm readiness.
      for (const p of this.players.values()) p.ready = false;
    }
    return changed;
  }

  // Smallest team gets the next player. Tiebreak: lowest slot.
  pickSmallestTeamSlot() {
    const counts = [0, 0, 0];
    for (const p of this.players.values()) {
      if (p.isConnected) counts[p.teamSlot - 1]++;
    }
    let bestSlot = 1;
    let bestCount = counts[0];
    for (let i = 1; i < 3; i++) {
      if (counts[i] < bestCount) {
        bestCount = counts[i];
        bestSlot = i + 1;
      }
    }
    return bestSlot;
  }

  upsertPlayer({ playerId, socketId, name }) {
    const existing = this.players.get(playerId);
    if (existing) {
      existing.socketId = socketId;
      existing.name = name;
      existing.isConnected = true;
      return existing;
    }
    const player = {
      socketId,
      name,
      teamSlot: this.pickSmallestTeamSlot(),
      ready: false,
      isConnected: true,
      joinedAt: Date.now(),
    };
    this.players.set(playerId, player);
    return player;
  }

  markDisconnected(socketId) {
    let touched = null;
    for (const [id, p] of this.players) {
      if (p.socketId === socketId) {
        p.isConnected = false;
        touched = id;
      }
    }
    if (this.hostSocketId === socketId) this.hostSocketId = null;
    if (this.hostRemoteSocketId === socketId) this.hostRemoteSocketId = null;
    return touched;
  }

  switchTeam(playerId, teamSlot) {
    const p = this.players.get(playerId);
    if (!p) return false;
    if (![1, 2, 3].includes(teamSlot)) return false;
    if (p.teamSlot === teamSlot) return false; // no-op

    p.teamSlot = teamSlot;
    p.ready = false;

    // Mid-game switch: drop this round's contributions so they don't
    // accidentally count toward the new team. Player effectively rejoins
    // the round in progress with a clean slate.
    if (this.status === 'playing' && this.currentRoundIdx >= 0) {
      const round = this.rounds[this.currentRoundIdx];
      if (round) {
        round.perPlayerBluffs?.delete(playerId);
        round.bluffTypingAt?.delete(playerId);
        round.intraVotes?.delete(playerId);
        round.mainVotes?.delete(playerId);
        round.trashTalkVotes?.delete(playerId);
      }
    }
    return true;
  }

  setReady(playerId, ready) {
    const p = this.players.get(playerId);
    if (!p) return false;
    if (this.status !== 'lobby') return false;
    p.ready = !!ready;
    return true;
  }

  removePlayer(playerId) {
    return this.players.delete(playerId);
  }

  isEmpty() {
    return this.players.size === 0 && !this.hostSocketId;
  }

  publicSummary() {
    return {
      code: this.code,
      status: this.status,
      playerCount: Array.from(this.players.values()).filter((p) => p.isConnected).length,
      rounds: this.config.rounds,
      createdAt: this.createdAt,
    };
  }
}

module.exports = {
  Room,
  TEAM_COLORS, DEFAULT_TEAM_NAMES,
  MIN_ROUNDS, MAX_ROUNDS, DEFAULT_ROUNDS,
  VALID_SPEEDS, DEFAULT_SPEED,
  clampRounds, clampSpeed,
};
