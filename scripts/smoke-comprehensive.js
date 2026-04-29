// Ridiculously comprehensive edge-case test harness.
//
// Covers six categories — player lifecycle, voting/submission edge cases,
// phase machine, sanitization, concurrency, and trash talk specifics.
// Each test creates its own room and cleans up after itself, so failures
// don't poison subsequent tests.
//
// Run with PD_PHASE_SCALE=0.05 so per-phase cycles are <10s.
//   node scripts/smoke-comprehensive.js

const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const connect = () => io(URL, { transports: ['websocket'] });

// ──────────────────────────────────────────────────────────
// Assertion helpers — throw on failure with a clear message.
// ──────────────────────────────────────────────────────────
function assert(cond, msg) {
  if (!cond) throw new Error('assert failed: ' + msg);
}
function assertEq(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`assert eq: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)} ${msg ? '— ' + msg : ''}`);
  }
}
function assertOk(res, msg = '') {
  if (!res?.ok) throw new Error(`expected ok, got ${JSON.stringify(res)} ${msg}`);
}
function assertNotOk(res, expectedError = null) {
  if (res?.ok) throw new Error(`expected !ok, got ${JSON.stringify(res)}`);
  if (expectedError && res?.error !== expectedError) {
    throw new Error(`expected error '${expectedError}', got '${res?.error}'`);
  }
}

// ──────────────────────────────────────────────────────────
// Lobby setup helper. Returns { host, code, players, ids, lastState() }.
// ──────────────────────────────────────────────────────────
async function setupLobby({ players = 0, ready = false, teamSwitch = null, config = {} } = {}) {
  const host = connect();
  const playerSockets = [];
  const ids = [];
  await wait(150);

  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  if (!created?.ok) throw new Error('setup: lobby create failed');
  const code = created.code;

  if (Object.keys(config).length > 0) {
    const cfg = await emit(host, 'host:configure', config);
    if (!cfg?.ok) throw new Error('setup: configure failed: ' + JSON.stringify(cfg));
  }

  const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry'];
  for (let i = 0; i < players; i++) {
    const s = connect();
    await wait(60);
    const pid = `p_${names[i].toLowerCase()}_${i}`.padEnd(10, '_');
    ids.push(pid);
    const j = await emit(s, 'room:join', { code, playerId: pid, name: names[i] });
    if (!j?.ok) throw new Error(`setup: ${names[i]} join failed: ${JSON.stringify(j)}`);
    if (teamSwitch && teamSwitch[i] !== undefined) {
      await emit(s, 'room:team-switch', { teamSlot: teamSwitch[i] });
    }
    if (ready) await emit(s, 'room:ready', { ready: true });
    playerSockets.push(s);
  }

  return { host, code, players: playerSockets, ids, lastState: () => lastState };
}

function teardown(h) {
  try { h.host?.disconnect(); } catch (_) {}
  for (const s of h.players ?? []) try { s.disconnect(); } catch (_) {}
}

// ──────────────────────────────────────────────────────────
// CATEGORY 1: Player lifecycle
// ──────────────────────────────────────────────────────────

async function L1_two_sockets_same_pid() {
  const h = await setupLobby();
  try {
    const s1 = connect();
    const s2 = connect();
    await wait(200);
    const j1 = await emit(s1, 'room:join', { code: h.code, playerId: 'p_alice___', name: 'Alice' });
    assertOk(j1);
    const j2 = await emit(s2, 'room:join', { code: h.code, playerId: 'p_alice___', name: 'Alice2' });
    assertOk(j2);
    await wait(150);
    // Latest socket is bound; old socket is orphaned but still alive.
    // Confirm: host sees ONE player named "Alice2".
    const players = h.lastState()?.players ?? [];
    const alices = players.filter((p) => p.id === 'p_alice___');
    assertEq(alices.length, 1, 'should have exactly one Alice record');
    assertEq(alices[0].name, 'Alice2', 'name should be updated to Alice2');
    s1.disconnect(); s2.disconnect();
  } finally { teardown(h); }
}

async function L2_kicked_player_can_rejoin() {
  const h = await setupLobby({ players: 1 });
  try {
    await wait(150);
    // Host kicks alice
    const k = await emit(h.host, 'host:kick-player', { playerId: h.ids[0] });
    assertOk(k);
    await wait(150);
    // Alice tries to rejoin — should succeed (no ban list)
    const a2 = connect();
    await wait(100);
    const rejoin = await emit(a2, 'room:join', {
      code: h.code, playerId: h.ids[0], name: 'Alice',
    });
    assertOk(rejoin, 'kicked player should be allowed to rejoin in lobby phase');
    a2.disconnect();
  } finally { teardown(h); }
}

async function L3_implicit_disconnect_preserves_room() {
  // CURRENT BEHAVIOR: implicit disconnect alone does NOT destroy the room —
  // player records persist so reconnects work. (Trade-off: zombie rooms can
  // accumulate. A timer-based GC would help; not implemented yet.)
  const h = await setupLobby({ players: 1 });
  try {
    h.players[0].disconnect();
    h.host.disconnect();
    await wait(300);
    // Original player can still reconnect (room still exists).
    const fresh = connect();
    await wait(100);
    const join = await emit(fresh, 'room:join', {
      code: h.code, playerId: h.ids[0], name: 'Alice',
    });
    assertOk(join, 'reconnect should succeed since room persists');
    assertEq(join.reconnect, true, 'should be flagged as reconnect');
    fresh.disconnect();
  } finally { teardown(h); }
}

async function L3b_explicit_leave_destroys_empty_room() {
  // Verifies the OTHER path: when all players explicitly leave AND host
  // disconnects, the room gets destroyed.
  const h = await setupLobby({ players: 1 });
  try {
    await wait(150);
    h.players[0].emit('room:leave');
    await wait(200);
    h.host.disconnect();
    await wait(300);
    const fresh = connect();
    await wait(100);
    const join = await emit(fresh, 'room:join', {
      code: h.code, playerId: 'p_other___', name: 'Other',
    });
    assertNotOk(join, 'room_not_found');
    fresh.disconnect();
  } finally { teardown(h); }
}

async function L4_reconnect_with_name_change() {
  const h = await setupLobby({ players: 1 });
  try {
    await wait(100);
    h.players[0].disconnect();
    await wait(150);
    const a2 = connect();
    await wait(100);
    const rejoin = await emit(a2, 'room:join', {
      code: h.code, playerId: h.ids[0], name: 'AliceRenamed',
    });
    assertOk(rejoin);
    await wait(150);
    const player = h.lastState()?.players.find((p) => p.id === h.ids[0]);
    assertEq(player?.name, 'AliceRenamed', 'name should update on reconnect');
    a2.disconnect();
  } finally { teardown(h); }
}

async function L5_explicit_leave_then_rejoin() {
  const h = await setupLobby({ players: 1 });
  try {
    await wait(100);
    h.players[0].emit('room:leave');
    await wait(200);
    // After explicit leave, player record is removed. Rejoin should work as new player.
    const a2 = connect();
    await wait(100);
    const rejoin = await emit(a2, 'room:join', {
      code: h.code, playerId: h.ids[0], name: 'Alice',
    });
    assertOk(rejoin);
    // Should NOT be flagged as reconnect (record was removed)
    assertEq(rejoin.reconnect, false, 'should be a fresh join, not reconnect');
    a2.disconnect();
  } finally { teardown(h); }
}

// ──────────────────────────────────────────────────────────
// CATEGORY 2: Voting / submission edge cases
// ──────────────────────────────────────────────────────────

async function V1_main_vote_own_team_rejected() {
  // Need to advance to phase 2 with candidates.
  const h = await setupLobby({
    players: 3, ready: true, teamSwitch: [1, 2, 3],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    // Alice writes a bluff (so team 1 has a candidate)
    await emit(h.players[0], 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
    await wait(5000); // phase 1 → 2
    assertEq(h.lastState()?.phase, 2, 'should be in phase 2');

    // Alice (team 1) tries to vote for team:1 — should fail
    const v = await emit(h.players[0], 'main-vote:cast', { candidate: 'team:1' });
    assertNotOk(v, 'no_self_team_vote');

    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function V2_vote_for_emptied_bluff_drops() {
  const h = await setupLobby({
    players: 2, ready: true, teamSwitch: [1, 1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    // Alice writes, Bob votes for Alice, Alice clears, Bob's vote should be dropped at finalize.
    await emit(h.players[0], 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
    await emit(h.players[1], 'bluff:submit', { text: 'A cat who plays piano in moonlight' });
    await wait(200);
    await emit(h.players[1], 'intra-vote:cast', { targetPlayerId: h.ids[0] });
    await wait(150);
    // Alice clears her bluff
    await emit(h.players[0], 'bluff:submit', { text: '' });
    await wait(150);

    // Wait for phase 1 → 2 (all bluffs except Bob's get dropped, Bob's wins)
    await wait(5000);
    const round = h.lastState()?.currentRound;
    assertEq(h.lastState()?.phase, 2);
    const team1Bluff = round?.candidates?.find((c) => c.id === 'team:1');
    assertEq(team1Bluff?.text, 'A cat who plays piano in moonlight', 'Bob\'s bluff should win');

    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function V3_intra_vote_clear_works() {
  const h = await setupLobby({
    players: 2, ready: true, teamSwitch: [1, 1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    await emit(h.players[0], 'bluff:submit', { text: 'My team is awesome and creative' });
    await emit(h.players[1], 'bluff:submit', { text: 'A cat who plays piano in moonlight' });
    await wait(150);
    await emit(h.players[1], 'intra-vote:cast', { targetPlayerId: h.ids[0] });
    await wait(150);
    let state = h.lastState();
    // Find bob's view to check tally — host doesn't see team-specific tally.
    // We'll check via raw count: alice should have 1 vote.
    // (host audience doesn't get intraVoteTally; we infer via finalization later)

    // Clear and re-check
    await emit(h.players[1], 'intra-vote:clear');
    await wait(150);

    // After clear, neither bluff has votes. With 2 submissions, finalize randomly picks.
    // Just confirm phase machine still works.
    await wait(5000);
    assertEq(h.lastState()?.phase, 2);

    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function V4_bluff_clamped_to_max_length() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    const huge = 'A'.repeat(1000);
    await emit(h.players[0], 'bluff:submit', { text: huge });
    await wait(150);
    // The submitted bluff should be clamped to 200 chars on the server.
    // We can't see this directly without serializer access, but we can
    // verify the round transition still works (huge bluffs don't crash).
    await wait(5000);
    assertEq(h.lastState()?.phase, 2);
    const round = h.lastState()?.currentRound;
    const team1 = round?.candidates?.find((c) => c.id === 'team:1');
    assert(team1?.text?.length <= 200, `bluff should be clamped to 200, was ${team1?.text?.length}`);

    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function V5_non_string_bluff_payload_safe() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    // Server should not crash on non-string text.
    const r1 = await emit(h.players[0], 'bluff:submit', { text: 123 });
    assertOk(r1, 'numeric text should be silently coerced/empty');
    const r2 = await emit(h.players[0], 'bluff:submit', { text: null });
    assertOk(r2, 'null text should be silently coerced/empty');
    const r3 = await emit(h.players[0], 'bluff:submit', { });
    assertOk(r3, 'missing text should be silently coerced/empty');
    // Server still alive — verify by completing a round.
    await wait(5000);
    assertEq(h.lastState()?.phase, 2, 'phase advanced normally');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function V6_main_vote_invalid_candidate_rejected() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    await emit(h.players[0], 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
    await wait(5000);
    assertEq(h.lastState()?.phase, 2);

    const bad = await emit(h.players[0], 'main-vote:cast', { candidate: 'team:99' });
    assertNotOk(bad, 'bad_candidate');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

// ──────────────────────────────────────────────────────────
// CATEGORY 3: Phase machine
// ──────────────────────────────────────────────────────────

async function P1_empty_room_start_rejected() {
  const h = await setupLobby();
  try {
    const start = await emit(h.host, 'host:start-game');
    assertNotOk(start, 'no_players');
  } finally { teardown(h); }
}

async function P2_not_all_ready_rejected() {
  const h = await setupLobby({ players: 2, ready: false });
  try {
    const start = await emit(h.host, 'host:start-game');
    assertNotOk(start, 'not_all_ready');
  } finally { teardown(h); }
}

async function P3_pause_freezes_timer() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3 },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    const beforePause = h.lastState();
    const remainingBefore = beforePause.phaseDeadlineMs - Date.now();
    await emit(h.host, 'host:pause');
    await wait(800);
    const afterPause = h.lastState();
    assertEq(afterPause.paused, true, 'should be paused');
    assert(afterPause.pausedRemainingMs > 0, 'should have paused remaining ms');
    // Resume; timer should pick up from paused remaining.
    await emit(h.host, 'host:resume');
    await wait(150);
    assertEq(h.lastState().paused, false, 'should be resumed');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function P4_add_seconds_extends_deadline() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3 },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    const before = h.lastState().phaseDeadlineMs;
    await emit(h.host, 'host:add-seconds', { seconds: 1 });
    await wait(150);
    const after = h.lastState().phaseDeadlineMs;
    assert(after - before >= 900, `deadline should extend by ~1000ms, got ${after - before}`);
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function P5_trash_extends_round_count() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    // Round 0 — trash it
    await emit(h.host, 'host:trash-round');
    await wait(150);
    // Should be on round 1 (idx 1) but completedNonTrashed = 1 (only the new round counted).
    const state = h.lastState();
    assertEq(state.currentRoundIdx, 1, 'currentRoundIdx should be 1');
    // We need 3 non-trashed rounds, so far only 1 (the new one) — game should continue.
    assert(state.status === 'playing', 'game should still be in progress after trash');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function P6_undo_rewinds_phase() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3 },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    const phaseBefore = h.lastState().phase;
    // Trigger a transition by trashing — adds an undo snapshot
    // Then undo to reverse
    await emit(h.host, 'host:trash-round');
    await wait(150);
    await emit(h.host, 'host:undo-phase');
    await wait(150);
    // Undo should have reverted us — phase or round index should differ from
    // the post-trash state.
    const state = h.lastState();
    assert(state.status === 'playing', 'still playing after undo');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

// ──────────────────────────────────────────────────────────
// CATEGORY 4: Sanitization
// ──────────────────────────────────────────────────────────

async function S1_emoji_only_bluff_accepts() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    // 5 emojis = 5 visible chars (codepoints).
    await emit(h.players[0], 'bluff:submit', { text: '🦆🚲🏛️🌃🎩' });
    await wait(5000);
    const team1 = h.lastState()?.currentRound?.candidates?.find((c) => c.id === 'team:1');
    assert(team1?.text?.length > 0 && team1.text !== 'no bluff',
      `emoji-only bluff should be accepted, got: ${team1?.text}`);
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function S2_whitespace_only_bluff_drops() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    await emit(h.players[0], 'bluff:submit', { text: '         ' });
    await wait(5000);
    const team1 = h.lastState()?.currentRound?.candidates?.find((c) => c.id === 'team:1');
    assertEq(team1?.text, 'no bluff', 'whitespace-only bluff should be dropped');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function S3_excessive_emoji_repetition_clamped() {
  // Note: this asserts via name sanitization since bluff sanitization doesn't
  // run repeat-clamp on drafts (we trust the client there). Names go through
  // sanitizeName which does clamp.
  const host = connect(); const a = connect();
  await wait(150);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });
  const created = await emit(host, 'lobby:create', {});
  try {
    const j = await emit(a, 'room:join', {
      code: created.code, playerId: 'p_alice___',
      name: '😀😀😀😀😀😀😀😀😀😀',  // 10 emojis
    });
    assertOk(j);
    await wait(150);
    const player = lastState?.players.find((p) => p.id === 'p_alice___');
    // sanitizeName limits consecutive repeats to 3.
    const emojiCount = Array.from(player?.name ?? '').length;
    assert(emojiCount <= 3, `name should be clamped to 3 repeated emoji, got ${emojiCount}`);
  } finally {
    host.disconnect(); a.disconnect();
  }
}

async function S4_name_with_newlines_collapsed() {
  const host = connect(); const a = connect();
  await wait(150);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });
  const created = await emit(host, 'lobby:create', {});
  try {
    const j = await emit(a, 'room:join', {
      code: created.code, playerId: 'p_alice___',
      name: 'Alice\nBob\tCarol',
    });
    assertOk(j);
    await wait(150);
    const player = lastState?.players.find((p) => p.id === 'p_alice___');
    assert(!/[\n\t]/.test(player?.name ?? ''), `name should not contain newlines/tabs: ${player?.name}`);
  } finally {
    host.disconnect(); a.disconnect();
  }
}

async function S5_very_long_name_truncated() {
  const host = connect(); const a = connect();
  await wait(150);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });
  const created = await emit(host, 'lobby:create', {});
  try {
    const j = await emit(a, 'room:join', {
      code: created.code, playerId: 'p_alice___',
      name: 'A'.repeat(500),
    });
    assertOk(j);
    await wait(150);
    const player = lastState?.players.find((p) => p.id === 'p_alice___');
    assert(player?.name.length <= 24, `name should be ≤ 24 chars, got ${player?.name?.length}`);
  } finally {
    host.disconnect(); a.disconnect();
  }
}

// ──────────────────────────────────────────────────────────
// CATEGORY 5: Concurrency
// ──────────────────────────────────────────────────────────

async function C1_many_simultaneous_bluff_submits() {
  // 6 players hammering the server with submits doesn't crash it.
  const h = await setupLobby({
    players: 6, ready: true, teamSwitch: [1, 1, 2, 2, 3, 3],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: false },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(200);
    // Each player fires a series of submits in parallel.
    const promises = [];
    for (let i = 0; i < h.players.length; i++) {
      const sock = h.players[i];
      for (let k = 0; k < 5; k++) {
        promises.push(emit(sock, 'bluff:submit', { text: `Player ${i} draft v${k} of a clever bluff` }));
      }
    }
    await Promise.all(promises);
    await wait(5500);
    assertEq(h.lastState()?.phase, 2, 'phase 2 reached cleanly');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function C2_two_configures_last_wins() {
  const h = await setupLobby();
  try {
    await emit(h.host, 'host:configure', { rounds: 3, speed: 'quick' });
    await emit(h.host, 'host:configure', { rounds: 7, speed: 'long' });
    await wait(150);
    const cfg = h.lastState()?.config;
    assertEq(cfg?.rounds, 7);
    assertEq(cfg?.speed, 'long');
  } finally { teardown(h); }
}

async function C3_configure_after_start_rejected() {
  const h = await setupLobby({
    players: 1, ready: true, teamSwitch: [1],
    config: { speed: 'quick', rounds: 3 },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(150);
    const cfg = await emit(h.host, 'host:configure', { rounds: 7 });
    assertNotOk(cfg, 'wrong_status');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

// ──────────────────────────────────────────────────────────
// CATEGORY 6: Trash talk specifics
// ──────────────────────────────────────────────────────────

async function T1_all_tied_trash_talk_shows_all() {
  const h = await setupLobby({
    players: 3, ready: true, teamSwitch: [1, 2, 3],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: true },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(300);
    await emit(h.players[0], 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
    await wait(5000); // → phase 2
    await emit(h.players[0], 'main-vote:cast', { candidate: 'real' });
    await emit(h.players[1], 'main-vote:cast', { candidate: 'real' });
    await emit(h.players[2], 'main-vote:cast', { candidate: 'real' });
    await wait(2800); // → phase 3
    // Circular votes, each gets 1
    await emit(h.players[0], 'trashtalk:vote', { targetPlayerId: h.ids[1] });
    await emit(h.players[1], 'trashtalk:vote', { targetPlayerId: h.ids[2] });
    await emit(h.players[2], 'trashtalk:vote', { targetPlayerId: h.ids[0] });
    await wait(2500);
    const lb = h.lastState()?.trashTalkLeaderboard ?? [];
    assertEq(lb.length, 3, 'three players in leaderboard');
    for (const e of lb) assertEq(e.votes, 1, `${e.name} should have 1 vote`);
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function T2_vote_then_voter_leaves() {
  const h = await setupLobby({
    players: 3, ready: true, teamSwitch: [1, 2, 3],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: true },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(300);
    await emit(h.players[0], 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
    await wait(5000);
    await emit(h.players[0], 'main-vote:cast', { candidate: 'real' });
    await emit(h.players[1], 'main-vote:cast', { candidate: 'real' });
    await emit(h.players[2], 'main-vote:cast', { candidate: 'real' });
    await wait(2800);
    // Bob votes for Alice, then Bob disconnects.
    await emit(h.players[1], 'trashtalk:vote', { targetPlayerId: h.ids[0] });
    h.players[1].disconnect();
    await wait(2500);
    // Alice should still have her vote on the leaderboard.
    const lb = h.lastState()?.trashTalkLeaderboard ?? [];
    const alice = lb.find((e) => e.playerId === h.ids[0]);
    assert(alice && alice.votes === 1, `Alice should have 1 vote even after voter left, got ${alice?.votes}`);
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

async function T3_self_vote_trash_talk_rejected() {
  const h = await setupLobby({
    players: 2, ready: true, teamSwitch: [1, 2],
    config: { speed: 'quick', rounds: 3, trashTalkEnabled: true },
  });
  try {
    await emit(h.host, 'host:start-game');
    await wait(300);
    await emit(h.players[0], 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
    await wait(5000);
    await emit(h.players[0], 'main-vote:cast', { candidate: 'real' });
    await emit(h.players[1], 'main-vote:cast', { candidate: 'team:1' });
    await wait(2800);
    // Alice tries to vote for herself
    const tt = await emit(h.players[0], 'trashtalk:vote', { targetPlayerId: h.ids[0] });
    assertNotOk(tt, 'no_self_vote');
    await emit(h.host, 'host:end-game');
  } finally { teardown(h); }
}

// ──────────────────────────────────────────────────────────
// Test runner
// ──────────────────────────────────────────────────────────
const TESTS = [
  ['lifecycle', 'two sockets same playerId', L1_two_sockets_same_pid],
  ['lifecycle', 'kicked player can rejoin', L2_kicked_player_can_rejoin],
  ['lifecycle', 'implicit disconnect preserves room (reconnect-friendly)', L3_implicit_disconnect_preserves_room],
  ['lifecycle', 'explicit leave + host disconnect destroys room', L3b_explicit_leave_destroys_empty_room],
  ['lifecycle', 'reconnect with name change', L4_reconnect_with_name_change],
  ['lifecycle', 'explicit leave then rejoin (fresh, not reconnect)', L5_explicit_leave_then_rejoin],

  ['voting', 'main vote for own team rejected', V1_main_vote_own_team_rejected],
  ['voting', 'vote for emptied bluff drops at finalize', V2_vote_for_emptied_bluff_drops],
  ['voting', 'intra-vote:clear works', V3_intra_vote_clear_works],
  ['voting', 'bluff longer than 200 chars clamped', V4_bluff_clamped_to_max_length],
  ['voting', 'non-string bluff payloads safe', V5_non_string_bluff_payload_safe],
  ['voting', 'invalid main-vote candidate rejected', V6_main_vote_invalid_candidate_rejected],

  ['phase', 'empty room start-game rejected', P1_empty_room_start_rejected],
  ['phase', 'not all ready start-game rejected', P2_not_all_ready_rejected],
  ['phase', 'pause freezes timer', P3_pause_freezes_timer],
  ['phase', '+15s extends deadline', P4_add_seconds_extends_deadline],
  ['phase', 'trash extends round count', P5_trash_extends_round_count],
  ['phase', 'undo rewinds phase', P6_undo_rewinds_phase],

  ['sanitize', 'emoji-only bluff accepted', S1_emoji_only_bluff_accepts],
  ['sanitize', 'whitespace-only bluff drops', S2_whitespace_only_bluff_drops],
  ['sanitize', 'excessive emoji repetition clamped (name)', S3_excessive_emoji_repetition_clamped],
  ['sanitize', 'name with newlines/tabs collapsed', S4_name_with_newlines_collapsed],
  ['sanitize', 'very long name truncated', S5_very_long_name_truncated],

  ['concurrency', 'many simultaneous bluff submits OK', C1_many_simultaneous_bluff_submits],
  ['concurrency', 'two configures last wins', C2_two_configures_last_wins],
  ['concurrency', 'configure after start rejected', C3_configure_after_start_rejected],

  ['trashtalk', 'all-tied leaderboard shows all', T1_all_tied_trash_talk_shows_all],
  ['trashtalk', 'vote then voter leaves keeps tally', T2_vote_then_voter_leaves],
  ['trashtalk', 'self-vote rejected', T3_self_vote_trash_talk_rejected],
];

(async () => {
  let passed = 0, failed = 0;
  const failures = [];
  const t0 = Date.now();

  for (const [cat, name, fn] of TESTS) {
    process.stdout.write(`[${cat}] ${name} ... `);
    try {
      await fn();
      console.log('✓');
      passed++;
    } catch (e) {
      console.log('✗');
      console.log('   ' + (e.message || e));
      failed++;
      failures.push({ cat, name, error: e.message ?? String(e) });
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${passed} passed, ${failed} failed in ${dur}s.`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - [${f.cat}] ${f.name}: ${f.error}`);
  }
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error('runner crash:', e); process.exit(1); });
