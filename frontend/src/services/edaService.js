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
  async getRevenueTrend() {
    return apiClient.get(API_ENDPOINTS.EDA_REVENUE);
  },

  /**
   * Fetches top 10 best-selling categories by quantity.
   */
  async getTopCategories() {
    return apiClient.get(API_ENDPOINTS.EDA_CATEGORIES);
  },

  /**
   * Fetches channel revenue split.
   */
  async getChannelSplit() {
    return apiClient.get(API_ENDPOINTS.EDA_CHANNELS);
  },

  /**
   * Fetches return rates by product division.
   */
  async getReturnRate() {
    return apiClient.get(API_ENDPOINTS.EDA_RETURNS);
  },

  /**
   * Fetches all 4 EDA datasets concurrently.
   */
  async getAllEdaData() {
    const [revenueTrend, topCategories, channelSplit, returnRate] = await Promise.all([
      this.getRevenueTrend(),
      this.getTopCategories(),
      this.getChannelSplit(),
      this.getReturnRate()
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
