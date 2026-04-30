// Probe the live Railway deployment to see what code it's running.
// We test for features added in the most recent commits — if any are
// missing, the server is on an older deploy.
const { io } = require('socket.io-client');

const URL = 'https://prompt-deception-production-3722.up.railway.app';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p, timeoutMs = 3000) =>
  new Promise((resolve) => {
    let done = false;
    s.emit(ev, p, (res) => { done = true; resolve(res); });
    setTimeout(() => { if (!done) resolve({ __timeout: true }); }, timeoutMs);
  });

(async () => {
  console.log('Probing', URL);
  const host = connectClient();
  // Wait up to 5s for connection
  for (let i = 0; i < 50; i++) {
    if (host.connected) break;
    await wait(100);
  }
  if (!host.connected) {
    console.error('FAIL: could not connect to live server within 5s');
    process.exit(1);
  }
  console.log('connected as', host.id);

  const created = await emit(host, 'lobby:create', {});
  if (!created?.ok) {
    console.error('FAIL: lobby:create failed:', created);
    process.exit(1);
  }
  console.log('lobby:create works → code', created.code);

  // ── Feature 1: host:configure with trashTalkEnabled (added in phase merge)
  const cfg = await emit(host, 'host:configure', { trashTalkEnabled: true, speed: 'standard' });
  console.log('host:configure:', cfg?.ok ? '✓ works' : `✗ broken (${JSON.stringify(cfg)})`);
  if (cfg?.config && 'trashTalkEnabled' in cfg.config) {
    console.log('  → config returns trashTalkEnabled — phase-merge code present');
  }

  // ── Feature 2: host:move-player (latest commit, fd5b7c0)
  const move = await emit(host, 'host:move-player', { playerId: 'fake_player_id_12', teamSlot: 1 });
  if (move?.__timeout) {
    console.log('host:move-player: ✗ NOT HANDLED — old code is live');
  } else if (move?.error === 'switch_rejected' || move?.error === 'bad_team' || move?.error === 'bad_player_id') {
    console.log('host:move-player: ✓ handled (latest commit fd5b7c0 is live)');
  } else if (move?.ok) {
    console.log('host:move-player: ✓ works');
  } else {
    console.log('host:move-player: ?', move);
  }

  // ── Feature 3: room:join lateJoin flag (commit e4e9103)
  const player = connectClient();
  await wait(200);
  const join = await emit(player, 'room:join', { code: created.code, playerId: 'p_check____', name: 'Check' });
  if ('lateJoin' in (join ?? {})) {
    console.log('room:join lateJoin flag: ✓ present (late-join commit live)');
  } else {
    console.log('room:join lateJoin flag: ✗ missing (older code)');
  }

  // ── Feature 4: host:play-again (commit 6794bb3)
  const replay = await emit(host, 'host:play-again');
  if (replay?.__timeout) {
    console.log('host:play-again: ✗ NOT HANDLED');
  } else if (replay?.error === 'not_finished') {
    console.log('host:play-again: ✓ handled (responds with not_finished while in lobby)');
  } else {
    console.log('host:play-again: ?', replay);
  }

  // Cleanup
  player.disconnect();
  host.disconnect();
  process.exit(0);
})().catch((e) => { console.error('CRASH:', e); process.exit(1); });

function connectClient() {
  return io(URL, { transports: ['websocket', 'polling'], reconnection: false, timeout: 8000 });
}
