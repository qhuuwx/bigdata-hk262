/**
 * Express Application Setup
 * Configures middleware, API routes, static asset serving, and global error handling.
 */

const express = require('express');
const { env, CONSTANTS } = require('./config');
const {
  corsMiddleware,
  logger,
  createReadinessGuard,
  errorHandler
} = require('./middleware');
const { dataLoaderService } = require('./services');
const apiRoutes = require('./routes');

const app = express();

// 1. Global Pre-Routing Middlewares
app.use(corsMiddleware);
app.use(express.json());
app.use(logger);

// 2. Serve static frontend assets
app.use(express.static(env.FRONTEND_DIR));

// 3. Readiness Guard for /api routes
app.use('/api', createReadinessGuard(dataLoaderService));

// 4. Mount API Routes
app.use('/api', apiRoutes);

// 5. Catch-all for undefined /api routes (404)
app.use('/api/*', (req, res) => {
  res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.originalUrl} not found`
    }
  });
});

// 6. Global Post-Routing Error Handler
app.use(errorHandler);

module.exports = app;
