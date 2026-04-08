// Jackbox-style cheeky superlatives awarded at end of game

function generateSuperlatives(game) {
  const superlatives = [];
  const playerStats = new Map();

  // Build per-player stats
  for (const [socketId, player] of game.players) {
    playerStats.set(socketId, {
      name: player.name,
      teamIndex: player.teamIndex,
      correctGuesses: 0,
      gotTricked: 0,
      bluffsSubmitted: 0,
    });
  }

  // We'd ideally track these across rounds; for now, use team-level data
  const teamTricks = game.teams.map(() => 0);
  const teamCorrect = game.teams.map(() => 0);

  // "Master of Deception" — team that tricked the most opponents
  let maxTricks = 0;
  let trickTeam = 0;
  game.teams.forEach((t, i) => {
    // Score is a proxy — higher score with lower correct guesses means more tricks
    if (t.score > maxTricks) {
      maxTricks = t.score;
      trickTeam = i;
    }
  });

  superlatives.push({
    title: 'Master of Deception',
    subtitle: 'Fooled everyone and felt no remorse',
    recipient: game.teams[trickTeam].finalName,
    isTeam: true,
  });

  // "Most Gullible" — team with lowest score
  const lowestScore = Math.min(...game.teams.map((t) => t.score));
  const gullibleTeam = game.teams.find((t) => t.score === lowestScore);
  if (gullibleTeam && gullibleTeam.score !== maxTricks) {
    superlatives.push({
      title: 'Most Gullible',
      subtitle: "Believed everything. Even the obvious ones.",
      recipient: gullibleTeam.finalName,
      isTeam: true,
    });
  }

  // "Speedrunner" — random fun award
  const allPlayers = Array.from(game.players.values()).filter(
    (p) => p.teamIndex !== null
  );
  if (allPlayers.length > 0) {
    const random = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    superlatives.push({
      title: 'Speedrunner',
      subtitle: 'Always voted first, never thought twice',
      recipient: random.name,
      isTeam: false,
    });
  }

  // "Creative Writing Major"
  if (allPlayers.length > 1) {
    const another = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    superlatives.push({
      title: 'Creative Writing Major',
      subtitle: 'Their bluffs sounded suspiciously professional',
      recipient: another.name,
      isTeam: false,
    });
  }

  // "Chaotic Neutral"
  if (allPlayers.length > 2) {
    const chaos = allPlayers[Math.floor(Math.random() * allPlayers.length)];
    superlatives.push({
      title: 'Chaotic Neutral',
      subtitle: 'Nobody knows what side they were on',
      recipient: chaos.name,
      isTeam: false,
    });
  }

  return superlatives;
}

module.exports = { generateSuperlatives };
