/**
 * Sales Stream Hook
 * Polls 20 random sales transactions every 2 seconds and maintains a sliding table of up to 100 rows.
 * Preserves accumulated rows and play/pause status across tab switches.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import salesService from '../services/salesService';
import usePolling from './usePolling';

let cachedSalesRows = [];
let cachedIsStreaming = true;

export const useSalesStream = (enabled = true) => {
  const [salesRows, setSalesRows] = useState(cachedSalesRows);
  const [isStreaming, setIsStreaming] = useState(cachedIsStreaming);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBatch = useCallback(async () => {
    try {
      const batch = await salesService.getSalesStream();
      if (!isMountedRef.current) return;
      if (Array.isArray(batch) && batch.length > 0) {
        setSalesRows(prev => {
          const combined = [...batch, ...prev].slice(0, 100);
          cachedSalesRows = combined;
          return combined;
        });
        setError(null);
      }
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Error streaming sales');
    }
  }, []);

  usePolling(fetchBatch, 2000, enabled && isStreaming);

  const toggleStreaming = useCallback(() => {
    setIsStreaming(prev => {
      const next = !prev;
      cachedIsStreaming = next;
      return next;
    });
  }, []);

  const clearRows = useCallback(() => {
    cachedSalesRows = [];
    setSalesRows([]);
  }, []);

  return {
    salesRows,
    isStreaming,
    error,
    toggleStreaming,
    clearRows
  };
};

export default useSalesStream;
