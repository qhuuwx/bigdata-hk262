/**
 * Demand Forecast Hook
 * Manages category/store dropdown options, user input form, and dual-algorithm forecast results.
 * Preserves selections and forecast results across tab switches, supports natural multi-digit
 * keyboard entry for periods (clamping on blur/submit), and auto-retries after 503 startup.
 */

import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import forecastService from '../services/forecastService';
import AppContext from '../context/AppContext';

const MIN_PERIODS = 4;
const MAX_PERIODS = 24;
const DEFAULT_PERIODS = 8;

let cachedForecastState = {
  categories: [],
  stores: [],
  selectedCategory: '',
  selectedStore: '',
  periods: DEFAULT_PERIODS,
  forecastResult: null,
  hasLoadedMeta: false
};

export const clampPeriodsValue = (val) => {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return DEFAULT_PERIODS;
  return Math.min(MAX_PERIODS, Math.max(MIN_PERIODS, parsed));
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
  const [isLoadingMeta, setIsLoadingMeta] = useState(!cachedForecastState.hasLoadedMeta);
  const [isForecasting, setIsForecasting] = useState(false);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);
  const metaAbortRef = useRef(null);
  const forecastAbortRef = useRef(null);
  const forecastSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (metaAbortRef.current) metaAbortRef.current.abort();
      if (forecastAbortRef.current) forecastAbortRef.current.abort();
    };
  }, []);

  const setSelectedCategory = useCallback((val) => {
    cachedForecastState.selectedCategory = val;
    setSelectedCategoryState(val);
  }, []);

  const setSelectedStore = useCallback((val) => {
    cachedForecastState.selectedStore = val;
    setSelectedStoreState(val);
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

      if (safeCats.length > 0 && !cachedForecastState.selectedCategory) {
        cachedForecastState.selectedCategory = safeCats[0];
        setSelectedCategoryState(safeCats[0]);
      }
      if (safeSts.length > 0 && !cachedForecastState.selectedStore) {
        cachedForecastState.selectedStore = safeSts[0];
        setSelectedStoreState(safeSts[0]);
      }
      setError(null);
    } catch (err) {
      if (err.isCanceled || err.name === 'AbortError' || !isMountedRef.current) return;
      setError(err.message || 'Failed to load forecast categories and stores');
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMeta(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!cachedForecastState.hasLoadedMeta) {
      loadMetadata();
    }
  }, [loadMetadata]);

  // Automatically retry loading metadata once backend transitions to 'ready'
  useEffect(() => {
    if (backendStatus === 'ready' && !cachedForecastState.hasLoadedMeta) {
      loadMetadata();
    }
  }, [backendStatus, loadMetadata]);

  /**
   * Allows natural typing of multi-digit numbers (e.g. '1', '12', '24') or clearing input
   * without prematurely clamping on intermediate keystrokes.
   */
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

  /**
   * Clamps periods to [4, 24] when the input loses focus.
   */
  const handlePeriodBlur = useCallback(() => {
    setPeriodsState(prev => {
      const clamped = clampPeriodsValue(prev);
      cachedForecastState.periods = clamped;
      return clamped;
    });
  }, []);

  const runForecast = useCallback(async () => {
    if (!selectedCategory || !selectedStore) {
      setError('Vui lòng chọn Category và Store');
      return;
    }

    const effectivePeriods = clampPeriodsValue(periods);
    if (effectivePeriods !== periods) {
      cachedForecastState.periods = effectivePeriods;
      setPeriodsState(effectivePeriods);
    }

    if (forecastAbortRef.current) {
      forecastAbortRef.current.abort();
    }
    const controller = new AbortController();
    forecastAbortRef.current = controller;
    const reqId = ++forecastSeqRef.current;

    setIsForecasting(true);
    setError(null);
    try {
      const result = await forecastService.postForecast(
        {
          category: selectedCategory,
          store: selectedStore,
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
  }, [selectedCategory, selectedStore, periods]);

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
    isLoadingMeta,
    isForecasting,
    error,
    runForecast
  };
};

export default useForecast;
