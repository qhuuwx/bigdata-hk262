/**
 * Server Entrypoint
 * Opens the HTTP port immediately (serving /api/health and 503 readinessGuard during startup),
 * streams CSV datasets into memory, and handles graceful shutdown on SIGTERM/SIGINT.
 */

const { env } = require('./config');
const { dataLoaderService } = require('./services');
const app = require('./app');

let serverInstance = null;
let isShuttingDown = false;

async function startServer() {
  try {
    console.log(`[Server] Starting Retail Analytics Backend in ${env.NODE_ENV} mode...`);

    // Open HTTP listener immediately so /api/health reports 'loading' and readinessGuard returns 503 during CSV ingestion
    await new Promise((resolve, reject) => {
      const srv = app.listen(env.PORT, '0.0.0.0', () => {
        serverInstance = srv;
        console.log(`[Server] HTTP port bound on http://0.0.0.0:${env.PORT} (initializing in-memory data pipeline...)`);
        resolve();
      });
      srv.on('error', reject);
    });

    // Bootstrap data pipeline into memory
    await dataLoaderService.init(env.DATA_DIR);
    console.log(`[Server] Retail Analytics Dashboard Backend READY on http://0.0.0.0:${env.PORT}`);

    return serverInstance;
  } catch (error) {
    console.error('[Server] Fatal initialization error:', error);
    if (serverInstance) {
      try {
        serverInstance.close();
      } catch (e) {
        // ignore close errors during fatal exit
      }
    }
    process.exit(1);
  }
}

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] Received ${signal}. Closing HTTP server gracefully...`);

  if (!serverInstance) {
    process.exit(0);
    return;
  }

  const forceTimer = setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000);
  if (forceTimer.unref) forceTimer.unref();

  serverInstance.close(() => {
    clearTimeout(forceTimer);
    console.log('[Server] HTTP server closed cleanly.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Automatically start if called directly from CLI
if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  gracefulShutdown
};
