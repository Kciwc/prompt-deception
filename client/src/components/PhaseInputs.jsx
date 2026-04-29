import { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { Confetti } from './Confetti';
import './PhaseInputs.css';

const MIN_BLUFF = 5;
const MAX_BLUFF = 200;

// ──────────────────────────────────────────────────────────
// Phase 1: write your bluff
// ──────────────────────────────────────────────────────────
export function Phase1BluffInput({ round }) {
  const [text, setText] = useState(round.myBluff ?? '');
  const [submitted, setSubmitted] = useState(round.myBluff != null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Sync from server snapshot if it's the canonical state.
  useEffect(() => {
    if (round.myBluff != null) {
      setText(round.myBluff);
      setSubmitted(true);
    }
  }, [round.myBluff]);

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (visibleLen(t) < MIN_BLUFF) {
      setErr(`Minimum ${MIN_BLUFF} visible characters.`);
      return;
    }
    setBusy(true);
    setErr('');
    socket.emit('bluff:submit', { text: t }, (res) => {
      setBusy(false);
      if (res?.ok) setSubmitted(true);
      else setErr(serverError(res?.error));
    });
  }

  if (submitted) {
    return (
      <section className="phase-input">
        <h2>Bluff submitted ✓</h2>
        <blockquote>"{text}"</blockquote>
        <button className="link-btn" onClick={() => setSubmitted(false)}>
          Edit before timer ends
        </button>
        <p className="hint">Waiting on your team.</p>
      </section>
    );
  }

  return (
    <section className="phase-input">
      <h2>Write your bluff</h2>
      <p className="hint">Make it convincing. Your teammates will pick one to submit.</p>
      <form onSubmit={submit}>
        <textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_BLUFF))}
          placeholder="A startlingly plausible AI prompt…"
        />
        <div className="meta">
          <span className={visibleLen(text.trim()) < MIN_BLUFF ? 'warn' : ''}>
            {visibleLen(text.trim())}/{MAX_BLUFF}
          </span>
          <button type="submit" disabled={busy || visibleLen(text.trim()) < MIN_BLUFF}>
            {busy ? 'Submitting…' : 'Submit bluff'}
          </button>
        </div>
        {err && <p className="err">{err}</p>}
      </form>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Phase 2: vote on your team's entry
// ──────────────────────────────────────────────────────────
export function Phase2IntraVote({ round }) {
  const [busy, setBusy] = useState(false);
  const lastClickRef = useRef(0);
  const choices = round.teamBluffs ?? [];
  const myVote = round.myIntraVote ?? null;

  function vote(targetPlayerId) {
    // 300ms debounce per spec.
    const now = Date.now();
    if (now - lastClickRef.current < 300) return;
    lastClickRef.current = now;

    setBusy(true);
    socket.emit('intra-vote:cast', { targetPlayerId }, () => setBusy(false));
  }

  if (choices.length === 0) {
    return (
      <section className="phase-input">
        <h2>No teammates with bluffs</h2>
        <p className="hint">Your team will go in with "no bluff" this round.</p>
      </section>
    );
  }

  if (choices.length === 1) {
    return (
      <section className="phase-input">
        <h2>Your team's bluff</h2>
        <blockquote>"{choices[0].text}"</blockquote>
        <p className="hint">Only one bluff to choose from. It auto-advances.</p>
      </section>
    );
  }

  return (
    <section className="phase-input">
      <h2>Pick your team's entry</h2>
      <p className="hint">Tap the bluff most likely to fool the other teams.</p>
      <ul className="vote-list">
        {choices.map((c) => (
          <li key={c.pid}>
            <button
              className={`vote-btn ${myVote === c.pid ? 'is-picked' : ''} ${c.isMine ? 'is-mine' : ''}`}
              onClick={() => vote(c.pid)}
              disabled={busy}
            >
              <span className="vote-text">"{c.text}"</span>
              {c.isMine && <span className="badge">yours</span>}
              {myVote === c.pid && <span className="badge">voted</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Phase 3: spot the real prompt
// ──────────────────────────────────────────────────────────
export function Phase3MainVote({ round, myTeamSlot }) {
  const lastClickRef = useRef(0);
  const candidates = round.candidates ?? [];
  const myVote = round.myMainVote ?? null;

  function vote(candidateId) {
    const now = Date.now();
    if (now - lastClickRef.current < 300) return;
    lastClickRef.current = now;
    socket.emit('main-vote:cast', { candidate: candidateId });
  }

  return (
    <section className="phase-input">
      <h2>Spot the real prompt</h2>
      <p className="hint">One of these is the real AI prompt. The rest are bluffs from other teams. You can change your vote until the timer hits zero.</p>
      <ul className="vote-list">
        {candidates.map((c) => {
          const isMyTeam = c.id === `team:${myTeamSlot}`;
          return (
            <li key={c.id}>
              <button
                className={`vote-btn ${myVote === c.id ? 'is-picked' : ''} ${isMyTeam ? 'disabled' : ''}`}
                onClick={() => !isMyTeam && vote(c.id)}
                disabled={isMyTeam}
              >
                <span className="vote-text">"{c.text}"</span>
                {isMyTeam && <span className="badge">your team</span>}
                {myVote === c.id && <span className="badge">voted</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Phase 4: thumbs up/down on the round (+ confetti if I guessed right)
// ──────────────────────────────────────────────────────────
export function Phase4Feedback({ round, room }) {
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Mirror the TV's reveal cadence — fire confetti when the real is revealed.
  const elapsedFrac = room?.phaseStartMs && room?.phaseDurationMs
    ? Math.min(1, Math.max(0, (now - room.phaseStartMs) / room.phaseDurationMs))
    : 1;
  const realRevealed = elapsedFrac >= 0.75;
  const guessedReal = round.myMainVote === 'real';
  const fireConfetti = realRevealed && guessedReal;

  function send(thumbs) {
    setSubmitted(true);
    socket.emit('feedback:submit', { thumbs });
  }

  return (
    <section className="phase-input">
      <Confetti firing={fireConfetti} key={`p-confetti-${room.currentRoundIdx}-${fireConfetti}`} count={50} />
      <h2>{realRevealed ? (guessedReal ? 'Nice — you nailed it!' : 'Watch the screen') : 'Reveal time'}</h2>
      <p className="hint">
        {realRevealed
          ? guessedReal
            ? 'You picked the real prompt. +2 for your team.'
            : "You missed it. Reveal continues on the TV."
          : 'Reveal in progress on the TV.'}
      </p>
      <div className="thumbs-row">
        <button className="thumb up" disabled={submitted} onClick={() => send('up')}>
          👍 Good round
        </button>
        <button className="thumb down" disabled={submitted} onClick={() => send('down')}>
          👎 Skip
        </button>
      </div>
      {submitted && <p className="muted">Thanks — we'll keep it (or burn it).</p>}
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// utils
// ──────────────────────────────────────────────────────────
function visibleLen(s) {
  return Array.from(s.replace(/\s+/g, ' ').trim()).length;
}

function serverError(code) {
  switch (code) {
    case 'bluff_too_short': return `Minimum ${MIN_BLUFF} visible characters.`;
    case 'wrong_phase': return 'Too late — phase has moved on.';
    case 'no_self_team_vote': return "You can't vote for your own team.";
    case 'cross_team_vote': return 'You can only vote for your own teammates here.';
    default: return code ? `Error: ${code}` : 'Could not submit.';
  }
}
