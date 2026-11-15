/**
 * Business & System Constants
 * Centralized constants to prevent magic numbers across the application.
 */

const CONSTANTS = {
  FORECAST: {
    DEFAULT_PERIODS: 8,
    MIN_PERIODS: 4,
    MAX_PERIODS: 24,
    DEFAULT_WINDOW_SIZE: 4,
    WEIGHTS: [1, 2, 3, 4],
    MAX_DIFFERENCES_ROWS: 8
  },
  INVENTORY: {
    COVER_DAYS_HEALTHY: 14,
    COVER_DAYS_OVERSTOCK: 60,
    SALES_LOOKBACK_DAYS: 30,
    STREAM_BATCH_SIZE: 50,
    ALERTS_LIMIT: 10,
    STATUS: {
      HEALTHY: 'healthy',
      LOW: 'low',
      OVER: 'over'
    },
    COLORS: {
      HEALTHY: '#22c55e',
      LOW: '#f97316',
      OVER: '#ef4444'
    }
  },
  STREAM: {
    SALES_BATCH_SIZE: 20,
    TABLE_MAX_ROWS: 100,
    POLLING_INTERVAL_MS: 2000
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  }
};

module.exports = CONSTANTS;
