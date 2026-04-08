// Scoring rules:
// - 2 points for guessing the Real Prompt (4 if Double Points)
// - 1 point for every OTHER team that votes for your Team Bluff (2 if Double Points)

function calculateRoundScores(game) {
  const multiplier = game.doublePoints ? 2 : 1;
  const deltas = [0, 0, 0];
  const trickCounts = [0, 0, 0];

  for (const [socketId, optionIndex] of game.mainVotes) {
    const player = game.players.get(socketId);
    if (!player || player.teamIndex === null) continue;

    const option = game.mainVoteOptions[optionIndex];
    if (!option) continue;

    if (option.sourceTeam === null) {
      // Player guessed the real prompt
      deltas[player.teamIndex] += 2 * multiplier;
    } else if (option.sourceTeam !== player.teamIndex) {
      // Player was tricked by another team's bluff
      deltas[option.sourceTeam] += 1 * multiplier;
      trickCounts[option.sourceTeam]++;
    }
  }

  return { deltas, trickCounts };
}

function applyScores(game, deltas) {
  for (let i = 0; i < 3; i++) {
    game.teams[i].score += deltas[i];
  }
}

function getPlacements(game) {
  const sorted = [...game.teams]
    .map((t) => ({ index: t.index, name: t.finalName, score: t.score }))
    .sort((a, b) => b.score - a.score);

  // Assign placements — ties get the same placement
  let placement = 1;
  sorted[0].placement = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].score === sorted[i - 1].score) {
      sorted[i].placement = sorted[i - 1].placement;
    } else {
      sorted[i].placement = i + 1;
    }
  }

  return sorted;
}

module.exports = { calculateRoundScores, applyScores, getPlacements };
