// Smoke test for step 2: create lobby → join 2 players → switch teams → ready up.
// Usage: node scripts/smoke-step2.js  (assumes server already running on :3001)
const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function connect(label) {
  const sock = io(URL, { transports: ['websocket'] });
  sock.on('connect', () => console.log(`[${label}] connected as ${sock.id}`));
  sock.on('connect_error', (e) => console.error(`[${label}] connect_error:`, e.message));
  return sock;
}

function emit(sock, event, payload) {
  return new Promise((resolve) => sock.emit(event, payload, resolve));
}

async function main() {
  const host = connect('host');
  const a = connect('alice');
  const b = connect('bob');

  await delay(300);

  // 1. Host creates lobby
  const created = await emit(host, 'lobby:create', { isPublic: true, rounds: 5 });
  if (!created?.ok) throw new Error('create failed: ' + JSON.stringify(created));
  console.log('[host] created room', created.code);

  // Watch state on the host TV
  host.on('room:state', (s) => {
    const players = s.players?.map((p) => `${p.name}(t${p.teamSlot}${p.ready ? '✓' : ''})`).join(', ');
    console.log(`[host] room:state phase=${s.phase} players=[${players}]`);
  });

  // 2. Alice joins
  const aliceJoin = await emit(a, 'room:join', { code: created.code, playerId: 'p_alice_'.padEnd(10, '0'), name: 'Alice' });
  if (!aliceJoin?.ok) throw new Error('alice join failed: ' + JSON.stringify(aliceJoin));
  console.log('[alice] joined');

  // 3. Bob joins
  const bobJoin = await emit(b, 'room:join', { code: created.code, playerId: 'p_bob_'.padEnd(10, '0'), name: 'Bob' });
  if (!bobJoin?.ok) throw new Error('bob join failed: ' + JSON.stringify(bobJoin));
  console.log('[bob] joined');

  await delay(150);

  // 4. Alice switches to team 3
  const sw = await emit(a, 'room:team-switch', { teamSlot: 3 });
  console.log('[alice] team-switch:', sw);

  // 5. Both ready up
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });

  await delay(200);

  console.log('\n--- smoke ok ---');
  host.disconnect();
  a.disconnect();
  b.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
