/**
 * Inventory Stream Hook (SSE + Polling Fallback)
 * Streams 50-record cumulative inventory classification updates every 2s via EventSource
 * (/api/inventory/stream/events) with automatic fallback to HTTP polling (/api/inventory/stream).
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import inventoryService from '../services/inventoryService';
import { getApiBaseUrl, API_ENDPOINTS } from '../config/apiConfig';
import usePolling from './usePolling';
import AppContext from '../context/AppContext';

let cachedCumulativeState = {
  healthy: 0,
  low: 0,
  over: 0,
  total: 0
};
let cachedAlerts = [];
let hasLoadedAlertsOnce = false;

export const useInventoryStream = (enabled = true) => {
  const appCtx = useContext(AppContext);
  const backendStatus = appCtx ? appCtx.backendStatus : 'ready';

  const [cumulativeState, setCumulativeState] = useState(cachedCumulativeState);
  const [alerts, setAlerts] = useState(cachedAlerts);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(!hasLoadedAlertsOnce);
  const [transportMode, setTransportMode] = useState('sse');
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const alertsAbortRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (alertsAbortRef.current) {
        alertsAbortRef.current.abort();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const applyCumulativeUpdate = useCallback((state) => {
    if (!isMountedRef.current) return;
    if (state && typeof state.total === 'number') {
      cachedCumulativeState = state;
      setCumulativeState(state);
      setError(null);
    }
  }, []);

  // Connect via Server-Sent Events (EventSource) when enabled
  useEffect(() => {
    if (!enabled || usePollingFallback) {
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

    const sseUrl = `${getApiBaseUrl()}${API_ENDPOINTS.INVENTORY_STREAM_EVENTS}`;
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

    const handleInventoryEvent = (evt) => {
      consecutiveErrors = 0;
      if (!isMountedRef.current) return;
      setTransportMode('sse');
      try {
        const parsed = JSON.parse(evt.data);
        applyCumulativeUpdate(parsed);
      } catch (e) {}
    };

    es.addEventListener('inventory', handleInventoryEvent);
    es.onmessage = handleInventoryEvent;

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
      es.removeEventListener('inventory', handleInventoryEvent);
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [enabled, usePollingFallback, applyCumulativeUpdate]);

  // Polling fallback when EventSource is unavailable or interrupted
  const pollBatch = useCallback(async () => {
    try {
      const state = await inventoryService.getInventoryStream();
      applyCumulativeUpdate(state);
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Error streaming inventory');
    }
  }, [applyCumulativeUpdate]);

  usePolling(pollBatch, 2000, enabled && usePollingFallback);

  // Load top 10 alerts
  const loadAlerts = useCallback(async () => {
    if (alertsAbortRef.current) {
      alertsAbortRef.current.abort();
    }
    const controller = new AbortController();
    alertsAbortRef.current = controller;

    if (isMountedRef.current) {
      setIsLoadingAlerts(true);
    }

    try {
      const data = await inventoryService.getInventoryAlerts({ signal: controller.signal });
      if (!isMountedRef.current) return;
      const safeAlerts = Array.isArray(data) ? data : [];
      cachedAlerts = safeAlerts;
      hasLoadedAlertsOnce = true;
      setAlerts(safeAlerts);
      setError(null);
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Error fetching stock alerts');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingAlerts(false);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled && !hasLoadedAlertsOnce) {
      loadAlerts();
    }
  }, [enabled, loadAlerts]);

  useEffect(() => {
    if (enabled && backendStatus === 'ready' && !hasLoadedAlertsOnce) {
      loadAlerts();
    }
  }, [enabled, backendStatus, loadAlerts]);

  const resetCumulative = useCallback(async () => {
    try {
      const res = await inventoryService.resetInventory();
      if (!isMountedRef.current) return;
      if (res && res.cumulativeState) {
        cachedCumulativeState = res.cumulativeState;
        setCumulativeState(res.cumulativeState);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err.message || 'Error resetting inventory');
    }
  }, []);

  // Global Command Palette reset listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onCommandReset = () => resetCumulative();
    window.addEventListener('ri:reset-inventory', onCommandReset);
    return () => window.removeEventListener('ri:reset-inventory', onCommandReset);
  }, [resetCumulative]);

  return {
    cumulativeState,
    alerts,
    isLoadingAlerts,
    transportMode,
    error,
    refetchAlerts: loadAlerts,
    resetCumulative
  };
};

export default useInventoryStream;
