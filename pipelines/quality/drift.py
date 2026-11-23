"""
Data Drift Detection (PSI + Two-Sample Kolmogorov-Smirnov)
Monitors feature distribution stability between baseline training windows and recent slices.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import duckdb
import numpy as np
from scipy.stats import ks_2samp


def compute_psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """Computes Population Stability Index (PSI) with epsilon smoothing."""
    if len(expected) == 0 or len(actual) == 0:
        return 0.0
    quantiles = np.linspace(0, 100, bins + 1)
    edges = np.unique(np.percentile(expected, quantiles))
    if len(edges) < 2:
        return 0.0
    edges[0] = -np.inf
    edges[-1] = np.inf

    exp_counts, _ = np.histogram(expected, bins=edges)
    act_counts, _ = np.histogram(actual, bins=edges)

    eps = 1e-4
    exp_pct = np.clip(exp_counts / max(1, len(expected)), eps, 1.0)
    act_pct = np.clip(act_counts / max(1, len(actual)), eps, 1.0)
    return float(np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct)))


def run_drift_audit(lakehouse_dir: Path, psi_threshold: float = 0.2) -> Dict[str, Any]:
    silver_sales = (lakehouse_dir / "silver" / "sales_clean.parquet").as_posix()
    con = duckdb.connect(database=":memory:")
    try:
        base_df = con.execute(
            f"""
            SELECT qty_sold, sales_amount, cogs
            FROM read_parquet('{silver_sales}')
            WHERE transaction_month <= '2026-01'
            """
        ).fetchdf()
        curr_df = con.execute(
            f"""
            SELECT qty_sold, sales_amount, cogs
            FROM read_parquet('{silver_sales}')
            WHERE transaction_month >= '2026-02'
            """
        ).fetchdf()
    finally:
        con.close()

    metrics: Dict[str, Any] = {}
    for col in ("qty_sold", "sales_amount", "cogs"):
        exp_arr = base_df[col].to_numpy(dtype=float)
        cur_arr = curr_df[col].to_numpy(dtype=float)
        psi_val = compute_psi(exp_arr, cur_arr)
        ks_stat, ks_p = ks_2samp(exp_arr, cur_arr)
        metrics[col] = {
            "psi": round(psi_val, 4),
            "ks_stat": round(float(ks_stat), 4),
            "ks_pvalue": round(float(ks_p), 6),
            "drift_alert": psi_val > psi_threshold,
        }

    report = {"psi_threshold": psi_threshold, "features": metrics}
    with (lakehouse_dir / "gold" / "drift_report.json").open("w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    return report
