// Sanitization shared between mid-game prompts and join-time names.
// Mirrored on the client; the server's word is final.

const MAX_NAME_LEN = 24;
const MAX_BLUFF_LEN = 200;
const MIN_BLUFF_VISIBLE = 5;

function collapseWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// Limit consecutive identical chars (incl. emoji) to 3 in a row.
function limitRepeats(s, n = 3) {
  // Use array-of-codepoints to handle emoji correctly (don't split surrogate pairs).
  const cps = Array.from(s);
  const out = [];
  let last = '';
  let run = 0;
  for (const c of cps) {
    if (c === last) {
      run++;
      if (run > n) continue;
    } else {
      run = 1;
      last = c;
    }
    out.push(c);
  }
  return out.join('');
}

function visibleLength(s) {
  // Strip whitespace and zero-width chars before counting.
  return Array.from(s.replace(/[\s​-‍﻿]/g, '')).length;
}

function sanitizeName(input) {
  if (typeof input !== 'string') return null;
  const cleaned = limitRepeats(collapseWhitespace(input), 3).slice(0, MAX_NAME_LEN);
  if (visibleLength(cleaned) < 1) return null;
  return cleaned;
}

function sanitizeBluff(input) {
  if (typeof input !== 'string') return null;
  const cleaned = limitRepeats(collapseWhitespace(input), 3).slice(0, MAX_BLUFF_LEN);
  if (visibleLength(cleaned) < MIN_BLUFF_VISIBLE) return null;
  return cleaned;
}

module.exports = {
  sanitizeName,
  sanitizeBluff,
  MAX_NAME_LEN,
  MAX_BLUFF_LEN,
  MIN_BLUFF_VISIBLE,
};
