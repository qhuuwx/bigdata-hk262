/**
 * Apache ECharts Bar Chart Component
 * Supports both horizontal (Top 10 categories) and vertical (Return Rate) layouts
 * with smooth 350ms animations and institutional Light/Dark theme reactivity.
 */

import React, { useEffect, useRef, useContext } from 'react';
import * as echarts from 'echarts';
import AppContext from '../../context/AppContext';
import { getEChartsTokens, CHART_COLORS } from '../../utils/chartTheme';

export const BarChart = ({ data, horizontal = false, height = 280 }) => {
  const containerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const appCtx = useContext(AppContext);
  const isDark = appCtx?.theme === 'dark';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const instance = echarts.init(el, null, {
      renderer: 'canvas',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2
    });
    chartInstanceRef.current = instance;

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.resize();
        }
      });
      resizeObserver.observe(el);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !data) return;

    const tokens = getEChartsTokens(isDark);
    const labels = Array.isArray(data.labels) ? data.labels : [];
    const datasets = Array.isArray(data.datasets) ? data.datasets : [];

    const series = datasets.map((ds, idx) => {
      const bg = ds.backgroundColor;
      const barMaxWidth = ds.maxBarThickness || ds.barThickness || (horizontal ? 14 : 38);

      return {
        name: ds.label || `Series ${idx + 1}`,
        type: 'bar',
        data: Array.isArray(ds.data) ? ds.data : [],
        barMaxWidth,
        itemStyle: {
          borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
          color: (params) => {
            if (Array.isArray(bg)) {
              return bg[params.dataIndex % bg.length] || CHART_COLORS.blue;
            }
            return bg || CHART_COLORS.blue;
          }
        }
      };
    });

    const categoryAxis = {
      type: 'category',
      data: labels,
      inverse: horizontal,
      axisLine: {
        lineStyle: { color: tokens.axisLine }
      },
      axisTick: { show: false },
      axisLabel: {
        fontFamily: horizontal ? "'Inter', sans-serif" : "'JetBrains Mono', monospace",
        fontSize: 10.5,
        color: tokens.textSecondary,
        width: horizontal ? 155 : undefined,
        overflow: horizontal ? 'truncate' : undefined
      }
    };

    const valueAxis = {
      type: 'value',
      splitLine: {
        lineStyle: {
          color: tokens.splitLine
        }
      },
      axisLabel: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10.5,
        color: tokens.textSecondary,
        formatter: (val) => {
          if (Math.abs(val) >= 1000) {
            return `${(val / 1000).toFixed(0)}k`;
          }
          return val;
        }
      }
    };

    const option = {
      animation: true,
      animationDuration: 350,
      animationDurationUpdate: 350,
      animationEasing: 'cubicOut',
      grid: {
        top: 28,
        right: 18,
        bottom: 16,
        left: 10,
        containLabel: true
      },
      legend: {
        top: 0,
        right: 4,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          fontWeight: 500,
          color: tokens.textSecondary
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: {
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: tokens.tooltipText
        },
        axisPointer: {
          type: 'shadow'
        }
      },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series
    };

    chart.setOption(option, { notMerge: true });
  }, [data, horizontal, isDark]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%', position: 'relative' }}
    />
  );
};

export default BarChart;
