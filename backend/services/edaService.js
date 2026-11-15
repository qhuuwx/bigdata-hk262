/**
 * EDA Analytics Service
 * Provides business intelligence datasets for the 4 EDA charts.
 */

const dataLoaderService = require('./dataLoaderService');

class EdaService {
  /**
   * Retrieves revenue trend grouped by month.
   */
  getRevenueTrend() {
    return dataLoaderService.getEdaCache().revenueTrend || [];
  }

  /**
   * Retrieves top 10 best-selling product categories by Qty Sold.
   */
  getTopCategories() {
    return dataLoaderService.getEdaCache().topCategories || [];
  }

  /**
   * Retrieves revenue distribution across sales channels.
   */
  getChannelSplit() {
    return dataLoaderService.getEdaCache().channelSplit || [];
  }

  /**
   * Retrieves return rates (%) by product division.
   */
  getReturnRate() {
    return dataLoaderService.getEdaCache().returnRate || [];
  }
}

module.exports = new EdaService();
