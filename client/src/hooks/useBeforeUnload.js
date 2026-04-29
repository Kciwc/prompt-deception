import { useEffect } from 'react';

// Show a "leave page?" warning while `enabled` is true.
// Most browsers ignore the custom message and show their generic prompt;
// we still set it for legacy browsers that honor it.
export function useBeforeUnload(enabled, message = 'You\'re in a game — leave anyway?') {
  useEffect(() => {
    if (!enabled) return;
    function handler(e) {
      e.preventDefault();
      e.returnValue = message;
      return message;
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, message]);
}
