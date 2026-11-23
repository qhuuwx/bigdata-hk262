"""
Gold Medallion Layer & Feature Store
Builds pre-aggregated OLAP marts (eda_cube_monthly, inventory_alerts_ranked,
forecast_series_monthly, ml_demand_features) in DuckDB/Parquet plus compact
JSON serving artifacts for sub-millisecond Node.js LakehouseRepository startup.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import duckdb


def build_gold_layer(lakehouse_dir: Path) -> Dict[str, Any]:
    silver_sales = lakehouse_dir / "silver" / "sales_clean.parquet"
    silver_inv = lakehouse_dir / "silver" / "inventory_scd2.parquet"
    dim_store = lakehouse_dir / "silver" / "dim_store.parquet"
    dim_category = lakehouse_dir / "silver" / "dim_category.parquet"

    gold_dir = lakehouse_dir / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)
    gold_db = gold_dir / "gold.duckdb"

    con = duckdb.connect(database=str(gold_db))
    try:
        # 1. Gold EDA Cube Monthly
        con.execute(
            f"""
            CREATE OR REPLACE TABLE eda_cube_monthly AS
            SELECT
                transaction_month AS month,
                store_id AS store,
                product_division AS division,
                product_category AS category,
                sales_channel AS channel,
                ROUND(SUM(sales_amount), 4) AS revenue,
                ROUND(SUM(cogs), 4) AS cogs,
                ROUND(SUM(qty_sold), 4) AS qty,
                COUNT(*) AS total_count,
                SUM(is_return) AS return_count
            FROM read_parquet('{silver_sales.as_posix()}')
            GROUP BY 1, 2, 3, 4, 5
            ORDER BY 1, 2, 4;
            """
        )

        # 2. Gold Dense Forecast Series (all 27 categories x 40 stores x 11 chronological months)
        con.execute(
            f"""
            CREATE OR REPLACE TABLE forecast_series_monthly AS
            WITH months AS (
                SELECT DISTINCT transaction_month AS month
                FROM read_parquet('{silver_sales.as_posix()}')
                ORDER BY 1
            ),
            pairs AS (
                SELECT c.product_category AS category, s.store_id AS store
                FROM read_parquet('{dim_category.as_posix()}') c
                CROSS JOIN read_parquet('{dim_store.as_posix()}') s
            ),
            raw_agg AS (
                SELECT
                    product_category AS category,
                    store_id AS store,
                    transaction_month AS month,
                    SUM(qty_sold) AS monthly_qty
                FROM read_parquet('{silver_sales.as_posix()}')
                GROUP BY 1, 2, 3
            )
            SELECT
                p.category,
                p.store,
                m.month,
                COALESCE(r.monthly_qty, 0.0) AS qty
            FROM pairs p
            CROSS JOIN months m
            LEFT JOIN raw_agg r
                ON p.category = r.category AND p.store = r.store AND m.month = r.month
            ORDER BY p.category, p.store, m.month;
            """
        )

        # 3. Gold Product 30-Day Sales Velocity & Inventory Classification Mart
        con.execute(
            f"""
            CREATE OR REPLACE TABLE prod_sales_30d AS
            WITH max_dt AS (
                SELECT MAX(transaction_date) AS max_date
                FROM read_parquet('{silver_sales.as_posix()}')
            )
            SELECT
                s.product_no,
                SUM(s.qty_sold) AS sales_30d,
                SUM(s.qty_sold) / 30.0 AS avg_daily_sales
            FROM read_parquet('{silver_sales.as_posix()}') s, max_dt
            WHERE s.transaction_date >= max_dt.max_date - INTERVAL 30 DAY
            GROUP BY 1;
            """
        )

        con.execute(
            f"""
            CREATE OR REPLACE TABLE inventory_health_daily AS
            SELECT
                i.start_date,
                i.raw_end_date,
                i.is_active_snapshot,
                i.stock_status AS price_tier,
                i.product_no,
                i.product_division AS division,
                i.product_category AS category,
                i.store_id AS store,
                i.qty_on_hand,
                i.unit_selling_price,
                i.unit_cost_price_clean,
                i.is_ledger_anomaly,
                COALESCE(p.sales_30d, 0.0) AS sales_30d,
                COALESCE(p.avg_daily_sales, 0.0) AS avg_daily_sales,
                CASE
                    WHEN COALESCE(p.avg_daily_sales, 0.0) <= 0 THEN 'healthy'
                    WHEN i.qty_on_hand >= p.avg_daily_sales * 60.0 THEN 'over'
                    WHEN i.qty_on_hand >= p.avg_daily_sales * 14.0 THEN 'healthy'
                    ELSE 'low'
                END AS stock_health,
                (COALESCE(p.avg_daily_sales, 0.0) <= 0 AND i.qty_on_hand > 0) AS is_dead_stock,
                CASE
                    WHEN COALESCE(p.avg_daily_sales, 0.0) > 0 THEN i.qty_on_hand / p.avg_daily_sales
                    ELSE 999.0
                END AS days_of_cover
            FROM read_parquet('{silver_inv.as_posix()}') i
            LEFT JOIN prod_sales_30d p
                ON i.product_no = p.product_no;
            """
        )

        # 4. Gold Deduplicated Top-10 Inventory Alerts (matching DataLoaderService business contract)
        con.execute(
            """
            CREATE OR REPLACE TABLE inventory_alerts_ranked AS
            WITH first_alerts AS (
                SELECT
                    category,
                    store,
                    qty_on_hand,
                    stock_health,
                    is_dead_stock,
                    ROW_NUMBER() OVER () AS seq_idx
                FROM inventory_health_daily
                WHERE stock_health IN ('low', 'over')
            ),
            dedup_low AS (
                SELECT category, store, qty_on_hand, stock_health, is_dead_stock, MIN(seq_idx) AS first_idx
                FROM first_alerts
                WHERE stock_health = 'low'
                GROUP BY 1, 2, 3, 4, 5
                LIMIT 10
            ),
            dedup_over AS (
                SELECT category, store, qty_on_hand, stock_health, is_dead_stock, MIN(seq_idx) AS first_idx
                FROM first_alerts
                WHERE stock_health = 'over'
                GROUP BY 1, 2, 3, 4, 5
                LIMIT 10
            )
            SELECT * FROM (
                SELECT * FROM dedup_low ORDER BY first_idx LIMIT 7
            )
            UNION ALL
            SELECT * FROM (
                SELECT * FROM dedup_over ORDER BY first_idx LIMIT 3
            );
            """
        )

        # 5. Gold ML Demand & Inventory Feature Store (7d/14d/30d rolling + seasonality + stock cover)
        con.execute(
            f"""
            CREATE OR REPLACE TABLE ml_demand_features AS
            WITH max_dt AS (
                SELECT MAX(transaction_date) AS max_date
                FROM read_parquet('{silver_sales.as_posix()}')
            ),
            prod_windows AS (
                SELECT
                    s.product_no,
                    s.store_id,
                    SUM(CASE WHEN s.transaction_date >= m.max_date - INTERVAL 7 DAY THEN s.qty_sold_winsorized ELSE 0 END) AS sales_7d,
                    SUM(CASE WHEN s.transaction_date >= m.max_date - INTERVAL 14 DAY THEN s.qty_sold_winsorized ELSE 0 END) AS sales_14d,
                    SUM(CASE WHEN s.transaction_date >= m.max_date - INTERVAL 30 DAY THEN s.qty_sold_winsorized ELSE 0 END) AS sales_30d,
                    AVG(CASE WHEN s.sales_type <> 'Full Price' THEN 1.0 ELSE 0.0 END) AS promo_ratio,
                    AVG(s.is_return * 1.0) AS historical_return_rate
                FROM read_parquet('{silver_sales.as_posix()}') s, max_dt m
                GROUP BY 1, 2
            ),
            cat_seasonality AS (
                SELECT
                    product_category,
                    EXTRACT(MONTH FROM transaction_date) AS month_num,
                    AVG(qty_sold) AS cat_month_avg
                FROM read_parquet('{silver_sales.as_posix()}')
                GROUP BY 1, 2
            )
            SELECT
                h.product_no,
                h.store,
                h.category,
                h.division,
                h.price_tier,
                EXTRACT(MONTH FROM h.start_date) AS start_month_num,
                SIN(2.0 * PI() * EXTRACT(MONTH FROM h.start_date) / 12.0) AS month_sin,
                COS(2.0 * PI() * EXTRACT(MONTH FROM h.start_date) / 12.0) AS month_cos,
                h.qty_on_hand,
                h.unit_selling_price,
                h.unit_cost_price_clean,
                CASE
                    WHEN h.unit_selling_price > 0
                    THEN (h.unit_selling_price - h.unit_cost_price_clean) / h.unit_selling_price
                    ELSE 0.0
                END AS gross_margin_pct,
                COALESCE(pw.sales_7d, 0.0) AS sales_7d,
                COALESCE(pw.sales_14d, 0.0) AS sales_14d,
                COALESCE(pw.sales_30d, 0.0) AS sales_30d,
                CASE
                    WHEN COALESCE(pw.sales_30d, 0.0) > 0
                    THEN (COALESCE(pw.sales_7d, 0.0) / 7.0) / (pw.sales_30d / 30.0)
                    ELSE 0.0
                END AS sales_velocity_ratio_7d_30d,
                COALESCE(pw.promo_ratio, 0.0) AS promo_ratio,
                COALESCE(pw.historical_return_rate, 0.0) AS historical_return_rate,
                COALESCE(cs.cat_month_avg, 0.0) AS cat_month_avg,
                h.avg_daily_sales,
                h.days_of_cover,
                h.is_dead_stock,
                h.is_ledger_anomaly,
                h.stock_health
            FROM inventory_health_daily h
            LEFT JOIN prod_windows pw
                ON h.product_no = pw.product_no AND h.store = pw.store_id
            LEFT JOIN cat_seasonality cs
                ON h.category = cs.product_category AND EXTRACT(MONTH FROM h.start_date) = cs.month_num;
            """
        )

        # Export Parquet snapshots
        for tbl in (
            "eda_cube_monthly",
            "forecast_series_monthly",
            "inventory_health_daily",
            "inventory_alerts_ranked",
            "ml_demand_features",
        ):
            con.execute(
                f"COPY {tbl} TO '{(gold_dir / (tbl + '.parquet')).as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);"
            )

        # Export compact JSON serving artifacts for Node.js LakehouseRepository (<100ms startup)
        cube_rows = con.execute(
            "SELECT month, store, division, category, channel, revenue, cogs, qty, total_count, return_count FROM eda_cube_monthly"
        ).fetchall()
        cube_json = [
            {
                "month": r[0],
                "store": r[1],
                "division": r[2],
                "category": r[3],
                "channel": r[4],
                "revenue": float(r[5]),
                "cogs": float(r[6]),
                "qty": float(r[7]),
                "totalCount": int(r[8]),
                "returnCount": int(r[9]),
            }
            for r in cube_rows
        ]

        months = [r[0] for r in con.execute("SELECT DISTINCT month FROM eda_cube_monthly ORDER BY 1").fetchall()]
        stores = [r[0] for r in con.execute(f"SELECT store_id FROM read_parquet('{dim_store.as_posix()}') ORDER BY 1").fetchall()]
        categories = [r[0] for r in con.execute(f"SELECT product_category FROM read_parquet('{dim_category.as_posix()}') ORDER BY 1").fetchall()]
        divisions = sorted({c["division"] for c in cube_json if c["division"]})

        # Build forecast series lookup map
        fc_rows = con.execute(
            "SELECT category, store, month, qty FROM forecast_series_monthly ORDER BY category, store, month"
        ).fetchall()
        forecast_series: Dict[str, Dict[str, Any]] = {}
        temp_grouped: Dict[str, List[tuple]] = {}
        for cat, st, m, q in fc_rows:
            key = f"{cat}:::{st}"
            temp_grouped.setdefault(key, []).append((m, float(q)))

        for key, items in temp_grouped.items():
            history = [q for _, q in items]
            overall_avg = sum(history) / len(history) if history else 0.0
            m_sum = [0.0] * 12
            m_cnt = [0] * 12
            for m, q in items:
                m_idx = int(m.split("-")[1]) - 1
                m_sum[m_idx] += q
                m_cnt[m_idx] += 1
            monthly_avg = [
                (m_sum[i] / m_cnt[i]) if m_cnt[i] > 0 else overall_avg for i in range(12)
            ]
            forecast_series[key] = {
                "history": history,
                "monthlyAvg": monthly_avg,
                "overallAvg": overall_avg,
            }

        # Alerts JSON
        alert_rows = con.execute(
            "SELECT category, store, qty_on_hand, stock_health, is_dead_stock FROM inventory_alerts_ranked"
        ).fetchall()
        alerts_json = []
        for cat, st, qty, health, dead in alert_rows:
            is_low = health == "low"
            status_label = "Low Stock" if is_low else "Overstock"
            alerts_json.append(
                {
                    "category": cat,
                    "store": st,
                    "qtyOnHand": float(qty),
                    "status": status_label,
                    "stockStatus": status_label,
                    "Stock Status": status_label,
                    "level": "🔴 Khẩn cấp" if is_low else "🟡 Chú ý",
                    "isDeadStock": bool(dead),
                }
            )

        # Compact stream sample pools (5,000 sales + 5,000 classified inventory items for Lakehouse mode)
        sales_sample_rows = con.execute(
            f"""
            SELECT
                CAST(transaction_date AS VARCHAR) AS "Transaction Date",
                product_division AS "Product Division",
                product_category AS "Product Category",
                store_id AS "Store",
                sales_channel AS "Sales Channel",
                qty_sold AS "Qty Sold",
                sales_amount AS "Sales Amount",
                product_no AS "Product No",
                is_return AS "Is Return"
            FROM read_parquet('{silver_sales.as_posix()}')
            USING SAMPLE 5000 ROWS (RESERVOIR, 42);
            """
        ).fetchall()
        sales_sample = [
            {
                "Transaction Date": r[0],
                "Product Division": r[1],
                "Product Category": r[2],
                "Store": r[3],
                "Sales Channel": r[4],
                "Qty Sold": float(r[5]),
                "Sales Amount": float(r[6]),
                "Product No": r[7],
                "Is Return": int(r[8]),
            }
            for r in sales_sample_rows
        ]

        inv_sample_rows = con.execute(
            """
            SELECT product_no, category, store, qty_on_hand, avg_daily_sales, stock_health, is_dead_stock
            FROM inventory_health_daily
            USING SAMPLE 5000 ROWS (RESERVOIR, 42);
            """
        ).fetchall()
        inv_sample = [
            {
                "Product No": r[0],
                "Product Category": r[1],
                "Store": r[2],
                "Qty on hand": float(r[3]),
                "avgDailySales": float(r[4]),
                "stockHealth": r[5],
                "isDeadStock": bool(r[6]),
            }
            for r in inv_sample_rows
        ]

        counts = {
            "salesCount": int(con.execute(f"SELECT COUNT(*) FROM read_parquet('{silver_sales.as_posix()}')").fetchone()[0]),
            "inventoryCount": int(con.execute(f"SELECT COUNT(*) FROM read_parquet('{silver_inv.as_posix()}')").fetchone()[0]),
            "edaCubeCells": len(cube_json),
            "forecastPairs": len(forecast_series),
            "alertsCount": len(alerts_json),
            "mlFeatureRows": int(con.execute("SELECT COUNT(*) FROM ml_demand_features").fetchone()[0]),
        }

        serving_bundle = {
            "meta": {
                **counts,
                "months": months,
                "stores": stores,
                "categories": categories,
                "divisions": divisions,
            },
            "edaCube": cube_json,
            "forecastSeries": forecast_series,
            "alerts": alerts_json,
            "salesSample": sales_sample,
            "inventorySample": inv_sample,
        }

        with (gold_dir / "serving_bundle.json").open("w", encoding="utf-8") as fh:
            json.dump(serving_bundle, fh)

    finally:
        con.close()

    return counts
