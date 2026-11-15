/**
 * Readiness Guard Middleware
 * Ensures API requests are held or rejected with 503 until in-memory data loading is finished.
 */

const { CONSTANTS } = require('../config');

function createReadinessGuard(dataLoaderService) {
  return function readinessGuard(req, res, next) {
    // Health check endpoint is always permitted to report loading status
    if (req.path === '/api/health' || req.path === '/health') {
      return next();
    }

    if (!dataLoaderService.isReady()) {
      return res.status(CONSTANTS.HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is initializing: CSV datasets are being loaded into memory'
        }
      });
    }

    next();
  };
}

module.exports = createReadinessGuard;
