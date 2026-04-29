// Smoke for library persistence — uploads should survive a server restart.
// Run server normally (no PD_PHASE_SCALE needed; this test doesn't drive a game).
//
// 1. Connect as admin, upload a fake (programmatically generated) WebP
// 2. Confirm /admin/list shows it
// 3. Tell the test runner to bounce the server
// 4. (Caller restarts the server, then re-runs the test with --post-restart)
// 5. /admin/list should still show the entry
//
// For a one-shot self-contained version, we directly test the contentLibrary
// module's init/persist cycle.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

(async () => {
  const storage = require('../server/src/storage');
  const contentLibrary = require('../server/src/db/contentLibrary');
  const sharp = require('sharp');

  console.log('storage backend:', storage.kind);

  // Boot 1: init, add a test entry.
  await contentLibrary.init();
  const beforeCount = contentLibrary.size();
  console.log(`hydrated ${beforeCount} entries from manifest`);

  // Generate a tiny webp + add it
  const buf = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 50, g: 200, b: 50 } },
  }).webp().toBuffer();
  const key = `smoke-persist-${Date.now()}.webp`;
  await storage.put(key, buf, 'image/webp');
  const added = await contentLibrary.add({
    imageKey: key,
    imageUrl: storage.urlFor(key),
    realPrompt: 'a green test square exists for smoke testing purposes only',
  });
  console.log('added entry:', added.id);

  // Boot 2: simulate restart by clearing in-memory state and re-init from
  // manifest. Test imports the same module so we can't truly reset; instead
  // we re-fetch the manifest directly.
  const manifest = await storage.getJson('library-manifest.json');
  if (!manifest) { console.error('FAIL: manifest missing after add'); process.exit(1); }

  const persistedEntry = manifest.entries.find((e) => e.id === added.id);
  if (!persistedEntry) {
    console.error('FAIL: added entry not in persisted manifest');
    process.exit(1);
  }
  if (persistedEntry.realPrompt !== added.realPrompt) {
    console.error('FAIL: realPrompt mismatch in persisted manifest');
    process.exit(1);
  }
  console.log('manifest contains', manifest.entries.length, 'entries — entry survives restart ✓');

  // Cleanup
  await contentLibrary.remove(added.id);
  await storage.remove(key);
  const after = await storage.getJson('library-manifest.json');
  if (after?.entries?.find((e) => e.id === added.id)) {
    console.error('FAIL: removed entry still in manifest');
    process.exit(1);
  }
  console.log('entry removed from manifest ✓');

  console.log('\n--- library persistence smoke ok ---');
  process.exit(0);
})().catch((e) => { console.error('CRASH:', e); process.exit(1); });
