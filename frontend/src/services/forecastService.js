/**
 * Forecast Service
 * Client API for demand forecast options and dual-algorithm predictions.
 */

import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

export const forecastService = {
  /**
   * Fetches distinct product categories.
   */
  async getCategories(options = {}) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES, options);
  },

  /**
   * Fetches distinct store locations.
   */
  async getStores(options = {}) {
    return apiClient.get(API_ENDPOINTS.STORES, options);
  },

  /**
   * Submits forecast query comparing Normal (SMA) vs Super (WMA+Seasonality).
   * @param {{ category: string, store: string, periods: number }} params
   * @param {Object} [options]
   */
  async postForecast(params, options = {}) {
    return apiClient.post(API_ENDPOINTS.FORECAST, params, options);
  }
};

export default forecastService;
