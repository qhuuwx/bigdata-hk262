/**
 * Super Forecast Algorithm - Weighted Moving Average + Seasonality Factor
 * 
 * Computes weighted moving average with weights [1, 2, 3, 4] for the last 4 periods,
 * multiplied by a seasonality factor derived from monthly historical averages.
 * 
 * @param {number[]} history - Historical sales series
 * @param {number} periods - Number of future periods to forecast
 * @param {number[]|Object} monthlyAvg - Average sales per month (indexed 0-11)
 * @param {number} overallAvg - Overall average monthly sales
 * @returns {number[]} Forecasted values rounded to 2 decimal places
 */
function runForecastSuper(history, periods, monthlyAvg, overallAvg) {
  if (!Array.isArray(history) || history.length === 0 || !periods || periods <= 0) {
    return [];
  }

  const numPeriods = parseInt(periods, 10);
  if (isNaN(numPeriods) || numPeriods <= 0) {
    return [];
  }

  const baseWeights = [1, 2, 3, 4];
  const result = [];
  const h = history.map(v => Number(v) || 0);
  const currentMonth = new Date().getMonth();

  for (let i = 0; i < numPeriods; i++) {
    const window = h.slice(-4);
    let wma;

    if (window.length >= 4) {
      const totalW = baseWeights.reduce((a, b) => a + b, 0); // 10
      const weightedSum = window.reduce((s, v, j) => s + v * baseWeights[j], 0);
      wma = weightedSum / totalW;
    } else if (window.length > 0) {
      // Graceful fallback for history length < 4: align highest weights to newest values
      const activeWeights = baseWeights.slice(baseWeights.length - window.length);
      const activeTotalW = activeWeights.reduce((a, b) => a + b, 0);
      const weightedSum = window.reduce((s, v, j) => s + v * activeWeights[j], 0);
      wma = activeTotalW > 0 ? weightedSum / activeTotalW : 0;
    } else {
      wma = 0;
    }

    const forecastMonth = (currentMonth + i) % 12;
    const mAvg = (monthlyAvg && monthlyAvg[forecastMonth] !== undefined && monthlyAvg[forecastMonth] !== null)
      ? Number(monthlyAvg[forecastMonth])
      : overallAvg;

    const sf = (overallAvg && overallAvg > 0)
      ? (mAvg || overallAvg) / overallAvg
      : 1;

    const effectiveSf = (!isNaN(sf) && sf > 0) ? sf : 1;
    const val = Math.round(wma * effectiveSf * 100) / 100;

    result.push(val);
    h.push(val);
  }

  return result;
}

module.exports = { runForecastSuper };
