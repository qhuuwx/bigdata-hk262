# Retail Intelligence, Medallion Lakehouse & ML Platform (`bigdata_inventory`)

Hệ thống phân tích dữ liệu bán lẻ thời gian thực, kiến trúc Medallion Lakehouse (`Bronze` → `Silver` → `Gold`), dự báo nhu cầu học máy (`LightGBM` / `XGBoost` / `CatBoost` / `Ridge`) và giám sát tồn kho thông minh (`SMOTENC` / `ADASYN`) cho chuỗi bán lẻ giày dép & trang phục (`410.506` bản ghi trên `27` danh mục, `40` cửa hàng).

---

## Kiến trúc & Cấu trúc thư mục

```text
bigdata-hk262/
├── backend/              # Node.js + Express (Clean Architecture + Repository Pattern + SSE + ML)
│   ├── config/           # env.js, constants.js
│   ├── middleware/       # cors.js, logger.js, readinessGuard.js (HTTP 503), errorHandler.js (400/413/500)
│   ├── algorithms/       # Pure functions (zero imports): forecast.js (SMA-4), forecastsuper.js (WMA), classify.js
│   ├── repositories/     # dataRepository.js (memory|lakehouse|shadow), lakehouseRepository.js
│   ├── utils/            # csvParser.js (RFC 4180), mathUtils.js, asyncWrapper.js
│   ├── services/         # dataLoaderService, salesStreamService, edaService, forecastService (LRU), inventoryService, mlService
│   ├── controllers/      # health, stream (+SSE), eda (+cube filter), forecast, inventory (+SSE), mlController
│   ├── routes/           # REST & SSE endpoints (/api/health, /stream, /eda, /forecast, /inventory, /ml)
│   ├── app.js            # Express app & middleware assembly (100kb JSON payload limit)
│   └── server.js         # Bind port 3000 + non-blocking data loader + SIGTERM/SIGINT graceful shutdown
├── frontend/             # React 18 SPA + Vite 5 + Tailwind CSS + Apache ECharts 5
│   └── src/
│       ├── config/       # apiConfig.js (REST + SSE + /api/ml/* endpoints)
│       ├── context/      # AppContext.jsx (URL-synced state, Light/Dark theme, health), ToastContext.jsx
│       ├── services/     # edaService.js, forecastService.js, inventoryService.js, mlService.js
│       ├── hooks/        # useSalesStream & useInventoryStream (EventSource SSE + 2s polling fallback), useEdaData, useForecast
│       ├── components/   # Sidebar, Header, CommandPalette (Cmd+K), Skeleton, ECharts wrappers (LineChart, BarChart, DoughnutChart)
│       ├── pages/        # EdaTab.jsx, ForecastTab.jsx (3-way ML comparison + 80% CI), InventoryTab.jsx (ML Risk Simulator)
│       └── utils/        # formatters.js, chartTheme.js (Light/Dark tokens + Inter + JetBrains Mono tabular-nums)
├── pipelines/            # Enterprise Medallion Data Pipeline (Python + DuckDB + Parquet ZSTD + Dagster)
│   ├── schemas/          # JSON Schemas (sales_event, inventory_snapshot) + Dead-Letter Queue (DLQ) validator
│   ├── streaming/        # Kafka/Redpanda producer & stream_processor with SHA-256 idempotency
│   ├── medallion/        # bronze.py (raw audit), silver.py (type/date/outlier cleaning), gold.py (star schema + serving_bundle.json)
│   ├── quality/          # gates.py (blocking Soda-style quality checks), drift.py (PSI & KS statistical drift)
│   ├── orchestration/    # dagster_defs.py (asset lineage DAG)
│   ├── tests/            # pytest suite (15 assertions across schema/DLQ, Bronze/Silver/Gold, quality gates, drift)
│   └── run_pipeline.py   # End-to-end Medallion CLI orchestrator
├── ml/                   # End-to-End Machine Learning Pipeline (Python + Scikit-Learn + LightGBM + XGBoost + CatBoost)
│   ├── feature_engineering.py # Causal lags (1..4), rolling stats, seasonality, stock-cover, leakage audit
│   ├── train_forecast.py      # Expanding-window Time-Series CV (Ridge, RF, ExtraTrees, GBR, HistGBR, XGBoost, LightGBM, CatBoost)
│   ├── train_classifiers.py   # Stratified 5-Fold CV with fold-isolated SMOTENC & ADASYN (Stock Risk & Return Risk)
│   ├── predict.py             # CLI & JSON bridge for real-time inference (/api/ml/classify-inventory)
│   ├── artifacts/             # Serialized .joblib models, model_comparison_report.json, ml_predictions_cache.json, ML_MODEL_REPORT.md
│   ├── tests/                 # pytest suite (10 assertions verifying temporal causality, fold-only SMOTENC, and artifact schema)
│   └── run_ml_pipeline.py     # Reproducible ML training & artifact export runner
├── scripts/
│   ├── eda_report.js     # Xuất kiểm toán & thống kê EDA sang data/results/eda_summary.json
│   ├── stress_test.js    # Kiểm thử tải cao (1.350 requests, p50/p95/p99, race-condition & memory leak check)
│   └── shadow_parity.js  # Kiểm thử tương đương 100% giữa In-Memory CSV và Gold Lakehouse
├── data/                 # retail_sales_ml_apl.csv (125.751), retail_inventory_ml_apl.csv (284.755) & data/lakehouse/
├── LaTeX/                # Báo cáo khoa học & slide thuyết trình HCMUT CO4033
├── test_endpoints.js     # Bộ kiểm thử E2E & thuật toán (129 checks, 5 tầng)
├── test_m1.js            # Kiểm thử đơn vị thuật toán & DataLoader
├── docker-compose.yml    # Orchestration backend (:3000) + frontend (:3001) + optional pipeline profile (Redpanda, Redis, ClickHouse)
├── Dockerfile            # Multi-stage build React dist/ -> Nginx Alpine (:80)
├── Dockerfile.backend    # Node 18 Alpine backend + ML artifacts + healthcheck 127.0.0.1:3000
└── nginx.conf            # SPA fallback + Gzip + /api/ REST & SSE (proxy_buffering off) reverse proxy
```

---

## Tính năng Chính & Nâng cấp Kiến trúc

1. **EDA Đa chiều & Real-Time SSE Streaming (`EdaTab`):**
   - **Server-Sent Events (`GET /api/stream/sales/events`)** đẩy `20` giao dịch mỗi `2000ms` qua `EventSource` với cơ chế tự động chuyển đổi dự phòng (fallback) sang REST Polling (`GET /api/stream/sales`) và hiển thị trạng thái luồng (`SSE Live` / `Polling 2s` / `Paused`).
   - **Bộ lọc Cube Đa chiều (`GET /api/eda/summary?store=&division=&startMonth=&endMonth=`)**: Lọc trực tiếp theo `Store`, `Product Division`, khoảng thời gian hoặc click trực tiếp vào cột trên biểu đồ ECharts để cross-filter toàn bộ KPI và biểu đồ.
   - **4 Biểu đồ Apache ECharts 5**: Hỗ trợ `dataZoom` kéo thả theo trục thời gian, crosshair đồng bộ và chuyển đổi giao diện Sáng/Tối (`Light` / `Dark`).
2. **Dự báo Nhu cầu 3 Mô hình & Khoảng Tin cậy 80% (`ForecastTab`):**
   - So sánh đồng thời **3 luồng dự báo** trên cùng biểu đồ ECharts và bảng đối chiếu chi tiết:
     - **Normal Forecast**: Trung bình trượt đơn giản (SMA, $N=4$).
     - **Super Forecast**: Trung bình trượt có trọng số (`[1,2,3,4]`) kết hợp hệ số mùa vụ.
     - **ML Forecast (`Ridge_Tuned` / Ensemble)**: Dự báo học máy kèm dải **80% Confidence Interval (`[mlLower80, mlUpper80]`)** giảm `17,06%` sai số `MAE` so với SMA-4 (`MAE = 4,5316` vs `5,4637`).
   - **Thẻ Thực nghiệm ML (`GET /api/ml/metrics`)**: Hiển thị trực tiếp bảng xếp hạng `10` mô hình Time-Series CV và danh sách các đặc trưng quan trọng nhất (Top Engineered Features).
3. **Tồn kho Thông minh & Bộ mô phỏng Rủi ro Học máy (`InventoryTab`):**
   - **Luồng SSE Tích lũy (`GET /api/inventory/stream/events`)**: Cập nhật trạng thái tồn kho cộng dồn `50` bản ghi/`2s` đồng bộ giữa các client trên RAM máy chủ, kèm bảng **Top 10 Cảnh báo** đã khử trùng lặp cặp `(category, store)` (`7 Low Stock` + `3 Overstock`).
   - **ML Probabilistic Stock-Risk Simulator (`POST /api/ml/classify-inventory`)**: Công cụ tương tác cho phép điều chỉnh `Stock on Hand`, `30d Sales`, `Replenishment Indicator`, `Category` và `Store` để chạy suy luận xác suất rủi ro theo thời gian thực (`Healthy`, `Low Stock`, `Overstock`) từ mô hình `CatBoost + SMOTENC` (`Macro-F1 = 0,9988`, `Low Stock Recall = 0,9992`).
4. **Trải nghiệm Người dùng (UX) & Điều hướng Trạng thái:**
   - **Đồng bộ URL (`?tab=&cat=&store=&periods=&div=`)**: Lưu giữ toàn bộ trạng thái bộ lọc trên thanh địa chỉ, hỗ trợ deep-link và giữ nguyên trạng thái các tab khi chuyển đổi.
   - **Command Palette (`Cmd+K` / `Ctrl+K`)**: Tìm kiếm và nhảy nhanh tới bất kỳ `Product Category`, `Store ID`, thao tác chuyển tab hoặc đổi giao diện `Light/Dark`.

---

## Cài đặt & Vận hành (macOS / Linux / Windows)

> **Yêu cầu:** Node.js `>= 18` (hoặc Docker Desktop / Docker Engine), Python `>= 3.11` (tùy chọn khi chạy lại pipeline dữ liệu/ML) và 2 tập tin dữ liệu CSV trong thư mục `data/`.

### Cách 1: Chạy trực tiếp trên máy (Development)

**Terminal 1 — Backend (`http://localhost:3000`):**
```bash
npm install
npm start
```
*(Hỗ trợ biến môi trường `DATA_BACKEND=memory` (mặc định), `DATA_BACKEND=lakehouse` (`npm run start:lakehouse`), hoặc `DATA_BACKEND=shadow`.)*

**Terminal 2 — Frontend (`http://localhost:3001`):**
```bash
cd frontend
npm install
npm run dev
```

Build production bundle cho Frontend:
```bash
cd frontend
npm run build
```

### Cách 2: Triển khai Docker Compose

```bash
# Khởi chạy Backend (:3000) + Frontend Nginx (:3001)
docker compose up --build -d

# (Tùy chọn) Khởi chạy kèm hạ tầng Streaming & Serving (Redpanda Kafka, Redis 7, ClickHouse)
docker compose --profile pipeline up --build -d
```
- **Giao diện (Nginx Alpine hỗ trợ REST & SSE):** `http://localhost:3001`
- **Backend API & Healthcheck:** `http://localhost:3000/api/health`
- **ML Metrics Endpoint:** `http://localhost:3000/api/ml/metrics`
- Dừng container: `docker compose down`

---

## Vận hành Medallion Data Pipeline & Machine Learning Pipeline

Chi tiết kiến trúc được mô tả trong [pipelines/README.md](file:///Users/doxncwfn/HCMUT/Big%20Data/bigdata-hk262/pipelines/README.md) và [ml/README.md](file:///Users/doxncwfn/HCMUT/Big%20Data/bigdata-hk262/ml/README.md).

```bash
# 1. Chạy Medallion Data Pipeline (Bronze -> Silver -> Gold Parquet + Quality Gates + Drift Report)
pipelines/.venv/bin/python pipelines/run_pipeline.py

# 2. Chạy huấn luyện & xuất thực nghiệm Machine Learning (10 Forecasters + 12 SMOTENC/ADASYN Classifiers)
pipelines/.venv/bin/python ml/run_ml_pipeline.py
```

---

## Kiểm thử Tự động (Unit, E2E, Stress Test, Shadow Parity & Pytest)

Chạy ở thư mục gốc dự án:

```bash
# 1. Kiểm thử đơn vị thuật toán & DataLoader (offline)
npm run test:unit
node test_endpoints.js --unit-only

# 2. Kiểm thử E2E đầy đủ 129 assertions trên 5 tầng (tự khởi chạy & dọn dẹp backend)
npm test

# 3. Kiểm thử tải cao & chống race-condition (1.350 requests đồng thời, p99 < 40ms)
npm run test:stress

# 4. Kiểm thử tương đương 100% giữa In-Memory CSV và Gold Lakehouse
npm run test:parity

# 5. Kiểm thử Python cho Medallion Pipeline (15 tests) & ML Pipeline (10 tests)
pipelines/.venv/bin/pytest pipelines/tests ml/tests
```
