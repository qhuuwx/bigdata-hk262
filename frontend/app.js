/**
 * bigdata_inventory - Frontend Application Architecture & Controller
 * Milestone 3: Frontend UI & Real-Time Visualization
 * 
 * Target File: bigdata_inventory/frontend/app.js
 * Tech Stack: Vanilla ES6 JavaScript + Chart.js 4.4.x UMD
 * 
 * Architectural Modules:
 * 1. AppState & Config: Centralized state management
 * 2. ApiClient: Resilient HTTP client with timeouts, base URL resolution & error handling
 * 3. ToastManager: Non-intrusive notification system
 * 4. ChartManager: Safe chart instantiation, destruction & dynamic in-place updates
 * 5. NavigationController: Tab switching, active intervals management & mobile sidebar
 * 6. StreamController: Sales stream polling (100 row cap) & Inventory cumulative stream
 * 7. EdaController: 4 EDA analytics charts loader & baseline KPI card binder
 * 8. ForecastController: Dropdown loaders, POST /api/forecast, dual line chart & 8-row diff table
 * 9. InventoryController: Top 10 alerts table renderer with status/level badges
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. AppState & Configuration
  // =========================================================================
  const AppState = {
    activeTab: 'tab-eda',
    intervals: {
      salesStream: null,
      inventoryStream: null
    },
    salesRowsCount: 0,
    cumulativeInventory: {
      healthy: 0,
      low: 0,
      over: 0,
      total: 0
    },
    flags: {
      edaLoaded: false,
      categoriesLoaded: false,
      storesLoaded: false,
      isForecasting: false,
      backendReady: false
    },
    backoff: {
      salesIntervalMs: 2000,
      inventoryIntervalMs: 2000,
      consecutiveErrors: 0
    }
  };

  // =========================================================================
  // 2. ApiClient: Resilient Fetch Client
  // =========================================================================
  const ApiClient = {
    /**
     * Resolves the API base URL based on host port and environment
     */
    getBaseUrl() {
      if (typeof window === 'undefined' || !window.location) {
        return 'http://localhost:3000';
      }
      if (window.location.protocol === 'file:') {
        return 'http://localhost:3000';
      }
      // If served on host port 3001 (nginx without proxy) or local live server
      if (window.location.port === '3001' || window.location.port === '5500' || window.location.port === '8080') {
        return 'http://localhost:3000';
      }
      // If served by backend on port 3000 or behind an nginx /api reverse proxy
      return '';
    },

    /**
     * Standardized fetch wrapper with timeout and error extraction
     */
    async request(endpoint, options = {}, timeoutMs = 6000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            ...(options.headers || {})
          }
        });

        clearTimeout(timer);

        if (!response.ok) {
          let errData = {};
          try {
            errData = await response.json();
          } catch (_) {}
          const error = new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.data = errData;
          throw error;
        }

        return await response.json();
      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          throw new Error(`Yêu cầu mạng tới ${endpoint} bị hết thời gian (timeout ${timeoutMs}ms)`);
        }
        throw err;
      }
    },

    get(endpoint) {
      return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
      return this.request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
  };

  // =========================================================================
  // 3. ToastManager: Non-intrusive Alerts
  // =========================================================================
  const ToastManager = {
    container: null,
    activeMessages: new Set(),

    init() {
      this.container = document.getElementById('toast-container');
      if (!this.container && typeof document !== 'undefined') {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    },

    show(message, type = 'info', duration = 3500) {
      this.init();
      if (!this.container) return;

      // Deduplicate identical active toast messages
      if (this.activeMessages.has(message)) return;
      this.activeMessages.add(message);

      const toast = document.createElement('div');
      toast.className = `toast-pill toast-${type}`;

      const iconSvg = type === 'error'
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
        : type === 'success'
          ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
          : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

      toast.innerHTML = `
        ${iconSvg}
        <span class="toast-text">${escapeHtml(message)}</span>
      `;

      this.container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => {
          toast.remove();
          this.activeMessages.delete(message);
        });
      }, duration);
    }
  };

  // =========================================================================
  // 4. ChartManager: Unified Chart.js Lifecycle Controller
  // =========================================================================
  const ChartManager = {
    instances: {
      revenueTrend: null,
      topCategories: null,
      channelSplit: null,
      returnRate: null,
      forecast: null,
      inventoryCumulative: null
    },

    setupDefaults() {
      if (typeof Chart === 'undefined') {
        console.warn('[ChartManager] Chart.js UMD library not loaded from CDN yet.');
        return;
      }

      // Inter typography & modern slate styling matching bigdata1604
      Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      Chart.defaults.font.size = 12;
      Chart.defaults.color = '#64748B'; // Slate 500
      Chart.defaults.responsive = true;
      Chart.defaults.maintainAspectRatio = false;

      // Tooltip styling
      Chart.defaults.plugins.tooltip.backgroundColor = '#0F172A'; // Slate 900
      Chart.defaults.plugins.tooltip.titleColor = '#F8FAFC';
      Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12 };
      Chart.defaults.plugins.tooltip.bodyColor = '#E2E8F0';
      Chart.defaults.plugins.tooltip.padding = 10;
      Chart.defaults.plugins.tooltip.cornerRadius = 8;
      Chart.defaults.plugins.tooltip.usePointStyle = true;

      // Legend styling
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.boxWidth = 8;
      Chart.defaults.plugins.legend.labels.color = '#334155';
    },

    destroy(key) {
      if (this.instances[key]) {
        try {
          this.instances[key].destroy();
        } catch (_) {}
        this.instances[key] = null;
      }
    },

    create(key, canvasId, config) {
      if (typeof document === 'undefined') return null;
      const canvas = document.getElementById(canvasId);
      if (!canvas) {
        console.warn(`[ChartManager] Canvas #${canvasId} not found in DOM`);
        return null;
      }

      if (typeof Chart === 'undefined') {
        console.warn(`[ChartManager] Chart constructor is undefined`);
        return null;
      }

      // Prevent "Canvas is already in use" error
      this.destroy(key);
      try {
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
      } catch (_) {}

      const ctx = canvas.getContext('2d');
      const chartInstance = new Chart(ctx, config);
      this.instances[key] = chartInstance;
      return chartInstance;
    },

    resizeAll() {
      Object.values(this.instances).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
          try {
            chart.resize();
          } catch (_) {}
        }
      });
    }
  };

  // =========================================================================
  // 5. NavigationController: Tab Switching & Interval Lifecycle
  // =========================================================================
  const NavigationController = {
    init() {
      if (typeof document === 'undefined') return;

      // Tab button click listeners
      const navButtons = document.querySelectorAll('.nav-item');
      navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetTab = btn.getAttribute('data-tab');
          if (targetTab && targetTab !== AppState.activeTab) {
            this.switchTab(targetTab);
          }
        });
      });

      // Mobile Sidebar Toggle
      const toggleBtn = document.getElementById('sidebar-toggle');
      const overlay = document.getElementById('sidebar-overlay');

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          document.body.classList.toggle('sidebar-open');
        });
      }

      if (overlay) {
        overlay.addEventListener('click', () => {
          document.body.classList.remove('sidebar-open');
        });
      }

      // Close mobile sidebar on window resize if scaled to desktop
      window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
          document.body.classList.remove('sidebar-open');
        }
        ChartManager.resizeAll();
      });
    },

    switchTab(tabId) {
      AppState.activeTab = tabId;

      // 1. Update Navigation Buttons
      document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });

      // 2. Update Tab Panels
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
      });

      // 3. Update Header Title
      const titleElem = document.getElementById('header-tab-title');
      if (titleElem) {
        if (tabId === 'tab-eda') {
          titleElem.textContent = 'Khám phá Dữ liệu & Luồng Giao dịch';
        } else if (tabId === 'tab-forecast') {
          titleElem.textContent = 'So sánh Thuật toán Dự báo Nhu cầu';
        } else if (tabId === 'tab-inventory') {
          titleElem.textContent = 'Phân tích Tồn kho Thời gian thực';
        }
      }

      // 4. Close mobile sidebar
      document.body.classList.remove('sidebar-open');

      // 5. Manage Polling Intervals per Tab
      this.manageIntervals(tabId);

      // 6. Recalculate Chart Dimensions in newly visible container
      requestAnimationFrame(() => {
        ChartManager.resizeAll();
      });
    },

    manageIntervals(activeTab) {
      if (activeTab === 'tab-eda') {
        StreamController.stopInventoryStream();
        StreamController.startSalesStream();
        if (!AppState.flags.edaLoaded) {
          EdaController.loadAllEdaCharts();
        }
      } else if (activeTab === 'tab-forecast') {
        StreamController.stopSalesStream();
        StreamController.stopInventoryStream();
        if (!AppState.flags.categoriesLoaded || !AppState.flags.storesLoaded) {
          ForecastController.loadDropdowns();
        }
      } else if (activeTab === 'tab-inventory') {
        StreamController.stopSalesStream();
        StreamController.startInventoryStream();
        InventoryController.loadAlerts();
      }
    }
  };

  // =========================================================================
  // 6. StreamController: Real-Time Polling & DOM Mutation
  // =========================================================================
  const StreamController = {
    currencyFormatter: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }),

    // --- Tab 1: Sales Stream Polling (GET /api/stream/sales) ---
    startSalesStream() {
      if (AppState.intervals.salesStream) return;
      // Immediate first poll
      this.pollSales();
      // Arm 2s polling interval
      AppState.intervals.salesStream = setInterval(() => {
        this.pollSales();
      }, AppState.backoff.salesIntervalMs);
    },

    stopSalesStream() {
      if (AppState.intervals.salesStream) {
        clearInterval(AppState.intervals.salesStream);
        AppState.intervals.salesStream = null;
      }
    },

    async pollSales() {
      try {
        const transactions = await ApiClient.get('/api/stream/sales');
        if (!Array.isArray(transactions) || transactions.length === 0) return;

        this.renderSalesRows(transactions);
        AppState.backoff.consecutiveErrors = 0;
      } catch (err) {
        console.warn('[StreamController] Sales polling error:', err.message);
        AppState.backoff.consecutiveErrors++;
        if (AppState.backoff.consecutiveErrors >= 3) {
          ToastManager.show('Mất kết nối với luồng giao dịch. Đang tự động kết nối lại...', 'warning');
        }
      }
    },

    renderSalesRows(newRows) {
      const tbody = document.getElementById('tbody-sales-stream');
      const counterElem = document.getElementById('sales-stream-count');
      if (!tbody) return;

      // Remove initial empty state placeholder
      const emptyRow = tbody.querySelector('.empty-state-row');
      if (emptyRow) emptyRow.remove();

      // Create DocumentFragment for batch DOM insertion
      const fragment = document.createDocumentFragment();

      newRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-enter';

        const dateStr = escapeHtml(row['Transaction Date'] || '--');
        const division = escapeHtml(row['Product Division'] || '--');
        const category = escapeHtml(row['Product Category'] || '--');
        const store = escapeHtml(row['Store'] || '--');
        const channel = escapeHtml(row['Sales Channel'] || '--');
        const qtySold = Number(row['Qty Sold']) || 0;
        const salesAmount = Number(row['Sales Amount']) || 0;

        tr.innerHTML = `
          <td class="font-mono text-xs">${dateStr}</td>
          <td><span class="division-pill">${division}</span></td>
          <td class="font-medium text-slate-800">${category}</td>
          <td>${store}</td>
          <td><span class="channel-badge">${channel}</span></td>
          <td class="text-right font-mono font-medium">${qtySold.toLocaleString()}</td>
          <td class="text-right font-mono font-bold text-emerald-600">${this.currencyFormatter.format(salesAmount)}</td>
        `;

        fragment.appendChild(tr);
      });

      // Prepend newest batch to the top of table
      tbody.insertBefore(fragment, tbody.firstChild);

      // Enforce strict DOM cap at 100 rows
      while (tbody.children.length > 100) {
        tbody.removeChild(tbody.lastChild);
      }

      // Update counter badge
      if (counterElem) {
        counterElem.textContent = tbody.children.length;
      }

      // Update live KPI cards
      this.updateLiveKpis(newRows);
    },

    updateLiveKpis(recentRows) {
      const revElem = document.getElementById('kpi-revenue');
      const qtyElem = document.getElementById('kpi-qty-sold');

      const batchRev = recentRows.reduce((acc, r) => acc + (Number(r['Sales Amount']) || 0), 0);
      const batchQty = recentRows.reduce((acc, r) => acc + (Number(r['Qty Sold']) || 0), 0);

      if (revElem) {
        revElem.textContent = this.currencyFormatter.format(batchRev);
      }
      if (qtyElem) {
        qtyElem.textContent = batchQty.toLocaleString();
      }
    },

    // --- Tab 3: Cumulative Inventory Stream Polling (GET /api/inventory/stream) ---
    startInventoryStream() {
      if (AppState.intervals.inventoryStream) return;
      // Immediate first poll
      this.pollInventory();
      // Arm 2s polling interval
      AppState.intervals.inventoryStream = setInterval(() => {
        this.pollInventory();
      }, AppState.backoff.inventoryIntervalMs);
    },

    stopInventoryStream() {
      if (AppState.intervals.inventoryStream) {
        clearInterval(AppState.intervals.inventoryStream);
        AppState.intervals.inventoryStream = null;
      }
    },

    async pollInventory() {
      try {
        const data = await ApiClient.get('/api/inventory/stream');
        if (!data || typeof data.total !== 'number') return;

        AppState.cumulativeInventory = data;
        this.renderInventoryMetrics(data);
        this.updateInventoryDoughnut(data);
      } catch (err) {
        console.warn('[StreamController] Inventory polling error:', err.message);
      }
    },

    renderInventoryMetrics(data) {
      const total = data.total || 0;
      const healthyPct = total > 0 ? ((data.healthy / total) * 100).toFixed(1) : '0.0';
      const lowPct = total > 0 ? ((data.low / total) * 100).toFixed(1) : '0.0';
      const overPct = total > 0 ? ((data.over / total) * 100).toFixed(1) : '0.0';

      setText('cum-total-count', total.toLocaleString());
      setText('cum-healthy-count', data.healthy.toLocaleString());
      setText('cum-healthy-pct', `${healthyPct}%`);
      setText('cum-low-count', data.low.toLocaleString());
      setText('cum-low-pct', `${lowPct}%`);
      setText('cum-over-count', data.over.toLocaleString());
      setText('cum-over-pct', `${overPct}%`);
    },

    updateInventoryDoughnut(data) {
      const chart = ChartManager.instances.inventoryCumulative;

      // In-place dataset update to prevent flicker
      if (chart) {
        chart.data.datasets[0].data = [data.healthy, data.low, data.over];
        chart.update('none'); // Instant smooth transition without full canvas re-draw
      } else {
        // Instantiate first time
        const config = {
          type: 'doughnut',
          data: {
            labels: ['Healthy (Bình thường)', 'Low Stock (Sắp hết)', 'Overstock (Dư thừa)'],
            datasets: [{
              data: [data.healthy, data.low, data.over],
              backgroundColor: ['#22C55E', '#F97316', '#EF4444'],
              borderWidth: 2,
              borderColor: '#FFFFFF',
              hoverOffset: 6
            }]
          },
          options: {
            cutout: '72%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { padding: 18 }
              },
              tooltip: {
                callbacks: {
                  label(ctx) {
                    const val = ctx.raw || 0;
                    const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = tot > 0 ? ((val / tot) * 100).toFixed(1) : '0.0';
                    return ` ${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
                  }
                }
              }
            }
          }
        };

        ChartManager.create('inventoryCumulative', 'chart-inventory-cumulative', config);
      }
    }
  };

  // =========================================================================
  // 7. EdaController: Tab 1 Analytics Charts & Baseline KPI Cards
  // =========================================================================
  const EdaController = {
    async loadAllEdaCharts() {
      try {
        const [trendData, topCats, channelData, returnData] = await Promise.all([
          ApiClient.get('/api/eda/revenue-trend'),
          ApiClient.get('/api/eda/top-categories'),
          ApiClient.get('/api/eda/channel-split'),
          ApiClient.get('/api/eda/return-rate')
        ]);

        this.renderRevenueTrendChart(trendData);
        this.renderTopCategoriesChart(topCats);
        this.renderChannelSplitChart(channelData);
        this.renderReturnRateChart(returnData);

        AppState.flags.edaLoaded = true;
      } catch (err) {
        console.error('[EdaController] Failed to load EDA analytics:', err);
        ToastManager.show('Không thể tải dữ liệu Khám phá EDA: ' + err.message, 'error');
      }
    },

    // Chart 1: Revenue Trend Line Chart
    renderRevenueTrendChart(data) {
      if (!Array.isArray(data)) return;

      const labels = data.map(d => d.month);
      const values = data.map(d => d.revenue);

      const config = {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Doanh thu ($)',
            data: values,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#3B82F6',
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              grid: { color: '#F1F5F9' },
              ticks: {
                callback: (val) => `$${(val / 1000).toFixed(0)}k`
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => ` Doanh thu: $${Number(ctx.raw).toLocaleString()}`
              }
            }
          }
        }
      };

      ChartManager.create('revenueTrend', 'chart-revenue-trend', config);
    },

    // Chart 2: Top 10 Categories Horizontal Bar Chart
    renderTopCategoriesChart(data) {
      if (!Array.isArray(data)) return;

      const labels = data.map(d => d.category);
      const values = data.map(d => d.qty);

      const config = {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Số lượng bán (Units)',
            data: values,
            backgroundColor: '#0EA5E9',
            borderRadius: 6,
            barThickness: 16
          }]
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: {
              grid: { color: '#F1F5F9' },
              ticks: {
                callback: (val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
              }
            },
            y: {
              grid: { display: false },
              ticks: {
                autoSkip: false,
                font: { size: 11 }
              }
            }
          }
        }
      };

      ChartManager.create('topCategories', 'chart-top-categories', config);
    },

    // Chart 3: Channel Split Doughnut Chart
    renderChannelSplitChart(data) {
      if (!Array.isArray(data)) return;

      const labels = data.map(d => d.channel);
      const values = data.map(d => d.percentage);

      // Update Tab 1 KPI 4 (Kênh bán đóng góp lớn nhất)
      if (data.length > 0) {
        setText('kpi-top-channel', data[0].channel);
      }

      const config = {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'],
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          cutout: '68%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw}%`
              }
            }
          }
        }
      };

      ChartManager.create('channelSplit', 'chart-channel-split', config);
    },

    // Chart 4: Return Rate Bar Chart
    renderReturnRateChart(data) {
      if (!Array.isArray(data)) return;

      const labels = data.map(d => d.division);
      const values = data.map(d => d.returnRate);

      // Update Tab 1 KPI 3 (Tỷ lệ đổi trả toàn chuỗi)
      if (data.length > 0) {
        const avgReturn = data.reduce((acc, d) => acc + d.returnRate, 0) / data.length;
        setText('kpi-return-rate', `${avgReturn.toFixed(2)}%`);
      }

      const config = {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Tỷ lệ đổi trả (%)',
            data: values,
            backgroundColor: '#F43F5E',
            borderRadius: 6,
            barThickness: 32
          }]
        },
        options: {
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: '#F1F5F9' },
              ticks: {
                callback: (val) => `${val}%`
              }
            }
          }
        }
      };

      ChartManager.create('returnRate', 'chart-return-rate', config);
    }
  };

  // =========================================================================
  // 8. ForecastController: Tab 2 Parameter Setup & Comparison Table
  // =========================================================================
  const ForecastController = {
    init() {
      const forecastBtn = document.getElementById('btn-forecast');
      if (forecastBtn) {
        forecastBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.executeForecast();
        });
      }
    },

    async loadDropdowns() {
      try {
        const [categories, stores] = await Promise.all([
          ApiClient.get('/api/categories'),
          ApiClient.get('/api/stores')
        ]);

        const catSelect = document.getElementById('select-category');
        const storeSelect = document.getElementById('select-store');

        if (catSelect && Array.isArray(categories)) {
          catSelect.innerHTML = categories
            .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
            .join('');
          AppState.flags.categoriesLoaded = true;
        }

        if (storeSelect && Array.isArray(stores)) {
          storeSelect.innerHTML = stores
            .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
            .join('');
          AppState.flags.storesLoaded = true;
        }
      } catch (err) {
        console.error('[ForecastController] Failed to load dropdown options:', err);
        ToastManager.show('Lỗi khi tải danh mục và cửa hàng: ' + err.message, 'error');
      }
    },

    async executeForecast() {
      if (AppState.flags.isForecasting) return;

      const catSelect = document.getElementById('select-category');
      const storeSelect = document.getElementById('select-store');
      const periodsInput = document.getElementById('input-periods');
      const submitBtn = document.getElementById('btn-forecast');

      const category = catSelect ? catSelect.value.trim() : '';
      const store = storeSelect ? storeSelect.value.trim() : '';
      const periods = periodsInput ? parseInt(periodsInput.value, 10) : 8;

      // Validation
      if (!category) {
        ToastManager.show('Vui lòng chọn Product Category.', 'warning');
        return;
      }
      if (!store) {
        ToastManager.show('Vui lòng chọn Store.', 'warning');
        return;
      }
      if (isNaN(periods) || periods < 4 || periods > 24) {
        ToastManager.show('Số kỳ dự báo phải là số nguyên từ 4 đến 24.', 'warning');
        return;
      }

      // UI Loading State
      AppState.flags.isForecasting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="loading-spinner"></span>
          <span>Đang tính toán dự báo...</span>
        `;
      }

      try {
        const result = await ApiClient.post('/api/forecast', { category, store, periods });
        this.renderDualLineChart(result);
        this.renderDifferenceTable(result);
        ToastManager.show(`Dự báo thành công (${periods} kỳ) cho ${category}`, 'success');
      } catch (err) {
        console.error('[ForecastController] Forecast execution failed:', err);
        ToastManager.show('Lỗi khi chạy thuật toán dự báo: ' + err.message, 'error');
      } finally {
        AppState.flags.isForecasting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Dự báo & So sánh</span>
          `;
        }
      }
    },

    renderDualLineChart(result) {
      const labels = result.periods || [];
      const normalData = result.normalForecast || [];
      const superData = result.superForecast || [];

      const config = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Normal Forecast (MA, N=4)',
              data: normalData,
              borderColor: '#3B82F6',
              backgroundColor: '#3B82F6',
              borderWidth: 2.5,
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Super Forecast (WMA + Mùa vụ)',
              data: superData,
              borderColor: '#F97316',
              backgroundColor: '#F97316',
              borderWidth: 2.5,
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 5,
              pointHoverRadius: 7,
              pointStyle: 'triangle'
            }
          ]
        },
        options: {
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: false,
              grid: { color: '#F1F5F9' },
              ticks: {
                callback: (val) => Number(val).toFixed(1)
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { padding: 16 }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)} đơn vị`
              }
            }
          }
        }
      };

      ChartManager.create('forecast', 'chart-forecast-comparison', config);
    },

    renderDifferenceTable(result) {
      const tbody = document.getElementById('tbody-forecast-diff');
      const counterElem = document.getElementById('diff-row-count');
      if (!tbody) return;

      // Prefer server-calculated differences, fallback to client computation
      let differences = result.differences;
      if (!Array.isArray(differences)) {
        differences = [];
        const periods = result.periods || [];
        const normal = result.normalForecast || [];
        const superF = result.superForecast || [];

        for (let i = 0; i < periods.length; i++) {
          const nVal = Number(normal[i]) || 0;
          const sVal = Number(superF[i]) || 0;
          if (nVal.toFixed(2) !== sVal.toFixed(2)) {
            const diff = Math.round(Math.abs(sVal - nVal) * 100) / 100;
            const diffPercent = nVal !== 0
              ? `${((Math.abs(sVal - nVal) / Math.abs(nVal)) * 100).toFixed(2)}%`
              : (sVal !== 0 ? '100.00%' : '0.00%');
            const higher = sVal > nVal ? 'Super Forecast' : 'Normal Forecast';

            differences.push({
              period: periods[i],
              normal: nVal,
              super: sVal,
              diff,
              diffPercent,
              higher
            });

            if (differences.length === 8) break;
          }
        }
      }

      if (counterElem) {
        counterElem.textContent = differences.length;
      }

      if (differences.length === 0) {
        tbody.innerHTML = `
          <tr class="empty-state-row">
            <td colspan="6" class="text-center py-6 text-muted">
              Hai thuật toán cho kết quả tương đương (không có chu kỳ nào sai khác sau khi làm tròn).
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = differences.map(row => {
        const isSuperHigher = row.higher === 'Super Forecast';
        const badgeClass = isSuperHigher ? 'pill-badge-orange' : 'pill-badge-blue';

        return `
          <tr>
            <td class="font-bold text-slate-800">${escapeHtml(row.period)}</td>
            <td class="text-right font-mono">${Number(row.normal).toFixed(2)}</td>
            <td class="text-right font-mono">${Number(row.super).toFixed(2)}</td>
            <td class="text-right font-mono font-bold">${Number(row.diff).toFixed(2)}</td>
            <td class="text-right font-mono font-medium">${escapeHtml(row.diffPercent)}</td>
            <td class="text-center">
              <span class="pill-badge ${badgeClass}">${escapeHtml(row.higher)}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  };

  // =========================================================================
  // 9. InventoryController: Tab 3 Top 10 Alerts Table
  // =========================================================================
  const InventoryController = {
    async loadAlerts() {
      try {
        const alerts = await ApiClient.get('/api/inventory/alerts');
        this.renderAlertsTable(alerts);
      } catch (err) {
        console.warn('[InventoryController] Failed to fetch inventory alerts:', err.message);
      }
    },

    renderAlertsTable(alerts) {
      const tbody = document.getElementById('tbody-inventory-alerts');
      if (!tbody) return;

      if (!Array.isArray(alerts) || alerts.length === 0) {
        tbody.innerHTML = `
          <tr class="empty-state-row">
            <td colspan="5" class="text-center py-6 text-emerald-600 font-medium">
              Không có cảnh báo tồn kho bất thường. Tất cả mặt hàng đều đạt ngưỡng Healthy.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = alerts.map(item => {
        const isLow = item.stockStatus === 'Low Stock';
        const statusBadge = isLow ? 'pill-badge-orange' : 'pill-badge-rose';
        const levelBadge = isLow ? 'badge-level-urgent' : 'badge-level-warning';

        return `
          <tr>
            <td class="font-medium text-slate-800">${escapeHtml(item.category || '--')}</td>
            <td>${escapeHtml(item.store || '--')}</td>
            <td class="text-right font-mono font-bold">${Number(item.qtyOnHand || 0).toLocaleString()}</td>
            <td class="text-center">
              <span class="pill-badge ${statusBadge}">${escapeHtml(item.stockStatus)}</span>
            </td>
            <td class="text-center">
              <span class="badge-level ${levelBadge}">${escapeHtml(item.level)}</span>
            </td>
          </tr>
        `;
      }).join('');
    }
  };

  // =========================================================================
  // 10. Helper Utilities & Application Bootstrap
  // =========================================================================
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setText(id, text) {
    if (typeof document === 'undefined') return;
    const elem = document.getElementById(id);
    if (elem) elem.textContent = text;
  }

  async function checkBackendReadiness(retryCount = 0) {
    try {
      const health = await ApiClient.get('/api/health');
      if (health && health.status === 'ready') {
        AppState.flags.backendReady = true;
        return true;
      }
    } catch (_) {}

    if (retryCount < 5) {
      ToastManager.show('Đang nạp tập dữ liệu Big Data vào bộ nhớ máy chủ...', 'info', 2000);
      await new Promise(res => setTimeout(res, 2000));
      return checkBackendReadiness(retryCount + 1);
    }
    return false;
  }

  // Application Entry Point
  async function init() {
    console.log('[InventoryApp] Initializing Big Data Demand Forecasting & Smart Inventory UI...');

    // 1. Initialize Chart.js Theme Defaults
    ChartManager.setupDefaults();

    // 2. Initialize Navigation & Form Listeners
    NavigationController.init();
    ForecastController.init();

    // 3. Verify Backend Readiness
    await checkBackendReadiness();

    // 4. Start Default Active Tab (Tab 1: EDA & Sales Streaming)
    NavigationController.switchTab('tab-eda');
  }

  // Safe DOMContentLoaded trigger
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Export for testing in Node.js / automated verification if needed
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AppState,
      ApiClient,
      ToastManager,
      ChartManager,
      NavigationController,
      StreamController,
      EdaController,
      ForecastController,
      InventoryController,
      escapeHtml,
      setText
    };
  }
})();
