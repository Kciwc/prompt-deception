import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { loadHostToken } from '../lib/hostToken';
import { useRoomState } from '../hooks/useRoomState';
import { QRBlock } from '../components/QRBlock';
import './TVHost.css';

export default function TVHost() {
  const [params] = useSearchParams();
  const code = params.get('code')?.toUpperCase();
  const [attached, setAttached] = useState(false);
  const [err, setErr] = useState('');
  const room = useRoomState();

  useEffect(() => {
    if (!code) {
      setErr('No room code in URL.');
      return;
    }
    const tryAttach = () => {
      const token = loadHostToken(code);
      if (!token) {
        setErr('No host token for this room. Create the lobby from this device first.');
        return;
      }
      socket.emit('host:attach', { code, hostToken: token }, (res) => {
        if (res?.ok) setAttached(true);
        else setErr(`Could not attach as host: ${res?.error ?? 'unknown'}`);
      });
    };
    if (socket.connected) tryAttach();
    else socket.once('connect', tryAttach);
  }, [code]);

  const joinUrl = useMemo(() => {
    if (!code) return '';
    return `${window.location.origin}/?room=${code}`;
  }, [code]);

  if (err) return <div className="tv-shell error"><h1>{err}</h1></div>;
  if (!attached || !room) return <div className="tv-shell"><h1>Connecting…</h1></div>;

  const playersByTeam = (slot) => room.players.filter((p) => p.teamSlot === slot && p.isConnected);
  const readyCount = room.players.filter((p) => p.isConnected && p.ready).length;
  const totalConnected = room.players.filter((p) => p.isConnected).length;
  const readyPct = totalConnected === 0 ? 0 : Math.round((readyCount / totalConnected) * 100);

  return (
    <div className="tv-shell">
      <header className="tv-header">
        <h1 className="brand">Ceyon's Super Spiffy Trivia</h1>
        <div className="tv-room-meta">
          {room.config.rounds} rounds · {room.isPublic ? 'public' : 'private'} lobby
        </div>
      </header>

      <section className="tv-main">
        <div className="tv-qr">
          <QRBlock url={joinUrl} code={code} />
          <p className="tv-qr-hint">Scan or visit <span>{joinUrl}</span></p>
        </div>

        <div className="tv-teams">
          {room.teams.map((team) => {
            const players = playersByTeam(team.slot);
            return (
              <div key={team.slot} className={`tv-team tv-team-${team.color}`}>
                <h2>{team.name}</h2>
                <ul>
                  {players.map((p) => (
                    <li key={p.id} className={p.ready ? 'ready' : ''}>
                      {p.name}{p.ready && ' ✓'}
                    </li>
                  ))}
                  {players.length === 0 && <li className="empty">— waiting —</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="tv-footer">
        <div className="ready-bar">
          <div className="ready-bar-fill" style={{ width: `${readyPct}%` }} />
        </div>
        <div className="ready-meta">
          {totalConnected === 0 ? 'Waiting for players…' : `${readyCount}/${totalConnected} ready`}
        </div>
      </footer>
    </div>
  );
}
