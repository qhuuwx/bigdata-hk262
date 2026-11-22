/**
 * Demand Forecasting Service
 * Coordinates Normal Forecast (SMA) and Super Forecast (WMA + Seasonality) algorithms,
 * identifies up to 8 differing periods, and provides category/store metadata.
 * Uses a bounded LRU Map cache to prevent unbounded memory growth under arbitrary queries.
 */

const dataLoaderService = require('./dataLoaderService');
const { runForecast, runForecastSuper } = require('../algorithms');
const { calcDiffPercent, roundTo } = require('../utils');
const { CONSTANTS } = require('../config');

class ForecastService {
  constructor() {
    this._forecastCache = new Map();
    this._maxCacheEntries = CONSTANTS.FORECAST.MAX_CACHE_ENTRIES || 1500;
  }

  /**
   * Retrieves list of distinct categories from data.
   */
  getCategories() {
    return dataLoaderService.getDistinctCategories();
  }

  /**
   * Retrieves list of distinct stores from data.
   */
  getStores() {
    return dataLoaderService.getDistinctStores();
  }

  /**
   * Clears the memoized forecast cache.
   */
  clearCache() {
    this._forecastCache.clear();
  }

  /**
   * Generates comparison forecast for category and store over N periods.
   * @param {string} category
   * @param {string} store
   * @param {number} periods
   * @returns {{ periods: string[], normalForecast: number[], superForecast: number[], differences: Array<Object> }}
   */
  generateForecast(category, store, periods) {
    const numPeriods = Number(periods) || CONSTANTS.FORECAST.DEFAULT_PERIODS;
    const cat = (category || '').trim();
    const st = (store || '').trim();

    // Check internal bounded LRU cache (keyed also by current month so seasonality stays accurate across month boundaries)
    const currentMonth = new Date().getMonth();
    const cacheKey = `${currentMonth}:::${cat}:::${st}:::${numPeriods}`;

    if (this._forecastCache.has(cacheKey)) {
      const cached = this._forecastCache.get(cacheKey);
      // Refresh LRU insertion order
      this._forecastCache.delete(cacheKey);
      this._forecastCache.set(cacheKey, cached);
      return cached;
    }

    const { history, monthlyAvg, overallAvg } = dataLoaderService.getMonthlySalesHistory(cat, st);

    const normalForecast = runForecast(history, numPeriods, CONSTANTS.FORECAST.DEFAULT_WINDOW_SIZE);
    const superForecast = runForecastSuper(history, numPeriods, monthlyAvg, overallAvg);

    const periodsLabels = Array.from({ length: numPeriods }, (_, i) => `T+${i + 1}`);

    const differences = [];
    for (let i = 0; i < numPeriods; i++) {
      const normalVal = Number(normalForecast[i]) || 0;
      const superVal = Number(superForecast[i]) || 0;

      // Compare rounded to 2 decimal places with toFixed(2)
      if (normalVal.toFixed(2) !== superVal.toFixed(2)) {
        const diffVal = roundTo(Math.abs(superVal - normalVal), 2);
        const diffPercent = calcDiffPercent(normalVal, superVal);
        const higher = superVal > normalVal ? 'Super Forecast' : 'Normal Forecast';

        differences.push({
          period: periodsLabels[i],
          normal: normalVal,
          super: superVal,
          diff: diffVal,
          diffPercent,
          higher
        });

        if (differences.length >= CONSTANTS.FORECAST.MAX_DIFFERENCES_ROWS) {
          break;
        }
      }
    }

    const result = {
      periods: periodsLabels,
      normalForecast,
      superForecast,
      differences
    };

    // Evict oldest entry if cache exceeds capacity
    if (this._forecastCache.size >= this._maxCacheEntries) {
      const oldestKey = this._forecastCache.keys().next().value;
      if (oldestKey !== undefined) {
        this._forecastCache.delete(oldestKey);
      }
    }

    this._forecastCache.set(cacheKey, result);
    return result;
  }
}

module.exports = new ForecastService();
