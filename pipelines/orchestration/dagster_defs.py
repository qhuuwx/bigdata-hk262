"""
Dagster Asset Lineage Definition (Software-Defined Assets)
Models the Medallion Lakehouse dependencies for Dagster UI orchestration:
  bronze_layer -> silver_layer -> gold_layer -> quality_gates -> drift_audit -> ml_imbalance_models
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from pipelines.medallion.bronze import build_bronze_layer
from pipelines.medallion.silver import build_silver_layer
from pipelines.medallion.gold import build_gold_layer
from pipelines.quality.gates import run_quality_gates
from pipelines.quality.drift import run_drift_audit
from pipelines.ml.train_imbalanced import run_ml_pipeline

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
LAKEHOUSE_DIR = ROOT_DIR / "data" / "lakehouse"

try:
    from dagster import Definitions, asset

    @asset(group_name="bronze", compute_kind="duckdb")
    def bronze_layer() -> Dict[str, Any]:
        return build_bronze_layer(DATA_DIR, LAKEHOUSE_DIR)

    @asset(group_name="silver", deps=[bronze_layer], compute_kind="duckdb")
    def silver_layer() -> Dict[str, Any]:
        return build_silver_layer(LAKEHOUSE_DIR)

    @asset(group_name="gold", deps=[silver_layer], compute_kind="duckdb")
    def gold_layer() -> Dict[str, Any]:
        return build_gold_layer(LAKEHOUSE_DIR)

    @asset(group_name="quality", deps=[gold_layer], compute_kind="soda-yaml")
    def quality_gates() -> Dict[str, Any]:
        return run_quality_gates(LAKEHOUSE_DIR)

    @asset(group_name="observability", deps=[quality_gates], compute_kind="scipy")
    def drift_audit() -> Dict[str, Any]:
        return run_drift_audit(LAKEHOUSE_DIR)

    @asset(group_name="ml", deps=[quality_gates], compute_kind="imbalanced-learn")
    def ml_imbalance_models() -> Dict[str, Any]:
        return run_ml_pipeline(LAKEHOUSE_DIR)

    defs = Definitions(
        assets=[
            bronze_layer,
            silver_layer,
            gold_layer,
            quality_gates,
            drift_audit,
            ml_imbalance_models,
        ]
    )
except ImportError:
    defs = None
