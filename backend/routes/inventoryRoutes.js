/**
 * Inventory Routes Definition
 * Only defines routes, contains zero business logic.
 */

const express = require('express');
const { inventoryController } = require('../controllers');

const router = express.Router();

router.get('/stream', (req, res) => inventoryController.getInventoryStream(req, res));
router.get('/alerts', (req, res) => inventoryController.getInventoryAlerts(req, res));
router.post('/reset', (req, res) => inventoryController.resetInventory(req, res));

module.exports = router;
