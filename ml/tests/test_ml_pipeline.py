"""
Unit & Benchmark Verification Suite for the End-to-End ML Pipeline (ml/tests/test_ml_pipeline.py)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.predict import predict_demand_forecast, predict_inventory_risk

ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts"


def test_ml_artifacts_and_report_exist():
    assert (ARTIFACTS_DIR / "demand_forecaster.joblib").exists()
    assert (ARTIFACTS_DIR / "inventory_risk_classifier.joblib").exists()
    assert (ARTIFACTS_DIR / "return_risk_classifier.joblib").exists()
    assert (ARTIFACTS_DIR / "model_comparison_report.json").exists()
    assert (ARTIFACTS_DIR / "ml_predictions_cache.json").exists()
    assert (ARTIFACTS_DIR / "ML_MODEL_REPORT.md").exists()


def test_ml_forecaster_beats_sma_and_super_wma_baselines():
    with (ARTIFACTS_DIR / "model_comparison_report.json").open("r", encoding="utf-8") as fh:
        report = json.load(fh)

    fc_models = report["demand_forecasting"]["models"]
    sma = fc_models["Baseline_1_SMA4"]
    wma = fc_models["Baseline_2_Super_WMA_Seasonal"]
    champ_name = report["demand_forecasting"]["champion_model"]
    champ = fc_models[champ_name]

    # Champion ML model must achieve lower MAE and lower RMSE than both rule-based baselines
    assert champ["MAE"] < sma["MAE"], f"Champion MAE {champ['MAE']} did not beat SMA-4 {sma['MAE']}"
    assert champ["MAE"] < wma["MAE"], f"Champion MAE {champ['MAE']} did not beat Super-WMA {wma['MAE']}"
    assert champ["RMSE"] < sma["RMSE"], f"Champion RMSE {champ['RMSE']} did not beat SMA-4 {sma['RMSE']}"
    assert champ["WAPE_pct"] < sma["WAPE_pct"]


def test_inventory_and_return_classification_metrics():
    with (ARTIFACTS_DIR / "model_comparison_report.json").open("r", encoding="utf-8") as fh:
        report = json.load(fh)

    inv_models = report["inventory_risk_classification"]["models"]
    inv_champ = inv_models[report["inventory_risk_classification"]["champion_model"]]
    assert inv_champ["Macro_PR_AUC"] > 0.65
    assert inv_champ["Macro_F1"] > 0.65
    assert inv_champ["Recall_LowStock"] > 0.70

    ret_models = report["return_risk_classification"]["models"]
    ret_champ = ret_models[report["return_risk_classification"]["champion_model"]]
    assert ret_champ["ROC_AUC"] > 0.55
    assert ret_champ["PR_AUC"] > 0.06


def test_on_demand_predict_functions():
    fc = predict_demand_forecast("Scholar Footwear Trailblazer", "STR-1006", periods=12)
    assert len(fc["mlForecast"]) == 12
    assert len(fc["lower80"]) == 12
    assert len(fc["upper80"]) == 12
    assert all(l <= m <= u for l, m, u in zip(fc["lower80"], fc["mlForecast"], fc["upper80"]))

    inv_pred = predict_inventory_risk(qty_on_hand=2.0, prod_sales_14d=20.0)
    assert inv_pred["predictedClass"] in ("healthy", "low", "over")
    prob_sum = sum(inv_pred["probabilities"].values())
    assert abs(prob_sum - 1.0) < 0.01
