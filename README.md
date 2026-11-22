# Retail Intelligence & Demand Forecasting (`bigdata_inventory`)

Hệ thống phân tích dữ liệu bán lẻ thời gian thực, dự báo nhu cầu và giám sát tồn kho thông minh cho chuỗi bán lẻ giày dép & trang phục (`410.506` bản ghi trên `27` danh mục, `40` cửa hàng).

---

## Kiến trúc & Cấu trúc thư mục

```text
bigdata-hk262/
├── backend/              # Node.js + Express (Clean Architecture 7 tầng)
│   ├── config/           # env.js, constants.js
│   ├── middleware/       # cors.js, logger.js, readinessGuard.js (HTTP 503), errorHandler.js
│   ├── algorithms/       # Pure functions (zero imports): forecast.js, forecastsuper.js, classify.js
│   ├── utils/            # csvParser.js (RFC 4180), mathUtils.js, asyncWrapper.js
│   ├── services/         # dataLoaderService, salesStreamService, edaService, forecastService, inventoryService
│   ├── controllers/      # Request validation & response formatting
│   ├── routes/           # REST endpoints (/api/health, /stream, /eda, /forecast, /inventory)
│   ├── app.js            # Express app & middleware assembly
│   └── server.js         # Nạp CSV vào RAM rồi mở cổng 3000
├── frontend/             # React 18 SPA + Vite 5 + Tailwind CSS + Chart.js 4
│   └── src/
│       ├── config/       # apiConfig.js (tự nhận diện Local / Vite / Nginx /api)
│       ├── context/      # AppContext.jsx (activeTab, health), ToastContext.jsx
│       ├── hooks/        # usePolling (2s, pause khi ẩn tab), useSalesStream, useEdaData, useForecast, useInventoryStream
│       ├── components/   # Sidebar (#0F172A), Header, Card, Badge, Chart wrappers, Tables
│       ├── pages/        # EdaTab.jsx, ForecastTab.jsx, InventoryTab.jsx
│       └── utils/        # formatters.js, chartTheme.js (Inter + JetBrains Mono tabular-nums)
├── scripts/
│   └── eda_report.js     # Xuất kiểm toán & thống kê EDA sang data/results/eda_summary.json
├── data/                 # Đặt retail_sales_ml_apl.csv (125.751) & retail_inventory_ml_apl.csv (284.755)
├── LaTeX/                # Báo cáo khoa học HCMUT CO4033 (xem LaTeX/README.md)
├── test_endpoints.js     # Bộ kiểm thử E2E & thuật toán (129 checks, 5 tầng)
├── test_m1.js            # Kiểm thử đơn vị thuật toán & DataLoader
├── docker-compose.yml    # Orchestration backend (:3000) + frontend Nginx (:3001)
├── Dockerfile            # Multi-stage build React dist/ -> Nginx Alpine (:80)
├── Dockerfile.backend    # Node 18 Alpine backend + healthcheck 127.0.0.1:3000
└── nginx.conf            # SPA fallback + Gzip + /api/ reverse proxy
```

---

## Tính năng 3 Phân hệ

1. **EDA & Streaming (`EdaTab`):**
   - Polling `2s/lần` (`GET /api/stream/sales`), lấy `20` giao dịch ngẫu nhiên, chèn đầu bảng (tối đa `100` dòng, hỗ trợ Tạm dừng/Tiếp tục/Xóa bộ đệm).
   - `4` biểu đồ Chart.js: Doanh thu theo tháng, Top `10` danh mục bán chạy, Cơ cấu kênh bán hàng, Tỷ lệ hoàn trả theo nhóm sản phẩm.
2. **Dự báo Nhu cầu (`ForecastTab`):**
   - Chọn `Product Category` (`27`), `Store ID` (`40`), số kỳ (`4`–`24`) qua `POST /api/forecast`.
   - Chạy song song **Normal Forecast** (SMA, $N=4$) và **Super Forecast** (WMA trọng số `[1,2,3,4]` + hệ số mùa vụ), vẽ biểu đồ kép và lọc tối đa `8` kỳ sai khác đầu tiên (chuẩn `toFixed(2)`).
3. **Tồn kho Thông minh (`InventoryTab`):**
   - Phân loại theo độ bao phủ `avgDailySales = sales30d / 30`: **Healthy** ($\ge 14$ ngày hoặc chưa có cầu), **Low Stock** ($< 14$ ngày), **Overstock** ($\ge 60$ ngày).
   - Biểu đồ Doughnut tích lũy (`50` bản ghi/`2s` lưu bền vững trên RAM máy chủ, có nút `Đặt lại`) + `3` thẻ KPI + bảng **Top 10 Cảnh báo** ưu tiên `Low Stock` (`Khẩn cấp`) trước `Overstock` (`Chú ý`).

---

## Cài đặt & Vận hành (macOS / Linux / Windows)

> **Yêu cầu:** Node.js `>= 18` (hoặc Docker Desktop / Docker Engine) và 2 tập tin dữ liệu CSV trong thư mục `data/`.

### Cách 1: Chạy trực tiếp trên máy (Development)

Mở **2 cửa sổ terminal** (macOS/Linux `bash`/`zsh` hoặc Windows `PowerShell`/`CMD`):

**Terminal 1 — Backend (`http://localhost:3000`):**
```bash
npm install
npm start
```
*(Nạp `410.506` dòng CSV vào RAM trong ~`2,5`–`3,5` giây trước khi mở cổng `3000`.)*

**Terminal 2 — Frontend (`http://localhost:3001`):**
```bash
cd frontend
npm install
npm run dev
```
*(Vite tự động proxy `/api` sang `http://localhost:3000`.)*

Build production bundle cho Frontend:
```bash
cd frontend
npm run build
```

### Cách 2: Triển khai Docker Compose (macOS / Linux / Windows)

```bash
docker compose up --build -d
```
- **Giao diện (Nginx Alpine):** `http://localhost:3001`
- **Backend API:** `http://localhost:3000/api/health`
- Dừng container: `docker compose down`

---

## Phân tích EDA & Kiểm thử tự động

Chạy ở thư mục gốc dự án (tương thích macOS, Linux và Windows):

```bash
# 1. Tạo báo cáo thống kê EDA (xuất data/results/eda_summary.json)
node scripts/eda_report.js

# 2. Kiểm thử nhanh thuật toán & DataLoader (offline, không cần server)
node test_m1.js
node test_endpoints.js --unit-only

# 3. Kiểm thử E2E đầy đủ 129 bài (tự khởi chạy & dọn dẹp backend)
node test_endpoints.js
```
