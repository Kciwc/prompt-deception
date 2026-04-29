// THE chokepoint: every wire emit of room state goes through this.
// Step 2: lobby state only — no secrets to redact yet, but the structure is here.
// Step 3+: redact rounds[].realPrompt until phase >= 3 for that round.
//
// Audience kinds:
//   { kind: 'player', playerId }   → mobile player
//   { kind: 'host' }               → TV / host remote
//   { kind: 'browser' }            → lobby-browser viewer (sees only public summary)

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

  // Round payload — only sent if a round is active. Real prompt redacted until phase 3.
  if (room.currentRoundIdx >= 0 && room.rounds[room.currentRoundIdx]) {
    const r = room.rounds[room.currentRoundIdx];
    base.currentRound = {
      index: room.currentRoundIdx,
      imageKey: r.imageKey ?? null,
      // Anti-leak: real prompt MUST NOT appear before phase 3.
      realPrompt: room.phase >= 3 ? r.realPrompt : null,
      trashed: !!r.trashed,
    };
  }

  return base;
}

module.exports = { serializeForPlayer };
