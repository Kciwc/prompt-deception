// Step 6 smoke: phase merge + trash talk + game settings end-to-end.
// Run server with PD_PHASE_SCALE=0.05 so phases are ~3-15s.
//
// Scenario:
//   - Host configures game (3 rounds, quick speed, trashtalk on)
//   - 3 players join, one per team
//   - All ready
//   - Phase 1 (write+vote): Alice types a bluff, Bob doesn't, Carol doesn't.
//     Bob votes for Alice. (No mid-phase voting between Alice's keystrokes
//     here, but the wire confirms drafts propagate.)
//   - Phase 1→2: Alice's bluff wins for team 1; team 2/3 are auto-empty.
//   - Phase 2 (main vote): Alice picks 'real', Bob picks 'team:1', Carol picks 'real'.
//   - Phase 3 (reveal): Alice trash-talk votes Bob, Bob votes Carol, Carol votes Alice.
//   - Phase 3 → podium: trash talk leaderboard has all three with 1 vote each (3-way tie).
//
// Verify:
//   - Scoring: Alice +2 (real), Bob +1 (trick on team 1), Carol +2 (real). team1=3, team2=0, team3=2.
//   - Trash talk leaderboard has 3 entries, each with votes=1.

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

  const created = await emit(host, 'lobby:create', { isPublic: false });
  if (!created.ok) throw new Error('create failed');
  const code = created.code;
  console.log('[host] code', code);

  // Configure: 3 rounds, quick, trash talk on
  const cfg = await emit(host, 'host:configure', { rounds: 3, speed: 'quick', trashTalkEnabled: true });
  if (!cfg.ok) throw new Error('configure failed: ' + JSON.stringify(cfg));
  console.log('[host] config:', cfg.config);

  // Three players join, one per team
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

  // Phase 1: write + vote (merged). Quick scaled = 90s × 0.05 = ~4.5s
  await wait(300);
  await emit(a, 'bluff:submit', { text: 'A duck riding a unicycle in Times Square' });
  console.log('phase 1: alice submitted');

  await wait(2500);
  if (lastHostState?.phase !== 1) console.warn('expected phase 1, got', lastHostState?.phase);

  // Wait for phase 1 → 2 transition
  await wait(2500);
  if (lastHostState?.phase !== 2) console.warn('expected phase 2, got', lastHostState?.phase);

  // Phase 2: main vote (was phase 3). Quick = 45s × 0.05 = ~2.25s
  await emit(a, 'main-vote:cast', { candidate: 'real' });
  await emit(b, 'main-vote:cast', { candidate: 'team:1' });
  await emit(c, 'main-vote:cast', { candidate: 'real' });
  console.log('phase 2: votes cast');

  // Wait for phase 2 → 3
  await wait(2500);
  if (lastHostState?.phase !== 3) console.warn('expected phase 3, got', lastHostState?.phase);

  // Phase 3: reveal + trash talk. Quick = 30s × 0.05 = ~1.5s
  // Trash talk votes: 3-way circle so everyone gets 1.
  await emit(a, 'trashtalk:vote', { targetPlayerId: 'p_bob_____' });
  await emit(b, 'trashtalk:vote', { targetPlayerId: 'p_carol___' });
  await emit(c, 'trashtalk:vote', { targetPlayerId: 'p_alice___' });
  console.log('phase 3: trash talk votes cast');

  await wait(3000);

  // Capture state mid-game for inspection
  const teamScores = lastHostState?.teams ?? [];
  const t1 = teamScores.find((t) => t.slot === 1)?.score;
  const t2 = teamScores.find((t) => t.slot === 2)?.score;
  const t3 = teamScores.find((t) => t.slot === 3)?.score;
  const leaderboard = lastHostState?.trashTalkLeaderboard ?? [];

  console.log('\n--- after first round ---');
  console.log(`team scores: ${t1}/${t2}/${t3} (expect 3/0/2)`);
  console.log('trash talk leaderboard:', leaderboard.map((e) => `${e.name}:${e.votes}`).join(', '));

  let pass = true;
  if (t1 !== 3) { console.error('FAIL: team 1 expected 3, got', t1); pass = false; }
  if (t2 !== 0) { console.error('FAIL: team 2 expected 0, got', t2); pass = false; }
  if (t3 !== 2) { console.error('FAIL: team 3 expected 2, got', t3); pass = false; }
  if (leaderboard.length !== 3) {
    console.error('FAIL: expected 3 leaderboard entries, got', leaderboard.length); pass = false;
  } else {
    for (const e of leaderboard) {
      if (e.votes !== 1) { console.error(`FAIL: ${e.name} expected 1, got ${e.votes}`); pass = false; }
    }
  }

  // End game so we don't have to wait through more rounds
  await emit(host, 'host:end-game');
  await wait(300);

  console.log(pass ? '\n--- smoke ok ---' : '\n--- smoke FAILED ---');
  host.disconnect(); a.disconnect(); b.disconnect(); c.disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE CRASH:', e); process.exit(1); });
