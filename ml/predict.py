"""
On-Demand & Batch ML Inference CLI (ml/predict.py)

Loads serialized joblib models from ml/artifacts/ (or precomputed ml_predictions_cache.json)
and performs demand forecasting or inventory risk classification with graceful fallback.

Usage:
  pipelines/.venv/bin/python ml/predict.py --task forecast --category "Scholar Footwear Trailblazer" --store "STR-1006" --periods 8
  pipelines/.venv/bin/python ml/predict.py --task classify-inventory --qty 8 --sales14d 28 --price 110 --cost 52 --category "Scholar Footwear Trailblazer" --store "STR-1006"
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

ARTIFACTS_DIR = ROOT_DIR / "ml" / "artifacts"


def predict_demand_forecast(category: str, store: str, periods: int = 8) -> Dict[str, Any]:
    cache_path = ARTIFACTS_DIR / "ml_predictions_cache.json"
    num_p = max(4, min(24, int(periods)))
    key = f"{category.strip()}:::{store.strip()}"

    if cache_path.exists():
        with cache_path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        entry = payload.get("forecasts", {}).get(key)
        if entry:
            return {
                "category": category.strip(),
                "store": store.strip(),
                "model": payload.get("champion_forecaster", "Hybrid_GBDT_Seasonal_Ensemble"),
                "periods": [f"T+{i + 1}" for i in range(num_p)],
                "mlForecast": entry["mlForecast"][:num_p],
                "lower80": entry["lower80"][:num_p],
                "upper80": entry["upper80"][:num_p],
            }

    return {
        "category": category.strip(),
        "store": store.strip(),
        "model": "Fallback_Zero",
        "periods": [f"T+{i + 1}" for i in range(num_p)],
        "mlForecast": [0.0] * num_p,
        "lower80": [0.0] * num_p,
        "upper80": [0.0] * num_p,
    }


def predict_inventory_risk(
    qty_on_hand: float,
    prod_sales_14d: float,
    unit_selling_price: float = 100.0,
    unit_cost_price: float = 50.0,
    category: str = "Scholar Footwear Trailblazer",
    division: str = "Scholar Footwear",
    store: str = "STR-1006",
    price_tier: str = "Full Price",
    month_num: int = 4,
) -> Dict[str, Any]:
    clf_path = ARTIFACTS_DIR / "inventory_risk_classifier.joblib"
    if not clf_path.exists():
        raise FileNotFoundError(f"Missing classifier artifact: {clf_path}")

    bundle = joblib.load(clf_path)
    pipe = bundle["pipeline"]
    inv_map = bundle["inv_label_map"]
    feature_cols = bundle["feature_cols"]

    m_sin = float(np.sin(2.0 * np.pi * month_num / 12.0))
    m_cos = float(np.cos(2.0 * np.pi * month_num / 12.0))
    margin = (
        (unit_selling_price - unit_cost_price) / unit_selling_price
        if unit_selling_price > 0
        else 0.0
    )
    sales_7d = prod_sales_14d * 0.5
    cover_14d = (qty_on_hand / (prod_sales_14d / 14.0)) if prod_sales_14d > 0 else 30.0

    row = pd.DataFrame(
        [
            {
                "price_tier": price_tier,
                "division": division,
                "category": category,
                "store": store,
                "is_active_snapshot": 1.0,
                "month_sin": m_sin,
                "month_cos": m_cos,
                "qty_on_hand": float(qty_on_hand),
                "unit_selling_price": float(unit_selling_price),
                "unit_cost_price": float(unit_cost_price),
                "gross_margin_pct": float(margin),
                "prod_sales_7d": float(sales_7d),
                "prod_sales_14d": float(prod_sales_14d),
                "prod_promo_rate": 0.2,
                "prod_return_rate": 0.05,
                "store_velocity_per_sku": 15.0,
                "store_return_rate": 0.05,
                "cat_velocity_per_sku": 20.0,
                "velocity_accel_7d_14d": 1.0,
                "cover_proxy_14d": float(cover_14d),
                "qty_to_cat_velocity_ratio": float(qty_on_hand / 20.0),
            }
        ]
    )[feature_cols]

    pred_idx = int(pipe.predict(row)[0])
    probs = pipe.predict_proba(row)[0]
    return {
        "model": bundle["model_name"],
        "predictedClass": inv_map[pred_idx],
        "probabilities": {
            "healthy": round(float(probs[0]), 4),
            "low": round(float(probs[1]), 4),
            "over": round(float(probs[2]), 4),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="ML Inference CLI for bigdata_inventory")
    parser.add_argument("--task", choices=["forecast", "classify-inventory"], required=True)
    parser.add_argument("--category", default="Scholar Footwear Trailblazer")
    parser.add_argument("--division", default="Scholar Footwear")
    parser.add_argument("--store", default="STR-1006")
    parser.add_argument("--periods", type=int, default=8)
    parser.add_argument("--qty", type=float, default=5.0)
    parser.add_argument("--sales14d", type=float, default=14.0)
    parser.add_argument("--price", type=float, default=110.0)
    parser.add_argument("--cost", type=float, default=52.0)
    args = parser.parse_args()

    if args.task == "forecast":
        res = predict_demand_forecast(args.category, args.store, args.periods)
    else:
        res = predict_inventory_risk(
            qty_on_hand=args.qty,
            prod_sales_14d=args.sales14d,
            unit_selling_price=args.price,
            unit_cost_price=args.cost,
            category=args.category,
            division=args.division,
            store=args.store,
        )
    print(json.dumps(res))


if __name__ == "__main__":
    main()
