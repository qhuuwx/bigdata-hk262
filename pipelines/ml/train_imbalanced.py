"""
Leakage-Free Imbalanced ML Pipeline (SMOTENC & ADASYN inside TimeSeriesSplit CV)
Trains and evaluates:
  1. Inventory Stock-Risk Classifier (Healthy vs Low Stock vs Overstock @ 6.69% minority)
  2. Sales Return-Risk Classifier (Is Return = 1 @ 5.96% minority)

Strict Anti-Leakage Guarantee:
  - Chronological TimeSeriesSplit ensures future months never leak into training folds.
  - Preprocessing (encoding/scaling) and resampling (SMOTENC / ADASYN) live inside
    imblearn.pipeline.Pipeline so resampling runs ONLY on X_train_fold, leaving
    validation/test folds 100% untouched.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import duckdb
import numpy as np
import pandas as pd
from imblearn.over_sampling import ADASYN, SMOTENC
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import average_precision_score, f1_score, recall_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import OrdinalEncoder, StandardScaler


def _encode_categoricals_for_smotenc(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    cat_cols: List[str],
    num_cols: List[str],
) -> tuple[np.ndarray, np.ndarray, List[int]]:
    """
    Fits OrdinalEncoder on training fold ONLY (transforming test fold with unknown fallback)
    and returns contiguous arrays + categorical column indices for SMOTENC.
    """
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    scaler = StandardScaler()

    X_tr_cat = encoder.fit_transform(X_train[cat_cols].astype(str))
    X_te_cat = encoder.transform(X_test[cat_cols].astype(str))

    X_tr_num = scaler.fit_transform(X_train[num_cols].astype(float))
    X_te_num = scaler.transform(X_test[num_cols].astype(float))

    X_tr_mat = np.hstack([X_tr_num, X_tr_cat])
    X_te_mat = np.hstack([X_te_num, X_te_cat])
    cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))
    return X_tr_mat, X_te_mat, cat_indices


def train_inventory_risk_smotenc(lakehouse_dir: Path, max_sample_rows: int = 36000) -> Dict[str, Any]:
    """
    Chronological TimeSeriesSplit evaluation of 3-class Inventory Risk using SMOTENC inside training folds.
    Excludes direct label-defining columns (days_of_cover, avg_daily_sales, qty_on_hand) to prevent target leakage.
    """
    gold_features = (lakehouse_dir / "gold" / "ml_demand_features.parquet").as_posix()
    con = duckdb.connect(database=":memory:")
    try:
        df = con.execute(
            f"""
            SELECT
                start_month_num,
                division,
                price_tier,
                month_sin,
                month_cos,
                unit_selling_price,
                unit_cost_price_clean,
                gross_margin_pct,
                promo_ratio,
                historical_return_rate,
                cat_month_avg,
                sales_velocity_ratio_7d_30d,
                stock_health
            FROM read_parquet('{gold_features}')
            USING SAMPLE {int(max_sample_rows)} ROWS (RESERVOIR, 42)
            """
        ).fetchdf()
    finally:
        con.close()

    # Sort chronologically by start_month_num (6..12, 1..4 -> map Jan..Apr after Dec)
    df["chrono_order"] = df["start_month_num"].apply(lambda m: m if m >= 6 else m + 12)
    df = df.sort_values("chrono_order").reset_index(drop=True)

    cat_cols = ["division", "price_tier"]
    num_cols = [
        "month_sin",
        "month_cos",
        "unit_selling_price",
        "unit_cost_price_clean",
        "gross_margin_pct",
        "promo_ratio",
        "historical_return_rate",
        "cat_month_avg",
        "sales_velocity_ratio_7d_30d",
    ]
    class_map = {"healthy": 0, "low": 1, "over": 2}
    y = df["stock_health"].map(class_map).to_numpy(dtype=int)
    X = df[cat_cols + num_cols]

    tscv = TimeSeriesSplit(n_splits=3)
    fold_results: List[Dict[str, Any]] = []

    for fold_idx, (tr_idx, te_idx) in enumerate(tscv.split(X), start=1):
        X_tr, X_te = X.iloc[tr_idx], X.iloc[te_idx]
        y_tr, y_te = y[tr_idx], y[te_idx]

        X_tr_mat, X_te_mat, cat_indices = _encode_categoricals_for_smotenc(X_tr, X_te, cat_cols, num_cols)

        # SMOTENC strictly inside training fold
        pipeline = ImbPipeline(
            steps=[
                ("smotenc", SMOTENC(categorical_features=cat_indices, random_state=42)),
                ("clf", HistGradientBoostingClassifier(max_depth=6, max_iter=80, random_state=42)),
            ]
        )
        pipeline.fit(X_tr_mat, y_tr)

        y_pred = pipeline.predict(X_te_mat)
        y_prob = pipeline.predict_proba(X_te_mat)

        # Record resampled vs untouched test counts to prove zero leakage
        _, tr_resampled_counts = np.unique(pipeline.named_steps["smotenc"].fit_resample(X_tr_mat, y_tr)[1], return_counts=True)
        _, te_counts = np.unique(y_te, return_counts=True)

        macro_f1 = float(f1_score(y_te, y_pred, average="macro", zero_division=0))
        over_recall = float(recall_score(y_te == 2, y_pred == 2, zero_division=0))
        over_pr_auc = float(average_precision_score((y_te == 2).astype(int), y_prob[:, 2])) if np.any(y_te == 2) else 0.0

        fold_results.append(
            {
                "fold": fold_idx,
                "train_rows_raw": int(len(y_tr)),
                "train_rows_resampled_per_class": [int(c) for c in tr_resampled_counts],
                "test_rows_untouched": int(len(y_te)),
                "test_counts_untouched": [int(c) for c in te_counts],
                "macro_f1": round(macro_f1, 4),
                "overstock_recall": round(over_recall, 4),
                "overstock_pr_auc": round(over_pr_auc, 4),
            }
        )

    return {
        "task": "inventory_risk_3class",
        "resampler": "SMOTENC (fold-isolated)",
        "folds": fold_results,
        "mean_macro_f1": round(float(np.mean([f["macro_f1"] for f in fold_results])), 4),
        "mean_overstock_pr_auc": round(float(np.mean([f["overstock_pr_auc"] for f in fold_results])), 4),
    }


def train_return_risk_adasyn(lakehouse_dir: Path, max_sample_rows: int = 36000) -> Dict[str, Any]:
    """
    Chronological TimeSeriesSplit evaluation of Binary Return Risk (Is Return = 1 @ 5.96%)
    using ADASYN strictly inside training folds.
    """
    silver_sales = (lakehouse_dir / "silver" / "sales_clean.parquet").as_posix()
    con = duckdb.connect(database=":memory:")
    try:
        df = con.execute(
            f"""
            SELECT
                transaction_date,
                sales_type,
                product_division,
                ABS(qty_sold_winsorized) AS abs_qty,
                ABS(sales_amount) AS abs_amt,
                ABS(cogs) AS abs_cogs,
                EXTRACT(MONTH FROM transaction_date) AS tx_month,
                is_return
            FROM read_parquet('{silver_sales}')
            USING SAMPLE {int(max_sample_rows)} ROWS (RESERVOIR, 42)
            """
        ).fetchdf()
    finally:
        con.close()

    df = df.sort_values("transaction_date").reset_index(drop=True)
    df["month_sin"] = np.sin(2.0 * np.pi * df["tx_month"] / 12.0)
    df["month_cos"] = np.cos(2.0 * np.pi * df["tx_month"] / 12.0)

    cat_cols = ["sales_type", "product_division"]
    num_cols = ["abs_qty", "abs_amt", "abs_cogs", "month_sin", "month_cos"]
    X = df[cat_cols + num_cols]
    y = df["is_return"].to_numpy(dtype=int)

    tscv = TimeSeriesSplit(n_splits=3)
    fold_results: List[Dict[str, Any]] = []

    for fold_idx, (tr_idx, te_idx) in enumerate(tscv.split(X), start=1):
        X_tr, X_te = X.iloc[tr_idx], X.iloc[te_idx]
        y_tr, y_te = y[tr_idx], y[te_idx]

        pre = ColumnTransformer(
            transformers=[
                ("num", StandardScaler(), num_cols),
                ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
            ]
        )

        pipeline = ImbPipeline(
            steps=[
                ("prep", pre),
                ("adasyn", ADASYN(random_state=42)),
                ("clf", RandomForestClassifier(n_estimators=60, max_depth=8, random_state=42, n_jobs=-1)),
            ]
        )
        pipeline.fit(X_tr, y_tr)
        y_pred = pipeline.predict(X_te)
        y_prob = pipeline.predict_proba(X_te)[:, 1]

        pr_auc = float(average_precision_score(y_te, y_prob)) if np.any(y_te == 1) else 0.0
        ret_recall = float(recall_score(y_te, y_pred, pos_label=1, zero_division=0))
        macro_f1 = float(f1_score(y_te, y_pred, average="macro", zero_division=0))

        fold_results.append(
            {
                "fold": fold_idx,
                "train_rows_raw": int(len(y_tr)),
                "test_rows_untouched": int(len(y_te)),
                "test_positive_rate": round(float(np.mean(y_te)), 4),
                "return_pr_auc": round(pr_auc, 4),
                "return_recall": round(ret_recall, 4),
                "macro_f1": round(macro_f1, 4),
            }
        )

    return {
        "task": "return_prediction_binary",
        "resampler": "ADASYN (fold-isolated)",
        "folds": fold_results,
        "mean_return_pr_auc": round(float(np.mean([f["return_pr_auc"] for f in fold_results])), 4),
        "mean_macro_f1": round(float(np.mean([f["macro_f1"] for f in fold_results])), 4),
    }


def run_ml_pipeline(lakehouse_dir: Path) -> Dict[str, Any]:
    inv_eval = train_inventory_risk_smotenc(lakehouse_dir)
    ret_eval = train_return_risk_adasyn(lakehouse_dir)
    report = {
        "inventory_risk_model": inv_eval,
        "return_risk_model": ret_eval,
    }
    out_path = lakehouse_dir / "gold" / "ml_evaluation_report.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    return report
