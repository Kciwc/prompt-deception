import { io } from 'socket.io-client';

// In production, connect to same origin. In dev, connect to server port.
const URL =
  import.meta.env.MODE === 'production'
    ? window.location.origin
    : 'http://localhost:3001';

const socket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default socket;
