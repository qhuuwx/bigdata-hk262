/**
 * Forecast Controller
 * Handles demand forecasting comparisons and category/store dropdown options.
 */

const { forecastService } = require('../services');
const { CONSTANTS } = require('../config');

class ForecastController {
  /**
   * GET /api/categories or /api/forecast/categories
   * Returns list of distinct product categories.
   */
  getCategories(req, res) {
    const categories = forecastService.getCategories();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(categories);
  }

  /**
   * GET /api/stores or /api/forecast/stores
   * Returns list of distinct store identifiers.
   */
  getStores(req, res) {
    const stores = forecastService.getStores();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(stores);
  }

  /**
   * POST /api/forecast
   * Body: { category: string, store: string, periods: number }
   * Returns dual algorithm forecasts and up to 8 differences.
   */
  runForecast(req, res) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Request body is required'
      });
    }

    const { category, store, periods } = req.body;

    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Category is required and must be a non-empty string'
      });
    }

    if (!store || typeof store !== 'string' || !store.trim()) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Store is required and must be a non-empty string'
      });
    }

    const numPeriods = Number(periods);
    if (
      periods === undefined ||
      periods === null ||
      typeof periods === 'boolean' ||
      isNaN(numPeriods) ||
      !Number.isInteger(numPeriods) ||
      numPeriods < CONSTANTS.FORECAST.MIN_PERIODS ||
      numPeriods > CONSTANTS.FORECAST.MAX_PERIODS
    ) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: `Periods must be an integer between ${CONSTANTS.FORECAST.MIN_PERIODS} and ${CONSTANTS.FORECAST.MAX_PERIODS}`
      });
    }

    const result = forecastService.generateForecast(category.trim(), store.trim(), numPeriods);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(result);
  }
}

module.exports = new ForecastController();
