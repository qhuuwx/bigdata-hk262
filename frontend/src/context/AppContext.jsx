/**
 * Core Application Context
 * Manages URL-synced activeTab, institutional Light/Dark theme persistence,
 * Command Palette (Cmd+K) modal state, and backend readiness telemetry.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

const AppContext = createContext(null);

const TAB_TO_SLUG = {
  'tab-eda': 'eda',
  'tab-forecast': 'forecast',
  'tab-inventory': 'inventory'
};

const SLUG_TO_TAB = {
  eda: 'tab-eda',
  'tab-eda': 'tab-eda',
  forecast: 'tab-forecast',
  'tab-forecast': 'tab-forecast',
  inventory: 'tab-inventory',
  'tab-inventory': 'tab-inventory'
};

function readInitialTabFromUrl() {
  if (typeof window === 'undefined' || !window.location) return 'tab-eda';
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get('tab') || '').toLowerCase();
  return SLUG_TO_TAB[raw] || 'tab-eda';
}

function readInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('ri_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) {}
  return 'light';
}

export function updateUrlSearchParams(updates = {}, push = false) {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  const url = new URL(window.location.href);
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined || val === null || val === '' || val === 'ALL') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(val));
    }
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (push) {
    window.history.pushState({}, '', nextUrl);
  } else {
    window.history.replaceState({}, '', nextUrl);
  }
}

export const AppProvider = ({ children }) => {
  const [activeTab, setActiveTabState] = useState(readInitialTabFromUrl);
  const [theme, setThemeState] = useState(readInitialTheme);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('loading'); // 'loading' | 'ready' | 'offline'
  const [backendMeta, setBackendMeta] = useState(null);

  // Synchronize dark mode class on <html> and persist to localStorage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    try {
      localStorage.setItem('ri_theme', theme);
    } catch (e) {}
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setActiveTab = useCallback((nextTab) => {
    const resolved = SLUG_TO_TAB[nextTab] || 'tab-eda';
    setActiveTabState(resolved);
    updateUrlSearchParams({ tab: TAB_TO_SLUG[resolved] }, true);
  }, []);

  // Ensure initial URL contains ?tab=... and handle browser Back/Forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('tab')) {
      updateUrlSearchParams({ tab: TAB_TO_SLUG[activeTab] || 'eda' }, false);
    }

    const handlePopState = () => {
      const nextTab = readInitialTabFromUrl();
      setActiveTabState(nextTab);
      window.dispatchEvent(new CustomEvent('ri:url-popstate'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global Cmd+K / Ctrl+K keyboard shortcut for Command Palette
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

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
    theme,
    setTheme,
    toggleTheme,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
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
