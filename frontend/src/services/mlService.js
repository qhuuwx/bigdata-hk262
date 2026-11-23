/**
 * Machine Learning Frontend Service (frontend/src/services/mlService.js)
 * Client API for fetching empirical ML benchmark metrics, 3-way ML forecasts
 * with 80% prediction intervals, and probabilistic inventory risk classification.
 */

import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

export const mlService = {
  /**
   * Fetches empirical CV benchmark metrics comparing ML models against SMA-4 and Super-WMA baselines.
   * @param {Object} [options]
   */
  async getMetrics(options = {}) {
    return apiClient.get(API_ENDPOINTS.ML_METRICS, options);
  },

  /**
   * Requests 3-way demand forecast (Normal SMA-4, Super WMA, and ML Hybrid GBDT + 80% CI).
   * @param {{ category: string, store: string, periods: number }} params
   * @param {Object} [options]
   */
  async postMlForecast(params, options = {}) {
    return apiClient.post(API_ENDPOINTS.ML_FORECAST, params, options);
  } ,

  /**
   * Classifies an inventory item with calibrated 3-class probabilities (healthy, low, over)
   * and dead-stock detection.
   * @param {{ qtyOnHand: number, avgDailySales: number, category?: string, store?: string }} params
   * @param {Object} [options]
   */
  async classifyInventory(params, options = {}) {
    return apiClient.post(API_ENDPOINTS.ML_CLASSIFY_INVENTORY, params, options);
  }
};

export default mlService;
