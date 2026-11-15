/**
 * Doughnut Chart Component
 * Wrapper around Chart.js doughnut charts with in-place smooth data updating.
 */

import React, { useEffect, useRef } from 'react';
import { getBaseChartOptions } from '../../utils/chartTheme';

export const DoughnutChart = ({ data, options = {}, cutout = '70%', height = 260 }) => {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const ChartConstructor = window.Chart;
    if (!ChartConstructor) return;

    if (chartInstanceRef.current) {
      // In-place update to prevent canvas flickering during real-time polling
      chartInstanceRef.current.data = data;
      chartInstanceRef.current.update('none'); // silent update without full re-animation
      return;
    }

    const mergedOptions = getBaseChartOptions({
      cutout,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Inter, sans-serif', size: 12 },
            boxWidth: 12,
            padding: 12
          }
        }
      },
      ...options
    });

    chartInstanceRef.current = new ChartConstructor(canvasRef.current, {
      type: 'doughnut',
      data,
      options: mergedOptions
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data, options, cutout]);

  return (
    <div style={{ height: `${height}px`, width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default DoughnutChart;
