const {
  getGame,
  addPlayer,
  removePlayer,
  serializeForClient,
  getConnectedPlayers,
  getTeamPlayers,
} = require('../game/state');
const { DEBOUNCE_MS } = require('../config');

function registerLobbyHandlers(io, socket) {
  // Player joins an existing game room
  socket.on('join', ({ roomCode, playerName }) => {
    const game = getGame(roomCode);
    if (!game) {
      socket.emit('error', { message: "That room doesn't exist. Check the code on the TV." });
      return;
    }
    if (game.phase !== 0) {
      socket.emit('error', { message: 'Game already in progress. Too slow!' });
      return;
    }
    if (playerName.trim().length < 2) {
      socket.emit('error', { message: 'Pick a real name. At least 2 characters.' });
      return;
    }

    // Check for duplicate names
    for (const p of game.players.values()) {
      if (p.name.toLowerCase() === playerName.trim().toLowerCase()) {
        socket.emit('error', { message: 'That name is taken. Be more creative.' });
        return;
      }
    }

    const player = addPlayer(game, socket.id, playerName.trim());
    socket.join(`game:${roomCode}`);
    socket.join(`game:${roomCode}:team:${player.teamIndex}`);
    socket.data.roomCode = roomCode;

    io.to(`game:${roomCode}`).emit('gameState', serializeForClient(game));
  });

  // Player switches teams
  socket.on('switchTeam', ({ targetTeam }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 0) return;
    const player = game.players.get(socket.id);
    if (!player) return;
    if (targetTeam < 0 || targetTeam > 2) return;
    if (player.teamIndex === targetTeam) return;

    // Leave old team room, join new
    socket.leave(`game:${game.roomCode}:team:${player.teamIndex}`);
    player.teamIndex = targetTeam;
    socket.join(`game:${game.roomCode}:team:${targetTeam}`);

    io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
  });

  // Propose a team name
  socket.on('proposeTeamName', ({ name }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 0) return;
    const player = game.players.get(socket.id);
    if (!player || player.teamIndex === null) return;

    const cleaned = name.trim().slice(0, 30);
    if (cleaned.length < 2) return;

    const team = game.teams[player.teamIndex];
    // Max 5 proposals per team
    if (team.proposedNames.length >= 5) return;

    team.proposedNames.push({ name: cleaned, votes: 0, proposer: socket.id });
    io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
  });

  // Vote for a team name
  socket.on('voteTeamName', ({ nameIndex }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 0) return;
    const player = game.players.get(socket.id);
    if (!player || player.teamIndex === null) return;

    const team = game.teams[player.teamIndex];
    if (nameIndex < 0 || nameIndex >= team.proposedNames.length) return;

    team.proposedNames[nameIndex].votes++;

    // Auto-finalize: if a name gets majority of team
    const teamPlayers = getTeamPlayers(game, player.teamIndex);
    const majority = Math.ceil(teamPlayers.length / 2);
    if (team.proposedNames[nameIndex].votes >= majority) {
      team.finalName = team.proposedNames[nameIndex].name;
    }

    io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
  });

  // Player marks ready
  socket.on('ready', () => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 0) return;
    const player = game.players.get(socket.id);
    if (!player) return;

    player.ready = !player.ready;
    io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const game = getGame(socket.data.roomCode);
    if (!game) return;

    const player = game.players.get(socket.id);
    if (player) {
      player.connected = false;

      // Check if team is now empty — handled by rounds.js during phase transitions
      io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));
    }

    // If TV disconnects, auto-pause before next phase
    if (socket.id === game.tvSocketId) {
      game.tvSocketId = null;
      io.to(`game:${game.roomCode}`).emit('tvDisconnected', {
        message: 'Host disconnected — game will pause after this phase.',
      });
    }
  });
}

module.exports = { registerLobbyHandlers };
