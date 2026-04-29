const crypto = require('crypto');
const { hostSecret } = require('../config');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8h: long enough for a long party

function sign(payload) {
  return crypto.createHmac('sha256', hostSecret).update(payload).digest('base64url');
}

function issueHostToken(roomCode) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${roomCode}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyHostToken(token, roomCode) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [code, expiresAtStr, sig] = parts;
  if (code !== roomCode) return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(`${code}.${expiresAtStr}`);
  // Constant-time compare
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = { issueHostToken, verifyHostToken };
