/**
 * Forecast Differences Table Component
 * Displays up to 8 differing periods between Normal (SMA) and Super (WMA + Seasonality) models.
 */

import React from 'react';
import Badge from '../common/Badge';
import { formatNumber } from '../../utils/formatters';

export const ForecastDiffTable = ({ differences = [] }) => {
  if (!differences || differences.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-xs">
        Hai mô hình cho kết quả hội tụ (không có kỳ nào sai khác sau khi chuẩn hóa hai chữ số thập phân).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-4 font-medium">Chu kỳ</th>
            <th className="py-2.5 px-4 font-medium text-right">Normal Forecast (SMA)</th>
            <th className="py-2.5 px-4 font-medium text-right">Super Forecast (WMA)</th>
            <th className="py-2.5 px-4 font-medium text-right">Độ lệch tuyệt đối (Δ)</th>
            <th className="py-2.5 px-4 font-medium text-right">Tỷ lệ lệch (%Δ)</th>
            <th className="py-2.5 px-4 font-medium text-right">Mô hình dự báo cao hơn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {differences.map((row, idx) => {
            const isSuperHigher = row.higher === 'Super Forecast';
            return (
              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                  {row.period}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700 font-medium">
                  {formatNumber(row.normal, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 font-semibold">
                  {formatNumber(row.super, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                  {formatNumber(row.diff, 2)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
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
