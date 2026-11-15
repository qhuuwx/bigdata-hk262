/**
 * Controllers Module Aggregator
 */

const streamController = require('./streamController');
const edaController = require('./edaController');
const forecastController = require('./forecastController');
const inventoryController = require('./inventoryController');
const healthController = require('./healthController');

module.exports = {
  streamController,
  edaController,
  forecastController,
  inventoryController,
  healthController
};
