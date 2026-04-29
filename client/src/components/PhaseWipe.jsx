import { useEffect, useRef, useState } from 'react';
import './PhaseWipe.css';

const LABELS = {
  1: 'Bluff & Vote',
  2: 'Spot the Real',
  3: 'Reveal',
  4: 'Podium',
};

// Briefly overlays the screen with the new phase title when transitioning
// between active phases. Mount once at the top of TV / Player views.
export function PhaseWipe({ room }) {
  const [shown, setShown] = useState(null);
  const lastPhaseRef = useRef(null);

  useEffect(() => {
    if (!room || room.status !== 'playing') {
      lastPhaseRef.current = room?.phase ?? null;
      return;
    }
    const prev = lastPhaseRef.current;
    if (prev != null && prev !== room.phase && LABELS[room.phase]) {
      setShown(LABELS[room.phase]);
      const id = setTimeout(() => setShown(null), 1100);
      lastPhaseRef.current = room.phase;
      return () => clearTimeout(id);
    }
    lastPhaseRef.current = room.phase;
  }, [room?.phase, room?.status]);

  if (!shown) return null;
  return (
    <div className="phase-wipe" aria-hidden="true">
      <div className="phase-wipe-text display-font">{shown}</div>
    </div>
  );
}
