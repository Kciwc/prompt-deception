import { useEffect, useState, useRef } from 'react';
import { audioManager } from '../audio/AudioManager';
import './Podium.css';

const COUNT_UP_MS = 1200;
const STEP_DELAY_MS = 250;

export function Podium({ teams }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  // Visual podium step: tied teams share the same step.
  function stepFor(i) {
    let step = 0;
    let prev = null;
    for (let k = 0; k <= i; k++) {
      if (prev !== null && ranked[k].score < prev) step++;
      prev = ranked[k].score;
    }
    return step;
  }

  const fanfaredRef = useRef(false);
  useEffect(() => {
    if (fanfaredRef.current) return;
    fanfaredRef.current = true;
    audioManager.drumroll(900);
    setTimeout(() => audioManager.fanfare(), 950);
  }, []);

  return (
    <div className="tv-podium">
      {ranked.map((t, i) => (
        <PodiumStep
          key={t.slot}
          team={t}
          step={stepFor(i)}
          riseDelay={i * STEP_DELAY_MS}
          countDelay={i * STEP_DELAY_MS + 300}
        />
      ))}
    </div>
  );
}

function PodiumStep({ team, step, riseDelay, countDelay }) {
  const [risen, setRisen] = useState(false);
  const [displayedScore, setDisplayedScore] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setRisen(true), riseDelay);
    return () => clearTimeout(id);
  }, [riseDelay]);

  useEffect(() => {
    if (!Number.isFinite(team.score) || team.score === 0) {
      const id = setTimeout(() => setDisplayedScore(0), countDelay);
      return () => clearTimeout(id);
    }
    const start = Date.now() + countDelay;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayedScore(Math.round(team.score * eased));
      if (t >= 1) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [team.score, countDelay]);

  return (
    <div
      className={[
        'podium-step',
        `podium-step-${step}`,
        `tv-team-${team.color}`,
        risen ? 'is-risen' : 'is-rising',
      ].join(' ')}
    >
      <h3>{team.name}</h3>
      <span className="score display-font">{displayedScore}</span>
    </div>
  );
}
