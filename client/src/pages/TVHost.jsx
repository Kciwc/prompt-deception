import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { loadHostToken } from '../lib/hostToken';
import { useRoomState } from '../hooks/useRoomState';
import { QRBlock } from '../components/QRBlock';
import { PhaseTimer } from '../components/PhaseTimer';
import { HostControls } from '../components/HostControls';
import './TVHost.css';

const PHASE_LABELS = {
  0: 'Lobby',
  1: 'Phase 1 — Write your bluff',
  2: 'Phase 2 — Pick your team\'s entry',
  3: 'Phase 3 — Spot the real prompt',
  4: 'Phase 4 — Reveal',
  5: 'Phase 5 — Podium',
};

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
  const inLobby = room.status === 'lobby';
  const playing = room.status === 'playing';
  const finished = room.status === 'finished';

  return (
    <div className="tv-shell">
      <header className="tv-header">
        <h1 className="brand">Ceyon's Super Spiffy Trivia</h1>
        <div className="tv-room-meta">
          {playing
            ? `Round ${Math.max(1, room.completedNonTrashed)} of ${room.config.rounds}`
            : `${room.config.rounds} rounds · ${room.isPublic ? 'public' : 'private'}`}
        </div>
      </header>

      {inLobby && (
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
      )}

      {playing && (
        <section className="tv-play">
          <div className="tv-phase-header">
            <h2>{PHASE_LABELS[room.phase]}</h2>
            <PhaseTimer
              deadlineMs={room.phaseDeadlineMs}
              paused={room.paused}
              pausedRemainingMs={room.pausedRemainingMs}
              size="lg"
            />
          </div>

          <div className="tv-image-slot">
            <div className="tv-placeholder">
              {room.phase === 1 && '🖼  Image placeholder — content lands in step 4'}
              {room.phase === 2 && '🤐  Teams are voting on their bluffs'}
              {room.phase === 3 && '🤔  Pick the real prompt on your phone'}
              {room.phase === 4 && '🎉  Reveal — watch the screen'}
              {room.phase === 5 && '🏆  Final podium coming in step 5'}
            </div>
          </div>

          <div className="tv-team-strip">
            {room.teams.map((team) => (
              <div key={team.slot} className={`tv-team-pill tv-team-${team.color}`}>
                <span className="tname">{team.name}</span>
                <span className="tscore">{team.score}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {finished && (
        <section className="tv-play">
          <div className="tv-phase-header">
            <h2>That's a wrap.</h2>
          </div>
          <div className="tv-image-slot">
            <div className="tv-placeholder">🏆 Hall of Fame ships in step 5</div>
          </div>
        </section>
      )}

      <footer className="tv-footer">
        <HostControls room={room} />
      </footer>
    </div>
  );
}
