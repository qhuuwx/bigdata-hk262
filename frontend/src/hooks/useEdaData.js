/**
 * EDA Data Hook
 * Loads and caches the 4 Exploratory Data Analysis datasets for Tab 1.
 */

import { useState, useEffect, useCallback } from 'react';
import edaService from '../services/edaService';

export const useEdaData = () => {
  const [edaData, setEdaData] = useState({
    revenueTrend: [],
    topCategories: [],
    channelSplit: [],
    returnRate: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await edaService.getAllEdaData();
      setEdaData(data);
    } catch (err) {
      setError(err.message || 'Failed to load EDA analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    edaData,
    isLoading,
    error,
    refetch: loadData
  };
};

export default useEdaData;
