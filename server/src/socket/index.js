function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('[socket] connect', socket.id);

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnect', socket.id, reason);
    });
  });
}

module.exports = { registerSocketHandlers };
