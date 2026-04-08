const { getGame, serializeForClient, getConnectedPlayers } = require('../game/state');
const { startTimer, clearTimer } = require('../game/timer');
const { calculateRoundScores, applyScores, getPlacements } = require('../game/scoring');
const { generateSuperlatives } = require('../game/superlatives');
const { TIMERS } = require('../config');
const prisma = require('../db');

// Colorblind-friendly icons for reveal
const REVEAL_ICONS = ['◆', '●', '▲', '■'];

function startPhase4(io, game) {
  game.phase = 4;

  // Calculate scores
  const { deltas, trickCounts } = calculateRoundScores(game);
  applyScores(game, deltas);

  io.to(`game:${game.roomCode}`).emit('phaseChange', {
    phase: 4,
    timerSeconds: TIMERS.PHASE4_FEEDBACK,
  });

  // Step-by-step reveal sequence
  const options = game.mainVoteOptions || [];
  let revealIndex = 0;

  const revealInterval = setInterval(() => {
    if (revealIndex >= options.length) {
      clearInterval(revealInterval);

      // Send final scores
      io.to(`game:${game.roomCode}`).emit('scores', {
        teams: game.teams.map((t) => ({
          index: t.index,
          finalName: t.finalName,
          score: t.score,
          color: t.color,
        })),
        roundDelta: deltas,
        trickCounts,
      });

      // Start feedback timer
      startFeedbackTimer(io, game);
      return;
    }

    const option = options[revealIndex];
    const isReal = option.sourceTeam === null;

    io.to(`game:${game.roomCode}`).emit('revealStep', {
      optionIndex: revealIndex,
      text: option.text,
      isReal,
      sourceTeam: option.sourceTeam,
      icon: REVEAL_ICONS[revealIndex % REVEAL_ICONS.length],
      votesReceived: countVotesForOption(game, revealIndex),
    });

    if (isReal) {
      // Confetti on TV + correct players' phones
      io.to(`game:${game.roomCode}`).emit('confetti');

      // Notify players who got it right
      for (const [socketId, optIdx] of game.mainVotes) {
        if (optIdx === revealIndex) {
          io.to(socketId).emit('youGotItRight');
        }
      }
    }

    revealIndex++;
  }, 2500); // 2.5 second gap between reveals
}

function countVotesForOption(game, optionIndex) {
  let count = 0;
  for (const optIdx of game.mainVotes.values()) {
    if (optIdx === optionIndex) count++;
  }
  return count;
}

function startFeedbackTimer(io, game) {
  io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));

  startTimer(
    game,
    TIMERS.PHASE4_FEEDBACK,
    (remaining) => {
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining });
    },
    () => {
      // Move to next round or podium
      if (game.roundIndex + 1 >= game.totalRounds) {
        startPhase5(io, game);
      } else {
        game.roundIndex++;
        // Check for TV disconnect auto-pause
        if (game.tvSocketId === null) {
          game.paused = true;
          clearTimer(game);
          io.to(`game:${game.roomCode}`).emit('paused', {
            paused: true,
            reason: 'Host disconnected. Waiting for TV to reconnect.',
          });
          return;
        }
        const { startPhase1 } = require('./rounds');
        startPhase1(io, game);
      }
    }
  );
}

async function startPhase5(io, game) {
  game.phase = 5;
  clearTimer(game);

  const placements = getPlacements(game);
  const superlatives = generateSuperlatives(game);

  io.to(`game:${game.roomCode}`).emit('phaseChange', { phase: 5 });
  io.to(`game:${game.roomCode}`).emit('podium', { placements, superlatives });

  // Write final data to database
  try {
    const dbGame = await prisma.game.create({
      data: {
        roomCode: game.roomCode,
        totalRounds: game.totalRounds,
        startedAt: new Date(Date.now() - game.totalRounds * 5 * 60 * 1000), // approximate
        endedAt: new Date(),
      },
    });

    // Hall of Fame
    for (const p of placements) {
      const teamPlayers = [];
      for (const player of game.players.values()) {
        if (player.teamIndex === p.index) teamPlayers.push(player.name);
      }
      await prisma.hallOfFame.create({
        data: {
          gameId: dbGame.id,
          teamIndex: p.index,
          teamName: p.name,
          finalScore: p.score,
          placement: p.placement,
          playerNames: teamPlayers,
        },
      });
    }

    // Feedback records
    for (const [socketId, thumbsUp] of game.feedbacks) {
      const player = game.players.get(socketId);
      if (player) {
        await prisma.feedback.create({
          data: {
            gameId: dbGame.id,
            roundNumber: game.roundIndex,
            playerName: player.name,
            thumbsUp,
          },
        });
      }
    }

    // Mark round content as used
    for (const round of game.rounds) {
      await prisma.roundContent.update({
        where: { id: round.id },
        data: { used: true },
      });
    }
  } catch (err) {
    console.error('Failed to write game results to DB:', err);
  }
}

module.exports = { startPhase4, startPhase5 };
