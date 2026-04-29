const { sanitizeBluff } = require('../game/sanitize');
const { getRoom } = require('./rooms');
const { broadcastRoomState } = require('./broadcast');

const MAX_BLUFF_DRAFT_LEN = 200;

function attachGameHandlers(io, socket) {
  function withPlayer(ack, handler) {
    const { code, playerId, role } = socket.data;
    if (role !== 'player' || !playerId) return ack?.({ ok: false, error: 'not_player' });
    const room = code && getRoom(code);
    if (!room) return ack?.({ ok: false, error: 'room_not_found' });
    return handler(room, playerId);
  }

  // Phase 1 (write + vote, merged). Bluff submission is now MUTABLE: clients
  // throttle keystrokes and re-submit. The server stores the latest draft;
  // sub-MIN texts are kept as drafts (visible to teammates) but won't become
  // candidates at phase 1→2 finalization.
  socket.on('bluff:submit', ({ text } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 1) return ack?.({ ok: false, error: 'wrong_phase' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });

      // Lightweight cleaning for drafts — just trim and clamp length.
      // Final filtering happens at _finalizeTeamBluffs (≥5 visible chars).
      const raw = typeof text === 'string' ? text : '';
      const cleaned = raw.slice(0, MAX_BLUFF_DRAFT_LEN);

      if (cleaned.length === 0) {
        round.perPlayerBluffs.delete(playerId);
      } else {
        round.perPlayerBluffs.set(playerId, cleaned);
      }
      round.bluffTypingAt.set(playerId, Date.now());
      broadcastRoomState(io, room);
      room.phaseMachine.checkEarlyLock();
      ack?.({ ok: true });
    });
  });

  socket.on('intra-vote:cast', ({ targetPlayerId } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      // Intra-vote is now part of phase 1 (collaborative phase).
      if (room.phase !== 1) return ack?.({ ok: false, error: 'wrong_phase' });
      const target = room.players.get(targetPlayerId);
      const voter = room.players.get(playerId);
      if (!target || !voter) return ack?.({ ok: false, error: 'bad_target' });
      if (target.teamSlot !== voter.teamSlot) {
        return ack?.({ ok: false, error: 'cross_team_vote' });
      }
      if (targetPlayerId === playerId) {
        return ack?.({ ok: false, error: 'no_self_vote' });
      }
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      // Don't require target to have submitted — they may still be typing.
      // If they end the phase with no text, the vote is dropped at finalize.
      round.intraVotes.set(playerId, targetPlayerId);
      broadcastRoomState(io, room);
      room.phaseMachine.checkEarlyLock();
      ack?.({ ok: true });
    });
  });

  socket.on('intra-vote:clear', (_payload, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 1) return ack?.({ ok: false, error: 'wrong_phase' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      round.intraVotes.delete(playerId);
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });

  socket.on('main-vote:cast', ({ candidate } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      // Main vote is now phase 2 (was phase 3).
      if (room.phase !== 2) return ack?.({ ok: false, error: 'wrong_phase' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round || !round.candidatesOrder) return ack?.({ ok: false, error: 'no_candidates' });
      const validIds = new Set(round.candidatesOrder.map((c) => c.id));
      if (!validIds.has(candidate)) return ack?.({ ok: false, error: 'bad_candidate' });

      const voter = room.players.get(playerId);
      if (!voter) return ack?.({ ok: false, error: 'no_player' });
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
      // Thumbs feedback is now phase 3 (reveal phase, was phase 4).
      if (room.phase !== 3) return ack?.({ ok: false, error: 'wrong_phase' });
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

  // Trash Talk MVP — vote during reveal phase only (phase 3).
  socket.on('trashtalk:vote', ({ targetPlayerId } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (!room.config.trashTalkEnabled) return ack?.({ ok: false, error: 'disabled' });
      if (room.phase !== 3) return ack?.({ ok: false, error: 'wrong_phase' });
      if (targetPlayerId === playerId) return ack?.({ ok: false, error: 'no_self_vote' });
      const target = room.players.get(targetPlayerId);
      if (!target) return ack?.({ ok: false, error: 'no_target' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      round.trashTalkVotes.set(playerId, targetPlayerId);
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });

  socket.on('trashtalk:clear', (_payload, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 3) return ack?.({ ok: false, error: 'wrong_phase' });
      const round = room.rounds[room.currentRoundIdx];
      if (!round) return ack?.({ ok: false, error: 'no_round' });
      round.trashTalkVotes.delete(playerId);
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });
  });

  // Nudge a teammate during the collaborative phase (was phase 2, now phase 1).
  socket.on('nudge:send', ({ targetPlayerId } = {}, ack) => {
    withPlayer(ack, (room, playerId) => {
      if (room.phase !== 1) return ack?.({ ok: false, error: 'wrong_phase' });
      const target = room.players.get(targetPlayerId);
      const sender = room.players.get(playerId);
      if (!target || !sender) return ack?.({ ok: false, error: 'no_target' });
      if (target.teamSlot !== sender.teamSlot) {
        return ack?.({ ok: false, error: 'cross_team_nudge' });
      }
      const targetSock = target.socketId && io.sockets.sockets.get(target.socketId);
      if (targetSock) {
        targetSock.emit('nudge:receive', { fromName: sender.name });
      }
      ack?.({ ok: true });
    });
  });
}

module.exports = { attachGameHandlers };
