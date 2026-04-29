import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { getOrCreatePlayerId } from '../lib/playerId';
import { useRoomState } from '../hooks/useRoomState';
import { TeamBucket } from '../components/TeamBucket';
import { PhaseTimer } from '../components/PhaseTimer';
import {
  Phase1BluffInput,
  Phase2IntraVote,
  Phase3MainVote,
  Phase4Feedback,
} from '../components/PhaseInputs';
import { useWakeLock } from '../hooks/useWakeLock';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import { usePhaseAudio } from '../hooks/usePhaseAudio';
import { PlayerMuteToggle } from '../components/AudioControls';
import { uploadUrl } from '../lib/api';
import './PlayerRoom.css';

const NAME_KEY = 'pd:lastName';

const PHASE_TITLES = {
  1: 'Write a bluff',
  2: 'Vote on your team',
  3: 'Spot the real prompt',
  4: 'Reveal',
  5: 'Final results',
};

export default function PlayerRoom() {
  const { code: rawCode } = useParams();
  const code = rawCode?.toUpperCase();
  const nav = useNavigate();
  const room = useRoomState();

  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [kicked, setKicked] = useState(false);

  // Keep phone awake during active play. Warn before accidental swipe-back.
  useWakeLock(joined && room?.status === 'playing');
  useBeforeUnload(joined && room?.status === 'playing');
  usePhaseAudio(joined ? room : null);

  // Haptic vibration + a small visual cue when a teammate nudges.
  const [nudgeFlash, setNudgeFlash] = useState(null);
  useEffect(() => {
    if (!joined) return;
    function onNudge({ fromName }) {
      if (typeof navigator?.vibrate === 'function') navigator.vibrate([120, 60, 120]);
      setNudgeFlash(fromName ?? 'A teammate');
      setTimeout(() => setNudgeFlash(null), 1600);
    }
    socket.on('nudge:receive', onNudge);
    return () => socket.off('nudge:receive', onNudge);
  }, [joined]);

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

  useEffect(() => {
    if (!joined) return;
    const onConnect = () => {
      const playerId = getOrCreatePlayerId();
      socket.emit('room:join', { code, playerId, name: name.trim() });
    };
    const onKicked = () => setKicked(true);
    socket.on('connect', onConnect);
    socket.on('room:kicked', onKicked);
    return () => {
      socket.off('connect', onConnect);
      socket.off('room:kicked', onKicked);
    };
  }, [joined, code, name]);

  if (kicked) {
    return (
      <main className="player-shell">
        <h1 className="room-code">You were kicked from the room.</h1>
        <button onClick={() => nav('/')}>Back to lobby browser</button>
      </main>
    );
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
          <button type="button" className="link-btn" onClick={() => nav('/')}>
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
      {room.status !== 'lobby' && (
        <div className="pinned-timer">
          <span className="phase-label">{PHASE_TITLES[room.phase] ?? ''}</span>
          <PhaseTimer
            deadlineMs={room.phaseDeadlineMs}
            paused={room.paused}
            pausedRemainingMs={room.pausedRemainingMs}
            size="sm"
          />
        </div>
      )}

      <header className="player-header">
        <span className="room-tag">Room {code}</span>
        <div className="header-right">
          {me && <span className="my-name">{me.name}</span>}
          <PlayerMuteToggle />
        </div>
      </header>

      {nudgeFlash && (
        <div className="nudge-flash">👀 {nudgeFlash} is nudging you!</div>
      )}

      {room.status === 'lobby' && <LobbyView room={room} me={me} />}
      {room.status === 'playing' && <PlayingView room={room} me={me} />}
      {room.status === 'finished' && <FinishedView room={room} />}
    </main>
  );
}

function LobbyView({ room, me }) {
  function pickTeam(slot) {
    socket.emit('room:team-switch', { teamSlot: slot });
  }
  function toggleReady() {
    socket.emit('room:ready', { ready: !(me?.ready) });
  }

  return (
    <>
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
              disabled={false}
            />
          );
        })}
      </div>

      <button
        className={`ready-btn ${me?.ready ? 'is-ready' : ''}`}
        onClick={toggleReady}
        disabled={!me}
      >
        {me?.ready ? "Ready! (tap to unready)" : "Tap when you're ready"}
      </button>

      <p className="hint">Switch teams freely until the host hits start.</p>
    </>
  );
}

function PlayingView({ room, me }) {
  const round = room.currentRound;
  const myTeamSlot = me?.teamSlot;
  if (!round) return <p className="hint">Loading round…</p>;

  return (
    <>
      {round.imageUrl && (
        <div className="round-image">
          <img src={uploadUrl(round.imageUrl)} alt="" />
        </div>
      )}
      {room.paused && <p className="paused-tag">⏸ Game paused by host</p>}
      {room.phase === 1 && <Phase1BluffInput round={round} />}
      {room.phase === 2 && <Phase2IntraVote round={round} />}
      {room.phase === 3 && <Phase3MainVote round={round} myTeamSlot={myTeamSlot} />}
      {room.phase === 4 && <Phase4Feedback round={round} room={room} />}
      {room.phase === 5 && (
        <section className="phase-shell">
          <h2>Final results on the TV.</h2>
        </section>
      )}
    </>
  );
}

function FinishedView({ room }) {
  const ranked = [...room.teams].sort((a, b) => b.score - a.score);
  return (
    <section className="phase-shell">
      <h2>That's a wrap!</h2>
      <ul className="final-scores">
        {ranked.map((t, i) => (
          <li key={t.slot} className={`team-${t.color}`}>
            <span className="rank">#{i + 1}</span>
            <span className="name">{t.name}</span>
            <span className="score">{t.score}</span>
          </li>
        ))}
      </ul>
    </section>
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
