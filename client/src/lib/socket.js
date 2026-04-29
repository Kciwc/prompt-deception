import { io } from 'socket.io-client';

// Resolution order:
//   1. VITE_SERVER_URL (explicit override, useful for split-host setups)
//   2. localhost:3001 in dev
//   3. window.location.origin in prod (server + client share an origin)
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV
    ? 'http://localhost:3001'
    : (typeof window !== 'undefined' ? window.location.origin : ''));

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export { SERVER_URL };
