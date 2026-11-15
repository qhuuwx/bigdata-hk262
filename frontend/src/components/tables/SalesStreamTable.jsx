/**
 * Sales Stream Table Component
 * Renders scrollable table of live transactions, up to 100 rows, prepending new items.
 */

import React from 'react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export const SalesStreamTable = ({ rows = [] }) => {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[360px] overflow-y-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] sticky top-0 border-b border-slate-200 z-10">
          <tr>
            <th className="py-2.5 px-3">Transaction Date</th>
            <th className="py-2.5 px-3">Product Division</th>
            <th className="py-2.5 px-3">Product Category</th>
            <th className="py-2.5 px-3">Store</th>
            <th className="py-2.5 px-3">Sales Channel</th>
            <th className="py-2.5 px-3 text-right">Qty Sold</th>
            <th className="py-2.5 px-3 text-right">Sales Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
          {rows.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center py-8 text-slate-400">
                Đang chờ luồng dữ liệu streaming...
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-sky-50/50 transition-colors duration-150 odd:bg-white even:bg-slate-50/30"
              >
                <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  {row['Transaction Date']}
                </td>
                <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                  {row['Product Division']}
                </td>
                <td className="py-2 px-3 truncate max-w-[200px]" title={row['Product Category']}>
                  {row['Product Category']}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-600">
                    {row['Store']}
                  </span>
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="text-sky-700 font-medium">{row['Sales Channel']}</span>
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                  {formatNumber(row['Qty Sold'])}
                </td>
                <td className="py-2 px-3 text-right font-mono text-emerald-600 font-semibold">
                  {formatCurrency(row['Sales Amount'])}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SalesStreamTable;
