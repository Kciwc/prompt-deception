import { useState, useEffect, useRef, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, Hand, Mic, Check, X } from 'lucide-react';
import { socket } from '../lib/socket';
import { Confetti } from './Confetti';
import { audioManager } from '../audio/AudioManager';
import './PhaseInputs.css';

const MIN_BLUFF_FINAL = 5;
const MAX_BLUFF = 200;
const BLUFF_DEBOUNCE_MS = 300;

// Typing indicator window: show pulsing dots if a teammate's typingAt
// timestamp is within the last 1500ms of server time. Refreshed by an
// interval since `now` advances independently of state pushes.
const TYPING_WINDOW_MS = 1500;

// ──────────────────────────────────────────────────────────
// Phase 1 (merged): write your bluff + vote on teammates' bluffs.
// Both are mutable until the timer ends.
// ──────────────────────────────────────────────────────────
export function Phase1WriteAndVote({ round, room }) {
  const teamBluffs = round.teamBluffs ?? [];
  const myEntry = teamBluffs.find((b) => b.isMine);
  const others = teamBluffs.filter((b) => !b.isMine);
  const myVote = round.myIntraVote ?? null;
  const tally = round.intraVoteTally ?? {};

  // Drive the typing indicator off a 250ms tick — server sends serverTime,
  // we use it to estimate clock drift, then compute "is this teammate
  // typing right now?" each render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  // Approximate offset between server time and ours (tiny — assume LAN).
  const serverDrift = room?.serverTime ? room.serverTime - now : 0;
  function isTyping(b) {
    if (!b.typingAt) return false;
    const elapsed = now + serverDrift - b.typingAt;
    return elapsed >= 0 && elapsed < TYPING_WINDOW_MS;
  }

  // Local input state — server is the source of truth, but we keep a local
  // buffer so typing is responsive. Sync from server only when WE haven't
  // typed recently (avoid clobbering local edits with stale server state).
  const [draft, setDraft] = useState(myEntry?.text ?? '');
  const lastTypedRef = useRef(0);

  useEffect(() => {
    const sinceTyped = Date.now() - lastTypedRef.current;
    if (sinceTyped > 1000) {
      // We haven't typed in >1s — accept server state as authoritative.
      setDraft(myEntry?.text ?? '');
    }
  }, [myEntry?.text]);

  // Debounce keystrokes before pushing to the server.
  useEffect(() => {
    const id = setTimeout(() => {
      if (draft === (myEntry?.text ?? '')) return; // unchanged from server
      socket.emit('bluff:submit', { text: draft });
    }, BLUFF_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  function onChange(e) {
    lastTypedRef.current = Date.now();
    setDraft(e.target.value.slice(0, MAX_BLUFF));
  }

  function vote(targetPid) {
    if (myVote === targetPid) {
      socket.emit('intra-vote:clear');
    } else {
      socket.emit('intra-vote:cast', { targetPlayerId: targetPid });
      audioManager.voteTick();
    }
  }

  function nudge(targetPid) {
    socket.emit('nudge:send', { targetPlayerId: targetPid });
    audioManager.click();
  }

  const draftLen = visibleLen(draft);

  return (
    <section className="phase-input">
      <h2>Bluff & vote</h2>
      <p className="hint">
        Write a bluff for your team — and vote on teammates' as they type.
        Highest-voted entry submits when the timer ends.
      </p>

      <div className="my-bluff">
        <label>Your bluff</label>
        <textarea
          rows={3}
          value={draft}
          onChange={onChange}
          placeholder="Make it convincing."
          autoFocus
        />
        <div className="meta">
          <span className={draftLen < MIN_BLUFF_FINAL ? 'warn' : ''}>
            {draftLen}/{MAX_BLUFF}
            {draftLen < MIN_BLUFF_FINAL && draftLen > 0 && ' — needs 5+ to count'}
          </span>
        </div>
      </div>

      {others.length > 0 && (
        <>
          <h3 className="section-h">Teammates</h3>
          <ul className="vote-list">
            {others.map((b) => {
              const votes = tally[b.pid] ?? 0;
              const text = (b.text ?? '').trim();
              const finalEligible = visibleLen(text) >= MIN_BLUFF_FINAL;
              const isLeader = others.every((o) => (tally[o.pid] ?? 0) <= votes) && votes > 0;
              return (
                <li key={b.pid}>
                  <button
                    type="button"
                    className={[
                      'vote-btn',
                      myVote === b.pid ? 'is-picked' : '',
                      isLeader ? 'is-leader' : '',
                    ].join(' ')}
                    onClick={() => finalEligible && vote(b.pid)}
                    disabled={!finalEligible}
                    title={finalEligible ? 'Tap to vote / unvote' : 'Waiting on this teammate to write more'}
                  >
                    <span className="author">
                      {b.authorName}
                      {isTyping(b) && <TypingDots />}
                    </span>
                    <span className="vote-text">
                      {text || <em className="muted">— typing —</em>}
                    </span>
                    <span className="vote-meta">
                      {votes > 0 && <span className="badge votes">{votes}</span>}
                      {myVote === b.pid && <span className="badge">voted</span>}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="nudge-btn"
                    title="Nudge this teammate"
                    onClick={(e) => { e.stopPropagation(); nudge(b.pid); }}
                  >
                    <Hand size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {others.length === 0 && (
        <p className="muted">You're flying solo on your team. Just write — your bluff auto-wins.</p>
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Phase 2 (was 3): main vote on the shuffled candidates.
// ──────────────────────────────────────────────────────────
export function Phase2MainVote({ round, myTeamSlot }) {
  const lastClickRef = useRef(0);
  const candidates = round.candidates ?? [];
  const myVote = round.myMainVote ?? null;

  function vote(candidateId) {
    const now = Date.now();
    if (now - lastClickRef.current < 300) return;
    lastClickRef.current = now;
    socket.emit('main-vote:cast', { candidate: candidateId });
    audioManager.voteTick();
  }

  return (
    <section className="phase-input">
      <h2>Spot the real prompt</h2>
      <p className="hint">One of these is the real AI prompt. Vote freely; you can change until the timer hits zero.</p>
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
// Phase 3 (was 4): reveal — confetti for correct guessers, thumbs up/down,
// and Trash Talk MVP voting (running cumulative leaderboard).
// ──────────────────────────────────────────────────────────
export function Phase3RevealAndFeedback({ round, room }) {
  const [submittedThumbs, setSubmittedThumbs] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsedFrac = room?.phaseStartMs && room?.phaseDurationMs
    ? Math.min(1, Math.max(0, (now - room.phaseStartMs) / room.phaseDurationMs))
    : 1;
  const realRevealed = elapsedFrac >= 0.75;
  const guessedReal = round.myMainVote === 'real';
  const fireConfetti = realRevealed && guessedReal;

  const me = room.players.find((p) => p.isMe);
  const trashTalkEnabled = room.config.trashTalkEnabled;
  const trashTalk = round.trashTalk ?? { voteCounts: {}, myVote: null };

  function sendThumbs(t) {
    setSubmittedThumbs(true);
    socket.emit('feedback:submit', { thumbs: t });
  }

  function trashTalkVote(targetPid) {
    if (trashTalk.myVote === targetPid) {
      socket.emit('trashtalk:clear');
    } else {
      socket.emit('trashtalk:vote', { targetPlayerId: targetPid });
      audioManager.voteTick();
    }
  }

  const otherPlayers = useMemo(
    () => room.players.filter((p) => p.id !== me?.id),
    [room.players, me?.id]
  );

  return (
    <section className="phase-input">
      <Confetti firing={fireConfetti} key={`p-confetti-${room.currentRoundIdx}-${fireConfetti}`} count={50} />
      <h2>{realRevealed ? (guessedReal ? 'Nice — you nailed it!' : 'Watch the screen') : 'Reveal time'}</h2>
      <p className="hint">
        {realRevealed
          ? guessedReal
            ? 'You picked the real prompt. +2 for your team.'
            : "You missed it — better luck next round."
          : 'Reveal in progress on the TV.'}
      </p>

      {trashTalkEnabled && otherPlayers.length > 0 && (
        <div className="trash-talk-block">
          <h3 className="section-h">
            <Mic size={18} style={{ verticalAlign: '-3px', marginRight: '0.3em' }} />
            Trash Talk MVP
          </h3>
          <p className="muted small">Who's killing it on the call this round?</p>
          <ul className="trash-list">
            {otherPlayers.map((p) => {
              const votes = trashTalk.voteCounts?.[p.id] ?? 0;
              const teamColor = room.teams.find((t) => t.slot === p.teamSlot)?.color ?? 'neutral';
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`trash-btn theme-${teamColor} ${trashTalk.myVote === p.id ? 'is-picked' : ''}`}
                    onClick={() => trashTalkVote(p.id)}
                  >
                    <span className="name">{p.name}</span>
                    <span className="votes">
                      {votes > 0 && (
                        <>
                          {votes} <Mic size={12} style={{ verticalAlign: '-1px' }} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="thumbs-row">
        <button className="thumb up" disabled={submittedThumbs} onClick={() => sendThumbs('up')}>
          <ThumbsUp size={18} /> Good round
        </button>
        <button className="thumb down" disabled={submittedThumbs} onClick={() => sendThumbs('down')}>
          <ThumbsDown size={18} /> Skip
        </button>
      </div>
      {submittedThumbs && <p className="muted">Thanks for the feedback.</p>}
    </section>
  );
}

// Pulsing three-dot typing indicator.
function TypingDots() {
  return (
    <span className="typing-dots" aria-label="typing">
      <span /><span /><span />
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// utils
// ──────────────────────────────────────────────────────────
function visibleLen(s) {
  if (typeof s !== 'string') return 0;
  return Array.from(s.replace(/\s+/g, ' ').trim()).length;
}
