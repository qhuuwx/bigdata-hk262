# Machine Learning Benchmark & Model Comparison Report (`bigdata_inventory`)

- **Generated At**: `2026-11-22T23:54:15.749298+00:00`
- **Total Execution Time**: `83.22s`
- **Dataset Scope**: `125,751` sales transactions & `284,755` inventory snapshots (`27` categories $\times$ `40` stores = `1,080` time series)

---

## 1. Demand Forecasting: ML Models vs. Rule-Based Baselines (SMA-4 & Super-WMA)

Evaluated via expanding-window out-of-sample Time-Series Cross-Validation (`4320` out-of-sample category-store-month predictions; tuned GBDT hyperparameters: `{"loss": "quantile", "quantile": 0.42, "max_depth": 4, "learning_rate": 0.05, "l2_regularization": 5.0, "min_samples_leaf": 30}`):

| Model / Baseline | MAE | RMSE | WAPE (%) | sMAPE (%) | $R^2$ | $\Delta$ MAE vs. SMA-4 | $\Delta$ MAE vs. Super-WMA |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Baseline_1_SMA4` | `5.4640` | `9.9358` | `67.29%` | `89.83%` | `0.4078` | `+0.00%` | `+0.54%` |
| `Baseline_2_Super_WMA_Seasonal` | `5.4938` | `9.9840` | `67.66%` | `90.32%` | `0.4021` | `-0.55%` | `+0.00%` |
| `Ridge_Autoregressive` | `4.6388` | `8.9168` | `57.13%` | `87.87%` | `0.5231` | `+15.10%` | `+15.56%` |
| `RandomForest_Panel` | `4.5921` | `8.7133` | `56.55%` | `85.90%` | `0.5446` | `+15.96%` | `+16.41%` |
| `HistGBDT_Tuned` | `4.5400` | `8.9187` | `55.91%` | `84.98%` | `0.5229` | `+16.91%` | `+17.36%` |
| **Hybrid_GBDT_Seasonal_Ensemble** (Champion) | `4.5316` | `8.7673` | `55.81%` | `87.25%` | `0.5389` | `+17.06%` | `+17.51%` |

---

## 2. Inventory Stock-Risk Classification (`Healthy` vs. `Low Stock` vs. `Overstock`)

Evaluated via 4-Fold Stratified Cross-Validation (`36000` snapshots; `Overstock` minority class = `6.69%`) with `SMOTENC` applied strictly inside training folds:

| Classifier Pipeline | Macro PR-AUC | Low Stock PR-AUC | Overstock PR-AUC | Macro ROC-AUC | Macro-F1 | Weighted-F1 | Recall (`Low Stock`) | Recall (`Overstock`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `LogisticRegression_Baseline` | `0.7310` | `0.9484` | `0.3844` | `0.9083` | `0.6452` | `0.8029` | `0.8510` | `0.1543` |
| `RandomForest_ClassWeighted` | `0.9183` | `0.9845` | `0.8118` | `0.9759` | `0.7955` | `0.8765` | `0.9065` | `0.9376` |
| `HistGBDT_ClassWeighted` | `0.9466` | `0.9876` | `0.8812` | `0.9834` | `0.8539` | `0.9081` | `0.9282` | `0.9098` |
| **SMOTENC_HistGBDT_Tuned** (Champion) | `0.9245` | `0.9876` | `0.8167` | `0.9803` | `0.8580` | `0.9128` | `0.9258` | `0.7139` |

---

## 3. Transaction Return-Risk Classification (`Is Return = 1` @ `5.96%` Minority)

Evaluated via 4-Fold Expanding `TimeSeriesSplit` (`36000` transactions) with causal out-of-fold product/store return priors and fold-isolated `ADASYN`/`SMOTENC`:

| Classifier Pipeline | PR-AUC | ROC-AUC | Macro-F1 | Recall (`Is Return = 1`) | Precision (`Is Return = 1`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `LogisticRegression_Baseline` | `0.0760` | `0.5758` | `0.4710` | `0.3491` | `0.0747` |
| `ADASYN_RandomForest_FoldIsolated` | `0.0748` | `0.5732` | `0.4678` | `0.3851` | `0.0769` |
| **SMOTENC_HistGBDT_Tuned** (Champion) | `0.0752` | `0.5607` | `0.4957` | `0.0138` | `0.1316` |
