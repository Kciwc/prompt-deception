import { useMemo } from 'react';
import './Confetti.css';

// CSS-only confetti — no canvas, no library. Burst once when `firing`
// flips to true; the parent should remount the component (via key) to
// re-fire.
export function Confetti({ firing, count = 80 }) {
  const pieces = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.6 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 200,
      hue: [0, 60, 180, 300, 30][i % 5],
      size: 6 + Math.random() * 8,
      rotate: Math.random() * 360,
      shape: ['square', 'circle', 'triangle'][i % 3],
    })),
    [count, firing] // re-roll if firing toggles
  );

  if (!firing) return null;

  return (
    <div className="confetti-stage" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.i}
          className={`confetti-piece confetti-${p.shape}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: `hsl(${p.hue} 90% 60%)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--rot': `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
