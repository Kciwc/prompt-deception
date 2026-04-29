import { useEffect } from 'react';
import { socket } from '../lib/socket';
import './HostControls.css';

export function HostControls({ room }) {
  const inLobby = room.status === 'lobby';
  const playing = room.status === 'playing';
  const finished = room.status === 'finished';

  const connected = room.players.filter((p) => p.isConnected);
  const allReady = connected.length > 0 && connected.every((p) => p.ready);
  const canStart = inLobby && allReady;

  useEffect(() => {
    function onKey(e) {
      // Don't intercept if user is typing somewhere.
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (inLobby && (e.key === 'Enter' || e.key === ' ') && canStart) {
        e.preventDefault();
        socket.emit('host:start-game');
      } else if (playing) {
        if (e.key === ' ') {
          e.preventDefault();
          socket.emit(room.paused ? 'host:resume' : 'host:pause');
        } else if (e.key === 'ArrowRight') {
          socket.emit('host:add-seconds', { seconds: 15 });
        } else if (e.key.toLowerCase() === 't') {
          socket.emit('host:trash-round');
        } else if (e.key.toLowerCase() === 'u') {
          socket.emit('host:undo-phase');
        }
      } else if (finished && (e.key === 'Enter' || e.key === ' ')) {
        // Currently no "new game from podium" action.
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inLobby, playing, finished, room.paused, canStart]);

  if (inLobby) {
    return (
      <div className="host-controls">
        <button
          className="primary big"
          disabled={!canStart}
          onClick={() => socket.emit('host:start-game')}
        >
          {connected.length === 0
            ? 'Waiting for players…'
            : !allReady
              ? `${connected.filter((p) => p.ready).length}/${connected.length} ready`
              : 'Start Game'}
        </button>
        <span className="kbd-hint">Space / Enter</span>
      </div>
    );
  }

  if (playing) {
    return (
      <div className="host-controls">
        <button onClick={() => socket.emit(room.paused ? 'host:resume' : 'host:pause')}>
          {room.paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={() => socket.emit('host:add-seconds', { seconds: 15 })}>+15s</button>
        <button onClick={() => socket.emit('host:trash-round')} className="warn">
          Trash Round
        </button>
        <button onClick={() => socket.emit('host:undo-phase')}>Undo Phase</button>
        <button onClick={() => socket.emit('host:end-game')} className="danger">
          End Game
        </button>
        <span className="kbd-hint">Space pause · → +15s · T trash · U undo</span>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="host-controls">
        <span className="finished-label">Game over.</span>
      </div>
    );
  }

  return null;
}
