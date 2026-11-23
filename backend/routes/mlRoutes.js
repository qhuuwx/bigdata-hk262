/**
 * Machine Learning Routes (backend/routes/mlRoutes.js)
 */

const express = require('express');
const mlController = require('../controllers/mlController');

const router = express.Router();

router.get('/metrics', (req, res) => mlController.getMetrics(req, res));
router.post('/forecast', (req, res) => mlController.runMlForecast(req, res));
router.post('/classify-inventory', (req, res) => mlController.classifyInventory(req, res));

module.exports = router;
