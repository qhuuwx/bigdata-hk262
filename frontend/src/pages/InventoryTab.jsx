/**
 * Tab 3: Real-Time Smart Inventory Intelligence Page
 * Cumulative Doughnut chart updated every 2s + Top 10 prioritized stock alerts table.
 */

import React from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import DoughnutChart from '../components/charts/DoughnutChart';
import InventoryAlertsTable from '../components/tables/InventoryAlertsTable';
import useInventoryStream from '../hooks/useInventoryStream';
import { formatNumber, formatPercentage } from '../utils/formatters';
import { CHART_COLORS } from '../utils/chartTheme';

export const InventoryTab = () => {
  const { cumulativeState, alerts, isLoadingAlerts, resetCumulative } = useInventoryStream(true);

  const { healthy, low, over, total } = cumulativeState;

  const healthyPct = total > 0 ? (healthy / total) * 100 : 0;
  const lowPct = total > 0 ? (low / total) * 100 : 0;
  const overPct = total > 0 ? (over / total) * 100 : 0;

  // Dữ liệu biểu đồ tròn tích lũy thời gian thực
  const doughnutData = {
    labels: [
      `Healthy (${formatPercentage(healthyPct)})`,
      `Low Stock (${formatPercentage(lowPct)})`,
      `Overstock (${formatPercentage(overPct)})`
    ],
    datasets: [
      {
        data: [healthy, low, over],
        backgroundColor: [
          CHART_COLORS.inventory.healthy,
          CHART_COLORS.inventory.low,
          CHART_COLORS.inventory.over
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* 1. Cumulative Stream Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doughnut Chart */}
        <Card
          title="Tỷ Lệ Tồn Kho Tích Lũy"
          action={
            <button
              onClick={resetCumulative}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-medium transition-colors"
              title="Đặt lại bộ đếm tích lũy"
            >
            Đặt lại
            </button>
          }
          className="lg:col-span-1"
        >
          <div className="flex-1 flex flex-col justify-center items-center">
            <DoughnutChart data={doughnutData} height={240} cutout="65%" />
          </div>
        </Card>

        {/* 3 KPI Summary Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Healthy Card */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Healthy
              </span>
              <Badge variant="healthy">Cover &gt; 14d</Badge>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold font-mono text-emerald-900">
                {formatNumber(healthy)}
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-1">
                {formatPercentage(healthyPct)} tổng tích lũy
              </div>
            </div>
            <p className="text-[11px] text-emerald-600/90 leading-relaxed">
              Tồn kho an toàn đáp ứng tối thiểu 2 tuần bán lẻ.
            </p>
          </div>

          {/* Low Stock Card */}
          <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-800 uppercase tracking-wider">
              Low Stock
              </span>
              <Badge variant="low">Cover &lt; 14d</Badge>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold font-mono text-orange-900">
                {formatNumber(low)}
              </div>
              <div className="text-xs text-orange-700 font-medium mt-1">
                {formatPercentage(lowPct)} tổng tích lũy
              </div>
            </div>
            <p className="text-[11px] text-orange-600/90 leading-relaxed">
              Nguy cơ đứt hàng, cần kích hoạt đơn đặt bổ sung khẩn cấp.
            </p>
          </div>

          {/* Overstock Card */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
              Overstock
              </span>
              <Badge variant="over">Cover &gt; 60d</Badge>
            </div>
            <div className="my-3">
              <div className="text-2xl font-bold font-mono text-rose-900">
                {formatNumber(over)}
              </div>
              <div className="text-xs text-rose-700 font-medium mt-1">
                {formatPercentage(overPct)} tổng tích lũy
              </div>
            </div>
            <p className="text-[11px] text-rose-600/90 leading-relaxed">
              Tồn kho trên 2 tháng doanh số, gây ứ đọng dòng vốn.
            </p>
          </div>

          {/* Tổng tích lũy Banner */}
          <div className="sm:col-span-3 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Tổng Bản Ghi Tồn Kho Đã Xử Lý Tích Lũy
                </h4>
              </div>
            </div>
            <div className="text-lg font-bold font-mono text-sky-700 bg-sky-50 px-3 py-1 rounded-lg border border-sky-200">
              {formatNumber(total)} bản ghi
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top 10 Alerts Table Section */}
      <Card
        title="Top 10 Cảnh Báo Tồn Kho Khẩn Cấp"
      >
        <InventoryAlertsTable alerts={alerts} isLoading={isLoadingAlerts} />
      </Card>
    </div>
  );
};

export default InventoryTab;
