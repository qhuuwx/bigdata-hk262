/**
 * Tab 3: Real-Time Smart Inventory Intelligence Page
 * Cumulative Doughnut chart updated every 2s + 3 institutional KPI cards + Top 10 prioritized stock alerts table.
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

  const kpiCards = [
    {
      key: 'healthy',
      label: 'Healthy Stock',
      badge: '14d ≤ Cover < 60d',
      variant: 'healthy',
      borderAccent: 'border-l-emerald-600',
      barColor: 'bg-emerald-600',
      count: healthy,
      pct: healthyPct,
      desc: 'Độ bao phủ đáp ứng từ 2 tuần đến dưới 2 tháng tiêu thụ, hoặc chưa phát sinh cầu trong 30 ngày.'
    },
    {
      key: 'low',
      label: 'Low Stock (Risk)',
      badge: 'Cover < 14d',
      variant: 'low',
      borderAccent: 'border-l-amber-600',
      barColor: 'bg-amber-500',
      count: low,
      pct: lowPct,
      desc: 'Tồn kho dưới 14 ngày bán trung bình; nguy cơ đứt hàng, cần ưu tiên bổ sung nguồn cung.'
    },
    {
      key: 'over',
      label: 'Overstock (Excess)',
      badge: 'Cover ≥ 60d',
      variant: 'over',
      borderAccent: 'border-l-rose-600',
      barColor: 'bg-rose-600',
      count: over,
      pct: overPct,
      desc: 'Lượng tồn vượt 60 ngày tiêu thụ; gây ứ đọng vốn lưu động, cần điều chuyển hoặc giảm giá.'
    }
  ];

  return (
    <div className="space-y-5">
      {/* 1. Cumulative Stream & KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Doughnut Chart */}
        <Card
          title="Cơ cấu Tồn kho Tích lũy"
          subtitle="Lô 50 bản ghi / 2s trên RAM"
          className="lg:col-span-4"
          action={
            <button
              onClick={resetCumulative}
              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-xs font-medium transition-colors"
              title="Đặt lại bộ đếm tích lũy trên máy chủ"
            >
              Đặt lại
            </button>
          }
        >
          <div className="flex-1 flex flex-col justify-center items-center">
            <DoughnutChart data={doughnutData} height={230} cutout="68%" />
          </div>
        </Card>

        {/* 3 Institutional KPI Cards + Telemetry Footer */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
            {kpiCards.map((item) => (
              <div
                key={item.key}
                className={`bg-white border border-slate-200 border-l-[3px] ${item.borderAccent} rounded-lg p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 tracking-tight">
                      {item.label}
                    </span>
                    <Badge variant={item.variant}>{item.badge}</Badge>
                  </div>

                  <div className="mt-4 mb-3">
                    <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900">
                      {formatNumber(item.count)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-1">
                      <span>Tỷ trọng tích lũy</span>
                      <span className="font-medium text-slate-700 tabular-nums">
                        {formatPercentage(item.pct)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full ${item.barColor} transition-all duration-300`}
                        style={{ width: `${Math.min(100, item.pct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2.5">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Cumulative Telemetry Strip */}
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-700">
                Tổng bản ghi tồn kho đã phân loại trong phiên máy chủ (Persistent RAM State)
              </span>
            </div>
            <div className="text-xs font-mono font-semibold tabular-nums text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              {formatNumber(total)} bản ghi
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top 10 Alerts Table Section */}
      <Card
        title="Danh sách Top 10 Cảnh báo Tồn kho Ưu tiên"
        subtitle="Ưu tiên trích xuất các mã Low Stock (Cover < 14 ngày) trước khi liệt kê Overstock (Cover ≥ 60 ngày)"
        noPadding
        action={
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            Top {alerts.length} / 10
          </span>
        }
      >
        <InventoryAlertsTable alerts={alerts} isLoading={isLoadingAlerts} />
      </Card>
    </div>
  );
};

export default InventoryTab;
