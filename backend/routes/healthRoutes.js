/**
 * Health Routes Definition
 * Only defines routes, contains zero business logic.
 */

const express = require('express');
const { healthController } = require('../controllers');

const router = express.Router();

router.get('/', (req, res) => healthController.getHealth(req, res));

module.exports = router;
