// Tiny skeleton primitives. Style with className to size/round.
export function Skeleton({ className = '', style = {} }) {
  return <span className={`skeleton ${className}`} style={style} />;
}

// Specific shapes
export function SkeletonText({ width = '70%' }) {
  return <Skeleton style={{ display: 'block', height: '1em', width, margin: '0.4em 0' }} />;
}

export function SkeletonRow({ height = 28, width = '100%' }) {
  return <Skeleton style={{ display: 'block', height, width, margin: '0.4em 0' }} />;
}

// Used while a player room is connecting.
export function PlayerRoomSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      <Skeleton style={{ height: 18, width: 100 }} />
      <Skeleton style={{ height: 32, width: '60%' }} />
      <Skeleton style={{ height: 220, width: '100%', borderRadius: 16 }} />
      <Skeleton style={{ height: 56, width: '100%', borderRadius: 12 }} />
    </div>
  );
}

// Used on the TV while attaching.
export function TVSkeleton() {
  return (
    <div style={{ flex: 1, padding: '2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Skeleton style={{ height: 50, width: '40%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1 }}>
        <Skeleton style={{ height: '100%', minHeight: 320, borderRadius: 18 }} />
        <Skeleton style={{ height: '100%', minHeight: 320, borderRadius: 18 }} />
      </div>
    </div>
  );
}
