import { useEffect, useState } from 'react';
import './PhaseTimer.css';

// Server is timer authority. Client just renders the remaining ms.
export function PhaseTimer({ deadlineMs, paused, pausedRemainingMs, size = 'md' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = paused
    ? Math.max(0, pausedRemainingMs ?? 0)
    : Math.max(0, (deadlineMs ?? now) - now);

  const seconds = Math.ceil(remaining / 1000);
  const isWarn = !paused && seconds <= 10 && seconds > 0;
  const display = `${seconds}`.padStart(2, '0') + 's';

  return (
    <div className={`phase-timer size-${size} ${isWarn ? 'warn' : ''} ${paused ? 'paused' : ''}`}>
      {paused ? '⏸ paused' : display}
    </div>
  );
}
