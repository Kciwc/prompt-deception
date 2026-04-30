// Branding manifest — stores the current TV portrait (and could grow to
// hold other branding assets later). Persisted to a single JSON file in
// the storage backend so it survives restarts.

const storage = require('../storage');

const MANIFEST_KEY = 'branding-manifest.json';

let state = {
  portrait: null, // { imageKey, imageUrl, uploadedAt } | null
};
let initialized = false;
let initPromise = null;

async function init() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const m = await storage.getJson(MANIFEST_KEY);
      if (m && typeof m === 'object') {
        state.portrait = m.portrait ?? null;
        if (state.portrait) {
          console.log('[branding] hydrated portrait from manifest');
        }
      }
    } catch (err) {
      console.error('[branding] init failed:', err.message);
    } finally {
      initialized = true;
    }
  })();
  return initPromise;
}

async function persist() {
  try {
    await storage.putJson(MANIFEST_KEY, { version: 1, portrait: state.portrait });
  } catch (err) {
    console.error('[branding] persist failed:', err.message);
    throw err;
  }
}

async function setPortrait({ imageKey, imageUrl }) {
  // Best-effort cleanup of any prior portrait file. Ignore failures —
  // orphaning a few KB in R2 is not worth a hard error.
  const prevKey = state.portrait?.imageKey;
  state.portrait = { imageKey, imageUrl, uploadedAt: Date.now() };
  await persist();
  if (prevKey && prevKey !== imageKey) {
    try { await storage.remove(prevKey); } catch (_) {}
  }
  return state.portrait;
}

async function clearPortrait() {
  const prevKey = state.portrait?.imageKey;
  state.portrait = null;
  await persist();
  if (prevKey) {
    try { await storage.remove(prevKey); } catch (_) {}
  }
}

function getPortrait() {
  return state.portrait;
}

module.exports = { init, setPortrait, clearPortrait, getPortrait };
