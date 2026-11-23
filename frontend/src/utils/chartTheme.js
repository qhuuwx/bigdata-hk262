/**
 * Chart Theme & Apache ECharts Institutional Preset Configurations
 * Supports both Institutional Light (#F8FAFC) and Deep-Slate Dark (#0B1120) modes.
 */

export const CHART_COLORS = {
  blue: '#2563eb',
  blueLight: '#3b82f6',
  blueFill: 'rgba(37, 99, 235, 0.12)',
  orange: '#d97706',
  orangeLight: '#f59e0b',
  orangeFill: 'rgba(217, 119, 6, 0.12)',
  green: '#059669',
  red: '#e11d48',
  purple: '#4f46e5',
  indigo: '#4338ca',
  slate: '#475569',
  palette: [
    '#1d4ed8',
    '#2563eb',
    '#3b82f6',
    '#0284c7',
    '#0ea5e9',
    '#0d9488',
    '#4f46e5',
    '#6366f1',
    '#64748b',
    '#94a3b8'
  ],
  inventory: {
    healthy: '#10b981',
    low: '#f59e0b',
    over: '#f43f5e'
  }
};

export const getEChartsTokens = (isDark = false) => ({
  textPrimary: isDark ? '#f1f5f9' : '#0f172a',
  textSecondary: isDark ? '#94a3b8' : '#64748b',
  axisLine: isDark ? '#334155' : '#cbd5e1',
  splitLine: isDark ? 'rgba(51, 65, 85, 0.55)' : 'rgba(226, 232, 240, 0.75)',
  tooltipBg: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.94)',
  tooltipBorder: isDark ? '#334155' : '#1e293b',
  tooltipText: '#f8fafc',
  zoomBg: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.85)',
  zoomFiller: isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(37, 99, 235, 0.14)',
  zoomBorder: isDark ? '#334155' : '#cbd5e1',
  cardBg: isDark ? '#0f172a' : '#ffffff'
});

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
      duration: 350
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
  getEChartsTokens,
  getBaseChartOptions
};
