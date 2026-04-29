// Scoring math per the original spec:
//   - 2 points for guessing the Real Prompt   (4 if doublePoints)
//   - 1 point for every OTHER team that votes for your Team Bluff (2 if dp)
//
// Trashed rounds award nothing. Empty-team auto-bluffs ("no bluff") cannot
// receive votes (UI hides the option), but if they somehow do, no points.

const REAL_PTS = 2;
const TRICK_PTS_PER_OTHER_TEAM = 1;

function applyRoundScores(room) {
  const round = room.rounds[room.currentRoundIdx];
  if (!round || round.trashed) return { perTeam: {}, perPlayer: {} };

  const mult = room.config.doublePoints ? 2 : 1;
  const perTeam = { 1: 0, 2: 0, 3: 0 };
  const perPlayer = new Map();

  // Build a quick playerId -> teamSlot lookup.
  const playerTeam = new Map();
  for (const [pid, p] of room.players) playerTeam.set(pid, p.teamSlot);

  // 1) Real-vote points to each player who voted "real".
  for (const [pid, vote] of round.mainVotes) {
    if (vote === 'real') {
      const pts = REAL_PTS * mult;
      perPlayer.set(pid, (perPlayer.get(pid) ?? 0) + pts);
      const slot = playerTeam.get(pid);
      if (slot) perTeam[slot] = (perTeam[slot] ?? 0) + pts;
    }
  }

  // 2) Trick points: for each team's bluff, count votes from other teams.
  for (const slot of [1, 2, 3]) {
    const bluffText = round.teamBluffs?.[slot];
    if (!bluffText || round.autoEmpty?.[slot]) continue; // skip "no bluff" auto-empty
    let votesFromOthers = 0;
    for (const [pid, vote] of round.mainVotes) {
      if (vote !== `team:${slot}`) continue;
      const voterSlot = playerTeam.get(pid);
      if (!voterSlot || voterSlot === slot) continue; // own team can't vote for self anyway
      votesFromOthers++;
    }
    if (votesFromOthers > 0) {
      const pts = votesFromOthers * TRICK_PTS_PER_OTHER_TEAM * mult;
      perTeam[slot] = (perTeam[slot] ?? 0) + pts;
      // Distribute trick credit equally among teammates who submitted bluffs.
      const teamPlayers = Array.from(room.players.entries())
        .filter(([_, p]) => p.teamSlot === slot && p.isConnected);
      if (teamPlayers.length > 0) {
        const each = pts / teamPlayers.length;
        for (const [pid] of teamPlayers) {
          perPlayer.set(pid, (perPlayer.get(pid) ?? 0) + each);
        }
      }
    }
  }

  // Apply to team scores.
  for (const team of room.teams) {
    team.score += perTeam[team.slot] ?? 0;
  }

  // Round-scoped totals for reveal display.
  round.scoreDelta = { perTeam, perPlayer: Object.fromEntries(perPlayer) };

  return round.scoreDelta;
}

module.exports = { applyRoundScores };
