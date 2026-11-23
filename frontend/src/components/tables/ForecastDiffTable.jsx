/**
 * Forecast Differences & 3-Way ML Trajectory Table Component
 * Supports two integrated inspection modes:
 *   1. 'diff': Up to 8 differing periods between Normal (SMA-4) and Super (WMA),
 *      enriched with ML Hybrid GBDT predictions and 80% confidence interval bounds.
 *   2. 'threeWay': Complete horizon comparison across all requested periods (T+1..T+N)
 *      showing Normal SMA-4, Super WMA, ML Hybrid GBDT, [Lower 80% – Upper 80%], and Δ (ML vs Super).
 */

import React from 'react';
import Badge from '../common/Badge';
import { formatNumber } from '../../utils/formatters';

export const ForecastDiffTable = ({
  differences = [],
  periods = [],
  normalForecast = [],
  superForecast = [],
  mlForecast = [],
  mlLower80 = [],
  mlUpper80 = [],
  viewMode = 'diff'
}) => {
  const hasMl = Array.isArray(mlForecast) && mlForecast.length > 0;
  const periodIndexMap = new Map(periods.map((p, i) => [p, i]));

  if (viewMode === 'threeWay' && periods.length > 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium text-[11px] border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-4 font-medium">Chu kỳ</th>
              <th className="py-2.5 px-4 font-medium text-right">Normal (SMA-4)</th>
              <th className="py-2.5 px-4 font-medium text-right">Super (WMA + Mùa vụ)</th>
              <th className="py-2.5 px-4 font-medium text-right">ML Hybrid Ensemble</th>
              <th className="py-2.5 px-4 font-medium text-right">Khoảng tin cậy 80% [L80 – U80]</th>
              <th className="py-2.5 px-4 font-medium text-right">Độ lệch (ML vs. Super)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
            {periods.map((pLabel, idx) => {
              const normVal = Number(normalForecast[idx]) || 0;
              const supVal = Number(superForecast[idx]) || 0;
              const mlVal = hasMl ? Number(mlForecast[idx]) || 0 : supVal;
              const loVal = Array.isArray(mlLower80) && mlLower80[idx] !== undefined ? Number(mlLower80[idx]) : mlVal;
              const hiVal = Array.isArray(mlUpper80) && mlUpper80[idx] !== undefined ? Number(mlUpper80[idx]) : mlVal;
              const deltaMlSuper = mlVal - supVal;

              return (
                <tr key={pLabel} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {pLabel}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700 dark:text-blue-400 font-medium">
                    {formatNumber(normVal, 2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                    {formatNumber(supVal, 2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                    {formatNumber(mlVal, 2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    [{formatNumber(loVal, 2)} – {formatNumber(hiVal, 2)}]
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    <span
                      className={
                        deltaMlSuper > 0.005
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : deltaMlSuper < -0.005
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : 'text-slate-400'
                      }
                    >
                      {deltaMlSuper > 0 ? '+' : ''}
                      {formatNumber(deltaMlSuper, 2)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (!differences || differences.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-xs">
        Hai mô hình cho kết quả hội tụ (không có kỳ nào sai khác sau khi chuẩn hóa hai chữ số thập phân).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium text-[11px] border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="py-2.5 px-4 font-medium">Chu kỳ</th>
            <th className="py-2.5 px-4 font-medium text-right">Normal Forecast (SMA)</th>
            <th className="py-2.5 px-4 font-medium text-right">Super Forecast (WMA)</th>
            {hasMl && (
              <>
                <th className="py-2.5 px-4 font-medium text-right">ML Hybrid Ensemble</th>
                <th className="py-2.5 px-4 font-medium text-right">Khoảng tin cậy 80%</th>
              </>
            )}
            <th className="py-2.5 px-4 font-medium text-right">Độ lệch tuyệt đối (Δ)</th>
            <th className="py-2.5 px-4 font-medium text-right">Tỷ lệ lệch (%Δ)</th>
            <th className="py-2.5 px-4 font-medium text-right">Mô hình dự báo cao hơn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
          {differences.map((row, idx) => {
            const isSuperHigher = row.higher === 'Super Forecast';
            const pIdx = periodIndexMap.has(row.period) ? periodIndexMap.get(row.period) : idx;
            const mlVal = hasMl && mlForecast[pIdx] !== undefined ? Number(mlForecast[pIdx]) : null;
            const loVal = hasMl && mlLower80[pIdx] !== undefined ? Number(mlLower80[pIdx]) : null;
            const hiVal = hasMl && mlUpper80[pIdx] !== undefined ? Number(mlUpper80[pIdx]) : null;

            return (
              <tr key={row.period || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {row.period}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700 dark:text-blue-400 font-medium">
                  {formatNumber(row.normal, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
                  {formatNumber(row.super, 2)}
                </td>
                {hasMl && (
                  <>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                      {mlVal !== null ? formatNumber(mlVal, 2) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {loVal !== null && hiVal !== null
                        ? `[${formatNumber(loVal, 2)} – ${formatNumber(hiVal, 2)}]`
                        : '—'}
                    </td>
                  </>
                )}
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatNumber(row.diff, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {row.diffPercent}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant={isSuperHigher ? 'low' : 'blue'} dot>
                    {row.higher}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ForecastDiffTable;
