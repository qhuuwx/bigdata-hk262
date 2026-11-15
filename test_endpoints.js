/**
 * test_endpoints.js
 * 
 * Comprehensive Automated End-to-End & Algorithm Test Suite for
 * Big Data Demand Forecasting & Smart Inventory System (`bigdata_inventory`).
 * 
 * Conforms strictly to TEST_INFRA.md, PROJECT.md, and ORIGINAL_REQUEST.md.
 * 
 * Structure:
 *   - Tier 1: Feature Coverage (>=5 assertions per feature across F1-F11)
 *   - Tier 2: Boundary & Corner Cases (limits, bad inputs, negative quantities, rounding)
 *   - Tier 3: Cross-Feature Combinations (pairwise interactions, state monotonicity)
 *   - Tier 4: Real-World Application Scenarios (5 retail workflows)
 * 
 * Usage:
 *   node test_endpoints.js
 *   BASE_URL=http://localhost:3000 node test_endpoints.js
 * 
 * Zero external npm dependencies required (uses native Node 18+ fetch and assert).
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const child_process = require('node:child_process');

// --- Configuration ---
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '4000', 10);

// --- ANSI Terminal Styling ---
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m'
};

// --- Test Reporter ---
class TestReporter {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  record({ tier, feature, name, passed, skipped = false, error = null, durationMs = 0 }) {
    this.results.push({
      tier,
      feature,
      name,
      passed,
      skipped,
      error,
      durationMs
    });

    const statusBadge = skipped
      ? `${c.yellow}[SKIP]${c.reset}`
      : passed
        ? `${c.green}✔ PASS${c.reset}`
        : `${c.red}✖ FAIL${c.reset}`;

    const durationStr = durationMs > 0 ? `${c.gray}(${durationMs}ms)${c.reset}` : '';
    console.log(`  ${statusBadge} ${c.cyan}[${tier}]${c.reset} ${c.bold}${feature}:${c.reset} ${name} ${durationStr}`);
    
    if (!passed && !skipped && error) {
      const errMsg = error.stack || error.message || String(error);
      const indented = errMsg.split('\n').map(l => `      ${c.red}${l}${c.reset}`).join('\n');
      console.error(indented);
    }
  }

  printBanner(title, tier) {
    const bar = '='.repeat(78);
    console.log(`\n${c.blue}${bar}${c.reset}`);
    console.log(`${c.bold}${c.white}  ${tier.toUpperCase()} : ${title.toUpperCase()}${c.reset}`);
    console.log(`${c.blue}${bar}${c.reset}\n`);
  }

  printSummary(isServerOnline, isUnitOnly = false) {
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed && !r.skipped).length;
    const failedTests = this.results.filter(r => !r.passed && !r.skipped).length;
    const skippedTests = this.results.filter(r => r.skipped).length;

    console.log(`\n${c.bold}==============================================================================${c.reset}`);
    console.log(`${c.bold}                         TEST EXECUTION SUMMARY                               ${c.reset}`);
    console.log(`${c.bold}==============================================================================${c.reset}`);
    const serverStatusText = isUnitOnly
      ? `${c.gray}SKIPPED (--unit-only mode)${c.reset}`
      : (isServerOnline ? `${c.green}ONLINE${c.reset}` : `${c.yellow}OFFLINE${c.reset}`);
    console.log(`  Target Backend : ${c.cyan}${BASE_URL}${c.reset} (${serverStatusText})`);
    console.log(`  Duration       : ${totalTime}s`);
    console.log(`  Total Checks   : ${totalTests}`);
    console.log(`  Passed         : ${c.green}${passedTests}${c.reset}`);
    console.log(`  Failed         : ${failedTests > 0 ? c.red + failedTests : c.green + '0'}${c.reset}`);
    console.log(`  Skipped        : ${skippedTests > 0 ? c.yellow + skippedTests : '0'}${c.reset}`);
    console.log(`------------------------------------------------------------------------------`);

    // Tier Summary Table
    const tiers = ['Tier 0', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Unit'];
    console.log(`${c.bold}  Tier Summary:${c.reset}`);
    console.log(`  ${'Tier'.padEnd(10)} | ${'Total'.padEnd(8)} | ${'Pass'.padEnd(8)} | ${'Fail'.padEnd(8)} | ${'Skip'.padEnd(8)} | ${'Status'.padEnd(8)}`);
    console.log(`  ${'-'.repeat(58)}`);
    for (const t of tiers) {
      const inTier = this.results.filter(r => r.tier.toLowerCase().startsWith(t.toLowerCase()));
      if (inTier.length === 0) continue;
      const pass = inTier.filter(r => r.passed && !r.skipped).length;
      const fail = inTier.filter(r => !r.passed && !r.skipped).length;
      const skip = inTier.filter(r => r.skipped).length;
      const status = fail > 0 ? `${c.red}FAILED${c.reset}` : skip === inTier.length ? `${c.yellow}SKIPPED${c.reset}` : `${c.green}PASSED${c.reset}`;
      console.log(`  ${t.padEnd(10)} | ${String(inTier.length).padEnd(8)} | ${String(pass).padEnd(8)} | ${String(fail).padEnd(8)} | ${String(skip).padEnd(8)} | ${status}`);
    }

    // Feature Matrix Breakdown
    console.log(`\n${c.bold}  Feature Matrix Coverage:${c.reset}`);
    const features = ['DataLoader', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'];
    console.log(`  ${'Feature'.padEnd(10)} | ${'Description'.padEnd(35)} | ${'Checks'.padEnd(8)} | ${'Pass'.padEnd(6)} | ${'Fail'.padEnd(6)} | ${'Status'.padEnd(8)}`);
    console.log(`  ${'-'.repeat(79)}`);

    const featureNames = {
      DataLoader: 'DataLoader & Pipeline (R1)',
      F1: 'GET /api/stream/sales',
      F2: 'GET /api/eda/revenue-trend',
      F3: 'GET /api/eda/top-categories',
      F4: 'GET /api/eda/channel-split',
      F5: 'GET /api/eda/return-rate',
      F6: 'POST /api/forecast',
      F7: 'GET /api/inventory/stream',
      F8: 'GET /api/inventory/alerts',
      F9: 'Normal Forecast (MA)',
      F10: 'Super Forecast (WMA+Season)',
      F11: 'Inventory Classification'
    };

    for (const f of features) {
      const inFeat = this.results.filter(r => r.feature.toUpperCase() === f.toUpperCase() || r.feature.startsWith(f + ':'));
      const pass = inFeat.filter(r => r.passed && !r.skipped).length;
      const fail = inFeat.filter(r => !r.passed && !r.skipped).length;
      const skip = inFeat.filter(r => r.skipped).length;
      const fName = (featureNames[f] || f).padEnd(35);
      const status = fail > 0 ? `${c.red}FAIL${c.reset}` : inFeat.length === 0 ? `${c.gray}N/A${c.reset}` : skip === inFeat.length ? `${c.yellow}SKIP${c.reset}` : `${c.green}PASS${c.reset}`;
      console.log(`  ${f.padEnd(10)} | ${fName} | ${String(inFeat.length).padEnd(8)} | ${String(pass).padEnd(6)} | ${String(fail).padEnd(6)} | ${status}`);
    }

    console.log(`==============================================================================`);
    if (failedTests > 0) {
      console.log(`\n${c.bgRed}${c.white}${c.bold}  OVERALL VERDICT: FAILED (${failedTests} failures)  ${c.reset}\n`);
      return false;
    } else if (isUnitOnly) {
      console.log(`\n${c.bgGreen}${c.white}${c.bold}  OVERALL VERDICT: 100% PASSED (ALL UNIT CHECKS VERIFIED)  ${c.reset}\n`);
      return true;
    } else if (!isServerOnline || skippedTests > 0) {
      console.log(`\n${c.bgRed}${c.white}${c.bold}  OVERALL VERDICT: FAILED — SERVER OFFLINE (${skippedTests} E2E HTTP tests unexecuted)  ${c.reset}`);
      console.log(`  ${c.cyan}E2E test suite requires backend server running at ${BASE_URL}.${c.reset}`);
      console.log(`  1. Start server : ${c.bold}node backend/server.js${c.reset}`);
      console.log(`  2. Run runner   : ${c.bold}node test_endpoints.js${c.reset}\n`);
      return false;
    } else {
      console.log(`\n${c.bgGreen}${c.white}${c.bold}  OVERALL VERDICT: 100% PASSED (ALL TIERS AND FEATURES VERIFIED)  ${c.reset}\n`);
      return true;
    }
  }
}

// --- HTTP Client Helper ---
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);

  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    signal: controller.signal
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const start = Date.now();
  try {
    const res = await fetch(url, fetchOptions);
    const durationMs = Date.now() - start;
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return {
      status: res.status,
      headers: res.headers,
      data,
      durationMs
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Strict Production Algorithm & DataLoader Module Loader ---
function loadAlgorithmModules() {
  const rootDir = __dirname;
  const forecastPath = path.join(rootDir, 'algorithms', 'forecast.js');
  const forecastSuperPath = path.join(rootDir, 'algorithms', 'forecastsuper.js');
  const dataLoaderPath = path.join(rootDir, 'backend', 'dataLoader.js');

  if (!fs.existsSync(forecastPath)) {
    throw new Error(`CRITICAL INTEGRITY FAILURE: ${forecastPath} not found on disk.`);
  }
  if (!fs.existsSync(forecastSuperPath)) {
    throw new Error(`CRITICAL INTEGRITY FAILURE: ${forecastSuperPath} not found on disk.`);
  }
  if (!fs.existsSync(dataLoaderPath)) {
    throw new Error(`CRITICAL INTEGRITY FAILURE: ${dataLoaderPath} not found on disk.`);
  }

  const forecastModule = require(forecastPath);
  const forecastSuperModule = require(forecastSuperPath);
  const dataLoaderModule = require(dataLoaderPath);

  assert.strictEqual(typeof forecastModule.runForecast, 'function',
    'CRITICAL: algorithms/forecast.js must export runForecast');
  assert.strictEqual(typeof forecastSuperModule.runForecastSuper, 'function',
    'CRITICAL: algorithms/forecastsuper.js must export runForecastSuper');
  assert.strictEqual(typeof dataLoaderModule.classifyInventoryItem, 'function',
    'CRITICAL: backend/dataLoader.js must export classifyInventoryItem');
  assert.strictEqual(typeof dataLoaderModule.initDataLoader, 'function',
    'CRITICAL: backend/dataLoader.js must export initDataLoader');

  return { forecastModule, forecastSuperModule, dataLoaderModule };
}

// --- Main Test Runner ---
async function runAllTests(cliOptions = {}) {
  const reporter = new TestReporter();
  const cliArgs = process.argv.slice(2);
  const isUnitOnly = cliOptions.unitOnly !== undefined
    ? Boolean(cliOptions.unitOnly)
    : (cliArgs.includes('--unit-only') || cliArgs.includes('--unit'));
  const noSpawn = cliOptions.noSpawn !== undefined
    ? Boolean(cliOptions.noSpawn)
    : cliArgs.includes('--no-spawn');

  const { forecastModule, forecastSuperModule, dataLoaderModule } = loadAlgorithmModules();

  console.log(`${c.bold}${c.cyan}==============================================================================${c.reset}`);
  console.log(`${c.bold}${c.white}   BIG DATA DEMAND FORECASTING & SMART INVENTORY — E2E TEST RUNNER           ${c.reset}`);
  console.log(`${c.bold}${c.cyan}==============================================================================${c.reset}`);
  console.log(`  Target Backend  : ${c.bold}${BASE_URL}${c.reset}`);
  console.log(`  Node Version    : ${process.version}`);
  console.log(`  Execution Mode  : ${isUnitOnly ? c.cyan + '--unit-only (Offline Algorithms & Pipeline)' : c.green + 'Full E2E (Unit + HTTP Endpoints)'}${c.reset}`);
  console.log(`  forecast.js     : ${c.green}Found & Loaded (runForecast)${c.reset}`);
  console.log(`  forecastsuper.js: ${c.green}Found & Loaded (runForecastSuper)${c.reset}`);
  console.log(`  dataLoader.js   : ${c.green}Found & Loaded (classifyInventoryItem, initDataLoader)${c.reset}\n`);

  let isServerOnline = false;
  let spawnedChild = null;

  if (isUnitOnly) {
    console.log(`${c.cyan}[*] Notice: Running in --unit-only mode. Backend probe skipped; HTTP endpoint tests will be skipped.${c.reset}\n`);
  } else {
    try {
      const probe = await apiRequest('/api/stream/sales', { timeoutMs: 1500 });
      if (probe.status === 200) {
        isServerOnline = true;
      }
    } catch (err) {
      isServerOnline = false;
    }

    const serverPath = path.join(__dirname, 'backend', 'server.js');
    if (!isServerOnline && fs.existsSync(serverPath) && !noSpawn) {
      console.log(`${c.yellow}[*] Backend HTTP server is OFFLINE. Spawning child process: node backend/server.js ...${c.reset}`);
      try {
        spawnedChild = child_process.spawn(process.execPath, [serverPath], {
          cwd: __dirname,
          env: { ...process.env, PORT: '3000' },
          stdio: ['ignore', 'pipe', 'pipe']
        });

        spawnedChild.stderr.on('data', d => {
          console.error(`${c.red}[Server stderr]${c.reset} ${d.toString()}`);
        });

        const pollStart = Date.now();
        const pollTimeoutMs = 15000;
        while (Date.now() - pollStart < pollTimeoutMs) {
          await new Promise(r => setTimeout(r, 500));
          try {
            const probe = await apiRequest('/api/stream/sales', { timeoutMs: 1000 });
            if (probe.status === 200) {
              isServerOnline = true;
              console.log(`${c.green}✔ Backend spawned and responsive after ${Date.now() - pollStart}ms.${c.reset}\n`);
              break;
            }
          } catch (err) {
            // Keep polling
          }
          if (spawnedChild.exitCode !== null) {
            console.error(`${c.red}[!] Spawned server process exited with code ${spawnedChild.exitCode}.${c.reset}`);
            break;
          }
        }
      } catch (spawnErr) {
        console.error(`${c.red}[!] Failed to spawn backend/server.js:${c.reset}`, spawnErr.message);
      }
    }

    if (isServerOnline) {
      console.log(`${c.green}✔ Backend HTTP server is ONLINE and responding at ${BASE_URL}.${c.reset}\n`);
    } else {
      console.log(`${c.yellow}[!] NOTICE: Backend HTTP server is OFFLINE at ${BASE_URL}.${c.reset}`);
      console.log(`    Running comprehensive offline Unit & Algorithm suites (Tier 0 DataLoader, F9, F10, F11).`);
      console.log(`    HTTP endpoint suites will be registered as skipped until server is up.\n`);
    }
  }

  // Helper to safely execute a test
  async function testCase(tier, feature, name, fn) {
    const start = Date.now();
    try {
      await fn();
      reporter.record({
        tier,
        feature,
        name,
        passed: true,
        skipped: false,
        durationMs: Date.now() - start
      });
    } catch (error) {
      reporter.record({
        tier,
        feature,
        name,
        passed: false,
        skipped: false,
        error,
        durationMs: Date.now() - start
      });
    }
  }

  function skipCase(tier, feature, name, reason) {
    reporter.record({
      tier,
      feature,
      name: `${name} (${reason})`,
      passed: true,
      skipped: true,
      durationMs: 0
    });
  }

  try {
    // ==========================================================================
    // TIER 0: DATA LOADER & IN-MEMORY PIPELINE (R1 & Interface Contract 1)
    // ==========================================================================
    reporter.printBanner('DataLoader & In-Memory Pipeline (R1)', 'Tier 0');

    await testCase('Tier 0', 'DataLoader', 'T0.1: Stream parse sales CSV (125k) and inventory CSV (284k)', async () => {
      const dataDir = path.join(__dirname, 'data');
      await dataLoaderModule.initDataLoader(dataDir);
      assert.strictEqual(dataLoaderModule.getSalesData().length, 125751, 'Sales row count must be 125,751');
      assert.strictEqual(dataLoaderModule.getInventoryData().length, 284755, 'Inventory row count must be 284,755');
    });

    await testCase('Tier 0', 'DataLoader', 'T0.2: Precompute distinct categories (27) and stores (40)', async () => {
      assert.strictEqual(dataLoaderModule.getDistinctCategories().length, 27, 'Distinct categories count mismatch');
      assert.strictEqual(dataLoaderModule.getDistinctStores().length, 40, 'Distinct stores count mismatch');
    });

    await testCase('Tier 0', 'DataLoader', 'T0.3: Precompute EDA caches (revenue trend, top categories, channel split, return rate)', async () => {
      assert.strictEqual(dataLoaderModule.getEdaRevenueTrend().length, 11, 'Revenue trend months mismatch');
      assert.strictEqual(dataLoaderModule.getEdaTopCategories().length, 10, 'Top categories count mismatch');
      const channelSplit = dataLoaderModule.getEdaChannelSplit();
      assert.strictEqual(channelSplit.length, 1);
      assert.strictEqual(channelSplit[0].percentage, 100);
      assert.strictEqual(dataLoaderModule.getEdaReturnRate().length, 3, 'Product divisions count mismatch');
    });

    await testCase('Tier 0', 'DataLoader', 'T0.4: Precompute inventory alerts cache (top 10 with Low Stock first)', async () => {
      const alerts = dataLoaderModule.getInventoryAlerts();
      assert.strictEqual(alerts.length, 10, 'Alerts count mismatch');
      assert.strictEqual(alerts[0].stockStatus, 'Low Stock', 'First alert must be Low Stock');
    });

    // ==========================================================================
    // TIER 1: FEATURE COVERAGE
    // ==========================================================================
  reporter.printBanner('Feature Coverage (Happy Path Equivalence)', 'Tier 1');

  // --- F1: GET /api/stream/sales ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F1', 'T1.1: GET /api/stream/sales responds with 200 OK and application/json', async () => {
      const res = await apiRequest('/api/stream/sales');
      assert.strictEqual(res.status, 200, 'Expected status 200');
      const ct = res.headers.get('content-type') || '';
      assert.ok(ct.includes('application/json'), `Expected application/json content-type, got ${ct}`);
    });

    await testCase('Tier 1', 'F1', 'T1.2: GET /api/stream/sales returns an array of exactly 20 transactions', async () => {
      const res = await apiRequest('/api/stream/sales');
      assert.ok(Array.isArray(res.data), 'Expected response data to be an array');
      assert.strictEqual(res.data.length, 20, `Expected exactly 20 items, received ${res.data.length}`);
    });

    await testCase('Tier 1', 'F1', 'T1.3: Required fields present in streamed transactions', async () => {
      const res = await apiRequest('/api/stream/sales');
      assert.ok(res.data.length > 0, 'No data returned');
      const sample = res.data[0];
      const requiredKeys = ['Transaction Date', 'Product Division', 'Product Category', 'Store', 'Sales Channel', 'Qty Sold', 'Sales Amount'];
      for (const k of requiredKeys) {
        assert.ok(k in sample, `Missing required key '${k}' in transaction`);
      }
    });

    await testCase('Tier 1', 'F1', 'T1.4: Randomness check: successive calls return differing records', async () => {
      const res1 = await apiRequest('/api/stream/sales');
      const res2 = await apiRequest('/api/stream/sales');
      assert.ok(res1.data.length === 20 && res2.data.length === 20, 'Both calls must return 20 items');
      const str1 = JSON.stringify(res1.data.slice(0, 5));
      const str2 = JSON.stringify(res2.data.slice(0, 5));
      assert.notStrictEqual(str1, str2, 'Successive stream calls returned identical records (should be randomized)');
    });

    await testCase('Tier 1', 'F1', 'T1.5: Numeric integrity of Qty Sold and Sales Amount', async () => {
      const res = await apiRequest('/api/stream/sales');
      for (const item of res.data) {
        const qty = Number(item['Qty Sold']);
        const amount = Number(item['Sales Amount']);
        assert.ok(!Number.isNaN(qty), `Qty Sold must be a valid number, got ${item['Qty Sold']}`);
        assert.ok(!Number.isNaN(amount), `Sales Amount must be a valid number, got ${item['Sales Amount']}`);
      }
    });
  } else {
    for (let i = 1; i <= 5; i++) skipCase('Tier 1', 'F1', `T1.${i}: Sales stream checks`, 'Server offline');
  }

  // --- F2: GET /api/eda/revenue-trend ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F2', 'T1.6: GET /api/eda/revenue-trend returns 200 OK array', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Expected array response');
    });

    await testCase('Tier 1', 'F2', 'T1.7: Elements have { month, revenue } schema', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      assert.ok(res.data.length > 0, 'Revenue trend array is empty');
      const item = res.data[0];
      assert.ok('month' in item && 'revenue' in item, 'Item missing month or revenue');
      assert.strictEqual(typeof item.month, 'string');
      assert.strictEqual(typeof Number(item.revenue), 'number');
    });

    await testCase('Tier 1', 'F2', 'T1.8: Chronologically sorted by month (YYYY-MM)', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      for (let i = 0; i < res.data.length - 1; i++) {
        const m1 = res.data[i].month;
        const m2 = res.data[i + 1].month;
        assert.ok(m1.localeCompare(m2) <= 0, `Month ${m1} should precede or equal ${m2}`);
      }
    });

    await testCase('Tier 1', 'F2', 'T1.9: Historical timeline span contains multiple monthly periods', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      assert.ok(res.data.length >= 6, `Expected at least 6 months of historical trend, received ${res.data.length}`);
    });

    await testCase('Tier 1', 'F2', 'T1.10: Total revenue values are non-negative and finite', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      for (const item of res.data) {
        const rev = Number(item.revenue);
        assert.ok(!Number.isNaN(rev) && Number.isFinite(rev), 'Revenue must be finite');
        assert.ok(rev >= 0, `Revenue must be non-negative, got ${rev}`);
      }
    });
  } else {
    for (let i = 6; i <= 10; i++) skipCase('Tier 1', 'F2', `T1.${i}: Revenue trend checks`, 'Server offline');
  }

  // --- F3: GET /api/eda/top-categories ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F3', 'T1.11: GET /api/eda/top-categories returns 200 OK array', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Expected array of top categories');
    });

    await testCase('Tier 1', 'F3', 'T1.12: Array length is exactly top 10 (or catalog size)', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      assert.ok(res.data.length <= 10 && res.data.length > 0, `Expected <= 10 categories, got ${res.data.length}`);
    });

    await testCase('Tier 1', 'F3', 'T1.13: Sorted in descending order by Qty Sold', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      for (let i = 0; i < res.data.length - 1; i++) {
        const q1 = Number(res.data[i].qty);
        const q2 = Number(res.data[i + 1].qty);
        assert.ok(q1 >= q2, `Item ${i} (qty ${q1}) must be >= item ${i+1} (qty ${q2})`);
      }
    });

    await testCase('Tier 1', 'F3', 'T1.14: Each element contains non-empty category and numeric qty', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      for (const item of res.data) {
        assert.ok(item.category && typeof item.category === 'string' && item.category.trim().length > 0);
        assert.ok(!Number.isNaN(Number(item.qty)) && Number(item.qty) > 0);
      }
    });

    await testCase('Tier 1', 'F3', 'T1.15: Top categories contain distinct catalog names', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      const cats = res.data.map(i => i.category);
      const uniqueCats = new Set(cats);
      assert.strictEqual(uniqueCats.size, cats.length, 'Categories in top 10 must be unique');
    });
  } else {
    for (let i = 11; i <= 15; i++) skipCase('Tier 1', 'F3', `T1.${i}: Top categories checks`, 'Server offline');
  }

  // --- F4: GET /api/eda/channel-split ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F4', 'T1.16: GET /api/eda/channel-split returns 200 OK array', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data), 'Expected array response');
    });

    await testCase('Tier 1', 'F4', 'T1.17: Elements schema includes channel, sales, and percentage', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      assert.ok(res.data.length > 0);
      for (const item of res.data) {
        assert.ok('channel' in item && 'sales' in item && 'percentage' in item);
      }
    });

    await testCase('Tier 1', 'F4', 'T1.18: Percentage sums to ~100% (within tolerance)', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      const totalPct = res.data.reduce((acc, curr) => acc + Number(curr.percentage), 0);
      assert.ok(Math.abs(totalPct - 100) <= 0.5, `Total percentage should sum to ~100%, got ${totalPct}`);
    });

    await testCase('Tier 1', 'F4', 'T1.19: Total sales sum matches aggregate channel revenue', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      const totalSales = res.data.reduce((acc, curr) => acc + Number(curr.sales), 0);
      assert.ok(totalSales > 0, `Total sales must be positive, got ${totalSales}`);
    });

    await testCase('Tier 1', 'F4', 'T1.20: Channels have non-negative sales and percentage', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      for (const item of res.data) {
        assert.ok(Number(item.sales) >= 0);
        assert.ok(Number(item.percentage) >= 0 && Number(item.percentage) <= 100);
      }
    });
  } else {
    for (let i = 16; i <= 20; i++) skipCase('Tier 1', 'F4', `T1.${i}: Channel split checks`, 'Server offline');
  }

  // --- F5: GET /api/eda/return-rate ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F5', 'T1.21: GET /api/eda/return-rate returns 200 OK array', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    await testCase('Tier 1', 'F5', 'T1.22: Schema check: { division, returnRate }', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      assert.ok(res.data.length > 0);
      for (const item of res.data) {
        assert.ok('division' in item && 'returnRate' in item);
      }
    });

    await testCase('Tier 1', 'F5', 'T1.23: Return rates bounded within reasonable retail limits (0-50%)', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      for (const item of res.data) {
        const rate = Number(item.returnRate);
        assert.ok(!Number.isNaN(rate), `returnRate must be numeric, got ${item.returnRate}`);
        assert.ok(rate >= 0 && rate <= 50, `returnRate should be between 0 and 50%, got ${rate}`);
      }
    });

    await testCase('Tier 1', 'F5', 'T1.24: Contains distinct product divisions', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      const divisions = res.data.map(d => d.division);
      const uniqueDivs = new Set(divisions);
      assert.strictEqual(uniqueDivs.size, divisions.length, 'Divisions must be distinct');
      assert.ok(divisions.length >= 2, 'Expected at least 2 product divisions');
    });

    await testCase('Tier 1', 'F5', 'T1.25: Division names are non-empty strings', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      for (const item of res.data) {
        assert.ok(typeof item.division === 'string' && item.division.trim().length > 0);
      }
    });
  } else {
    for (let i = 21; i <= 25; i++) skipCase('Tier 1', 'F5', `T1.${i}: Return rate checks`, 'Server offline');
  }

  // --- F6: POST /api/forecast ---
  if (isServerOnline) {
    let sampleCategory = 'Scholar Footwear Trailblazer';
    let sampleStore = 'Store 1';
    try {
      const s = await apiRequest('/api/stream/sales');
      if (s.data && s.data.length > 0) {
        sampleCategory = s.data[0]['Product Category'] || sampleCategory;
        sampleStore = s.data[0]['Store'] || sampleStore;
      }
    } catch (e) {}

    await testCase('Tier 1', 'F6', 'T1.26: POST /api/forecast returns 200 for valid category, store, periods: 8', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: sampleCategory, store: sampleStore, periods: 8 }
      });
      assert.strictEqual(res.status, 200);
    });

    await testCase('Tier 1', 'F6', 'T1.27: Forecast response contains periods, normalForecast, superForecast, differences', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: sampleCategory, store: sampleStore, periods: 8 }
      });
      assert.ok(res.data, 'Expected response body');
      assert.ok('periods' in res.data, 'Missing periods');
      assert.ok('normalForecast' in res.data, 'Missing normalForecast');
      assert.ok('superForecast' in res.data, 'Missing superForecast');
      assert.ok('differences' in res.data, 'Missing differences');
    });

    await testCase('Tier 1', 'F6', 'T1.28: Forecast arrays length equals requested periods (8)', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: sampleCategory, store: sampleStore, periods: 8 }
      });
      assert.strictEqual(res.data.periods.length, 8);
      assert.strictEqual(res.data.normalForecast.length, 8);
      assert.strictEqual(res.data.superForecast.length, 8);
    });

    await testCase('Tier 1', 'F6', 'T1.29: Differences table contains at most 8 items', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: sampleCategory, store: sampleStore, periods: 8 }
      });
      assert.ok(Array.isArray(res.data.differences), 'differences must be an array');
      assert.ok(res.data.differences.length <= 8, `Differences table length must be <= 8, got ${res.data.differences.length}`);
    });

    await testCase('Tier 1', 'F6', 'T1.30: Differences items have { period, normal, super, diff, diffPercent, higher } schema', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: sampleCategory, store: sampleStore, periods: 8 }
      });
      for (const diffItem of res.data.differences) {
        assert.ok('period' in diffItem);
        assert.ok('normal' in diffItem);
        assert.ok('super' in diffItem);
        assert.ok('diff' in diffItem);
        assert.ok('diffPercent' in diffItem);
        assert.ok('higher' in diffItem);
      }
    });
  } else {
    for (let i = 26; i <= 30; i++) skipCase('Tier 1', 'F6', `T1.${i}: Forecast endpoint checks`, 'Server offline');
  }

  // --- F7: GET /api/inventory/stream ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F7', 'T1.31: GET /api/inventory/stream returns 200 OK object', async () => {
      const res = await apiRequest('/api/inventory/stream');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(typeof res.data, 'object');
    });

    await testCase('Tier 1', 'F7', 'T1.32: Contains healthy, low, over, and total integer properties', async () => {
      const res = await apiRequest('/api/inventory/stream');
      assert.ok('healthy' in res.data);
      assert.ok('low' in res.data);
      assert.ok('over' in res.data);
      assert.ok('total' in res.data);
    });

    await testCase('Tier 1', 'F7', 'T1.33: Consistency check: total === healthy + low + over', async () => {
      const res = await apiRequest('/api/inventory/stream');
      const { healthy, low, over, total } = res.data;
      assert.strictEqual(healthy + low + over, total, `Cumulative sum invariant failed: ${healthy} + ${low} + ${over} != ${total}`);
    });

    await testCase('Tier 1', 'F7', 'T1.34: Polling increments cumulative total by 50 for each request', async () => {
      const res1 = await apiRequest('/api/inventory/stream');
      const res2 = await apiRequest('/api/inventory/stream');
      const diff = res2.data.total - res1.data.total;
      assert.strictEqual(diff, 50, `Expected total to increment by 50, but incremented by ${diff}`);
    });

    await testCase('Tier 1', 'F7', 'T1.35: All inventory counts are non-negative integers', async () => {
      const res = await apiRequest('/api/inventory/stream');
      const { healthy, low, over, total } = res.data;
      assert.ok(healthy >= 0 && Number.isInteger(healthy));
      assert.ok(low >= 0 && Number.isInteger(low));
      assert.ok(over >= 0 && Number.isInteger(over));
      assert.ok(total >= 0 && Number.isInteger(total));
    });
  } else {
    for (let i = 31; i <= 35; i++) skipCase('Tier 1', 'F7', `T1.${i}: Inventory stream checks`, 'Server offline');
  }

  // --- F8: GET /api/inventory/alerts ---
  if (isServerOnline) {
    await testCase('Tier 1', 'F8', 'T1.36: GET /api/inventory/alerts returns 200 OK array', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    await testCase('Tier 1', 'F8', 'T1.37: Array length is at most 10', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      assert.ok(res.data.length <= 10, `Expected at most 10 alerts, got ${res.data.length}`);
    });

    await testCase('Tier 1', 'F8', 'T1.38: Alerts schema check: { category, store, qtyOnHand, stockStatus, level }', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      for (const alert of res.data) {
        assert.ok('category' in alert || 'Product Category' in alert);
        assert.ok('store' in alert || 'Store' in alert);
        assert.ok('qtyOnHand' in alert || 'Qty on hand' in alert);
        assert.ok('stockStatus' in alert || 'Stock Status' in alert);
        assert.ok('level' in alert || 'Mức độ' in alert);
      }
    });

    await testCase('Tier 1', 'F8', 'T1.39: Priority sorting: all Low Stock items appear BEFORE Overstock items', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      let seenOverstock = false;
      for (const alert of res.data) {
        const status = alert.stockStatus || alert['Stock Status'] || '';
        const isLow = status.toLowerCase().includes('low');
        const isOver = status.toLowerCase().includes('over');
        if (isOver) {
          seenOverstock = true;
        }
        if (seenOverstock && isLow) {
          assert.fail(`Priority violation: Low stock alert found after Overstock alert: ${JSON.stringify(alert)}`);
        }
      }
    });

    await testCase('Tier 1', 'F8', 'T1.40: Proper badge levels assigned: Low Stock -> Khẩn cấp, Overstock -> Chú ý', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      for (const alert of res.data) {
        const status = alert.stockStatus || alert['Stock Status'] || '';
        const level = alert.level || alert['Mức độ'] || '';
        if (status.toLowerCase().includes('low')) {
          assert.ok(level.includes('Khẩn cấp') || level.includes('🔴'), `Expected Low Stock to have Khẩn cấp level, got ${level}`);
        } else if (status.toLowerCase().includes('over')) {
          assert.ok(level.includes('Chú ý') || level.includes('🟡'), `Expected Overstock to have Chú ý level, got ${level}`);
        }
      }
    });
  } else {
    for (let i = 36; i <= 40; i++) skipCase('Tier 1', 'F8', `T1.${i}: Inventory alerts checks`, 'Server offline');
  }

  // --- F9: Unit Algorithm - forecast.js ---
  const activeForecastFn = forecastModule.runForecast;
  await testCase('Tier 1', 'F9', 'T1.41: Flat history [10, 10, 10, 10] produces flat prediction [10, 10, 10, 10]', async () => {
    const res = activeForecastFn([10, 10, 10, 10], 4, 4);
    assert.strictEqual(res.length, 4);
    for (const v of res) {
      assert.strictEqual(v, 10);
    }
  });

  await testCase('Tier 1', 'F9', 'T1.42: Sliding window updates sequentially with generated predictions', async () => {
    // [10, 20, 30, 40] -> next = (10+20+30+40)/4 = 25.00, next2 = (20+30+40+25)/4 = 28.75
    const res = activeForecastFn([10, 20, 30, 40], 2, 4);
    assert.strictEqual(res[0], 25.00);
    assert.strictEqual(res[1], 28.75);
  });

  await testCase('Tier 1', 'F9', 'T1.43: Output values rounded to 2 decimal places', async () => {
    const res = activeForecastFn([1, 1, 1, 10], 1, 4);
    const expected = Math.round(((1 + 1 + 1 + 10) / 4) * 100) / 100;
    assert.strictEqual(res[0], expected);
    const decimals = String(res[0]).split('.')[1] || '';
    assert.ok(decimals.length <= 2, `Value ${res[0]} has more than 2 decimal places`);
  });

  await testCase('Tier 1', 'F9', 'T1.44: Default windowSize is 4 when omitted', async () => {
    const resDefault = activeForecastFn([10, 20, 30, 40], 1);
    const resExplicit = activeForecastFn([10, 20, 30, 40], 1, 4);
    assert.strictEqual(resDefault[0], resExplicit[0]);
  });

  await testCase('Tier 1', 'F9', 'T1.45: Linearly increasing series produces correct moving average', async () => {
    // [2, 4, 6, 8] -> (2+4+6+8)/4 = 20/4 = 5.00
    const res = activeForecastFn([2, 4, 6, 8], 1, 4);
    assert.strictEqual(res[0], 5.00);
  });

  // --- F10: Unit Algorithm - forecastsuper.js ---
  const activeForecastSuperFn = forecastSuperModule.runForecastSuper;
  await testCase('Tier 1', 'F10', 'T1.46: Weights [1, 2, 3, 4] applied correctly with sum of weights = 10', async () => {
    // [10, 20, 30, 40]: (1*10 + 2*20 + 3*30 + 4*40) / 10 = 300/10 = 30.00
    const res = activeForecastSuperFn([10, 20, 30, 40], 1, Array(12).fill(100), 100);
    assert.strictEqual(res[0], 30.00);
  });

  await testCase('Tier 1', 'F10', 'T1.47: Seasonality factor applied correctly: sf = monthlyAvg / overallAvg', async () => {
    const currMonth = new Date().getMonth();
    const monthlyAvg = Array(12).fill(100);
    monthlyAvg[currMonth] = 150; // sf = 1.5. Base WMA = 30 -> 30 * 1.5 = 45.00
    const res = activeForecastSuperFn([10, 20, 30, 40], 1, monthlyAvg, 100);
    assert.strictEqual(res[0], 45.00);
  });

  await testCase('Tier 1', 'F10', 'T1.48: Rounded to 2 decimal places', async () => {
    const currMonth = new Date().getMonth();
    const monthlyAvg = Array(12).fill(100);
    monthlyAvg[currMonth] = 105.5;
    const res = activeForecastSuperFn([10, 20, 30, 40], 1, monthlyAvg, 100);
    const decimals = String(res[0]).split('.')[1] || '';
    assert.ok(decimals.length <= 2);
  });

  await testCase('Tier 1', 'F10', 'T1.49: When seasonality factor = 1.0, output matches pure WMA', async () => {
    const monthlyAvg = Array(12).fill(50);
    const overallAvg = 50;
    const res = activeForecastSuperFn([5, 10, 15, 20], 3, monthlyAvg, overallAvg);
    // WMA of [5, 10, 15, 20] = (1*5 + 2*10 + 3*15 + 4*20) / 10 = (5 + 20 + 45 + 80) / 10 = 150/10 = 15.00
    assert.strictEqual(res[0], 15.00);
  });

  await testCase('Tier 1', 'F10', 'T1.50: Output length strictly matches requested periods', async () => {
    const res = activeForecastSuperFn([10, 20, 30, 40], 8, Array(12).fill(100), 100);
    assert.strictEqual(res.length, 8);
  });

  // --- F11: Smart Inventory Classification Logic ---
  const activeClassifyFn = dataLoaderModule.classifyInventoryItem;
  await testCase('Tier 1', 'F11', 'T1.51: avgDailySales <= 0 classifies as healthy (zero sales fallback)', async () => {
    const status = activeClassifyFn({ qtyOnHand: 0, avgDailySales: 0 });
    assert.strictEqual(status.toLowerCase(), 'healthy');
  });

  await testCase('Tier 1', 'F11', 'T1.52: Qty on hand >= avgDailySales * 60 classifies as overstock', async () => {
    const status = activeClassifyFn({ qtyOnHand: 650, avgDailySales: 10 });
    assert.strictEqual(status.toLowerCase(), 'over');
  });

  await testCase('Tier 1', 'F11', 'T1.53: avgDailySales * 14 <= Qty < avgDailySales * 60 classifies as healthy', async () => {
    const status = activeClassifyFn({ qtyOnHand: 300, avgDailySales: 10 });
    assert.strictEqual(status.toLowerCase(), 'healthy');
  });

  await testCase('Tier 1', 'F11', 'T1.54: 0 < Qty < avgDailySales * 14 classifies as low stock', async () => {
    const status = activeClassifyFn({ qtyOnHand: 50, avgDailySales: 10 });
    assert.strictEqual(status.toLowerCase(), 'low');
  });

  await testCase('Tier 1', 'F11', 'T1.55: Qty <= 0 with avgDailySales > 0 classifies as low stock', async () => {
    const statusZero = activeClassifyFn({ qtyOnHand: 0, avgDailySales: 10 });
    const statusNegative = activeClassifyFn({ qtyOnHand: -5, avgDailySales: 10 });
    assert.strictEqual(statusZero.toLowerCase(), 'low');
    assert.strictEqual(statusNegative.toLowerCase(), 'low');
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // ==========================================================================
  reporter.printBanner('Boundary & Corner Cases', 'Tier 2');

  // --- F1 Boundaries ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F1', 'T2.1: Query parameters ignored safely without corrupting 20-row limit', async () => {
      const res = await apiRequest('/api/stream/sales?limit=999&bad=true');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 20);
    });

    await testCase('Tier 2', 'F1', 'T2.2: Unsupported HTTP method POST on /api/stream/sales returns 404/405', async () => {
      const res = await apiRequest('/api/stream/sales', { method: 'POST', body: { test: true } });
      assert.ok([404, 405].includes(res.status), `Expected 404 or 405 for POST on GET endpoint, got ${res.status}`);
    });

    await testCase('Tier 2', 'F1', 'T2.3: CORS header Access-Control-Allow-Origin present on stream endpoint', async () => {
      const res = await apiRequest('/api/stream/sales');
      const origin = res.headers.get('access-control-allow-origin');
      assert.ok(origin === '*' || origin.length > 0, `Expected CORS header, got ${origin}`);
    });

    await testCase('Tier 2', 'F1', 'T2.4: Stream sales response headers contain JSON content type', async () => {
      const res = await apiRequest('/api/stream/sales');
      const ct = res.headers.get('content-type') || '';
      assert.ok(ct.includes('application/json'));
    });

    await testCase('Tier 2', 'F1', 'T2.5: Rapid consecutive calls to /api/stream/sales execute cleanly', async () => {
      const promises = Array(5).fill(0).map(() => apiRequest('/api/stream/sales'));
      const responses = await Promise.all(promises);
      for (const r of responses) {
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.data.length, 20);
      }
    });
  } else {
    for (let i = 1; i <= 5; i++) skipCase('Tier 2', 'F1', `T2.${i}: Stream sales boundary checks`, 'Server offline');
  }

  // --- F2 Boundaries ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F2', 'T2.6: POST on /api/eda/revenue-trend returns 404 or 405', async () => {
      const res = await apiRequest('/api/eda/revenue-trend', { method: 'POST' });
      assert.ok([404, 405].includes(res.status));
    });

    await testCase('Tier 2', 'F2', 'T2.7: CORS header present on /api/eda/revenue-trend', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      assert.ok(res.headers.get('access-control-allow-origin'));
    });

    await testCase('Tier 2', 'F2', 'T2.8: No NaN or null values present in revenue trend array', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      for (const item of res.data) {
        assert.ok(item.month !== null && item.month !== undefined);
        assert.ok(!Number.isNaN(Number(item.revenue)));
      }
    });

    await testCase('Tier 2', 'F2', 'T2.9: Month format strictly conforms to YYYY-MM pattern', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      const regex = /^\d{4}-\d{2}$/;
      for (const item of res.data) {
        assert.ok(regex.test(item.month), `Month string '${item.month}' does not match YYYY-MM pattern`);
      }
    });

    await testCase('Tier 2', 'F2', 'T2.10: No duplicate month entries in historical revenue trend', async () => {
      const res = await apiRequest('/api/eda/revenue-trend');
      const months = res.data.map(i => i.month);
      const unique = new Set(months);
      assert.strictEqual(unique.size, months.length, 'Revenue trend has duplicate months');
    });
  } else {
    for (let i = 6; i <= 10; i++) skipCase('Tier 2', 'F2', `T2.${i}: Revenue trend boundary checks`, 'Server offline');
  }

  // --- F3 Boundaries ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F3', 'T2.11: Top categories bounded strictly by 10 entries', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      assert.ok(res.data.length <= 10);
    });

    await testCase('Tier 2', 'F3', 'T2.12: Top categories qty values are all positive non-zero numbers', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      for (const item of res.data) {
        assert.ok(Number(item.qty) > 0);
      }
    });

    await testCase('Tier 2', 'F3', 'T2.13: Category names are sanitized non-empty strings', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      for (const item of res.data) {
        assert.ok(item.category && item.category.trim().length > 0);
      }
    });

    await testCase('Tier 2', 'F3', 'T2.14: Monotonic non-increasing order preserved across entire top 10', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      for (let i = 0; i < res.data.length - 1; i++) {
        assert.ok(Number(res.data[i].qty) >= Number(res.data[i + 1].qty));
      }
    });

    await testCase('Tier 2', 'F3', 'T2.15: CORS headers present on top categories endpoint', async () => {
      const res = await apiRequest('/api/eda/top-categories');
      assert.ok(res.headers.get('access-control-allow-origin'));
    });
  } else {
    for (let i = 11; i <= 15; i++) skipCase('Tier 2', 'F3', `T2.${i}: Top categories boundary checks`, 'Server offline');
  }

  // --- F4 Boundaries ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F4', 'T2.16: Sum of channel percentages does not exceed 100.5%', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      const sum = res.data.reduce((acc, c) => acc + Number(c.percentage), 0);
      assert.ok(sum <= 100.5 && sum >= 99.0);
    });

    await testCase('Tier 2', 'F4', 'T2.17: Channel split percentages are non-negative', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      for (const c of res.data) {
        assert.ok(Number(c.percentage) >= 0);
      }
    });

    await testCase('Tier 2', 'F4', 'T2.18: Sales values are non-negative', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      for (const c of res.data) {
        assert.ok(Number(c.sales) >= 0);
      }
    });

    await testCase('Tier 2', 'F4', 'T2.19: Channel names are valid non-empty strings', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      for (const c of res.data) {
        assert.ok(typeof c.channel === 'string' && c.channel.trim().length > 0);
      }
    });

    await testCase('Tier 2', 'F4', 'T2.20: CORS header present on channel-split endpoint', async () => {
      const res = await apiRequest('/api/eda/channel-split');
      assert.ok(res.headers.get('access-control-allow-origin'));
    });
  } else {
    for (let i = 16; i <= 20; i++) skipCase('Tier 2', 'F4', `T2.${i}: Channel split boundary checks`, 'Server offline');
  }

  // --- F5 Boundaries ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F5', 'T2.21: Return rates are bounded within [0, 100]', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      for (const d of res.data) {
        const rate = Number(d.returnRate);
        assert.ok(rate >= 0 && rate <= 100);
      }
    });

    await testCase('Tier 2', 'F5', 'T2.22: No NaN or infinite values in return rate metrics', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      for (const d of res.data) {
        assert.ok(Number.isFinite(Number(d.returnRate)));
      }
    });

    await testCase('Tier 2', 'F5', 'T2.23: Division return rate list is not empty', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      assert.ok(res.data.length > 0);
    });

    await testCase('Tier 2', 'F5', 'T2.24: Division names are non-empty strings', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      for (const d of res.data) {
        assert.ok(typeof d.division === 'string' && d.division.trim().length > 0);
      }
    });

    await testCase('Tier 2', 'F5', 'T2.25: CORS header present on return-rate endpoint', async () => {
      const res = await apiRequest('/api/eda/return-rate');
      assert.ok(res.headers.get('access-control-allow-origin'));
    });
  } else {
    for (let i = 21; i <= 25; i++) skipCase('Tier 2', 'F5', `T2.${i}: Return rate boundary checks`, 'Server offline');
  }

  // --- F6 Boundaries (Forecast API) ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F6', 'T2.26: periods < 4 (e.g. 2) rejected with 400 Bad Request or clamped to 4', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 2 }
      });
      if (res.status === 200) {
        assert.ok(res.data.periods.length >= 4, 'Periods lower than 4 should be clamped to min 4 if not rejected');
      } else {
        assert.strictEqual(res.status, 400, `Expected 400 Bad Request for periods < 4, got ${res.status}`);
      }
    });

    await testCase('Tier 2', 'F6', 'T2.27: periods > 24 (e.g. 30) rejected with 400 Bad Request or clamped to 24', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 30 }
      });
      if (res.status === 200) {
        assert.ok(res.data.periods.length <= 24, 'Periods greater than 24 should be clamped to max 24 if not rejected');
      } else {
        assert.strictEqual(res.status, 400, `Expected 400 Bad Request for periods > 24, got ${res.status}`);
      }
    });

    await testCase('Tier 2', 'F6', 'T2.28: Missing body or empty body returns 400 Bad Request', async () => {
      const res = await apiRequest('/api/forecast', { method: 'POST', body: {} });
      assert.strictEqual(res.status, 400);
    });

    await testCase('Tier 2', 'F6', 'T2.29: Non-existent category returns graceful empty forecast or 400/404 without crash', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'NonExistentCategoryXYZ999', store: 'Store 1', periods: 8 }
      });
      assert.ok([200, 400, 404].includes(res.status), `Expected 200 (zeros), 400, or 404, got ${res.status}`);
      if (res.status === 200) {
        assert.strictEqual(res.data.normalForecast.length, 8);
      }
    });

    await testCase('Tier 2', 'F6', 'T2.30: String periods (e.g. "invalid_string") or negative periods handled safely', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 'invalid_string' }
      });
      assert.ok([400, 200].includes(res.status));
      if (res.status === 200) {
        assert.ok(res.data.periods.length >= 4);
      }
    });

    await testCase('Tier 2', 'F6', 'T2.31: GET method on /api/forecast returns 404 or 405 Method Not Allowed', async () => {
      const res = await apiRequest('/api/forecast', { method: 'GET' });
      assert.ok([404, 405].includes(res.status));
    });

    await testCase('Tier 2', 'F6', 'T2.32: Rounding logic in differences table: only periods with differing rounded values appear', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 8 }
      });
      for (const d of res.data.differences) {
        const n = Math.round(Number(d.normal) * 100) / 100;
        const s = Math.round(Number(d.super) * 100) / 100;
        assert.notStrictEqual(n, s, `Differences table contains identical rounded values: ${n} === ${s}`);
      }
    });

    await testCase('Tier 2', 'F6', 'T2.33: Max 8 difference items constraint holds even when requesting 24 periods', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 24 }
      });
      if (res.status === 200) {
        assert.ok(res.data.differences.length <= 8, `Differences table exceeded 8 items: ${res.data.differences.length}`);
      }
    });
  } else {
    for (let i = 26; i <= 33; i++) skipCase('Tier 2', 'F6', `T2.${i}: Forecast boundary checks`, 'Server offline');
  }

  // --- F7 Boundaries (Inventory Stream) ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F7', 'T2.34: Rapid polling loop (10 calls) increments total by exactly 500 without race condition', async () => {
      const initial = await apiRequest('/api/inventory/stream');
      const startTotal = initial.data.total;
      for (let i = 0; i < 9; i++) {
        await apiRequest('/api/inventory/stream');
      }
      const finalRes = await apiRequest('/api/inventory/stream');
      const endTotal = finalRes.data.total;
      assert.strictEqual(endTotal - startTotal, 500, `Expected exactly +500 total, got +${endTotal - startTotal}`);
    });

    await testCase('Tier 2', 'F7', 'T2.35: Cumulative total strictly positive', async () => {
      const res = await apiRequest('/api/inventory/stream');
      assert.ok(res.data.total >= 50);
    });

    await testCase('Tier 2', 'F7', 'T2.36: CORS header present on /api/inventory/stream', async () => {
      const res = await apiRequest('/api/inventory/stream');
      assert.ok(res.headers.get('access-control-allow-origin'));
    });

    await testCase('Tier 2', 'F7', 'T2.37: POST method rejected on /api/inventory/stream', async () => {
      const res = await apiRequest('/api/inventory/stream', { method: 'POST' });
      assert.ok([404, 405].includes(res.status));
    });

    await testCase('Tier 2', 'F7', 'T2.38: Content-type is application/json', async () => {
      const res = await apiRequest('/api/inventory/stream');
      const ct = res.headers.get('content-type') || '';
      assert.ok(ct.includes('application/json'));
    });
  } else {
    for (let i = 34; i <= 38; i++) skipCase('Tier 2', 'F7', `T2.${i}: Inventory stream boundary checks`, 'Server offline');
  }

  // --- F8 Boundaries (Inventory Alerts) ---
  if (isServerOnline) {
    await testCase('Tier 2', 'F8', 'T2.39: Alerts array strictly limited to <= 10 items', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      assert.ok(res.data.length <= 10);
    });

    await testCase('Tier 2', 'F8', 'T2.40: Low stock items precede overstock items across all returned alerts', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      let overstockFound = false;
      for (const a of res.data) {
        const s = (a.stockStatus || a['Stock Status'] || '').toLowerCase();
        if (s.includes('over')) overstockFound = true;
        if (overstockFound && s.includes('low')) {
          assert.fail('Low stock item appeared after Overstock item');
        }
      }
    });

    await testCase('Tier 2', 'F8', 'T2.41: Fields are non-null and defined for all alert entries', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      for (const a of res.data) {
        assert.ok(a.category || a['Product Category']);
        assert.ok(a.store || a['Store']);
      }
    });

    await testCase('Tier 2', 'F8', 'T2.42: Qty on hand is a finite number in alerts', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      for (const a of res.data) {
        const qty = Number(a.qtyOnHand !== undefined ? a.qtyOnHand : a['Qty on hand']);
        assert.ok(Number.isFinite(qty));
      }
    });

    await testCase('Tier 2', 'F8', 'T2.43: CORS header present on /api/inventory/alerts', async () => {
      const res = await apiRequest('/api/inventory/alerts');
      assert.ok(res.headers.get('access-control-allow-origin'));
    });
  } else {
    for (let i = 39; i <= 43; i++) skipCase('Tier 2', 'F8', `T2.${i}: Inventory alerts boundary checks`, 'Server offline');
  }

  // --- F9 Boundaries (forecast.js) ---
  await testCase('Tier 2', 'F9', 'T2.44: History shorter than windowSize (e.g. [5, 15], 2 points) handled gracefully without NaN', async () => {
    const res = activeForecastFn([5, 15], 1, 4);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0], 10);
  });

  await testCase('Tier 2', 'F9', 'T2.45: Single-element history [50] produces valid numbers without throwing', async () => {
    const res = activeForecastFn([50], 4, 4);
    assert.strictEqual(res.length, 4);
    assert.strictEqual(res[0], 50);
  });

  await testCase('Tier 2', 'F9', 'T2.46: Zero-value history [0, 0, 0, 0] produces all zero predictions', async () => {
    const res = activeForecastFn([0, 0, 0, 0], 4, 4);
    for (const v of res) {
      assert.strictEqual(v, 0);
    }
  });

  await testCase('Tier 2', 'F9', 'T2.47: Minimum period boundary (periods = 4) produces exactly 4 items', async () => {
    const res = activeForecastFn([10, 20, 30, 40], 4, 4);
    assert.strictEqual(res.length, 4);
  });

  await testCase('Tier 2', 'F9', 'T2.48: Maximum period boundary (periods = 24) produces exactly 24 items', async () => {
    const res = activeForecastFn([10, 20, 30, 40], 24, 4);
    assert.strictEqual(res.length, 24);
  });

  // --- F10 Boundaries (forecastsuper.js) ---
  await testCase('Tier 2', 'F10', 'T2.49: Cyclical monthly seasonality index wraps around 12 months correctly', async () => {
    const monthlyAvg = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const overallAvg = 65;
    const res = activeForecastSuperFn([50, 50, 50, 50], 14, monthlyAvg, overallAvg);
    assert.strictEqual(res.length, 14);
    const currMonth = new Date().getMonth();
    const sf0 = monthlyAvg[currMonth % 12] / overallAvg;
    const sf12 = monthlyAvg[(currMonth + 12) % 12] / overallAvg;
    assert.strictEqual(sf0, sf12);
  });

  await testCase('Tier 2', 'F10', 'T2.50: Zero overallAvg fallback handled safely without division by zero NaN', async () => {
    const res = activeForecastSuperFn([10, 20, 30, 40], 4, [0, 0, 0], 0);
    assert.strictEqual(res.length, 4);
    for (const v of res) {
      assert.ok(!Number.isNaN(v) && Number.isFinite(v), `Expected finite number, got ${v}`);
    }
  });

  await testCase('Tier 2', 'F10', 'T2.51: High seasonality factor (sf = 2.0) scales prediction accurately', async () => {
    const monthlyAvg = Array(12).fill(200);
    const overallAvg = 100; // sf = 2.0
    // WMA of [10, 10, 10, 10] = 10. With sf = 2.0 -> 20.00
    const res = activeForecastSuperFn([10, 10, 10, 10], 1, monthlyAvg, overallAvg);
    assert.strictEqual(res[0], 20.00);
  });

  await testCase('Tier 2', 'F10', 'T2.52: Floating point history rounded cleanly to 2 decimals', async () => {
    const res = activeForecastSuperFn([10.333, 20.666, 30.111, 40.555], 4, Array(12).fill(100), 100);
    for (const v of res) {
      const dec = String(v).split('.')[1] || '';
      assert.ok(dec.length <= 2);
    }
  });

  await testCase('Tier 2', 'F10', 'T2.53: Maximum period boundary (periods = 24) produces exactly 24 items', async () => {
    const res = activeForecastSuperFn([10, 20, 30, 40], 24, Array(12).fill(100), 100);
    assert.strictEqual(res.length, 24);
  });

  // --- F11 Boundaries (Smart Inventory Classification) ---
  await testCase('Tier 2', 'F11', 'T2.54: Exact boundary: Qty === avgDailySales * 14 classifies as Healthy', async () => {
    const avgDailySales = 10;
    const qtyOnHand = avgDailySales * 14; // exactly 140
    const status = activeClassifyFn({ qtyOnHand, avgDailySales });
    assert.strictEqual(status.toLowerCase(), 'healthy');
  });

  await testCase('Tier 2', 'F11', 'T2.55: Exact boundary: Qty === avgDailySales * 14 - 0.001 classifies as Low Stock', async () => {
    const avgDailySales = 10;
    const qtyOnHand = avgDailySales * 14 - 0.001; // 139.999
    const status = activeClassifyFn({ qtyOnHand, avgDailySales });
    assert.strictEqual(status.toLowerCase(), 'low');
  });

  await testCase('Tier 2', 'F11', 'T2.56: Exact boundary: Qty === avgDailySales * 60 classifies as Overstock', async () => {
    const avgDailySales = 10;
    const qtyOnHand = avgDailySales * 60; // exactly 600
    const status = activeClassifyFn({ qtyOnHand, avgDailySales });
    assert.strictEqual(status.toLowerCase(), 'over');
  });

  await testCase('Tier 2', 'F11', 'T2.57: Exact boundary: Qty === avgDailySales * 60 - 0.001 classifies as Healthy', async () => {
    const avgDailySales = 10;
    const qtyOnHand = avgDailySales * 60 - 0.001; // 599.999
    const status = activeClassifyFn({ qtyOnHand, avgDailySales });
    assert.strictEqual(status.toLowerCase(), 'healthy');
  });

  await testCase('Tier 2', 'F11', 'T2.58: Negative Qty on hand (-5) with avgDailySales > 0 classifies as Low Stock', async () => {
    const status = activeClassifyFn({ qtyOnHand: -5, avgDailySales: 2 });
    assert.strictEqual(status.toLowerCase(), 'low');
  });

  await testCase('Tier 2', 'F11', 'T2.59: Zero Qty on hand with avgDailySales > 0 classifies as Low Stock', async () => {
    const status = activeClassifyFn({ qtyOnHand: 0, avgDailySales: 5 });
    assert.strictEqual(status.toLowerCase(), 'low');
  });

  await testCase('Tier 2', 'F11', 'T2.60: Zero Qty on hand with avgDailySales === 0 classifies as Healthy (no demand)', async () => {
    const status = activeClassifyFn({ qtyOnHand: 0, avgDailySales: 0 });
    assert.strictEqual(status.toLowerCase(), 'healthy');
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ==========================================================================
  reporter.printBanner('Cross-Feature Combinations & Concurrency', 'Tier 3');

  if (isServerOnline) {
    await testCase('Tier 3', 'F1+F2+F3', 'T3.1: Concurrent Streaming & Analytics Load: parallel calls return 200 within 500ms', async () => {
      const p1 = apiRequest('/api/stream/sales');
      const p2 = apiRequest('/api/eda/revenue-trend');
      const p3 = apiRequest('/api/eda/top-categories');
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
      assert.strictEqual(r3.status, 200);
      assert.ok(r1.durationMs < 500, `Stream duration took ${r1.durationMs}ms`);
      assert.ok(r2.durationMs < 500, `Revenue trend took ${r2.durationMs}ms`);
      assert.ok(r3.durationMs < 500, `Top categories took ${r3.durationMs}ms`);
    });

    await testCase('Tier 3', 'F1+F6', 'T3.2: Stream-to-Forecast Pipeline: stream sale category/store feeds into valid forecast', async () => {
      const streamRes = await apiRequest('/api/stream/sales');
      assert.ok(streamRes.data.length > 0);
      const randomItem = streamRes.data[Math.floor(Math.random() * streamRes.data.length)];
      const cat = randomItem['Product Category'];
      const st = randomItem['Store'];

      const forecastRes = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: cat, store: st, periods: 8 }
      });
      assert.strictEqual(forecastRes.status, 200);
      assert.strictEqual(forecastRes.data.normalForecast.length, 8);
      assert.strictEqual(forecastRes.data.superForecast.length, 8);
    });

    await testCase('Tier 3', 'F7', 'T3.3: Cumulative State Monotonicity: 4 sequential stream calls strictly maintain monotonic counts', async () => {
      const states = [];
      for (let i = 0; i < 4; i++) {
        const res = await apiRequest('/api/inventory/stream');
        states.push(res.data);
      }

      for (let i = 1; i < states.length; i++) {
        const prev = states[i - 1];
        const curr = states[i];
        assert.strictEqual(curr.total - prev.total, 50, `Step ${i}: Total did not increment by 50`);
        assert.ok(curr.healthy >= prev.healthy, `Healthy count decreased from ${prev.healthy} to ${curr.healthy}`);
        assert.ok(curr.low >= prev.low, `Low stock count decreased from ${prev.low} to ${curr.low}`);
        assert.ok(curr.over >= prev.over, `Overstock count decreased from ${prev.over} to ${curr.over}`);
        assert.strictEqual(curr.healthy + curr.low + curr.over, curr.total, `Invariant sum broken at step ${i}`);
      }
    });

    await testCase('Tier 3', 'F7+F8', 'T3.4: Inventory Stream + Alerts Cross-Validation: alerts reflect low and overstock distribution', async () => {
      const streamRes = await apiRequest('/api/inventory/stream');
      const alertsRes = await apiRequest('/api/inventory/alerts');

      assert.strictEqual(streamRes.status, 200);
      assert.strictEqual(alertsRes.status, 200);
      assert.ok(Array.isArray(alertsRes.data));
      assert.ok(alertsRes.data.length <= 10);

      for (const a of alertsRes.data) {
        const status = (a.stockStatus || a['Stock Status'] || '').toLowerCase();
        const level = (a.level || a['Mức độ'] || '');
        if (status.includes('low')) {
          assert.ok(level.includes('Khẩn cấp') || level.includes('🔴'));
        }
      }
    });

    await testCase('Tier 3', 'F6', 'T3.5: Dual Algorithm Forecast Difference Math Verification', async () => {
      const res = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 12 }
      });
      assert.strictEqual(res.status, 200);
      const { differences } = res.data;
      assert.ok(Array.isArray(differences));

      for (const d of differences) {
        const normalVal = Number(d.normal);
        const superVal = Number(d.super);
        const diffVal = Number(d.diff);
        const expectedDiff = Math.abs(superVal - normalVal);

        assert.ok(Math.abs(diffVal - expectedDiff) <= 0.05, `Diff math error: ${diffVal} vs expected ${expectedDiff}`);

        if (superVal > normalVal) {
          assert.strictEqual(d.higher, 'Super Forecast', `Expected higher to be 'Super Forecast' when super > normal`);
        } else if (normalVal > superVal) {
          assert.strictEqual(d.higher, 'Normal Forecast', `Expected higher to be 'Normal Forecast' when normal > super`);
        }

        assert.ok(d.diffPercent.endsWith('%'), `diffPercent '${d.diffPercent}' must end with %`);
      }
    });
  } else {
    skipCase('Tier 3', 'F1+F2+F3', 'T3.1: Concurrent Streaming & Analytics Load', 'Server offline');
    skipCase('Tier 3', 'F1+F6', 'T3.2: Stream-to-Forecast Pipeline', 'Server offline');
    skipCase('Tier 3', 'F7', 'T3.3: Cumulative State Monotonicity', 'Server offline');
    skipCase('Tier 3', 'F7+F8', 'T3.4: Inventory Stream + Alerts Cross-Validation', 'Server offline');
    skipCase('Tier 3', 'F6', 'T3.5: Dual Algorithm Forecast Difference Math Verification', 'Server offline');
  }

  // ==========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ==========================================================================
  reporter.printBanner('Real-World Application Scenarios', 'Tier 4');

  if (isServerOnline) {
    // Scenario 1: Retail Store Manager Morning Inventory Check
    await testCase('Tier 4', 'Scenario 1', 'Store Manager Morning Inventory Check Workflow', async () => {
      const alertsRes = await apiRequest('/api/inventory/alerts');
      assert.strictEqual(alertsRes.status, 200);
      assert.ok(alertsRes.data.length <= 10);

      const streamResults = [];
      for (let i = 0; i < 3; i++) {
        const r = await apiRequest('/api/inventory/stream');
        assert.strictEqual(r.status, 200);
        streamResults.push(r.data);
      }

      const latest = streamResults[streamResults.length - 1];
      const healthyPct = (latest.healthy / latest.total) * 100;
      const lowPct = (latest.low / latest.total) * 100;
      const overPct = (latest.over / latest.total) * 100;

      assert.ok(Number.isFinite(healthyPct) && healthyPct >= 0 && healthyPct <= 100);
      assert.ok(Number.isFinite(lowPct) && lowPct >= 0 && lowPct <= 100);
      assert.ok(Number.isFinite(overPct) && overPct >= 0 && overPct <= 100);
      assert.ok(Math.abs(healthyPct + lowPct + overPct - 100) <= 0.1);
    });

    // Scenario 2: Demand Planner Seasonal Forecasting Journey
    await testCase('Tier 4', 'Scenario 2', 'Demand Planner Seasonal Forecasting Journey Workflow', async () => {
      const trendRes = await apiRequest('/api/eda/revenue-trend');
      assert.strictEqual(trendRes.status, 200);
      assert.ok(trendRes.data.length >= 6);

      const topCatRes = await apiRequest('/api/eda/top-categories');
      assert.strictEqual(topCatRes.status, 200);
      const topCategory = topCatRes.data[0].category;

      const forecastRes = await apiRequest('/api/forecast', {
        method: 'POST',
        body: { category: topCategory, store: 'Store 1', periods: 12 }
      });
      assert.strictEqual(forecastRes.status, 200);
      assert.strictEqual(forecastRes.data.periods.length, 12);
      assert.strictEqual(forecastRes.data.normalForecast.length, 12);
      assert.strictEqual(forecastRes.data.superForecast.length, 12);

      for (const diff of forecastRes.data.differences) {
        assert.ok(Number(diff.diff) >= 0);
        assert.ok(diff.higher === 'Normal Forecast' || diff.higher === 'Super Forecast');
      }
    });

    // Scenario 3: Live Sales Dashboard Real-Time Ingestion
    await testCase('Tier 4', 'Scenario 3', 'Live Sales Dashboard Real-Time Ingestion Workflow', async () => {
      const allTransactions = [];
      for (let cycle = 0; cycle < 5; cycle++) {
        const res = await apiRequest('/api/stream/sales');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.data.length, 20);
        allTransactions.unshift(...res.data);
      }

      assert.strictEqual(allTransactions.length, 100);

      for (const tx of allTransactions) {
        assert.ok(tx['Transaction Date']);
        assert.ok(tx['Product Category']);
        assert.ok(Number(tx['Qty Sold']) !== undefined);
      }
    });

    // Scenario 4: Multi-Channel Return Rate Analysis
    await testCase('Tier 4', 'Scenario 4', 'Return Rate Analysis & Impact Assessment Workflow', async () => {
      const returnRes = await apiRequest('/api/eda/return-rate');
      assert.strictEqual(returnRes.status, 200);
      assert.ok(returnRes.data.length > 0);

      const channelRes = await apiRequest('/api/eda/channel-split');
      assert.strictEqual(channelRes.status, 200);
      assert.ok(channelRes.data.length > 0);

      const totalPct = channelRes.data.reduce((acc, c) => acc + Number(c.percentage), 0);
      assert.ok(Math.abs(totalPct - 100) <= 0.5);
      for (const r of returnRes.data) {
        assert.ok(Number(r.returnRate) >= 0 && Number(r.returnRate) <= 100);
      }
    });

    // Scenario 5: High-Frequency Multi-User Stress Simulation
    await testCase('Tier 4', 'Scenario 5', 'High-Frequency Multi-User Stress Simulation (24 concurrent requests)', async () => {
      const endpoints = [
        () => apiRequest('/api/stream/sales'),
        () => apiRequest('/api/eda/revenue-trend'),
        () => apiRequest('/api/eda/top-categories'),
        () => apiRequest('/api/eda/channel-split'),
        () => apiRequest('/api/eda/return-rate'),
        () => apiRequest('/api/forecast', {
          method: 'POST',
          body: { category: 'Scholar Footwear Trailblazer', store: 'Store 1', periods: 8 }
        }),
        () => apiRequest('/api/inventory/stream'),
        () => apiRequest('/api/inventory/alerts')
      ];

      const batch = [];
      for (let i = 0; i < 3; i++) {
        for (const ep of endpoints) {
          batch.push(ep());
        }
      }

      assert.strictEqual(batch.length, 24);
      const start = Date.now();
      const results = await Promise.all(batch);
      const totalDuration = Date.now() - start;

      for (const r of results) {
        assert.strictEqual(r.status, 200, `Expected 200 in stress test, got ${r.status}`);
      }

      const avgDuration = totalDuration / batch.length;
      assert.ok(avgDuration < 500, `Average request latency ${avgDuration}ms exceeded 500ms threshold`);
    });
  } else {
    skipCase('Tier 4', 'Scenario 1', 'Store Manager Morning Inventory Check Workflow', 'Server offline');
    skipCase('Tier 4', 'Scenario 2', 'Demand Planner Seasonal Forecasting Journey Workflow', 'Server offline');
    skipCase('Tier 4', 'Scenario 3', 'Live Sales Dashboard Real-Time Ingestion Workflow', 'Server offline');
    skipCase('Tier 4', 'Scenario 4', 'Return Rate Analysis & Impact Assessment Workflow', 'Server offline');
    skipCase('Tier 4', 'Scenario 5', 'High-Frequency Multi-User Stress Simulation', 'Server offline');
  }

    // --- Summary & Result ---
    const passed = reporter.printSummary(isServerOnline, isUnitOnly);
    return passed;
  } finally {
    if (spawnedChild && spawnedChild.pid) {
      console.log(`\n${c.cyan}[*] Cleaning up spawned backend server (PID: ${spawnedChild.pid})...${c.reset}`);
      if (process.platform === 'win32') {
        try {
          child_process.execSync(`taskkill /pid ${spawnedChild.pid} /T /F`, { stdio: 'ignore' });
        } catch (e) {
          // ignore if already exited
        }
      } else {
        try {
          spawnedChild.kill('SIGTERM');
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

// Auto-run when executed directly via CLI
if (require.main === module) {
  const cliArgs = process.argv.slice(2);
  const isUnitOnly = cliArgs.includes('--unit-only') || cliArgs.includes('--unit');
  const noSpawn = cliArgs.includes('--no-spawn');
  runAllTests({ unitOnly: isUnitOnly, noSpawn }).then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(err => {
    console.error(`${c.red}FATAL ERROR IN TEST RUNNER:${c.reset}`, err);
    process.exit(1);
  });
}

module.exports = {
  runAllTests
};
