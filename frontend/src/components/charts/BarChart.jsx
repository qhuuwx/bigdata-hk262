/**
 * Bar Chart Component
 * Wrapper around Chart.js bar charts (supports horizontal and vertical layout).
 */

import React, { useEffect, useRef } from 'react';
import { getBaseChartOptions } from '../../utils/chartTheme';

export const BarChart = ({ data, options = {}, horizontal = false, height = 280 }) => {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const ChartConstructor = window.Chart;
    if (!ChartConstructor) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const mergedOptions = getBaseChartOptions({
      indexAxis: horizontal ? 'y' : 'x',
      scales: {
        x: {
          grid: { display: horizontal, color: 'rgba(226, 232, 240, 0.6)' },
          ticks: { font: { size: 11 }, color: '#64748b' }
        },
        y: {
          grid: { display: !horizontal, color: 'rgba(226, 232, 240, 0.6)' },
          ticks: { font: { size: 11 }, color: '#64748b' }
        }
      },
      ...options
    });

    chartInstanceRef.current = new ChartConstructor(canvasRef.current, {
      type: 'bar',
      data,
      options: mergedOptions
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data, options, horizontal]);

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default BarChart;
