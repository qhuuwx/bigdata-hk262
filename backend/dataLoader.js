const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Module-level in-memory storage for raw records
let salesData = [];
let inventoryData = [];

// Module-level in-memory indexes and caches
let prodSales30dMap = new Map();
let distinctCategories = [];
let distinctStores = [];
let monthlyCategoryStoreSales = new Map();
let edaCache = {
  revenueTrend: [],
  topCategories: [],
  channelSplit: [],
  returnRate: []
};
let inventoryAlertsCache = [];

/**
 * Robust RFC 4180 CSV line parser supporting quoted fields and unquoted values
 * @param {string} line - Single CSV line
 * @returns {string[]} Array of cell values with surrounding quotes stripped
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Stream-parse CSV file into memory using csv-parser (if installed) or native readline
 * @param {string} filePath - Absolute path to CSV file
 * @returns {Promise<Array<Object>>}
 */
function streamParseCSV(filePath) {
  return new Promise((resolve, reject) => {
    let csvParser = null;
    try {
      csvParser = require('csv-parser');
    } catch (e) {
      csvParser = null;
    }

    if (csvParser) {
      const records = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => records.push(row))
        .on('end', () => resolve(records))
        .on('error', (err) => reject(err));
    } else {
      const records = [];
      let headers = null;

      const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (!line || line.trim() === '') return;
        const parsed = parseCSVLine(line);
        if (!headers) {
          headers = parsed.map(h => h.trim());
        } else {
          const row = {};
          for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = parsed[i] !== undefined ? parsed[i] : '';
          }
          records.push(row);
        }
      });

      rl.on('close', () => resolve(records));
      rl.on('error', (err) => reject(err));
    }
  });
}

/**
 * Classifies an inventory item based on avgDailySales (past 30 days)
 *
 * Rules:
 * - avgDailySales = total Qty Sold in last 30 days / 30
 * - avgDailySales <= 0 -> 'healthy'
 * - Qty on hand >= avgDailySales * 60 -> 'over'
 * - Qty on hand >= avgDailySales * 14 -> 'healthy'
 * - Else (Qty on hand < avgDailySales * 14, including <= 0) -> 'low'
 *
 * @param {Object} item - Inventory row object
 * @returns {'healthy' | 'low' | 'over'}
 */
function classifyInventoryItem(item) {
  if (!item) return 'healthy';

  // Support explicit avgDailySales (for direct unit testing) or calculate from in-memory index
  let avgDailySales;
  if (item.avgDailySales !== undefined) {
    avgDailySales = Number(item.avgDailySales);
  } else {
    const productNo = item['Product No'];
    const sales30d = prodSales30dMap.get(productNo) || 0;
    avgDailySales = sales30d / 30;
  }

  if (avgDailySales <= 0) {
    return 'healthy';
  }

  // Support both camelCase qtyOnHand and CSV header 'Qty on hand'
  const rawQty = item.qtyOnHand !== undefined ? item.qtyOnHand : item['Qty on hand'];
  const qtyOnHand = Number(rawQty !== undefined ? rawQty : 0);

  if (qtyOnHand >= avgDailySales * 60) {
    return 'over';
  } else if (qtyOnHand >= avgDailySales * 14) {
    return 'healthy';
  } else {
    return 'low';
  }
}

/**
 * Initializes data loader by streaming both CSV files and computing in-memory caches
 * @param {string} [dataPath] - Custom directory where CSV files are located
 */
async function initDataLoader(dataPath) {
  const baseDir = dataPath
    ? (path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath))
    : path.resolve(__dirname, '../data');

  const salesFile = path.join(baseDir, 'retail_sales_ml_apl.csv');
  const inventoryFile = path.join(baseDir, 'retail_inventory_ml_apl.csv');

  if (!fs.existsSync(salesFile)) {
    throw new Error(`Sales CSV file not found: ${salesFile}`);
  }
  if (!fs.existsSync(inventoryFile)) {
    throw new Error(`Inventory CSV file not found: ${inventoryFile}`);
  }

  // 1. Stream parse both datasets
  salesData = await streamParseCSV(salesFile);
  inventoryData = await streamParseCSV(inventoryFile);

  // 2. Identify chronological months and max date in sales
  let maxDate = '2026-04-24';
  const monthSet = new Set();
  const catSet = new Set();
  const storeSet = new Set();
  const revenueByMonth = new Map();
  const qtyByCategory = new Map();
  const salesByChannel = new Map();
  const divisionStats = new Map(); // division -> { total: number, returns: number }
  const catStoreMonthMap = new Map(); // `${category}:::${store}` -> Map<month, number>

  // Reset 30-day sales map
  prodSales30dMap = new Map();

  for (let i = 0; i < salesData.length; i++) {
    const row = salesData[i];
    const date = row['Transaction Date'];
    if (date && date > maxDate) {
      maxDate = date;
    }
  }

  // Calculate 30-day window: [2026-03-26, 2026-04-24]
  const minDate30d = '2026-03-26';

  for (let i = 0; i < salesData.length; i++) {
    const row = salesData[i];
    const date = row['Transaction Date'] || '';
    const month = date.substring(0, 7);
    const category = row['Product Category'];
    const store = row['Store'];
    const channel = row['Sales Channel'] || 'Channel Alpha';
    const division = row['Product Division'] || '';
    const productNo = row['Product No'];
    const qtySold = Number(row['Qty Sold']) || 0;
    const salesAmt = Number(row['Sales Amount']) || 0;
    const isReturn = Number(row['Is Return']) === 1 || row['Is Return'] === '1';

    if (month) monthSet.add(month);
    if (category) catSet.add(category);
    if (store) storeSet.add(store);

    // 30-day product sales
    if (date >= minDate30d && date <= maxDate && productNo) {
      prodSales30dMap.set(productNo, (prodSales30dMap.get(productNo) || 0) + qtySold);
    }

    // Monthly revenue trend
    if (month) {
      revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + salesAmt);
    }

    // Category Qty Sold
    if (category) {
      qtyByCategory.set(category, (qtyByCategory.get(category) || 0) + qtySold);
    }

    // Channel Sales
    if (channel) {
      salesByChannel.set(channel, (salesByChannel.get(channel) || 0) + salesAmt);
    }

    // Division Return Rate
    if (division) {
      let stats = divisionStats.get(division);
      if (!stats) {
        stats = { total: 0, returns: 0 };
        divisionStats.set(division, stats);
      }
      stats.total += 1;
      if (isReturn) {
        stats.returns += 1;
      }
    }

    // Monthly Category-Store Sales
    if (category && store && month) {
      const key = `${category}:::${store}`;
      let mGroup = catStoreMonthMap.get(key);
      if (!mGroup) {
        mGroup = new Map();
        catStoreMonthMap.set(key, mGroup);
      }
      mGroup.set(month, (mGroup.get(month) || 0) + qtySold);
    }
  }

  // Distinct sorted lists
  distinctCategories = Array.from(catSet).sort();
  distinctStores = Array.from(storeSet).sort();

  // Chronological list of months
  const allMonths = Array.from(monthSet).sort();

  // 3. Precompute monthlyCategoryStoreSales
  monthlyCategoryStoreSales = new Map();
  for (const [key, mGroup] of catStoreMonthMap.entries()) {
    const history = allMonths.map(m => mGroup.get(m) || 0);
    const sum = history.reduce((acc, v) => acc + v, 0);
    const overallAvg = history.length > 0 ? sum / history.length : 0;

    // Monthly averages indexed by month-of-year (0-11)
    const monthlyAvg = new Array(12).fill(0);
    const monthCounts = new Array(12).fill(0);

    for (const m of allMonths) {
      const parts = m.split('-');
      const monthIdx = parseInt(parts[1], 10) - 1;
      const val = mGroup.get(m) || 0;
      monthlyAvg[monthIdx] += val;
      monthCounts[monthIdx] += 1;
    }

    for (let m = 0; m < 12; m++) {
      if (monthCounts[m] > 0) {
        monthlyAvg[m] = monthlyAvg[m] / monthCounts[m];
      } else {
        monthlyAvg[m] = overallAvg;
      }
    }

    monthlyCategoryStoreSales.set(key, { history, monthlyAvg, overallAvg });
  }

  // 4. Precompute EDA cache
  // 4.1 Revenue Trend
  edaCache.revenueTrend = allMonths.map(m => ({
    month: m,
    revenue: Math.round((revenueByMonth.get(m) || 0) * 100) / 100
  }));

  // 4.2 Top 10 Categories
  const sortedCategories = Array.from(qtyByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  edaCache.topCategories = sortedCategories.map(([category, qty]) => ({
    category,
    qty: Math.round(qty * 100) / 100
  }));

  // 4.3 Channel Split
  let totalSales = 0;
  for (const sales of salesByChannel.values()) {
    totalSales += sales;
  }
  edaCache.channelSplit = Array.from(salesByChannel.entries()).map(([channel, sales]) => ({
    channel,
    sales: Math.round(sales * 100) / 100,
    percentage: totalSales > 0 ? Math.round((sales / totalSales) * 10000) / 100 : 0
  }));

  // 4.4 Return Rate by Division
  edaCache.returnRate = Array.from(divisionStats.entries()).map(([division, stats]) => ({
    division,
    returnRate: stats.total > 0 ? Math.round((stats.returns / stats.total) * 10000) / 100 : 0
  })).sort((a, b) => a.division.localeCompare(b.division));

  // 5. Precompute Inventory Alerts (Top 10: Low Stock first, then Overstock)
  const lowAlerts = [];
  const overAlerts = [];

  for (let i = 0; i < inventoryData.length; i++) {
    const item = inventoryData[i];
    const status = classifyInventoryItem(item);
    if (status === 'low') {
      lowAlerts.push({
        category: item['Product Category'],
        store: item['Store'],
        qtyOnHand: Number(item['Qty on hand']),
        stockStatus: 'Low Stock',
        level: '🔴 Khẩn cấp'
      });
    } else if (status === 'over') {
      overAlerts.push({
        category: item['Product Category'],
        store: item['Store'],
        qtyOnHand: Number(item['Qty on hand']),
        stockStatus: 'Overstock',
        level: '🟡 Chú ý'
      });
    }
  }

  inventoryAlertsCache = [
    ...lowAlerts.slice(0, 10),
    ...overAlerts.slice(0, Math.max(0, 10 - lowAlerts.length))
  ].slice(0, 10);

  return {
    salesCount: salesData.length,
    inventoryCount: inventoryData.length,
    categoriesCount: distinctCategories.length,
    storesCount: distinctStores.length
  };
}

function getSalesData() {
  return salesData;
}

function getInventoryData() {
  return inventoryData;
}

function getDistinctCategories() {
  return distinctCategories;
}

function getDistinctStores() {
  return distinctStores;
}

function getProductSales30d(productNo) {
  return prodSales30dMap.get(productNo) || 0;
}

function getMonthlySalesHistory(category, store) {
  const key = `${category}:::${store}`;
  if (monthlyCategoryStoreSales.has(key)) {
    return monthlyCategoryStoreSales.get(key);
  }
  // Default fallback if pair has no sales
  return {
    history: new Array(11).fill(0),
    monthlyAvg: new Array(12).fill(0),
    overallAvg: 0
  };
}

function getEdaRevenueTrend() {
  return edaCache.revenueTrend;
}

function getEdaTopCategories() {
  return edaCache.topCategories;
}

function getEdaChannelSplit() {
  return edaCache.channelSplit;
}

function getEdaReturnRate() {
  return edaCache.returnRate;
}

function getInventoryAlerts() {
  return inventoryAlertsCache;
}

module.exports = {
  initDataLoader,
  getSalesData,
  getInventoryData,
  getDistinctCategories,
  getDistinctStores,
  getProductSales30d,
  getMonthlySalesHistory,
  getEdaRevenueTrend,
  getEdaTopCategories,
  getEdaChannelSplit,
  getEdaReturnRate,
  getInventoryAlerts,
  classifyInventoryItem
};
