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
   * Returns current copy of cumulative state.
   */
  getCumulativeState() {
    const total = this._cumulativeState.healthy + this._cumulativeState.low + this._cumulativeState.over;
    return {
      healthy: this._cumulativeState.healthy,
      low: this._cumulativeState.low,
      over: this._cumulativeState.over,
      total
    };
  }

  /**
   * Resets cumulative inventory counts (useful for testing and benchmark resets).
   */
  resetCumulativeState() {
    this._cumulativeState.healthy = 0;
    this._cumulativeState.low = 0;
    this._cumulativeState.over = 0;
    return this.getCumulativeState();
  }

  /**
   * Streams a batch of 50 inventory records, classifies each using algorithms/classify,
   * accumulates into persistent state, and returns updated totals.
   * @param {number} [batchSize=50]
   */
  processStreamBatch(batchSize = CONSTANTS.INVENTORY.STREAM_BATCH_SIZE) {
    const inventory = dataLoaderService.getRawInventory();

    if (inventory && inventory.length > 0) {
      for (let i = 0; i < batchSize; i++) {
        const idx = Math.floor(Math.random() * inventory.length);
        const item = inventory[idx];
        const prodNo = item['Product No'];
        const qtyOnHand = Number(item['Qty on hand']) || 0;
        const sales30d = dataLoaderService.getProdSales30d(prodNo);
        const avgDailySales = sales30d / CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS;

        const status = classifyInventory(qtyOnHand, avgDailySales);

        if (status === CONSTANTS.INVENTORY.STATUS.HEALTHY) {
          this._cumulativeState.healthy++;
        } else if (status === CONSTANTS.INVENTORY.STATUS.LOW) {
          this._cumulativeState.low++;
        } else if (status === CONSTANTS.INVENTORY.STATUS.OVER) {
          this._cumulativeState.over++;
        }
      }
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
