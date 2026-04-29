import './TeamBucket.css';

export function TeamBucket({ team, players, onPick, isPicked, disabled }) {
  const slotClass = `bucket bucket-${team.color}`;
  return (
    <button
      className={`${slotClass} ${isPicked ? 'is-picked' : ''}`}
      onClick={onPick}
      disabled={disabled}
      type="button"
    >
      <header className="bucket-header">
        <h3>{team.name}</h3>
        <span className="bucket-count">{players.length}</span>
      </header>
      <ul className="bucket-list">
        {players.map((p) => (
          <li key={p.id} className={`name-tag ${p.ready ? 'ready' : ''} ${p.isMe ? 'is-me' : ''}`}>
            {p.name}
            {p.ready && <span className="ready-check">✓</span>}
          </li>
        ))}
      </ul>
    </button>
  );
}
