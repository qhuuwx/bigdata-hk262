/**
 * Stream Routes Definition
 * Only defines routes, contains zero business logic.
 */

const express = require('express');
const { streamController } = require('../controllers');

const router = express.Router();

router.get('/sales', (req, res) => streamController.getSalesStream(req, res));
router.get('/sales/events', (req, res) => streamController.streamSalesEvents(req, res));

module.exports = router;
