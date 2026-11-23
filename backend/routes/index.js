/**
 * Root Router Aggregator
 * Mounts all sub-routers under unified API paths.
 */

const express = require('express');
const streamRoutes = require('./streamRoutes');
const edaRoutes = require('./edaRoutes');
const forecastRoutes = require('./forecastRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const healthRoutes = require('./healthRoutes');
const mlRoutes = require('./mlRoutes');
const { forecastController } = require('../controllers');

const router = express.Router();

router.use('/stream', streamRoutes);
router.use('/eda', edaRoutes);
router.use('/forecast', forecastRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/health', healthRoutes);
router.use('/ml', mlRoutes);

// Backward-compatible direct aliases for metadata
router.get('/categories', (req, res) => forecastController.getCategories(req, res));
router.get('/stores', (req, res) => forecastController.getStores(req, res));

module.exports = router;
