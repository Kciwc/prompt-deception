import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import './Toast.css';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((toast) => {
    const id = ++idRef.current;
    const t = {
      id,
      duration: 3000,
      tone: 'info',
      ...(typeof toast === 'string' ? { message: toast } : toast),
    };
    setToasts((prev) => [...prev.slice(-4), t]); // keep at most 5
    if (t.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, t.duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Fallback no-op (e.g. components rendered before provider mounts).
    return { push: () => 0, dismiss: () => {} };
  }
  return ctx;
}

function ToastStack({ toasts, dismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast toast-${t.tone}`}
          onClick={() => dismiss(t.id)}
          type="button"
        >
          {t.icon && <span className="toast-icon" aria-hidden="true">{t.icon}</span>}
          <span className="toast-message">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

// Tracks room state changes and pushes user-visible notifications.
// Mount once near the top of the player tree.
export function useRoomToasts(room) {
  const { push } = useToast();
  const prevRef = useRef(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (!room) { prevRef.current = null; return; }

    if (prev) {
      // Player joined / left
      const prevIds = new Set(prev.players.map((p) => p.id));
      const curIds  = new Set(room.players.map((p) => p.id));
      for (const p of room.players) {
        if (!prevIds.has(p.id) && p.id !== prev.viewer?.playerId) {
          const team = room.teams.find((t) => t.slot === p.teamSlot);
          push({ message: `${p.name} joined ${team?.name ?? ''}`, tone: 'info', duration: 2400 });
        }
      }
      for (const p of prev.players) {
        if (!curIds.has(p.id) && p.id !== prev.viewer?.playerId) {
          push({ message: `${p.name} left`, tone: 'muted', duration: 2200 });
        }
      }

      // Phase transitions
      if (prev.phase !== room.phase && room.status === 'playing') {
        const labels = {
          1: 'Bluff & vote',
          2: 'Spot the real prompt',
          3: 'Reveal',
          4: 'Podium',
        };
        if (labels[room.phase]) {
          push({ message: labels[room.phase], tone: 'phase', duration: 1600 });
        }
      }

      // Pause / resume
      if (prev.paused !== room.paused && room.status === 'playing') {
        push({
          message: room.paused ? 'Game paused' : 'Resumed',
          tone: room.paused ? 'warn' : 'info',
          duration: 1800,
        });
      }
    }

    prevRef.current = room;
  }, [room, push]);
}
