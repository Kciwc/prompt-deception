// Step 4 smoke: full round with bluff submit, intra-vote (skipped — 1 per team),
// main vote, scoring, reveal. Run server with PD_PHASE_SCALE=0.05.
//
// Scenario (1 player per team, expected scores after 1 round):
//   alice (team 1) votes 'real'    →  +2 to team 1
//   bob   (team 2) votes 'team:1'  →  trick point: team 1 += 1
//   carol (team 3) votes 'real'    →  +2 to team 3
//
// Expected: team 1 = 3, team 2 = 0, team 3 = 2.
const { io } = require('socket.io-client');

const URL = process.env.SMOKE_URL || 'http://localhost:3001';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));

function connect(label) {
  const sock = io(URL, { transports: ['websocket'] });
  sock.on('connect', () => console.log(`[${label}] connected`));
  return sock;
}

let lastHostState = null;

async function main() {
  const host = connect('host');
  const a = connect('alice');
  const b = connect('bob');
  const c = connect('carol');
  await wait(300);

  host.on('room:state', (s) => { lastHostState = s; });

  // Create 1-round lobby.
  const created = await emit(host, 'lobby:create', { isPublic: false, rounds: 1 });
  if (!created.ok) throw new Error('create failed');
  const code = created.code;
  console.log('[host] code', code);

  // Three players join, one per team.
  await emit(a, 'room:join', { code, playerId: 'p_alice___', name: 'Alice' });
  await emit(b, 'room:join', { code, playerId: 'p_bob_____', name: 'Bob' });
  await emit(c, 'room:join', { code, playerId: 'p_carol___', name: 'Carol' });
  await emit(a, 'room:team-switch', { teamSlot: 1 });
  await emit(b, 'room:team-switch', { teamSlot: 2 });
  await emit(c, 'room:team-switch', { teamSlot: 3 });
  await emit(a, 'room:ready', { ready: true });
  await emit(b, 'room:ready', { ready: true });
  await emit(c, 'room:ready', { ready: true });

  const started = await emit(host, 'host:start-game');
  if (!started.ok) throw new Error('start failed: ' + JSON.stringify(started));
  console.log('[host] started');

  // Phase 1 — bluffs.
  await wait(400);
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square' });
  await emit(b, 'bluff:submit', { text: "Einstein's grocery list, written backwards" });
  await emit(c, 'bluff:submit', { text: 'A potato giving a TED talk on optimism' });
  console.log('phase 1 bluffs in');

  // Wait for natural advance to phase 2.
  await wait(3500);
  if (lastHostState?.phase !== 2) {
    console.log('  hmm, expected phase 2 by now, got', lastHostState?.phase);
  }

  // Phase 2 — only 1 bluff per team, no vote required. Just wait for advance.
  await wait(2000);
  if (lastHostState?.phase !== 3) {
    console.log('  hmm, expected phase 3 by now, got', lastHostState?.phase);
  }

  // Phase 3 — main vote. Everyone needs candidates.
  // Alice's team is 1, so she can vote anything except 'team:1'. She picks 'real'.
  // Bob (team 2) picks 'team:1' (gives team 1 a trick point).
  // Carol (team 3) picks 'real'.
  // We need to know which candidate id is the 'real' one — it's just the literal 'real' id.
  console.log('phase 3 — main votes');
  await emit(a, 'main-vote:cast', { candidate: 'real' });
  await emit(b, 'main-vote:cast', { candidate: 'team:1' });
  await emit(c, 'main-vote:cast', { candidate: 'real' });

  // Wait for phase 4 (reveal + scoring).
  await wait(2800);

  // Final state.
  console.log('\n--- final state ---');
  console.log('phase:', lastHostState?.phase, 'status:', lastHostState?.status);
  for (const t of lastHostState?.teams ?? []) {
    console.log(`  ${t.name}: ${t.score}`);
  }
  console.log('reveal:', JSON.stringify(lastHostState?.currentRound?.reveal?.scoreDelta?.perTeam));

  // Verify expected scores: team 1 = 3, team 2 = 0, team 3 = 2.
  const teams = lastHostState?.teams ?? [];
  const t1 = teams.find((t) => t.slot === 1)?.score;
  const t2 = teams.find((t) => t.slot === 2)?.score;
  const t3 = teams.find((t) => t.slot === 3)?.score;

  let pass = true;
  if (t1 !== 3) { console.error('FAIL: team 1 expected 3, got', t1); pass = false; }
  if (t2 !== 0) { console.error('FAIL: team 2 expected 0, got', t2); pass = false; }
  if (t3 !== 2) { console.error('FAIL: team 3 expected 2, got', t3); pass = false; }

  // Wait for podium then end-game.
  await wait(500);
  await emit(host, 'host:end-game');
  await wait(200);

  console.log(pass ? '\n--- smoke ok ---' : '\n--- smoke FAILED ---');
  host.disconnect(); a.disconnect(); b.disconnect(); c.disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE CRASH:', e); process.exit(1); });
