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
    handlePeriodBlur,
    forecastResult,
    isLoadingMeta,
    isForecasting,
    error,
    runForecast
  } = useForecast();

  const lineChartData = forecastResult
    ? {
        labels: forecastResult.periods || [],
        datasets: [
          {
            label: 'Normal Forecast (SMA, N=4)',
            data: forecastResult.normalForecast || [],
            borderColor: CHART_COLORS.blue,
            backgroundColor: CHART_COLORS.blueFill,
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 3.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: CHART_COLORS.blue,
            pointBorderWidth: 1.5
          },
          {
            label: 'Super Forecast (WMA [1,2,3,4] + Mùa vụ)',
            data: forecastResult.superForecast || [],
            borderColor: CHART_COLORS.orange,
            backgroundColor: CHART_COLORS.orangeFill,
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 3.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: CHART_COLORS.orange,
            pointBorderWidth: 1.5
          }
        ]
      }
    : null;

  return (
    <div className="space-y-5">
      {/* 1. Parameter Configuration Bar */}
      <Card
        title="Tham số Mô hình Dự báo Nhu cầu"
        subtitle="Thiết lập cặp Danh mục — Cửa hàng và độ dài chân trời dự báo (4 đến 24 kỳ)"
      >
        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>
        )}

        {isLoadingMeta ? (
          <LoadingSpinner text="Đang tải danh mục sản phẩm và mã cửa hàng..." size="sm" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Category Dropdown */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                Danh mục sản phẩm (Product Category)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-9 bg-white border border-slate-300 rounded-md px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Store Dropdown */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                Mã cửa hàng (Store ID)
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full h-9 bg-white border border-slate-300 rounded-md px-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {stores.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Forecast Periods Input */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                Số kỳ dự báo (4–24)
              </label>
              <input
                type="number"
                min="4"
                max="24"
                value={periods}
                onChange={(e) => setPeriods(e.target.value)}
                onBlur={handlePeriodBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runForecast();
                  }
                }}
                className="w-full h-9 bg-white border border-slate-300 rounded-md px-3 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2">
              <button
                onClick={runForecast}
                disabled={isForecasting}
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isForecasting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang tính...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <span>Chạy dự báo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Forecast Results Section */}
      {forecastResult && (
        <div className="space-y-5">
          <Card
            title="Biểu đồ Đối chiếu Quỹ đạo Dự báo (Normal vs. Super Forecast)"
            subtitle={`Danh mục: ${selectedCategory} · Cửa hàng: ${selectedStore} · Chân trời: ${forecastResult.periods?.length || periods} kỳ`}
          >
            <LineChart data={lineChartData} height={290} />
          </Card>

          <Card
            title="Bảng Đối soát Các Kỳ Sai khác Đầu tiên"
            subtitle="Trích xuất tối đa 8 kỳ có giá trị dự báo khác nhau sau khi chuẩn hóa hai chữ số thập phân (toFixed(2))"
            noPadding
            action={
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                {forecastResult.differences?.length || 0} / 8 kỳ lệch
              </span>
            }
          >
            <ForecastDiffTable differences={forecastResult.differences} />
          </Card>
        </div>
      )}
    </div>
  );
};

export default ForecastTab;
