/**
 * Inventory Alerts Table Component
 * Displays top 10 prioritized stock alerts (Low Stock urgent first, then Overstock).
 */

import React from 'react';
import Badge from '../common/Badge';
import { formatNumber } from '../../utils/formatters';

export const InventoryAlertsTable = ({ alerts = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-400 text-xs">
        Đang truy xuất danh sách cảnh báo tồn kho...
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-xs">
        Không ghi nhận cảnh báo tồn kho vượt ngưỡng tại thời điểm này.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] border-b border-slate-200">
          <tr>
            <th className="py-2.5 px-4 font-medium w-14">Hạng</th>
            <th className="py-2.5 px-4 font-medium">Danh mục sản phẩm</th>
            <th className="py-2.5 px-4 font-medium">Cửa hàng</th>
            <th className="py-2.5 px-4 font-medium text-right">Tồn kho hiện hữu</th>
            <th className="py-2.5 px-4 font-medium text-center">Phân loại ngưỡng</th>
            <th className="py-2.5 px-4 font-medium text-right">Mức độ ưu tiên</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {alerts.map((row, idx) => {
            const statusText = row.stockStatus || row.status || row['Stock Status'] || 'Low Stock';
            const isLow = statusText.toLowerCase().includes('low');
            const cleanLevel = isLow ? 'Khẩn cấp (Cover < 14d)' : 'Chú ý (Cover ≥ 60d)';
            return (
              <tr key={`${row.category}-${row.store}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </td>
                <td className="py-2.5 px-4 font-medium text-slate-900">
                  {row.category}
                </td>
                <td className="py-2.5 px-4">
                  <span className="inline-block bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded text-[11px] font-mono text-slate-700">
                    {row.store}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                  {formatNumber(row.qtyOnHand)}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <Badge variant={isLow ? 'low' : 'over'}>
                    {statusText}
                  </Badge>
                </td>
                <td className="py-2.5 px-4 text-right">
                  <Badge variant={isLow ? 'urgent' : 'warning'} dot>
                    {cleanLevel}
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
