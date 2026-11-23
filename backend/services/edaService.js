/**
 * EDA Analytics Service
 * Routes business intelligence queries through the unified DataRepository abstraction
 * (supports InMemory, Lakehouse Gold Marts, and Shadow Parity modes).
 */

const { dataRepository } = require('../repositories');

class EdaService {
  /**
   * Retrieves revenue trend grouped by month.
   * @param {Object} [filters]
   */
  getRevenueTrend(filters = {}) {
    return dataRepository.queryFilteredEda(filters).revenueTrend || [];
  }

  /**
   * Retrieves top 10 best-selling product categories by Qty Sold.
   * @param {Object} [filters]
   */
  getTopCategories(filters = {}) {
    return dataRepository.queryFilteredEda(filters).topCategories || [];
  }

  /**
   * Retrieves revenue distribution across sales channels.
   * @param {Object} [filters]
   */
  getChannelSplit(filters = {}) {
    return dataRepository.queryFilteredEda(filters).channelSplit || [];
  }

  /**
   * Retrieves return rates (%) by product division.
   * @param {Object} [filters]
   */
  getReturnRate(filters = {}) {
    return dataRepository.queryFilteredEda(filters).returnRate || [];
  }

  /**
   * Retrieves distinct filter dimensions (stores, divisions, categories, months).
   */
  getFilterMetadata() {
    return dataRepository.getEdaMetadata();
  }
}

module.exports = new EdaService();
