import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

export function useRoomState() {
  const [state, setState] = useState(null);

  useEffect(() => {
    const onState = (snapshot) => setState(snapshot);
    socket.on('room:state', onState);
    return () => socket.off('room:state', onState);
  }, []);

  return state;
}
