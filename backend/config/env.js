/**
 * Backend Environment Configuration
 * Validates and exposes environment variables with safe defaults.
 */

const path = require('path');
const fs = require('fs');

const distPath = path.resolve(__dirname, '../../frontend/dist');
const fallbackFrontendPath = path.resolve(__dirname, '../../frontend');
const resolvedFrontend = fs.existsSync(distPath) ? distPath : fallbackFrontendPath;

const env = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  DATA_DIR: process.env.DATA_DIR || path.resolve(__dirname, '../../data'),
  FRONTEND_DIR: process.env.FRONTEND_DIR || resolvedFrontend,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

module.exports = env;
