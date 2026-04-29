// Smoke for late join: a player can join after the game has started.
// Run server with PD_PHASE_SCALE=0.05.

const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const connect = () => io(URL, { transports: ['websocket'] });

let pass = true;
function assert(cond, msg) { if (!cond) { console.error('  FAIL:', msg); pass = false; } }
function assertEq(a, b, msg) { if (a !== b) { console.error(`  FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); pass = false; } }

async function test_late_join_during_phase1() {
  console.log('\n[test] late join during phase 1 — auto team-assign, can submit bluff');
  const host = connect(); const a = connect();
  await wait(200);
  let aLastState = null;
  a.on('room:state', (s) => { aLastState = s; });

  const created = await emit(host, 'lobby:create', {});
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);

  assertEq(aLastState?.phase, 1, 'should be in phase 1');

  // Late joiner Bob arrives during phase 1
  const b = connect();
  await wait(150);
  let bLastState = null;
  b.on('room:state', (s) => { bLastState = s; });

  const bobJoin = await emit(b, 'room:join', {
    code: created.code, playerId: 'p_bob_____', name: 'Bob',
  });
  assert(bobJoin?.ok, `bob should be allowed to join mid-game: ${JSON.stringify(bobJoin)}`);
  assertEq(bobJoin.lateJoin, true, 'lateJoin flag should be true');
  assertEq(bobJoin.reconnect, false, 'reconnect flag should be false');

  await wait(150);
  // Bob should be visible in everyone's player list
  const bobInRoom = aLastState?.players?.find((p) => p.id === 'p_bob_____');
  assert(bobInRoom, 'bob should appear in alice\'s player list');
  assert([1, 2, 3].includes(bobInRoom?.teamSlot), `bob should be on a valid team, got ${bobInRoom?.teamSlot}`);

  // Bob should be able to submit a bluff right now
  const submit = await emit(b, 'bluff:submit', { text: 'I just got here but I have great ideas about ducks' });
  assert(submit?.ok, `bob bluff submit should succeed: ${JSON.stringify(submit)}`);

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect(); b.disconnect();
}

async function test_late_join_during_phase2() {
  console.log('\n[test] late join during phase 2 — can main-vote on existing candidates');
  const host = connect(); const a = connect();
  await wait(200);
  let aLastState = null;
  a.on('room:state', (s) => { aLastState = s; });

  const created = await emit(host, 'lobby:create', {});
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square at midnight' });
  await wait(5000); // → phase 2
  assertEq(aLastState?.phase, 2, 'should be in phase 2');

  // Bob arrives during phase 2 — attach listener BEFORE join so we don't
  // miss the initial state push.
  const b = connect();
  let bLastState = null;
  b.on('room:state', (s) => { bLastState = s; });
  await wait(150);
  const bobJoin = await emit(b, 'room:join', {
    code: created.code, playerId: 'p_bob_____', name: 'Bob',
  });
  assert(bobJoin?.ok, 'bob should join during phase 2');
  await wait(200);
  const candidates = bLastState?.currentRound?.candidates ?? [];
  assert(candidates.length === 4, `should have 4 candidates, got ${candidates.length}`);

  // Pick a candidate that ISN'T bob's auto-assigned team
  const bobTeam = bLastState.players.find((p) => p.id === 'p_bob_____')?.teamSlot;
  const safeCandidate = candidates.find((c) => c.id !== `team:${bobTeam}` && c.id !== 'real');
  if (safeCandidate) {
    const vote = await emit(b, 'main-vote:cast', { candidate: safeCandidate.id });
    assert(vote?.ok, `bob's main vote should succeed: ${JSON.stringify(vote)}`);
  }

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect(); b.disconnect();
}

async function test_team_switch_midgame_clears_contributions() {
  console.log('\n[test] mid-game team switch clears current round contributions');
  const host = connect(); const a = connect();
  await wait(200);
  let aLastState = null;
  a.on('room:state', (s) => { aLastState = s; });

  const created = await emit(host, 'lobby:create', {});
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);

  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square at midnight' });
  await wait(150);
  assert(aLastState?.currentRound?.myBluff?.length > 0, 'alice should have a bluff');

  // Switch teams mid-phase
  const sw = await emit(a, 'room:team-switch', { teamSlot: 2 });
  assert(sw?.ok, `mid-game team switch should succeed: ${JSON.stringify(sw)}`);

  await wait(150);
  const aliceAfter = aLastState?.players?.find((p) => p.id === 'p_alice___');
  assertEq(aliceAfter?.teamSlot, 2, 'alice should be on team 2 now');
  assertEq(aLastState?.currentRound?.myBluff, null, 'alice\'s bluff should be cleared after switch');

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect();
}

(async () => {
  try {
    await test_late_join_during_phase1();
    await test_late_join_during_phase2();
    await test_team_switch_midgame_clears_contributions();
    console.log(pass ? '\n=== ALL LATE-JOIN TESTS PASSED ===' : '\n=== TESTS FAILED ===');
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error('CRASH:', e);
    process.exit(1);
  }
})();
