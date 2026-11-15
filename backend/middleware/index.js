/**
 * Middleware Aggregator
 */

const corsMiddleware = require('./cors');
const logger = require('./logger');
const createReadinessGuard = require('./readinessGuard');
const errorHandler = require('./errorHandler');

module.exports = {
  corsMiddleware,
  logger,
  createReadinessGuard,
  errorHandler
};
