/**
 * Data Loader Service
 * Handles streaming CSV ingestion, in-memory caching, indexing, and EDA pre-computations.
 * Self-manages all private caches.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseCSVLine } = require('../utils');
const { CONSTANTS } = require('../config');
const { classifyInventory } = require('../algorithms');

class DataLoaderService {
  constructor() {
    this._isReady = false;
    this._rawSales = [];
    this._rawInventory = [];
    this._allMonths = [];

    // Internal In-Memory Indexes & Caches
    this._prodSales30dMap = new Map();
    this._distinctCategories = [];
    this._distinctStores = [];
    this._monthlyCategoryStoreSales = new Map();
    this._monthlyHistoryCache = new Map();
    this._edaCache = {
      revenueTrend: [],
      topCategories: [],
      channelSplit: [],
      returnRate: []
    };
    this._inventoryAlertsCache = [];
  }

  isReady() {
    return this._isReady;
  }

  getRawSales() {
    return this._rawSales;
  }

  getRawInventory() {
    return this._rawInventory;
  }

  getProdSales30d(productNo) {
    return this._prodSales30dMap.get(productNo) || 0;
  }

  getDistinctCategories() {
    return [...this._distinctCategories];
  }

  getDistinctStores() {
    return [...this._distinctStores];
  }

  getEdaCache() {
    return this._edaCache;
  }

  getInventoryAlertsCache() {
    return this._inventoryAlertsCache;
  }

  /**
   * Retrieves historical monthly sales series, monthly average, and overall average for a (category, store) pair.
   * Always returns a complete chronological series spanning all months in the dataset.
   * @param {string} category
   * @param {string} store
   * @returns {{ history: number[], monthlyAvg: number[], overallAvg: number }}
   */
  getMonthlySalesHistory(category, store) {
    const key = `${category}:::${store}`;
    const cached = this._monthlyHistoryCache.get(key);

    if (cached) {
      return {
        history: [...cached.history],
        monthlyAvg: [...cached.monthlyAvg],
        overallAvg: cached.overallAvg
      };
    }

    const monthCount = this._allMonths.length > 0 ? this._allMonths.length : 11;
    return {
      history: new Array(monthCount).fill(0),
      monthlyAvg: new Array(12).fill(0),
      overallAvg: 0
    };
  }

  /**
   * Parses CSV file using csv-parser or native readline fallback.
   * @private
   */
  _streamParseCSV(filePath) {
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
          .on('error', (err) => reject(err))
          .pipe(csvParser())
          .on('data', (row) => records.push(row))
          .on('end', () => resolve(records))
          .on('error', (err) => reject(err));
      } else {
        const records = [];
        let headers = null;
        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => reject(err));

        const rl = readline.createInterface({
          input: stream,
          crlfDelay: Infinity
        });

        rl.on('line', (line) => {
          if (!line || !line.trim()) return;
          const cells = parseCSVLine(line);
          if (!headers) {
            headers = cells.map(h => h.trim());
          } else {
            const obj = {};
            for (let i = 0; i < headers.length; i++) {
              obj[headers[i]] = cells[i] !== undefined ? cells[i] : '';
            }
            records.push(obj);
          }
        });

        rl.on('close', () => resolve(records));
        rl.on('error', (err) => reject(err));
      }
    });
  }

  /**
   * Initializes datasets from CSV files and builds in-memory indexes in two linear passes.
   * @param {string} [dataDir]
   * @returns {Promise<{ salesCount: number, inventoryCount: number, categoriesCount: number, storesCount: number }>}
   */
  async init(dataDir) {
    const baseDir = dataDir
      ? (path.isAbsolute(dataDir) ? dataDir : path.resolve(process.cwd(), dataDir))
      : path.resolve(__dirname, '../../data');

    const salesPath = path.join(baseDir, 'retail_sales_ml_apl.csv');
    const inventoryPath = path.join(baseDir, 'retail_inventory_ml_apl.csv');

    if (!fs.existsSync(salesPath)) {
      throw new Error(`Sales CSV file not found: ${salesPath}`);
    }
    if (!fs.existsSync(inventoryPath)) {
      throw new Error(`Inventory CSV file not found: ${inventoryPath}`);
    }

    this._isReady = false;

    console.log(`[DataLoaderService] Loading sales dataset from ${salesPath}...`);
    this._rawSales = await this._streamParseCSV(salesPath);
    console.log(`[DataLoaderService] Sales loaded: ${this._rawSales.length} records`);

    console.log(`[DataLoaderService] Loading inventory dataset from ${inventoryPath}...`);
    this._rawInventory = await this._streamParseCSV(inventoryPath);
    console.log(`[DataLoaderService] Inventory loaded: ${this._rawInventory.length} records`);

    // Pass 1 over sales: find maxDateStr, distinct sets, monthly category-store matrix, and EDA aggregations
    let maxDateStr = '';
    const monthSet = new Set();
    const catSet = new Set();
    const storeSet = new Set();
    const catStoreMap = new Map();
    const monthRevMap = new Map();
    const catQtyMap = new Map();
    const chanMap = new Map();
    let totalChannelSales = 0;
    const divTotalMap = new Map();
    const divReturnMap = new Map();

    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const date = row['Transaction Date'];
      const cat = row['Product Category'];
      const st = row['Store'];
      const ch = row['Sales Channel'];
      const div = row['Product Division'];
      const qty = Number(row['Qty Sold']) || 0;
      const amt = Number(row['Sales Amount']) || 0;
      const isRet = Number(row['Is Return']) === 1 || row['Is Return'] === '1';

      if (date) {
        if (date > maxDateStr) {
          maxDateStr = date;
        }
        const monthKey = date.slice(0, 7);
        if (monthKey) {
          monthSet.add(monthKey);
          monthRevMap.set(monthKey, (monthRevMap.get(monthKey) || 0) + amt);
        }
        if (cat && st && monthKey) {
          const key = `${cat}:::${st}`;
          let m = catStoreMap.get(key);
          if (!m) {
            m = new Map();
            catStoreMap.set(key, m);
          }
          m.set(monthKey, (m.get(monthKey) || 0) + qty);
        }
      }

      if (cat) {
        catSet.add(cat);
        catQtyMap.set(cat, (catQtyMap.get(cat) || 0) + qty);
      }

      if (st) {
        storeSet.add(st);
      }

      if (ch) {
        chanMap.set(ch, (chanMap.get(ch) || 0) + amt);
        totalChannelSales += amt;
      }

      if (div) {
        divTotalMap.set(div, (divTotalMap.get(div) || 0) + 1);
        if (isRet) {
          divReturnMap.set(div, (divReturnMap.get(div) || 0) + 1);
        }
      }
    }

    // Pass 2 over sales: 30-day lookback product sales index
    const cutoffDate = new Date(maxDateStr || '2026-04-30');
    cutoffDate.setDate(cutoffDate.getDate() - CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const prodSales30d = new Map();
    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const d = row['Transaction Date'];
      if (d && d >= cutoffStr) {
        const prodNo = row['Product No'];
        if (prodNo) {
          const qty = Number(row['Qty Sold']) || 0;
          prodSales30d.set(prodNo, (prodSales30d.get(prodNo) || 0) + qty);
        }
      }
    }
    this._prodSales30dMap = prodSales30d;

    this._allMonths = Array.from(monthSet).sort();
    this._distinctCategories = Array.from(catSet).sort();
    this._distinctStores = Array.from(storeSet).sort();
    this._monthlyCategoryStoreSales = catStoreMap;

    // Precompute complete chronological monthly sales history for every (category, store) pair
    this._buildMonthlyHistoryCache();

    // Build EDA cache from Pass 1 maps
    this._buildEdaCache({
      monthRevMap,
      catQtyMap,
      chanMap,
      totalChannelSales,
      divTotalMap,
      divReturnMap
    });

    // Pre-compute Top 10 Inventory Alerts Cache (deduplicated by category + store)
    this._buildInventoryAlertsCache();

    this._isReady = true;
    console.log('[DataLoaderService] Datasets, indexes, and caches are fully initialized and ready.');

    return {
      salesCount: this._rawSales.length,
      inventoryCount: this._rawInventory.length,
      categoriesCount: this._distinctCategories.length,
      storesCount: this._distinctStores.length
    };
  }

  /**
   * Precomputes full chronological history and seasonality vectors for all observed (category, store) pairs.
   * @private
   */
  _buildMonthlyHistoryCache() {
    this._monthlyHistoryCache = new Map();
    const allMonths = this._allMonths;

    for (const [key, mGroup] of this._monthlyCategoryStoreSales.entries()) {
      const history = allMonths.map(m => mGroup.get(m) || 0);
      const sum = history.reduce((acc, v) => acc + v, 0);
      const overallAvg = history.length > 0 ? sum / history.length : 0;

      const monthlyAvg = new Array(12).fill(0);
      const monthCounts = new Array(12).fill(0);

      for (let i = 0; i < allMonths.length; i++) {
        const m = allMonths[i];
        const parts = m.split('-');
        if (parts.length >= 2) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          if (monthIdx >= 0 && monthIdx < 12) {
            monthlyAvg[monthIdx] += mGroup.get(m) || 0;
            monthCounts[monthIdx] += 1;
          }
        }
      }

      for (let m = 0; m < 12; m++) {
        monthlyAvg[m] = monthCounts[m] > 0 ? monthlyAvg[m] / monthCounts[m] : overallAvg;
      }

      this._monthlyHistoryCache.set(key, { history, monthlyAvg, overallAvg });
    }
  }

  /**
   * Generates cached results for EDA endpoints.
   * @private
   */
  _buildEdaCache({ monthRevMap, catQtyMap, chanMap, totalChannelSales, divTotalMap, divReturnMap }) {
    const revenueTrend = this._allMonths.map(m => ({
      month: m,
      revenue: Math.round((monthRevMap.get(m) || 0) * 100) / 100
    }));

    const topCategories = Array.from(catQtyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, qty]) => ({
        category,
        qty: Math.round(qty * 100) / 100
      }));

    const channelSplit = Array.from(chanMap.entries())
      .map(([channel, amount]) => ({
        channel,
        sales: Math.round(amount * 100) / 100,
        amount: Math.round(amount * 100) / 100,
        percentage: totalChannelSales > 0 ? Math.round((amount / totalChannelSales) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.sales - a.sales);

    const returnRate = Array.from(divTotalMap.entries())
      .map(([division, total]) => {
        const ret = divReturnMap.get(division) || 0;
        return {
          division,
          returnCount: ret,
          totalCount: total,
          returnRate: total > 0 ? Math.round((ret / total) * 10000) / 100 : 0
        };
      })
      .sort((a, b) => a.division.localeCompare(b.division));

    this._edaCache = {
      revenueTrend,
      topCategories,
      channelSplit,
      returnRate
    };
  }

  /**
   * Pre-calculates top 10 inventory alerts prioritized by low stock then overstock.
   * Deduplicates (category, store) pairs so top 10 alerts cover distinct store-category combinations.
   * @private
   */
  _buildInventoryAlertsCache() {
    const lowAlerts = [];
    const overAlerts = [];
    const seenLowPairs = new Set();
    const seenOverPairs = new Set();
    const limit = CONSTANTS.INVENTORY.ALERTS_LIMIT;

    for (let i = 0; i < this._rawInventory.length; i++) {
      const item = this._rawInventory[i];
      const prodNo = item['Product No'];
      const qtyOnHand = Number(item['Qty on hand']) || 0;
      const sales30d = this.getProdSales30d(prodNo);
      const avgDailySales = sales30d / CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS;

      if (avgDailySales <= 0) {
        continue;
      }

      const category = item['Product Category'] || 'N/A';
      const store = item['Store'] || 'N/A';
      const pairKey = `${category}:::${store}`;
      const status = classifyInventory(qtyOnHand, avgDailySales);

      if (status === CONSTANTS.INVENTORY.STATUS.LOW) {
        if (lowAlerts.length < limit && !seenLowPairs.has(pairKey)) {
          seenLowPairs.add(pairKey);
          lowAlerts.push({
            category,
            store,
            qtyOnHand,
            status: 'Low Stock',
            stockStatus: 'Low Stock',
            'Stock Status': 'Low Stock',
            level: '🔴 Khẩn cấp'
          });
        }
      } else if (status === CONSTANTS.INVENTORY.STATUS.OVER) {
        if (overAlerts.length < limit && !seenOverPairs.has(pairKey)) {
          seenOverPairs.add(pairKey);
          overAlerts.push({
            category,
            store,
            qtyOnHand,
            status: 'Overstock',
            stockStatus: 'Overstock',
            'Stock Status': 'Overstock',
            level: '🟡 Chú ý'
          });
        }
      }

      if (lowAlerts.length >= limit && overAlerts.length >= limit) {
        break;
      }
    }

    const combined = [];
    const finalSeenPairs = new Set();

    // Reserve up to 3 slots for Overstock (when available) so Overstock alerts are surfaced after prioritized Low Stock alerts
    const targetOverCount = Math.min(3, overAlerts.length);
    const targetLowCount = Math.min(lowAlerts.length, limit - targetOverCount);

    const prioritizedAlerts = [
      ...lowAlerts.slice(0, targetLowCount),
      ...overAlerts,
      ...lowAlerts.slice(targetLowCount)
    ];

    for (const alert of prioritizedAlerts) {
      const pairKey = `${alert.category}:::${alert.store}`;
      if (!finalSeenPairs.has(pairKey)) {
        finalSeenPairs.add(pairKey);
        combined.push(alert);
        if (combined.length >= limit) break;
      }
    }

    // Ensure strict priority ordering: all Low Stock alerts precede all Overstock alerts
    combined.sort((a, b) => {
      const aLow = a.stockStatus === 'Low Stock' ? 0 : 1;
      const bLow = b.stockStatus === 'Low Stock' ? 0 : 1;
      return aLow - bLow;
    });

    this._inventoryAlertsCache = combined;
  }
}

// Export singleton instance
module.exports = new DataLoaderService();
