"""
End-to-End ML Pipeline CLI Runner & Report Generator (ml/run_ml_pipeline.py)

Executes:
  1. Demand Forecasting Training, Hyperparameter Tuning & 24-Period Precomputation
     (comparing Ridge, RandomForest, Tuned HistGBDT, and Hybrid Ensemble vs SMA-4 & Super-WMA baselines)
  2. 3-Class Inventory Stock-Risk Classification (Stratified CV + Fold-Isolated SMOTENC)
  3. Binary Transaction Return-Risk Classification (TimeSeriesSplit CV + Fold-Isolated ADASYN/SMOTENC)
  4. Serializes model artifacts (.joblib), Node.js inference cache (ml_predictions_cache.json),
     structured JSON metrics (model_comparison_report.json), and Markdown report (ML_MODEL_REPORT.md).
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.train_classifiers import (
    train_and_evaluate_inventory_classifiers,
    train_and_evaluate_return_classifiers,
)
from ml.train_forecast import train_and_evaluate_forecasters


def _render_markdown_report(report: dict) -> str:
    fc = report["demand_forecasting"]
    inv = report["inventory_risk_classification"]
    ret = report["return_risk_classification"]

    lines = [
        "# Machine Learning Benchmark & Model Comparison Report (`bigdata_inventory`)",
        "",
        f"- **Generated At**: `{report['generated_at']}`",
        f"- **Total Execution Time**: `{report['execution_time_sec']}s`",
        f"- **Dataset Scope**: `125,751` sales transactions & `284,755` inventory snapshots (`27` categories $\\times$ `40` stores = `1,080` time series)",
        "",
        "---",
        "",
        "## 1. Demand Forecasting: ML Models vs. Rule-Based Baselines (SMA-4 & Super-WMA)",
        "",
        f"Evaluated via expanding-window out-of-sample Time-Series Cross-Validation (`{fc['cv_test_samples']}` out-of-sample category-store-month predictions; tuned GBDT hyperparameters: `{json.dumps(fc['best_hyperparameters'])}`):",
        "",
        "| Model / Baseline | MAE | RMSE | WAPE (%) | sMAPE (%) | $R^2$ | $\\Delta$ MAE vs. SMA-4 | $\\Delta$ MAE vs. Super-WMA |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for m_name, m in fc["models"].items():
        is_champ = m_name == fc["champion_model"]
        label = f"**{m_name}** (Champion)" if is_champ else f"`{m_name}`"
        d_sma = f"{m['MAE_vs_SMA4_pct']:+.2f}%"
        d_wma = f"{m['MAE_vs_SuperWMA_pct']:+.2f}%"
        lines.append(
            f"| {label} | `{m['MAE']:.4f}` | `{m['RMSE']:.4f}` | `{m['WAPE_pct']:.2f}%` | `{m['sMAPE_pct']:.2f}%` | `{m['R2']:.4f}` | `{d_sma}` | `{d_wma}` |"
        )

    lines.extend(
        [
            "",
            "---",
            "",
            "## 2. Inventory Stock-Risk Classification (`Healthy` vs. `Low Stock` vs. `Overstock`)",
            "",
            f"Evaluated via 4-Fold Stratified Cross-Validation (`{inv['sample_size']}` snapshots; `Overstock` minority class = `6.69%`) with `SMOTENC` applied strictly inside training folds:",
            "",
            "| Classifier Pipeline | Macro PR-AUC | Low Stock PR-AUC | Overstock PR-AUC | Macro ROC-AUC | Macro-F1 | Weighted-F1 | Recall (`Low Stock`) | Recall (`Overstock`) |",
            "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
        ]
    )

    for m_name, m in inv["models"].items():
        is_champ = m_name == inv["champion_model"]
        label = f"**{m_name}** (Champion)" if is_champ else f"`{m_name}`"
        lines.append(
            f"| {label} | `{m['Macro_PR_AUC']:.4f}` | `{m['LowStock_PR_AUC']:.4f}` | `{m['Overstock_PR_AUC']:.4f}` | `{m['Macro_ROC_AUC']:.4f}` | `{m['Macro_F1']:.4f}` | `{m['Weighted_F1']:.4f}` | `{m['Recall_LowStock']:.4f}` | `{m['Recall_Overstock']:.4f}` |"
        )

    lines.extend(
        [
            "",
            "---",
            "",
            "## 3. Transaction Return-Risk Classification (`Is Return = 1` @ `5.96%` Minority)",
            "",
            f"Evaluated via 4-Fold Expanding `TimeSeriesSplit` (`{ret['sample_size']}` transactions) with causal out-of-fold product/store return priors and fold-isolated `ADASYN`/`SMOTENC`:",
            "",
            "| Classifier Pipeline | PR-AUC | ROC-AUC | Macro-F1 | Recall (`Is Return = 1`) | Precision (`Is Return = 1`) |",
            "| :--- | :---: | :---: | :---: | :---: | :---: |",
        ]
    )

    for m_name, m in ret["models"].items():
        is_champ = m_name == ret["champion_model"]
        label = f"**{m_name}** (Champion)" if is_champ else f"`{m_name}`"
        lines.append(
            f"| {label} | `{m['PR_AUC']:.4f}` | `{m['ROC_AUC']:.4f}` | `{m['Macro_F1']:.4f}` | `{m['Recall_Return']:.4f}` | `{m['Precision_Return']:.4f}` |"
        )

    lines.append("")
    return "\n".join(lines)


def main() -> dict:
    start_ts = time.time()
    data_dir = ROOT_DIR / "data"
    artifacts_dir = ROOT_DIR / "ml" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    print("[ML Pipeline] 1/3 Training & Tuning Demand Forecasters vs. SMA/WMA Baselines...")
    fc_res = train_and_evaluate_forecasters(data_dir, artifacts_dir)
    precomputed_forecasts = fc_res.pop("precomputed_forecasts")
    print(f"  -> Champion Forecaster ({fc_res['champion_model']}): {fc_res['models'][fc_res['champion_model']]}")

    print("[ML Pipeline] 2/3 Training 3-Class Inventory Stock-Risk Classifiers (Fold-Isolated SMOTENC)...")
    inv_res = train_and_evaluate_inventory_classifiers(data_dir, artifacts_dir)
    print(f"  -> Champion Inventory Classifier ({inv_res['champion_model']}): {inv_res['models'][inv_res['champion_model']]}")

    print("[ML Pipeline] 3/3 Training Binary Return-Risk Classifiers (TimeSeriesSplit + ADASYN/SMOTENC)...")
    ret_res = train_and_evaluate_return_classifiers(data_dir, artifacts_dir)
    print(f"  -> Champion Return Classifier ({ret_res['champion_model']}): {ret_res['models'][ret_res['champion_model']]}")

    elapsed = round(time.time() - start_ts, 2)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "execution_time_sec": elapsed,
        "demand_forecasting": fc_res,
        "inventory_risk_classification": inv_res,
        "return_risk_classification": ret_res,
    }

    with (artifacts_dir / "model_comparison_report.json").open("w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    cache_payload = {
        "generated_at": report["generated_at"],
        "champion_forecaster": fc_res["champion_model"],
        "champion_inventory_classifier": inv_res["champion_model"],
        "champion_return_classifier": ret_res["champion_model"],
        "forecast_metrics": fc_res["models"],
        "inventory_metrics": inv_res["models"],
        "return_metrics": ret_res["models"],
        "forecasts": precomputed_forecasts,
    }
    with (artifacts_dir / "ml_predictions_cache.json").open("w", encoding="utf-8") as fh:
        json.dump(cache_payload, fh)

    md_text = _render_markdown_report(report)
    with (artifacts_dir / "ML_MODEL_REPORT.md").open("w", encoding="utf-8") as fh:
        fh.write(md_text)

    print(f"[ML Pipeline] Completed in {elapsed}s. Artifacts saved to {artifacts_dir}")
    return report


if __name__ == "__main__":
    main()
