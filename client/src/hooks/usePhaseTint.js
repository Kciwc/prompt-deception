import { useEffect } from 'react';

// Subtle background hue shift per phase to give the TV/phone a "where are
// we" cue. Hue-rotates the radial gradients on body via a CSS variable.
const TINTS = {
  0: 0,    // lobby — neutral
  1: -10,  // write+vote — slightly cool
  2: 18,   // main vote — slight warm tilt
  3: 36,   // reveal — gold push
  4: 0,    // podium — back to neutral
};

export function usePhaseTint(room) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const phase = room?.phase ?? 0;
    const deg = TINTS[phase] ?? 0;
    document.documentElement.style.setProperty('--phase-hue-shift', `${deg}deg`);
  }, [room?.phase]);
}
