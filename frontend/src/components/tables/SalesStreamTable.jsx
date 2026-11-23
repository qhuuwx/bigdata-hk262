/**
 * Sales Stream Table Component
 * High-density institutional transaction tape (up to 100 rows, newest first)
 * with row entrance flash animations and Dark Mode support.
 */

import React from 'react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export const SalesStreamTable = ({ rows = [] }) => {
  return (
    <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50/95 dark:bg-slate-800/95 text-slate-500 dark:text-slate-400 font-medium text-[11px] sticky top-0 border-b border-slate-200 dark:border-slate-800 z-10 backdrop-blur-sm">
          <tr>
            <th className="py-2.5 px-4 font-medium">Ngày giao dịch</th>
            <th className="py-2.5 px-4 font-medium">Nhóm hàng</th>
            <th className="py-2.5 px-4 font-medium">Danh mục sản phẩm</th>
            <th className="py-2.5 px-4 font-medium">Cửa hàng</th>
            <th className="py-2.5 px-4 font-medium">Kênh phân phối</th>
            <th className="py-2.5 px-4 font-medium text-right">Số lượng</th>
            <th className="py-2.5 px-4 font-medium text-right">Giá trị ($)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
          {rows.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                Đang đồng bộ luồng giao dịch từ bộ nhớ máy chủ...
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const qty = Number(row['Qty Sold']) || 0;
              const amt = Number(row['Sales Amount']) || 0;
              const isNegative = amt < 0 || qty < 0;
              return (
                <tr
                  key={row._rowKey || idx}
                  className="animate-row-enter hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors duration-100"
                >
                  <td className="py-2 px-4 font-mono text-[11.5px] text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {row['Transaction Date']}
                  </td>
                  <td className="py-2 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {row['Product Division']}
                  </td>
                  <td className="py-2 px-4 text-slate-600 dark:text-slate-300 truncate max-w-[240px]" title={row['Product Category']}>
                    {row['Product Category']}
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">
                      {row['Store']}
                    </span>
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11.5px]">
                    {row['Sales Channel']}
                  </td>
                  <td className={`py-2 px-4 text-right font-mono tabular-nums font-medium ${isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {formatNumber(qty)}
                  </td>
                  <td className={`py-2 px-4 text-right font-mono tabular-nums font-medium ${isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {formatCurrency(amt)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SalesStreamTable;
