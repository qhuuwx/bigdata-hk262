/**
 * EDA Data Hook
 * Loads and caches the 4 Exploratory Data Analysis datasets for Tab 1 with interactive
 * multi-dimensional filters (store, division, startMonth, endMonth) synced to URL search params.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import edaService from '../services/edaService';
import AppContext, { updateUrlSearchParams } from '../context/AppContext';

const DEFAULT_FILTERS = {
  store: 'ALL',
  division: 'ALL',
  startMonth: 'ALL',
  endMonth: 'ALL'
};

function readInitialFiltersFromUrl() {
  if (typeof window === 'undefined' || !window.location) return { ...DEFAULT_FILTERS };
  const params = new URLSearchParams(window.location.search);
  return {
    store: params.get('edaStore') || 'ALL',
    division: params.get('division') || 'ALL',
    startMonth: params.get('startMonth') || 'ALL',
    endMonth: params.get('endMonth') || 'ALL'
  };
}

let cachedEdaData = {
  revenueTrend: [],
  topCategories: [],
  channelSplit: [],
  returnRate: []
};
let cachedFilterMeta = {
  stores: [],
  divisions: [],
  months: []
};
let cachedFilters = readInitialFiltersFromUrl();
let hasLoadedEdaOnce = false;
let hasLoadedMetaOnce = false;

export const useEdaData = () => {
  const appCtx = useContext(AppContext);
  const backendStatus = appCtx ? appCtx.backendStatus : 'ready';

  const [edaData, setEdaData] = useState(cachedEdaData);
  const [filterMeta, setFilterMeta] = useState(cachedFilterMeta);
  const [filters, setFilters] = useState(cachedFilters);
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

  const loadMetadata = useCallback(async () => {
    try {
      const meta = await edaService.getFilterMetadata();
      if (!isMountedRef.current || !meta) return;
      const normalizedMeta = {
        stores: Array.isArray(meta.stores) ? meta.stores : [],
        divisions: Array.isArray(meta.divisions) ? meta.divisions : [],
        months: Array.isArray(meta.months) ? meta.months : []
      };
      cachedFilterMeta = normalizedMeta;
      hasLoadedMetaOnce = normalizedMeta.stores.length > 0;
      setFilterMeta(normalizedMeta);
    } catch (e) {
      // Non-fatal; retried on backendStatus === 'ready'
    }
  }, []);

  const loadData = useCallback(async (activeFilters = filters) => {
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
      const data = await edaService.getAllEdaData({ signal: controller.signal }, activeFilters);
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
  }, [filters]);

  useEffect(() => {
    if (!hasLoadedMetaOnce) {
      loadMetadata();
    }
  }, [loadMetadata]);

  useEffect(() => {
    if (!hasLoadedEdaOnce) {
      loadData(filters);
    }
  }, [loadData, filters]);

  // Recover automatically once backend transitions from 'loading' (503) to 'ready'
  useEffect(() => {
    if (backendStatus === 'ready') {
      if (!hasLoadedMetaOnce) loadMetadata();
      if (!hasLoadedEdaOnce || error) loadData(filters);
    }
  }, [backendStatus, error, filters, loadData, loadMetadata]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value || 'ALL' };
      if (next.startMonth !== 'ALL' && next.endMonth !== 'ALL' && next.startMonth > next.endMonth) {
        if (key === 'startMonth') next.endMonth = next.startMonth;
        else next.startMonth = next.endMonth;
      }
      cachedFilters = next;
      updateUrlSearchParams({
        edaStore: next.store,
        division: next.division,
        startMonth: next.startMonth,
        endMonth: next.endMonth
      }, false);
      loadData(next);
      return next;
    });
  }, [loadData]);

  const resetFilters = useCallback(() => {
    const next = { ...DEFAULT_FILTERS };
    cachedFilters = next;
    setFilters(next);
    updateUrlSearchParams({
      edaStore: null,
      division: null,
      startMonth: null,
      endMonth: null
    }, false);
    loadData(next);
  }, [loadData]);

  // Listen to browser Back/Forward popstate and Command Palette filter reset
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const urlFilters = readInitialFiltersFromUrl();
      cachedFilters = urlFilters;
      setFilters(urlFilters);
      loadData(urlFilters);
    };
    const onCommandReset = () => resetFilters();

    window.addEventListener('ri:url-popstate', onPopState);
    window.addEventListener('ri:reset-eda-filters', onCommandReset);
    return () => {
      window.removeEventListener('ri:url-popstate', onPopState);
      window.removeEventListener('ri:reset-eda-filters', onCommandReset);
    };
  }, [loadData, resetFilters]);

  const activeFilterPills = [];
  if (filters.store !== 'ALL') activeFilterPills.push({ key: 'store', label: `Store: ${filters.store}` });
  if (filters.division !== 'ALL') activeFilterPills.push({ key: 'division', label: `Division: ${filters.division}` });
  if (filters.startMonth !== 'ALL') activeFilterPills.push({ key: 'startMonth', label: `From: ${filters.startMonth}` });
  if (filters.endMonth !== 'ALL') activeFilterPills.push({ key: 'endMonth', label: `To: ${filters.endMonth}` });

  return {
    edaData,
    filterMeta,
    filters,
    activeFilterPills,
    updateFilter,
    resetFilters,
    isLoading,
    error,
    refetch: () => loadData(filters)
  };
};

export default useEdaData;
