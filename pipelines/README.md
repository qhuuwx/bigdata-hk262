# Enterprise Medallion Data Pipeline (`pipelines/`)

Thư mục `pipelines/` hiện thực hóa kiến trúc **Medallion Lakehouse (`Bronze` → `Silver` → `Gold`)** dựa trên **DuckDB**, **Apache Parquet (ZSTD)**, **JSON Schema + Dead-Letter Queue (DLQ)**, **Data Quality Gates** và **Dagster** cho hệ thống `bigdata_inventory`.

---

## 1. Cấu trúc Thư mục

```text
pipelines/
├── config.py                  # Cấu hình đường dẫn Lakehouse, ngưỡng chất lượng & hằng số
├── schemas/
│   ├── sales_event.schema.json        # JSON Schema cho giao dịch bán hàng
│   ├── inventory_snapshot.schema.json # JSON Schema cho bản ghi tồn kho
│   └── validator.py                   # Bộ kiểm tra schema & định tuyến bản ghi lỗi sang DLQ
├── streaming/
│   ├── kafka_producer.py      # Bộ phát sự kiện streaming (Redpanda / Kafka hoặc JSONL local)
│   └── stream_processor.py    # Bộ xử lý micro-batch có khử trùng lặp SHA-256 idempotency
├── medallion/
│   ├── bronze.py              # Tầng Bronze: Nạp raw CSV -> ZSTD Parquet kèm metadata kiểm toán
│   ├── silver.py              # Tầng Silver: Chuẩn hóa kiểu, xử lý ngày 9999-12-31, khử trùng lặp, gắn cờ ngoại lai IQR
│   └── gold.py                # Tầng Gold: Star schema (dim_store, dim_category, fact_*) & xuất serving_bundle.json
├── quality/
│   ├── gates.py               # Cổng kiểm định chất lượng dữ liệu (chặn xuất bản nếu vi phạm)
│   └── drift.py               # Giám sát trôi dạt phân phối (Population Stability Index - PSI & KS test)
├── orchestration/
│   └── dagster_defs.py        # Định nghĩa DAG tài sản dữ liệu (Dagster Software-Defined Assets)
├── tests/
│   └── test_pipeline.py       # Bộ kiểm thử pytest (15 bài kiểm thử toàn diện)
├── requirements.txt           # Danh sách thư viện Python
└── run_pipeline.py            # CLI chạy toàn bộ luồng Bronze -> Silver -> Gold -> Quality -> Drift
```

---

## 2. Luồng Xử lý Dữ liệu qua 3 Tầng Medallion

1. **Tầng Bronze (`pipelines/medallion/bronze.py`)**:
   - Đọc `data/retail_sales_ml_apl.csv` (`125.751` dòng) và `data/retail_inventory_ml_apl.csv` (`284.755` dòng).
   - Bổ sung các cột kiểm toán: `_ingested_at`, `_source_file`, `_batch_id`, `_row_number`, và `_record_hash` (`MD5` business key).
   - Lưu trữ định dạng cột nén `ZSTD Parquet` tại `data/lakehouse/bronze/`.

2. **Tầng Silver (`pipelines/medallion/silver.py`)**:
   - **Chuẩn hóa chuỗi & danh mục**: Cắt khoảng trắng (`TRIM`), điền giá trị khuyết danh mục bằng `"Unknown"` kèm cờ `_is_imputed`.
   - **Xử lý thời gian**: Chuyển đổi ngày tháng, giữ nguyên ngữ nghĩa giá trị sentinel `9999-12-31` qua cờ `is_current_price_window = TRUE` thay vì ép kiểu lỗi.
   - **Phân tách hoàn trả & ngoại lai**: Tách giao dịch hoàn trả hợp lệ (`Qty Sold < 0` → `is_return_txn = TRUE`) khỏi nhiễu dữ liệu và gắn cờ ngoại lai theo ngưỡng tứ phân vị (`IQR`).

3. **Tầng Gold (`pipelines/medallion/gold.py`)**:
   - Xây dựng mô hình Star Schema (`dim_store`, `dim_category`, `gold_monthly_sales_cube`, `gold_category_store_monthly`, `gold_inventory_Serving`).
   - Kết xuất gói phục vụ tốc độ cao `data/lakehouse/gold/serving_bundle.json` tương thích 100% với tầng Repository của Node.js (`backend/repositories/lakehouseRepository.js`).

---

## 3. Hướng dẫn Chạy & Kiểm thử

```bash
# Chạy toàn bộ pipeline Medallion (Bronze -> Silver -> Gold + Quality Gates + Drift Report)
pipelines/.venv/bin/python pipelines/run_pipeline.py

# Chạy bộ kiểm thử tự động (15 passed)
pipelines/.venv/bin/pytest pipelines/tests -v

# Chạy đối chiếu tương đương 100% giữa In-Memory CSV và Gold Lakehouse trên Backend Node.js
npm run test:parity
```

Để khởi chạy Backend Node.js đọc trực tiếp từ tầng Gold Lakehouse:
```bash
DATA_BACKEND=lakehouse npm start
# hoặc chạy chế độ Shadow (so sánh ngầm giữa Memory và Lakehouse trên mỗi request):
DATA_BACKEND=shadow npm start
```
