/**
 * Reusable Polling Hook
 * Manages periodic asynchronous invocation with tab visibility detection and cleanup.
 */

import { useEffect, useRef, useCallback } from 'react';

export const usePolling = (callback, intervalMs = 2000, enabled = true) => {
  const savedCallback = useRef(callback);
  const isExecutingRef = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const tick = useCallback(async () => {
    // Prevent overlapping async calls or execution when document is hidden
    if (isExecutingRef.current || (typeof document !== 'undefined' && document.hidden)) {
      return;
    }

    try {
      isExecutingRef.current = true;
      await savedCallback.current();
    } catch (err) {
      // Handled inside callback
    } finally {
      isExecutingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) {
      return;
    }

    // Trigger initial tick immediately
    tick();

    const id = setInterval(tick, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden && enabled) {
        tick();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalMs, enabled, tick]);
};

export default usePolling;
