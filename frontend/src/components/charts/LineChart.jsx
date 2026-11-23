/**
 * Apache ECharts Line Chart Component
 * Features interactive dataZoom slider, crosshair axis tooltip, translucent 80% ML prediction
 * interval band (lower80..upper80), high-DPI rendering, and Light/Dark theme reactivity.
 */

import React, { useEffect, useRef, useContext } from 'react';
import * as echarts from 'echarts';
import AppContext from '../../context/AppContext';
import { getEChartsTokens, CHART_COLORS } from '../../utils/chartTheme';

export const LineChart = ({
  data,
  height = 280,
  enableZoom = true,
  confidenceBand = null
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
    const datasets = Array.isArray(data.datasets) ? data.datasets : [];

    const hasValidBand =
      confidenceBand &&
      Array.isArray(confidenceBand.lower) &&
      Array.isArray(confidenceBand.upper) &&
      confidenceBand.lower.length === labels.length &&
      confidenceBand.upper.length === labels.length &&
      labels.length > 0;

    const bandSeries = [];
    if (hasValidBand) {
      const lowerArr = confidenceBand.lower.map((v) => Math.max(0, Number(v) || 0));
      const deltaArr = confidenceBand.upper.map((u, idx) => {
        const upperVal = Math.max(0, Number(u) || 0);
        return Number(Math.max(0, upperVal - lowerArr[idx]).toFixed(2));
      });

      bandSeries.push(
        {
          name: '__ml_ci_base__',
          type: 'line',
          data: lowerArr,
          stack: 'ml_ci_band',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: { opacity: 0, width: 0 },
          itemStyle: { opacity: 0 },
          silent: true,
          tooltip: { show: false }
        },
        {
          name: confidenceBand.label || '80% ML Confidence Band',
          type: 'line',
          data: deltaArr,
          stack: 'ml_ci_band',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: { opacity: 0, width: 0 },
          itemStyle: {
            color: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(5, 150, 105, 0.16)'
          },
          areaStyle: {
            color: isDark ? 'rgba(16, 185, 129, 0.20)' : 'rgba(5, 150, 105, 0.14)'
          },
          silent: true,
          tooltip: { show: false }
        }
      );
    }

    const lineSeries = datasets.map((ds, idx) => {
      const lineColor = ds.borderColor || (idx === 0 ? CHART_COLORS.blue : CHART_COLORS.orange);
      const hasArea = Boolean(ds.fill) || datasets.length === 1;

      return {
        name: ds.label || `Series ${idx + 1}`,
        type: 'line',
        data: Array.isArray(ds.data) ? ds.data : [],
        smooth: 0.25,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: true,
        z: 3 + idx,
        lineStyle: {
          width: ds.borderWidth || 2.2,
          color: lineColor,
          type: ds.borderDash ? 'dashed' : 'solid'
        },
        itemStyle: {
          color: lineColor,
          borderColor: tokens.cardBg,
          borderWidth: 1.5
        },
        areaStyle: hasArea
          ? {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color:
                    idx === 0
                      ? 'rgba(37, 99, 235, 0.22)'
                      : idx === 1
                        ? 'rgba(217, 119, 6, 0.18)'
                        : 'rgba(16, 185, 129, 0.18)'
                },
                {
                  offset: 1,
                  color:
                    idx === 0
                      ? 'rgba(37, 99, 235, 0.01)'
                      : idx === 1
                        ? 'rgba(217, 119, 6, 0.01)'
                        : 'rgba(16, 185, 129, 0.01)'
                }
              ])
            }
          : undefined
      };
    });

    const legendData = [
      ...lineSeries.map((s) => s.name),
      ...(hasValidBand ? [confidenceBand.label || '80% ML Confidence Band'] : [])
    ];

    const option = {
      animation: true,
      animationDuration: 350,
      animationDurationUpdate: 350,
      animationEasing: 'cubicOut',
      grid: {
        top: 34,
        right: 16,
        bottom: enableZoom ? 44 : 24,
        left: 12,
        containLabel: true
      },
      legend: {
        top: 0,
        right: 4,
        data: legendData,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
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
        formatter: (params) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const axisLabel = params[0].axisValueLabel || params[0].name || '';
          const dataIdx = params[0].dataIndex;
          const lines = [`<div style="font-weight:600;margin-bottom:4px;">${axisLabel}</div>`];

          for (const item of params) {
            if (
              item.seriesName === '__ml_ci_base__' ||
              item.seriesName === (confidenceBand?.label || '80% ML Confidence Band')
            ) {
              continue;
            }
            const val = typeof item.value === 'number' ? item.value.toFixed(2) : item.value;
            lines.push(
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;">` +
                `<span>${item.marker}${item.seriesName}</span>` +
                `<span style="font-weight:600;">${val}</span>` +
              `</div>`
            );
          }

          if (
            hasValidBand &&
            dataIdx !== undefined &&
            confidenceBand.lower[dataIdx] !== undefined &&
            confidenceBand.upper[dataIdx] !== undefined
          ) {
            const lo = Number(confidenceBand.lower[dataIdx]).toFixed(2);
            const hi = Number(confidenceBand.upper[dataIdx]).toFixed(2);
            lines.push(
              `<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(148,163,184,0.25);display:flex;justify-content:space-between;gap:14px;color:#34d399;font-size:10.5px;">` +
                `<span>80% Prediction Interval</span>` +
                `<span>[${lo} – ${hi}]</span>` +
              `</div>`
            );
          }
          return lines.join('');
        },
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: tokens.axisLine,
            width: 1,
            type: 'dashed'
          },
          crossStyle: {
            color: tokens.axisLine
          },
          label: {
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10
          }
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: {
          lineStyle: { color: tokens.axisLine }
        },
        axisTick: { show: false },
        axisLabel: {
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10.5,
          color: tokens.textSecondary,
          margin: 10
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: tokens.splitLine,
            type: 'solid'
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
      },
      dataZoom: enableZoom
        ? [
            {
              type: 'inside',
              xAxisIndex: 0,
              filterMode: 'none'
            },
            {
              type: 'slider',
              xAxisIndex: 0,
              height: 14,
              bottom: 4,
              borderColor: tokens.zoomBorder,
              backgroundColor: tokens.zoomBg,
              fillerColor: tokens.zoomFiller,
              handleSize: '110%',
              showDetail: false
            }
          ]
        : [],
      series: [...bandSeries, ...lineSeries]
    };

    chart.setOption(option, { notMerge: true });
  }, [data, isDark, enableZoom, confidenceBand]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%', position: 'relative' }}
    />
  );
};

export default LineChart;
