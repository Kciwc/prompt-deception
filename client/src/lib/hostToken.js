// Per-room host token storage. The TV (lobby creator) keeps a token so
// it can re-attach after a refresh.

const key = (code) => `pd:hostToken:${code}`;

export function saveHostToken(code, token) {
  localStorage.setItem(key(code), token);
}

export function loadHostToken(code) {
  return localStorage.getItem(key(code));
}

export function clearHostToken(code) {
  localStorage.removeItem(key(code));
}
