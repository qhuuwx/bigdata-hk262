/**
 * Normal Forecast Algorithm - Moving Average
 * 
 * Computes simple moving average using a sliding window of windowSize (default 4).
 * Each forecast period computes the average of the last windowSize values in history,
 * rounds to 2 decimal places, appends the value into history for subsequent steps,
 * and returns the forecast series.
 * 
 * @param {number[]} history - Historical data points
 * @param {number} periods - Number of future periods to forecast
 * @param {number} [windowSize=4] - Sliding window size
 * @returns {number[]} Array of forecasted values of length `periods`
 */
function runForecast(history, periods, windowSize = 4) {
  if (!Array.isArray(history) || history.length === 0 || !periods || periods <= 0) {
    return [];
  }

  const numPeriods = parseInt(periods, 10);
  if (isNaN(numPeriods) || numPeriods <= 0) {
    return [];
  }

  const effectiveWindow = Math.max(1, parseInt(windowSize, 10) || 4);
  const result = [];
  const h = history.map(v => Number(v) || 0);

  for (let i = 0; i < numPeriods; i++) {
    const window = h.slice(-effectiveWindow);
    const sum = window.reduce((acc, val) => acc + val, 0);
    const val = window.length > 0 ? sum / window.length : 0;
    const rounded = Math.round(val * 100) / 100;
    result.push(rounded);
    h.push(val);
  }

  return result;
}

module.exports = { runForecast };
