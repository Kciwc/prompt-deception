import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { saveHostToken, loadHostToken } from '../lib/hostToken';
import { useRoomState } from '../hooks/useRoomState';
import { PhaseTimer } from '../components/PhaseTimer';
import { HostControls } from '../components/HostControls';
import './HostRemote.css';

export default function HostRemote() {
  const [params] = useSearchParams();
  const code = params.get('code')?.toUpperCase();
  const tokenFromUrl = params.get('token');
  const nav = useNavigate();
  const room = useRoomState();
  const [attached, setAttached] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!code) {
      setErr('No room code in URL.');
      return;
    }
    // If a token is in the URL (from the pairing QR), persist it.
    if (tokenFromUrl) saveHostToken(code, tokenFromUrl);
    const token = loadHostToken(code);
    if (!token) {
      setErr('No host token. Open this URL via the pairing QR on the TV.');
      return;
    }

    function attach() {
      socket.emit('host-remote:attach', { code, hostToken: token }, (res) => {
        if (res?.ok) setAttached(true);
        else setErr(`Could not pair: ${res?.error ?? 'unknown'}`);
      });
    }
    if (socket.connected) attach();
    else socket.once('connect', attach);
  }, [code, tokenFromUrl]);

  if (err) {
    return (
      <main className="remote-shell error">
        <h1>{err}</h1>
        <button onClick={() => nav('/')}>Home</button>
      </main>
    );
  }

  if (!attached || !room) {
    return <main className="remote-shell"><h1>Pairing…</h1></main>;
  }

  return (
    <main className="remote-shell">
      <header>
        <span className="room-tag">Room {code}</span>
        <span className="role-tag">📺 Host Remote</span>
      </header>

      <section className="phase-info">
        <h2>{phaseLabel(room)}</h2>
        {room.phaseDeadlineMs && (
          <PhaseTimer
            deadlineMs={room.phaseDeadlineMs}
            paused={room.paused}
            pausedRemainingMs={room.pausedRemainingMs}
            size="lg"
          />
        )}
      </section>

      <section className="counts">
        {room.teams.map((t) => (
          <div key={t.slot} className={`pill tv-team-${t.color}`}>
            <span>{t.name}</span>
            <strong>{t.score}</strong>
          </div>
        ))}
      </section>

      <HostControls room={room} />
    </main>
  );
}

function phaseLabel(room) {
  if (room.status === 'lobby') return 'Lobby';
  if (room.status === 'finished') return 'Game over';
  return ({
    1: 'Phase 1 — Bluffs',
    2: 'Phase 2 — Team vote',
    3: 'Phase 3 — Main vote',
    4: 'Phase 4 — Reveal',
    5: 'Phase 5 — Podium',
  })[room.phase] ?? `Phase ${room.phase}`;
}
