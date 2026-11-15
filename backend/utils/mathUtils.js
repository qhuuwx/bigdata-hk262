/**
 * Mathematical & Formatting Utilities
 * Pure helper functions for numerical calculations and rounding.
 */

/**
 * Rounds a number to a fixed decimal precision.
 * @param {number} num 
 * @param {number} decimals 
 * @returns {number}
 */
function roundTo(num, decimals = 2) {
  const n = Number(num);
  if (isNaN(n)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * Calculates percentage: (part / total) * 100 rounded to 2 decimals.
 * @param {number} part 
 * @param {number} total 
 * @param {number} decimals 
 * @returns {number}
 */
function calcPercentage(part, total, decimals = 2) {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  if (t === 0) return 0;
  return roundTo((p / t) * 100, decimals);
}

/**
 * Calculates absolute difference percentage string e.g. "12.34%".
 * @param {number} valA 
 * @param {number} valB 
 * @returns {string}
 */
function calcDiffPercent(valA, valB) {
  const a = Number(valA) || 0;
  const b = Number(valB) || 0;
  const diff = Math.abs(b - a);
  if (a !== 0) {
    return `${((diff / Math.abs(a)) * 100).toFixed(2)}%`;
  }
  return b !== 0 ? '100.00%' : '0.00%';
}

/**
 * Computes arithmetic mean of a numeric array.
 * @param {number[]} arr 
 * @returns {number}
 */
function average(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sum = arr.reduce((acc, val) => acc + (Number(val) || 0), 0);
  return sum / arr.length;
}

module.exports = {
  roundTo,
  calcPercentage,
  calcDiffPercent,
  average
};
