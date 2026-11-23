/**
 * Lakehouse Repository Adapter
 * Serves Gold Medallion analytical marts (serving_bundle.json exported from DuckDB/Parquet)
 * with <100ms startup latency and <120MB RSS memory footprint, bypassing raw 410k CSV parsing.
 */

const fs = require('fs');
const path = require('path');
const { CONSTANTS } = require('../config');

class LakehouseRepository {
  constructor() {
    this._isReady = false;
    this._meta = {
      salesCount: 0,
      inventoryCount: 0,
      months: [],
      stores: [],
      categories: [],
      divisions: []
    };
    this._edaCube = [];
    this._defaultEdaCache = {
      revenueTrend: [],
      topCategories: [],
      channelSplit: [],
      returnRate: []
    };
    this._forecastSeries = new Map();
    this._alerts = [];
    this._salesSample = [];
    this._inventorySample = [];
  }

  isReady() {
    return this._isReady;
  }

  getSalesCount() {
    return this._meta.salesCount || 0;
  }

  getInventoryCount() {
    return this._meta.inventoryCount || 0;
  }

  getDistinctCategories() {
    return [...this._meta.categories];
  }

  getDistinctStores() {
    return [...this._meta.stores];
  }

  getEdaMetadata() {
    return {
      stores: [...this._meta.stores],
      divisions: [...this._meta.divisions],
      categories: [...this._meta.categories],
      months: [...this._meta.months]
    };
  }

  getInventoryAlertsCache() {
    return this._alerts;
  }

  getRawSalesSample() {
    return this._salesSample;
  }

  getRawInventorySample() {
    return this._inventorySample;
  }

  /**
   * Initializes repository from Gold serving_bundle.json.
   * @param {string} lakehouseDir
   */
  async init(lakehouseDir) {
    const bundlePath = path.join(lakehouseDir, 'gold', 'serving_bundle.json');
    if (!fs.existsSync(bundlePath)) {
      throw new Error(`Lakehouse serving bundle not found: ${bundlePath}. Run 'pipelines/run_pipeline.py' first.`);
    }

    const startMs = Date.now();
    const rawJson = await fs.promises.readFile(bundlePath, 'utf-8');
    const bundle = JSON.parse(rawJson);

    this._meta = bundle.meta || this._meta;
    this._edaCube = Array.isArray(bundle.edaCube) ? bundle.edaCube : [];
    this._alerts = Array.isArray(bundle.alerts) ? bundle.alerts : [];
    this._salesSample = Array.isArray(bundle.salesSample) ? bundle.salesSample : [];
    this._inventorySample = Array.isArray(bundle.inventorySample) ? bundle.inventorySample : [];

    this._forecastSeries = new Map();
    if (bundle.forecastSeries && typeof bundle.forecastSeries === 'object') {
      for (const [k, v] of Object.entries(bundle.forecastSeries)) {
        this._forecastSeries.set(k, v);
      }
    }

    // Precompute default unfiltered EDA cache
    this._defaultEdaCache = this._aggregateCube({});
    this._isReady = true;

    console.log(
      `[LakehouseRepository] Loaded Gold marts in ${Date.now() - startMs}ms ` +
      `(sales=${this._meta.salesCount}, inventory=${this._meta.inventoryCount}, cubeCells=${this._edaCube.length})`
    );
    return {
      salesCount: this._meta.salesCount,
      inventoryCount: this._meta.inventoryCount,
      categoriesCount: this._meta.categories.length,
      storesCount: this._meta.stores.length
    };
  }

  _hasActiveFilters(filters = {}) {
    if (!filters || typeof filters !== 'object') return false;
    const { store, division, startMonth, endMonth } = filters;
    return [store, division, startMonth, endMonth].some(
      (v) => Boolean(v && String(v).trim() && String(v).trim().toUpperCase() !== 'ALL')
    );
  }

  _aggregateCube(filters = {}) {
    const storeFilter = filters.store && String(filters.store).trim().toUpperCase() !== 'ALL'
      ? String(filters.store).trim()
      : null;
    const divisionFilter = filters.division && String(filters.division).trim().toUpperCase() !== 'ALL'
      ? String(filters.division).trim()
      : null;
    const startMonth = filters.startMonth && String(filters.startMonth).trim().toUpperCase() !== 'ALL'
      ? String(filters.startMonth).trim()
      : null;
    const endMonth = filters.endMonth && String(filters.endMonth).trim().toUpperCase() !== 'ALL'
      ? String(filters.endMonth).trim()
      : null;

    const activeMonths = (this._meta.months || []).filter((m) => {
      if (startMonth && m < startMonth) return false;
      if (endMonth && m > endMonth) return false;
      return true;
    });

    const monthRevMap = new Map(activeMonths.map((m) => [m, 0]));
    const catQtyMap = new Map();
    const chanMap = new Map();
    let totalChannelSales = 0;
    const divTotalMap = new Map();
    const divReturnMap = new Map();

    for (let i = 0; i < this._edaCube.length; i++) {
      const cell = this._edaCube[i];
      if (storeFilter && cell.store !== storeFilter) continue;
      if (divisionFilter && cell.division !== divisionFilter) continue;
      if (startMonth && cell.month < startMonth) continue;
      if (endMonth && cell.month > endMonth) continue;

      if (cell.month) {
        monthRevMap.set(cell.month, (monthRevMap.get(cell.month) || 0) + cell.revenue);
      }
      if (cell.category) {
        catQtyMap.set(cell.category, (catQtyMap.get(cell.category) || 0) + cell.qty);
      }
      if (cell.channel) {
        chanMap.set(cell.channel, (chanMap.get(cell.channel) || 0) + cell.revenue);
        totalChannelSales += cell.revenue;
      }
      if (cell.division) {
        divTotalMap.set(cell.division, (divTotalMap.get(cell.division) || 0) + cell.totalCount);
        if (cell.returnCount > 0) {
          divReturnMap.set(cell.division, (divReturnMap.get(cell.division) || 0) + cell.returnCount);
        }
      }
    }

    const revenueTrend = activeMonths.map((m) => ({
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

    return {
      revenueTrend,
      topCategories,
      channelSplit,
      returnRate
    };
  }

  queryFilteredEda(filters = {}) {
    if (!this._hasActiveFilters(filters)) {
      return this._defaultEdaCache;
    }
    return this._aggregateCube(filters);
  }

  getMonthlySalesHistory(category, store) {
    const key = `${category}:::${store}`;
    const entry = this._forecastSeries.get(key);
    if (entry) {
      return {
        history: [...entry.history],
        monthlyAvg: [...entry.monthlyAvg],
        overallAvg: entry.overallAvg
      };
    }

    const monthCount = this._meta.months.length > 0 ? this._meta.months.length : 11;
    return {
      history: new Array(monthCount).fill(0),
      monthlyAvg: new Array(12).fill(0),
      overallAvg: 0
    };
  }

  getSalesStreamBatch(batchSize = CONSTANTS.STREAM.SALES_BATCH_SIZE) {
    const pool = this._salesSample;
    if (!pool || pool.length === 0) return [];
    const count = Math.min(batchSize, pool.length);
    const sample = [];
    const seen = new Set();
    while (seen.size < count) {
      const idx = Math.floor(Math.random() * pool.length);
      if (!seen.has(idx)) {
        seen.add(idx);
        sample.push(pool[idx]);
      }
    }
    return sample;
  }

  classifyRandomInventoryBatch(batchSize = CONSTANTS.INVENTORY.STREAM_BATCH_SIZE) {
    const pool = this._inventorySample;
    const counts = { healthy: 0, low: 0, over: 0 };
    if (!pool || pool.length === 0) return counts;

    for (let i = 0; i < batchSize; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const h = item.stockHealth || 'healthy';
      if (h === 'healthy') counts.healthy++;
      else if (h === 'low') counts.low++;
      else if (h === 'over') counts.over++;
    }
    return counts;
  }
}

module.exports = new LakehouseRepository();
