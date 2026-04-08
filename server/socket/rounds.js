const { getGame, serializeForClient, getTeamPlayers, getConnectedPlayers } = require('../game/state');
const { startTimer, clearTimer, fastForwardTo } = require('../game/timer');
const { sanitizeBluff } = require('../game/sanitize');
const { TIMERS } = require('../config');

function registerRoundHandlers(io, socket) {
  // Submit a bluff (Phase 1)
  socket.on('submitBluff', ({ text }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 1) return;
    const player = game.players.get(socket.id);
    if (!player || player.teamIndex === null) return;

    const result = sanitizeBluff(text);
    if (!result.valid) {
      socket.emit('bluffRejected', { error: result.error });
      return;
    }

    const team = game.teams[player.teamIndex];

    // Check if this player already submitted
    const existing = team.bluffs.findIndex((b) => b.socketId === socket.id);
    if (existing !== -1) {
      team.bluffs[existing].text = result.text;
    } else {
      team.bluffs.push({ socketId: socket.id, playerName: player.name, text: result.text });
    }

    // Notify team of submission count
    const teamPlayers = getTeamPlayers(game, player.teamIndex);
    io.to(`game:${game.roomCode}:team:${player.teamIndex}`).emit('bluffSubmitted', {
      count: team.bluffs.length,
      total: teamPlayers.length,
    });

    // Check if ALL players across ALL teams have submitted — fast forward
    checkAllSubmitted(io, game);
  });

  // Phase 2: Intra-team vote
  socket.on('voteIntraTeam', ({ bluffIndex }) => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 2) return;
    const player = game.players.get(socket.id);
    if (!player || player.teamIndex === null) return;

    const team = game.teams[player.teamIndex];
    if (bluffIndex < 0 || bluffIndex >= team.bluffs.length) return;

    // Can't vote for own bluff
    if (team.bluffs[bluffIndex].socketId === socket.id) {
      socket.emit('error', { message: "You can't vote for your own bluff, you narcissist." });
      return;
    }

    player.phase2Vote = bluffIndex;

    // Tally intra-team votes
    tallyIntraVotes(game, player.teamIndex);

    io.to(`game:${game.roomCode}:team:${player.teamIndex}`).emit('intraVoteUpdate', {
      votes: team.intraVotes,
    });

    // Check if all players in all teams have voted
    checkAllIntraVoted(io, game);
  });

  // Nudge teammates (Phase 2)
  socket.on('nudge', () => {
    const game = getGame(socket.data.roomCode);
    if (!game || game.phase !== 2) return;
    const player = game.players.get(socket.id);
    if (!player || player.teamIndex === null) return;

    socket.to(`game:${game.roomCode}:team:${player.teamIndex}`).emit('nudgeReceived');
  });
}

function tallyIntraVotes(game, teamIndex) {
  const team = game.teams[teamIndex];
  const votes = {};
  for (const [sid, p] of game.players) {
    if (p.teamIndex === teamIndex && p.phase2Vote !== null) {
      votes[p.phase2Vote] = (votes[p.phase2Vote] || 0) + 1;
    }
  }
  team.intraVotes = votes;
}

function checkAllSubmitted(io, game) {
  let allSubmitted = true;
  for (let i = 0; i < 3; i++) {
    const teamPlayers = getTeamPlayers(game, i);
    if (teamPlayers.length === 0) continue; // empty team
    if (game.teams[i].bluffs.length < teamPlayers.length) {
      allSubmitted = false;
      break;
    }
  }
  if (allSubmitted) {
    fastForwardTo(game, TIMERS.FAST_FORWARD);
    io.to(`game:${game.roomCode}`).emit('timerTick', { remaining: game.timer.remaining });
  }
}

function checkAllIntraVoted(io, game) {
  let allVoted = true;
  for (let i = 0; i < 3; i++) {
    const teamPlayers = getTeamPlayers(game, i);
    if (teamPlayers.length === 0) continue;
    for (const p of teamPlayers) {
      const playerData = game.players.get(p.socketId);
      if (playerData && playerData.phase2Vote === null) {
        allVoted = false;
        break;
      }
    }
    if (!allVoted) break;
  }
  if (allVoted) {
    fastForwardTo(game, TIMERS.FAST_FORWARD);
    io.to(`game:${game.roomCode}`).emit('timerTick', { remaining: game.timer.remaining });
  }
}

// Start Phase 1: show image, start bluff timer
function startPhase1(io, game) {
  game.phase = 1;
  game.doublePoints = false;

  // Reset per-round data
  for (const team of game.teams) {
    team.bluffs = [];
    team.selectedBluff = null;
    team.intraVotes = {};
  }
  for (const p of game.players.values()) {
    p.phase2Vote = null;
    p.phase3Vote = null;
    p.phase4Feedback = null;
  }
  game.mainVoteOptions = null;
  game.mainVotes.clear();
  game.feedbacks.clear();

  io.to(`game:${game.roomCode}`).emit('phaseChange', {
    phase: 1,
    timerSeconds: TIMERS.PHASE1_BLUFF,
  });
  io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));

  startTimer(
    game,
    TIMERS.PHASE1_BLUFF,
    (remaining) => {
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining });
      if (remaining === 10) {
        io.to(`game:${game.roomCode}`).emit('wakeUpChime');
      }
    },
    () => {
      // Auto-submit empty bluffs for teams with no submissions
      for (const team of game.teams) {
        if (team.bluffs.length === 0) {
          team.bluffs.push({ socketId: null, playerName: 'Auto', text: '' });
        }
      }
      startPhase2(io, game);
    }
  );
}

// Start Phase 2: intra-team voting
function startPhase2(io, game) {
  game.phase = 2;

  // For teams with only 1 bluff, auto-select it
  for (const team of game.teams) {
    if (team.bluffs.length <= 1) {
      team.selectedBluff = team.bluffs[0] ? team.bluffs[0].text : '';
    }
  }

  // Check if all teams already have selections (single-player teams)
  const allAutoSelected = game.teams.every((t) => t.selectedBluff !== null);

  if (allAutoSelected) {
    // Skip Phase 2 entirely
    if (shouldAutoPause(game)) {
      autoPause(io, game);
      return;
    }
    startPhase3(io, game);
    return;
  }

  io.to(`game:${game.roomCode}`).emit('phaseChange', {
    phase: 2,
    timerSeconds: TIMERS.PHASE2_INTRA_VOTE,
  });
  io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));

  startTimer(
    game,
    TIMERS.PHASE2_INTRA_VOTE,
    (remaining) => {
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining });
      if (remaining === 10) {
        io.to(`game:${game.roomCode}`).emit('wakeUpChime');
      }
    },
    () => {
      // Finalize selections: pick top-voted bluff per team
      for (const team of game.teams) {
        if (team.selectedBluff !== null) continue;
        let best = 0;
        let bestVotes = -1;
        for (const [idx, count] of Object.entries(team.intraVotes)) {
          if (count > bestVotes) {
            bestVotes = count;
            best = parseInt(idx);
          }
        }
        team.selectedBluff = team.bluffs[best] ? team.bluffs[best].text : '';
      }
      if (shouldAutoPause(game)) {
        autoPause(io, game);
        return;
      }
      startPhase3(io, game);
    }
  );
}

// Start Phase 3: main vote with real prompt mixed in
function startPhase3(io, game) {
  game.phase = 3;
  const currentRound = game.rounds[game.roundIndex];

  // Build options: real prompt + team bluffs, shuffled
  const options = [];
  options.push({ text: currentRound.realPrompt, sourceTeam: null });

  for (const team of game.teams) {
    const bluffText = team.selectedBluff || '';
    // Check for duplicate with real prompt
    if (bluffText.toLowerCase().trim() === currentRound.realPrompt.toLowerCase().trim()) {
      // Team accidentally guessed the truth! Give them a snarky notice
      io.to(`game:${game.roomCode}:team:${team.index}`).emit('duplicateBluff', {
        message: "Holy cow, you basically guessed the real prompt! We'll keep yours but... wow.",
      });
    }
    if (bluffText) {
      options.push({ text: bluffText, sourceTeam: team.index });
    }
  }

  // Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  // Add index for reference
  options.forEach((o, i) => (o.index = i));
  game.mainVoteOptions = options;

  io.to(`game:${game.roomCode}`).emit('phaseChange', {
    phase: 3,
    timerSeconds: TIMERS.PHASE3_MAIN_VOTE,
  });
  io.to(`game:${game.roomCode}`).emit('gameState', serializeForClient(game));

  startTimer(
    game,
    TIMERS.PHASE3_MAIN_VOTE,
    (remaining) => {
      io.to(`game:${game.roomCode}`).emit('timerTick', { remaining });
      if (remaining === 10) {
        io.to(`game:${game.roomCode}`).emit('wakeUpChime');
      }
    },
    () => {
      if (shouldAutoPause(game)) {
        autoPause(io, game);
        return;
      }
      // Transition to reveal
      const { startPhase4 } = require('./reveal');
      startPhase4(io, game);
    }
  );
}

function shouldAutoPause(game) {
  return game.tvSocketId === null;
}

function autoPause(io, game) {
  game.paused = true;
  clearTimer(game);
  io.to(`game:${game.roomCode}`).emit('paused', {
    paused: true,
    reason: 'Host disconnected. Waiting for TV to reconnect.',
  });
}

module.exports = {
  registerRoundHandlers,
  startPhase1,
  startPhase2,
  startPhase3,
};
