/**
 * Inventory Intelligence Service
 * Manages cumulative inventory state across server lifecycle,
 * streams classified inventory batches via DataRepository, and serves top 10 prioritized stock alerts.
 */

const { dataRepository } = require('../repositories');
const { CONSTANTS } = require('../config');

class InventoryService {
  constructor() {
    this._cumulativeState = {
      healthy: 0,
      low: 0,
      over: 0
    };
  }

  /**
   * Returns current snapshot copy of cumulative state.
   */
  getCumulativeState() {
    const { healthy, low, over } = this._cumulativeState;
    return {
      healthy,
      low,
      over,
      total: healthy + low + over
    };
  }

  /**
   * Resets cumulative inventory counts atomically.
   */
  resetCumulativeState() {
    this._cumulativeState = {
      healthy: 0,
      low: 0,
      over: 0
    };
    return this.getCumulativeState();
  }

  /**
   * Streams a batch of 50 inventory records, classifies via DataRepository,
   * accumulates into persistent state atomically, and returns updated totals.
   * @param {number} [batchSize=50]
   */
  processStreamBatch(batchSize = CONSTANTS.INVENTORY.STREAM_BATCH_SIZE) {
    const parsedSize = Number(batchSize);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      return this.getCumulativeState();
    }

    const safeBatchSize = Math.min(Math.floor(parsedSize), 5000);
    const delta = dataRepository.classifyRandomInventoryBatch(safeBatchSize);

    this._cumulativeState.healthy += delta.healthy;
    this._cumulativeState.low += delta.low;
    this._cumulativeState.over += delta.over;

    return this.getCumulativeState();
  }

  /**
   * Retrieves top 10 inventory alerts prioritized by Low Stock then Overstock.
   */
  getAlerts() {
    return dataRepository.getInventoryAlertsCache();
  }
}

module.exports = new InventoryService();
