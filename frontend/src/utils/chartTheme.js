/**
 * Chart Theme & Preset Configurations
 * Disciplined institutional palette and typography for Chart.js 4.
 * Deep-merges plugin options so custom legend settings never overwrite tooltip styling.
 */

export const CHART_COLORS = {
  blue: '#1d4ed8',
  blueLight: '#3b82f6',
  blueFill: 'rgba(29, 78, 216, 0.08)',
  orange: '#d97706',
  orangeLight: '#f59e0b',
  orangeFill: 'rgba(217, 119, 6, 0.08)',
  green: '#059669',
  red: '#e11d48',
  purple: '#4f46e5',
  indigo: '#4338ca',
  slate: '#475569',
  palette: [
    '#1e3a8a',
    '#1d4ed8',
    '#2563eb',
    '#3b82f6',
    '#0284c7',
    '#0369a1',
    '#334155',
    '#475569',
    '#64748b',
    '#94a3b8'
  ],
  inventory: {
    healthy: '#059669',
    low: '#d97706',
    over: '#e11d48'
  }
};

export const getBaseChartOptions = (options = {}) => {
  const baseLegend = {
    position: 'top',
    align: 'end',
    labels: {
      font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
      color: '#475569',
      boxWidth: 10,
      boxHeight: 10,
      usePointStyle: true,
      pointStyle: 'rectRounded',
      padding: 14
    }
  };

  const baseTooltip = {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
    bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
    padding: 10,
    cornerRadius: 6,
    displayColors: true,
    boxPadding: 4
  };

  const customPlugins = options.plugins || {};
  const customLegend = customPlugins.legend || {};
  const customTooltip = customPlugins.tooltip || {};

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 250
    },
    ...options,
    plugins: {
      ...customPlugins,
      legend: {
        ...baseLegend,
        ...customLegend,
        labels: {
          ...baseLegend.labels,
          ...(customLegend.labels || {})
        }
      },
      tooltip: {
        ...baseTooltip,
        ...customTooltip
      }
    }
  };
};

export default {
  CHART_COLORS,
  getBaseChartOptions
};
