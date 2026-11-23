"""
Bronze Medallion Layer
Ingests raw CSVs (or streaming batches) into immutable ZSTD-compressed Parquet files
with ingestion lineage metadata (_ingest_id, _ingest_ts, _source_system, _schema_version, _raw_payload_hash).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

import duckdb


def build_bronze_layer(data_dir: Path, lakehouse_dir: Path) -> Dict[str, int]:
    sales_csv = data_dir / "retail_sales_ml_apl.csv"
    inventory_csv = data_dir / "retail_inventory_ml_apl.csv"
    bronze_dir = lakehouse_dir / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)

    if not sales_csv.exists():
        raise FileNotFoundError(f"Missing sales CSV: {sales_csv}")
    if not inventory_csv.exists():
        raise FileNotFoundError(f"Missing inventory CSV: {inventory_csv}")

    ingest_id = str(uuid.uuid4())
    ingest_ts = datetime.now(timezone.utc).isoformat()
    sales_parquet = bronze_dir / "sales_raw.parquet"
    inv_parquet = bronze_dir / "inventory_raw.parquet"

    con = duckdb.connect(database=":memory:")
    try:
        # Ingest Sales CSV preserving all 17 raw columns verbatim + ingestion metadata
        con.execute(
            f"""
            COPY (
                SELECT
                    *,
                    '{ingest_id}' AS _ingest_id,
                    TIMESTAMP '{ingest_ts}' AS _ingest_ts,
                    'batch_csv' AS _source_system,
                    1 AS _schema_version,
                    sha256(
                        COALESCE(CAST("Transaction Date" AS VARCHAR), '') || '|' ||
                        COALESCE("Product No", '') || '|' ||
                        COALESCE("Store", '') || '|' ||
                        COALESCE(CAST("Qty Sold" AS VARCHAR), '') || '|' ||
                        COALESCE(CAST("Sales Amount" AS VARCHAR), '')
                    ) AS _raw_payload_hash,
                    SUBSTR(CAST("Transaction Date" AS VARCHAR), 1, 7) AS ingestion_month
                FROM read_csv_auto('{sales_csv.as_posix()}', header=true, all_varchar=true)
            ) TO '{sales_parquet.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        # Ingest Inventory CSV preserving all 18 raw columns verbatim + ingestion metadata
        con.execute(
            f"""
            COPY (
                SELECT
                    *,
                    '{ingest_id}' AS _ingest_id,
                    TIMESTAMP '{ingest_ts}' AS _ingest_ts,
                    'batch_csv' AS _source_system,
                    1 AS _schema_version,
                    sha256(
                        COALESCE(CAST("Start Date" AS VARCHAR), '') || '|' ||
                        COALESCE(CAST("End Date" AS VARCHAR), '') || '|' ||
                        COALESCE("Product No", '') || '|' ||
                        COALESCE("Store", '') || '|' ||
                        COALESCE(CAST("Qty on hand" AS VARCHAR), '')
                    ) AS _raw_payload_hash,
                    SUBSTR(CAST("Start Date" AS VARCHAR), 1, 7) AS ingestion_month
                FROM read_csv_auto('{inventory_csv.as_posix()}', header=true, all_varchar=true)
            ) TO '{inv_parquet.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        sales_count = con.execute(f"SELECT COUNT(*) FROM read_parquet('{sales_parquet.as_posix()}')").fetchone()[0]
        inv_count = con.execute(f"SELECT COUNT(*) FROM read_parquet('{inv_parquet.as_posix()}')").fetchone()[0]
    finally:
        con.close()

    return {
        "bronze_sales_rows": int(sales_count),
        "bronze_inventory_rows": int(inv_count),
        "ingest_id": ingest_id,
    }
