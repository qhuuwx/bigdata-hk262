/**
 * CORS Middleware Configuration
 */

const cors = require('cors');
const { env } = require('../config');

const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
});

module.exports = corsMiddleware;
