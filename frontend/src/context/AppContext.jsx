/**
 * Core Application Context
 * Exclusively manages activeTab and backendStatus/readiness.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('tab-eda');
  const [backendStatus, setBackendStatus] = useState('loading'); // 'loading' | 'ready' | 'offline'
  const [backendMeta, setBackendMeta] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      const data = await apiClient.get(API_ENDPOINTS.HEALTH, { timeoutMs: 3000 });
      setBackendMeta(data);
      if (data && data.status === 'ready') {
        setBackendStatus('ready');
      } else {
        setBackendStatus('loading');
      }
    } catch (err) {
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const value = {
    activeTab,
    setActiveTab,
    backendStatus,
    backendMeta,
    checkHealth
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
