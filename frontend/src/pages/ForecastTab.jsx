/**
 * Tab 2: Demand Forecast Comparison Page
 * Compares Normal Forecast (SMA-4) vs Super Forecast (WMA + Seasonality) vs ML Hybrid Ensemble (GBDT)
 * with translucent 80% prediction interval bands, 3-way trajectory table, and empirical CV benchmark card.
 */

import React from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import ErrorAlert from '../components/common/ErrorAlert';
import { SkeletonCard, SkeletonTable } from '../components/common/Skeleton';
import LineChart from '../components/charts/LineChart';
import ForecastDiffTable from '../components/tables/ForecastDiffTable';
import useForecast from '../hooks/useForecast';
import { CHART_COLORS } from '../utils/chartTheme';
import { formatNumber } from '../utils/formatters';

const MODEL_DISPLAY_LABELS = {
  Hybrid_GBDT_Seasonal_Ensemble: 'Hybrid GBDT + Ridge + Seasonal Ensemble',
  HistGBDT_Tuned: 'HistGradientBoosting (Quantile q=0.42, Tuned)',
  RandomForest_Panel: 'RandomForest Panel Forecaster (80 Trees)',
  Ridge_Autoregressive: 'RidgeCV Autoregressive (L2 Shrinkage)',
  Baseline_1_SMA4: 'Baseline 1: Normal Forecast (SMA, N=4)',
  Baseline_2_Super_WMA_Seasonal: 'Baseline 2: Super Forecast (WMA [1,2,3,4] + Seasonality)'
};

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
    mlMetrics,
    isLoadingMetrics,
    showConfidenceBand,
    setShowConfidenceBand,
    tableViewMode,
    setTableViewMode,
    isLoadingMeta,
    isForecasting,
    error,
    runForecast
  } = useForecast();

  const hasMlSeries =
    forecastResult &&
    Array.isArray(forecastResult.mlForecast) &&
    forecastResult.mlForecast.length > 0;

  const lineChartData = forecastResult
    ? {
        labels: forecastResult.periods || [],
        datasets: [
          {
            label: 'Normal Forecast (SMA, N=4)',
            data: forecastResult.normalForecast || [],
            borderColor: CHART_COLORS.blue,
            backgroundColor: CHART_COLORS.blueFill,
            fill: true
          },
          {
            label: 'Super Forecast (WMA [1,2,3,4] + Mùa vụ)',
            data: forecastResult.superForecast || [],
            borderColor: CHART_COLORS.orange,
            backgroundColor: CHART_COLORS.orangeFill,
            fill: true
          },
          ...(hasMlSeries
            ? [
                {
                  label: `ML Forecast (${forecastResult.mlModel || 'Hybrid GBDT'})`,
                  data: forecastResult.mlForecast,
                  borderColor: CHART_COLORS.green,
                  backgroundColor: 'rgba(16, 185, 129, 0.10)',
                  borderWidth: 2.5,
                  fill: false
                }
              ]
            : [])
        ]
      }
    : null;

  const activeConfidenceBand =
    showConfidenceBand &&
    hasMlSeries &&
    Array.isArray(forecastResult.mlLower80) &&
    Array.isArray(forecastResult.mlUpper80)
      ? {
          lower: forecastResult.mlLower80,
          upper: forecastResult.mlUpper80,
          label: '80% ML Prediction Interval'
        }
      : null;

  const fcBench = mlMetrics?.demand_forecasting;
  const fcModels = fcBench?.models ? Object.entries(fcBench.models) : [];

  return (
    <div className="space-y-5 animate-tab-panel">
      {/* 1. Parameter Configuration Bar */}
      <Card
        title="Tham số Mô hình Dự báo Nhu cầu"
        subtitle="Thiết lập cặp Danh mục — Cửa hàng và độ dài chân trời dự báo (4 đến 24 kỳ) đồng bộ trực tiếp với URL"
      >
        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>
        )}

        {isLoadingMeta ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-pulse">
            <div className="md:col-span-5 h-9 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="md:col-span-3 h-9 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="md:col-span-2 h-9 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="md:col-span-2 h-9 rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Category Dropdown */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Danh mục sản phẩm (Product Category)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Mã cửa hàng (Store ID)
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">
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
                className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Submit Button */}
            <div className="md:col-span-2">
              <button
                onClick={runForecast}
                disabled={isForecasting}
                className="w-full h-9 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-medium px-4 rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      {isForecasting && !forecastResult ? (
        <div className="space-y-5">
          <SkeletonCard height={290} variant="line" />
          <Card title="Bảng Đối soát Các Kỳ Sai khác Đầu tiên" noPadding>
            <SkeletonTable rows={6} cols={6} />
          </Card>
        </div>
      ) : (
        forecastResult && (
          <div className="space-y-5">
            <Card
              title="Biểu đồ Đối chiếu Quỹ đạo Dự báo (Normal SMA vs. Super WMA vs. ML Hybrid GBDT)"
              subtitle={`Danh mục: ${selectedCategory} · Cửa hàng: ${selectedStore} · Chân trời: ${forecastResult.periods?.length || periods} kỳ (kèm dải tin cậy phân vị 80%)`}
              action={
                hasMlSeries && (
                  <div className="flex items-center gap-2">
                    <Badge variant="healthy" dot>
                      {forecastResult.mlModel || 'Hybrid_GBDT_Seasonal_Ensemble'}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setShowConfidenceBand((prev) => !prev)}
                      className={`px-2.5 py-1 rounded border text-[11px] font-mono font-medium transition-colors ${
                        showConfidenceBand
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {showConfidenceBand ? '● 80% CI Band: ON' : '○ 80% CI Band: OFF'}
                    </button>
                  </div>
                )
              }
            >
              <LineChart
                data={lineChartData}
                height={300}
                enableZoom={true}
                confidenceBand={activeConfidenceBand}
              />
            </Card>

            <Card
              title={
                tableViewMode === 'threeWay'
                  ? 'Bảng Đối chiếu Toàn Chân trời 3 Mô hình (SMA-4 vs. Super WMA vs. ML Ensemble + 80% CI)'
                  : 'Bảng Đối soát Các Kỳ Sai khác Đầu tiên (Kèm Dự báo ML & Khoảng tin cậy 80%)'
              }
              subtitle={
                tableViewMode === 'threeWay'
                  ? 'Hiển thị đầy đủ giá trị dự báo và cận dưới/cận trên phân vị 80% [L80 – U80] trên toàn bộ các kỳ T+1..T+N'
                  : 'Trích xuất tối đa 8 kỳ có giá trị dự báo khác nhau sau khi chuẩn hóa hai chữ số thập phân (toFixed(2))'
              }
              noPadding
              action={
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTableViewMode('diff')}
                      className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                        tableViewMode === 'diff'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      Top 8 Kỳ lệch ({forecastResult.differences?.length || 0}/8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableViewMode('threeWay')}
                      className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                        tableViewMode === 'threeWay'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      Toàn chân trời 3 mô hình ({forecastResult.periods?.length || 0})
                    </button>
                  </div>
                </div>
              }
            >
              <ForecastDiffTable
                differences={forecastResult.differences}
                periods={forecastResult.periods || []}
                normalForecast={forecastResult.normalForecast || []}
                superForecast={forecastResult.superForecast || []}
                mlForecast={forecastResult.mlForecast || []}
                mlLower80={forecastResult.mlLower80 || []}
                mlUpper80={forecastResult.mlUpper80 || []}
                viewMode={tableViewMode}
              />
            </Card>
          </div>
        )
      )}

      {/* 3. Empirical ML Model Benchmark Card (GET /api/ml/metrics) */}
      <Card
        title="Bảng Kiểm định Thực nghiệm Mô hình Học máy (Time-Series Cross-Validation Benchmark)"
        subtitle={
          fcBench
            ? `Đánh giá Out-of-Sample trên ${formatNumber(fcBench.cv_test_samples)} điểm dự báo (1.080 chuỗi Danh mục × Cửa hàng) — Champion: ${fcBench.champion_model}`
            : 'So sánh sai số MAE, RMSE, WAPE, sMAPE và R² giữa các mô hình Học máy với hai thuật toán cơ sở SMA-4 và Super-WMA'
        }
        noPadding
        action={
          fcBench && (
            <Badge variant="healthy" dot>
              +17.06% MAE vs SMA-4
            </Badge>
          )
        }
      >
        {isLoadingMetrics ? (
          <SkeletonTable rows={5} cols={7} />
        ) : fcModels.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Chưa nạp báo cáo kiểm định ML (`/api/ml/metrics`).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Mô hình / Thuật toán</th>
                  <th className="py-2.5 px-4 font-medium text-right">MAE</th>
                  <th className="py-2.5 px-4 font-medium text-right">RMSE</th>
                  <th className="py-2.5 px-4 font-medium text-right">WAPE (%)</th>
                  <th className="py-2.5 px-4 font-medium text-right">sMAPE (%)</th>
                  <th className="py-2.5 px-4 font-medium text-right">R² Score</th>
                  <th className="py-2.5 px-4 font-medium text-right">Cải thiện vs. SMA-4</th>
                  <th className="py-2.5 px-4 font-medium text-right">Cải thiện vs. Super-WMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
                {fcModels.map(([modelKey, m]) => {
                  const isChampion = modelKey === fcBench.champion_model;
                  const deltaSma = Number(m.MAE_vs_SMA4_pct) || 0;
                  const deltaWma = Number(m.MAE_vs_SuperWMA_pct) || 0;
                  return (
                    <tr
                      key={modelKey}
                      className={`transition-colors ${
                        isChampion
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/25 font-medium'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-2.5 px-4 flex items-center gap-2">
                        <span className="text-slate-900 dark:text-slate-100 font-medium">
                          {MODEL_DISPLAY_LABELS[modelKey] || modelKey}
                        </span>
                        {isChampion && <Badge variant="healthy">Champion</Badge>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatNumber(m.MAE, 4)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(m.RMSE, 4)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(m.WAPE_pct, 2)}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatNumber(m.sMAPE_pct, 2)}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700 dark:text-blue-400 font-medium">
                        {formatNumber(m.R2, 4)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        <Badge variant={deltaSma > 0 ? 'healthy' : 'default'}>
                          {deltaSma > 0 ? '+' : ''}
                          {formatNumber(deltaSma, 2)}%
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        <Badge variant={deltaWma > 0 ? 'healthy' : 'default'}>
                          {deltaWma > 0 ? '+' : ''}
                          {formatNumber(deltaWma, 2)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ForecastTab;
