/**
 * Inventory Stream Hook
 * Periodically streams classified inventory batches (every 2s) to update cumulative Doughnut chart,
 * and maintains top 10 prioritized stock alerts.
 */

import { useState, useEffect, useCallback } from 'react';
import inventoryService from '../services/inventoryService';
import usePolling from './usePolling';

export const useInventoryStream = (enabled = true) => {
  const [cumulativeState, setCumulativeState] = useState({
    healthy: 0,
    low: 0,
    over: 0,
    total: 0
  });

  const [alerts, setAlerts] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [error, setError] = useState(null);

  // Poll 50-record batch every 2 seconds to accumulate counts
  const pollBatch = useCallback(async () => {
    try {
      const state = await inventoryService.getInventoryStream();
      if (state && typeof state.total === 'number') {
        setCumulativeState(state);
        setError(null);
      }
    } catch (err) {
      setError(err.message || 'Error streaming inventory');
    }
  }, []);

  usePolling(pollBatch, 2000, enabled);

  // Load top 10 alerts
  const loadAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const data = await inventoryService.getInventoryAlerts();
      setAlerts(data || []);
    } catch (err) {
      setError(err.message || 'Error fetching stock alerts');
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      loadAlerts();
    }
  }, [enabled, loadAlerts]);

  const resetCumulative = useCallback(async () => {
    try {
      const res = await inventoryService.resetInventory();
      if (res && res.cumulativeState) {
        setCumulativeState(res.cumulativeState);
      }
    } catch (err) {
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
