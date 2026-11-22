/**
 * Backward-Compatible DataLoader Facade
 * Delegates all operations to backend/services/dataLoaderService and backend/algorithms/classify
 * so legacy test suites (test_m1.js, test_endpoints.js) and production services share a single source of truth.
 */

const dataLoaderService = require('./services/dataLoaderService');
const { classifyInventory } = require('./algorithms/classify');
const { CONSTANTS } = require('./config');

/**
 * Classifies an inventory item based on avgDailySales (past 30 days)
 * Supports explicit { qtyOnHand, avgDailySales } objects or raw CSV row objects { 'Product No', 'Qty on hand' }.
 * @param {Object} item
 * @returns {'healthy' | 'low' | 'over'}
 */
function classifyInventoryItem(item) {
  if (!item) return 'healthy';

  let avgDailySales;
  if (item.avgDailySales !== undefined) {
    avgDailySales = Number(item.avgDailySales);
  } else {
    const productNo = item['Product No'];
    const sales30d = dataLoaderService.getProdSales30d(productNo);
    avgDailySales = sales30d / CONSTANTS.INVENTORY.SALES_LOOKBACK_DAYS;
  }

  const rawQty = item.qtyOnHand !== undefined ? item.qtyOnHand : item['Qty on hand'];
  const qtyOnHand = Number(rawQty !== undefined ? rawQty : 0);

  return classifyInventory(qtyOnHand, avgDailySales);
}

async function initDataLoader(dataPath) {
  return dataLoaderService.init(dataPath);
}

function getSalesData() {
  return dataLoaderService.getRawSales();
}

function getInventoryData() {
  return dataLoaderService.getRawInventory();
}

function getDistinctCategories() {
  return dataLoaderService.getDistinctCategories();
}

function getDistinctStores() {
  return dataLoaderService.getDistinctStores();
}

function getProductSales30d(productNo) {
  return dataLoaderService.getProdSales30d(productNo);
}

function getMonthlySalesHistory(category, store) {
  return dataLoaderService.getMonthlySalesHistory(category, store);
}

function getEdaRevenueTrend() {
  return dataLoaderService.getEdaCache().revenueTrend;
}

function getEdaTopCategories() {
  return dataLoaderService.getEdaCache().topCategories;
}

function getEdaChannelSplit() {
  return dataLoaderService.getEdaCache().channelSplit;
}

function getEdaReturnRate() {
  return dataLoaderService.getEdaCache().returnRate;
}

function getInventoryAlerts() {
  return dataLoaderService.getInventoryAlertsCache();
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
