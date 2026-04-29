// In-memory content library for step 4. Swaps to Prisma + R2 in step 5.
//
// Each entry: { id, imageKey, imageUrl, realPrompt, active, uploadedAt }
//   imageKey  — file name on disk (under server/uploads/)
//   imageUrl  — public URL the client renders (e.g. /uploads/xxx.webp)

const crypto = require('crypto');

const items = new Map(); // id -> entry

function add({ imageKey, imageUrl, realPrompt }) {
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
  return entry;
}

function remove(id) {
  return items.delete(id);
}

function list() {
  return Array.from(items.values()).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

function setActive(id, active) {
  const e = items.get(id);
  if (!e) return false;
  e.active = !!active;
  return true;
}

// Pick a random active entry not in usedIds. Returns null if none available.
function pickUnused(usedIds) {
  const used = new Set(usedIds || []);
  const candidates = list().filter((e) => e.active && !used.has(e.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function size() {
  return items.size;
}

module.exports = { add, remove, list, setActive, pickUnused, size };
