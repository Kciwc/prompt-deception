import { socket } from '../lib/socket';
import './GameSettings.css';

// Phase durations per speed (mirror of server SPEED_DURATIONS, in seconds).
const SPEED = {
  quick:    { p1: 90,  p2: 45,  p3: 30, podium: 45 },
  standard: { p1: 180, p2: 90,  p3: 30, podium: 60 },
  long:     { p1: 300, p2: 180, p3: 30, podium: 90 },
};

const ROUND_OPTIONS = [3, 5, 7];
const SPEED_OPTIONS = [
  { id: 'quick',    label: 'Quick' },
  { id: 'standard', label: 'Standard' },
  { id: 'long',     label: 'Long' },
];

export function GameSettings({ room, compact = false }) {
  if (!room) return null;
  const editable = room.status === 'lobby';
  const cfg = room.config;

  function patch(p) {
    if (!editable) return;
    socket.emit('host:configure', p);
  }

  const est = estimatedSeconds(cfg);
  return (
    <div className={`game-settings ${compact ? 'compact' : ''}`}>
      <div className="setting-row">
        <span className="setting-label">Rounds</span>
        <div className="seg">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`seg-btn ${cfg.rounds === n ? 'active' : ''}`}
              onClick={() => patch({ rounds: n })}
              disabled={!editable}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-row">
        <span className="setting-label">Speed</span>
        <div className="seg">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`seg-btn ${cfg.speed === s.id ? 'active' : ''}`}
              onClick={() => patch({ speed: s.id })}
              disabled={!editable}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-row">
        <span className="setting-label">Double points</span>
        <div className="seg toggle">
          <button
            type="button"
            className={`seg-btn ${!cfg.doublePoints ? 'active' : ''}`}
            onClick={() => patch({ doublePoints: false })}
            disabled={!editable}
          >Off</button>
          <button
            type="button"
            className={`seg-btn ${cfg.doublePoints ? 'active' : ''}`}
            onClick={() => patch({ doublePoints: true })}
            disabled={!editable}
          >On</button>
        </div>
      </div>

      <div className="setting-row">
        <span className="setting-label">🎤 Trash Talk MVP</span>
        <div className="seg toggle">
          <button
            type="button"
            className={`seg-btn ${!cfg.trashTalkEnabled ? 'active' : ''}`}
            onClick={() => patch({ trashTalkEnabled: false })}
            disabled={!editable}
          >Off</button>
          <button
            type="button"
            className={`seg-btn ${cfg.trashTalkEnabled ? 'active' : ''}`}
            onClick={() => patch({ trashTalkEnabled: true })}
            disabled={!editable}
          >On</button>
        </div>
      </div>

      <div className="setting-row">
        <span className="setting-label" title="Adds a free practice round at the start with extra explanations and Long timers. Doesn't count toward scores.">
          📚 Practice round
        </span>
        <div className="seg toggle">
          <button
            type="button"
            className={`seg-btn ${!cfg.practiceRound ? 'active' : ''}`}
            onClick={() => patch({ practiceRound: false })}
            disabled={!editable}
          >Off</button>
          <button
            type="button"
            className={`seg-btn ${cfg.practiceRound ? 'active' : ''}`}
            onClick={() => patch({ practiceRound: true })}
            disabled={!editable}
          >On</button>
        </div>
      </div>

      <div className="setting-row est-row">
        <span className="setting-label">Estimated time</span>
        <span className="est-value">~{formatDuration(est)}</span>
      </div>

      {!editable && (
        <p className="locked-note">Settings locked — game in progress.</p>
      )}
    </div>
  );
}

function estimatedSeconds(cfg) {
  const s = SPEED[cfg.speed] ?? SPEED.standard;
  const perRound = s.p1 + s.p2 + s.p3;
  let total = cfg.rounds * perRound + s.podium;
  if (cfg.practiceRound) {
    // Practice round always uses Long timings.
    const long = SPEED.long;
    total += long.p1 + long.p2 + long.p3;
  }
  return total;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
