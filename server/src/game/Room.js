const TEAM_COLORS = ['cyan', 'magenta', 'amber'];
const DEFAULT_TEAM_NAMES = ['Team Cyan', 'Team Magenta', 'Team Amber'];

const MIN_ROUNDS = 3;
const MAX_ROUNDS = 7;
const DEFAULT_ROUNDS = 5;

function clampRounds(n) {
  const r = Number.isFinite(n) ? Math.floor(n) : DEFAULT_ROUNDS;
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, r));
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
      doublePoints: !!config?.doublePoints,
    };

    this.hostSocketId = null;
    this.hostRemoteSocketId = null;

    this.players = new Map(); // playerId -> { socketId, name, teamSlot, ready, isConnected, joinedAt }
    this.teams = TEAM_COLORS.map((color, i) => ({
      slot: i + 1,
      color,
      name: DEFAULT_TEAM_NAMES[i],
      score: 0,
    }));

    // Round state populated in step 3+.
    this.rounds = [];
    this.currentRoundIdx = -1;
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
    if (this.status !== 'lobby') return false;
    p.teamSlot = teamSlot;
    p.ready = false; // changing teams resets ready state
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

module.exports = { Room, TEAM_COLORS, DEFAULT_TEAM_NAMES, MIN_ROUNDS, MAX_ROUNDS, DEFAULT_ROUNDS, clampRounds };
