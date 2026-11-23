"""
Enterprise Medallion Pipeline Runner
Executes Bronze -> Silver -> Quality Gate 1 -> Gold -> Quality Gate 2 -> Drift Audit -> ML Pipeline.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from pipelines.medallion.bronze import build_bronze_layer
from pipelines.medallion.silver import build_silver_layer
from pipelines.medallion.gold import build_gold_layer
from pipelines.quality.gates import run_quality_gates
from pipelines.quality.drift import run_drift_audit
from pipelines.ml.train_imbalanced import run_ml_pipeline


def run_all(data_dir: Path | None = None, lakehouse_dir: Path | None = None) -> dict:
    start = time.time()
    d_dir = data_dir or (ROOT_DIR / "data")
    lh_dir = lakehouse_dir or (ROOT_DIR / "data" / "lakehouse")

    print("[Pipeline] Stage 1/6: Bronze Ingestion...")
    bronze_stats = build_bronze_layer(d_dir, lh_dir)
    print(f"  -> {bronze_stats}")

    print("[Pipeline] Stage 2/6: Silver Cleaning, Deduplication & SCD2...")
    silver_stats = build_silver_layer(lh_dir)
    print(f"  -> {silver_stats}")

    print("[Pipeline] Stage 3/6: Gold OLAP Marts & Feature Store...")
    gold_stats = build_gold_layer(lh_dir)
    print(f"  -> {gold_stats}")

    print("[Pipeline] Stage 4/6: Blocking Data Quality Gates (Gate 1 & Gate 2)...")
    quality_report = run_quality_gates(lh_dir)
    print(f"  -> {len(quality_report['checks'])}/8 contracts passed")

    print("[Pipeline] Stage 5/6: PSI & KS Drift Audit...")
    drift_report = run_drift_audit(lh_dir)
    print(f"  -> PSI features: {list(drift_report['features'].keys())}")

    print("[Pipeline] Stage 6/6: Leakage-Free SMOTENC & ADASYN TimeSeriesSplit CV...")
    ml_report = run_ml_pipeline(lh_dir)
    print(
        f"  -> Inventory SMOTENC Macro-F1={ml_report['inventory_risk_model']['mean_macro_f1']}, "
        f"Return ADASYN PR-AUC={ml_report['return_risk_model']['mean_return_pr_auc']}"
    )

    elapsed = round(time.time() - start, 2)
    summary = {
        "elapsed_sec": elapsed,
        "bronze": bronze_stats,
        "silver": silver_stats,
        "gold": gold_stats,
        "quality_passed": quality_report["passed"],
        "drift": drift_report["features"],
        "ml": {
            "inventory_mean_macro_f1": ml_report["inventory_risk_model"]["mean_macro_f1"],
            "return_mean_pr_auc": ml_report["return_risk_model"]["mean_return_pr_auc"],
        },
    }
    print(f"[Pipeline] Completed full Medallion + ML run in {elapsed}s")
    return summary


if __name__ == "__main__":
    result = run_all()
    print(json.dumps(result, indent=2))
