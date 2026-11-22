/**
 * EDA Analytics Service
 * Client API for fetching the 4 Exploratory Data Analysis datasets.
 */

import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

export const edaService = {
  /**
   * Fetches monthly revenue trend.
   */
  async getRevenueTrend(options = {}) {
    return apiClient.get(API_ENDPOINTS.EDA_REVENUE, options);
  },

  /**
   * Fetches top 10 best-selling categories by quantity.
   */
  async getTopCategories(options = {}) {
    return apiClient.get(API_ENDPOINTS.EDA_CATEGORIES, options);
  },

  /**
   * Fetches channel revenue split.
   */
  async getChannelSplit(options = {}) {
    return apiClient.get(API_ENDPOINTS.EDA_CHANNELS, options);
  },

  /**
   * Fetches return rates by product division.
   */
  async getReturnRate(options = {}) {
    return apiClient.get(API_ENDPOINTS.EDA_RETURNS, options);
  },

  /**
   * Fetches all 4 EDA datasets concurrently.
   */
  async getAllEdaData(options = {}) {
    const [revenueTrend, topCategories, channelSplit, returnRate] = await Promise.all([
      this.getRevenueTrend(options),
      this.getTopCategories(options),
      this.getChannelSplit(options),
      this.getReturnRate(options)
    ]);

    return {
      revenueTrend,
      topCategories,
      channelSplit,
      returnRate
    };
  }
};

export default edaService;
