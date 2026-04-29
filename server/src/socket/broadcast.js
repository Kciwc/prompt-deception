const { serializeForPlayer } = require('../game/serializeForPlayer');
const { listPublicRooms } = require('./rooms');

const LOBBY_BROWSER_ROOM = 'lobby:browser';

// Per-viewer broadcast: the serializer is viewer-aware (anti-leak), so we
// can't use a flat io.to(roomId).emit. Iterate sockets in the room.
function broadcastRoomState(io, room) {
  for (const [playerId, p] of room.players) {
    if (!p.socketId) continue;
    const sock = io.sockets.sockets.get(p.socketId);
    if (!sock) continue;
    sock.emit('room:state', serializeForPlayer(room, { kind: 'player', playerId }));
  }
  for (const sid of [room.hostSocketId, room.hostRemoteSocketId]) {
    if (!sid) continue;
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit('room:state', serializeForPlayer(room, { kind: 'host' }));
  }
}

function broadcastLobbyList(io) {
  io.to(LOBBY_BROWSER_ROOM).emit('lobby:list', listPublicRooms());
}

module.exports = { broadcastRoomState, broadcastLobbyList, LOBBY_BROWSER_ROOM };
