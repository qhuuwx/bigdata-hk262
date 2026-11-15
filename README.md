# Retail Analytics & Demand Forecasting Dashboard (`bigdata_inventory`)

Hệ thống phân tích dữ liệu lớn thời gian thực cho chuỗi bán lẻ giày dép, kết hợp **Dự báo nhu cầu bán hàng thông minh** và **Giám sát tồn kho thời gian thực**.

Hệ thống được thiết kế và tái cấu trúc hoàn chỉnh theo chuẩn **Clean Architecture / Layered Architecture** cho Backend và **Component-Based React SPA** cho Frontend.

---

## 🏗 Kiến Trúc Hệ Thống (Clean Architecture)

### 1. Backend (Node.js & Express - 7 Chuyên Tầng)

```
bigdata_inventory/backend/
├── config/           # env.js, constants.js - Cấu hình biến môi trường & hằng số nghiệp vụ
├── middleware/       # cors.js, logger.js, readinessGuard.js (HTTP 503 khi đang nạp), errorHandler.js
├── algorithms/       # forecast.js (MA), forecastsuper.js (WMA+Mùa vụ), classify.js (Tồn kho)
│                     # [Nguyên tắc]: Pure Functions, ZERO import từ các layer khác
├── utils/            # csvParser.js (RFC 4180), mathUtils.js (toFixed, %), asyncWrapper.js
├── services/         # dataLoaderService, salesStreamService, edaService, forecastService, inventoryService
│                     # [Nguyên tắc]: Tự quản lý cache & state nội bộ, độc lập với req/res
├── controllers/      # streamController, edaController, forecastController, inventoryController, healthController
│                     # [Nguyên tắc]: Nhận request, validate dữ liệu, gọi service, trả response
├── routes/           # streamRoutes, edaRoutes, forecastRoutes, inventoryRoutes, healthRoutes, index.js
│                     # [Nguyên tắc]: Chỉ định nghĩa route & method, zero logic
├── app.js            # Lắp ráp Express application & gắn middlewares
└── server.js         # Entrypoint nạp dữ liệu RAM (dataLoaderService.init) rồi mới mở port 3000
```

### 2. Frontend (React 18 SPA + Vite + Tailwind CSS + Chart.js)

```
bigdata_inventory/frontend/
├── src/
│   ├── config/       # apiConfig.js - Tự động nhận diện Base URL (Local, Docker Nginx proxy, Vite dev)
│   ├── services/     # apiClient.js (timeout AbortController), salesService, edaService, forecastService, inventoryService
│   ├── context/      # Tách bạch rõ ràng, chống "God Context":
│   │                 # - AppContext.jsx: Chỉ quản lý activeTab & backendStatus (health)
│   │                 # - ToastContext.jsx: Quản lý thông báo popup độc lập
│   ├── hooks/        # usePolling.js (tự pause khi ẩn tab), useSalesStream (max 100 dòng), useEdaData, useForecast, useInventoryStream
│   ├── components/   # Component-based modular:
│   │   ├── common/   # Sidebar (#E0F2FE theme), Header (status badge), Card, LoadingSpinner, ErrorAlert, Badge
│   │   ├── charts/   # LineChart, BarChart, DoughnutChart (cập nhật in-place mượt mà, không giật hình)
│   │   └── tables/   # SalesStreamTable (cuộn 100 dòng), ForecastDiffTable (8 kỳ sai khác), InventoryAlertsTable (Top 10)
│   ├── pages/        # 3 Tab chức năng:
│   │                 # - EdaTab.jsx (Live Sales Stream + 4 Biểu đồ phân tích EDA)
│   │                 # - ForecastTab.jsx (Form chọn + Biểu đồ đối chiếu 2 đường + Bảng 8 kỳ)
│   │                 # - InventoryTab.jsx (Biểu đồ tròn tích lũy thời gian thực + 3 Thẻ KPI + Top 10 cảnh báo)
│   ├── utils/        # formatters.js ($, %, số, ngày tháng), chartTheme.js
│   ├── App.jsx       # Root shell: quản lý local state Sidebar thu gọn/mở rộng
│   └── main.jsx      # ReactDOM client mount điểm vào React 18
├── index.html        # HTML5 entrypoint với Google Fonts, Tailwind và Chart.js CDN
├── vite.config.js    # Cấu hình Vite build
└── package.json      # Dependencies React 18 & Vite
```

---

## 🌟 Chức Năng 3 Tab Chi Tiết

1. **Tab 1: Khám Phá Dữ Liệu & Streaming Bán Hàng (EDA & Streaming)**
   - **Streaming Real-time**: Polling 2s/lần lấy 20 dòng ngẫu nhiên từ file sales, prepend lên đầu bảng (giới hạn trần 100 dòng).
   - **4 Biểu đồ Chart.js**: Doanh thu theo tháng (Line), Top 10 danh mục bán chạy (Bar ngang), Phân bổ kênh bán hàng (Doughnut), Tỷ lệ hoàn trả theo nhóm sản phẩm (Bar).
2. **Tab 2: Dự Báo Nhu Cầu Bán Lẻ (Forecast Comparison)**
   - Dropdowns chọn Category & Store từ dữ liệu, nhập số kỳ dự báo (4–24 kỳ).
   - Chạy song song 2 thuật toán:
     - **Normal Forecast**: Moving Average cơ bản ($N=4$).
     - **Super Forecast**: Weighted Moving Average (trọng số 1-2-3-4) + Seasonality Factor từng tháng.
   - Trực quan hóa: Biểu đồ đường kép (Normal xanh `#0284c7`, Super cam `#f97316`) và bảng đối soát **8 kỳ sai khác đầu tiên** (so sánh chuẩn `toFixed(2)`).
3. **Tab 3: Quản Lý Tồn Kho Thông Minh Thời Gian Thực (Smart Inventory)**
   - Phân loại tồn kho theo doanh số 30 ngày qua (`avgDailySales`):
     - 🟢 **Healthy**: $\ge 14$ ngày bán (hoặc chưa có lịch sử bán).
     - 🟠 **Low Stock**: $< 14$ ngày bán (nguy cơ đứt hàng).
     - 🔴 **Overstock**: $\ge 60$ ngày bán (ứ đọng vốn).
   - **Biểu đồ Doughnut Tích lũy**: Cộng dồn batch 50 items mỗi 2s vào `cumulativeState` trên RAM máy chủ (không reset khi reload client).
   - **Bảng Cảnh Báo Top 10**: Ưu tiên cảnh báo Low Stock (🔴 Khẩn cấp) trước Overstock (🟡 Chú ý).

---

## 🛠 Hướng Dẫn Vận Hành

### 1. Chạy Backend (Node.js)
```powershell
cd bigdata_inventory
npm install
npm start
```
*Backend sẽ nạp ~410.000 dòng CSV vào RAM trong ~9 giây và lắng nghe tại `http://localhost:3000`.*

### 2. Chạy Frontend (React Dev Server)
```powershell
cd bigdata_inventory/frontend
npm install
npm run dev
```
*Giao diện mở tại `http://localhost:3001` (đã cấu hình proxy `/api` sang `:3000`).*

Hoặc build production bundle:
```powershell
npm run build
```

### 3. Triển Khai Hoàn Chỉnh Bằng Docker Compose
```powershell
cd bigdata_inventory
docker-compose up --build -d
```
- **Frontend (Nginx Alpine)**: [http://localhost:3001](http://localhost:3001)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

### 4. Chạy Kiểm Thử Tự Động
```powershell
cd bigdata_inventory
node test_endpoints.js --unit-only   # Chạy nhanh thuật toán & pipeline
node test_endpoints.js               # Chạy full E2E 129 bài test
```
