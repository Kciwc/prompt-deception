const { BLUFF_MIN_CHARS, MAX_CONSECUTIVE_EMOJI } = require('../config');

// Unicode emoji regex (simplified but effective)
const EMOJI_RE =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu;

function sanitizeBluff(text) {
  if (typeof text !== 'string') {
    return { valid: false, error: "Nice try, smartypants. That's not even text." };
  }

  // Trim whitespace
  let cleaned = text.trim();

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Limit consecutive emoji
  const emojiMatches = cleaned.match(EMOJI_RE) || [];
  let consecutiveCount = 0;
  let maxConsecutive = 0;
  let lastIndex = -2;

  for (const match of cleaned.matchAll(EMOJI_RE)) {
    if (match.index === lastIndex + 1 || match.index === lastIndex + 2) {
      consecutiveCount++;
    } else {
      consecutiveCount = 1;
    }
    maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
    lastIndex = match.index;
  }

  if (maxConsecutive > MAX_CONSECUTIVE_EMOJI) {
    return {
      valid: false,
      error: `Whoa there, emoji Picasso. Max ${MAX_CONSECUTIVE_EMOJI} in a row.`,
    };
  }

  // Count visible characters (non-whitespace, non-emoji)
  const visibleChars = cleaned.replace(EMOJI_RE, '').replace(/\s/g, '');
  if (visibleChars.length < BLUFF_MIN_CHARS) {
    return {
      valid: false,
      error: `Your bluff needs at least ${BLUFF_MIN_CHARS} actual characters. Try harder.`,
    };
  }

  // Cap total length
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 200);
  }

  return { valid: true, text: cleaned };
}

module.exports = { sanitizeBluff };
