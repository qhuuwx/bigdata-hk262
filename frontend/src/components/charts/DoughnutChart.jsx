/**
 * Apache ECharts Doughnut Chart Component
 * Features smooth radial delta transitions during real-time SSE streaming,
 * high-DPI canvas rendering, and institutional Light/Dark theme reactivity.
 */

import React, { useEffect, useRef, useContext } from 'react';
import * as echarts from 'echarts';
import AppContext from '../../context/AppContext';
import { getEChartsTokens, CHART_COLORS } from '../../utils/chartTheme';

export const DoughnutChart = ({
  data,
  cutout = '68%',
  height = 260,
  centerLabel = null,
  centerSubLabel = null
}) => {
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
    const ds = (Array.isArray(data.datasets) && data.datasets[0]) || { data: [], backgroundColor: [] };
    const values = Array.isArray(ds.data) ? ds.data : [];
    const colors = Array.isArray(ds.backgroundColor) ? ds.backgroundColor : CHART_COLORS.palette;

    const pieData = labels.map((label, idx) => ({
      name: label,
      value: Number(values[idx]) || 0,
      itemStyle: {
        color: colors[idx % colors.length] || CHART_COLORS.blue
      }
    }));

    const innerRadius = typeof cutout === 'string' && cutout.endsWith('%') ? cutout : '66%';

    const option = {
      animation: true,
      animationDuration: 350,
      animationDurationUpdate: 400,
      animationEasing: 'cubicOut',
      tooltip: {
        trigger: 'item',
        backgroundColor: tokens.tooltipBg,
        borderColor: tokens.tooltipBorder,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: {
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: tokens.tooltipText
        }
      },
      legend: {
        bottom: 0,
        left: 'center',
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
        textStyle: {
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          color: tokens.textSecondary
        }
      },
      graphic: centerLabel
        ? [
            {
              type: 'group',
              left: 'center',
              top: '39%',
              children: [
                {
                  type: 'text',
                  left: 'center',
                  top: 0,
                  style: {
                    text: String(centerLabel),
                    textAlign: 'center',
                    fill: tokens.textPrimary,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 18,
                    fontWeight: 600
                  }
                },
                ...(centerSubLabel
                  ? [
                      {
                        type: 'text',
                        left: 'center',
                        top: 22,
                        style: {
                          text: String(centerSubLabel),
                          textAlign: 'center',
                          fill: tokens.textSecondary,
                          fontFamily: "'Inter', sans-serif",
                          fontSize: 10,
                          fontWeight: 500
                        }
                      }
                    ]
                  : [])
              ]
            }
          ]
        : [],
      series: [
        {
          type: 'pie',
          radius: [innerRadius, '82%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: tokens.cardBg,
            borderWidth: 2,
            borderRadius: 3
          },
          label: {
            show: false
          },
          emphasis: {
            scale: true,
            scaleSize: 4
          },
          data: pieData
        }
      ]
    };

    chart.setOption(option, { notMerge: false });
  }, [data, cutout, isDark, centerLabel, centerSubLabel]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%', position: 'relative' }}
    />
  );
};

export default DoughnutChart;
