import { useRef, useCallback } from 'react';

export default function useDebounce(delay = 300) {
  const lastCall = useRef(0);

  const debounced = useCallback(
    (fn) => {
      return (...args) => {
        const now = Date.now();
        if (now - lastCall.current < delay) return;
        lastCall.current = now;
        fn(...args);
      };
    },
    [delay]
  );

  return debounced;
}
