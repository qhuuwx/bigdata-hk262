/**
 * Tab 3: Real-Time Smart Inventory Intelligence Page
 * Cumulative Apache ECharts Doughnut chart updated every 2s via SSE + 3 institutional KPI cards
 * with live-ticking tabular counters + Interactive ML Probabilistic Stock-Risk Simulator
 * + Top 10 prioritized stock alerts table.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import DoughnutChart from '../components/charts/DoughnutChart';
import InventoryAlertsTable from '../components/tables/InventoryAlertsTable';
import useInventoryStream from '../hooks/useInventoryStream';
import mlService from '../services/mlService';
import { formatNumber, formatPercentage } from '../utils/formatters';
import { CHART_COLORS } from '../utils/chartTheme';

/**
 * Smoothly interpolates numeric transitions over 320ms using requestAnimationFrame.
 */
function useAnimatedCounter(targetValue, durationMs = 320) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const prevValueRef = useRef(targetValue);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = Number(targetValue) || 0;
    if (startVal === endVal) return;

    let rafId = null;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic-out
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevValueRef.current = endVal;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      prevValueRef.current = endVal;
    };
  }, [targetValue, durationMs]);

  return displayValue;
}

const SIMULATOR_PRESETS = [
  {
    id: 'low-risk',
    label: 'Đứt hàng khẩn cấp (Low Stock)',
    qtyOnHand: 6,
    avgDailySales: 1.5,
    category: 'Scholar Footwear Trailblazer',
    store: 'STR-1006'
  },
  {
    id: 'healthy-opt',
    label: 'Tồn kho cân bằng (Healthy)',
    qtyOnHand: 36,
    avgDailySales: 1.2,
    category: 'Femme Footwear Boot Collection',
    store: 'STR-1082'
  },
  {
    id: 'overstock-excess',
    label: 'Ứ đọng vốn (Overstock)',
    qtyOnHand: 95,
    avgDailySales: 1.1,
    category: 'Junior Apparel Cozy Pullovers',
    store: 'STR-1163'
  },
  {
    id: 'dead-stock',
    label: 'Hàng tồn chết (0 cầu 30d)',
    qtyOnHand: 24,
    avgDailySales: 0,
    category: 'Scholar Footwear Canvas Styles',
    store: 'STR-1344'
  }
];

export const InventoryTab = () => {
  const { cumulativeState, alerts, isLoadingAlerts, transportMode, resetCumulative } = useInventoryStream(true);

  const { healthy, low, over, total } = cumulativeState;

  const animHealthy = useAnimatedCounter(healthy);
  const animLow = useAnimatedCounter(low);
  const animOver = useAnimatedCounter(over);
  const animTotal = useAnimatedCounter(total);

  // ML Probabilistic Risk Simulator state
  const [simInputs, setSimInputs] = useState({
    qtyOnHand: 6,
    avgDailySales: 1.5,
    category: 'Scholar Footwear Trailblazer',
    store: 'STR-1006'
  });
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [clfBench, setClfBench] = useState(null);
  const simAbortRef = useRef(null);

  const evaluateRisk = useCallback(async (params) => {
    if (simAbortRef.current) {
      simAbortRef.current.abort();
    }
    const controller = new AbortController();
    simAbortRef.current = controller;
    setIsSimulating(true);
    try {
      const res = await mlService.classifyInventory(
        {
          qtyOnHand: Number(params.qtyOnHand) || 0,
          avgDailySales: Number(params.avgDailySales) || 0,
          category: params.category,
          store: params.store
        },
        { signal: controller.signal }
      );
      setSimResult(res);
    } catch (err) {
      // Ignore abort errors
    } finally {
      setIsSimulating(false);
    }
  }, []);

  useEffect(() => {
    evaluateRisk(simInputs);
    return () => {
      if (simAbortRef.current) simAbortRef.current.abort();
    };
  }, [evaluateRisk, simInputs]);

  useEffect(() => {
    let mounted = true;
    mlService
      .getMetrics()
      .then((rep) => {
        if (mounted && rep?.inventory_risk_classification) {
          setClfBench(rep.inventory_risk_classification);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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
        ]
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
      count: animHealthy,
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
      count: animLow,
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
      count: animOver,
      pct: overPct,
      desc: 'Lượng tồn vượt 60 ngày tiêu thụ; gây ứ đọng vốn lưu động, cần điều chuyển hoặc giảm giá.'
    }
  ];

  const champMetrics =
    clfBench?.models && clfBench.champion_model
      ? clfBench.models[clfBench.champion_model]
      : null;

  const predClass = simResult?.predictedClass || 'healthy';
  const predVariant = predClass === 'low' ? 'low' : predClass === 'over' ? 'over' : 'healthy';
  const predLabel =
    predClass === 'low'
      ? 'Low Stock (Khẩn cấp)'
      : predClass === 'over'
        ? 'Overstock (Chú ý)'
        : 'Healthy Stock (An toàn)';

  const probHealthy = (Number(simResult?.probabilities?.healthy) || 0) * 100;
  const probLow = (Number(simResult?.probabilities?.low) || 0) * 100;
  const probOver = (Number(simResult?.probabilities?.over) || 0) * 100;

  return (
    <div className="space-y-5 animate-tab-panel">
      {/* 1. Cumulative Stream & KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Doughnut Chart */}
        <Card
          title="Cơ cấu Tồn kho Tích lũy"
          subtitle="Lô 50 bản ghi / 2s qua luồng SSE trên RAM"
          className="lg:col-span-4"
          action={
            <button
              onClick={resetCumulative}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-medium transition-colors"
              title="Đặt lại bộ đếm tích lũy trên máy chủ"
            >
              Đặt lại
            </button>
          }
        >
          <div className="flex-1 flex flex-col justify-center items-center">
            <DoughnutChart
              data={doughnutData}
              height={230}
              cutout="66%"
              centerLabel={formatNumber(animTotal)}
              centerSubLabel="SKUs Scanned"
            />
          </div>
        </Card>

        {/* 3 Institutional KPI Cards + Telemetry Footer */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
            {kpiCards.map((item) => (
              <div
                key={item.key}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-[3px] ${item.borderAccent} rounded-lg p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between transition-colors`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                      {item.label}
                    </span>
                    <Badge variant={item.variant}>{item.badge}</Badge>
                  </div>

                  <div className="mt-4 mb-3">
                    <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatNumber(item.count)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                      <span>Tỷ trọng tích lũy</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatPercentage(item.pct)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full ${item.barColor} transition-all duration-300`}
                        style={{ width: `${Math.min(100, item.pct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2.5">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Cumulative Telemetry Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Tổng bản ghi tồn kho đã phân loại trong phiên máy chủ ({transportMode.toUpperCase()} Persistent RAM State)
              </span>
            </div>
            <div className="text-xs font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
              {formatNumber(animTotal)} bản ghi
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive ML Probabilistic Stock-Risk Simulator (POST /api/ml/classify-inventory) */}
      <Card
        title="Bộ Mô phỏng Phân loại Rủi ro Tồn kho Xác suất (ML Stock-Risk & Dead-Stock Inspector)"
        subtitle="Chấm điểm xác suất 3 lớp (Healthy / Low Stock / Overstock) và phát hiện hàng tồn chết qua mô hình SMOTENC_HistGBDT_Tuned"
        action={
          champMetrics && (
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono">
              <Badge variant="healthy">
                Macro PR-AUC: {formatNumber(champMetrics.Macro_PR_AUC * 100, 2)}%
              </Badge>
              <Badge variant="blue">
                Low Stock Recall: {formatNumber(champMetrics.Recall_LowStock * 100, 2)}%
              </Badge>
              <Badge variant="low">
                Macro-F1: {formatNumber(champMetrics.Macro_F1 * 100, 2)}%
              </Badge>
            </div>
          )
        }
      >
        <div className="space-y-4">
          {/* Quick Scenario Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-slate-400">Kịch bản mẫu:</span>
            {SIMULATOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSimInputs({ ...preset })}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Simulator Inputs */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tồn kho hiện hữu (Qty on Hand)
                </label>
                <input
                  type="number"
                  step="1"
                  value={simInputs.qtyOnHand}
                  onChange={(e) =>
                    setSimInputs((prev) => ({ ...prev, qtyOnHand: e.target.value }))
                  }
                  className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tốc độ bán/ngày (Avg Daily Sales)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={simInputs.avgDailySales}
                  onChange={(e) =>
                    setSimInputs((prev) => ({ ...prev, avgDailySales: e.target.value }))
                  }
                  className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Danh mục (Category)
                </label>
                <input
                  type="text"
                  value={simInputs.category}
                  onChange={(e) =>
                    setSimInputs((prev) => ({ ...prev, category: e.target.value }))
                  }
                  className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Mã cửa hàng (Store ID)
                </label>
                <input
                  type="text"
                  value={simInputs.store}
                  onChange={(e) =>
                    setSimInputs((prev) => ({ ...prev, store: e.target.value }))
                  }
                  className="w-full h-9 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Calibrated Probability Bars & Verdict Output */}
            <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Phân lớp ML:
                  </span>
                  <Badge variant={predVariant} dot>
                    {predLabel}
                  </Badge>
                  {simResult?.isDeadStockCandidate && (
                    <Badge variant="urgent" dot>
                      Dead-Stock Candidate (0 cầu 30d)
                    </Badge>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {simResult?.coverDays !== undefined
                    ? `Độ bao phủ: ${formatNumber(simResult.coverDays, 1)} ngày`
                    : 'Độ bao phủ: ∞ (0 cầu)'}
                  {isSimulating && ' · Đang tính...'}
                </div>
              </div>

              {/* 3 Calibrated Probability Bars */}
              <div className="space-y-2 pt-1">
                {[
                  { label: 'Healthy Stock (14d ≤ Cover < 60d)', pct: probHealthy, color: 'bg-emerald-600' },
                  { label: 'Low Stock Risk (Cover < 14d)', pct: probLow, color: 'bg-amber-500' },
                  { label: 'Overstock Excess (Cover ≥ 60d)', pct: probOver, color: 'bg-rose-600' }
                ].map((bar) => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-600 dark:text-slate-300">{bar.label}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatPercentage(bar.pct)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} transition-all duration-300`}
                        style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Top 10 Alerts Table Section */}
      <Card
        title="Danh sách Top 10 Cảnh báo Tồn kho Ưu tiên"
        subtitle="Khử trùng theo cặp (Danh mục, Cửa hàng); ưu tiên trích xuất Low Stock (Cover < 14d) trước Overstock (Cover ≥ 60d)"
        noPadding
        action={
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
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
