/**
 * Forecast Differences Table Component
 * Displays up to 8 differing periods between Normal and Super Forecast algorithms.
 */

import React from 'react';
import Badge from '../common/Badge';
import { formatNumber } from '../../utils/formatters';

export const ForecastDiffTable = ({ differences = [] }) => {
  if (!differences || differences.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-lg border border-slate-200">
        Hai thuật toán cho kết quả tương đương (không có kỳ nào sai khác sau khi làm tròn 2 chữ số thập phân).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-3">Kỳ</th>
            <th className="py-2.5 px-3 text-right">Normal Forecast</th>
            <th className="py-2.5 px-3 text-right">Super Forecast</th>
            <th className="py-2.5 px-3 text-right">Chênh lệch</th>
            <th className="py-2.5 px-3 text-right">Chênh lệch (%)</th>
            <th className="py-2.5 px-3 text-center">Thuật toán cao hơn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
          {differences.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50 transition-colors">
              <td className="py-2 px-3 font-semibold text-slate-800">{row.period}</td>
              <td className="py-2 px-3 text-right font-mono text-sky-700 font-medium">
                {formatNumber(row.normal, 2)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-orange-600 font-semibold">
                {formatNumber(row.super, 2)}
              </td>
              <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                {formatNumber(row.diff, 2)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-slate-600">
                {row.diffPercent}
              </td>
              <td className="py-2 px-3 text-center">
                <Badge variant={row.higher === 'Super Forecast' ? 'low' : 'blue'}>
                  {row.higher}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ForecastDiffTable;
