/**
 * Demand Forecasting Service
 * Coordinates Normal Forecast (SMA) and Super Forecast (WMA + Seasonality) algorithms,
 * identifies up to 8 differing periods, and provides category/store metadata.
 */

const dataLoaderService = require('./dataLoaderService');
const { runForecast, runForecastSuper } = require('../algorithms');
const { calcDiffPercent, roundTo } = require('../utils');
const { CONSTANTS } = require('../config');

class ForecastService {
  constructor() {
    // Internal cache for memoized forecast computations
    this._forecastCache = new Map();
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

    // Check internal cache
    const cacheKey = `${cat}:::${st}:::${numPeriods}`;
    if (this._forecastCache.has(cacheKey)) {
      return this._forecastCache.get(cacheKey);
    }

    const { history, monthlyAvg, overallAvg } = dataLoaderService.getMonthlySalesHistory(cat, st);

    const normalForecast = runForecast(history, numPeriods, CONSTANTS.FORECAST.DEFAULT_WINDOW_SIZE);
    const superForecast = runForecastSuper(history, numPeriods, monthlyAvg, overallAvg);

    const periodsLabels = Array.from({ length: numPeriods }, (_, i) => `T+${i + 1}`);

    const differences = [];
    for (let i = 0; i < numPeriods; i++) {
      const normalVal = Number(normalForecast[i]) || 0;
      const superVal = Number(superForecast[i]) || 0;

      // As required: compare rounded to 2 decimal places with toFixed(2)
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

    // Cache the result
    this._forecastCache.set(cacheKey, result);
    return result;
  }
}

module.exports = new ForecastService();
