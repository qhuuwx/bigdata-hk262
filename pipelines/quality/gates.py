"""
Blocking Data Quality Gates (Soda-compatible YAML contract runner)
Verifies Bronze -> Silver (Gate 1) and Silver -> Gold (Gate 2) invariants before promotion.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import duckdb
import yaml


def run_quality_gates(lakehouse_dir: Path) -> Dict[str, Any]:
    contracts_path = Path(__file__).resolve().parent / "contracts.yml"
    with contracts_path.open("r", encoding="utf-8") as fh:
        contracts = yaml.safe_load(fh)

    g1_cfg = contracts["gate_1_silver"]
    g2_cfg = contracts["gate_2_gold"]

    silver_sales = (lakehouse_dir / "silver" / "sales_clean.parquet").as_posix()
    silver_quarantine = (lakehouse_dir / "silver" / "sales_quarantine.parquet").as_posix()
    silver_inv = (lakehouse_dir / "silver" / "inventory_scd2.parquet").as_posix()
    gold_cube = (lakehouse_dir / "gold" / "eda_cube_monthly.parquet").as_posix()
    gold_fc = (lakehouse_dir / "gold" / "forecast_series_monthly.parquet").as_posix()
    gold_alerts = (lakehouse_dir / "gold" / "inventory_alerts_ranked.parquet").as_posix()

    checks: List[Dict[str, Any]] = []
    con = duckdb.connect(database=":memory:")
    try:
        # Gate 1: Silver Contracts
        s_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{silver_sales}')").fetchone()[0]
        q_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{silver_quarantine}')").fetchone()[0]
        i_cnt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{silver_inv}')").fetchone()[0]
        q_ratio = q_cnt / max(1, s_cnt + q_cnt)

        checks.append({
            "gate": "Gate 1",
            "name": "silver_sales_row_floor",
            "passed": s_cnt >= g1_cfg["min_sales_rows"],
            "observed": s_cnt,
        })
        checks.append({
            "gate": "Gate 1",
            "name": "silver_inventory_row_floor",
            "passed": i_cnt >= g1_cfg["min_inventory_rows"],
            "observed": i_cnt,
        })
        checks.append({
            "gate": "Gate 1",
            "name": "quarantine_ratio_within_sla",
            "passed": q_ratio <= g1_cfg["max_quarantine_ratio"],
            "observed": round(q_ratio, 6),
        })

        null_violations = con.execute(
            f"""
            SELECT COUNT(*) FROM read_parquet('{silver_sales}')
            WHERE transaction_date IS NULL OR product_no IS NULL OR store_id IS NULL OR product_category IS NULL
            """
        ).fetchone()[0]
        checks.append({
            "gate": "Gate 1",
            "name": "null_free_primary_dimensions",
            "passed": null_violations == 0,
            "observed": null_violations,
        })

        active_scd_cnt = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{silver_inv}') WHERE is_active_snapshot = TRUE AND effective_end_date IS NULL"
        ).fetchone()[0]
        checks.append({
            "gate": "Gate 1",
            "name": "scd2_active_sentinel_normalized",
            "passed": active_scd_cnt > 0,
            "observed": active_scd_cnt,
        })

        # Gate 2: Gold Contracts & Revenue Reconciliation
        silver_rev = float(con.execute(f"SELECT SUM(sales_amount) FROM read_parquet('{silver_sales}')").fetchone()[0] or 0.0)
        gold_rev = float(con.execute(f"SELECT SUM(revenue) FROM read_parquet('{gold_cube}')").fetchone()[0] or 0.0)
        rev_diff = abs(silver_rev - gold_rev)

        checks.append({
            "gate": "Gate 2",
            "name": "silver_to_gold_revenue_reconciliation",
            "passed": rev_diff <= g2_cfg["revenue_reconciliation_tolerance"],
            "observed": round(rev_diff, 4),
        })

        fc_pairs = con.execute(
            f"SELECT COUNT(DISTINCT category || ':::' || store) FROM read_parquet('{gold_fc}')"
        ).fetchone()[0]
        expected_pairs = g2_cfg["expected_categories_count"] * g2_cfg["expected_stores_count"]
        checks.append({
            "gate": "Gate 2",
            "name": "dense_forecast_pair_coverage",
            "passed": fc_pairs == expected_pairs,
            "observed": fc_pairs,
        })

        alert_rows = con.execute(
            f"SELECT category, store, stock_health FROM read_parquet('{gold_alerts}')"
        ).fetchall()
        distinct_alert_pairs = len({(r[0], r[1]) for r in alert_rows})
        seen_over = False
        priority_ok = True
        for _, _, health in alert_rows:
            if health == "over":
                seen_over = True
            if seen_over and health == "low":
                priority_ok = False
        checks.append({
            "gate": "Gate 2",
            "name": "distinct_alert_pairs_and_priority",
            "passed": len(alert_rows) <= g2_cfg["max_alerts_limit"] and distinct_alert_pairs == len(alert_rows) and priority_ok,
            "observed": {"total": len(alert_rows), "distinct": distinct_alert_pairs, "priority_ok": priority_ok},
        })
    finally:
        con.close()

    all_passed = all(c["passed"] for c in checks)
    report = {"passed": all_passed, "checks": checks}
    with (lakehouse_dir / "gold" / "quality_report.json").open("w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    if not all_passed:
        failed = [c for c in checks if not c["passed"]]
        raise RuntimeError(f"Data Quality Gate failure: {failed}")

    return report
