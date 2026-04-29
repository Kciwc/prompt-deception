import { useEffect } from 'react';

// Keeps the screen awake while `active` is true, where supported.
// Silently no-ops on browsers without the Wake Lock API (Safari < 16.4, etc).
export function useWakeLock(active) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined') return;
    if (!('wakeLock' in navigator)) return;

    let lock = null;
    let cancelled = false;

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request('screen');
        // Re-acquire when the page becomes visible again — wake locks
        // get released automatically on tab hide.
        lock.addEventListener?.('release', () => { lock = null; });
      } catch (_) {
        // User denied or doc not visible — give up silently.
      }
    }

    acquire();

    function onVisibility() {
      if (document.visibilityState === 'visible' && !lock && !cancelled) {
        acquire();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try { lock?.release(); } catch (_) {}
      lock = null;
    };
  }, [active]);
}
