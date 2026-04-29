import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { saveHostToken } from '../lib/hostToken';
import './LobbyBrowser.css';

export default function LobbyBrowser() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  // QR-scan auto-route: ?room=XXXX → straight to player room.
  useEffect(() => {
    const code = params.get('room');
    if (code) nav(`/room/${code.toUpperCase()}`, { replace: true });
  }, [params, nav]);

  const [publicLobbies, setPublicLobbies] = useState([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    socket.emit('lobby:browse');
    const onList = (list) => setPublicLobbies(list);
    socket.on('lobby:list', onList);
    return () => socket.off('lobby:list', onList);
  }, []);

  function createLobby(isPublic) {
    setBusy(true);
    setErr('');
    socket.emit('lobby:create', { isPublic, rounds: 5 }, (res) => {
      setBusy(false);
      if (!res?.ok) {
        setErr('Could not create lobby. Try again?');
        return;
      }
      saveHostToken(res.code, res.hostToken);
      nav(`/screen?code=${res.code}`);
    });
  }

  function joinByCode(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 4) {
      setErr('Codes are 4 characters.');
      return;
    }
    nav(`/room/${c}`);
  }

  return (
    <main className="lobby-shell">
      <h1 className="brand">Ceyon's Super Spiffy Trivia</h1>
      <p className="tagline">Bluff your way past your friends. AI never lies — your group does.</p>

      <section className="primary-actions">
        <button className="btn-create" disabled={busy} onClick={() => createLobby(false)}>
          {busy ? 'Creating…' : 'Create New Lobby'}
        </button>
        <label className="public-toggle">
          <input type="checkbox" id="public-create" />
          <span>Or </span>
          <button
            type="button"
            className="btn-public"
            disabled={busy}
            onClick={() => createLobby(true)}
          >
            create &amp; list publicly
          </button>
        </label>
      </section>

      <form className="join-form" onSubmit={joinByCode}>
        <label htmlFor="code-input">Have a code?</label>
        <div className="join-row">
          <input
            id="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            autoComplete="off"
            spellCheck="false"
            maxLength={4}
          />
          <button type="submit">Join</button>
        </div>
      </form>

      {err && <p className="err">{err}</p>}

      <section className="public-list">
        <h2>Public Lobbies</h2>
        {publicLobbies.length === 0 ? (
          <p className="empty">No public lobbies right now. Yours could be the first.</p>
        ) : (
          <ul>
            {publicLobbies.map((l) => (
              <li key={l.code}>
                <span className="code">{l.code}</span>
                <span className="meta">{l.playerCount} player{l.playerCount === 1 ? '' : 's'} · {l.rounds} rounds</span>
                <button onClick={() => nav(`/room/${l.code}`)}>Join</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
