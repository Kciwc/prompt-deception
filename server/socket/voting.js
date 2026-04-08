const { getGame, serializeForClient, getConnectedPlayers } = require('../game/state');
const { fastForwardTo } = require('../game/timer');
const { TIMERS, DEBOUNCE_MS } = require('../config');

function registerVotingHandlers(io, socket) {
  // Phase 3: Main vote
  socket.on('voteMainRound', ({ optionIndex }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 3) return;
    const player = game.players.get(socket.id);
    if (!player || player.teamIndex === null) return;

    // Server-side debounce
    const now = Date.now();
    if (now - player.lastEventTime < DEBOUNCE_MS) return;
    player.lastEventTime = now;

    if (!game.mainVoteOptions || optionIndex < 0 || optionIndex >= game.mainVoteOptions.length) {
      return;
    }

    // Can't vote for own team's bluff
    const option = game.mainVoteOptions[optionIndex];
    if (option.sourceTeam === player.teamIndex) {
      socket.emit('error', {
        message: "You can't vote for your own team's bluff. Nice try though.",
      });
      return;
    }

    // Players can change votes until timer expires
    game.mainVotes.set(socket.id, optionIndex);
    player.phase3Vote = optionIndex;

    // Emit vote count (no content leak)
    const lockedCount = game.mainVotes.size;
    const totalVoters = getConnectedPlayers(game).filter((p) => p.teamIndex !== null).length;
    io.to(`game:${game.roomCode}`).emit('voteUpdate', { lockedCount, totalVoters });

    // Check if ALL players have voted — fast forward
    if (lockedCount >= totalVoters) {
      fastForwardTo(game, TIMERS.FAST_FORWARD);
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining: game.timer.remaining });
    }
  });

  // Phase 4: Thumbs up/down feedback
  socket.on('feedback', ({ thumbsUp }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 4) return;
    const player = game.players.get(socket.id);
    if (!player) return;

    // Server-side debounce
    const now = Date.now();
    if (now - player.lastEventTime < DEBOUNCE_MS) return;
    player.lastEventTime = now;

    player.phase4Feedback = thumbsUp;
    game.feedbacks.set(socket.id, thumbsUp);

    // Check if all voted
    const totalPlayers = getConnectedPlayers(game).filter((p) => p.teamIndex !== null).length;
    if (game.feedbacks.size >= totalPlayers) {
      fastForwardTo(game, TIMERS.FAST_FORWARD);
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining: game.timer.remaining });
    }
  });
}

module.exports = { registerVotingHandlers };
