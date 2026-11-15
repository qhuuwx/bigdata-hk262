/**
 * Line Chart Component
 * Wrapper around Chart.js line charts with canvas ref and auto cleanup.
 */

import React, { useEffect, useRef } from 'react';
import { getBaseChartOptions } from '../../utils/chartTheme';

export const LineChart = ({ data, options = {}, height = 280 }) => {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const ChartConstructor = window.Chart;
    if (!ChartConstructor) {
      console.warn('Chart.js is not loaded on window');
      return;
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const mergedOptions = getBaseChartOptions({
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#64748b' }
        },
        y: {
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
          ticks: { font: { size: 11 }, color: '#64748b' }
        }
      },
      ...options
    });

    chartInstanceRef.current = new ChartConstructor(canvasRef.current, {
      type: 'line',
      data,
      options: mergedOptions
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data, options]);

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default LineChart;
