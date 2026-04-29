const { attachLobbyHandlers } = require('./lobbyHandler');
const { attachRoomHandlers } = require('./roomHandler');
const { attachHostHandlers } = require('./hostHandler');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[socket] connect', socket.id);
    socket.data = {};

    attachLobbyHandlers(io, socket);
    attachRoomHandlers(io, socket);
    attachHostHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnect', socket.id, reason);
    });
  });
}

module.exports = { registerSocketHandlers };
