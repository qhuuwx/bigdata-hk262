/**
 * Centralized Error Handling Middleware
 * Catches all forwarded errors (including body-parser SyntaxError and PayloadTooLargeError)
 * and formats them into uniform JSON responses.
 */

const { CONSTANTS } = require('../config');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || err.status || CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR;

  if (err instanceof SyntaxError && statusCode === 400 && 'body' in err) {
    statusCode = CONSTANTS.HTTP_STATUS.BAD_REQUEST;
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
  }

  const codeMap = {
    400: 'BAD_REQUEST',
    404: 'NOT_FOUND',
    413: 'PAYLOAD_TOO_LARGE',
    503: 'SERVICE_UNAVAILABLE'
  };
  const errorCode = err.code || codeMap[statusCode] || 'INTERNAL_SERVER_ERROR';

  if (process.env.NODE_ENV !== 'test' && statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;
