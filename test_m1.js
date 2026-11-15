const assert = require('assert');
const path = require('path');
const { runForecast } = require('./algorithms/forecast');
const { runForecastSuper } = require('./algorithms/forecastsuper');
const {
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
} = require('./backend/dataLoader');

async function testForecastAlgorithms() {
  console.log('--- Testing Forecast Algorithms ---');

  // Test 1: Normal forecast basic calculation
  // history = [10, 20, 30, 40], windowSize = 4, periods = 2
  // Period 1: window = [10, 20, 30, 40] -> avg = 25. h becomes [10, 20, 30, 40, 25]
  // Period 2: window = [20, 30, 40, 25] -> avg = 28.75
  const fc = runForecast([10, 20, 30, 40], 2, 4);
  assert.deepStrictEqual(fc, [25, 28.75], 'runForecast basic failed');
  console.log('✔ runForecast basic calculation passed:', fc);

  // Test 2: Normal forecast edge cases
  assert.deepStrictEqual(runForecast([], 5), [], 'runForecast empty history failed');
  assert.deepStrictEqual(runForecast([10, 20], 0), [], 'runForecast 0 periods failed');
  assert.deepStrictEqual(runForecast([10, 20], -2), [], 'runForecast negative periods failed');
  const fcShort = runForecast([10, 20], 2, 4); // window [10, 20] -> 15; [10, 20, 15] -> 15
  assert.deepStrictEqual(fcShort, [15, 15], 'runForecast short history failed');
  console.log('✔ runForecast edge cases passed');

  // Test 3: Super forecast basic calculation
  // history = [10, 20, 30, 40], periods = 1
  // WMA: (10*1 + 20*2 + 30*3 + 40*4) / 10 = (10 + 40 + 90 + 160) / 10 = 300 / 10 = 30.
  // Seasonality: current month m. If overallAvg = 100, monthlyAvg[m] = 120 -> sf = 1.2
  // val = 30 * 1.2 = 36.
  const currMonth = new Date().getMonth();
  const mAvg = new Array(12).fill(100);
  mAvg[currMonth] = 120;
  const fcs = runForecastSuper([10, 20, 30, 40], 1, mAvg, 100);
  assert.deepStrictEqual(fcs, [36], 'runForecastSuper basic failed');
  console.log('✔ runForecastSuper basic calculation passed:', fcs);

  // Test 4: Super forecast edge cases
  assert.deepStrictEqual(runForecastSuper([], 4, [], 100), [], 'runForecastSuper empty history failed');
  assert.deepStrictEqual(runForecastSuper([10], 0, [], 100), [], 'runForecastSuper 0 periods failed');
  const fcsZeroAvg = runForecastSuper([10, 20, 30, 40], 1, [], 0);
  assert.deepStrictEqual(fcsZeroAvg, [30], 'runForecastSuper zero overallAvg fallback failed');
  console.log('✔ runForecastSuper edge cases passed');
}

async function testDataLoader() {
  console.log('\n--- Testing DataLoader & In-Memory Indexes ---');
  const start = Date.now();
  const dataPath = path.join(__dirname, 'data');
  const stats = await initDataLoader(dataPath);
  const elapsed = (Date.now() - start) / 1000;
  console.log(`DataLoader initialized in ${elapsed.toFixed(2)}s:`, stats);

  // Verify record counts
  const sales = getSalesData();
  const inventory = getInventoryData();
  assert.strictEqual(sales.length, 125751, `Expected 125751 sales rows, got ${sales.length}`);
  assert.strictEqual(inventory.length, 284755, `Expected 284755 inventory rows, got ${inventory.length}`);
  console.log('✔ Row counts verified: Sales = 125,751, Inventory = 284,755');

  // Verify headers retained verbatim
  const salesHeaders = Object.keys(sales[0]);
  assert(salesHeaders.includes('Transaction Date'), 'Missing Transaction Date in sales');
  assert(salesHeaders.includes('Product Category'), 'Missing Product Category in sales');
  assert(salesHeaders.includes('Qty Sold'), 'Missing Qty Sold in sales');
  assert(salesHeaders.includes('Sales Amount'), 'Missing Sales Amount in sales');
  assert(salesHeaders.includes('Is Return'), 'Missing Is Return in sales');

  const invHeaders = Object.keys(inventory[0]);
  assert(invHeaders.includes('Product No'), 'Missing Product No in inventory');
  assert(invHeaders.includes('Qty on hand'), 'Missing Qty on hand in inventory');
  assert(invHeaders.includes('Store'), 'Missing Store in inventory');
  console.log('✔ Column headers preserved verbatim');

  // Verify distinct categories & stores
  const categories = getDistinctCategories();
  const stores = getDistinctStores();
  assert.strictEqual(categories.length, 27, `Expected 27 categories, got ${categories.length}`);
  assert.strictEqual(stores.length, 40, `Expected 40 stores, got ${stores.length}`);
  console.log(`✔ Categories (${categories.length}) and Stores (${stores.length}) verified`);

  // Verify 30-day product sales
  // Check sample product
  const sampleProdNo = sales[0]['Product No'];
  const prodSales = getProductSales30d(sampleProdNo);
  assert(typeof prodSales === 'number', 'Product sales 30d should be number');
  console.log(`✔ getProductSales30d("${sampleProdNo}") = ${prodSales}`);

  // Verify monthly category-store sales history
  const sampleCat = categories[0];
  const sampleStore = stores[0];
  const historyObj = getMonthlySalesHistory(sampleCat, sampleStore);
  assert(Array.isArray(historyObj.history), 'history should be array');
  assert.strictEqual(historyObj.history.length, 11, `Expected 11 months history, got ${historyObj.history.length}`);
  assert(typeof historyObj.overallAvg === 'number', 'overallAvg should be number');
  console.log(`✔ getMonthlySalesHistory("${sampleCat}", "${sampleStore}"): history length = ${historyObj.history.length}, overallAvg = ${historyObj.overallAvg.toFixed(2)}`);

  // Verify EDA revenue trend
  const revTrend = getEdaRevenueTrend();
  assert.strictEqual(revTrend.length, 11, `Expected 11 months in revenue trend, got ${revTrend.length}`);
  assert(revTrend[0].month === '2025-06', `Expected first month 2025-06, got ${revTrend[0].month}`);
  assert(revTrend[10].month === '2026-04', `Expected last month 2026-04, got ${revTrend[10].month}`);
  console.log('✔ getEdaRevenueTrend verified: 11 chronological months from 2025-06 to 2026-04');

  // Verify EDA top categories
  const topCats = getEdaTopCategories();
  assert.strictEqual(topCats.length, 10, 'Expected top 10 categories');
  assert(topCats[0].qty >= topCats[1].qty, 'Top categories should be sorted descending');
  console.log(`✔ getEdaTopCategories verified: Top 1 is ${topCats[0].category} with ${topCats[0].qty} qty`);

  // Verify EDA channel split
  const channelSplit = getEdaChannelSplit();
  assert.strictEqual(channelSplit.length, 1, 'Expected 1 channel');
  assert.strictEqual(channelSplit[0].channel, 'Channel Alpha');
  assert.strictEqual(channelSplit[0].percentage, 100);
  console.log('✔ getEdaChannelSplit verified: Channel Alpha 100%');

  // Verify EDA return rate
  const returnRates = getEdaReturnRate();
  assert.strictEqual(returnRates.length, 3, 'Expected 3 divisions');
  returnRates.forEach(d => {
    assert(d.returnRate >= 0 && d.returnRate <= 100, `Return rate out of range: ${d.returnRate}`);
  });
  console.log('✔ getEdaReturnRate verified: 3 divisions with valid return percentages');

  // Verify classifyInventoryItem
  // Case 1: avgDailySales = 0 -> healthy
  const itemZeroSales = { 'Product No': 'NON_EXISTENT_PROD', 'Qty on hand': 50 };
  assert.strictEqual(classifyInventoryItem(itemZeroSales), 'healthy', 'Zero sales should be healthy');

  // Case 2: high stock -> overstock
  // Find a product with positive 30d sales
  let testProdNo = null;
  for (const [pNo, qty] of sales.map(s => [s['Product No'], Number(s['Qty Sold'])])) {
    if (getProductSales30d(pNo) > 30) {
      testProdNo = pNo;
      break;
    }
  }
  const sales30 = getProductSales30d(testProdNo);
  const ads = sales30 / 30; // e.g. 2 / day
  const itemOver = { 'Product No': testProdNo, 'Qty on hand': ads * 70 };
  assert.strictEqual(classifyInventoryItem(itemOver), 'over', 'Should be overstock');

  const itemHealthy = { 'Product No': testProdNo, 'Qty on hand': ads * 20 };
  assert.strictEqual(classifyInventoryItem(itemHealthy), 'healthy', 'Should be healthy');

  const itemLow = { 'Product No': testProdNo, 'Qty on hand': ads * 5 };
  assert.strictEqual(classifyInventoryItem(itemLow), 'low', 'Should be low stock');

  const itemNegative = { 'Product No': testProdNo, 'Qty on hand': -2 };
  assert.strictEqual(classifyInventoryItem(itemNegative), 'low', 'Negative stock should be low stock');
  console.log('✔ classifyInventoryItem logic verified for all boundary cases');

  // Verify inventory alerts
  const alerts = getInventoryAlerts();
  assert.strictEqual(alerts.length, 10, `Expected 10 alerts, got ${alerts.length}`);
  // Check schema
  alerts.forEach((alert, idx) => {
    assert(alert.category, `Alert ${idx} missing category`);
    assert(alert.store, `Alert ${idx} missing store`);
    assert(typeof alert.qtyOnHand === 'number', `Alert ${idx} qtyOnHand should be number`);
    assert(['Low Stock', 'Overstock'].includes(alert.stockStatus), `Alert ${idx} invalid stockStatus`);
    assert(['🔴 Khẩn cấp', '🟡 Chú ý'].includes(alert.level), `Alert ${idx} invalid level`);
  });
  // Check Low Stock appears before Overstock
  let seenOverstock = false;
  alerts.forEach(alert => {
    if (alert.stockStatus === 'Overstock') seenOverstock = true;
    if (alert.stockStatus === 'Low Stock' && seenOverstock) {
      assert.fail('Low Stock appeared after Overstock!');
    }
  });
  console.log('✔ getInventoryAlerts verified: 10 alerts, correct schema, Low Stock prioritized');
}

async function runAll() {
  await testForecastAlgorithms();
  await testDataLoader();
  console.log('\n=======================================');
  console.log('🎉 ALL MILESTONE 1 TESTS PASSED 100%! 🎉');
  console.log('=======================================');
}

runAll().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
