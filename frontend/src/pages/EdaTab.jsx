/**
 * Tab 1: EDA & Live Sales Streaming Page
 * Combines 20-row/2s live sales streaming table (max 100) and 4 Chart.js analytics charts.
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

  // Biểu đồ 1: Doanh thu theo tháng (Line chart)
  const revenueChartData = {
    labels: edaData.revenueTrend.map(d => d.month),
    datasets: [
      {
        label: 'Doanh thu ($)',
        data: edaData.revenueTrend.map(d => d.revenue),
        borderColor: CHART_COLORS.blue,
        backgroundColor: CHART_COLORS.blueFill,
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  // Biểu đồ 2: Top 10 Product Category bán chạy (Bar chart ngang)
  const topCategoriesChartData = {
    labels: edaData.topCategories.map(d => d.category),
    datasets: [
      {
        label: 'Số lượng bán (Qty)',
        data: edaData.topCategories.map(d => d.qty),
        backgroundColor: CHART_COLORS.palette.slice(0, edaData.topCategories.length),
        borderRadius: 4
      }
    ]
  };

  // Biểu đồ 3: Phân bổ doanh thu theo Sales Channel (Doughnut chart)
  const channelChartData = {
    labels: edaData.channelSplit.map(d => `${d.channel} (${d.percentage}%)`),
    datasets: [
      {
        data: edaData.channelSplit.map(d => d.amount),
        backgroundColor: [CHART_COLORS.blue, CHART_COLORS.orange, CHART_COLORS.green, CHART_COLORS.purple],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // Biểu đồ 4: Tỷ lệ hàng hoàn trả theo Product Division (Bar chart dọc)
  const returnRateChartData = {
    labels: edaData.returnRate.map(d => d.division),
    datasets: [
      {
        label: 'Tỷ lệ hoàn trả (%)',
        data: edaData.returnRate.map(d => d.returnRate),
        backgroundColor: CHART_COLORS.orange,
        borderRadius: 4
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Sales Stream Section */}
      <Card
        title="Mô phỏng luồng giao dịch thời gian thực"
        action={
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider font-mono bg-sky-100 text-sky-800 px-2 py-1 rounded">
              {salesRows.length}/100 dòng
            </span>
            <button
              onClick={toggleStreaming}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors ${isStreaming
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                }`}
            >
              {isStreaming ? '⏸ Tạm dừng' : '▶ Tiếp tục'}
            </button>
            <button
              onClick={clearRows}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors"
            >
              Xóa bảng
            </button>
          </div>
        }
      >
        <SalesStreamTable rows={salesRows} />
      </Card>

      {/* 2. EDA Analytics Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-x font-semibold text-slate-600 text-gray-950 uppercase tracking-wider">
              Phân tích tổng quan doanh số và hành vi tiêu dùng từ 125.751 giao dịch lịch sử
            </h1>
          </div>
        </div>

        {error && <ErrorAlert message={error} onRetry={refetch} />}

        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12">
            <LoadingSpinner text="Đang nạp 4 biểu đồ phân tích EDA..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Biểu đồ 1 */}
            <Card
              title="1. Xu Hướng Doanh Thu Theo Thời Gian"
            >
              <LineChart data={revenueChartData} height={260} />
            </Card>

            {/* Biểu đồ 2 */}
            <Card
              title="2. Top 10 Danh Mục Sản Phẩm Bán Chạy"
            >
              <BarChart data={topCategoriesChartData} horizontal={true} height={260} />
            </Card>

            {/* Biểu đồ 3 */}
            <Card
              title="3. Phân Bổ Doanh Thu Theo Kênh Bán Hàng"
            >
              <DoughnutChart data={channelChartData} height={260} />
            </Card>

            {/* Biểu đồ 4 */}
            <Card
              title="4. Tỷ Lệ Đổi Trả Theo Nhóm Sản Phẩm"
            >
              <BarChart data={returnRateChartData} height={260} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default EdaTab;
