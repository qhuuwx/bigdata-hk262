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

class DataLoaderService {
  constructor() {
    this._isReady = false;
    this._rawSales = [];
    this._rawInventory = [];

    // Internal In-Memory Indexes & Caches
    this._prodSales30dMap = new Map();
    this._distinctCategories = [];
    this._distinctStores = [];
    this._monthlyCategoryStoreSales = new Map();
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
   * @param {string} category 
   * @param {string} store 
   * @returns {{ history: number[], monthlyAvg: number[], overallAvg: number }}
   */
  getMonthlySalesHistory(category, store) {
    const key = `${category}:::${store}`;
    const seriesMap = this._monthlyCategoryStoreSales.get(key);

    if (!seriesMap || seriesMap.size === 0) {
      return {
        history: [0, 0, 0, 0],
        monthlyAvg: new Array(12).fill(0),
        overallAvg: 0
      };
    }

    const sortedMonths = Array.from(seriesMap.keys()).sort();
    const history = sortedMonths.map(m => seriesMap.get(m) || 0);

    const monthBuckets = Array.from({ length: 12 }, () => []);
    for (const [monthKey, qty] of seriesMap.entries()) {
      const parts = monthKey.split('-');
      if (parts.length >= 2) {
        const mIdx = parseInt(parts[1], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          monthBuckets[mIdx].push(qty);
        }
      }
    }

    const monthlyAvg = monthBuckets.map(bucket => {
      if (bucket.length === 0) return 0;
      return bucket.reduce((a, b) => a + b, 0) / bucket.length;
    });

    const totalQty = history.reduce((a, b) => a + b, 0);
    const overallAvg = history.length > 0 ? totalQty / history.length : 0;

    return {
      history,
      monthlyAvg,
      overallAvg
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
          if (!line.trim()) return;
          const cells = parseCSVLine(line);
          if (!headers) {
            headers = cells;
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
   * Initializes datasets from CSV files and builds in-memory indexes.
   * @param {string} dataDir 
   */
  async init(dataDir) {
    const salesPath = path.join(dataDir, 'retail_sales_ml_apl.csv');
    const inventoryPath = path.join(dataDir, 'retail_inventory_ml_apl.csv');

    console.log(`[DataLoaderService] Loading sales dataset from ${salesPath}...`);
    this._rawSales = await this._streamParseCSV(salesPath);
    console.log(`[DataLoaderService] Sales loaded: ${this._rawSales.length} records`);

    console.log(`[DataLoaderService] Loading inventory dataset from ${inventoryPath}...`);
    this._rawInventory = await this._streamParseCSV(inventoryPath);
    console.log(`[DataLoaderService] Inventory loaded: ${this._rawInventory.length} records`);

    // 1. Pre-calculate 30-day Sales per Product
    let maxDateStr = '';
    for (let i = 0; i < this._rawSales.length; i++) {
      const d = this._rawSales[i]['Transaction Date'];
      if (d && d > maxDateStr) {
        maxDateStr = d;
      }
    }

    const cutoffDate = new Date(maxDateStr || '2026-04-30');
    cutoffDate.setDate(cutoffDate.getDate() - CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const prodSales30d = new Map();
    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const d = row['Transaction Date'];
      if (d && d >= cutoffStr) {
        const prodNo = row['Product No'];
        const qty = Number(row['Qty Sold']) || 0;
        prodSales30d.set(prodNo, (prodSales30d.get(prodNo) || 0) + qty);
      }
    }
    this._prodSales30dMap = prodSales30d;

    // 2. Pre-index Monthly Category-Store Sales & Distinct lists
    const catSet = new Set();
    const storeSet = new Set();
    const catStoreMap = new Map();

    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const cat = row['Product Category'];
      const st = row['Store'];
      const date = row['Transaction Date'];
      const qty = Number(row['Qty Sold']) || 0;

      if (cat) catSet.add(cat);
      if (st) storeSet.add(st);

      if (cat && st && date) {
        const monthKey = date.slice(0, 7); // YYYY-MM
        const key = `${cat}:::${st}`;
        if (!catStoreMap.has(key)) {
          catStoreMap.set(key, new Map());
        }
        const m = catStoreMap.get(key);
        m.set(monthKey, (m.get(monthKey) || 0) + qty);
      }
    }

    this._distinctCategories = Array.from(catSet).sort();
    this._distinctStores = Array.from(storeSet).sort();
    this._monthlyCategoryStoreSales = catStoreMap;

    // 3. Pre-compute EDA Analytics Cache
    this._buildEdaCache();

    // 4. Pre-compute Top 10 Inventory Alerts Cache
    this._buildInventoryAlertsCache();

    this._isReady = true;
    console.log('[DataLoaderService] Datasets, indexes, and caches are fully initialized and ready.');
  }

  /**
   * Generates cached results for EDA endpoints.
   * @private
   */
  _buildEdaCache() {
    // EDA 1: Revenue trend by month
    const monthRevMap = new Map();
    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const date = row['Transaction Date'];
      const amt = Number(row['Sales Amount']) || 0;
      if (date) {
        const m = date.slice(0, 7);
        monthRevMap.set(m, (monthRevMap.get(m) || 0) + amt);
      }
    }
    const revenueTrend = Array.from(monthRevMap.keys())
      .sort()
      .map(m => ({
        month: m,
        revenue: Math.round((monthRevMap.get(m) || 0) * 100) / 100
      }));

    // EDA 2: Top 10 Categories by Qty Sold
    const catQtyMap = new Map();
    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const cat = row['Product Category'];
      const qty = Number(row['Qty Sold']) || 0;
      if (cat) {
        catQtyMap.set(cat, (catQtyMap.get(cat) || 0) + qty);
      }
    }
    const topCategories = Array.from(catQtyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, qty]) => ({
        category,
        qty: Math.round(qty * 100) / 100
      }));

    // EDA 3: Channel split
    const chanMap = new Map();
    let totalSales = 0;
    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const ch = row['Sales Channel'];
      const amt = Number(row['Sales Amount']) || 0;
      if (ch) {
        chanMap.set(ch, (chanMap.get(ch) || 0) + amt);
        totalSales += amt;
      }
    }
    const channelSplit = Array.from(chanMap.entries()).map(([channel, amount]) => ({
      channel,
      sales: Math.round(amount * 100) / 100,
      amount: Math.round(amount * 100) / 100,
      percentage: totalSales > 0 ? Math.round((amount / totalSales) * 10000) / 100 : 0
    }));

    // EDA 4: Return rate by Product Division
    const divTotalMap = new Map();
    const divReturnMap = new Map();
    for (let i = 0; i < this._rawSales.length; i++) {
      const row = this._rawSales[i];
      const div = row['Product Division'];
      const isRet = Number(row['Is Return']) === 1;
      if (div) {
        divTotalMap.set(div, (divTotalMap.get(div) || 0) + 1);
        if (isRet) {
          divReturnMap.set(div, (divReturnMap.get(div) || 0) + 1);
        }
      }
    }
    const returnRate = Array.from(divTotalMap.entries()).map(([division, total]) => {
      const ret = divReturnMap.get(division) || 0;
      return {
        division,
        returnCount: ret,
        totalCount: total,
        returnRate: total > 0 ? Math.round((ret / total) * 10000) / 100 : 0
      };
    });

    this._edaCache = {
      revenueTrend,
      topCategories,
      channelSplit,
      returnRate
    };
  }

  /**
   * Pre-calculates top 10 inventory alerts prioritized by low stock then overstock.
   * @private
   */
  _buildInventoryAlertsCache() {
    const lowAlerts = [];
    const overAlerts = [];

    for (let i = 0; i < this._rawInventory.length; i++) {
      const item = this._rawInventory[i];
      const prodNo = item['Product No'];
      const qtyOnHand = Number(item['Qty on hand']) || 0;
      const sales30d = this.getProdSales30d(prodNo);
      const avgDailySales = sales30d / CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS;

      if (avgDailySales > 0) {
        if (qtyOnHand < avgDailySales * CONSTANTS.INVENTORY.COVER_DAYS_HEALTHY) {
          if (lowAlerts.length < CONSTANTS.INVENTORY.ALERTS_LIMIT) {
            lowAlerts.push({
              category: item['Product Category'] || 'N/A',
              store: item['Store'] || 'N/A',
              qtyOnHand,
              status: 'Low Stock',
              stockStatus: 'Low Stock',
              'Stock Status': 'Low Stock',
              level: '🔴 Khẩn cấp'
            });
          }
        } else if (qtyOnHand >= avgDailySales * CONSTANTS.INVENTORY.COVER_DAYS_OVERSTOCK) {
          if (overAlerts.length < CONSTANTS.INVENTORY.ALERTS_LIMIT) {
            overAlerts.push({
              category: item['Product Category'] || 'N/A',
              store: item['Store'] || 'N/A',
              qtyOnHand,
              status: 'Overstock',
              stockStatus: 'Overstock',
              'Stock Status': 'Overstock',
              level: '🟡 Chú ý'
            });
          }
        }
      }

      if (lowAlerts.length >= CONSTANTS.INVENTORY.ALERTS_LIMIT && overAlerts.length >= CONSTANTS.INVENTORY.ALERTS_LIMIT) {
        break;
      }
    }

    this._inventoryAlertsCache = [...lowAlerts, ...overAlerts].slice(0, CONSTANTS.INVENTORY.ALERTS_LIMIT);
  }
}

// Export singleton instance
module.exports = new DataLoaderService();
