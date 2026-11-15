/**
 * Algorithms Aggregator
 * Exposes pure forecasting and inventory classification algorithms.
 */

const { runForecast } = require('./forecast');
const { runForecastSuper } = require('./forecastsuper');
const { classifyInventory } = require('./classify');

module.exports = {
  runForecast,
  runForecastSuper,
  classifyInventory
};
