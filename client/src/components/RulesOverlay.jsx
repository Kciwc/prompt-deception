import { useEffect } from 'react';
import { X } from 'lucide-react';
import './RulesOverlay.css';

export function RulesOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-card" onClick={(e) => e.stopPropagation()}>
        <button className="rules-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={2.5} />
        </button>

        <h1 className="display-font rules-title">How to Play</h1>
        <p className="rules-tagline">
          AI-Balderdash — write fake prompts, fool the others, spot the real one.
        </p>

        <section className="rules-section">
          <h2>Setup</h2>
          <ul>
            <li>3 teams: <span className="t-cyan">Cyan</span>, <span className="t-magenta">Magenta</span>, <span className="t-amber">Amber</span></li>
            <li>Each round shows an AI-generated image on the TV</li>
            <li>Players use their phones (scan the QR code on the TV)</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Each round</h2>
          <ol>
            <li>
              <strong>Bluff &amp; vote.</strong> Write a fake AI prompt
              that could've made the image. Your teammates see your draft
              live — vote on which one your team submits.
            </li>
            <li>
              <strong>Spot the real prompt.</strong> The TV shows all
              three team bluffs plus the real one. Pick which is real.
              You can't vote for your own team's.
            </li>
            <li>
              <strong>Reveal.</strong> Bluffs flip face-down first, real
              one drops with confetti. While you watch, vote for whoever
              cracked you up most that round.
            </li>
          </ol>
        </section>

        <section className="rules-section">
          <h2>Scoring</h2>
          <ul>
            <li>Guess the real prompt: <strong>+2</strong> for your team</li>
            <li>Each opposing player you fooled with your team's bluff: <strong>+1</strong> each</li>
            <li><strong>Trash Talk MVP</strong> is separate — pure bragging rights, accumulates round by round, crowned at the podium</li>
          </ul>
        </section>

        <section className="rules-section">
          <h2>Winning</h2>
          <p>Highest team score wins. The Trash Talk MVP gets their own crown.</p>
        </section>

        <p className="rules-footer-tip">Press <kbd>Esc</kbd> or click outside to close.</p>
      </div>
    </div>
  );
}
