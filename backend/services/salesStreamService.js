/**
 * Sales Stream Service
 * Provides randomized batches of 20 live transactions from the loaded dataset.
 */

const dataLoaderService = require('./dataLoaderService');
const { CONSTANTS } = require('../config');

class SalesStreamService {
  /**
   * Generates a sample of random sales transactions.
   * Safely handles invalid, non-positive, or oversized batchSize parameters.
   * @param {number} [batchSize=20]
   * @returns {Array<Object>}
   */
  getSalesStream(batchSize = CONSTANTS.STREAM.SALES_BATCH_SIZE) {
    const sales = dataLoaderService.getRawSales();
    if (!sales || sales.length === 0) {
      return [];
    }

    const parsedSize = Number(batchSize);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      return [];
    }

    const safeBatchSize = Math.min(Math.floor(parsedSize), 500);
    const count = Math.min(safeBatchSize, sales.length);
    const sample = [];
    const seen = new Set();

    while (seen.size < count) {
      const idx = Math.floor(Math.random() * sales.length);
      if (!seen.has(idx)) {
        seen.add(idx);
        const raw = sales[idx];
        sample.push({
          ...raw,
          'Qty Sold': Number(raw['Qty Sold']) || 0,
          'Sales Amount': Number(raw['Sales Amount']) || 0
        });
      }
    }

    return sample;
  }
}

module.exports = new SalesStreamService();
