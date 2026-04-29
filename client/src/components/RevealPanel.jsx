import { useEffect, useMemo, useState } from 'react';
import { Confetti } from './Confetti';
import './RevealPanel.css';

// Reveal cadence as fractions of phase 4 elapsed time.
// 4 candidates → bluffs at 15/35/55%, real at 75%.
// Adjusted automatically for fewer non-real candidates (autoEmpty etc).
const REAL_REVEAL_FRACTION = 0.75;
const FIRST_REVEAL_FRACTION = 0.15;

export function RevealPanel({ room }) {
  const round = room.currentRound;
  const candidates = round?.candidates ?? [];
  const reveal = round?.reveal;

  // Compute the deterministic reveal order: keep the shuffled order from
  // the server, but force 'real' to be last for dramatic effect.
  const revealOrder = useMemo(() => {
    const nonReal = candidates.filter((c) => c.id !== 'real');
    const real = candidates.find((c) => c.id === 'real');
    return real ? [...nonReal, real] : nonReal;
  }, [candidates]);

  // Tick to drive the reveal animation off elapsed time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const startMs = room.phaseStartMs;
  const totalMs = room.phaseDurationMs;
  const elapsedFrac = startMs && totalMs
    ? Math.min(1, Math.max(0, (now - startMs) / totalMs))
    : 1;

  // Determine how many items should be revealed.
  // Bluffs are revealed evenly between FIRST_REVEAL_FRACTION and REAL_REVEAL_FRACTION;
  // real reveals at REAL_REVEAL_FRACTION.
  const bluffCount = revealOrder.length - 1; // excluding real
  let revealedCount = 0;
  if (bluffCount > 0) {
    const stepFrac = (REAL_REVEAL_FRACTION - FIRST_REVEAL_FRACTION) / bluffCount;
    for (let i = 0; i < bluffCount; i++) {
      const threshold = FIRST_REVEAL_FRACTION + stepFrac * (i + 1);
      if (elapsedFrac >= threshold) revealedCount = i + 1;
    }
  }
  const realRevealed = elapsedFrac >= REAL_REVEAL_FRACTION;
  if (realRevealed) revealedCount = revealOrder.length;

  if (!reveal) return null;
  const { voteByCandidate, scoreDelta } = reveal;

  return (
    <div className="reveal-panel">
      <Confetti firing={realRevealed} key={`confetti-${room.currentRoundIdx}-${realRevealed}`} />
      <h3>Reveal</h3>
      <ol className="reveal-list">
        {revealOrder.map((c, i) => {
          const shown = i < revealedCount;
          const isReal = c.id === 'real';
          const votes = voteByCandidate?.[c.id] ?? 0;
          return (
            <li
              key={c.id}
              className={[
                'reveal-row',
                shown ? 'is-shown' : 'is-hidden',
                isReal ? 'is-real' : 'is-bluff',
              ].join(' ')}
              data-real={isReal}
            >
              <span className="icon" aria-label={isReal ? 'real' : 'bluff'}>
                {shown ? (isReal ? '✓' : '✗') : '?'}
              </span>
              <span className="text">"{c.text}"</span>
              {shown && (
                <span className="meta">
                  {isReal && <span className="real-tag">REAL</span>}
                  <span className="vc">{votes} vote{votes === 1 ? '' : 's'}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {realRevealed && scoreDelta && (
        <div className="round-score">
          <h4>This round</h4>
          <ul>
            {room.teams.map((t) => {
              const d = scoreDelta.perTeam?.[t.slot] ?? 0;
              return (
                <li key={t.slot} className={`tv-team-${t.color}`}>
                  <span>{t.name}</span>
                  <span>+{d}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
