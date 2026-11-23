/**
 * Sales Stream Service
 * Provides randomized batches of 20 live transactions via DataRepository.
 */

const { dataRepository } = require('../repositories');
const { CONSTANTS } = require('../config');

class SalesStreamService {
  /**
   * Generates a sample of random sales transactions.
   * Safely handles invalid, non-positive, or oversized batchSize parameters.
   * @param {number} [batchSize=20]
   * @returns {Array<Object>}
   */
  getSalesStream(batchSize = CONSTANTS.STREAM.SALES_BATCH_SIZE) {
    const parsedSize = Number(batchSize);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      return [];
    }

    const safeBatchSize = Math.min(Math.floor(parsedSize), 500);
    return dataRepository.getSalesStreamBatch(safeBatchSize);
  }
}

module.exports = new SalesStreamService();
