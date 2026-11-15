/**
 * EDA Routes Definition
 * Only defines routes, contains zero business logic.
 */

const express = require('express');
const { edaController } = require('../controllers');

const router = express.Router();

router.get('/revenue-trend', (req, res) => edaController.getRevenueTrend(req, res));
router.get('/top-categories', (req, res) => edaController.getTopCategories(req, res));
router.get('/channel-split', (req, res) => edaController.getChannelSplit(req, res));
router.get('/return-rate', (req, res) => edaController.getReturnRate(req, res));

module.exports = router;
