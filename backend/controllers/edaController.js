/**
 * EDA Controller
 * Handles requests for the 4 Exploratory Data Analysis charts.
 */

const { edaService } = require('../services');
const { CONSTANTS } = require('../config');

class EdaController {
  /**
   * GET /api/eda/revenue-trend
   * Monthly revenue progression line chart data.
   */
  getRevenueTrend(req, res) {
    const data = edaService.getRevenueTrend();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/top-categories
   * Top 10 best-selling product categories horizontal bar chart data.
   */
  getTopCategories(req, res) {
    const data = edaService.getTopCategories();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/channel-split
   * Sales channel distribution doughnut chart data.
   */
  getChannelSplit(req, res) {
    const data = edaService.getChannelSplit();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/return-rate
   * Return rates by product division bar chart data.
   */
  getReturnRate(req, res) {
    const data = edaService.getReturnRate();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }
}

module.exports = new EdaController();
