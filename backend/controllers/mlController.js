/**
 * Machine Learning Controller (backend/controllers/mlController.js)
 * Exposes ML model comparison metrics, 3-way ML forecast trajectories, and probabilistic inventory risk scoring.
 */

const mlService = require('../services/mlService');
const { CONSTANTS } = require('../config');

class MlController {
  /**
   * GET /api/ml/metrics
   * Returns empirical benchmark metrics comparing ML models against SMA-4 and Super-WMA baselines.
   */
  getMetrics(req, res) {
    const report = mlService.getModelComparisonReport();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(report);
  }

  /**
   * POST /api/ml/forecast
   * Body: { category: string, store: string, periods?: number }
   */
  runMlForecast(req, res) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Request body is required'
      });
    }

    const { category, store, periods = 8 } = req.body;
    const maxLen = CONSTANTS.FORECAST.MAX_INPUT_LENGTH || 200;

    if (!category || typeof category !== 'string' || !category.trim() || category.trim().length > maxLen) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Valid category is required'
      });
    }
    if (!store || typeof store !== 'string' || !store.trim() || store.trim().length > maxLen) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Valid store is required'
      });
    }

    const numPeriods = Number(periods);
    if (
      typeof periods === 'boolean' ||
      !Number.isInteger(numPeriods) ||
      numPeriods < CONSTANTS.FORECAST.MIN_PERIODS ||
      numPeriods > CONSTANTS.FORECAST.MAX_PERIODS
    ) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: `Periods must be an integer between ${CONSTANTS.FORECAST.MIN_PERIODS} and ${CONSTANTS.FORECAST.MAX_PERIODS}`
      });
    }

    const result = mlService.compareForecasts(category.trim(), store.trim(), numPeriods);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(result);
  }

  /**
   * POST /api/ml/classify-inventory
   * Body: { qtyOnHand: number, avgDailySales: number, category?: string, store?: string }
   */
  classifyInventory(req, res) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
        error: 'Request body is required'
      });
    }
    const result = mlService.classifyInventoryWithProbabilities(req.body);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(result);
  }
}

module.exports = new MlController();
