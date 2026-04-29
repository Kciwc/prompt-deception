// Content library — backed by a single JSON manifest in the storage backend
// (R2 or local disk). Survives server restarts. Single-writer model: one
// Node replica is the only thing that mutates the manifest, so we don't
// need locking.

const crypto = require('crypto');
const storage = require('../storage');

const MANIFEST_KEY = 'library-manifest.json';

const items = new Map(); // id -> entry
let initialized = false;
let initPromise = null;

async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const manifest = await storage.getJson(MANIFEST_KEY);
      if (manifest && Array.isArray(manifest.entries)) {
        for (const entry of manifest.entries) {
          if (entry?.id) items.set(entry.id, entry);
        }
        console.log(`[contentLibrary] hydrated ${items.size} entries from manifest`);
      } else {
        console.log('[contentLibrary] no manifest found — starting empty');
      }
    } catch (err) {
      console.error('[contentLibrary] init failed, starting empty:', err.message);
    } finally {
      initialized = true;
    }
  })();
  return initPromise;
}

async function persist() {
  try {
    const manifest = {
      version: 1,
      updatedAt: Date.now(),
      entries: Array.from(items.values()),
    };
    await storage.putJson(MANIFEST_KEY, manifest);
  } catch (err) {
    console.error('[contentLibrary] persist failed:', err.message);
    throw err;
  }
}

async function add({ imageKey, imageUrl, realPrompt }) {
  const id = crypto.randomBytes(8).toString('hex');
  const entry = {
    id,
    imageKey,
    imageUrl,
    realPrompt,
    active: true,
    uploadedAt: Date.now(),
  };
  items.set(id, entry);
  await persist();
  return entry;
}

async function remove(id) {
  const ok = items.delete(id);
  if (ok) await persist();
  return ok;
}

async function setActive(id, active) {
  const e = items.get(id);
  if (!e) return false;
  e.active = !!active;
  await persist();
  return true;
}

function list() {
  return Array.from(items.values()).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

function pickUnused(usedIds) {
  const used = new Set(usedIds || []);
  const candidates = list().filter((e) => e.active && !used.has(e.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function size() {
  return items.size;
}

module.exports = { init, add, remove, setActive, list, pickUnused, size };
