/**
 * Repositories Module Aggregator
 */

const dataRepository = require('./dataRepository');
const lakehouseRepository = require('./lakehouseRepository');

module.exports = {
  dataRepository,
  lakehouseRepository
};
