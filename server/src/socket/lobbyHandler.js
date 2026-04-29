const { Room, clampRounds } = require('../game/Room');
const { generateRoomCode } = require('../game/codeGenerator');
const { PhaseMachine } = require('../game/phaseMachine');
const { issueHostToken, verifyHostToken } = require('../auth/hostToken');
const { setRoom, getRoom, allRooms, listPublicRooms } = require('./rooms');
const { broadcastLobbyList, broadcastRoomState, LOBBY_BROWSER_ROOM } = require('./broadcast');

function attachLobbyHandlers(io, socket) {
  socket.on('lobby:browse', () => {
    socket.join(LOBBY_BROWSER_ROOM);
    socket.emit('lobby:list', listPublicRooms());
  });

  socket.on('lobby:create', (input, ack) => {
    try {
      const isPublic = !!input?.isPublic;
      const config = { rounds: clampRounds(input?.rounds), doublePoints: !!input?.doublePoints };
      const code = generateRoomCode(allRooms());
      const room = new Room({ code, isPublic, config });
      room.phaseMachine = new PhaseMachine(room, io);
      setRoom(room);

      const hostToken = issueHostToken(code);
      socket.join(`room:${code}`);
      room.hostSocketId = socket.id;
      // Stash for cleanup / reconnect bookkeeping.
      socket.data.role = 'host';
      socket.data.code = code;

      if (isPublic) broadcastLobbyList(io);
      broadcastRoomState(io, room);

      if (typeof ack === 'function') ack({ ok: true, code, hostToken });
    } catch (err) {
      console.error('[lobby:create] failed:', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'create_failed' });
    }
  });

  // Re-attach the host socket on TV reload. Verifies the signed token.
  socket.on('host:attach', ({ code, hostToken } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'room_not_found' });
    if (!verifyHostToken(hostToken, code)) return ack?.({ ok: false, error: 'bad_token' });

    socket.join(`room:${code}`);
    room.hostSocketId = socket.id;
    socket.data.role = 'host';
    socket.data.code = code;

    broadcastRoomState(io, room);
    ack?.({ ok: true });
  });

  // Optional phone remote — shares the same hostToken.
  socket.on('host-remote:attach', ({ code, hostToken } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'room_not_found' });
    if (!verifyHostToken(hostToken, code)) return ack?.({ ok: false, error: 'bad_token' });

    socket.join(`room:${code}`);
    room.hostRemoteSocketId = socket.id;
    socket.data.role = 'host-remote';
    socket.data.code = code;

    broadcastRoomState(io, room);
    ack?.({ ok: true });
  });
}

module.exports = { attachLobbyHandlers };
