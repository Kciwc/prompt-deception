import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { getOrCreatePlayerId } from '../lib/playerId';
import { useRoomState } from '../hooks/useRoomState';
import { TeamBucket } from '../components/TeamBucket';
import './PlayerRoom.css';

const NAME_KEY = 'pd:lastName';

export default function PlayerRoom() {
  const { code: rawCode } = useParams();
  const code = rawCode?.toUpperCase();
  const nav = useNavigate();
  const room = useRoomState();

  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function submitName(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setErr('Pick a name.');
      return;
    }
    setBusy(true);
    setErr('');
    const playerId = getOrCreatePlayerId();
    const doJoin = () =>
      socket.emit('room:join', { code, playerId, name: trimmed }, (res) => {
        setBusy(false);
        if (res?.ok) {
          localStorage.setItem(NAME_KEY, trimmed);
          setJoined(true);
        } else {
          setErr(errorMessage(res?.error));
        }
      });
    if (socket.connected) doJoin();
    else socket.once('connect', doJoin);
  }

  // Auto re-join on reconnect.
  useEffect(() => {
    if (!joined) return;
    const onConnect = () => {
      const playerId = getOrCreatePlayerId();
      socket.emit('room:join', { code, playerId, name: name.trim() });
    };
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, [joined, code, name]);

  function pickTeam(slot) {
    socket.emit('room:team-switch', { teamSlot: slot });
  }

  function toggleReady() {
    if (!room) return;
    const me = room.players.find((p) => p.isMe);
    socket.emit('room:ready', { ready: !(me?.ready) });
  }

  if (!joined) {
    return (
      <main className="player-shell">
        <h1 className="room-code">Room <span>{code}</span></h1>
        <form onSubmit={submitName} className="name-form">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="e.g. Ceyon"
            autoComplete="off"
            spellCheck="false"
            autoFocus
          />
          <button type="submit" disabled={busy}>{busy ? 'Joining…' : 'Join Game'}</button>
          {err && <p className="err">{err}</p>}
          <button
            type="button"
            className="link-btn"
            onClick={() => nav('/')}
          >
            ← Back to lobby browser
          </button>
        </form>
      </main>
    );
  }

  if (!room) {
    return <main className="player-shell"><p>Loading room…</p></main>;
  }

  const me = room.players.find((p) => p.isMe);
  const myColor = me ? room.teams.find((t) => t.slot === me.teamSlot)?.color : null;

  return (
    <main className={`player-shell themed theme-${myColor ?? 'neutral'}`}>
      <header className="player-header">
        <span className="room-tag">Room {code}</span>
        {me && <span className="my-name">{me.name}</span>}
      </header>

      <h2 className="prompt">Pick your team</h2>
      <div className="bucket-row">
        {room.teams.map((team) => {
          const players = room.players.filter((p) => p.teamSlot === team.slot && p.isConnected);
          return (
            <TeamBucket
              key={team.slot}
              team={team}
              players={players}
              onPick={() => pickTeam(team.slot)}
              isPicked={me?.teamSlot === team.slot}
              disabled={room.status !== 'lobby'}
            />
          );
        })}
      </div>

      <button
        className={`ready-btn ${me?.ready ? 'is-ready' : ''}`}
        onClick={toggleReady}
        disabled={!me || room.status !== 'lobby'}
      >
        {me?.ready ? "Ready! (tap to unready)" : "Tap when you're ready"}
      </button>

      <p className="hint">Waiting on the host to start. Switch teams freely until then.</p>
    </main>
  );
}

function errorMessage(code) {
  switch (code) {
    case 'room_not_found': return "That room doesn't exist (or already finished).";
    case 'game_in_progress': return 'That game is already in progress.';
    case 'bad_name': return 'Pick a real name with at least one visible character.';
    case 'bad_player_id': return 'Player ID was rejected. Try refreshing.';
    default: return 'Could not join. Try again?';
  }
}
