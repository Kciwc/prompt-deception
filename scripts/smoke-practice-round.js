// Smoke for practice round: enabled via config, runs first with isPractice
// flag, doesn't count toward target rounds, doesn't apply scoring.

const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const connect = () => io(URL, { transports: ['websocket'] });

let pass = true;
function assert(cond, msg) { if (!cond) { console.error('  FAIL:', msg); pass = false; } }
function assertEq(a, b, msg) { if (a !== b) { console.error(`  FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); pass = false; } }

(async () => {
  console.log('[test] practice round runs first, doesn\'t score, doesn\'t count');
  const host = connect(); const a = connect(); const b = connect(); const c = connect();
  await wait(200);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  await emit(host, 'host:configure', {
    rounds: 3, speed: 'quick', trashTalkEnabled: false, practiceRound: true,
  });
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await emit(b, 'room:join', { code: created.code, playerId: 'p_bob_____', name: 'Bob' });
  await emit(c, 'room:join', { code: created.code, playerId: 'p_carol___', name: 'Carol' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(b, 'room:team-switch', { teamSlot: 2 });
  await emit(c, 'room:team-switch', { teamSlot: 3 });
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });
  await emit(c, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);

  // First round should be practice
  assertEq(lastState?.currentRound?.isPractice, true, 'first round should be practice');
  assertEq(lastState?.phase, 1, 'should be in phase 1');

  // Submit some bluffs and votes (would normally score)
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square' });
  await wait(200);

  // Practice with PD_PHASE_SCALE=0.05 → Long P1 = 300s × 0.05 = 15s. Long.
  // Skip ahead: trash the round to advance immediately.
  await emit(host, 'host:trash-round');
  await wait(300);

  // After trashing the practice round, we should be on the next round
  // (which is a real round, since practice is done).
  const round2 = lastState?.currentRound;
  assertEq(round2?.isPractice, false, 'round after practice should be a real round');

  // Team scores should still all be 0 (practice didn't score)
  for (const t of lastState?.teams ?? []) {
    assertEq(t.score, 0, `team ${t.name} should still have score 0 after practice`);
  }

  // completedNonTrashed: the new real round is in progress and counts as 1.
  // Practice round was filtered out (both trashed AND isPractice).
  assertEq(lastState?.completedNonTrashed, 1, 'real round 1 should count as 1');

  await emit(host, 'host:end-game');
  await wait(200);

  console.log(pass ? '\n=== PRACTICE ROUND SMOKE OK ===' : '\n=== FAILED ===');
  host.disconnect(); a.disconnect(); b.disconnect(); c.disconnect();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('CRASH:', e); process.exit(1); });
