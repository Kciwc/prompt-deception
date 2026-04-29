// Edge-case smoke for the new game flow. Runs many independent scenarios
// against a single PD_PHASE_SCALE=0.05 server. Each test creates its own
// lobby so they don't interfere.

const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const connect = () => io(URL, { transports: ['websocket'] });

let pass = true;
function assert(cond, msg) {
  if (!cond) { console.error('  FAIL:', msg); pass = false; return false; }
  return true;
}

// ──────────────────────────────────────────────────────────
// 1. Configure clears ready, configure rejected after start
// ──────────────────────────────────────────────────────────
async function test_configure_clears_ready() {
  console.log('\n[test] configure clears ready + rejected after start');
  const host = connect(); const a = connect();
  await wait(200);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;

  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:ready', { ready: true });
  await wait(100);

  const beforePatch = lastState?.players.find((p) => p.id === 'p_alice___')?.ready;
  assert(beforePatch === true, 'alice should be ready before configure');

  // Configure → ready should clear
  await emit(host, 'host:configure', { speed: 'long' });
  await wait(100);
  const afterPatch = lastState?.players.find((p) => p.id === 'p_alice___')?.ready;
  assert(afterPatch === false, 'alice ready should clear after configure');

  // Re-ready and start
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(100);

  // Configure should now fail
  const cfg = await emit(host, 'host:configure', { rounds: 7 });
  assert(cfg?.ok === false, 'configure after start should fail');
  assert(cfg?.error === 'wrong_status', `expected wrong_status, got ${cfg?.error}`);

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect();
}

// ──────────────────────────────────────────────────────────
// 2. Reconnect mid-game (existing playerId allowed)
// ──────────────────────────────────────────────────────────
async function test_reconnect_mid_game() {
  console.log('\n[test] reconnect mid-game allowed');
  const host = connect(); const a = connect();
  await wait(200);

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(100);

  // Disconnect alice
  a.disconnect();
  await wait(200);

  // New player NEW playerId trying to join — should be rejected
  const stranger = connect();
  await wait(150);
  const strangerJoin = await emit(stranger, 'room:join', {
    code, playerId: 'p_stranger', name: 'Stranger',
  });
  assert(strangerJoin?.ok === false, 'new player join mid-game should be rejected');
  assert(strangerJoin?.error === 'game_in_progress', `expected game_in_progress, got ${strangerJoin?.error}`);
  stranger.disconnect();

  // Alice rejoining (same playerId) — should be allowed
  const a2 = connect();
  await wait(150);
  const reconnect = await emit(a2, 'room:join', {
    code, playerId: 'p_alice___', name: 'Alice',
  });
  assert(reconnect?.ok === true, `alice reconnect should succeed: ${JSON.stringify(reconnect)}`);
  assert(reconnect?.reconnect === true, 'reconnect flag should be true');

  await emit(host, 'host:end-game');
  host.disconnect(); a2.disconnect();
}

// ──────────────────────────────────────────────────────────
// 3. Trash talk disabled rejects votes
// ──────────────────────────────────────────────────────────
async function test_trashtalk_disabled() {
  console.log('\n[test] trashtalk disabled rejects votes');
  const host = connect(); const a = connect(); const b = connect();
  await wait(200);

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(host, 'host:configure', { trashTalkEnabled: false, speed: 'quick', rounds: 3 });
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(b, 'room:join', { code, playerId: 'p_bob_____', name: 'Bob' });
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(200);

  // Skip phase 1 by submitting nothing
  await wait(2800); // phase 1 → 2 (quick = ~4.5s, but we got a head start)
  await wait(2500); // phase 2 → 3

  // Now in phase 3 (reveal) — trash talk vote should fail because disabled
  const tt = await emit(a, 'trashtalk:vote', { targetPlayerId: 'p_bob_____' });
  assert(tt?.ok === false, 'trashtalk:vote should fail when disabled');
  assert(tt?.error === 'disabled', `expected 'disabled', got ${tt?.error}`);

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect(); b.disconnect();
}

// ──────────────────────────────────────────────────────────
// 4. Double points multiplier
// ──────────────────────────────────────────────────────────
async function test_double_points() {
  console.log('\n[test] double points multiplies scores');
  const host = connect(); const a = connect(); const b = connect(); const c = connect();
  await wait(200);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(host, 'host:configure', { doublePoints: true, speed: 'quick', rounds: 3 });
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(b, 'room:join', { code, playerId: 'p_bob_____', name: 'Bob' });
  await emit(c, 'room:join', { code, playerId: 'p_carol___', name: 'Carol' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(b, 'room:team-switch', { teamSlot: 2 });
  await emit(c, 'room:team-switch', { teamSlot: 3 });
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });
  await emit(c, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');

  // Phase 1: alice writes, others don't
  await wait(300);
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square' });

  // Wait for phase 1 → 2
  await wait(5000);
  // Phase 2: alice 'real' (+4 dp), bob 'team:1' (+2 trick to team 1), carol 'real' (+4 dp)
  await emit(a, 'main-vote:cast', { candidate: 'real' });
  await emit(b, 'main-vote:cast', { candidate: 'team:1' });
  await emit(c, 'main-vote:cast', { candidate: 'real' });

  await wait(3500);
  const teams = lastState?.teams ?? [];
  const t1 = teams.find((t) => t.slot === 1)?.score;
  const t2 = teams.find((t) => t.slot === 2)?.score;
  const t3 = teams.find((t) => t.slot === 3)?.score;
  console.log(`  team scores with doublePoints: ${t1}/${t2}/${t3} (expect 6/0/4)`);
  assert(t1 === 6, `team 1 expected 6, got ${t1}`);
  assert(t2 === 0, `team 2 expected 0, got ${t2}`);
  assert(t3 === 4, `team 3 expected 4, got ${t3}`);

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect(); b.disconnect(); c.disconnect();
}

// ──────────────────────────────────────────────────────────
// 5. All-empty bluffs (nobody writes) — all teams get "no bluff"
// ──────────────────────────────────────────────────────────
async function test_all_empty_bluffs() {
  console.log('\n[test] all-empty bluffs handled gracefully');
  const host = connect(); const a = connect(); const b = connect(); const c = connect();
  await wait(200);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(b, 'room:join', { code, playerId: 'p_bob_____', name: 'Bob' });
  await emit(c, 'room:join', { code, playerId: 'p_carol___', name: 'Carol' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(b, 'room:team-switch', { teamSlot: 2 });
  await emit(c, 'room:team-switch', { teamSlot: 3 });
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });
  await emit(c, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');

  // Nobody writes anything during phase 1. Just wait it out.
  await wait(5500);

  // Should be in phase 2 with all candidates being "no bluff" + real prompt
  const round = lastState?.currentRound;
  assert(lastState?.phase === 2, `expected phase 2, got ${lastState?.phase}`);
  assert(Array.isArray(round?.candidates), 'candidates array should exist');
  const noBluffs = round?.candidates?.filter((c) => c.text === 'no bluff') ?? [];
  assert(noBluffs.length === 3, `expected 3 'no bluff' candidates, got ${noBluffs.length}`);
  const realCandidate = round?.candidates?.find((c) => c.id === 'real');
  assert(!!realCandidate, 'real candidate should exist');

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect(); b.disconnect(); c.disconnect();
}

(async () => {
  try {
    await test_configure_clears_ready();
    await test_reconnect_mid_game();
    await test_trashtalk_disabled();
    await test_double_points();
    await test_all_empty_bluffs();

    console.log(pass ? '\n=== ALL EDGE TESTS PASSED ===' : '\n=== EDGE TESTS FAILED ===');
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error('CRASH:', e);
    process.exit(1);
  }
})();
