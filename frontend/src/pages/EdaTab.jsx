/**
 * Tab 1: EDA & Live Sales Streaming Page
 * Combines 20-row/2s SSE live sales streaming tape (max 100), interactive multi-dimensional
 * EDA filter bar (Store, Division, Month Range) with active filter pills, and 4 Apache ECharts panels.
 */

import React from 'react';
import Card from '../components/common/Card';
import ErrorAlert from '../components/common/ErrorAlert';
import { SkeletonCard } from '../components/common/Skeleton';
import SalesStreamTable from '../components/tables/SalesStreamTable';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DoughnutChart from '../components/charts/DoughnutChart';
import useSalesStream from '../hooks/useSalesStream';
import useEdaData from '../hooks/useEdaData';
import { CHART_COLORS } from '../utils/chartTheme';

export const EdaTab = () => {
  const { salesRows, isStreaming, transportMode, toggleStreaming, clearRows } = useSalesStream(true);
  const {
    edaData,
    filterMeta,
    filters,
    activeFilterPills,
    updateFilter,
    resetFilters,
    isLoading,
    error,
    refetch
  } = useEdaData();

  const revenueChartData = {
    labels: edaData.revenueTrend.map((d) => d.month),
    datasets: [
      {
        label: 'Doanh thu thuần ($)',
        data: edaData.revenueTrend.map((d) => d.revenue),
        borderColor: CHART_COLORS.blue,
        backgroundColor: CHART_COLORS.blueFill,
        fill: true
      }
    ]
  };

  const topCategoriesChartData = {
    labels: edaData.topCategories.map((d) => d.category),
    datasets: [
      {
        label: 'Sản lượng bán (đơn vị)',
        data: edaData.topCategories.map((d) => d.qty),
        backgroundColor: CHART_COLORS.palette.slice(0, edaData.topCategories.length),
        barThickness: 14
      }
    ]
  };

  const channelChartData = {
    labels: edaData.channelSplit.map((d) => `${d.channel} (${d.percentage}%)`),
    datasets: [
      {
        data: edaData.channelSplit.map((d) => d.sales ?? d.amount ?? 0),
        backgroundColor: [CHART_COLORS.blue, CHART_COLORS.slate, CHART_COLORS.green, CHART_COLORS.orange]
      }
    ]
  };

  const returnRateChartData = {
    labels: edaData.returnRate.map((d) => d.division),
    datasets: [
      {
        label: 'Tỷ lệ hoàn trả (%)',
        data: edaData.returnRate.map((d) => d.returnRate),
        backgroundColor: CHART_COLORS.orange,
        maxBarThickness: 44
      }
    ]
  };

  return (
    <div className="space-y-5 animate-tab-panel">
      {/* 1. Live Sales Stream Section */}
      <Card
        title="Luồng Giao dịch Bán hàng Thời gian thực"
        subtitle="Đẩy 20 giao dịch mỗi chu kỳ 2.000 ms từ bộ nhớ đệm qua Server-Sent Events (giữ tối đa 100 bản ghi gần nhất)"
        noPadding
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{isStreaming ? `${transportMode.toUpperCase()} LIVE` : 'PAUSED'}</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="tabular-nums">{salesRows.length}/100</span>
            </div>

            <button
              onClick={toggleStreaming}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                isStreaming
                  ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-blue-600 border-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isStreaming ? (
                <>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Tiếp tục</span>
                </>
              )}
            </button>

            <button
              onClick={clearRows}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-medium transition-colors"
            >
              Xóa bộ đệm
            </button>
          </div>
        }
      >
        <SalesStreamTable rows={salesRows} />
      </Card>

      {/* 2. EDA Analytics Section + Interactive Filter Bar */}
      <div className="space-y-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Thống kê Khám phá Dữ liệu (EDA)
              </h2>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Truy vấn đa chiều trên 125.751 giao dịch lịch sử (2025-06 đến 2026-04)
              </span>
            </div>

            {activeFilterPills.length > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Đặt lại tất cả bộ lọc ({activeFilterPills.length})</span>
              </button>
            )}
          </div>

          {/* Filter Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10.5px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                Cửa hàng (Store)
              </label>
              <select
                value={filters.store}
                onChange={(e) => updateFilter('store', e.target.value)}
                className="w-full h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Tất cả cửa hàng (40)</option>
                {filterMeta.stores.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                Nhóm sản phẩm (Division)
              </label>
              <select
                value={filters.division}
                onChange={(e) => updateFilter('division', e.target.value)}
                className="w-full h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Tất cả nhóm hàng (3)</option>
                {filterMeta.divisions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                Từ tháng (Start Month)
              </label>
              <select
                value={filters.startMonth}
                onChange={(e) => updateFilter('startMonth', e.target.value)}
                className="w-full h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Từ đầu kỳ (2025-06)</option>
                {filterMeta.months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10.5px] font-mono uppercase text-slate-500 dark:text-slate-400 mb-1">
                Đến tháng (End Month)
              </label>
              <select
                value={filters.endMonth}
                onChange={(e) => updateFilter('endMonth', e.target.value)}
                className="w-full h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Đến cuối kỳ (2026-04)</option>
                {filterMeta.months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Pills */}
          {activeFilterPills.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-slate-400">Đang lọc:</span>
              {activeFilterPills.map((pill) => (
                <span
                  key={pill.key}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-mono"
                >
                  <span>{pill.label}</span>
                  <button
                    type="button"
                    onClick={() => updateFilter(pill.key, 'ALL')}
                    className="hover:text-blue-900 dark:hover:text-white font-bold"
                    title="Gỡ điều kiện lọc này"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <ErrorAlert message={error} onRetry={refetch} />}

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SkeletonCard height={250} variant="line" />
            <SkeletonCard height={250} variant="bar" />
            <SkeletonCard height={250} variant="doughnut" />
            <SkeletonCard height={250} variant="bar" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card
              title="Xu hướng Doanh thu Theo Tháng"
              subtitle="Tổng doanh thu thuần ($) theo chu kỳ tháng YYYY-MM (hỗ trợ kéo thanh trượt thu phóng)"
            >
              <LineChart data={revenueChartData} height={250} enableZoom={true} />
            </Card>

            <Card
              title="Top 10 Danh mục Sản phẩm Bán chạy"
              subtitle="Xếp hạng theo tổng sản lượng tiêu thụ (Qty Sold)"
            >
              <BarChart data={topCategoriesChartData} horizontal={true} height={250} />
            </Card>

            <Card
              title="Cơ cấu Doanh thu Theo Kênh Phân phối"
              subtitle="Tỷ trọng doanh thu ($) giữa các kênh bán hàng"
            >
              <DoughnutChart
                data={channelChartData}
                height={250}
                centerLabel="100%"
                centerSubLabel="Channel Share"
              />
            </Card>

            <Card
              title="Tỷ lệ Hoàn trả Theo Nhóm Sản phẩm"
              subtitle="Tỷ lệ giao dịch có Is Return = 1 trên tổng đơn từng nhóm (%)"
            >
              <BarChart data={returnRateChartData} height={250} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default EdaTab;
