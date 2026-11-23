/**
 * EDA Analytics Service
 * Client API for fetching the 4 Exploratory Data Analysis datasets and filter dimensions.
 * Supports optional query parameters (?store=&division=&startMonth=&endMonth=).
 */

import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

function buildFilterQuery(filters = {}) {
  if (!filters || typeof filters !== 'object') return '';
  const params = new URLSearchParams();
  if (filters.store && filters.store !== 'ALL') params.set('store', filters.store);
  if (filters.division && filters.division !== 'ALL') params.set('division', filters.division);
  if (filters.startMonth && filters.startMonth !== 'ALL') params.set('startMonth', filters.startMonth);
  if (filters.endMonth && filters.endMonth !== 'ALL') params.set('endMonth', filters.endMonth);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const edaService = {
  /**
   * Fetches monthly revenue trend.
   */
  async getRevenueTrend(options = {}, filters = {}) {
    return apiClient.get(`${API_ENDPOINTS.EDA_REVENUE}${buildFilterQuery(filters)}`, options);
  },

  /**
   * Fetches top 10 best-selling categories by quantity.
   */
  async getTopCategories(options = {}, filters = {}) {
    return apiClient.get(`${API_ENDPOINTS.EDA_CATEGORIES}${buildFilterQuery(filters)}`, options);
  },

  /**
   * Fetches channel revenue split.
   */
  async getChannelSplit(options = {}, filters = {}) {
    return apiClient.get(`${API_ENDPOINTS.EDA_CHANNELS}${buildFilterQuery(filters)}`, options);
  },

  /**
   * Fetches return rates by product division.
   */
  async getReturnRate(options = {}, filters = {}) {
    return apiClient.get(`${API_ENDPOINTS.EDA_RETURNS}${buildFilterQuery(filters)}`, options);
  },

  /**
   * Fetches filter dimensions (stores, divisions, categories, months).
   */
  async getFilterMetadata(options = {}) {
    return apiClient.get(API_ENDPOINTS.EDA_FILTERS, options);
  },

  /**
   * Fetches all 4 EDA datasets concurrently with optional filters.
   */
  async getAllEdaData(options = {}, filters = {}) {
    const [revenueTrend, topCategories, channelSplit, returnRate] = await Promise.all([
      this.getRevenueTrend(options, filters),
      this.getTopCategories(options, filters),
      this.getChannelSplit(options, filters),
      this.getReturnRate(options, filters)
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
