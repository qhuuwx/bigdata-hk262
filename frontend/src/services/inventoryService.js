/**
 * Inventory Intelligence Service
 * Client API for cumulative inventory streaming and stock alerts.
 */

import apiClient from './apiClient';
import { API_ENDPOINTS } from '../config/apiConfig';

export const inventoryService = {
  /**
   * Fetches latest 50-item cumulative stream update.
   */
  async getInventoryStream(options = {}) {
    return apiClient.get(API_ENDPOINTS.INVENTORY_STREAM, options);
  },

  /**
   * Fetches top 10 prioritized stock alerts.
   */
  async getInventoryAlerts(options = {}) {
    return apiClient.get(API_ENDPOINTS.INVENTORY_ALERTS, options);
  },

  /**
   * Resets server-side cumulative counts.
   */
  async resetInventory(options = {}) {
    return apiClient.post(API_ENDPOINTS.INVENTORY_RESET, {}, options);
  }
};

export default inventoryService;
