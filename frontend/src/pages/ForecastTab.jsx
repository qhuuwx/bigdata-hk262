/**
 * Tab 2: Demand Forecast Comparison Page
 * Compares Normal Forecast (SMA) vs Super Forecast (WMA + Seasonality) with dual line chart and 8-row diff table.
 */

import React from 'react';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorAlert from '../components/common/ErrorAlert';
import LineChart from '../components/charts/LineChart';
import ForecastDiffTable from '../components/tables/ForecastDiffTable';
import useForecast from '../hooks/useForecast';
import { CHART_COLORS } from '../utils/chartTheme';

export const ForecastTab = () => {
  const {
    categories,
    stores,
    selectedCategory,
    setSelectedCategory,
    selectedStore,
    setSelectedStore,
    periods,
    setPeriods,
    forecastResult,
    isLoadingMeta,
    isForecasting,
    error,
    runForecast
  } = useForecast();

  // Biểu đồ so sánh 2 đường Normal vs Super Forecast
  const lineChartData = forecastResult ? {
    labels: forecastResult.periods || [],
    datasets: [
      {
        label: 'Normal Forecast (SMA)',
        data: forecastResult.normalForecast || [],
        borderColor: CHART_COLORS.blue,
        backgroundColor: CHART_COLORS.blueFill,
        borderWidth: 2.5,
        tension: 0.2,
        pointRadius: 4
      },
      {
        label: 'Super Forecast (WMA + Seasonality)',
        data: forecastResult.superForecast || [],
        borderColor: CHART_COLORS.orange,
        backgroundColor: CHART_COLORS.orangeFill,
        borderWidth: 2.5,
        tension: 0.2,
        pointRadius: 4
      }
    ]
  } : null;

  return (
    <div className="space-y-6">
      {/* 1. Interactive Form Control Card */}
      <Card
        title="Dự Báo Nhu Cầu Bán Lẻ"
        subtitle="Chọn Danh mục sản phẩm, Cửa hàng và Số kỳ tương lai"
      >
        {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

        {isLoadingMeta ? (
          <LoadingSpinner text="Đang nạp danh mục và cửa hàng..." size="sm" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Product Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Store ID
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              >
                {stores.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Forecast Periods Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Số kỳ dự báo (4 - 24)
              </label>
              <input
                type="number"
                min="4"
                max="24"
                value={periods}
                onChange={(e) => setPeriods(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white font-mono"
              />
            </div>

            {/* Submit Action Button */}
            <div>
              <button
                onClick={runForecast}
                disabled={isForecasting}
                className="w-full bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-all shadow-md shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isForecasting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang tính toán...</span>
                  </>
                ) : (
                  <>
                    <span>Dự Báo Ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Forecast Results Section */}
      {forecastResult && (
        <div className="space-y-6">
          {/* Dual Line Chart */}
          <Card
            title="Biểu Đồ So Sánh Dự Báo (Normal vs Super Forecast)"
            subtitle={`Đường xanh: Normal Forecast (SMA, N=4) | Đường cam: Super Forecast (WMA [1,2,3,4] + Mùa vụ)`}
          >
            <LineChart data={lineChartData} height={300} />
          </Card>

          {/* 8 Differing Rows Comparison Table */}
          <Card
            title="Bảng Đối Soát 8 Kỳ Khác Biệt Đầu Tiên"
            subtitle="Chỉ liệt kê tối đa 8 kỳ có giá trị sai khác giữa 2 thuật toán (làm tròn toFixed(2) trước khi so sánh)"
          >
            <ForecastDiffTable differences={forecastResult.differences} />
          </Card>
        </div>
      )}
    </div>
  );
};

export default ForecastTab;
