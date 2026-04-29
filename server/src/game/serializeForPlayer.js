// THE chokepoint: every wire emit of room state goes through this.
//
// Anti-leak invariants (post-merge phase model):
//   1. realPrompt as a STRING never appears outside of round.candidatesOrder
//      (which only exists at phase >= 2, embedded among shuffled bluffs).
//   2. Phase 1 perPlayerBluffs are visible only to teammates (with author
//      name + isMine flag — anonymity dropped per design choice).
//   3. Phase 1 intra-vote tally per pid is visible only to teammates.
//   4. Phase 3+ candidates carry the real prompt embedded among bluffs.
//
// Phase numbering:
//   0 lobby, 1 write+vote, 2 main-vote, 3 reveal, 4 podium

function serializeForPlayer(room, audience) {
  if (audience.kind === 'browser') {
    return room.publicSummary();
  }

  const players = [];
  for (const [id, p] of room.players) {
    players.push({
      id,
      name: p.name,
      teamSlot: p.teamSlot,
      ready: p.ready,
      isConnected: p.isConnected,
      isMe: audience.kind === 'player' && audience.playerId === id,
    });
  }

  const base = {
    code: room.code,
    isPublic: room.isPublic,
    status: room.status,
    phase: room.phase,
    phaseStartMs: room.phaseStartMs ?? null,
    phaseDurationMs: room.phaseDurationMs ?? null,
    phaseDeadlineMs: room.phaseDeadlineMs,
    paused: room.paused,
    pausedReason: room.pausedReason ?? null,
    pausedRemainingMs: room.pausedRemainingMs ?? null,
    hostConnected: !!room.hostSocketId,
    serverTime: Date.now(),
    config: room.config,
    teams: room.teams,
    players,
    currentRoundIdx: room.currentRoundIdx,
    completedNonTrashed: room.rounds ? room.rounds.filter((r) => !r.trashed).length : 0,
    trashTalkLeaderboard: serializeTrashTalkLeaderboard(room),
    viewer: { kind: audience.kind, playerId: audience.kind === 'player' ? audience.playerId : null },
  };

  if (room.currentRoundIdx >= 0 && room.rounds[room.currentRoundIdx]) {
    base.currentRound = serializeRound(room, audience);
  }

  return base;
}

function serializeRound(room, audience) {
  const r = room.rounds[room.currentRoundIdx];
  const phase = room.phase;
  const me = audience.kind === 'player' ? audience.playerId : null;
  const myTeamSlot = me ? room.players.get(me)?.teamSlot : null;

  const out = {
    index: room.currentRoundIdx,
    imageKey: r.imageKey ?? null,
    imageUrl: r.imageUrl ?? null,
    trashed: !!r.trashed,
  };

  // Phase 1 (write+vote, merged): teammates see each other's bluffs (with
  // names, no anonymity per design) plus the per-pid intra-vote tally for
  // their team. Other audiences just see submission counts per team.
  if (phase >= 1) {
    out.submissionCounts = countByTeam(room, r.perPlayerBluffs, /* nonEmptyOnly */ true);
    if (me) {
      out.myBluff = r.perPlayerBluffs.get(me) ?? null;
      out.myIntraVote = r.intraVotes.get(me) ?? null;

      if (myTeamSlot) {
        const teamMates = Array.from(room.players.entries())
          .filter(([_, p]) => p.teamSlot === myTeamSlot && p.isConnected);

        // Bluffs (any length, including drafts) so teammates see live edits.
        out.teamBluffs = teamMates
          .map(([pid, p]) => ({
            pid,
            authorName: p.name,
            text: r.perPlayerBluffs.get(pid) ?? '',
            isMine: pid === me,
            typingAt: r.bluffTypingAt?.get(pid) ?? null,
          }))
          .filter((b) => b.text.length > 0 || b.isMine || b.typingAt); // always show my own slot

        // Per-pid vote tally for the team.
        const tally = {};
        for (const [voterId, targetPid] of r.intraVotes) {
          const voter = room.players.get(voterId);
          if (!voter || voter.teamSlot !== myTeamSlot) continue;
          tally[targetPid] = (tally[targetPid] ?? 0) + 1;
        }
        out.intraVoteTally = tally;
      }
    }
  }

  // Phase 2+: candidates list (shuffled, including real). This is the
  // single point where realPrompt's text reaches the wire — anti-leak holds
  // because candidatesOrder is only built at phase 1→2 finalization.
  if (phase >= 2 && r.candidatesOrder) {
    out.candidates = r.candidatesOrder.map((c) => ({
      id: c.id,
      text: c.text,
      autoEmpty: !!c.autoEmpty,
    }));
    if (me && r.mainVotes.has(me)) out.myMainVote = r.mainVotes.get(me);
    out.mainVoteCounts = r.mainVotes.size;
  }

  // Phase 3+: reveal payload (vote tallies, score delta, trash talk).
  if (phase >= 3 && r.candidatesOrder) {
    const voteByCandidate = {};
    for (const c of r.candidatesOrder) voteByCandidate[c.id] = 0;
    for (const [_, vote] of r.mainVotes) {
      if (voteByCandidate[vote] !== undefined) voteByCandidate[vote]++;
    }
    out.reveal = {
      voteByCandidate,
      voters: voterMap(r.mainVotes),
      teamBluffs: r.teamBluffs,
      autoEmpty: r.autoEmpty,
      scoreDelta: r.scoreDelta,
    };
  }

  // Trash talk — round vote counts visible during phase 3 (running tally).
  // After phase 3 ends, also include winner.
  if (phase >= 3 && room.config.trashTalkEnabled) {
    const counts = {};
    for (const [_voter, target] of r.trashTalkVotes) {
      counts[target] = (counts[target] ?? 0) + 1;
    }
    out.trashTalk = {
      voteCounts: counts,
      myVote: me ? (r.trashTalkVotes.get(me) ?? null) : null,
      roundCounts: r.trashTalkRoundCounts ?? null,
      roundWinner: r.trashTalkRoundWinner ?? null,
    };
  }

  return out;
}

function countByTeam(room, byPlayerMap, nonEmptyOnly = false) {
  const out = { 1: 0, 2: 0, 3: 0 };
  for (const [pid, val] of byPlayerMap) {
    const p = room.players.get(pid);
    if (!p || !p.isConnected) continue;
    if (nonEmptyOnly && (typeof val !== 'string' || val.trim().length === 0)) continue;
    out[p.teamSlot] = (out[p.teamSlot] ?? 0) + 1;
  }
  return out;
}

function voterMap(mainVotes) {
  const out = {};
  for (const [pid, vote] of mainVotes) {
    if (!out[vote]) out[vote] = [];
    out[vote].push(pid);
  }
  return out;
}

// Cumulative leaderboard sorted descending. Ties keep insertion order.
function serializeTrashTalkLeaderboard(room) {
  if (!room.trashTalkLeaderboard || room.trashTalkLeaderboard.size === 0) return [];
  return Array.from(room.trashTalkLeaderboard.entries())
    .map(([playerId, votes]) => ({
      playerId,
      name: room.players.get(playerId)?.name ?? '(left)',
      teamSlot: room.players.get(playerId)?.teamSlot ?? null,
      votes,
    }))
    .sort((a, b) => b.votes - a.votes);
}

module.exports = { serializeForPlayer };
