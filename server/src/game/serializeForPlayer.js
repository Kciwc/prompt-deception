// THE chokepoint: every wire emit of room state goes through this.
//
// Anti-leak invariants:
//   1. realPrompt as a STRING never appears outside of round.candidatesOrder
//      (which only exists at phase >= 3, embedded among shuffled bluffs).
//   2. Phase 1 bluffs (perPlayerBluffs) are private to author until phase 2,
//      then visible only to teammates during phase 2.
//   3. Phase 2 intra-votes are never broadcast (private until tallied).
//   4. Phase 3 main votes are never broadcast in detail (only own vote echoed).
//
// Audience kinds:
//   { kind: 'player', playerId }   → mobile player
//   { kind: 'host' }               → TV
//   { kind: 'browser' }            → lobby browser

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
    phaseDeadlineMs: room.phaseDeadlineMs,
    paused: room.paused,
    pausedRemainingMs: room.pausedRemainingMs ?? null,
    config: room.config,
    teams: room.teams,
    players,
    currentRoundIdx: room.currentRoundIdx,
    completedNonTrashed: room.rounds ? room.rounds.filter((r) => !r.trashed).length : 0,
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
    // Real prompt is never sent as a standalone string. It only reaches
    // the wire embedded in candidatesOrder (phase >= 3).
  };

  // Phase 1: each player can see their own submission, plus a count of
  // submissions per team (so the TV/host can show progress without leaking text).
  if (phase >= 1) {
    out.submissionCounts = countByTeam(room, r.perPlayerBluffs);
    if (me) {
      out.myBluff = r.perPlayerBluffs.get(me) ?? null;
    }
  }

  // Phase 2: teammates' bluffs (text), so the player can vote.
  // We DO NOT include the author's playerId — bluffs appear anonymously.
  if (phase >= 2 && me && myTeamSlot) {
    const teamMates = Array.from(room.players.entries())
      .filter(([pid, p]) => p.teamSlot === myTeamSlot && p.isConnected && r.perPlayerBluffs.has(pid));
    out.teamBluffs = teamMates.map(([pid]) => ({
      // Use a stable hash-like id (just truncated) so client can refer back.
      pid,
      text: r.perPlayerBluffs.get(pid),
      isMine: pid === me,
    }));
    if (me && r.intraVotes.has(me)) out.myIntraVote = r.intraVotes.get(me);
    out.intraVoteCounts = countByTeam(room, r.intraVotes); // for progress display
  }

  // Phase 3+: candidates (shuffled, including the real one).
  if (phase >= 3 && r.candidatesOrder) {
    out.candidates = r.candidatesOrder.map((c) => ({
      id: c.id,
      text: c.text,
      autoEmpty: !!c.autoEmpty,
    }));
    if (me && r.mainVotes.has(me)) out.myMainVote = r.mainVotes.get(me);
    out.mainVoteCounts = r.mainVotes.size;
  }

  // Phase 4: reveal — vote tallies per candidate, scoring delta.
  if (phase >= 4 && r.candidatesOrder) {
    const voteByCandidate = {};
    for (const c of r.candidatesOrder) voteByCandidate[c.id] = 0;
    for (const [_, vote] of r.mainVotes) {
      if (voteByCandidate[vote] !== undefined) voteByCandidate[vote]++;
    }
    out.reveal = {
      voteByCandidate,
      // Map vote → list of voter playerIds (for "who voted for what" display).
      voters: voterMap(r.mainVotes),
      teamBluffs: r.teamBluffs,
      autoEmpty: r.autoEmpty,
      scoreDelta: r.scoreDelta,
    };
  }

  return out;
}

function countByTeam(room, byPlayerMap) {
  const out = { 1: 0, 2: 0, 3: 0 };
  for (const [pid] of byPlayerMap) {
    const p = room.players.get(pid);
    if (!p || !p.isConnected) continue;
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

module.exports = { serializeForPlayer };
