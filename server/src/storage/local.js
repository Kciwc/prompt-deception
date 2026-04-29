const path = require('path');
const fs = require('fs/promises');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

async function ensureDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function put(key, buffer, _contentType) {
  await ensureDir();
  await fs.writeFile(path.join(UPLOADS_DIR, key), buffer);
}

async function remove(key) {
  try {
    await fs.unlink(path.join(UPLOADS_DIR, key));
  } catch (_) {
    // ignore — already gone
  }
}

function urlFor(key) {
  return `/uploads/${key}`;
}

module.exports = {
  kind: 'local',
  put,
  remove,
  urlFor,
  uploadsDir: UPLOADS_DIR,
};
