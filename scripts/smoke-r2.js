// Verify R2 upload pipeline: sharp produces a webp buffer, storage.put
// pushes to R2, the entry's imageUrl is fetchable.
const sharp = require('sharp');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

(async () => {
  const storage = require('../server/src/storage');
  console.log('storage backend:', storage.kind);

  // Generate a 64x64 solid-color PNG.
  const buf = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 0, g: 200, b: 255 },
    },
  }).webp().toBuffer();

  const key = `smoke-${Date.now()}.webp`;
  await storage.put(key, buf, 'image/webp');
  const url = storage.urlFor(key);
  console.log('uploaded ->', url);

  // Try to fetch it back to verify public access.
  const res = await fetch(url);
  console.log('fetched:', res.status, res.statusText);
  if (!res.ok) {
    console.error('public-fetch FAILED');
    process.exit(1);
  }
  const fetched = await res.arrayBuffer();
  console.log('size:', fetched.byteLength, 'bytes (expected ≥', buf.byteLength, ')');

  // Cleanup.
  await storage.remove(key);
  console.log('removed.');

  console.log('\n--- r2 smoke ok ---');
})().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
