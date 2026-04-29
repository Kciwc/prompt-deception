import { useEffect, useRef, useState } from 'react';
import { audioManager } from '../audio/AudioManager';
import './TeamScorePill.css';

// Wraps the TV team-score pill with bump animation + floating "+N".
// Plays a small SFX when the score increases.
export function TeamScorePill({ team }) {
  const [delta, setDelta] = useState(null);
  const [bump, setBump] = useState(false);
  const prevScore = useRef(team.score);

  useEffect(() => {
    const diff = team.score - prevScore.current;
    if (diff > 0) {
      setDelta(diff);
      setBump(true);
      audioManager.scoreBump();
      const t1 = setTimeout(() => setBump(false), 400);
      const t2 = setTimeout(() => setDelta(null), 1500);
      prevScore.current = team.score;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevScore.current = team.score;
  }, [team.score]);

  return (
    <div className={`tv-team-pill tv-team-${team.color} ${bump ? 'bump' : ''}`}>
      <span className="tname">{team.name}</span>
      <span className="tscore display-font">{team.score}</span>
      {delta != null && (
        <span className="score-delta" aria-hidden="true">+{delta}</span>
      )}
    </div>
  );
}
