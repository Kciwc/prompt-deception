const { sanitizeBluff } = require('../game/sanitize');
const { getRoom } = require('./rooms');
const { broadcastRoomState } = require('./broadcast');

function attachGameHandlers(io, socket) {
  function withPlayer(ack, handler) {
    const { code, playerId, role } = socket.data;
    if (role !== 'player' || !playerId) return ack?.({ ok: false, error: 'not_player' });
    const room = code && getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'room_not_found' });
    return handler(room, playerId);
  }

  socket.on('bluff:submit', ({ text } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 1) return ack?.({ ok: false, error: 'wrong_phase' });
      const cleaned = sanitizeBluff(text);
      if (!cleaned) return ack?.({ ok: false, error: 'bluff_too_short' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      round.perPlayerBluffs.set(playerId, cleaned);
      broadcastRoomState(io, room);
      room.phaseMachine.checkEarlyLock();
      ack?.({ ok: true });
    });
  });

  socket.on('intra-vote:cast', ({ targetPlayerId } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 2) return ack?.({ ok: false, error: 'wrong_phase' });
      const target = room.players.get(targetPlayerId);
      const voter = room.players.get(playerId);
      if (!target || !voter) return ack?.({ ok: false, error: 'bad_target' });
      if (target.teamSlot !== voter.teamSlot) {
        return ack?.({ ok: false, error: 'cross_team_vote' });
      }
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      // Only valid if target submitted a bluff.
      if (!round.perPlayerBluffs.has(targetPlayerId)) {
        return ack?.({ ok: false, error: 'target_no_bluff' });
      }
      round.intraVotes.set(playerId, targetPlayerId);
      broadcastRoomState(io, room);
      room.phaseMachine.checkEarlyLock();
      ack?.({ ok: true });
    });
  });

  socket.on('main-vote:cast', ({ candidate } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 3) return ack?.({ ok: false, error: 'wrong_phase' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round || !round.candidatesOrder) return ack?.({ ok: false, error: 'no_candidates' });
      const validIds = new Set(round.candidatesOrder.map((c) => c.id));
      if (!validIds.has(candidate)) return ack?.({ ok: false, error: 'bad_candidate' });

      const voter = room.players.get(playerId);
      if (!voter) return ack?.({ ok: false, error: 'no_player' });
      // Cannot vote for own team's bluff.
      if (candidate === `team:${voter.teamSlot}`) {
        return ack?.({ ok: false, error: 'no_self_team_vote' });
      }

      round.mainVotes.set(playerId, candidate);
      broadcastRoomState(io, room);
      room.phaseMachine.checkEarlyLock();
      ack?.({ ok: true });
    });
  });

  socket.on('feedback:submit', ({ thumbs } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 4) return ack?.({ ok: false, error: 'wrong_phase' });
      if (thumbs !== 'up' && thumbs !== 'down') {
        return ack?.({ ok: false, error: 'bad_thumbs' });
      }
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      round.feedback.set(playerId, thumbs);
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });
}

module.exports = { attachGameHandlers };
