/**
 * Exploratory Data Analysis (EDA) Script for bigdata_inventory
 *
 * Streams retail_sales_ml_apl.csv and retail_inventory_ml_apl.csv,
 * computes descriptive statistics, missing-value audits, distributions,
 * seasonal monthly trends, and full-dataset 30-day inventory classification,
 * and saves the structured output to data/results/eda_summary.json.
 */

const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { classifyInventory } = require('../backend/algorithms');
const { CONSTANTS } = require('../backend/config');
const { roundTo, calcPercentage } = require('../backend/utils');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const RESULTS_PATH = path.join(DATA_DIR, 'results', 'eda_summary.json');

/**
 * Computes descriptive statistics (count, sum, min, p50, p95, max, mean)
 * for a numeric array without mutating the input.
 * @param {number[]} values
 */
function computeNumericStats(values) {
  if (!values || values.length === 0) {
    return { count: 0, sum: 0, min: 0, median: 0, p95: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += sorted[i];
  }
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const p95Idx = Math.min(n - 1, Math.floor(0.95 * (n - 1)));

  return {
    count: n,
    sum: roundTo(sum, 2),
    min: roundTo(sorted[0], 4),
    median: roundTo(median, 4),
    p95: roundTo(sorted[p95Idx], 4),
    max: roundTo(sorted[n - 1], 4),
    mean: roundTo(sum / n, 4)
  };
}

/**
 * Increments a counter map by delta.
 * @param {Map<string, number>} map
 * @param {string} key
 * @param {number} [delta=1]
 */
function incrementMap(map, key, delta = 1) {
  const k = key || '(Trống)';
  map.set(k, (map.get(k) || 0) + delta);
}

/**
 * Streams a CSV file into an array of row objects while counting empty cells per column.
 * @param {string} filePath
 */
function streamCsvWithAudit(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const emptyCounts = new Map();
    let headers = [];

    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('headers', (hdrs) => {
        headers = hdrs;
        for (const h of headers) {
          emptyCounts.set(h, 0);
        }
      })
      .on('data', (row) => {
        for (const h of headers) {
          const val = row[h];
          if (val === undefined || val === null || String(val).trim() === '') {
            emptyCounts.set(h, (emptyCounts.get(h) || 0) + 1);
          }
        }
        rows.push(row);
      })
      .on('end', () => {
        const missingAudit = headers.map((col) => {
          const missing = emptyCounts.get(col) || 0;
          return {
            column: col,
            missingCount: missing,
            missingPct: calcPercentage(missing, rows.length)
          };
        });
        resolve({ rows, headers, missingAudit });
      })
      .on('error', (err) => reject(err));
  });
}

/**
 * Runs EDA aggregations on the sales dataset and returns both summary metrics
 * and the 30-day sales map needed for inventory health evaluation.
 * @param {Array<Object>} salesRows
 * @param {Array<Object>} missingAudit
 */
function analyzeSales(salesRows, missingAudit) {
  let minDate = '9999-12-31';
  let maxDate = '';

  const qtyList = [];
  const amtList = [];
  const cogsList = [];
  const txCountList = [];

  let returnRows = 0;
  let negativeQtyRows = 0;
  let negativeAmtRows = 0;

  const salesTypeMap = new Map();
  const returnReasonMap = new Map();
  const divisionMap = new Map();
  const categoryQtyMap = new Map();
  const categoryAmtMap = new Map();
  const channelAmtMap = new Map();
  const monthMap = new Map();
  const storeAmtMap = new Map();
  const prodSet = new Set();

  for (let i = 0; i < salesRows.length; i++) {
    const r = salesRows[i];
    const date = r['Transaction Date'];
    if (date) {
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    }

    const qty = Number(r['Qty Sold']) || 0;
    const amt = Number(r['Sales Amount']) || 0;
    const cogs = Number(r['Cogs']) || 0;
    const tx = Number(r['Number of Transactions']) || 0;
    const isRet = Number(r['Is Return']) === 1;

    qtyList.push(qty);
    amtList.push(amt);
    cogsList.push(cogs);
    txCountList.push(tx);

    if (qty < 0) negativeQtyRows++;
    if (amt < 0) negativeAmtRows++;
    if (r['Product No']) prodSet.add(r['Product No']);

    incrementMap(salesTypeMap, r['Sales Type'], 1);

    const div = r['Product Division'] || 'N/A';
    if (!divisionMap.has(div)) {
      divisionMap.set(div, { total: 0, returns: 0, revenue: 0, qty: 0 });
    }
    const divStat = divisionMap.get(div);
    divStat.total += 1;
    divStat.revenue += amt;
    divStat.qty += qty;

    if (isRet) {
      returnRows++;
      divStat.returns += 1;
      incrementMap(returnReasonMap, r['Reason of Return'], 1);
    }

    const cat = r['Product Category'] || 'N/A';
    incrementMap(categoryQtyMap, cat, qty);
    incrementMap(categoryAmtMap, cat, amt);

    const ch = r['Sales Channel'] || 'N/A';
    incrementMap(channelAmtMap, ch, amt);

    const st = r['Store'] || 'N/A';
    incrementMap(storeAmtMap, st, amt);

    if (date) {
      const m = date.slice(0, 7);
      if (!monthMap.has(m)) {
        monthMap.set(m, { transactions: 0, returns: 0, qty: 0, revenue: 0, cogs: 0 });
      }
      const ms = monthMap.get(m);
      ms.transactions += 1;
      if (isRet) ms.returns += 1;
      ms.qty += qty;
      ms.revenue += amt;
      ms.cogs += cogs;
    }
  }

  // 30-day lookback window matching DataLoaderService
  const cutoffDate = new Date(maxDate);
  cutoffDate.setDate(cutoffDate.getDate() - CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const prodSales30dMap = new Map();
  let rowsIn30d = 0;
  for (let i = 0; i < salesRows.length; i++) {
    const r = salesRows[i];
    const d = r['Transaction Date'];
    if (d && d >= cutoffStr) {
      rowsIn30d++;
      const prodNo = r['Product No'];
      const qty = Number(r['Qty Sold']) || 0;
      prodSales30dMap.set(prodNo, (prodSales30dMap.get(prodNo) || 0) + qty);
    }
  }

  const monthlyTrend = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, m]) => ({
      month,
      transactions: m.transactions,
      returns: m.returns,
      returnRatePct: calcPercentage(m.returns, m.transactions),
      qtySold: roundTo(m.qty, 2),
      revenue: roundTo(m.revenue, 2),
      cogs: roundTo(m.cogs, 2),
      grossMarginPct: calcPercentage(m.revenue - m.cogs, m.revenue)
    }));

  const top10Categories = Array.from(categoryQtyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, qty]) => ({
      category,
      qtySold: roundTo(qty, 2),
      revenue: roundTo(categoryAmtMap.get(category) || 0, 2)
    }));

  const divisionBreakdown = Array.from(divisionMap.entries()).map(([division, d]) => ({
    division,
    transactions: d.total,
    returnCount: d.returns,
    returnRatePct: calcPercentage(d.returns, d.total),
    qtySold: roundTo(d.qty, 2),
    revenue: roundTo(d.revenue, 2)
  }));

  const returnReasons = Array.from(returnReasonMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({
      reason,
      count,
      shareOfReturnsPct: calcPercentage(count, returnRows)
    }));

  const salesTypes = Array.from(salesTypeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([salesType, count]) => ({
      salesType,
      count,
      pct: calcPercentage(count, salesRows.length)
    }));

  const storeRevenueStats = computeNumericStats(Array.from(storeAmtMap.values()));
  const storeSorted = Array.from(storeAmtMap.entries()).sort((a, b) => b[1] - a[1]);

  return {
    summary: {
      rowCount: salesRows.length,
      columnCount: missingAudit.length,
      dateRange: { minDate, maxDate, lookbackCutoff: cutoffStr, rowsInLookback30d: rowsIn30d },
      distinctProducts: prodSet.size,
      distinctCategories: categoryQtyMap.size,
      distinctStores: storeAmtMap.size,
      distinctChannels: Array.from(channelAmtMap.keys()),
      returnSummary: {
        returnRows,
        returnRatePct: calcPercentage(returnRows, salesRows.length),
        negativeQtyRows,
        negativeAmtRows
      },
      numericStats: {
        qtySold: computeNumericStats(qtyList),
        salesAmount: computeNumericStats(amtList),
        cogs: computeNumericStats(cogsList),
        numberOfTransactions: computeNumericStats(txCountList)
      },
      missingAudit,
      salesTypes,
      divisionBreakdown,
      returnReasons,
      top10Categories,
      monthlyTrend,
      storeDispersion: {
        stats: storeRevenueStats,
        topStore: { store: storeSorted[0][0], revenue: roundTo(storeSorted[0][1], 2) },
        bottomStore: {
          store: storeSorted[storeSorted.length - 1][0],
          revenue: roundTo(storeSorted[storeSorted.length - 1][1], 2)
        }
      }
    },
    prodSales30dMap
  };
}

/**
 * Runs EDA aggregations on the inventory dataset and evaluates the full-population
 * 30-day stock health classification using backend/algorithms/classify.js.
 * @param {Array<Object>} invRows
 * @param {Array<Object>} missingAudit
 * @param {Map<string, number>} prodSales30dMap
 */
function analyzeInventory(invRows, missingAudit, prodSales30dMap) {
  let minStartDate = '9999-12-31';
  let maxStartDate = '';
  let sentinelEndDateRows = 0;

  const qtyOnHandList = [];
  const sellPriceList = [];
  const costPriceList = [];
  const sellingAmtList = [];
  const costAmtList = [];

  const stockStatusMap = new Map();
  const storeSet = new Set();
  const prodSet = new Set();
  const catSet = new Set();
  const healthCounts = { healthy: 0, low: 0, over: 0, zeroSalesFallback: 0 };

  for (let i = 0; i < invRows.length; i++) {
    const r = invRows[i];
    const startD = r['Start Date'];
    const endD = r['End Date'];

    if (startD) {
      if (startD < minStartDate) minStartDate = startD;
      if (startD > maxStartDate) maxStartDate = startD;
    }
    if (endD === '9999-12-31') {
      sentinelEndDateRows++;
    }

    const qty = Number(r['Qty on hand']) || 0;
    const sellAmt = Number(r['Stocks Selling Amount']) || 0;
    const costAmt = Number(r['Cost of Stocks']) || 0;
    const unitSell = Number(r['Stock Unit Selling Price']) || 0;
    const unitCost = Number(r['Stock Unit Cost Price']) || 0;

    qtyOnHandList.push(qty);
    sellingAmtList.push(sellAmt);
    costAmtList.push(costAmt);
    sellPriceList.push(unitSell);
    costPriceList.push(unitCost);

    incrementMap(stockStatusMap, r['Stock Status'], 1);
    if (r['Store']) storeSet.add(r['Store']);
    if (r['Product No']) prodSet.add(r['Product No']);
    if (r['Product Category']) catSet.add(r['Product Category']);

    const sales30d = prodSales30dMap.get(r['Product No']) || 0;
    const avgDailySales = sales30d / CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS;
    if (avgDailySales <= 0) {
      healthCounts.zeroSalesFallback++;
    }
    const status = classifyInventory(qty, avgDailySales);
    healthCounts[status]++;
  }

  const stockStatuses = Array.from(stockStatusMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({
      status,
      count,
      pct: calcPercentage(count, invRows.length)
    }));

  return {
    rowCount: invRows.length,
    columnCount: missingAudit.length,
    dateRange: {
      minStartDate,
      maxStartDate,
      sentinelEndDateRows,
      sentinelEndDatePct: calcPercentage(sentinelEndDateRows, invRows.length)
    },
    distinctProducts: prodSet.size,
    distinctCategories: catSet.size,
    distinctStores: storeSet.size,
    numericStats: {
      qtyOnHand: computeNumericStats(qtyOnHandList),
      stocksSellingAmount: computeNumericStats(sellingAmtList),
      costOfStocks: computeNumericStats(costAmtList),
      stockUnitSellingPrice: computeNumericStats(sellPriceList),
      stockUnitCostPrice: computeNumericStats(costPriceList)
    },
    missingAudit,
    stockStatuses,
    fullClassificationDistribution: {
      healthy: healthCounts.healthy,
      healthyPct: calcPercentage(healthCounts.healthy, invRows.length),
      low: healthCounts.low,
      lowPct: calcPercentage(healthCounts.low, invRows.length),
      over: healthCounts.over,
      overPct: calcPercentage(healthCounts.over, invRows.length),
      zeroSalesFallbackRows: healthCounts.zeroSalesFallback,
      zeroSalesFallbackPct: calcPercentage(healthCounts.zeroSalesFallback, invRows.length)
    }
  };
}

async function main() {
  const startMs = Date.now();
  const salesPath = path.join(DATA_DIR, 'retail_sales_ml_apl.csv');
  const invPath = path.join(DATA_DIR, 'retail_inventory_ml_apl.csv');

  console.log('[EDA] Streaming retail_sales_ml_apl.csv...');
  const salesData = await streamCsvWithAudit(salesPath);
  console.log(`[EDA] Loaded ${salesData.rows.length} sales rows.`);

  console.log('[EDA] Streaming retail_inventory_ml_apl.csv...');
  const invData = await streamCsvWithAudit(invPath);
  console.log(`[EDA] Loaded ${invData.rows.length} inventory rows.`);

  const salesAnalysis = analyzeSales(salesData.rows, salesData.missingAudit);
  const inventoryAnalysis = analyzeInventory(
    invData.rows,
    invData.missingAudit,
    salesAnalysis.prodSales30dMap
  );

  const report = {
    generatedAt: new Date().toISOString(),
    executionTimeMs: Date.now() - startMs,
    sales: salesAnalysis.summary,
    inventory: inventoryAnalysis
  };

  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[EDA] Summary written to ${RESULTS_PATH} in ${report.executionTimeMs}ms.`);
}

main().catch((err) => {
  console.error('[EDA] Failed:', err);
  process.exit(1);
});
