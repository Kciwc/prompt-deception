// Step 3 smoke: create lobby, ready up, host:start-game, watch phases auto-advance.
// Exercises pause/resume, +15s, trash, undo, end-game.
// Run server with PD_PHASE_SCALE=0.05 so this finishes in ~12s.
const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));

function connect(label) {
  const sock = io(URL, { transports: ['websocket'] });
  sock.on('connect', () => console.log(`[${label}] connected`));
  return sock;
}

async function main() {
  const host = connect('host');
  const a = connect('alice');
  await wait(300);

  // 1. Host creates a 3-round lobby.
  const created = await emit(host, 'lobby:create', { isPublic: false, rounds: 3 });
  if (!created.ok) throw new Error('create failed');
  const code = created.code;
  console.log('[host] code', code);

  // 2. Alice joins, switches to team 1, readies up.
  const joined = await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  if (!joined.ok) throw new Error('alice join: ' + JSON.stringify(joined));
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(a, 'room:ready', { ready: true });
  console.log('[alice] readied');

  // 3. Track phase changes seen by host.
  const seen = [];
  host.on('room:state', (s) => {
    seen.push({ phase: s.phase, status: s.status, paused: s.paused, round: s.completedNonTrashed });
  });

  // 4. Host starts.
  const started = await emit(host, 'host:start-game');
  if (!started.ok) throw new Error('start failed: ' + JSON.stringify(started));
  console.log('[host] started');

  // 5. Wait briefly, then pause.
  await wait(500);
  console.log('[host] pause');
  await emit(host, 'host:pause');
  await wait(300);
  console.log('[host] resume');
  await emit(host, 'host:resume');

  // 6. +15s mid-phase.
  await emit(host, 'host:add-seconds', { seconds: 1 });

  // 7. Trash current round.
  await wait(400);
  console.log('[host] trash');
  await emit(host, 'host:trash-round');

  // 8. Undo.
  await wait(200);
  console.log('[host] undo');
  await emit(host, 'host:undo-phase');

  // 9. Let phases tick through to finish.
  await wait(8000);

  // 10. End game explicitly if not already ended.
  await emit(host, 'host:end-game');
  await wait(300);

  console.log('\n--- phase trail ---');
  // Print just the phase/status transitions, deduped.
  let prev = '';
  for (const e of seen) {
    const key = `${e.status}:p${e.phase}:r${e.round}${e.paused ? ':paused' : ''}`;
    if (key !== prev) {
      console.log(' ', key);
      prev = key;
    }
  }

  console.log('\n--- smoke ok ---');
  host.disconnect();
  a.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
