/**
 * EDA Controller
 * Handles requests for the 4 Exploratory Data Analysis charts and filter metadata.
 * Supports optional query filters (?store=...&division=...&startMonth=YYYY-MM&endMonth=YYYY-MM).
 */

const { edaService } = require('../services');
const { CONSTANTS } = require('../config');

function extractEdaFilters(req) {
  if (!req || !req.query) return {};
  const { store, division, startMonth, endMonth } = req.query;
  return { store, division, startMonth, endMonth };
}

class EdaController {
  /**
   * GET /api/eda/revenue-trend
   * Monthly revenue progression line chart data.
   */
  getRevenueTrend(req, res) {
    const data = edaService.getRevenueTrend(extractEdaFilters(req));
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/top-categories
   * Top 10 best-selling product categories horizontal bar chart data.
   */
  getTopCategories(req, res) {
    const data = edaService.getTopCategories(extractEdaFilters(req));
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/channel-split
   * Sales channel distribution doughnut chart data.
   */
  getChannelSplit(req, res) {
    const data = edaService.getChannelSplit(extractEdaFilters(req));
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/return-rate
   * Return rates by product division bar chart data.
   */
  getReturnRate(req, res) {
    const data = edaService.getReturnRate(extractEdaFilters(req));
    res.status(CONSTANTS.HTTP_STATUS.OK).json(data);
  }

  /**
   * GET /api/eda/filters
   * Distinct stores, divisions, categories, and months for interactive filter selectors.
   */
  getFilterMetadata(req, res) {
    const meta = edaService.getFilterMetadata();
    res.status(CONSTANTS.HTTP_STATUS.OK).json(meta);
  }
}

module.exports = new EdaController();
