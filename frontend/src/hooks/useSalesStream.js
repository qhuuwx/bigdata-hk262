/**
 * Sales Stream Hook
 * Polls 20 random sales transactions every 2 seconds and maintains a sliding table of up to 100 rows.
 */

import { useState, useCallback } from 'react';
import salesService from '../services/salesService';
import usePolling from './usePolling';

export const useSalesStream = (enabled = true) => {
  const [salesRows, setSalesRows] = useState([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatch = useCallback(async () => {
    try {
      const batch = await salesService.getSalesStream();
      if (Array.isArray(batch) && batch.length > 0) {
        setSalesRows(prev => {
          // Prepend new 20 rows, capped at 100 rows
          const combined = [...batch, ...prev];
          return combined.slice(0, 100);
        });
        setError(null);
      }
    } catch (err) {
      setError(err.message || 'Error streaming sales');
    }
  }, []);

  usePolling(fetchBatch, 2000, enabled && isStreaming);

  const toggleStreaming = useCallback(() => {
    setIsStreaming(prev => !prev);
  }, []);

  const clearRows = useCallback(() => {
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
