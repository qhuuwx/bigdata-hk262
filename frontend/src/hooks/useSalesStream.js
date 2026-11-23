/**
 * Sales Stream Hook (SSE + Polling Fallback)
 * Streams 20 random sales transactions every 2 seconds via EventSource (/api/stream/sales/events)
 * with automatic fallback to HTTP polling (/api/stream/sales), pause/resume, and Command Palette triggers.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import salesService from '../services/salesService';
import { getApiBaseUrl, API_ENDPOINTS } from '../config/apiConfig';
import usePolling from './usePolling';

let cachedSalesRows = [];
let cachedIsStreaming = true;

export const useSalesStream = (enabled = true) => {
  const [salesRows, setSalesRows] = useState(cachedSalesRows);
  const [isStreaming, setIsStreaming] = useState(cachedIsStreaming);
  const [transportMode, setTransportMode] = useState('sse'); // 'sse' | 'polling'
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const appendBatch = useCallback((batch) => {
    if (!isMountedRef.current || !Array.isArray(batch) || batch.length === 0) return;
    const stamp = Date.now();
    const tagged = batch.map((row, idx) => ({
      ...row,
      _rowKey: `${stamp}-${idx}-${row['Product No'] || ''}`
    }));
    setSalesRows((prev) => {
      const combined = [...tagged, ...prev].slice(0, 100);
      cachedSalesRows = combined;
      return combined;
    });
    setError(null);
  }, []);

  // Connect via Server-Sent Events (EventSource) when enabled and streaming
  useEffect(() => {
    if (!enabled || !isStreaming || usePollingFallback) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
      setUsePollingFallback(true);
      setTransportMode('polling');
      return;
    }

    const sseUrl = `${getApiBaseUrl()}${API_ENDPOINTS.STREAM_SALES_EVENTS}`;
    let es;
    try {
      es = new window.EventSource(sseUrl);
      eventSourceRef.current = es;
    } catch (e) {
      setUsePollingFallback(true);
      setTransportMode('polling');
      return;
    }

    let consecutiveErrors = 0;

    const handleBatchEvent = (evt) => {
      consecutiveErrors = 0;
      if (!isMountedRef.current) return;
      setTransportMode('sse');
      try {
        const parsed = JSON.parse(evt.data);
        appendBatch(parsed);
      } catch (e) {}
    };

    es.addEventListener('batch', handleBatchEvent);
    es.onmessage = handleBatchEvent;

    es.onerror = () => {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 2 && isMountedRef.current) {
        es.close();
        eventSourceRef.current = null;
        setUsePollingFallback(true);
        setTransportMode('polling');
      }
    };

    return () => {
      es.removeEventListener('batch', handleBatchEvent);
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [enabled, isStreaming, usePollingFallback, appendBatch]);

  // Polling fallback if EventSource is unavailable or drops
  const fetchBatch = useCallback(async () => {
    try {
      const batch = await salesService.getSalesStream();
      appendBatch(batch);
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Error streaming sales');
    }
  }, [appendBatch]);

  usePolling(fetchBatch, 2000, enabled && isStreaming && usePollingFallback);

  const toggleStreaming = useCallback(() => {
    setIsStreaming((prev) => {
      const next = !prev;
      cachedIsStreaming = next;
      return next;
    });
  }, []);

  const clearRows = useCallback(() => {
    cachedSalesRows = [];
    setSalesRows([]);
  }, []);

  // Global Command Palette action listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onToggle = () => toggleStreaming();
    const onClear = () => clearRows();
    window.addEventListener('ri:toggle-sales-stream', onToggle);
    window.addEventListener('ri:clear-sales-stream', onClear);
    return () => {
      window.removeEventListener('ri:toggle-sales-stream', onToggle);
      window.removeEventListener('ri:clear-sales-stream', onClear);
    };
  }, [toggleStreaming, clearRows]);

  return {
    salesRows,
    isStreaming,
    transportMode,
    error,
    toggleStreaming,
    clearRows
  };
};

export default useSalesStream;
