/**
 * Inventory Intelligence Service
 * Manages module-level cumulative state across server lifecycle,
 * streams classified inventory batches, and serves top 10 prioritized stock alerts.
 */

const dataLoaderService = require('./dataLoaderService');
const { classifyInventory } = require('../algorithms');
const { CONSTANTS } = require('../config');

class InventoryService {
  constructor() {
    // Persistent module-level cumulative inventory state
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
   * Streams a batch of 50 inventory records, classifies each using algorithms/classify,
   * accumulates into persistent state atomically, and returns updated totals.
   * Safely handles non-positive, NaN, or oversized batchSize arguments.
   * @param {number} [batchSize=50]
   */
  processStreamBatch(batchSize = CONSTANTS.INVENTORY.STREAM_BATCH_SIZE) {
    const inventory = dataLoaderService.getRawInventory();
    const parsedSize = Number(batchSize);

    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      return this.getCumulativeState();
    }

    const safeBatchSize = Math.min(Math.floor(parsedSize), 5000);

    if (inventory && inventory.length > 0) {
      let batchHealthy = 0;
      let batchLow = 0;
      let batchOver = 0;

      for (let i = 0; i < safeBatchSize; i++) {
        const idx = Math.floor(Math.random() * inventory.length);
        const item = inventory[idx];
        const prodNo = item['Product No'];
        const qtyOnHand = Number(item['Qty on hand']) || 0;
        const sales30d = dataLoaderService.getProdSales30d(prodNo);
        const avgDailySales = sales30d / CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS;

        const status = classifyInventory(qtyOnHand, avgDailySales);

        if (status === CONSTANTS.INVENTORY.STATUS.HEALTHY) {
          batchHealthy++;
        } else if (status === CONSTANTS.INVENTORY.STATUS.LOW) {
          batchLow++;
        } else if (status === CONSTANTS.INVENTORY.STATUS.OVER) {
          batchOver++;
        }
      }

      this._cumulativeState.healthy += batchHealthy;
      this._cumulativeState.low += batchLow;
      this._cumulativeState.over += batchOver;
    }

    return this.getCumulativeState();
  }

  /**
   * Retrieves top 10 inventory alerts prioritized by Low Stock then Overstock.
   */
  getAlerts() {
    return dataLoaderService.getInventoryAlertsCache();
  }
}

module.exports = new InventoryService();
