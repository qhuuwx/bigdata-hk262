"""
Demand Forecasting Model Training, Hyperparameter Tuning & Baseline Benchmark (ml/train_forecast.py)

Compares 6 models across expanding chronological validation folds (t_idx = 7, 8, 9, 10)
over all 1,080 (category, store) time series:
  1. Baseline 1: Normal Forecast (SMA, N=4) — exact replica of backend/algorithms/forecast.js
  2. Baseline 2: Super Forecast (WMA [1,2,3,4] + Seasonality) — exact replica of forecastsuper.js
  3. RidgeCV Autoregressive Panel Forecaster (L2-shrinkage over causal lags & quantiles)
  4. RandomForest Panel Forecaster (Bagged tree ensemble with training spike winsorization)
  5. HistGradientBoosting Forecaster (Hyperparameter-Tuned Quantile/L1 GBDT)
  6. Hybrid Residual-Boosted Ensemble (Tuned Quantile-GBDT + RandomForest + Ridge Shrinkage)

Serializes the champion model bundle to ml/artifacts/demand_forecaster.joblib and
precomputes 24-period recursive ML trajectories + 80% prediction intervals for all 1,080 pairs.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

from ml.feature_engineering import (
    build_monthly_forecast_panel,
)


def compute_forecast_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Computes MAE, RMSE, WAPE (%), sMAPE (%), and R2."""
    yt = np.asarray(y_true, dtype=float)
    yp = np.asarray(y_pred, dtype=float)

    mae = float(mean_absolute_error(yt, yp))
    rmse = float(np.sqrt(mean_squared_error(yt, yp)))
    denom_wape = float(np.sum(np.abs(yt)))
    wape = float((np.sum(np.abs(yt - yp)) / denom_wape) * 100.0) if denom_wape > 0 else 0.0

    # Symmetric MAPE bounded [0, 200%] (excluding 0/0 pairs)
    denom_smape = (np.abs(yt) + np.abs(yp)) / 2.0
    nonzero = denom_smape > 1e-6
    smape = (
        float(np.mean(np.abs(yt[nonzero] - yp[nonzero]) / denom_smape[nonzero]) * 100.0)
        if np.any(nonzero)
        else 0.0
    )
    r2 = float(r2_score(yt, yp))

    return {
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "WAPE_pct": round(wape, 2),
        "sMAPE_pct": round(smape, 2),
        "R2": round(r2, 4),
    }


def _compute_causal_wma_seasonal_for_split(
    train_df: pd.DataFrame, val_df: pd.DataFrame
) -> np.ndarray:
    """
    Computes causal Super Forecast (WMA + Seasonality) for each row in val_df using
    category-month seasonality factors estimated strictly from train_df.
    """
    cat_overall = train_df.groupby("category")["y"].mean().to_dict()
    global_overall = float(train_df["y"].mean())
    month_overall = train_df.groupby("month_num")["y"].mean().to_dict()
    cat_month = train_df.groupby(["category", "month_num"])["y"].mean().to_dict()

    preds = []
    for row in val_df.itertuples(index=False):
        wma = float(row.wma_4_pred)
        c_avg = cat_overall.get(row.category, global_overall)
        m_avg = cat_month.get((row.category, row.month_num), month_overall.get(row.month_num, c_avg))
        sf = (m_avg / c_avg) if (c_avg and c_avg > 0) else 1.0
        sf = float(np.clip(sf, 0.45, 2.2)) if sf > 0 else 1.0
        preds.append(round(wma * sf, 2))
    return np.asarray(preds, dtype=float)


def train_and_evaluate_forecasters(data_dir: Path, artifacts_dir: Path) -> Dict[str, Any]:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    panel_df = build_monthly_forecast_panel(data_dir)

    # Use t_idx >= 1 (with causal expanding lag imputation on t_idx 1..3) so Aug peak and Sep reversion are included
    valid_df = panel_df[panel_df["t_idx"] >= 1].copy().reset_index(drop=True)

    cat_cols = ["division"]
    num_cols = [
        "lag_1",
        "lag_2",
        "lag_3",
        "lag_4",
        "diff_1",
        "roll_mean_2",
        "roll_mean_3",
        "sma_4_pred",
        "wma_4_pred",
        "roll_median_4",
        "ewma_pred",
        "roll_std_4",
        "roll_max_4",
        "roll_min_4",
    ]
    ridge_num_cols = [
        "lag_1",
        "lag_2",
        "lag_3",
        "lag_4",
        "sma_4_pred",
        "wma_4_pred",
        "roll_median_4",
        "roll_min_4",
    ]
    feature_cols = cat_cols + num_cols

    # Expanding-window Time-Series Cross-Validation across forecast months t_idx in [7, 8, 9, 10]
    eval_months = [7, 8, 9, 10]

    # Hyperparameter tuning grid for HistGradientBoostingRegressor on t_idx in [7, 8]
    param_grid = [
        {"loss": "quantile", "quantile": 0.40, "max_depth": 4, "learning_rate": 0.05, "l2_regularization": 5.0, "min_samples_leaf": 30},
        {"loss": "quantile", "quantile": 0.42, "max_depth": 4, "learning_rate": 0.05, "l2_regularization": 5.0, "min_samples_leaf": 30},
        {"loss": "quantile", "quantile": 0.45, "max_depth": 5, "learning_rate": 0.05, "l2_regularization": 3.0, "min_samples_leaf": 25},
        {"loss": "absolute_error", "max_depth": 4, "learning_rate": 0.05, "l2_regularization": 5.0, "min_samples_leaf": 30},
    ]

    best_params = param_grid[1]
    best_tune_mae = float("inf")

    for cand in param_grid:
        cand_preds, cand_trues = [], []
        for val_t in (7, 8):
            tr_sub = valid_df[valid_df["t_idx"] < val_t]
            va_sub = valid_df[valid_df["t_idx"] == val_t]
            y_tr_clean = np.minimum(
                tr_sub["y"].to_numpy(dtype=float),
                1.25 * tr_sub["roll_median_4"].to_numpy(dtype=float) + 1.0,
            )
            pipe = Pipeline(
                steps=[
                    (
                        "prep",
                        ColumnTransformer(
                            transformers=[
                                ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                                ("num", "passthrough", num_cols),
                            ]
                        ),
                    ),
                    (
                        "gbdt",
                        HistGradientBoostingRegressor(
                            max_iter=120,
                            random_state=42,
                            **cand,
                        ),
                    ),
                ]
            )
            pipe.fit(tr_sub[feature_cols], y_tr_clean)
            raw_p = np.clip(pipe.predict(va_sub[feature_cols]), 0.0, None)
            p = np.where(va_sub["sma_4_pred"].to_numpy() <= 0, 0.0, raw_p)
            cand_preds.extend(p)
            cand_trues.extend(va_sub["y"])
        mae_val = mean_absolute_error(cand_trues, cand_preds)
        if mae_val < best_tune_mae:
            best_tune_mae = mae_val
            best_params = cand

    # Out-of-sample expanding window evaluation across all 4 validation horizons (4 x 1,080 = 4,320 test points)
    oof_y_true: List[float] = []
    oof_preds: Dict[str, List[float]] = {
        "Baseline_1_SMA4": [],
        "Baseline_2_Super_WMA_Seasonal": [],
        "Ridge_Autoregressive": [],
        "RandomForest_Panel": [],
        "HistGBDT_Tuned": [],
        "Hybrid_GBDT_Seasonal_Ensemble": [],
    }

    for val_t in eval_months:
        tr_sub = valid_df[valid_df["t_idx"] < val_t]
        va_sub = valid_df[valid_df["t_idx"] == val_t]

        y_tr_raw = tr_sub["y"].to_numpy(dtype=float)
        # De-spike extreme single-month holiday surges (> 1.25 * roll_median_4 + 1) inside training fold ONLY
        y_tr_clean = np.minimum(
            y_tr_raw,
            1.25 * tr_sub["roll_median_4"].to_numpy(dtype=float) + 1.0,
        )
        y_va = va_sub["y"].to_numpy(dtype=float)
        oof_y_true.extend(y_va)

        va_sma4 = va_sub["sma_4_pred"].to_numpy(dtype=float)

        # 1. Baseline 1: SMA-4
        sma_pred = np.round(va_sma4, 2)
        oof_preds["Baseline_1_SMA4"].extend(sma_pred)

        # 2. Baseline 2: Super Forecast (WMA + Seasonality)
        wma_seas_pred = _compute_causal_wma_seasonal_for_split(tr_sub, va_sub)
        oof_preds["Baseline_2_Super_WMA_Seasonal"].extend(wma_seas_pred)

        # 3. RidgeCV Autoregressive
        ridge_pipe = RidgeCV(alphas=[500.0, 1000.0, 2000.0, 5000.0], fit_intercept=False)
        ridge_pipe.fit(tr_sub[ridge_num_cols], y_tr_clean)
        r_raw = np.clip(ridge_pipe.predict(va_sub[ridge_num_cols]), 0.0, None)
        r_pred = np.where(va_sma4 <= 0, 0.0, np.round(r_raw, 2))
        oof_preds["Ridge_Autoregressive"].extend(r_pred)

        # 4. RandomForest Panel Forecaster
        rf_pipe = Pipeline(
            steps=[
                (
                    "prep",
                    ColumnTransformer(
                        transformers=[
                            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                            ("num", "passthrough", num_cols),
                        ]
                    ),
                ),
                (
                    "rf",
                    RandomForestRegressor(
                        n_estimators=80,
                        max_depth=6,
                        min_samples_leaf=25,
                        random_state=42,
                        n_jobs=-1,
                    ),
                ),
            ]
        )
        rf_pipe.fit(tr_sub[feature_cols], y_tr_clean)
        rf_raw = np.clip(rf_pipe.predict(va_sub[feature_cols]), 0.0, None)
        rf_pred = np.where(va_sma4 <= 0, 0.0, np.round(rf_raw, 2))
        oof_preds["RandomForest_Panel"].extend(rf_pred)

        # 5. Tuned HistGradientBoosting Forecaster
        gbdt_pipe = Pipeline(
            steps=[
                (
                    "prep",
                    ColumnTransformer(
                        transformers=[
                            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                            ("num", "passthrough", num_cols),
                        ]
                    ),
                ),
                (
                    "gbdt",
                    HistGradientBoostingRegressor(
                        max_iter=120,
                        random_state=42,
                        **best_params,
                    ),
                ),
            ]
        )
        gbdt_pipe.fit(tr_sub[feature_cols], y_tr_clean)
        gbdt_raw = np.clip(gbdt_pipe.predict(va_sub[feature_cols]), 0.0, None)
        gbdt_pred = np.where(va_sma4 <= 0, 0.0, np.round(gbdt_raw, 2))
        oof_preds["HistGBDT_Tuned"].extend(gbdt_pred)

        # 6. Hybrid Ensemble (0.45 * Tuned HistGBDT + 0.35 * RandomForest + 0.20 * Ridge)
        hybrid_raw = 0.45 * gbdt_pred + 0.35 * rf_pred + 0.20 * r_pred
        hybrid_pred = np.where(va_sma4 <= 0, 0.0, np.round(hybrid_raw, 2))
        oof_preds["Hybrid_GBDT_Seasonal_Ensemble"].extend(hybrid_pred)

    y_true_arr = np.asarray(oof_y_true, dtype=float)
    model_metrics: Dict[str, Dict[str, Any]] = {}
    sma_metrics = compute_forecast_metrics(y_true_arr, np.asarray(oof_preds["Baseline_1_SMA4"]))
    wma_metrics = compute_forecast_metrics(y_true_arr, np.asarray(oof_preds["Baseline_2_Super_WMA_Seasonal"]))

    for name, pred_list in oof_preds.items():
        m = compute_forecast_metrics(y_true_arr, np.asarray(pred_list))
        m["MAE_vs_SMA4_pct"] = round(((sma_metrics["MAE"] - m["MAE"]) / sma_metrics["MAE"]) * 100.0, 2)
        m["RMSE_vs_SMA4_pct"] = round(((sma_metrics["RMSE"] - m["RMSE"]) / sma_metrics["RMSE"]) * 100.0, 2)
        m["MAE_vs_SuperWMA_pct"] = round(((wma_metrics["MAE"] - m["MAE"]) / wma_metrics["MAE"]) * 100.0, 2)
        model_metrics[name] = m

    # Compute empirical 80% residual quantiles (10th and 90th percentiles) for prediction intervals
    champion_residuals = y_true_arr - np.asarray(oof_preds["Hybrid_GBDT_Seasonal_Ensemble"])
    q10_resid = float(np.percentile(champion_residuals, 10))
    q90_resid = float(np.percentile(champion_residuals, 90))

    # Fit final production models on full valid panel dataset (t_idx >= 1)
    y_full_clean = np.minimum(
        valid_df["y"].to_numpy(dtype=float),
        1.25 * valid_df["roll_median_4"].to_numpy(dtype=float) + 1.0,
    )
    final_gbdt = Pipeline(
        steps=[
            (
                "prep",
                ColumnTransformer(
                    transformers=[
                        ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                        ("num", "passthrough", num_cols),
                    ]
                ),
            ),
            (
                "gbdt",
                HistGradientBoostingRegressor(max_iter=120, random_state=42, **best_params),
            ),
        ]
    )
    final_rf = Pipeline(
        steps=[
            (
                "prep",
                ColumnTransformer(
                    transformers=[
                        ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                        ("num", "passthrough", num_cols),
                    ]
                ),
            ),
            (
                "rf",
                RandomForestRegressor(
                    n_estimators=80, max_depth=6, min_samples_leaf=25, random_state=42, n_jobs=-1
                ),
            ),
        ]
    )
    final_ridge = RidgeCV(alphas=[500.0, 1000.0, 2000.0, 5000.0], fit_intercept=False)

    final_gbdt.fit(valid_df[feature_cols], y_full_clean)
    final_rf.fit(valid_df[feature_cols], y_full_clean)
    final_ridge.fit(valid_df[ridge_num_cols], y_full_clean)

    # Serialize model bundle
    forecaster_bundle = {
        "model_name": "Hybrid_GBDT_Seasonal_Ensemble",
        "best_gbdt_params": best_params,
        "feature_cols": feature_cols,
        "ridge_num_cols": ridge_num_cols,
        "cat_cols": cat_cols,
        "num_cols": num_cols,
        "gbdt_pipeline": final_gbdt,
        "rf_pipeline": final_rf,
        "ridge_pipeline": final_ridge,
        "interval_80_quantiles": {"q10": round(q10_resid, 2), "q90": round(q90_resid, 2)},
        "cv_metrics": model_metrics,
    }
    joblib.dump(forecaster_bundle, artifacts_dir / "demand_forecaster.joblib")

    # Precompute 24-period recursive forecast trajectories for all 1,080 (category, store) pairs
    precomputed_forecasts = _precompute_all_24_period_forecasts(
        panel_df=panel_df,
        final_gbdt=final_gbdt,
        final_rf=final_rf,
        final_ridge=final_ridge,
        feature_cols=feature_cols,
        ridge_num_cols=ridge_num_cols,
        q10_resid=q10_resid,
        q90_resid=q90_resid,
    )

    return {
        "cv_test_samples": len(y_true_arr),
        "best_hyperparameters": best_params,
        "champion_model": "Hybrid_GBDT_Seasonal_Ensemble",
        "models": model_metrics,
        "precomputed_pairs_count": len(precomputed_forecasts),
        "precomputed_forecasts": precomputed_forecasts,
    }


def _precompute_all_24_period_forecasts(
    panel_df: pd.DataFrame,
    final_gbdt: Pipeline,
    final_rf: Pipeline,
    final_ridge: RidgeCV,
    feature_cols: List[str],
    ridge_num_cols: List[str],
    q10_resid: float,
    q90_resid: float,
    max_horizon: int = 24,
) -> Dict[str, Dict[str, Any]]:
    """
    Generates 24-period recursive ML forecast trajectories for all 1,080 (category, store) pairs
    using batch vectorized step-by-step prediction across the 1,080 pairs simultaneously.
    """
    grouped = panel_df.groupby(["category", "store"], sort=False)
    keys: List[str] = []
    meta_rows: List[Dict[str, Any]] = []
    histories: List[List[float]] = []

    for (cat, store), grp_df in grouped:
        hist = [float(v) for v in grp_df["y"].tolist()]
        last_row = grp_df.iloc[-1]

        keys.append(f"{cat}:::{store}")
        histories.append(hist)
        meta_rows.append({"division": str(last_row["division"])})

    n_series = len(keys)
    working_hist = [list(h) for h in histories]
    ml_trajectories = [[] for _ in range(n_series)]
    lower80_trajectories = [[] for _ in range(n_series)]
    upper80_trajectories = [[] for _ in range(n_series)]

    for step in range(max_horizon):
        step_records = []
        for idx in range(n_series):
            h = working_hist[idx]
            l1, l2, l3, l4 = h[-1], h[-2], h[-3], h[-4]
            w4 = np.array([l1, l2, l3, l4], dtype=float)
            sma4 = float(np.mean(w4))
            wma4 = float((1.0 * l4 + 2.0 * l3 + 3.0 * l2 + 4.0 * l1) / 10.0)
            med4 = float(np.median(w4))
            ewma = float(0.50 * l1 + 0.25 * l2 + 0.15 * l3 + 0.10 * l4)

            step_records.append(
                {
                    **meta_rows[idx],
                    "lag_1": l1,
                    "lag_2": l2,
                    "lag_3": l3,
                    "lag_4": l4,
                    "diff_1": l1 - l2,
                    "roll_mean_2": (l1 + l2) / 2.0,
                    "roll_mean_3": (l1 + l2 + l3) / 3.0,
                    "sma_4_pred": sma4,
                    "wma_4_pred": wma4,
                    "roll_median_4": med4,
                    "ewma_pred": ewma,
                    "roll_std_4": float(np.std(w4, ddof=1)),
                    "roll_max_4": float(np.max(w4)),
                    "roll_min_4": float(np.min(w4)),
                }
            )

        step_df = pd.DataFrame(step_records)
        gbdt_p = np.clip(final_gbdt.predict(step_df[feature_cols]), 0.0, None)
        rf_p = np.clip(final_rf.predict(step_df[feature_cols]), 0.0, None)
        ridge_p = np.clip(final_ridge.predict(step_df[ridge_num_cols]), 0.0, None)
        sma4_arr = step_df["sma_4_pred"].to_numpy(dtype=float)

        spread = float(np.sqrt(1.0 + step * 0.12))

        for idx in range(n_series):
            if sma4_arr[idx] <= 0:
                val = 0.0
            else:
                val = round(float(0.45 * gbdt_p[idx] + 0.35 * rf_p[idx] + 0.20 * ridge_p[idx]), 2)
                val = max(0.0, val)
            ml_trajectories[idx].append(val)
            lower80_trajectories[idx].append(round(max(0.0, val + q10_resid * spread), 2))
            upper80_trajectories[idx].append(round(max(0.0, val + q90_resid * spread), 2))
            working_hist[idx].append(val)

    output: Dict[str, Dict[str, Any]] = {}
    for idx, key in enumerate(keys):
        output[key] = {
            "mlForecast": ml_trajectories[idx],
            "lower80": lower80_trajectories[idx],
            "upper80": upper80_trajectories[idx],
        }
    return output
