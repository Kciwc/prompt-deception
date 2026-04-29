// Smoke for host:move-player — TV-side host can move a player to a
// specific team (lobby and mid-game).

const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const connect = () => io(URL, { transports: ['websocket'] });

let pass = true;
function assert(cond, msg) { if (!cond) { console.error('  FAIL:', msg); pass = false; } }
function assertEq(a, b, msg) { if (a !== b) { console.error(`  FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); pass = false; } }

async function test_move_player_in_lobby() {
  console.log('\n[test] host:move-player in lobby');
  const host = connect(); const a = connect();
  await wait(200);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await wait(150);

  // Alice gets auto-assigned to team 1
  const aliceBefore = lastState?.players?.find((p) => p.id === 'p_alice___');
  assertEq(aliceBefore?.teamSlot, 1, 'alice should start on team 1');

  // Host moves alice to team 3
  const move = await emit(host, 'host:move-player', { playerId: 'p_alice___', teamSlot: 3 });
  assert(move?.ok, `move should succeed: ${JSON.stringify(move)}`);
  await wait(150);

  const aliceAfter = lastState?.players?.find((p) => p.id === 'p_alice___');
  assertEq(aliceAfter?.teamSlot, 3, 'alice should be on team 3 after host:move-player');

  host.disconnect(); a.disconnect();
}

async function test_move_player_midgame_clears_contributions() {
  console.log('\n[test] host:move-player mid-game clears contributions');
  const host = connect(); const a = connect();
  await wait(200);
  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);

  // Alice writes a bluff in phase 1
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square at midnight' });
  await wait(150);

  // Host moves alice to team 2 mid-phase
  const move = await emit(host, 'host:move-player', { playerId: 'p_alice___', teamSlot: 2 });
  assert(move?.ok, `mid-game move should succeed: ${JSON.stringify(move)}`);
  await wait(150);

  const aliceAfter = lastState?.players?.find((p) => p.id === 'p_alice___');
  assertEq(aliceAfter?.teamSlot, 2, 'alice should be on team 2 after host move');

  // Phase advances naturally; team 1 should now have no submissions
  await wait(5000);
  assertEq(lastState?.phase, 2, 'should be in phase 2');
  const team1Bluff = lastState?.currentRound?.candidates?.find((c) => c.id === 'team:1');
  // Team 1 has nobody after alice left — should be "no bluff"
  assertEq(team1Bluff?.text, 'no bluff', `team 1 should have no bluff (alice moved away), got: ${team1Bluff?.text}`);

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect();
}

async function test_move_player_invalid_team_rejected() {
  console.log('\n[test] host:move-player rejects invalid teamSlot');
  const host = connect(); const a = connect();
  await wait(200);

  const created = await emit(host, 'lobby:create', {});
  await emit(a, 'room:join', { code: created.code, playerId: 'p_alice___', name: 'Alice' });
  await wait(150);

  const r1 = await emit(host, 'host:move-player', { playerId: 'p_alice___', teamSlot: 99 });
  assert(!r1?.ok && r1?.error === 'bad_team', `should reject teamSlot=99, got ${JSON.stringify(r1)}`);

  const r2 = await emit(host, 'host:move-player', { playerId: 'unknown', teamSlot: 1 });
  assert(!r2?.ok, `should reject unknown player, got ${JSON.stringify(r2)}`);

  host.disconnect(); a.disconnect();
}

(async () => {
  try {
    await test_move_player_in_lobby();
    await test_move_player_midgame_clears_contributions();
    await test_move_player_invalid_team_rejected();
    console.log(pass ? '\n=== ALL PASSED ===' : '\n=== FAILED ===');
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error('CRASH:', e);
    process.exit(1);
  }
})();
