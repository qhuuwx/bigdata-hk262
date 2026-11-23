/**
 * Frontend API Configuration
 * Determines the API base URL based on runtime environment, window port, or environment variables.
 */

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined' || !window.location) {
    return 'http://localhost:3000';
  }

  // Allow custom env override if provided (Vite environment variable)
  if (import.meta && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const { port, protocol } = window.location;

  // File protocol fallback
  if (protocol === 'file:') {
    return 'http://localhost:3000';
  }

  // Development or isolated frontend ports
  if (port === '3001' || port === '5173' || port === '8080' || port === '5500') {
    return 'http://localhost:3000';
  }

  // Served directly by backend or behind an Nginx reverse proxy (/api)
  return '';
};

export const API_ENDPOINTS = {
  STREAM_SALES: '/api/stream/sales',
  STREAM_SALES_EVENTS: '/api/stream/sales/events',
  EDA_REVENUE: '/api/eda/revenue-trend',
  EDA_CATEGORIES: '/api/eda/top-categories',
  EDA_CHANNELS: '/api/eda/channel-split',
  EDA_RETURNS: '/api/eda/return-rate',
  EDA_FILTERS: '/api/eda/filters',
  FORECAST: '/api/forecast',
  CATEGORIES: '/api/forecast/categories',
  STORES: '/api/forecast/stores',
  INVENTORY_STREAM: '/api/inventory/stream',
  INVENTORY_STREAM_EVENTS: '/api/inventory/stream/events',
  INVENTORY_ALERTS: '/api/inventory/alerts',
  INVENTORY_RESET: '/api/inventory/reset',
  ML_METRICS: '/api/ml/metrics',
  ML_FORECAST: '/api/ml/forecast',
  ML_CLASSIFY_INVENTORY: '/api/ml/classify-inventory',
  HEALTH: '/api/health'
};

export default {
  getApiBaseUrl,
  API_ENDPOINTS
};
