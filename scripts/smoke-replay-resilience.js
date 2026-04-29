// Smoke for play-again + host-disconnect auto-pause + typing timestamps.
// Run server with PD_PHASE_SCALE=0.05.

const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const connect = () => io(URL, { transports: ['websocket'] });

let pass = true;
function assert(cond, msg) { if (!cond) { console.error('  FAIL:', msg); pass = false; } }

async function test_play_again() {
  console.log('\n[test] play again resets scores + rounds, keeps players/teams');
  const host = connect(); const a = connect(); const b = connect(); const c = connect();
  await wait(200);

  let lastState = null;
  host.on('room:state', (s) => { lastState = s; });

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(host, 'host:configure', { rounds: 3, speed: 'quick', trashTalkEnabled: false });
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
  await wait(300);

  // Force a quick game by ending early
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in the city' });
  await wait(5000); // → phase 2
  await emit(a, 'main-vote:cast', { candidate: 'real' });
  await emit(b, 'main-vote:cast', { candidate: 'team:1' });
  await emit(c, 'main-vote:cast', { candidate: 'real' });
  await wait(2800); // → phase 3
  await wait(2500); // → phase 4 (would normally cycle through more rounds — host:end early)
  await emit(host, 'host:end-game');
  await wait(200);

  const beforeReplay = lastState;
  assert(beforeReplay?.status === 'finished', 'should be finished');
  const totalScoreBefore = beforeReplay.teams.reduce((s, t) => s + t.score, 0);
  assert(totalScoreBefore > 0, 'should have non-zero scores');

  // Try play-again BEFORE finished — should fail
  // (already finished, so this is the right call)
  const replay = await emit(host, 'host:play-again');
  assert(replay?.ok, `play-again should succeed, got ${JSON.stringify(replay)}`);
  await wait(200);

  const afterReplay = lastState;
  assert(afterReplay?.status === 'lobby', `status should be lobby, got ${afterReplay?.status}`);
  assert(afterReplay?.phase === 0, `phase should be 0, got ${afterReplay?.phase}`);
  assert(afterReplay?.players.length === 3, `should keep all 3 players, got ${afterReplay?.players?.length}`);
  for (const t of afterReplay.teams) {
    assert(t.score === 0, `team ${t.name} score should be 0, got ${t.score}`);
  }
  for (const p of afterReplay.players) {
    assert(p.ready === false, `${p.name} should be unreadied`);
  }
  assert(afterReplay.config.rounds === 3, 'config should be preserved');

  host.disconnect(); a.disconnect(); b.disconnect(); c.disconnect();
}

async function test_host_disconnect_auto_pause() {
  console.log('\n[test] host disconnect causes auto-pause at next phase transition');
  const host = connect(); const a = connect();
  await wait(200);
  let lastAState = null;
  a.on('room:state', (s) => { lastAState = s; });

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);

  assert(lastAState?.phase === 1, 'should be in phase 1');
  assert(lastAState?.paused === false, 'should not be paused yet');

  // Host bails. Phase 1 keeps running.
  host.disconnect();
  await wait(300);

  // Phase 1 still active (but host gone)
  assert(lastAState?.hostConnected === false, 'hostConnected should be false');

  // Wait for natural phase 1 → 2 transition. Should auto-pause.
  await wait(5500);
  assert(lastAState?.paused === true, `should auto-pause on phase transition, got paused=${lastAState?.paused}`);
  assert(lastAState?.pausedReason === 'host_disconnected', `pausedReason should be host_disconnected, got '${lastAState?.pausedReason}'`);

  // Reconnect host, manually resume
  const host2 = connect();
  await wait(200);
  // Need the original token, but for the test let's simulate by creating a new lobby.
  // Just verify the pause behavior held — that's the main point.

  a.disconnect(); host2.disconnect();
}

async function test_typing_timestamp_present() {
  console.log('\n[test] typing timestamp present on teammate bluffs');
  const host = connect(); const a = connect(); const b = connect();
  await wait(200);
  let lastBState = null;
  b.on('room:state', (s) => { lastBState = s; });

  const created = await emit(host, 'lobby:create', {});
  const code = created.code;
  await emit(host, 'host:configure', { speed: 'quick', rounds: 3, trashTalkEnabled: false });
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(b, 'room:join', { code, playerId: 'p_bob_____', name: 'Bob' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(b, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });
  await emit(host, 'host:start-game');
  await wait(300);

  // Alice types
  await emit(a, 'bluff:submit', { text: 'Working on something clever' });
  await wait(150);

  // Bob's view should now show alice's bluff with typingAt timestamp
  const aliceEntry = lastBState?.currentRound?.teamBluffs?.find((b) => b.pid === 'p_alice___');
  assert(aliceEntry, 'alice entry should be visible to bob');
  assert(typeof aliceEntry?.typingAt === 'number', `typingAt should be a number, got ${typeof aliceEntry?.typingAt}`);
  assert(typeof lastBState?.serverTime === 'number', 'serverTime should be present');
  // typingAt should be very recent
  const elapsed = (lastBState?.serverTime ?? Date.now()) - aliceEntry.typingAt;
  assert(elapsed < 2000, `typingAt should be recent (got ${elapsed}ms ago)`);

  await emit(host, 'host:end-game');
  host.disconnect(); a.disconnect(); b.disconnect();
}

(async () => {
  try {
    await test_play_again();
    await test_host_disconnect_auto_pause();
    await test_typing_timestamp_present();
    console.log(pass ? '\n=== ALL TESTS PASSED ===' : '\n=== SOME TESTS FAILED ===');
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error('CRASH:', e);
    process.exit(1);
  }
})();
