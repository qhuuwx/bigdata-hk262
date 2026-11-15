/**
 * Server Entrypoint
 * Bootstraps in-memory data loading before opening the HTTP port.
 */

const { env } = require('./config');
const { dataLoaderService } = require('./services');
const app = require('./app');

let serverInstance = null;

async function startServer() {
  try {
    console.log(`[Server] Starting Retail Analytics Backend in ${env.NODE_ENV} mode...`);

    // Bootstrap data pipeline into memory prior to listening
    await dataLoaderService.init(env.DATA_DIR);

    serverInstance = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[Server] Retail Analytics Dashboard Backend listening on http://0.0.0.0:${env.PORT}`);
    });

    return serverInstance;
  } catch (error) {
    console.error('[Server] Fatal initialization error:', error);
    process.exit(1);
  }
}

// Automatically start if called directly from CLI
if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer
};
