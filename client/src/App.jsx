import './App.css';
import { useSocketStatus } from './hooks/useSocketStatus';
import { SERVER_URL } from './lib/socket';

function App() {
  const isConnected = useSocketStatus();

  return (
    <main className="app-shell">
      <h1 className="brand">Ceyon's Super Spiffy Trivia</h1>
      <p style={{ color: 'var(--text-dim)', maxWidth: '36ch' }}>
        Scaffolding only — lobby browser, rooms, and gameplay land in step 2.
      </p>
      <div className="status-pill">
        <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
        Server: {isConnected ? 'connected' : 'disconnected'}
        <code style={{ color: 'var(--text-dim)', fontSize: '0.8em', marginLeft: '0.5em' }}>
          {SERVER_URL}
        </code>
      </div>
    </main>
  );
}

export default App;
