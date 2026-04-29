import { useEffect, useState } from 'react';
import { adminFetch, uploadUrl } from '../lib/api';
import './Admin.css';

function prettyError(code) {
  switch (code) {
    case 'file_too_large': return 'Image is too big. Max 20 MB — try exporting at lower resolution.';
    case 'no_file': return 'Pick an image to upload.';
    case 'prompt_too_short': return 'Prompt needs at least 5 characters.';
    case 'prompt_too_long': return 'Prompt is too long (500 char max).';
    case 'unauthorized': return 'Wrong admin password.';
    case 'upload_failed': return 'Upload failed on the server. Check Railway logs.';
    case 'upload_rejected': return 'Server rejected the upload — try a different file.';
    default: return code ?? 'Something went wrong.';
  }
}

const PW_KEY = 'pd:adminPw';

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(PW_KEY) ?? '');
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function tryLogin(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await adminFetch('/admin/list', { password });
      sessionStorage.setItem(PW_KEY, password);
      setItems(data.items);
      setAuthed(true);
    } catch (err) {
      setError(err.message === 'unauthorized' ? 'Wrong password.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const data = await adminFetch('/admin/list', { password });
    setItems(data.items);
  }

  async function handleUpload(e) {
    e.preventDefault();
    setError('');
    const form = new FormData(e.target);
    const file = form.get('image');
    const realPrompt = form.get('realPrompt');
    if (!file || !realPrompt) return;

    setBusy(true);
    try {
      await adminFetch('/admin/upload', {
        method: 'POST',
        body: form,
        password,
        isFormData: true,
      });
      e.target.reset();
      await refresh();
    } catch (err) {
      setError(prettyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return;
    setBusy(true);
    try {
      await adminFetch(`/admin/${id}`, { method: 'DELETE', password });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (password && !authed) {
      // Auto-attempt login if we have a saved password.
      tryLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <form onSubmit={tryLogin} className="admin-login">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          {error && <p className="err">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <h1>Admin — Content Library</h1>
        <button
          className="link-btn"
          onClick={() => {
            sessionStorage.removeItem(PW_KEY);
            setAuthed(false);
          }}
        >
          Sign out
        </button>
      </header>

      <section className="admin-upload">
        <h2>Upload</h2>
        <form onSubmit={handleUpload}>
          <label>
            Image
            <input type="file" name="image" accept="image/*" required />
          </label>
          <label>
            Real prompt (the truth)
            <textarea
              name="realPrompt"
              rows={3}
              maxLength={500}
              placeholder="e.g. A platypus playing chess in a Parisian café"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Uploading…' : 'Add to library'}
          </button>
          {error && <p className="err">{error}</p>}
        </form>
      </section>

      <section className="admin-list">
        <h2>Library ({items.length})</h2>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
            <h3>Library is empty</h3>
            <p>Upload an image and a real prompt above to add a round.</p>
          </div>
        ) : (
          <ul>
            {items.map((it) => (
              <li key={it.id}>
                <img src={uploadUrl(it.imageUrl)} alt="" />
                <div className="meta">
                  <p className="prompt">{it.realPrompt}</p>
                  <p className="muted">
                    {new Date(it.uploadedAt).toLocaleString()} · {it.active ? 'active' : 'inactive'}
                  </p>
                </div>
                <button className="danger" onClick={() => handleDelete(it.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="footnote muted">
        Step 5 swaps this in-memory store for Postgres + Cloudflare R2.
      </p>
    </main>
  );
}
