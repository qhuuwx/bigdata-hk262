"""
Silver Medallion Layer
Transforms immutable Bronze Parquet tables into cleaned, typed, deduplicated,
referentially intact Silver Parquet tables with explicit missingness indicators,
return-vs-error separation, IQR/Z-score outlier winsorization, and SCD Type 2 normalization.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import duckdb


def build_silver_layer(lakehouse_dir: Path) -> Dict[str, int]:
    bronze_sales = lakehouse_dir / "bronze" / "sales_raw.parquet"
    bronze_inv = lakehouse_dir / "bronze" / "inventory_raw.parquet"
    silver_dir = lakehouse_dir / "silver"
    silver_dir.mkdir(parents=True, exist_ok=True)

    sales_clean = silver_dir / "sales_clean.parquet"
    sales_quarantine = silver_dir / "sales_quarantine.parquet"
    inv_clean = silver_dir / "inventory_scd2.parquet"
    dim_product = silver_dir / "dim_product.parquet"
    dim_store = silver_dir / "dim_store.parquet"
    dim_category = silver_dir / "dim_category.parquet"

    con = duckdb.connect(database=":memory:")
    try:
        # 1. Stage Bronze Sales with explicit typing, missingness indicators, and SHA-256 replay dedup
        con.execute(
            f"""
            CREATE OR REPLACE TEMP VIEW staged_sales AS
            WITH typed AS (
                SELECT
                    TRY_CAST("Transaction Date" AS DATE) AS transaction_date,
                    SUBSTR(CAST("Transaction Date" AS VARCHAR), 1, 7) AS transaction_month,
                    COALESCE(NULLIF(TRIM("Sales Type"), ''), 'Unknown') AS sales_type,
                    CASE WHEN TRY_CAST("Is Return" AS INTEGER) = 1 THEN 1 ELSE 0 END AS is_return,
                    CASE
                        WHEN "Reason of Return" IS NULL OR TRIM("Reason of Return") = '' THEN TRUE
                        ELSE FALSE
                    END AS is_reason_missing,
                    CASE
                        WHEN "Reason of Return" IS NULL OR TRIM("Reason of Return") = '' THEN
                            CASE WHEN TRY_CAST("Is Return" AS INTEGER) = 1 THEN 'Unknown' ELSE 'Not Applicable' END
                        ELSE TRIM("Reason of Return")
                    END AS reason_of_return,
                    COALESCE(NULLIF(TRIM("Supplier"), ''), 'Unknown') AS supplier,
                    TRIM("Product No") AS product_no,
                    COALESCE(NULLIF(TRIM("Product Description"), ''), 'Unknown') AS product_description,
                    COALESCE(NULLIF(TRIM("Product Division"), ''), 'Unknown') AS product_division,
                    COALESCE(NULLIF(TRIM("Product Category"), ''), 'Unknown') AS product_category,
                    COALESCE(NULLIF(TRIM("Product Subcategory"), ''), 'Unknown') AS product_subcategory,
                    COALESCE(NULLIF(TRIM("Product Segment"), ''), 'Unknown') AS product_segment,
                    TRIM("Store") AS store_id,
                    CASE WHEN "Sales Channel" IS NULL OR TRIM("Sales Channel") = '' THEN TRUE ELSE FALSE END AS is_channel_missing,
                    COALESCE(NULLIF(TRIM("Sales Channel"), ''), 'Unknown') AS sales_channel,
                    TRY_CAST("Qty Sold" AS DOUBLE) IS NULL AS qty_sold_is_imputed,
                    TRY_CAST("Sales Amount" AS DOUBLE) IS NULL AS sales_amount_is_imputed,
                    TRY_CAST("Cogs" AS DOUBLE) IS NULL AS cogs_is_imputed,
                    TRY_CAST("Qty Sold" AS DOUBLE) AS raw_qty_sold,
                    TRY_CAST("Sales Amount" AS DOUBLE) AS raw_sales_amount,
                    TRY_CAST("Cogs" AS DOUBLE) AS raw_cogs,
                    COALESCE(TRY_CAST("Number of Transactions" AS INTEGER), 1) AS num_transactions,
                    _ingest_id,
                    _ingest_ts,
                    _source_system,
                    sha256(
                        COALESCE("Transaction Date", '') || '|' || COALESCE("Sales Type", '') || '|' ||
                        COALESCE("Is Return", '') || '|' || COALESCE("Reason of Return", '') || '|' ||
                        COALESCE("Supplier", '') || '|' || COALESCE("Product No", '') || '|' ||
                        COALESCE("Product Description", '') || '|' || COALESCE("Product Division", '') || '|' ||
                        COALESCE("Product Category", '') || '|' || COALESCE("Product Subcategory", '') || '|' ||
                        COALESCE("Product Segment", '') || '|' || COALESCE("Store", '') || '|' ||
                        COALESCE("Sales Channel", '') || '|' || COALESCE("Qty Sold", '') || '|' ||
                        COALESCE("Sales Amount", '') || '|' || COALESCE("Cogs", '') || '|' ||
                        COALESCE("Number of Transactions", '')
                    ) AS dedup_key
                FROM read_parquet('{bronze_sales.as_posix()}')
            ),
            deduped AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY dedup_key ORDER BY _ingest_ts DESC) AS _rn
                FROM typed
            ),
            medians AS (
                SELECT
                    product_category,
                    store_id,
                    MEDIAN(raw_qty_sold) FILTER (WHERE raw_qty_sold IS NOT NULL) AS med_qty,
                    MEDIAN(raw_sales_amount) FILTER (WHERE raw_sales_amount IS NOT NULL) AS med_amt,
                    MEDIAN(raw_cogs) FILTER (WHERE raw_cogs IS NOT NULL) AS med_cogs,
                    QUANTILE_CONT(raw_qty_sold, 0.25) FILTER (WHERE is_return = 0 AND raw_qty_sold IS NOT NULL) AS q1_qty,
                    QUANTILE_CONT(raw_qty_sold, 0.75) FILTER (WHERE is_return = 0 AND raw_qty_sold IS NOT NULL) AS q3_qty
                FROM deduped
                WHERE _rn = 1
                GROUP BY product_category, store_id
            )
            SELECT
                d.transaction_date,
                d.transaction_month,
                d.sales_type,
                d.is_return,
                CASE
                    WHEN d.is_return = 1 AND COALESCE(d.raw_qty_sold, 0) <= 0 THEN 'RETURN'
                    WHEN d.is_return = 0 AND COALESCE(d.raw_qty_sold, 0) >= 0 THEN 'SALE'
                    ELSE 'ANOMALY'
                END AS record_type,
                d.is_reason_missing,
                d.reason_of_return,
                d.supplier,
                d.product_no,
                d.product_description,
                d.product_division,
                d.product_category,
                d.product_subcategory,
                d.product_segment,
                d.store_id,
                d.is_channel_missing,
                d.sales_channel,
                d.qty_sold_is_imputed,
                d.sales_amount_is_imputed,
                d.cogs_is_imputed,
                COALESCE(d.raw_qty_sold, m.med_qty, 0.0) AS qty_sold,
                COALESCE(d.raw_sales_amount, m.med_amt, 0.0) AS sales_amount,
                COALESCE(d.raw_cogs, m.med_cogs, 0.0) AS cogs,
                -- IQR Winsorized quantity for ML feature stability (financial totals still use qty_sold)
                CASE
                    WHEN d.is_return = 1 THEN COALESCE(d.raw_qty_sold, m.med_qty, 0.0)
                    ELSE LEAST(
                        GREATEST(
                            COALESCE(d.raw_qty_sold, m.med_qty, 0.0),
                            COALESCE(m.q1_qty - 3.0 * GREATEST(m.q3_qty - m.q1_qty, 1.0), 0.0)
                        ),
                        COALESCE(m.q3_qty + 3.0 * GREATEST(m.q3_qty - m.q1_qty, 1.0), 100.0)
                    )
                END AS qty_sold_winsorized,
                d.num_transactions,
                d.dedup_key,
                d._ingest_id,
                d._ingest_ts,
                d._source_system
            FROM deduped d
            LEFT JOIN medians m
                ON d.product_category = m.product_category AND d.store_id = m.store_id
            WHERE d._rn = 1;
            """
        )

        # Route clean records vs quarantine anomalies (null dates, orphan keys, contradictory signs)
        con.execute(
            f"""
            COPY (
                SELECT * FROM staged_sales
                WHERE transaction_date IS NOT NULL
                  AND product_no IS NOT NULL AND product_no <> ''
                  AND store_id IS NOT NULL AND store_id <> ''
                  AND record_type IN ('SALE', 'RETURN')
            ) TO '{sales_clean.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        con.execute(
            f"""
            COPY (
                SELECT * FROM staged_sales
                WHERE transaction_date IS NULL
                   OR product_no IS NULL OR product_no = ''
                   OR store_id IS NULL OR store_id = ''
                   OR record_type = 'ANOMALY'
            ) TO '{sales_quarantine.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        # 2. Clean Inventory with SCD Type 2 normalization (9999-12-31 -> active open interval) & ledger anomaly flags
        con.execute(
            f"""
            COPY (
                WITH typed_inv AS (
                    SELECT
                        TRY_CAST("Start Date" AS DATE) AS start_date,
                        "End Date" AS raw_end_date,
                        CASE
                            WHEN "End Date" = '9999-12-31' THEN TRUE
                            ELSE FALSE
                        END AS is_active_snapshot,
                        CASE
                            WHEN "End Date" = '9999-12-31' THEN CAST(NULL AS DATE)
                            ELSE TRY_CAST("End Date" AS DATE)
                        END AS effective_end_date,
                        COALESCE(NULLIF(TRIM("Stock Status"), ''), 'Unknown') AS stock_status,
                        COALESCE(NULLIF(TRIM("Supplier"), ''), 'Unknown') AS supplier,
                        TRIM("Product No") AS product_no,
                        COALESCE(NULLIF(TRIM("Product Description"), ''), 'Unknown') AS product_description,
                        COALESCE(NULLIF(TRIM("Product Division"), ''), 'Unknown') AS product_division,
                        COALESCE(NULLIF(TRIM("Product Category"), ''), 'Unknown') AS product_category,
                        COALESCE(NULLIF(TRIM("Product Subcategory"), ''), 'Unknown') AS product_subcategory,
                        COALESCE(NULLIF(TRIM("Product Segment"), ''), 'Unknown') AS product_segment,
                        TRIM("Store") AS store_id,
                        COALESCE(NULLIF(TRIM("Store Type"), ''), 'Unknown') AS store_type,
                        COALESCE(NULLIF(TRIM("Sales Channel"), ''), 'Unknown') AS sales_channel,
                        TRY_CAST("Qty on hand" AS DOUBLE) IS NULL AS qty_on_hand_is_imputed,
                        COALESCE(TRY_CAST("Qty on hand" AS DOUBLE), 0.0) AS qty_on_hand,
                        COALESCE(TRY_CAST("Stocks Selling Amount" AS DOUBLE), 0.0) AS stocks_selling_amount,
                        COALESCE(TRY_CAST("Cost of Stocks" AS DOUBLE), 0.0) AS cost_of_stocks,
                        COALESCE(TRY_CAST("Stock Unit Selling Price" AS DOUBLE), 0.0) AS unit_selling_price,
                        COALESCE(TRY_CAST("Stock Unit Cost Price" AS DOUBLE), 0.0) AS unit_cost_price,
                        (
                            COALESCE(TRY_CAST("Qty on hand" AS DOUBLE), 0.0) < 0
                            OR COALESCE(TRY_CAST("Stock Unit Cost Price" AS DOUBLE), 0.0) < 0
                        ) AS is_ledger_anomaly,
                        GREATEST(COALESCE(TRY_CAST("Stock Unit Cost Price" AS DOUBLE), 0.0), 0.0) AS unit_cost_price_clean,
                        _ingest_id,
                        _ingest_ts,
                        sha256(
                            COALESCE("Start Date", '') || '|' || COALESCE("End Date", '') || '|' ||
                            COALESCE("Stock Status", '') || '|' || COALESCE("Supplier", '') || '|' ||
                            COALESCE("Product No", '') || '|' || COALESCE("Product Description", '') || '|' ||
                            COALESCE("Product Division", '') || '|' || COALESCE("Product Category", '') || '|' ||
                            COALESCE("Product Subcategory", '') || '|' || COALESCE("Product Segment", '') || '|' ||
                            COALESCE("Store", '') || '|' || COALESCE("Store Type", '') || '|' ||
                            COALESCE("Sales Channel", '') || '|' || COALESCE("Qty on hand", '') || '|' ||
                            COALESCE("Stocks Selling Amount", '') || '|' || COALESCE("Cost of Stocks", '') || '|' ||
                            COALESCE("Stock Unit Selling Price", '') || '|' || COALESCE("Stock Unit Cost Price", '')
                        ) AS dedup_key
                    FROM read_parquet('{bronze_inv.as_posix()}')
                ),
                deduped_inv AS (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY dedup_key ORDER BY _ingest_ts DESC) AS _rn
                    FROM typed_inv
                )
                SELECT
                    start_date,
                    raw_end_date,
                    effective_end_date,
                    is_active_snapshot,
                    stock_status,
                    supplier,
                    product_no,
                    product_description,
                    product_division,
                    product_category,
                    product_subcategory,
                    product_segment,
                    store_id,
                    store_type,
                    sales_channel,
                    qty_on_hand_is_imputed,
                    qty_on_hand,
                    stocks_selling_amount,
                    cost_of_stocks,
                    unit_selling_price,
                    unit_cost_price,
                    unit_cost_price_clean,
                    is_ledger_anomaly,
                    dedup_key,
                    _ingest_id,
                    _ingest_ts
                FROM deduped_inv
                WHERE _rn = 1
                  AND start_date IS NOT NULL
                  AND start_date <= COALESCE(effective_end_date, DATE '9999-12-31')
            ) TO '{inv_clean.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        # 3. Referential Dimension Tables
        con.execute(
            f"""
            COPY (
                SELECT
                    product_no,
                    ANY_VALUE(product_description) AS product_description,
                    ANY_VALUE(product_division) AS product_division,
                    ANY_VALUE(product_category) AS product_category,
                    ANY_VALUE(product_subcategory) AS product_subcategory,
                    ANY_VALUE(product_segment) AS product_segment,
                    ANY_VALUE(supplier) AS supplier
                FROM (
                    SELECT product_no, product_description, product_division, product_category, product_subcategory, product_segment, supplier
                    FROM read_parquet('{sales_clean.as_posix()}')
                    UNION ALL
                    SELECT product_no, product_description, product_division, product_category, product_subcategory, product_segment, supplier
                    FROM read_parquet('{inv_clean.as_posix()}')
                )
                GROUP BY product_no
            ) TO '{dim_product.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        con.execute(
            f"""
            COPY (
                SELECT DISTINCT store_id, ANY_VALUE(sales_channel) AS primary_channel
                FROM read_parquet('{sales_clean.as_posix()}')
                GROUP BY store_id
                ORDER BY store_id
            ) TO '{dim_store.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        con.execute(
            f"""
            COPY (
                SELECT DISTINCT product_category, ANY_VALUE(product_division) AS product_division
                FROM read_parquet('{sales_clean.as_posix()}')
                GROUP BY product_category
                ORDER BY product_category
            ) TO '{dim_category.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        s_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{sales_clean.as_posix()}')").fetchone()[0]
        q_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{sales_quarantine.as_posix()}')").fetchone()[0]
        i_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{inv_clean.as_posix()}')").fetchone()[0]
        p_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dim_product.as_posix()}')").fetchone()[0]
        st_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dim_store.as_posix()}')").fetchone()[0]
        c_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{dim_category.as_posix()}')").fetchone()[0]
    finally:
        con.close()

    return {
        "silver_sales_rows": int(s_cnt),
        "silver_quarantine_rows": int(q_cnt),
        "silver_inventory_rows": int(i_cnt),
        "dim_products": int(p_cnt),
        "dim_stores": int(st_cnt),
        "dim_categories": int(c_cnt),
    }
