/**
 * Inventory Alerts Table Component
 * Displays top 10 prioritized stock alerts (Low Stock first, then Overstock).
 */

import React from 'react';
import Badge from '../common/Badge';
import { formatNumber } from '../../utils/formatters';

export const InventoryAlertsTable = ({ alerts = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-400 text-xs">
        Đang nạp danh sách cảnh báo tồn kho...
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-lg border border-slate-200">
        Không có cảnh báo tồn kho nghiêm trọng tại thời điểm này.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-3">Product Category</th>
            <th className="py-2.5 px-3">Store</th>
            <th className="py-2.5 px-3 text-right">Qty on hand</th>
            <th className="py-2.5 px-3 text-center">Stock Status</th>
            <th className="py-2.5 px-3 text-center">Mức độ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
          {alerts.map((row, idx) => {
            const isLow = row.status === 'Low Stock';
            return (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 font-medium text-slate-800">{row.category}</td>
                <td className="py-2.5 px-3">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono text-slate-600">
                    {row.store}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                  {formatNumber(row.qtyOnHand)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <Badge variant={isLow ? 'low' : 'over'}>
                    {row.status}
                  </Badge>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <Badge variant={isLow ? 'urgent' : 'warning'}>
                    {row.level}
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

export default InventoryAlertsTable;
