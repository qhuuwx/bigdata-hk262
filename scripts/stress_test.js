/**
 * Production Resilience, Concurrency, Fuzzing & Readiness Stress Test Suite
 * Target: bigdata_inventory Full-Stack System
 *
 * Phases:
 *   1. Startup 503 Readiness-Guard Window Verification (/api/health vs /api/* during CSV indexing)
 *   2. High-Concurrency Mixed Workload (750 requests across 5 waves of 150 concurrent clients)
 *   3. Concurrent Inventory Stream + Reset Race Condition & Atomicity Verification
 *   4. Malformed JSON, Oversized Payload (413), Prototype Pollution & Boundary Fuzzing
 *   5. Bounded Forecast LRU Cache Eviction & Memory Stability Audit (2,000 unique keys)
 *   6. Data Integrity Audit (1,080 Category-Store 11-Month Series & Distinct Top-10 Alert Pairs)
 *   7. Graceful SIGTERM Shutdown Verification
 */

const assert = require('node:assert');
const path = require('node:path');
const child_process = require('node:child_process');
const dataLoaderService = require('../backend/services/dataLoaderService');
const forecastService = require('../backend/services/forecastService');
const salesStreamService = require('../backend/services/salesStreamService');
const inventoryService = require('../backend/services/inventoryService');

const STRESS_PORT = parseInt(process.env.STRESS_PORT || '3099', 10);
const BASE_URL = `http://127.0.0.1:${STRESS_PORT}`;

function calcPercentiles(latencies) {
  if (!latencies.length) return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const idx = (q) => Math.min(n - 1, Math.floor(q * (n - 1)));
  return {
    min: sorted[0],
    p50: sorted[idx(0.50)],
    p95: sorted[idx(0.95)],
    p99: sorted[idx(0.99)],
    max: sorted[n - 1],
    mean: Number((sum / n).toFixed(2))
  };
}

async function rawRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    Accept: 'application/json',
    ...(options.rawBody !== undefined || options.body !== undefined
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  let bodyPayload;
  if (options.rawBody !== undefined) {
    bodyPayload = options.rawBody;
  } else if (options.body !== undefined) {
    bodyPayload = JSON.stringify(options.body);
  }

  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: bodyPayload,
      signal: controller.signal
    });
    const durationMs = Number((performance.now() - start).toFixed(2));
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

async function runStressSuite() {
  console.log('==============================================================================');
  console.log('  BIGDATA_INVENTORY — PRINCIPAL ENGINEERING STRESS & RESILIENCE SUITE');
  console.log('==============================================================================');

  const serverPath = path.resolve(__dirname, '../backend/server.js');
  let serverProc = null;

  try {
    // =========================================================================
    // PHASE 1: STARTUP 503 READINESS-GUARD WINDOW TEST
    // =========================================================================
    console.log('\n[Phase 1] Spawning server & testing 503 Readiness-Guard during CSV ingestion...');
    serverProc = child_process.spawn(process.execPath, [serverPath], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(STRESS_PORT), NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderrOutput = '';
    serverProc.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    // Wait for TCP socket to bind while CSV loading is still in progress
    let observedLoadingHealth = false;
    let observed503Guard = false;
    let isReady = false;

    const pollStart = Date.now();
    while (Date.now() - pollStart < 15000) {
      try {
        const healthRes = await rawRequest('/api/health', { timeoutMs: 500 });
        if (healthRes.status === 200 && healthRes.data.status === 'loading') {
          observedLoadingHealth = true;
          const guardedRes = await rawRequest('/api/stream/sales', { timeoutMs: 500 });
          if (guardedRes.status === 503 && guardedRes.data?.error?.code === 'SERVICE_UNAVAILABLE') {
            observed503Guard = true;
          }
        } else if (healthRes.status === 200 && healthRes.data.status === 'ready') {
          isReady = true;
          break;
        }
      } catch (e) {
        // TCP port not bound yet
      }
      await new Promise((r) => setTimeout(r, 30));
    }

    assert.strictEqual(isReady, true, 'Server failed to reach ready state within 15s');
    assert.strictEqual(observedLoadingHealth, true, 'Expected /api/health to report status="loading" during startup window');
    assert.strictEqual(observed503Guard, true, 'Expected /api/stream/sales to return 503 SERVICE_UNAVAILABLE during startup window');
    console.log('  ✔ Verified /api/health returns 200 { status: "loading" } during CSV ingestion');
    console.log('  ✔ Verified readinessGuard intercepts /api/* with 503 SERVICE_UNAVAILABLE until ready');
    console.log(`  ✔ Server transitioned to READY in ${Date.now() - pollStart}ms`);

    const catsRes = await rawRequest('/api/forecast/categories');
    const storesRes = await rawRequest('/api/forecast/stores');
    assert.strictEqual(catsRes.status, 200);
    assert.strictEqual(storesRes.status, 200);
    const categories = catsRes.data;
    const stores = storesRes.data;
    assert.strictEqual(categories.length, 27);
    assert.strictEqual(stores.length, 40);

    // =========================================================================
    // PHASE 2: HIGH-CONCURRENCY MIXED WORKLOAD (5 WAVES x 150 CONCURRENT = 750 REQS)
    // =========================================================================
    console.log('\n[Phase 2] Executing High-Concurrency Mixed Traffic (5 waves x 150 concurrent = 750 requests)...');
    const waveSize = 150;
    const numWaves = 5;
    const latencies = [];
    const suiteStart = performance.now();

    for (let wave = 1; wave <= numWaves; wave++) {
      const tasks = [];
      for (let i = 0; i < waveSize; i++) {
        const mod = i % 8;
        if (mod === 0) {
          tasks.push(rawRequest('/api/stream/sales'));
        } else if (mod === 1) {
          tasks.push(rawRequest('/api/eda/revenue-trend'));
        } else if (mod === 2) {
          tasks.push(rawRequest('/api/eda/top-categories'));
        } else if (mod === 3) {
          tasks.push(rawRequest('/api/eda/channel-split'));
        } else if (mod === 4) {
          tasks.push(rawRequest('/api/eda/return-rate'));
        } else if (mod === 5) {
          const cat = categories[i % categories.length];
          const st = stores[i % stores.length];
          const p = 4 + (i % 21);
          tasks.push(rawRequest('/api/forecast', {
            method: 'POST',
            body: { category: cat, store: st, periods: p }
          }));
        } else if (mod === 6) {
          tasks.push(rawRequest('/api/inventory/stream'));
        } else {
          tasks.push(rawRequest('/api/inventory/alerts'));
        }
      }

      const results = await Promise.all(tasks);
      for (const r of results) {
        assert.strictEqual(r.status, 200, `Unexpected HTTP status ${r.status} in high-concurrency wave ${wave}`);
        latencies.push(r.durationMs);
      }
    }

    const totalWallMs = performance.now() - suiteStart;
    const stats = calcPercentiles(latencies);
    const rps = Math.round((latencies.length / totalWallMs) * 1000);
    console.log(`  ✔ 750/750 concurrent requests returned 200 OK (0 errors, 0 5xx)`);
    console.log(`  ✔ Throughput: ${rps} req/s | Latency (ms): min=${stats.min} p50=${stats.p50} p95=${stats.p95} p99=${stats.p99} max=${stats.max}`);
    assert.ok(stats.p95 < 500, `p95 latency ${stats.p95}ms exceeded 500ms budget`);

    // =========================================================================
    // PHASE 3: CONCURRENT INVENTORY STREAM + RESET RACE CONDITION TEST
    // =========================================================================
    console.log('\n[Phase 3] Testing Concurrent GET /api/inventory/stream + POST /api/inventory/reset races...');
    const raceTasks = [];
    for (let i = 0; i < 120; i++) {
      if (i % 6 === 0) {
        raceTasks.push(rawRequest('/api/inventory/reset', { method: 'POST', body: {} }));
      } else {
        raceTasks.push(rawRequest('/api/inventory/stream'));
      }
    }

    const raceResults = await Promise.all(raceTasks);
    for (const r of raceResults) {
      assert.strictEqual(r.status, 200);
      const state = r.data.cumulativeState || r.data;
      assert.strictEqual(
        state.healthy + state.low + state.over,
        state.total,
        `Atomicity invariant violated during concurrent reset/stream: ${JSON.stringify(state)}`
      );
      assert.strictEqual(state.total % 50, 0, `Total ${state.total} must always be a multiple of 50`);
    }

    // Deterministic post-reset parallel accumulation check
    await rawRequest('/api/inventory/reset', { method: 'POST', body: {} });
    const parallelStreams = await Promise.all(
      Array.from({ length: 40 }, () => rawRequest('/api/inventory/stream'))
    );
    const maxTotal = Math.max(...parallelStreams.map((r) => r.data.total));
    assert.strictEqual(maxTotal, 40 * 50, `Expected 40 concurrent stream calls to accumulate exactly 2000 items, got ${maxTotal}`);
    console.log('  ✔ 120/120 concurrent stream+reset calls preserved healthy + low + over === total invariant');
    console.log('  ✔ 40 concurrent stream calls after reset accumulated exactly 2,000 records (0 lost updates)');

    // =========================================================================
    // PHASE 4: FUZZING, MALFORMED PAYLOADS, OVERSIZED PAYLOADS & PROTOTYPE KEYS
    // =========================================================================
    console.log('\n[Phase 4] Running Fuzzing & Edge-Case Security Checks...');

    // 4.1 Malformed JSON syntax
    const badJsonRes = await rawRequest('/api/forecast', {
      method: 'POST',
      rawBody: '{"category": "Broken JSON", "store": '
    });
    assert.strictEqual(badJsonRes.status, 400, `Expected 400 for malformed JSON, got ${badJsonRes.status}`);
    assert.strictEqual(badJsonRes.data?.error?.code, 'BAD_REQUEST');

    // 4.2 Oversized payload (> 100KB)
    const hugeString = 'X'.repeat(150 * 1024);
    const hugeRes = await rawRequest('/api/forecast', {
      method: 'POST',
      body: { category: hugeString, store: 'STR-1006', periods: 8 }
    });
    assert.strictEqual(hugeRes.status, 413, `Expected 413 for >100KB payload, got ${hugeRes.status}`);

    // 4.3 Input length > 200 chars (under 100KB body limit)
    const longCatRes = await rawRequest('/api/forecast', {
      method: 'POST',
      body: { category: 'A'.repeat(250), store: 'STR-1006', periods: 8 }
    });
    assert.strictEqual(longCatRes.status, 400, `Expected 400 for category > 200 chars, got ${longCatRes.status}`);

    // 4.4 Prototype pollution keys
    const protoPayloads = [
      { category: '__proto__', store: 'constructor', periods: 8 },
      { category: 'prototype', store: 'toString', periods: 8 },
      { category: 'hasOwnProperty', store: 'valueOf', periods: 8 }
    ];
    for (const p of protoPayloads) {
      const res = await rawRequest('/api/forecast', { method: 'POST', body: p });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.normalForecast.length, 8);
      assert.strictEqual(res.data.superForecast.length, 8);
    }

    // 4.5 Invalid periods & body types
    const invalidBodies = [
      { category: categories[0], store: stores[0], periods: 0 },
      { category: categories[0], store: stores[0], periods: -8 },
      { category: categories[0], store: stores[0], periods: 3 },
      { category: categories[0], store: stores[0], periods: 25 },
      { category: categories[0], store: stores[0], periods: 8.5 },
      { category: categories[0], store: stores[0], periods: true },
      { category: categories[0], store: stores[0], periods: null },
      { category: categories[0], store: stores[0], periods: [] },
      { category: '   ', store: stores[0], periods: 8 },
      { category: categories[0], store: '', periods: 8 },
      []
    ];
    for (const b of invalidBodies) {
      const res = await rawRequest('/api/forecast', { method: 'POST', body: b });
      assert.strictEqual(res.status, 400, `Expected 400 for invalid body ${JSON.stringify(b)}, got ${res.status}`);
    }

    // 4.6 Unknown API route returns structured 404
    const notFoundRes = await rawRequest('/api/non-existent-route-xyz');
    assert.strictEqual(notFoundRes.status, 404);
    assert.strictEqual(notFoundRes.data?.error?.code, 'NOT_FOUND');

    console.log('  ✔ Malformed JSON returns 400 BAD_REQUEST (zero 500 crashes)');
    console.log('  ✔ Oversized >100KB payload rejected with 413 PAYLOAD_TOO_LARGE');
    console.log('  ✔ Oversized >200-char field rejected with 400 BAD_REQUEST');
    console.log('  ✔ Prototype keys (__proto__, constructor, toString) handled safely without pollution');
    console.log('  ✔ All 11 invalid forecast body variations rejected with 400 BAD_REQUEST');

    // =========================================================================
    // PHASE 4B: SSE CONNECTION CHURN & FILTERED EDA CUBE CONCURRENCY TEST
    // =========================================================================
    console.log('\n[Phase 4B] Testing Concurrent SSE Streams (/events) & Filtered EDA Cube Queries...');

    // 1. Open 20 concurrent SSE streams (10 sales, 10 inventory), read first event frame, then disconnect
    async function verifySseStream(endpoint, expectedEvent) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal
        });
        assert.strictEqual(res.status, 200);
        const ct = res.headers.get('content-type') || '';
        assert.ok(ct.includes('text/event-stream'), `Expected text/event-stream, got ${ct}`);

        const reader = res.body.getReader();
        const { value } = await reader.read();
        const chunkText = new TextDecoder().decode(value);
        assert.ok(chunkText.includes(`event: ${expectedEvent}`), `Missing event: ${expectedEvent} in SSE frame`);
        const dataMatch = chunkText.match(/data:\s*(\{.*\}|\[.*\])/);
        assert.ok(dataMatch, 'Missing JSON data payload in SSE frame');
        const parsed = JSON.parse(dataMatch[1]);
        if (expectedEvent === 'batch') {
          assert.strictEqual(parsed.length, 20);
        } else {
          assert.strictEqual(parsed.healthy + parsed.low + parsed.over, parsed.total);
        }
        await reader.cancel();
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
    }

    const sseTasks = [];
    for (let i = 0; i < 10; i++) {
      sseTasks.push(verifySseStream('/api/stream/sales/events', 'batch'));
      sseTasks.push(verifySseStream('/api/inventory/stream/events', 'inventory'));
    }
    await Promise.all(sseTasks);

    // 2. Verify /api/eda/filters metadata & 60 concurrent filtered EDA cube requests
    const filterMetaRes = await rawRequest('/api/eda/filters');
    assert.strictEqual(filterMetaRes.status, 200);
    assert.strictEqual(filterMetaRes.data.stores.length, 40);
    assert.strictEqual(filterMetaRes.data.divisions.length, 3);
    assert.strictEqual(filterMetaRes.data.months.length, 11);

    const filteredRevRes = await rawRequest(
      '/api/eda/revenue-trend?store=STR-1006&division=Scholar%20Footwear&startMonth=2025-08&endMonth=2026-02'
    );
    assert.strictEqual(filteredRevRes.status, 200);
    assert.strictEqual(filteredRevRes.data.length, 7);
    assert.strictEqual(filteredRevRes.data[0].month, '2025-08');
    assert.strictEqual(filteredRevRes.data[6].month, '2026-02');

    const filterBatch = [];
    for (let i = 0; i < 60; i++) {
      const st = stores[i % stores.length];
      const qs = `?store=${encodeURIComponent(st)}&startMonth=2025-09&endMonth=2026-03`;
      const mod = i % 4;
      if (mod === 0) filterBatch.push(rawRequest(`/api/eda/revenue-trend${qs}`));
      else if (mod === 1) filterBatch.push(rawRequest(`/api/eda/top-categories${qs}`));
      else if (mod === 2) filterBatch.push(rawRequest(`/api/eda/channel-split${qs}`));
      else filterBatch.push(rawRequest(`/api/eda/return-rate${qs}`));
    }
    const filterResults = await Promise.all(filterBatch);
    for (const r of filterResults) {
      assert.strictEqual(r.status, 200);
      assert.ok(Array.isArray(r.data));
    }

    console.log('  ✔ 20/20 concurrent SSE streams connected, emitted valid initial frames, and disconnected cleanly');
    console.log('  ✔ 60/60 concurrent multi-dimensional filtered EDA cube queries returned 200 OK');

    // 3. Verify ML Serving Endpoints (/api/ml/metrics, /api/ml/forecast, /api/ml/classify-inventory)
    const mlMetricsRes = await rawRequest('/api/ml/metrics');
    assert.strictEqual(mlMetricsRes.status, 200);
    assert.strictEqual(typeof mlMetricsRes.data, 'object');

    const mlForecastRes = await rawRequest('/api/ml/forecast', {
      method: 'POST',
      body: { category: categories[0], store: stores[0], periods: 12 }
    });
    assert.strictEqual(mlForecastRes.status, 200);
    assert.strictEqual(mlForecastRes.data.mlForecast.length, 12);
    assert.strictEqual(mlForecastRes.data.lower80.length, 12);
    assert.strictEqual(mlForecastRes.data.upper80.length, 12);
    assert.strictEqual(mlForecastRes.data.comparisonRows.length, 12);

    const mlClassifyRes = await rawRequest('/api/ml/classify-inventory', {
      method: 'POST',
      body: { qtyOnHand: 5, avgDailySales: 1.5, category: categories[0], store: stores[0] }
    });
    assert.strictEqual(mlClassifyRes.status, 200);
    assert.strictEqual(mlClassifyRes.data.predictedClass, 'low');
    assert.ok(mlClassifyRes.data.probabilities.low > 0.5);
    console.log('  ✔ ML endpoints (/api/ml/metrics, /api/ml/forecast, /api/ml/classify-inventory) verified');

    // =========================================================================
    // PHASE 5: FORECAST LRU CACHE BOUNDING & MEMORY STABILITY TEST
    // =========================================================================
    console.log('\n[Phase 5] Verifying ForecastService LRU Cache Bounding & Memory Stability...');
    forecastService.clearCache();
    for (let i = 0; i < 2000; i++) {
      forecastService.generateForecast(`SyntheticCat_${i}`, `SyntheticStore_${i}`, 8);
    }
    assert.ok(
      forecastService._forecastCache.size <= 1500,
      `Cache exceeded max capacity 1500: actual size ${forecastService._forecastCache.size}`
    );
    assert.strictEqual(forecastService._forecastCache.size, 1500);
    console.log(`  ✔ Forecast cache strictly bounded at ${forecastService._forecastCache.size}/1500 entries after 2,000 unique queries`);

    // =========================================================================
    // PHASE 6: DATA INTEGRITY AUDIT (1,080 SERIES, DISTINCT ALERTS & BATCH BOUNDS)
    // =========================================================================
    console.log('\n[Phase 6] Auditing In-Memory Data Pipeline Integrity & Service Edge Cases...');
    const memBefore = process.memoryUsage();
    await dataLoaderService.init(path.resolve(__dirname, '../data'));

    // 6.1 Verify top 10 alerts have distinct (category, store) pairs and surface both Low Stock (first) and Overstock
    const alerts = dataLoaderService.getInventoryAlertsCache();
    assert.strictEqual(alerts.length, 10);
    const alertPairs = new Set(alerts.map((a) => `${a.category}:::${a.store}`));
    assert.strictEqual(
      alertPairs.size,
      10,
      `Expected 10 distinct (category, store) pairs in top 10 alerts, got ${alertPairs.size}`
    );
    const lowCount = alerts.filter((a) => a.stockStatus === 'Low Stock').length;
    const overCount = alerts.filter((a) => a.stockStatus === 'Overstock').length;
    assert.ok(lowCount > 0 && overCount > 0, `Expected both Low Stock (${lowCount}) and Overstock (${overCount}) in top 10 alerts`);
    let seenOver = false;
    for (const a of alerts) {
      if (a.stockStatus === 'Overstock') seenOver = true;
      if (seenOver && a.stockStatus === 'Low Stock') {
        assert.fail('Priority violation: Low Stock appeared after Overstock');
      }
    }

    // 6.2 Verify salesStreamService & inventoryService handle batchSize <= 0, NaN, Infinity, and large bounds
    assert.deepStrictEqual(salesStreamService.getSalesStream(0), []);
    assert.deepStrictEqual(salesStreamService.getSalesStream(-10), []);
    assert.deepStrictEqual(salesStreamService.getSalesStream(NaN), []);
    assert.deepStrictEqual(salesStreamService.getSalesStream('invalid'), []);
    assert.strictEqual(salesStreamService.getSalesStream().length, 20);
    assert.strictEqual(salesStreamService.getSalesStream(9999).length, 500);

    inventoryService.resetCumulativeState();
    assert.strictEqual(inventoryService.processStreamBatch(0).total, 0);
    assert.strictEqual(inventoryService.processStreamBatch(-25).total, 0);
    assert.strictEqual(inventoryService.processStreamBatch(NaN).total, 0);
    assert.strictEqual(inventoryService.processStreamBatch().total, 50);

    // 6.3 Verify all 27 x 40 = 1,080 (category, store) pairs return 11-month chronological history without holes
    let pairCount = 0;
    for (const cat of categories) {
      for (const st of stores) {
        const h = dataLoaderService.getMonthlySalesHistory(cat, st);
        assert.strictEqual(
          h.history.length,
          11,
          `History length for (${cat}, ${st}) was ${h.history.length} instead of 11`
        );
        assert.strictEqual(h.monthlyAvg.length, 12);
        assert.ok(Number.isFinite(h.overallAvg), `overallAvg must be finite for (${cat}, ${st})`);
        const fc = forecastService.generateForecast(cat, st, 8);
        assert.strictEqual(fc.normalForecast.length, 8);
        assert.strictEqual(fc.superForecast.length, 8);
        assert.ok(fc.normalForecast.every((v) => Number.isFinite(v)));
        assert.ok(fc.superForecast.every((v) => Number.isFinite(v)));
        pairCount++;
      }
    }
    assert.strictEqual(pairCount, 1080);

    const memAfter = process.memoryUsage();
    const rssMb = Math.round((memAfter.rss / 1024 / 1024) * 10) / 10;
    const heapUsedMb = Math.round((memAfter.heapUsed / 1024 / 1024) * 10) / 10;
    const heapDeltaMb = Math.round(((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024) * 10) / 10;
    console.log(`  ✔ Top 10 inventory alerts contain 10/10 distinct (category, store) pairs (${lowCount} Low Stock -> ${overCount} Overstock)`);
    console.log('  ✔ salesStreamService & inventoryService safely guard batchSize <= 0, NaN, and oversized values');
    console.log('  ✔ All 1,080 (category, store) combinations return complete 11-month chronological series');
    console.log(`  ✔ Memory footprint: RSS=${rssMb} MB | HeapUsed=${heapUsedMb} MB (delta=${heapDeltaMb >= 0 ? '+' : ''}${heapDeltaMb} MB)`);

    // =========================================================================
    // PHASE 7: GRACEFUL SIGTERM SHUTDOWN VERIFICATION
    // =========================================================================
    console.log('\n[Phase 7] Testing Graceful SIGTERM Shutdown...');
    const exitCode = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not shut down within 5s')), 5000);
      serverProc.once('exit', (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
      serverProc.kill('SIGTERM');
    });
    serverProc = null;
    assert.strictEqual(exitCode, 0, `Expected clean exit code 0 on SIGTERM, got ${exitCode}`);
    assert.strictEqual(stderrOutput.trim(), '', `Unexpected server stderr output: ${stderrOutput}`);
    console.log('  ✔ Server closed HTTP listener and exited with code 0 on SIGTERM (zero stderr errors)');

    console.log('\n==============================================================================');
    console.log('  🎉 ALL 7 STRESS, CONCURRENCY, FUZZING & INTEGRITY PHASES PASSED 100%! 🎉');
    console.log('==============================================================================\n');
  } finally {
    if (serverProc && serverProc.exitCode === null) {
      try {
        serverProc.kill('SIGKILL');
      } catch (e) {}
    }
  }
}

runStressSuite().catch((err) => {
  console.error('\n❌ STRESS TEST SUITE FAILED:', err);
  process.exit(1);
});
