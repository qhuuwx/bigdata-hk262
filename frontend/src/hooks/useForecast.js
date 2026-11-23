/**
 * Demand Forecast Hook
 * Manages category/store dropdown options, user input form, dual-algorithm + ML forecast results,
 * 80% confidence band visibility, comparison table mode, and empirical ML benchmark metrics.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import forecastService from '../services/forecastService';
import mlService from '../services/mlService';
import AppContext, { updateUrlSearchParams } from '../context/AppContext';

const MIN_PERIODS = 4;
const MAX_PERIODS = 24;
const DEFAULT_PERIODS = 8;

export const clampPeriodsValue = (val) => {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return DEFAULT_PERIODS;
  return Math.min(MAX_PERIODS, Math.max(MIN_PERIODS, parsed));
};

function readInitialForecastFromUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return { category: '', store: '', periods: DEFAULT_PERIODS };
  }
  const params = new URLSearchParams(window.location.search);
  const rawPeriods = params.get('periods');
  return {
    category: params.get('category') || '',
    store: params.get('store') || '',
    periods: rawPeriods ? clampPeriodsValue(rawPeriods) : DEFAULT_PERIODS
  };
}

const initialUrlParams = readInitialForecastFromUrl();

let cachedForecastState = {
  categories: [],
  stores: [],
  selectedCategory: initialUrlParams.category,
  selectedStore: initialUrlParams.store,
  periods: initialUrlParams.periods,
  forecastResult: null,
  mlMetrics: null,
  showConfidenceBand: true,
  tableViewMode: 'diff',
  hasLoadedMeta: false,
  hasLoadedMetrics: false
};

export const useForecast = () => {
  const appCtx = useContext(AppContext);
  const backendStatus = appCtx ? appCtx.backendStatus : 'ready';

  const [categories, setCategories] = useState(cachedForecastState.categories);
  const [stores, setStores] = useState(cachedForecastState.stores);
  const [selectedCategory, setSelectedCategoryState] = useState(cachedForecastState.selectedCategory);
  const [selectedStore, setSelectedStoreState] = useState(cachedForecastState.selectedStore);
  const [periods, setPeriodsState] = useState(cachedForecastState.periods);

  const [forecastResult, setForecastResult] = useState(cachedForecastState.forecastResult);
  const [mlMetrics, setMlMetrics] = useState(cachedForecastState.mlMetrics);
  const [showConfidenceBand, setShowConfidenceBandState] = useState(cachedForecastState.showConfidenceBand);
  const [tableViewMode, setTableViewModeState] = useState(cachedForecastState.tableViewMode);

  const [isLoadingMeta, setIsLoadingMeta] = useState(!cachedForecastState.hasLoadedMeta);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(!cachedForecastState.hasLoadedMetrics);
  const [isForecasting, setIsForecasting] = useState(false);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const metaAbortRef = useRef(null);
  const metricsAbortRef = useRef(null);
  const forecastAbortRef = useRef(null);
  const forecastSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (metaAbortRef.current) metaAbortRef.current.abort();
      if (metricsAbortRef.current) metricsAbortRef.current.abort();
      if (forecastAbortRef.current) forecastAbortRef.current.abort();
    };
  }, []);

  const setSelectedCategory = useCallback((val) => {
    cachedForecastState.selectedCategory = val;
    setSelectedCategoryState(val);
    updateUrlSearchParams({ category: val }, false);
  }, []);

  const setSelectedStore = useCallback((val) => {
    cachedForecastState.selectedStore = val;
    setSelectedStoreState(val);
    updateUrlSearchParams({ store: val }, false);
  }, []);

  const setShowConfidenceBand = useCallback((valOrUpdater) => {
    setShowConfidenceBandState((prev) => {
      const next = typeof valOrUpdater === 'function' ? valOrUpdater(prev) : Boolean(valOrUpdater);
      cachedForecastState.showConfidenceBand = next;
      return next;
    });
  }, []);

  const setTableViewMode = useCallback((mode) => {
    cachedForecastState.tableViewMode = mode;
    setTableViewModeState(mode);
  }, []);

  const loadMlMetrics = useCallback(async () => {
    if (metricsAbortRef.current) {
      metricsAbortRef.current.abort();
    }
    const controller = new AbortController();
    metricsAbortRef.current = controller;

    if (isMountedRef.current) {
      setIsLoadingMetrics(true);
    }

    try {
      const report = await mlService.getMetrics({ signal: controller.signal });
      if (!isMountedRef.current) return;
      if (report && report.available) {
        cachedForecastState.mlMetrics = report;
        cachedForecastState.hasLoadedMetrics = true;
        setMlMetrics(report);
      }
    } catch (err) {
      // Non-fatal: benchmark card falls back gracefully
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMetrics(false);
      }
    }
  }, []);

  const executeForecastQuery = useCallback(async (cat, st, rawPeriods) => {
    if (!cat || !st) {
      setError('Vui lòng chọn Category và Store');
      return;
    }

    const effectivePeriods = clampPeriodsValue(rawPeriods);
    cachedForecastState.periods = effectivePeriods;
    setPeriodsState(effectivePeriods);
    updateUrlSearchParams({ category: cat, store: st, periods: effectivePeriods }, false);

    if (forecastAbortRef.current) {
      forecastAbortRef.current.abort();
    }
    const controller = new AbortController();
    forecastAbortRef.current = controller;
    const reqId = ++forecastSeqRef.current;

    if (isMountedRef.current) {
      setIsForecasting(true);
      setError(null);
    }

    try {
      const result = await forecastService.postForecast(
        {
          category: cat,
          store: st,
          periods: effectivePeriods
        },
        { signal: controller.signal }
      );
      if (!isMountedRef.current || reqId !== forecastSeqRef.current) return;
      cachedForecastState.forecastResult = result;
      setForecastResult(result);
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError') return;
      if (!isMountedRef.current || reqId !== forecastSeqRef.current) return;
      setError(err.message || 'Lỗi khi chạy thuật toán dự báo');
    } finally {
      if (isMountedRef.current && reqId === forecastSeqRef.current) {
        setIsForecasting(false);
      }
    }
  }, []);

  const loadMetadata = useCallback(async () => {
    if (metaAbortRef.current) {
      metaAbortRef.current.abort();
    }
    const controller = new AbortController();
    metaAbortRef.current = controller;

    if (isMountedRef.current) {
      setIsLoadingMeta(true);
    }

    try {
      const [cats, sts] = await Promise.all([
        forecastService.getCategories({ signal: controller.signal }),
        forecastService.getStores({ signal: controller.signal })
      ]);
      if (!isMountedRef.current) return;

      const safeCats = Array.isArray(cats) ? cats : [];
      const safeSts = Array.isArray(sts) ? sts : [];

      cachedForecastState.categories = safeCats;
      cachedForecastState.stores = safeSts;
      cachedForecastState.hasLoadedMeta = safeCats.length > 0 && safeSts.length > 0;

      setCategories(safeCats);
      setStores(safeSts);

      let nextCat = cachedForecastState.selectedCategory;
      if (safeCats.length > 0 && (!nextCat || !safeCats.includes(nextCat))) {
        nextCat = safeCats[0];
        cachedForecastState.selectedCategory = nextCat;
        setSelectedCategoryState(nextCat);
      }

      let nextStore = cachedForecastState.selectedStore;
      if (safeSts.length > 0 && (!nextStore || !safeSts.includes(nextStore))) {
        nextStore = safeSts[0];
        cachedForecastState.selectedStore = nextStore;
        setSelectedStoreState(nextStore);
      }

      setError(null);

      if (!cachedForecastState.forecastResult && nextCat && nextStore) {
        executeForecastQuery(nextCat, nextStore, cachedForecastState.periods);
      }
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Failed to load forecast categories and stores');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMeta(false);
      }
    }
  }, [executeForecastQuery]);

  useEffect(() => {
    if (!cachedForecastState.hasLoadedMeta) {
      loadMetadata();
    }
    if (!cachedForecastState.hasLoadedMetrics) {
      loadMlMetrics();
    }
  }, [loadMetadata, loadMlMetrics]);

  // Automatically retry loading metadata & ML metrics once backend transitions to 'ready'
  useEffect(() => {
    if (backendStatus === 'ready') {
      if (!cachedForecastState.hasLoadedMeta) loadMetadata();
      if (!cachedForecastState.hasLoadedMetrics) loadMlMetrics();
    }
  }, [backendStatus, loadMetadata, loadMlMetrics]);

  const handlePeriodChange = useCallback((val) => {
    if (val === '' || val === null || val === undefined) {
      cachedForecastState.periods = '';
      setPeriodsState('');
      return;
    }
    const cleaned = String(val).replace(/[^\d]/g, '');
    const nextVal = cleaned === '' ? '' : Number(cleaned);
    cachedForecastState.periods = nextVal;
    setPeriodsState(nextVal);
  }, []);

  const handlePeriodBlur = useCallback(() => {
    setPeriodsState((prev) => {
      const clamped = clampPeriodsValue(prev);
      cachedForecastState.periods = clamped;
      updateUrlSearchParams({ periods: clamped }, false);
      return clamped;
    });
  }, []);

  const runForecast = useCallback(() => {
    return executeForecastQuery(selectedCategory, selectedStore, periods);
  }, [executeForecastQuery, selectedCategory, selectedStore, periods]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onQuickForecast = (evt) => {
      const detail = evt.detail || {};
      const nextCat = detail.category || cachedForecastState.selectedCategory || cachedForecastState.categories[0];
      const nextStore = detail.store || cachedForecastState.selectedStore || cachedForecastState.stores[0];
      const nextPeriods = detail.periods ? clampPeriodsValue(detail.periods) : cachedForecastState.periods;

      if (nextCat) {
        cachedForecastState.selectedCategory = nextCat;
        setSelectedCategoryState(nextCat);
      }
      if (nextStore) {
        cachedForecastState.selectedStore = nextStore;
        setSelectedStoreState(nextStore);
      }
      if (nextCat && nextStore) {
        executeForecastQuery(nextCat, nextStore, nextPeriods);
      }
    };

    const onPopState = () => {
      const urlState = readInitialForecastFromUrl();
      if (urlState.category) {
        cachedForecastState.selectedCategory = urlState.category;
        setSelectedCategoryState(urlState.category);
      }
      if (urlState.store) {
        cachedForecastState.selectedStore = urlState.store;
        setSelectedStoreState(urlState.store);
      }
      cachedForecastState.periods = urlState.periods;
      setPeriodsState(urlState.periods);
    };

    window.addEventListener('ri:quick-forecast', onQuickForecast);
    window.addEventListener('ri:url-popstate', onPopState);
    return () => {
      window.removeEventListener('ri:quick-forecast', onQuickForecast);
      window.removeEventListener('ri:url-popstate', onPopState);
    };
  }, [executeForecastQuery]);

  return {
    categories,
    stores,
    selectedCategory,
    setSelectedCategory,
    selectedStore,
    setSelectedStore,
    periods,
    setPeriods: handlePeriodChange,
    handlePeriodBlur,
    forecastResult,
    mlMetrics,
    isLoadingMetrics,
    showConfidenceBand,
    setShowConfidenceBand,
    tableViewMode,
    setTableViewMode,
    isLoadingMeta,
    isForecasting,
    error,
    runForecast
  };
};

export default useForecast;
