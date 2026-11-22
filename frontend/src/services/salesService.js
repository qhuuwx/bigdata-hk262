/**
 * Sales Service
 * Client API for streaming sales transactions.
 */

import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

export const salesService = {
  /**
   * Fetches 20 random live transactions from backend.
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async getSalesStream(options = {}) {
    return apiClient.get(API_ENDPOINTS.STREAM_SALES, options);
  }
};

export default salesService;
