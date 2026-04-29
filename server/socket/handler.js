const {
  createGame,
  getGame,
  deleteGame,
  addPlayer,
  serializeForClient,
  generateRoomCode,
} = require('../game/state');
const { pauseTimer, resumeTimer, addTime, clearTimer } = require('../game/timer');
const { DEBOUNCE_MS } = require('../config');
const { registerLobbyHandlers } = require('./lobby');
const { registerRoundHandlers, startPhase1, startPhase2, startPhase3 } = require('./rounds');
const { registerVotingHandlers } = require('./voting');
const { registerLobbyBrowserHandlers, broadcastLobbies } = require('./lobbyBrowser');
const prisma = require('../db');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    // Register all sub-handlers
    registerLobbyHandlers(io, socket);
    registerRoundHandlers(io, socket);
    registerVotingHandlers(io, socket);
    registerLobbyBrowserHandlers(io, socket);

    // ─── TV Screen Events ───

    // TV creates a new game room
    socket.on('tv:createRoom', async ({ lobbyName } = {}) => {
      const roomCode = generateRoomCode();

      // Load unused round content from DB
      let rounds;
      try {
        rounds = await prisma.roundContent.findMany({
          where: { used: false },
          orderBy: { createdAt: 'asc' },
        });
      } catch (err) {
        console.error('DB error loading rounds:', err);
        rounds = [];
      }

      if (rounds.length === 0) {
        socket.emit('error', {
          message: 'No round content available. Upload images and prompts in /admin first.',
        });
        return;
      }

      const game = createGame(roomCode, rounds, socket.id, lobbyName);
      socket.join(`game:${roomCode}`);
      socket.join(`game:${roomCode}:tv`);
      socket.data.roomCode = roomCode;

      socket.emit('roomCreated', { roomCode });
      socket.emit('gameState', serializeForClient(game));

      broadcastLobbies(io);
    });

    // TV joins an existing room (reconnect)
    socket.on('tv:join', ({ roomCode }) => {
      const game = getGame(roomCode);
      if (!game) {
        socket.emit('error', { message: 'Room not found.' });
        return;
      }

      game.tvSocketId = socket.id;
      socket.join(`game:${roomCode}`);
      socket.join(`game:${roomCode}:tv`);
      socket.data.roomCode = roomCode;

      socket.emit('gameState', serializeForClient(game));

      if (game.paused) {
        socket.emit('paused', { paused: true, reason: 'Game is paused. Resume when ready.' });
      }

      io.to(`game:${roomCode}`).emit('tvReconnected');
    });

    // ─── Host Controls (TV only) ───

    socket.on('host:startGame', () => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;
      if (game.phase !== 0) return;

      let totalPlayers = 0;
      let readyCount = 0;
      for (const p of game.players.values()) {
        if (p.teamIndex !== null) {
          totalPlayers++;
          if (p.ready) readyCount++;
        }
      }

      if (totalPlayers < 2) {
        socket.emit('error', { message: 'Need at least 2 players to start.' });
        return;
      }

      if (readyCount < totalPlayers) {
        socket.emit('error', {
          message: `${totalPlayers - readyCount} player(s) aren't ready yet.`,
        });
        return;
      }

      startPhase1(io, game);
      broadcastLobbies(io);
    });

    socket.on('host:pause', () => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;

      game.paused = !game.paused;
      if (game.paused) {
        pauseTimer(game);
      } else {
        resumeTimer(game);
      }

      io.to(`game:${game.roomCode}`).emit('paused', { paused: game.paused });
    });

    socket.on('host:addTime', () => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;
      if (game.phase < 1 || game.phase > 3) return;

      addTime(game, 15);
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining: game.timer.remaining });
      io.to(`game:${game.roomCode}`).emit('hostAction', { action: '+15 seconds added!' });
    });

    socket.on('host:undoPhase', () => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;
      if (game.phase <= 1) return;

      clearTimer(game);

      if (game.phase === 2) {
        startPhase1(io, game);
      } else if (game.phase === 3) {
        startPhase2(io, game);
      } else if (game.phase === 4) {
        startPhase3(io, game);
      }

      io.to(`game:${game.roomCode}`).emit('hostAction', { action: 'Phase rewound!' });
    });

    socket.on('host:kick', ({ socketId: targetId }) => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;

      const target = game.players.get(targetId);
      if (!target) return;

      game.players.delete(targetId);
      io.to(targetId).emit('playerKicked', { reason: "You've been removed by the host." });
      const targetSocket = io.sockets.sockets.get(targetId);
      if (targetSocket) {
        targetSocket.leave(`game:${game.roomCode}`);
        targetSocket.leave(`game:${game.roomCode}:team:${target.teamIndex}`);
      }

      io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
      io.to(`game:${game.roomCode}`).emit('hostAction', {
        action: `${target.name} was kicked!`,
      });
      broadcastLobbies(io);
    });

    socket.on('host:trashRound', () => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;
      if (game.phase < 1 || game.phase > 3) return;

      clearTimer(game);

      game.rounds.splice(game.roundIndex, 1);
      game.totalRounds = game.rounds.length;

      if (game.roundIndex >= game.totalRounds) {
        const { startPhase5 } = require('./reveal');
        startPhase5(io, game);
        return;
      }

      io.to(`game:${game.roomCode}`).emit('hostAction', {
        action: 'Round trashed! Moving on...',
      });
      startPhase1(io, game);
    });

    socket.on('host:doublePoints', () => {
      const game = getGame(socket.data.roomCode);
      if (!game || socket.id !== game.tvSocketId) return;
      if (game.phase !== 1) return;

      game.doublePoints = !game.doublePoints;
      io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
      io.to(`game:${game.roomCode}`).emit('hostAction', {
        action: game.doublePoints ? 'DOUBLE POINTS activated!' : 'Double Points deactivated.',
      });
    });

    // ─── TV Theme Toggle ───
    socket.on('tv:toggleTheme', () => {
      const game = getGame(socket.data.roomCode);
      if (!game) return;
      io.to(`game:${game.roomCode}:tv`).emit('themeToggle');
    });
  });
}

module.exports = { setupSocketHandlers };
