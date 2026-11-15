/**
 * Formatting Utilities
 * Standardizes numbers, currency, dates, and percentages across UI tables and charts.
 */

export const formatNumber = (num, decimals = 0) => {
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const formatCurrency = (amount, decimals = 2) => {
  const n = Number(amount);
  if (isNaN(n)) return '$0.00';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
};

export const formatPercentage = (val, decimals = 2) => {
  const n = Number(val);
  if (isNaN(n)) return '0.00%';
  return `${n.toFixed(decimals)}%`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return String(dateStr).slice(0, 10);
};

export default {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDate
};
