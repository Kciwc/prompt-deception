const { games, serializeForClient } = require('../game/state');

/**
 * Get a summary of all active public lobbies for the lobby browser
 */
function getLobbySummaries() {
  const lobbies = [];
  for (const [code, game] of games) {
    let playerCount = 0;
    for (const p of game.players.values()) {
      if (p.connected) playerCount++;
    }

    lobbies.push({
      roomCode: code,
      lobbyName: game.lobbyName || `Game ${code}`,
      playerCount,
      maxPlayers: 30,
      phase: game.phase,
      teams: game.teams.map((t) => ({
        index: t.index,
        color: t.color,
        finalName: t.finalName,
        playerCount: [...game.players.values()].filter(
          (p) => p.teamIndex === t.index && p.connected
        ).length,
      })),
    });
  }
  return lobbies;
}

/**
 * Broadcast updated lobby list to all sockets in the 'lobbyBrowser' room
 */
function broadcastLobbies(io) {
  io.to('lobbyBrowser').emit('lobby:list', getLobbySummaries());
}

function registerLobbyBrowserHandlers(io, socket) {
  // Client wants to see the lobby list
  socket.on('lobby:subscribe', () => {
    socket.join('lobbyBrowser');
    socket.emit('lobby:list', getLobbySummaries());
  });

  socket.on('lobby:unsubscribe', () => {
    socket.leave('lobbyBrowser');
  });
}

module.exports = { registerLobbyBrowserHandlers, broadcastLobbies, getLobbySummaries };
