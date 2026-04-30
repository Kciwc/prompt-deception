import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, X as XIcon, Mic, RotateCcw, BookOpen } from 'lucide-react';
import { socket } from '../lib/socket';
import { loadHostToken } from '../lib/hostToken';
import { useRoomState } from '../hooks/useRoomState';
import { QRBlock } from '../components/QRBlock';
import { PhaseTimer } from '../components/PhaseTimer';
import { HostControls } from '../components/HostControls';
import { RevealPanel } from '../components/RevealPanel';
import { HostAudioControls } from '../components/AudioControls';
import { GameSettings } from '../components/GameSettings';
import { TeamScorePill } from '../components/TeamScorePill';
import { TVSkeleton } from '../components/Skeleton';
import { PhaseWipe } from '../components/PhaseWipe';
import { Podium } from '../components/Podium';
import { RulesOverlay } from '../components/RulesOverlay';
import { useRoomToasts } from '../components/Toast';
import { useWakeLock } from '../hooks/useWakeLock';
import { usePhaseAudio } from '../hooks/usePhaseAudio';
import { usePhaseTint } from '../hooks/usePhaseTint';
import { uploadUrl } from '../lib/api';
import './TVHost.css';

const PHASE_LABELS = {
  0: 'Lobby',
  1: 'Bluff & vote — your team',
  2: 'Spot the real prompt',
  3: 'Reveal',
  4: 'Podium',
};

export default function TVHost() {
  const [params] = useSearchParams();
  const code = params.get('code')?.toUpperCase();
  const [attached, setAttached] = useState(false);
  const [err, setErr] = useState('');
  const room = useRoomState();

  useWakeLock(attached);
  usePhaseAudio(room);
  usePhaseTint(room);
  useRoomToasts(room);

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

  const remoteUrl = useMemo(() => {
    if (!code) return '';
    const token = loadHostToken(code);
    if (!token) return '';
    return `${window.location.origin}/screen/remote?code=${code}&token=${encodeURIComponent(token)}`;
  }, [code, attached]);

  const [showPairing, setShowPairing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // playerId of the player whose action menu is open, or null
  const [openMenuFor, setOpenMenuFor] = useState(null);

  function kickPlayer(playerId, name) {
    if (!confirm(`Kick ${name}?`)) return;
    socket.emit('host:kick-player', { playerId });
    setOpenMenuFor(null);
  }
  function movePlayer(playerId, teamSlot) {
    socket.emit('host:move-player', { playerId, teamSlot });
    setOpenMenuFor(null);
  }

  // Close menu on Escape or click outside.
  useEffect(() => {
    if (!openMenuFor) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenuFor(null); };
    const onClickAway = (e) => {
      if (!e.target.closest?.('.player-pill, .player-menu')) setOpenMenuFor(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClickAway);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClickAway);
    };
  }, [openMenuFor]);

  if (err) return <div className="tv-shell error"><h1>{err}</h1></div>;
  if (!attached || !room) return <div className="tv-shell"><TVSkeleton /></div>;

  const playersByTeam = (slot) => room.players.filter((p) => p.teamSlot === slot && p.isConnected);
  const inLobby = room.status === 'lobby';
  const playing = room.status === 'playing';
  const finished = room.status === 'finished';

  return (
    <div className="tv-shell">
      <PhaseWipe room={room} />
      <header className="tv-header">
        <h1 className="brand display-font">Ceyon's Super Spiffy Trivia</h1>
        <div className="tv-room-meta">
          {playing
            ? (room.currentRound?.isPractice
                ? <span className="practice-badge">📚 Practice round</span>
                : `Round ${Math.max(1, room.completedNonTrashed)} of ${room.config.rounds}`)
            : `${room.config.rounds} rounds · ${room.isPublic ? 'public' : 'private'}`}
        </div>
      </header>

      {inLobby && (
        <section className="tv-main tv-lobby-grid">
          <div className="tv-qr">
            <QRBlock url={joinUrl} code={code} />
            <p className="tv-qr-hint">Scan or visit <span>{joinUrl}</span></p>
            <GameSettings room={room} />
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
                        <button
                          type="button"
                          className="player-pill"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuFor(openMenuFor === p.id ? null : p.id);
                          }}
                          title="Manage player"
                        >
                          <span>{p.name}{p.ready && ' ✓'}</span>
                        </button>
                        {openMenuFor === p.id && (
                          <div className="player-menu" onClick={(e) => e.stopPropagation()}>
                            <div className="player-menu-label">Move to:</div>
                            <div className="player-menu-row">
                              {room.teams.map((other) => (
                                <button
                                  key={other.slot}
                                  type="button"
                                  className={`move-btn move-${other.color}`}
                                  disabled={other.slot === p.teamSlot}
                                  onClick={() => movePlayer(p.id, other.slot)}
                                >
                                  {other.name}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="kick-action"
                              onClick={() => kickPlayer(p.id, p.name)}
                            >
                              <XIcon size={14} strokeWidth={3} /> Kick
                            </button>
                          </div>
                        )}
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

          <div className="tv-content-grid">
            <div className="tv-image-slot">
              {room.currentRound?.imageUrl ? (
                <img src={uploadUrl(room.currentRound.imageUrl)} alt="" />
              ) : (
                <div className="tv-placeholder">
                  No image yet — upload some at <code>/admin</code>
                </div>
              )}
            </div>
            <div className="tv-side">
              {room.phase === 1 && <Phase1Panel room={room} />}
              {room.phase === 2 && <CandidatesPanel room={room} />}
              {room.phase === 3 && (
                <div className="tv-side-stack">
                  <RevealPanel room={room} />
                  {room.config.trashTalkEnabled && (
                    <TrashTalkRoundPanel room={room} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="tv-team-strip">
            {room.teams.map((team) => (
              <TeamScorePill key={team.slot} team={team} />
            ))}
            {room.config.trashTalkEnabled && room.trashTalkLeaderboard?.length > 0 && (
              <CumulativeTrashPill leaderboard={room.trashTalkLeaderboard} teams={room.teams} />
            )}
          </div>
        </section>
      )}

      {finished && (
        <section className="tv-play">
          <div className="tv-phase-header">
            <h2 className="display-font">That's a wrap.</h2>
            <button
              className="play-again-btn"
              onClick={() => socket.emit('host:play-again')}
            >
              <RotateCcw size={18} /> Play Again
            </button>
          </div>
          <Podium teams={room.teams} />
          {room.config.trashTalkEnabled && room.trashTalkLeaderboard?.length > 0 && (
            <TrashTalkMVPCallout leaderboard={room.trashTalkLeaderboard} teams={room.teams} />
          )}
        </section>
      )}

      <footer className="tv-footer">
        <HostControls room={room} />
        <div className="tv-footer-row">
          <HostAudioControls />
          <button className="pair-btn" onClick={() => setShowRules(true)}>
            <BookOpen size={16} style={{ marginRight: '0.4em', verticalAlign: '-3px' }} />
            Rules
          </button>
          {remoteUrl && (
            <button className="pair-btn" onClick={() => setShowPairing((s) => !s)}>
              <Smartphone size={16} style={{ marginRight: '0.4em', verticalAlign: '-3px' }} />
              {showPairing ? 'Hide' : 'Pair phone remote'}
            </button>
          )}
        </div>
      </footer>

      <RulesOverlay open={showRules} onClose={() => setShowRules(false)} />

      {showPairing && remoteUrl && (
        <div className="pair-overlay" onClick={() => setShowPairing(false)}>
          <div className="pair-card" onClick={(e) => e.stopPropagation()}>
            <h2>Scan on a phone</h2>
            <p>Pairs that phone as a remote control for this TV.</p>
            <div style={{ background: '#fff', padding: '1rem', borderRadius: 12 }}>
              <QRCodeSVG value={remoteUrl} size={220} level="H" />
            </div>
            <p className="muted">Or open: <code>{remoteUrl.replace(/token=[^&]+/, 'token=…')}</code></p>
            <button onClick={() => setShowPairing(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Phase 1 (write+vote merged): show per-team submission progress and a
// hint about the collaborative experience. We don't show bluff text on the
// TV — it's a public display.
function Phase1Panel({ room }) {
  const round = room.currentRound;
  if (!round) return null;
  const counts = round.submissionCounts ?? { 1: 0, 2: 0, 3: 0 };
  const totalsByTeam = countConnectedByTeam(room);
  return (
    <div className="tv-progress">
      <h3>Bluff & vote</h3>
      <p className="muted">Teammates write together — vote on each other's drafts on your phone.</p>
      <ul>
        {room.teams.map((team) => {
          const got = counts?.[team.slot] ?? 0;
          const total = totalsByTeam[team.slot] ?? 0;
          return (
            <li key={team.slot} className={`tv-team-${team.color}`}>
              <span className="tname">{team.name}</span>
              <span className="count">{got}/{total}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrashTalkRoundPanel({ room }) {
  const round = room.currentRound;
  if (!round?.trashTalk) return null;
  const counts = round.trashTalk.voteCounts ?? {};
  const entries = Object.entries(counts)
    .map(([pid, count]) => {
      const p = room.players.find((x) => x.id === pid);
      return p ? { name: p.name, count, teamSlot: p.teamSlot } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  if (entries.length === 0) {
    return (
      <div className="tv-progress trash-talk-tv">
        <h3><Mic size={18} style={{ verticalAlign: '-3px', marginRight: '0.3em' }} />Trash Talk</h3>
        <p className="muted">Vote for the funniest player on the call.</p>
      </div>
    );
  }
  return (
    <div className="tv-progress trash-talk-tv">
      <h3><Mic size={18} style={{ verticalAlign: '-3px', marginRight: '0.3em' }} />Trash Talk — this round</h3>
      <ul>
        {entries.map((e, i) => (
          <li key={`${e.name}-${i}`}>
            <span className="tname">{e.name}</span>
            <span className="count">
              {e.count} <Mic size={14} style={{ verticalAlign: '-2px' }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CumulativeTrashPill({ leaderboard, teams }) {
  const top = leaderboard[0];
  if (!top || top.votes === 0) return null;
  const color = teams.find((t) => t.slot === top.teamSlot)?.color ?? 'neutral';
  return (
    <div className={`tv-team-pill cumulative-pill tv-team-${color}`} title="Cumulative Trash Talk leader">
      <span className="tname">
        <Mic size={14} style={{ verticalAlign: '-2px', marginRight: '0.3em' }} />
        {top.name}
      </span>
      <span className="tscore">{top.votes}</span>
    </div>
  );
}

function TrashTalkMVPCallout({ leaderboard, teams }) {
  const top = leaderboard[0];
  if (!top || top.votes === 0) return null;
  const winners = leaderboard.filter((e) => e.votes === top.votes);
  return (
    <div className="trash-mvp-callout">
      <div className="trash-mvp-title display-font">
        <Mic size={26} style={{ verticalAlign: '-4px', marginRight: '0.4em' }} />
        Trash Talk MVP
      </div>
      <div className="trash-mvp-winners">
        {winners.map((w) => {
          const color = teams.find((t) => t.slot === w.teamSlot)?.color ?? 'neutral';
          return (
            <span key={w.playerId} className={`mvp-name tv-team-${color}`}>
              {w.name} <span className="mvp-votes">({w.votes})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CandidatesPanel({ room }) {
  const round = room.currentRound;
  const candidates = round?.candidates ?? [];
  return (
    <div className="tv-candidates">
      <h3>Vote on your phone</h3>
      <ol>
        {candidates.map((c, i) => (
          <li key={c.id}>
            <span className="num">{i + 1}.</span>
            <span className="text">"{c.text}"</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function countConnectedByTeam(room) {
  const out = { 1: 0, 2: 0, 3: 0 };
  for (const p of room.players) if (p.isConnected) out[p.teamSlot] = (out[p.teamSlot] ?? 0) + 1;
  return out;
}
