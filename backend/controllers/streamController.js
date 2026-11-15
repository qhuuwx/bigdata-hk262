/**
 * Stream Controller
 * Handles live transaction streaming endpoint.
 */

const { salesStreamService } = require('../services');
const { CONSTANTS } = require('../config');

class StreamController {
  /**
   * GET /api/stream/sales
   * Returns a sample of 20 random sales transactions.
   */
  getSalesStream(req, res) {
    const streamData = salesStreamService.getSalesStream(CONSTANTS.STREAM.SALES_BATCH_SIZE);
    res.status(CONSTANTS.HTTP_STATUS.OK).json(streamData);
  }
}

module.exports = new StreamController();
