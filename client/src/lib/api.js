import { SERVER_URL } from './socket';

export async function adminFetch(path, { method = 'GET', body, password, isFormData = false } = {}) {
  const headers = { 'x-admin-password': password };
  if (!isFormData && body) headers['content-type'] = 'application/json';
  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'http_' + res.status }));
    throw new Error(err.error ?? 'request_failed');
  }
  return res.json();
}

export function uploadUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${SERVER_URL}${imageUrl}`;
}
