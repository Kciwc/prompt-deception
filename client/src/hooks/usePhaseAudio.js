import { useEffect, useRef } from 'react';
import { audioManager } from '../audio/AudioManager';

// Drives audio cues off the room state.
//   - chime once when timer crosses 10s in any active-input phase
//   - reveal fanfare once at phase 4 entry
//   - ambient music start/stop based on status
export function usePhaseAudio(room) {
  const chimedKeyRef = useRef(null);
  const lastPhaseRef = useRef(null);
  const lastStatusRef = useRef(null);

  useEffect(() => {
    if (!room) return;

    // Music gating.
    const wasPlaying = lastStatusRef.current === 'playing';
    const isPlaying = room.status === 'playing';
    if (!wasPlaying && isPlaying) audioManager.startMusic();
    if (wasPlaying && !isPlaying) audioManager.stopMusic();
    lastStatusRef.current = room.status;

    // Phase-entry SFX.
    if (lastPhaseRef.current !== room.phase) {
      if (room.phase === 4) audioManager.reveal();
      chimedKeyRef.current = null; // reset chime for the new phase
    }
    lastPhaseRef.current = room.phase;
  }, [room?.phase, room?.status]);

  // 10s chime — tick frequently, fire once per phase when remaining crosses 10s.
  useEffect(() => {
    if (!room || !room.phaseDeadlineMs || room.paused) return;
    const id = setInterval(() => {
      const remaining = room.phaseDeadlineMs - Date.now();
      const phaseKey = `${room.currentRoundIdx}:${room.phase}`;
      // Only chime in input phases (1, 2, 3) — not in lobby/reveal/podium.
      const eligible = [1, 2, 3].includes(room.phase);
      if (eligible && remaining > 0 && remaining <= 10_000 && chimedKeyRef.current !== phaseKey) {
        chimedKeyRef.current = phaseKey;
        audioManager.chime();
      }
    }, 250);
    return () => clearInterval(id);
  }, [room?.phaseDeadlineMs, room?.paused, room?.phase, room?.currentRoundIdx]);
}
