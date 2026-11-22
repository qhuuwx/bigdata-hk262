/**
 * Inventory Stream Hook
 * Periodically streams classified inventory batches (every 2s) to update cumulative Doughnut chart,
 * and maintains top 10 prioritized stock alerts.
 * Preserves cumulative counts and alerts across tab switches and recovers after startup 503.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import inventoryService from '../services/inventoryService';
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
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const alertsAbortRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (alertsAbortRef.current) {
        alertsAbortRef.current.abort();
      }
    };
  }, []);

  // Poll 50-record batch every 2 seconds to accumulate counts
  const pollBatch = useCallback(async () => {
    try {
      const state = await inventoryService.getInventoryStream();
      if (!isMountedRef.current) return;
      if (state && typeof state.total === 'number') {
        cachedCumulativeState = state;
        setCumulativeState(state);
        setError(null);
      }
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Error streaming inventory');
    }
  }, []);

  usePolling(pollBatch, 2000, enabled);

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

  return {
    cumulativeState,
    alerts,
    isLoadingAlerts,
    error,
    refetchAlerts: loadAlerts,
    resetCumulative
  };
};

export default useInventoryStream;
