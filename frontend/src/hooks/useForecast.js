/**
 * Demand Forecast Hook
 * Manages category/store dropdown options, user input form, and dual-algorithm forecast results.
 */

import { useState, useEffect, useCallback } from 'react';
import forecastService from '../services/forecastService';

export const useForecast = () => {
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [periods, setPeriods] = useState(8);

  const [forecastResult, setForecastResult] = useState(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isForecasting, setIsForecasting] = useState(false);
  const [error, setError] = useState(null);

  // Load dropdown options on mount
  useEffect(() => {
    let isMounted = true;
    async function loadMetadata() {
      setIsLoadingMeta(true);
      try {
        const [cats, sts] = await Promise.all([
          forecastService.getCategories(),
          forecastService.getStores()
        ]);
        if (isMounted) {
          setCategories(cats || []);
          setStores(sts || []);
          if (cats && cats.length > 0) setSelectedCategory(cats[0]);
          if (sts && sts.length > 0) setSelectedStore(sts[0]);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load forecast categories and stores');
        }
      } finally {
        if (isMounted) setIsLoadingMeta(false);
      }
    }
    loadMetadata();
    return () => { isMounted = false; };
  }, []);

  const handlePeriodChange = useCallback((val) => {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setPeriods(Math.min(24, Math.max(4, num)));
    }
  }, []);

  const runForecast = useCallback(async () => {
    if (!selectedCategory || !selectedStore) {
      setError('Vui lòng chọn Category và Store');
      return;
    }

    setIsForecasting(true);
    setError(null);
    try {
      const result = await forecastService.postForecast({
        category: selectedCategory,
        store: selectedStore,
        periods: Number(periods)
      });
      setForecastResult(result);
    } catch (err) {
      setError(err.message || 'Lỗi khi chạy thuật toán dự báo');
    } finally {
      setIsForecasting(false);
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
    forecastResult,
    isLoadingMeta,
    isForecasting,
    error,
    runForecast
  };
};

export default useForecast;
