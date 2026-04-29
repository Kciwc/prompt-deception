const { sanitizeName } = require('../game/sanitize');
const { getRoom, deleteRoom } = require('./rooms');
const { broadcastRoomState, broadcastLobbyList } = require('./broadcast');

function attachRoomHandlers(io, socket) {
  socket.on('room:join', ({ code, playerId, name } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'room_not_found' });
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'game_in_progress' });
    if (typeof playerId !== 'string' || playerId.length < 8 || playerId.length > 64) {
      return ack?.({ ok: false, error: 'bad_player_id' });
    }
    const cleanName = sanitizeName(name);
    if (!cleanName) return ack?.({ ok: false, error: 'bad_name' });

    room.upsertPlayer({ playerId, socketId: socket.id, name: cleanName });
    socket.join(`room:${code}`);
    socket.data.role = 'player';
    socket.data.code = code;
    socket.data.playerId = playerId;

    broadcastRoomState(io, room);
    if (room.isPublic) broadcastLobbyList(io);

    ack?.({ ok: true });
  });

  socket.on('room:team-switch', ({ teamSlot } = {}, ack) => {
    const { code, playerId } = socket.data;
    const room = code && getRoom(code);
    if (!room || !playerId) return ack?.({ ok: false, error: 'not_in_room' });
    const ok = room.switchTeam(playerId, teamSlot);
    if (!ok) return ack?.({ ok: false, error: 'switch_rejected' });
    broadcastRoomState(io, room);
    ack?.({ ok: true });
  });

  socket.on('room:ready', ({ ready } = {}, ack) => {
    const { code, playerId } = socket.data;
    const room = code && getRoom(code);
    if (!room || !playerId) return ack?.({ ok: false, error: 'not_in_room' });
    const ok = room.setReady(playerId, ready);
    if (!ok) return ack?.({ ok: false, error: 'ready_rejected' });
    broadcastRoomState(io, room);
    ack?.({ ok: true });
  });

  socket.on('room:leave', () => {
    handleSocketGone(io, socket, /* explicit */ true);
  });

  socket.on('disconnect', () => {
    handleSocketGone(io, socket, /* explicit */ false);
  });
}

function handleSocketGone(io, socket, explicit) {
  const { code, role, playerId } = socket.data;
  if (!code) return;
  const room = getRoom(code);
  if (!room) return;

  if (role === 'player' && playerId) {
    if (explicit) {
      room.removePlayer(playerId);
    } else {
      room.markDisconnected(socket.id);
    }
  } else {
    // host or remote
    room.markDisconnected(socket.id);
  }

  if (room.isEmpty()) {
    deleteRoom(code);
    if (room.isPublic) broadcastLobbyList(io);
    return;
  }

  broadcastRoomState(io, room);
  if (room.isPublic) broadcastLobbyList(io);
}

module.exports = { attachRoomHandlers };
