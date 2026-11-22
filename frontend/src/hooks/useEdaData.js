/**
 * EDA Data Hook
 * Loads and caches the 4 Exploratory Data Analysis datasets for Tab 1.
 * Includes AbortController cancellation, race guards, tab-switch state persistence,
 * and automatic retry when backendStatus transitions from 'loading' (503) to 'ready'.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import edaService from '../services/edaService';
import AppContext from '../context/AppContext';

let cachedEdaData = {
  revenueTrend: [],
  topCategories: [],
  channelSplit: [],
  returnRate: []
};
let hasLoadedEdaOnce = false;

export const useEdaData = () => {
  const appCtx = useContext(AppContext);
  const backendStatus = appCtx ? appCtx.backendStatus : 'ready';

  const [edaData, setEdaData] = useState(cachedEdaData);
  const [isLoading, setIsLoading] = useState(!hasLoadedEdaOnce);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestSeqRef.current;

    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const data = await edaService.getAllEdaData({ signal: controller.signal });
      if (!isMountedRef.current || reqId !== requestSeqRef.current) return;

      const normalized = {
        revenueTrend: Array.isArray(data?.revenueTrend) ? data.revenueTrend : [],
        topCategories: Array.isArray(data?.topCategories) ? data.topCategories : [],
        channelSplit: Array.isArray(data?.channelSplit) ? data.channelSplit : [],
        returnRate: Array.isArray(data?.returnRate) ? data.returnRate : []
      };

      cachedEdaData = normalized;
      hasLoadedEdaOnce = true;
      setEdaData(normalized);
      setError(null);
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError') return;
      if (!isMountedRef.current || reqId !== requestSeqRef.current) return;
      setError(err.message || 'Failed to load EDA analytics');
    } finally {
      if (isMountedRef.current && reqId === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Load on initial mount if not already cached
  useEffect(() => {
    if (!hasLoadedEdaOnce) {
      loadData();
    }
  }, [loadData]);

  // Automatically recover if mounted during 503 readiness window once backend becomes 'ready'
  useEffect(() => {
    if (backendStatus === 'ready' && (!hasLoadedEdaOnce || error)) {
      loadData();
    }
  }, [backendStatus, error, loadData]);

  return {
    edaData,
    isLoading,
    error,
    refetch: loadData
  };
};

export default useEdaData;
