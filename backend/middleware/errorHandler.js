/**
 * Centralized Error Handling Middleware
 * Catches all forwarded errors and formats them into uniform JSON responses.
 */

const { CONSTANTS } = require('../config');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const errorCode = err.code || (statusCode === 400 ? 'BAD_REQUEST' : (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'));

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;
