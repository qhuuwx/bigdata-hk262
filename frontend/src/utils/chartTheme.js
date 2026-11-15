/**
 * Chart Theme & Preset Configurations
 * Centralized color palettes and Chart.js options matching modern UI aesthetics.
 */

export const CHART_COLORS = {
  blue: '#0284c7',
  blueLight: '#38bdf8',
  blueFill: 'rgba(2, 132, 199, 0.12)',
  orange: '#f97316',
  orangeLight: '#fb923c',
  orangeFill: 'rgba(249, 115, 22, 0.12)',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  palette: [
    '#0284c7', '#f97316', '#22c55e', '#ef4444', '#8b5cf6',
    '#06b6d4', '#eab308', '#ec4899', '#14b8a6', '#64748b'
  ],
  inventory: {
    healthy: '#22c55e',
    low: '#f97316',
    over: '#ef4444'
  }
};

export const getBaseChartOptions = (options = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 500
  },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: { family: 'Inter, sans-serif', size: 12, weight: '500' },
        color: '#475569',
        boxWidth: 14,
        padding: 16
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleFont: { family: 'Inter, sans-serif', size: 13, weight: '600' },
      bodyFont: { family: 'Inter, sans-serif', size: 12 },
      padding: 10,
      cornerRadius: 6
    }
  },
  ...options
});

export default {
  CHART_COLORS,
  getBaseChartOptions
};
