/**
 * Health Controller
 * Reports system status, loaded record counts, and inventory cumulative summary.
 */

const { dataLoaderService, inventoryService } = require('../services');
const { CONSTANTS } = require('../config');

class HealthController {
  /**
   * GET /api/health
   */
  getHealth(req, res) {
    const isReady = dataLoaderService.isReady();
    res.status(CONSTANTS.HTTP_STATUS.OK).json({
      status: isReady ? 'ready' : 'loading',
      salesCount: dataLoaderService.getRawSales().length,
      inventoryCount: dataLoaderService.getRawInventory().length,
      cumulative: inventoryService.getCumulativeState()
    });
  }
}

module.exports = new HealthController();
