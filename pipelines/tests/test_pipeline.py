"""
Enterprise Pipeline Unit & Integration Tests (pytest)
Covers:
  - Schema validation & DLQ routing for malformed events
  - Missingness indicator flags & categorical/numeric imputation
  - Signed return vs. anomaly separation & quarantine
  - 9999-12-31 SCD Type 2 normalization
  - Gold revenue reconciliation & deduplicated Top-10 alert contracts
  - Strict zero-leakage verification for SMOTENC inside TimeSeriesSplit CV folds
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import duckdb
import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipelines.schemas.validator import validate_and_route_batch, validate_event
from pipelines.streaming.stream_processor import process_stream_microbatch
from pipelines.ml.train_imbalanced import train_inventory_risk_smotenc, train_return_risk_adasyn
from pipelines.quality.gates import run_quality_gates

LAKEHOUSE_DIR = ROOT_DIR / "data" / "lakehouse"


def test_schema_validation_and_dlq_routing(tmp_path: Path):
    valid_sale = {
        "Transaction Date": "2026-04-01",
        "Sales Type": "Full Price",
        "Is Return": 0,
        "Reason of Return": None,
        "Product No": "PROD-139867",
        "Product Division": "Scholar Footwear",
        "Product Category": "Scholar Footwear Trailblazer",
        "Store": "STR-1006",
        "Sales Channel": "Channel Alpha",
        "Qty Sold": 1.0,
        "Sales Amount": 115.0,
        "Cogs": 52.31,
        "Number of Transactions": 1,
    }
    bad_sale_missing_store = {**valid_sale, "Store": "INVALID_STORE"}
    bad_sale_nan_qty = {**valid_sale, "Qty Sold": "not-a-number"}

    ok, errs = validate_event(valid_sale, "sales")
    assert ok and errs == []

    res = process_stream_microbatch(
        [valid_sale, bad_sale_missing_store, bad_sale_nan_qty],
        stream_type="sales",
        lakehouse_dir=tmp_path,
    )
    assert res["valid_count"] == 1
    assert res["dlq_count"] == 2
    assert res["sla_breached"] is True

    dlq_file = tmp_path / "dlq" / "dlq_retail_events.jsonl"
    assert dlq_file.exists()
    lines = dlq_file.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 2
    assert json.loads(lines[0])["dlq_topic"] == "dlq.retail.events"


@pytest.mark.skipif(not (LAKEHOUSE_DIR / "gold" / "serving_bundle.json").exists(), reason="Lakehouse not built yet")
def test_silver_missingness_returns_and_scd2():
    con = duckdb.connect(":memory:")
    try:
        silver_sales = (LAKEHOUSE_DIR / "silver" / "sales_clean.parquet").as_posix()
        silver_inv = (LAKEHOUSE_DIR / "silver" / "inventory_scd2.parquet").as_posix()

        # Verify 100% missingness of Reason of Return captured with explicit flag
        missing_count, total_count = con.execute(
            f"SELECT SUM(CASE WHEN is_reason_missing THEN 1 ELSE 0 END), COUNT(*) FROM read_parquet('{silver_sales}')"
        ).fetchone()
        assert total_count == 125751
        assert missing_count == 125751

        # Verify signed returns separated cleanly (7,491 returns, 0 anomalies in clean table)
        ret_cnt, anom_cnt = con.execute(
            f"""
            SELECT
                SUM(CASE WHEN record_type = 'RETURN' THEN 1 ELSE 0 END),
                SUM(CASE WHEN record_type = 'ANOMALY' THEN 1 ELSE 0 END)
            FROM read_parquet('{silver_sales}')
            """
        ).fetchone()
        assert ret_cnt == 7491
        assert anom_cnt == 0

        # Verify 9999-12-31 sentinel normalized to is_active_snapshot = TRUE & effective_end_date IS NULL
        active_cnt = con.execute(
            f"""
            SELECT COUNT(*) FROM read_parquet('{silver_inv}')
            WHERE raw_end_date = '9999-12-31' AND is_active_snapshot = TRUE AND effective_end_date IS NULL
            """
        ).fetchone()[0]
        assert active_cnt == 22701
    finally:
        con.close()


@pytest.mark.skipif(not (LAKEHOUSE_DIR / "gold" / "serving_bundle.json").exists(), reason="Lakehouse not built yet")
def test_quality_gates_pass():
    report = run_quality_gates(LAKEHOUSE_DIR)
    assert report["passed"] is True
    assert all(c["passed"] for c in report["checks"])


@pytest.mark.skipif(not (LAKEHOUSE_DIR / "gold" / "ml_demand_features.parquet").exists(), reason="Gold features not built")
def test_smotenc_and_adasyn_zero_test_leakage():
    inv_report = train_inventory_risk_smotenc(LAKEHOUSE_DIR, max_sample_rows=9000)
    ret_report = train_return_risk_adasyn(LAKEHOUSE_DIR, max_sample_rows=9000)

    for fold in inv_report["folds"]:
        # Training fold resampled classes must be balanced; test fold must remain untouched & imbalanced
        resampled = fold["train_rows_resampled_per_class"]
        assert len(set(resampled)) == 1, f"SMOTENC failed to balance training fold: {resampled}"
        test_counts = fold["test_counts_untouched"]
        assert sum(test_counts) == fold["test_rows_untouched"]
        assert len(set(test_counts)) > 1, "Test fold appears resampled — leakage detected!"

    assert inv_report["mean_macro_f1"] > 0.25
    assert ret_report["mean_return_pr_auc"] > 0.05
