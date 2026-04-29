const { getRoom } = require('./rooms');
const { broadcastRoomState } = require('./broadcast');

function attachHostHandlers(io, socket) {
  function withHost(ack, handler) {
    const { code, role } = socket.data;
    if (role !== 'host' && role !== 'host-remote') {
      return ack?.({ ok: false, error: 'not_host' });
    }
    const room = code && getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'room_not_found' });
    return handler(room);
  }

  socket.on('host:configure', (patch = {}, ack) => {
    withHost(ack, (room) => {
      if (room.status !== 'lobby') return ack?.({ ok: false, error: 'wrong_status' });
      room.applyConfigPatch(patch);
      broadcastRoomState(io, room);
      ack?.({ ok: true, config: room.config });
    });
  });

  socket.on('host:start-game', (_payload, ack) => {
    withHost(ack, (room) => {
      if (room.status !== 'lobby') return ack?.({ ok: false, error: 'already_started' });

      const connected = Array.from(room.players.values()).filter((p) => p.isConnected);
      if (connected.length < 1) return ack?.({ ok: false, error: 'no_players' });
      if (!connected.every((p) => p.ready)) return ack?.({ ok: false, error: 'not_all_ready' });

      const ok = room.phaseMachine.start();
      if (!ok) return ack?.({ ok: false, error: 'start_failed' });
      ack?.({ ok: true });
    });
  });

  socket.on('host:pause', (_payload, ack) => {
    withHost(ack, (room) => {
      const ok = room.phaseMachine.pause();
      ack?.(ok ? { ok: true } : { ok: false, error: 'pause_rejected' });
    });
  });

  socket.on('host:resume', (_payload, ack) => {
    withHost(ack, (room) => {
      const ok = room.phaseMachine.resume();
      ack?.(ok ? { ok: true } : { ok: false, error: 'resume_rejected' });
    });
  });

  socket.on('host:add-seconds', ({ seconds = 15 } = {}, ack) => {
    withHost(ack, (room) => {
      const ok = room.phaseMachine.addSeconds(seconds);
      ack?.(ok ? { ok: true } : { ok: false, error: 'add_rejected' });
    });
  });

  socket.on('host:undo-phase', (_payload, ack) => {
    withHost(ack, (room) => {
      const ok = room.phaseMachine.undo();
      ack?.(ok ? { ok: true } : { ok: false, error: 'nothing_to_undo' });
    });
  });

  socket.on('host:trash-round', (_payload, ack) => {
    withHost(ack, (room) => {
      const ok = room.phaseMachine.trashCurrentRound();
      ack?.(ok ? { ok: true } : { ok: false, error: 'trash_rejected' });
    });
  });

  socket.on('host:move-player', ({ playerId, teamSlot } = {}, ack) => {
    withHost(ack, (room) => {
      if (typeof playerId !== 'string') return ack?.({ ok: false, error: 'bad_player_id' });
      if (![1, 2, 3].includes(teamSlot)) return ack?.({ ok: false, error: 'bad_team' });
      const ok = room.switchTeam(playerId, teamSlot);
      if (!ok) return ack?.({ ok: false, error: 'switch_rejected' });
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });

  socket.on('host:kick-player', ({ playerId } = {}, ack) => {
    withHost(ack, (room) => {
      if (typeof playerId !== 'string') return ack?.({ ok: false, error: 'bad_player_id' });
      const player = room.players.get(playerId);
      if (!player) return ack?.({ ok: false, error: 'player_not_found' });

      // Tell the kicked socket and disconnect them from the room.
      const kickedSock = player.socketId && io.sockets.sockets.get(player.socketId);
      if (kickedSock) {
        kickedSock.emit('room:kicked', { code: room.code });
        kickedSock.leave(`room:${room.code}`);
      }
      room.removePlayer(playerId);
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });

  socket.on('host:end-game', (_payload, ack) => {
    withHost(ack, (room) => {
      room.phaseMachine.endGame();
      ack?.({ ok: true });
    });
  });

  socket.on('host:play-again', (_payload, ack) => {
    withHost(ack, (room) => {
      if (room.status !== 'finished') {
        return ack?.({ ok: false, error: 'not_finished' });
      }
      room.phaseMachine?.resetForReplay();
      room.resetForReplay();
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });
}

module.exports = { attachHostHandlers };
