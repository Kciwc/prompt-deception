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

async function getJson(key) {
  try {
    const text = await fs.readFile(path.join(UPLOADS_DIR, key), 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

async function putJson(key, obj) {
  await ensureDir();
  await fs.writeFile(path.join(UPLOADS_DIR, key), JSON.stringify(obj, null, 2));
}

module.exports = {
  kind: 'local',
  put,
  remove,
  urlFor,
  getJson,
  putJson,
  uploadsDir: UPLOADS_DIR,
};
