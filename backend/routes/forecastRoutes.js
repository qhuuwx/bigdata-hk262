/**
 * Forecast Routes Definition
 * Only defines routes, contains zero business logic.
 */

const express = require('express');
const { forecastController } = require('../controllers');

const router = express.Router();

router.post('/', (req, res) => forecastController.runForecast(req, res));
router.get('/categories', (req, res) => forecastController.getCategories(req, res));
router.get('/stores', (req, res) => forecastController.getStores(req, res));

module.exports = router;
