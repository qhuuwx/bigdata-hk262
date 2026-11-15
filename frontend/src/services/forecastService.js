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
  async getCategories() {
    return apiClient.get(API_ENDPOINTS.CATEGORIES);
  },

  /**
   * Fetches distinct store locations.
   */
  async getStores() {
    return apiClient.get(API_ENDPOINTS.STORES);
  },

  /**
   * Submits forecast query comparing Normal (SMA) vs Super (WMA+Seasonality).
   * @param {{ category: string, store: string, periods: number }} params 
   */
  async postForecast(params) {
    return apiClient.post(API_ENDPOINTS.FORECAST, params);
  }
};

export default forecastService;
