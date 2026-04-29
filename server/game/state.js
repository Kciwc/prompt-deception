const { TEAMS } = require('../config');

// In-memory store: Map<roomCode, GameState>
const games = new Map();

function createGame(roomCode, rounds, tvSocketId, lobbyName) {
  const state = {
    roomCode,
    lobbyName: lobbyName || `Game ${roomCode}`,
    phase: 0,
    paused: false,
    roundIndex: 0,
    totalRounds: rounds.length,
    doublePoints: false,

    // Loaded from DB at game creation, held in memory only
    rounds: rounds.map((r) => ({
      id: r.id,
      imageUrl: r.imageUrl,
      realPrompt: r.realPrompt,
    })),

    teams: TEAMS.map((t) => ({
      index: t.index,
      color: t.color,
      proposedNames: [],
      finalName: `Team ${t.label}`,
      score: 0,
      bluffs: [],
      selectedBluff: null,
      intraVotes: {},
    })),

    // Map<socketId, PlayerData>
    players: new Map(),

    timer: {
      remaining: 0,
      startedAt: null,
      duration: 0,
      intervalRef: null,
      paused: false,
    },

    // Phase 3 shuffled options — built server-side
    mainVoteOptions: null,

    // Phase 3 individual votes: Map<socketId, optionIndex>
    mainVotes: new Map(),

    // Phase 4 feedback: Map<socketId, boolean>
    feedbacks: new Map(),

    tvSocketId,
  };

  games.set(roomCode, state);
  return state;
}

function getGame(roomCode) {
  return games.get(roomCode) || null;
}

function deleteGame(roomCode) {
  games.delete(roomCode);
}

function findGameBySocket(socketId) {
  for (const [code, game] of games) {
    if (game.tvSocketId === socketId || game.players.has(socketId)) {
      return game;
    }
  }
  return null;
}

function addPlayer(game, socketId, name) {
  // Find the team with fewest players for auto-balance
  const teamCounts = [0, 0, 0];
  for (const p of game.players.values()) {
    if (p.teamIndex !== null) teamCounts[p.teamIndex]++;
  }
  const minCount = Math.min(...teamCounts);
  const teamIndex = teamCounts.indexOf(minCount);

  const player = {
    name,
    teamIndex,
    ready: false,
    phase2Vote: null,
    phase3Vote: null,
    phase4Feedback: null,
    connected: true,
    lastEventTime: 0,
  };

  game.players.set(socketId, player);
  return player;
}

function removePlayer(game, socketId) {
  game.players.delete(socketId);
}

function getConnectedPlayers(game) {
  const result = [];
  for (const [id, p] of game.players) {
    if (p.connected) result.push({ socketId: id, ...p });
  }
  return result;
}

function getTeamPlayers(game, teamIndex) {
  const result = [];
  for (const [id, p] of game.players) {
    if (p.teamIndex === teamIndex && p.connected) {
      result.push({ socketId: id, ...p });
    }
  }
  return result;
}

// Serialize state for clients — strips realPrompt unless phase >= 3
function serializeForClient(game) {
  const currentRound = game.rounds[game.roundIndex] || null;
  const players = [];
  for (const [id, p] of game.players) {
    players.push({
      socketId: id,
      name: p.name,
      teamIndex: p.teamIndex,
      ready: p.ready,
      connected: p.connected,
    });
  }

  return {
    roomCode: game.roomCode,
    lobbyName: game.lobbyName,
    phase: game.phase,
    paused: game.paused,
    roundIndex: game.roundIndex,
    totalRounds: game.totalRounds,
    doublePoints: game.doublePoints,
    currentImage: currentRound ? currentRound.imageUrl : null,
    teams: game.teams.map((t) => ({
      index: t.index,
      color: t.color,
      proposedNames: t.proposedNames,
      finalName: t.finalName,
      score: t.score,
      bluffCount: t.bluffs.length,
      selectedBluff: game.phase >= 3 ? t.selectedBluff : null,
    })),
    players,
    timer: { remaining: game.timer.remaining },
    mainVoteOptions:
      game.phase >= 3 && game.mainVoteOptions
        ? game.mainVoteOptions.map((o) => ({ text: o.text, index: o.index }))
        : null,
    tvSocketId: game.tvSocketId,
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (games.has(code)) return generateRoomCode();
  return code;
}

module.exports = {
  games,
  createGame,
  getGame,
  deleteGame,
  findGameBySocket,
  addPlayer,
  removePlayer,
  getConnectedPlayers,
  getTeamPlayers,
  serializeForClient,
  generateRoomCode,
};
