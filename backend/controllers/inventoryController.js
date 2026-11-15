/**
 * Inventory Controller
 * Handles cumulative stock streaming, top 10 alerts, and test reset.
 */

const { inventoryService } = require('../services');
const { CONSTANTS } = require('../config');

class InventoryController {
  /**
   * GET /api/inventory/stream
   * Classifies a random batch of 50 items and increments module-level cumulative state.
   */
  getInventoryStream(req, res) {
    const cumulativeState = inventoryService.processStreamBatch(CONSTANTS.INVENTORY.STREAM_BATCH_SIZE);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(cumulativeState);
  }

  /**
   * GET /api/inventory/alerts
   * Returns top 10 stock alerts prioritized by Low Stock then Overstock.
   */
  getInventoryAlerts(req, res) {
    const alerts = inventoryService.getAlerts();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(alerts);
  }

  /**
   * POST /api/inventory/reset
   * Resets the cumulative state (used by test suites).
   */
  resetInventory(req, res) {
    const state = inventoryService.resetCumulativeState();
    res.status(CONSTANTS.HTTP_STATUS.OK).json({
      status: 'reset',
      cumulativeState: state
    });
  }
}

module.exports = new InventoryController();
