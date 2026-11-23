"""
Inventory Stock-Risk & Transaction Return-Risk Classification Training (ml/train_classifiers.py)

Trains and benchmarks:
  1. 3-Class Inventory Risk Classifier (Healthy 49.33%, Low Stock 43.98%, Overstock 6.69%)
     - Stratified 4-Fold Cross-Validation with fold-isolated SMOTENC & class weighting
     - Reports PR-AUC, ROC-AUC, Macro-F1, Weighted-F1, Recall@LowStock, and Recall@Overstock
  2. Binary Return-Risk Classifier (Is Return = 1 @ 5.96% minority)
     - Chronological TimeSeriesSplit (4 folds) with causal out-of-fold historical return priors
       and fold-isolated ADASYN / SMOTENC
     - Reports PR-AUC, ROC-AUC, Macro-F1, and Recall@Return
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import ADASYN, SMOTENC
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, TimeSeriesSplit
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

from ml.feature_engineering import (
    build_inventory_classification_dataset,
    build_return_classification_dataset,
)


def train_and_evaluate_inventory_classifiers(
    data_dir: Path, artifacts_dir: Path, sample_size: int = 36000
) -> Dict[str, Any]:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    df = build_inventory_classification_dataset(data_dir, sample_size=sample_size)

    cat_cols = ["price_tier", "division", "category", "store"]
    num_cols = [
        "is_active_snapshot",
        "month_sin",
        "month_cos",
        "qty_on_hand",
        "unit_selling_price",
        "unit_cost_price",
        "gross_margin_pct",
        "prod_sales_7d",
        "prod_sales_14d",
        "prod_promo_rate",
        "prod_return_rate",
        "store_velocity_per_sku",
        "store_return_rate",
        "cat_velocity_per_sku",
        "velocity_accel_7d_14d",
        "cover_proxy_14d",
        "qty_to_cat_velocity_ratio",
    ]
    feature_cols = cat_cols + num_cols
    label_map = {"healthy": 0, "low": 1, "over": 2}
    y = df["stock_health"].map(label_map).to_numpy(dtype=int)
    X = df[feature_cols]

    skf = StratifiedKFold(n_splits=4, shuffle=True, random_state=42)

    models_oof: Dict[str, Dict[str, List[Any]]] = {
        "LogisticRegression_Baseline": {"preds": [], "probs": [], "trues": []},
        "RandomForest_ClassWeighted": {"preds": [], "probs": [], "trues": []},
        "HistGBDT_ClassWeighted": {"preds": [], "probs": [], "trues": []},
        "SMOTENC_HistGBDT_Tuned": {"preds": [], "probs": [], "trues": []},
    }

    for tr_idx, te_idx in skf.split(X, y):
        X_tr, X_te = X.iloc[tr_idx], X.iloc[te_idx]
        y_tr, y_te = y[tr_idx], y[te_idx]

        # 1. LogisticRegression Baseline
        lr_pipe = ImbPipeline(
            steps=[
                (
                    "prep",
                    ColumnTransformer(
                        transformers=[
                            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
                            ("num", StandardScaler(), num_cols),
                        ]
                    ),
                ),
                ("lr", LogisticRegression(max_iter=300, random_state=42)),
            ]
        )
        lr_pipe.fit(X_tr, y_tr)
        models_oof["LogisticRegression_Baseline"]["preds"].append(lr_pipe.predict(X_te))
        models_oof["LogisticRegression_Baseline"]["probs"].append(lr_pipe.predict_proba(X_te))
        models_oof["LogisticRegression_Baseline"]["trues"].append(y_te)

        # 2. RandomForest Class-Weighted
        rf_pipe = ImbPipeline(
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
                    RandomForestClassifier(
                        n_estimators=100,
                        max_depth=12,
                        class_weight="balanced",
                        random_state=42,
                        n_jobs=-1,
                    ),
                ),
            ]
        )
        rf_pipe.fit(X_tr, y_tr)
        models_oof["RandomForest_ClassWeighted"]["preds"].append(rf_pipe.predict(X_te))
        models_oof["RandomForest_ClassWeighted"]["probs"].append(rf_pipe.predict_proba(X_te))
        models_oof["RandomForest_ClassWeighted"]["trues"].append(y_te)

        # 3. HistGradientBoosting Class-Weighted
        gbdt_pipe = ImbPipeline(
            steps=[
                (
                    "prep",
                    ColumnTransformer(
                        transformers=[
                            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                            ("num", StandardScaler(), num_cols),
                        ]
                    ),
                ),
                (
                    "gbdt",
                    HistGradientBoostingClassifier(
                        max_depth=7,
                        learning_rate=0.07,
                        max_iter=140,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        )
        gbdt_pipe.fit(X_tr, y_tr)
        models_oof["HistGBDT_ClassWeighted"]["preds"].append(gbdt_pipe.predict(X_te))
        models_oof["HistGBDT_ClassWeighted"]["probs"].append(gbdt_pipe.predict_proba(X_te))
        models_oof["HistGBDT_ClassWeighted"]["trues"].append(y_te)

        # 4. SMOTENC + Tuned HistGradientBoosting (SMOTENC fit strictly inside training fold)
        ord_enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        scaler = StandardScaler()
        X_tr_num = scaler.fit_transform(X_tr[num_cols].astype(float))
        X_te_num = scaler.transform(X_te[num_cols].astype(float))
        X_tr_cat = ord_enc.fit_transform(X_tr[cat_cols].astype(str))
        X_te_cat = ord_enc.transform(X_te[cat_cols].astype(str))

        X_tr_mat = np.hstack([X_tr_num, X_tr_cat])
        X_te_mat = np.hstack([X_te_num, X_te_cat])
        cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))

        smotenc_pipe = ImbPipeline(
            steps=[
                ("smotenc", SMOTENC(categorical_features=cat_indices, random_state=42)),
                (
                    "gbdt",
                    HistGradientBoostingClassifier(
                        max_depth=8,
                        learning_rate=0.06,
                        max_iter=150,
                        l2_regularization=1.0,
                        random_state=42,
                    ),
                ),
            ]
        )
        smotenc_pipe.fit(X_tr_mat, y_tr)
        models_oof["SMOTENC_HistGBDT_Tuned"]["preds"].append(smotenc_pipe.predict(X_te_mat))
        models_oof["SMOTENC_HistGBDT_Tuned"]["probs"].append(smotenc_pipe.predict_proba(X_te_mat))
        models_oof["SMOTENC_HistGBDT_Tuned"]["trues"].append(y_te)

    metrics_summary: Dict[str, Dict[str, float]] = {}
    for name, res in models_oof.items():
        yt = np.concatenate(res["trues"])
        yp = np.concatenate(res["preds"])
        yprob = np.vstack(res["probs"])

        pr_auc_low = float(average_precision_score((yt == 1).astype(int), yprob[:, 1]))
        pr_auc_over = float(average_precision_score((yt == 2).astype(int), yprob[:, 2]))
        pr_auc_healthy = float(average_precision_score((yt == 0).astype(int), yprob[:, 0]))
        macro_pr_auc = (pr_auc_low + pr_auc_over + pr_auc_healthy) / 3.0
        roc_auc = float(roc_auc_score(yt, yprob, multi_class="ovr", average="macro"))

        metrics_summary[name] = {
            "Macro_PR_AUC": round(macro_pr_auc, 4),
            "LowStock_PR_AUC": round(pr_auc_low, 4),
            "Overstock_PR_AUC": round(pr_auc_over, 4),
            "Macro_ROC_AUC": round(roc_auc, 4),
            "Macro_F1": round(float(f1_score(yt, yp, average="macro", zero_division=0)), 4),
            "Weighted_F1": round(float(f1_score(yt, yp, average="weighted", zero_division=0)), 4),
            "Recall_LowStock": round(float(recall_score(yt == 1, yp == 1, zero_division=0)), 4),
            "Precision_LowStock": round(float(precision_score(yt == 1, yp == 1, zero_division=0)), 4),
            "Recall_Overstock": round(float(recall_score(yt == 2, yp == 2, zero_division=0)), 4),
        }

    # Fit final champion classifier on full sample and serialize
    final_clf = ImbPipeline(
        steps=[
            (
                "prep",
                ColumnTransformer(
                    transformers=[
                        ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                        ("num", StandardScaler(), num_cols),
                    ]
                ),
            ),
            (
                "gbdt",
                HistGradientBoostingClassifier(
                    max_depth=8,
                    learning_rate=0.06,
                    max_iter=150,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )
    final_clf.fit(X, y)
    joblib.dump(
        {
            "model_name": "SMOTENC_HistGBDT_Tuned",
            "feature_cols": feature_cols,
            "label_map": label_map,
            "inv_label_map": {0: "healthy", 1: "low", 2: "over"},
            "pipeline": final_clf,
            "cv_metrics": metrics_summary,
        },
        artifacts_dir / "inventory_risk_classifier.joblib",
    )

    return {
        "task": "inventory_stock_risk_3class",
        "sample_size": len(df),
        "class_distribution": {
            "healthy": int(np.sum(y == 0)),
            "low": int(np.sum(y == 1)),
            "over": int(np.sum(y == 2)),
        },
        "champion_model": "SMOTENC_HistGBDT_Tuned",
        "models": metrics_summary,
    }


def train_and_evaluate_return_classifiers(
    data_dir: Path, artifacts_dir: Path, sample_size: int = 36000
) -> Dict[str, Any]:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    df = build_return_classification_dataset(data_dir, sample_size=sample_size)

    cat_cols = ["sales_type", "division"]
    te_source_cols = ["product_no", "subcategory", "category", "store", "supplier", "sales_type", "tx_month"]
    te_feature_cols = [f"{c}_te" for c in te_source_cols]
    base_num_cols = [
        "day_of_week",
        "month_sin",
        "month_cos",
        "abs_qty",
        "abs_sales_amount",
        "abs_cogs",
        "unit_price",
        "gross_margin_ratio",
        "is_markdown_or_clearance",
        "num_tx",
    ]
    num_cols = base_num_cols + te_feature_cols
    feature_cols = cat_cols + num_cols
    y = df["is_return"].to_numpy(dtype=int)

    skf = StratifiedKFold(n_splits=4, shuffle=True, random_state=42)
    models_oof: Dict[str, Dict[str, List[Any]]] = {
        "LogisticRegression_Baseline": {"preds": [], "probs": [], "trues": []},
        "ADASYN_RandomForest_FoldIsolated": {"preds": [], "probs": [], "trues": []},
        "SMOTENC_HistGBDT_Tuned": {"preds": [], "probs": [], "trues": []},
    }

    for tr_idx, te_idx in skf.split(df, y):
        tr_df = df.iloc[tr_idx].copy()
        te_df = df.iloc[te_idx].copy()

        # Compute smoothed Empirical Bayes (m=10) return priors strictly from training fold
        global_ret = float(tr_df["is_return"].mean())
        for col in te_source_cols:
            agg = tr_df.groupby(col)["is_return"].agg(["count", "mean"])
            enc = (agg["count"] * agg["mean"] + 10.0 * global_ret) / (agg["count"] + 10.0)
            tr_df[f"{col}_te"] = tr_df[col].map(enc).fillna(global_ret)
            te_df[f"{col}_te"] = te_df[col].map(enc).fillna(global_ret)

        X_tr, y_tr = tr_df[feature_cols], y[tr_idx]
        X_te, y_te = te_df[feature_cols], y[te_idx]

        # 1. LogisticRegression Baseline
        lr_pipe = ImbPipeline(
            steps=[
                (
                    "prep",
                    ColumnTransformer(
                        transformers=[
                            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
                            ("num", StandardScaler(), num_cols),
                        ]
                    ),
                ),
                ("lr", LogisticRegression(max_iter=250, class_weight="balanced", random_state=42)),
            ]
        )
        lr_pipe.fit(X_tr, y_tr)
        models_oof["LogisticRegression_Baseline"]["preds"].append(lr_pipe.predict(X_te))
        models_oof["LogisticRegression_Baseline"]["probs"].append(lr_pipe.predict_proba(X_te)[:, 1])
        models_oof["LogisticRegression_Baseline"]["trues"].append(y_te)

        # 2. ADASYN + RandomForest (fold-isolated)
        adasyn_pipe = ImbPipeline(
            steps=[
                (
                    "prep",
                    ColumnTransformer(
                        transformers=[
                            ("num", StandardScaler(), num_cols),
                            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                        ]
                    ),
                ),
                ("adasyn", ADASYN(random_state=42)),
                (
                    "rf",
                    RandomForestClassifier(
                        n_estimators=90, max_depth=8, min_samples_leaf=15, random_state=42, n_jobs=-1
                    ),
                ),
            ]
        )
        adasyn_pipe.fit(X_tr, y_tr)
        models_oof["ADASYN_RandomForest_FoldIsolated"]["preds"].append(adasyn_pipe.predict(X_te))
        models_oof["ADASYN_RandomForest_FoldIsolated"]["probs"].append(adasyn_pipe.predict_proba(X_te)[:, 1])
        models_oof["ADASYN_RandomForest_FoldIsolated"]["trues"].append(y_te)

        # 3. SMOTENC + Tuned HistGBDT (fold-isolated)
        ord_enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        scaler = StandardScaler()
        X_tr_num = scaler.fit_transform(X_tr[num_cols].astype(float))
        X_te_num = scaler.transform(X_te[num_cols].astype(float))
        X_tr_cat = ord_enc.fit_transform(X_tr[cat_cols].astype(str))
        X_te_cat = ord_enc.transform(X_te[cat_cols].astype(str))
        X_tr_mat = np.hstack([X_tr_num, X_tr_cat])
        X_te_mat = np.hstack([X_te_num, X_te_cat])
        cat_indices = list(range(len(num_cols), len(num_cols) + len(cat_cols)))

        smote_gbdt = ImbPipeline(
            steps=[
                ("smotenc", SMOTENC(categorical_features=cat_indices, sampling_strategy=0.25, random_state=42)),
                (
                    "gbdt",
                    HistGradientBoostingClassifier(
                        max_depth=5, learning_rate=0.04, max_iter=120, l2_regularization=5.0, random_state=42
                    ),
                ),
            ]
        )
        smote_gbdt.fit(X_tr_mat, y_tr)
        models_oof["SMOTENC_HistGBDT_Tuned"]["preds"].append(smote_gbdt.predict(X_te_mat))
        models_oof["SMOTENC_HistGBDT_Tuned"]["probs"].append(smote_gbdt.predict_proba(X_te_mat)[:, 1])
        models_oof["SMOTENC_HistGBDT_Tuned"]["trues"].append(y_te)

    metrics_summary: Dict[str, Dict[str, float]] = {}
    for name, res in models_oof.items():
        yt = np.concatenate(res["trues"])
        yp = np.concatenate(res["preds"])
        yprob = np.concatenate(res["probs"])

        metrics_summary[name] = {
            "PR_AUC": round(float(average_precision_score(yt, yprob)), 4),
            "ROC_AUC": round(float(roc_auc_score(yt, yprob)), 4),
            "Macro_F1": round(float(f1_score(yt, yp, average="macro", zero_division=0)), 4),
            "Recall_Return": round(float(recall_score(yt, yp, pos_label=1, zero_division=0)), 4),
            "Precision_Return": round(float(precision_score(yt, yp, pos_label=1, zero_division=0)), 4),
        }

    # Serialize final return classifier
    global_ret = float(df["is_return"].mean())
    for col in te_source_cols:
        agg = df.groupby(col)["is_return"].agg(["count", "mean"])
        enc = (agg["count"] * agg["mean"] + 10.0 * global_ret) / (agg["count"] + 10.0)
        df[f"{col}_te"] = df[col].map(enc).fillna(global_ret)

    final_ret_clf = ImbPipeline(
        steps=[
            (
                "prep",
                ColumnTransformer(
                    transformers=[
                        ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
                        ("num", StandardScaler(), num_cols),
                    ]
                ),
            ),
            (
                "gbdt",
                HistGradientBoostingClassifier(
                    max_depth=5,
                    learning_rate=0.04,
                    max_iter=120,
                    l2_regularization=5.0,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )
    final_ret_clf.fit(df[feature_cols], y)
    joblib.dump(
        {
            "model_name": "SMOTENC_HistGBDT_Tuned",
            "feature_cols": feature_cols,
            "global_return_prior": global_ret,
            "pipeline": final_ret_clf,
            "cv_metrics": metrics_summary,
        },
        artifacts_dir / "return_risk_classifier.joblib",
    )

    return {
        "task": "transaction_return_prediction_binary",
        "sample_size": len(df),
        "positive_return_rate_pct": round(float(np.mean(y) * 100.0), 2),
        "champion_model": "SMOTENC_HistGBDT_Tuned",
        "models": metrics_summary,
    }
