/**
 * Services Module Aggregator
 */

const dataLoaderService = require('./dataLoaderService');
const salesStreamService = require('./salesStreamService');
const edaService = require('./edaService');
const forecastService = require('./forecastService');
const inventoryService = require('./inventoryService');

module.exports = {
  dataLoaderService,
  salesStreamService,
  edaService,
  forecastService,
  inventoryService
};
