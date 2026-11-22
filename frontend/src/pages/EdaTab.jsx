/**
 * Tab 1: EDA & Live Sales Streaming Page
 * Combines 20-row/2s live sales streaming tape (max 100) and 4 Chart.js analytical panels.
 */

import React from 'react';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import SalesStreamTable from '../components/tables/SalesStreamTable';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import DoughnutChart from '../components/charts/DoughnutChart';
import useSalesStream from '../hooks/useSalesStream';
import useEdaData from '../hooks/useEdaData';
import { CHART_COLORS } from '../utils/chartTheme';

export const EdaTab = () => {
  const { salesRows, isStreaming, toggleStreaming, clearRows } = useSalesStream(true);
  const { edaData, isLoading, error, refetch } = useEdaData();

  const revenueChartData = {
    labels: edaData.revenueTrend.map(d => d.month),
    datasets: [
      {
        label: 'Doanh thu thuần ($)',
        data: edaData.revenueTrend.map(d => d.revenue),
        borderColor: CHART_COLORS.blue,
        backgroundColor: CHART_COLORS.blueFill,
        borderWidth: 2,
        fill: true,
        tension: 0.25,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: CHART_COLORS.blue,
        pointBorderWidth: 1.5
      }
    ]
  };

  const topCategoriesChartData = {
    labels: edaData.topCategories.map(d => d.category),
    datasets: [
      {
        label: 'Sản lượng bán (đơn vị)',
        data: edaData.topCategories.map(d => d.qty),
        backgroundColor: CHART_COLORS.palette.slice(0, edaData.topCategories.length),
        borderRadius: 3,
        barThickness: 14
      }
    ]
  };

  const channelChartData = {
    labels: edaData.channelSplit.map(d => `${d.channel} (${d.percentage}%)`),
    datasets: [
      {
        data: edaData.channelSplit.map(d => d.sales ?? d.amount ?? 0),
        backgroundColor: [CHART_COLORS.blue, CHART_COLORS.slate, CHART_COLORS.green, CHART_COLORS.orange],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const returnRateChartData = {
    labels: edaData.returnRate.map(d => d.division),
    datasets: [
      {
        label: 'Tỷ lệ hoàn trả (%)',
        data: edaData.returnRate.map(d => d.returnRate),
        backgroundColor: CHART_COLORS.orange,
        borderRadius: 3,
        maxBarThickness: 44
      }
    ]
  };

  return (
    <div className="space-y-5">
      {/* 1. Live Sales Stream Section */}
      <Card
        title="Luồng Giao dịch Bán hàng Thời gian thực"
        subtitle="Lấy mẫu ngẫu nhiên 20 giao dịch mỗi chu kỳ 2.000 ms từ bộ nhớ đệm (giữ tối đa 100 bản ghi gần nhất)"
        noPadding
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700">
              <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{isStreaming ? 'LIVE' : 'PAUSED'}</span>
              <span className="text-slate-300">|</span>
              <span className="tabular-nums">{salesRows.length}/100</span>
            </div>

            <button
              onClick={toggleStreaming}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                isStreaming
                  ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
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
              className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-xs font-medium transition-colors"
            >
              Xóa bộ đệm
            </button>
          </div>
        }
      >
        <SalesStreamTable rows={salesRows} />
      </Card>

      {/* 2. EDA Analytics Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Thống kê Khám phá Dữ liệu (EDA)
            </h2>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">
              Tổng hợp trên 125.751 giao dịch lịch sử (2025-06 đến 2026-04)
            </span>
          </div>
        </div>

        {error && <ErrorAlert message={error} onRetry={refetch} />}

        {isLoading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-10">
            <LoadingSpinner text="Đang tổng hợp 4 biểu đồ phân tích EDA..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card
              title="Xu hướng Doanh thu Theo Tháng"
              subtitle="Tổng doanh thu thuần ($) theo chu kỳ tháng YYYY-MM"
            >
              <LineChart data={revenueChartData} height={250} />
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
              <DoughnutChart data={channelChartData} height={250} />
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
