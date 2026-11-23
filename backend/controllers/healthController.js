/**
 * Health Controller
 * Reports system status, data backend mode, loaded record counts, and inventory cumulative summary.
 */

const { dataRepository } = require('../repositories');
const { inventoryService } = require('../services');
const { CONSTANTS } = require('../config');

class HealthController {
  /**
   * GET /api/health
   */
  getHealth(req, res) {
    const isReady = dataRepository.isReady();
    res.status(CONSTANTS.HTTP_STATUS.OK).json({
      status: isReady ? 'ready' : 'loading',
      backend: dataRepository.getMode(),
      salesCount: dataRepository.getSalesCount(),
      inventoryCount: dataRepository.getInventoryCount(),
      cumulative: inventoryService.getCumulativeState()
    });
  }
}

module.exports = new HealthController();
