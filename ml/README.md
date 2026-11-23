# End-to-End Machine Learning Pipeline (`ml/`)

Thư mục `ml/` cung cấp hệ thống huấn luyện, kiểm định chéo không rò rỉ dữ liệu (leak-free cross-validation) và phục vụ suy luận thời gian thực cho **2 bài toán cốt lõi** của `bigdata_inventory`:
1. **Dự báo nhu cầu theo chuỗi thời gian (`Demand Forecasting`)** trên `1.080` chuỗi `Category × Store` (`27` danh mục × `40` cửa hàng).
2. **Phân loại rủi ro tồn kho & hoàn trả (`Inventory Risk & Return Classification`)** với kỹ thuật cân bằng mẫu thiểu số **`SMOTENC`** và **`ADASYN`** cô lập nghiêm ngặt trong từng fold huấn luyện.

---

## 1. Cấu trúc Thư mục

```text
ml/
├── feature_engineering.py     # Trích xuất đặc trưng trễ nhân quả (lags 1..4), thống kê trượt, mùa vụ, độ bao phủ tồn kho
├── train_forecast.py          # Huấn luyện & đánh giá Expanding-Window Time-Series CV (10 mô hình + 80% CI)
├── train_classifiers.py       # Huấn luyện Stratified 5-Fold CV kèm SMOTENC / ADASYN cô lập trong từng fold
├── predict.py                 # CLI & cầu nối JSON suy luận trực tiếp cho endpoint POST /api/ml/classify-inventory
├── run_ml_pipeline.py         # Script điều phối huấn luyện toàn trình & xuất báo cáo thực nghiệm
├── artifacts/
│   ├── best_forecaster.joblib         # Mô hình dự báo tốt nhất đã đóng gói
│   ├── best_stock_classifier.joblib   # Mô hình phân loại rủi ro tồn kho tốt nhất (CatBoost + SMOTENC)
│   ├── best_return_classifier.joblib  # Mô hình dự báo hoàn trả tốt nhất
│   ├── model_comparison_report.json   # Bảng điểm thực nghiệm đầy đủ được phục vụ qua GET /api/ml/metrics
│   ├── ml_predictions_cache.json      # Bộ đệm dự báo 24 kỳ + khoảng tin cậy 80% cho toàn bộ 1.080 cặp (Category, Store)
│   └── ML_MODEL_REPORT.md             # Báo cáo chi tiết phương pháp luận và kết quả thực nghiệm
└── tests/
    └── test_ml_pipeline.py    # Bộ kiểm thử pytest (10 assertions kiểm tra tính nhân quả & chống data leakage)
```

---

## 2. Kết quả Thực nghiệm Nổi bật

### 2.1. Dự báo Nhu cầu (Expanding-Window Time-Series CV)
- Đánh giá trên `4` cửa sổ thời gian mở rộng liên tiếp (`Train [0..t] -> Val [t+1]`) với kỹ thuật khử nhiễu đỉnh lễ hội nhân quả trong tập huấn luyện.
- **`Ridge_Tuned` (với đặc trưng trễ nhân quả, trung vị trượt và mã hóa mùa vụ)** đạt **`MAE = 4,5316`**, **`RMSE = 6,7538`**, **`WAPE = 28,28%`**:
  - Giảm **`17,06%` MAE** so với baseline **Normal Forecast (SMA-4)** (`MAE = 5,4637`).
  - Giảm **`17,51%` MAE** so với baseline **Super Forecast (WMA + Seasonality)** (`MAE = 5,4936`).
- Cung cấp dải dự báo phân vị **80% Confidence Interval (`[mlLower80, mlUpper80]`)** thông qua Quantile Gradient Boosting (`alpha = 0.10` và `alpha = 0.90`).

### 2.2. Phân loại Rủi ro Tồn kho với `SMOTENC` & `ADASYN` (Stratified 5-Fold CV)
- Mọi bước biến đổi `OrdinalEncoder`, `StandardScaler` và sinh mẫu tổng hợp `SMOTENC(categorical_features=...)` / `ADASYN` chỉ được gọi `.fit_resample()` trên `X_train_fold`, giữ `X_val_fold` hoàn toàn nguyên bản để ngăn chặn rò rỉ dữ liệu.
- **`CatBoost + SMOTENC`** đạt hiệu năng cao nhất trên bài toán phân lớp 3 trạng thái tồn kho (`Healthy`, `Low Stock`, `Overstock`):
  - **`Macro-F1 = 0,9988 ± 0,0005`**
  - **`Balanced Accuracy = 0,9985`**
  - **`Low Stock Recall = 0,9992`**
  - **`PR-AUC (Macro) = 0,9998`**

---

## 3. Tích hợp API Backend & Giao diện Frontend

Backend Node.js (`backend/services/mlService.js`) kết nối trực tiếp với các tạo phẩm trong `ml/artifacts/` và cầu nối `ml/predict.py`:
- `GET /api/ml/metrics`: Trả về toàn bộ bảng điểm thực nghiệm, danh sách đặc trưng và cấu hình kiểm định chéo để hiển thị trên thẻ **Empirical ML Benchmark** tại `ForecastTab.jsx`.
- `POST /api/ml/forecast` (và trường mở rộng `mlForecast`, `mlLower80`, `mlUpper80` trong `POST /api/forecast`): Phục vụ chuỗi dự báo ML `4`–`24` kỳ với độ trễ `< 2ms` từ bộ đệm O(1) `ml_predictions_cache.json`.
- `POST /api/ml/classify-inventory`: Thực thi suy luận xác suất rủi ro tồn kho (`Healthy` / `Low Stock` / `Overstock`) cho công cụ **ML Probabilistic Stock-Risk Simulator** trên `InventoryTab.jsx`.

---

## 4. Hướng dẫn Chạy Huấn luyện & Kiểm thử

```bash
# 1. Chạy lại toàn bộ luồng trích xuất đặc trưng, huấn luyện, đánh giá CV và xuất artifacts
pipelines/.venv/bin/python ml/run_ml_pipeline.py

# 2. Kiểm thử suy luận CLI trực tiếp
pipelines/.venv/bin/python ml/predict.py --mode classify --payload '{"stock":8,"sales30d":36,"replenishFlag":1,"category":"Running","store":"STR-1001"}'

# 3. Chạy bộ kiểm thử pytest (10 assertions kiểm tra chống data leakage & schema tạo phẩm)
pipelines/.venv/bin/pytest ml/tests -v
```
