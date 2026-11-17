"""
train_models.py
---------------
Train glass transition temperature (Tg) prediction models (RF, XGB, SVM,
KNN) and save them as .pkl files for the glass composition screening platform.

Project : Physics-Informed Machine Learning to Accelerate the Discovery of
          Novel Glass Compositions for Energy-Harvesting Applications
Project ID: DSAI2025-EE-1018 (funded by COE-DSAI, TIET Patiala)

Workflow (same as the published study):
  1. 80/20 train/test split (random_state = 42)
  2. 5-fold GridSearchCV on the training set to choose hyperparameters
  3. Report test-set MAE, RMSE and R2
  4. Refit the best model on the FULL dataset and save it for deployment

Usage:
    python train_models.py

Outputs (in the folder set by OUTPUT_DIR):
    Tg_RF.pkl, Tg_XGB.pkl, Tg_SVM.pkl, Tg_KNN.pkl
    model_performance.csv   - test-set metrics for every model
    requirements.txt        - library versions the website must use
"""

import os
import sys
from datetime import date

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.svm import SVR
from xgboost import XGBRegressor

# ============================ CONFIGURATION ============================

DATA_FILE = "glass_data.csv"   # CSV containing inputs and target columns
OUTPUT_DIR = "models"          # where .pkl files are written

COMPOSITION_COLS = ["SiO2", "B2O3", "Na2O"]
# Order kept as in the published study
STRUCTURAL_COLS = ["Q4", "Q3", "Q2", "Q1", "Q0", "B3", "B4", "B2", "B1", "B0"]

# Inputs used by the deployed models:
#   "composition" -> SiO2, B2O3, Na2O only (users can type these on the website)
#   "structural"  -> Q and B units only
#   "both"        -> composition + structural units
FEATURE_SET = "composition"

# Target property: column name in the CSV and unit shown on the website
# (more properties can be added here later, e.g. "CTE": {...})
TARGETS = {
    "Tg": {"column": "Tg", "unit": "°C"},   # <- confirm unit
}

RANDOM_STATE = 42
TEST_SIZE = 0.20
CV_FOLDS = 5

# Hyperparameter grids (as in the published study)
PARAM_GRIDS = {
    "RF": {
        "n_estimators": [50, 100, 200],
        "max_depth": [None, 10, 20],
        "bootstrap": [True],
    },
    "XGB": {"n_estimators": [50, 100, 200], "learning_rate": [0.01, 0.1, 0.2]},
    "SVM": {"C": [0.1, 1, 10], "kernel": ["linear", "rbf"]},
    "KNN": {"n_neighbors": [3, 5, 7], "weights": ["uniform", "distance"]},
}

# ======================================================================


def make_models():
    """Fresh, untrained model instances (as in the published study)."""
    return {
        "RF": RandomForestRegressor(random_state=RANDOM_STATE),
        "XGB": XGBRegressor(objective="reg:squarederror"),
        "SVM": SVR(),
        "KNN": KNeighborsRegressor(),
    }


def get_feature_cols(feature_set):
    options = {
        "composition": COMPOSITION_COLS,
        "structural": STRUCTURAL_COLS,
        "both": COMPOSITION_COLS + STRUCTURAL_COLS,
    }
    if feature_set not in options:
        raise ValueError(f"FEATURE_SET must be one of {list(options)}")
    return options[feature_set]


def train_target(df, target_name, cfg, feature_cols):
    """Tune, evaluate, refit and save all models for one target property."""
    target_col = cfg["column"]
    missing = [c for c in feature_cols + [target_col] if c not in df.columns]
    if missing:
        raise KeyError(f"Columns missing in {DATA_FILE}: {missing}")

    # Drop rows with missing values in the inputs or the target
    data = df[feature_cols + [target_col]].dropna()
    X, y = data[feature_cols], data[target_col]
    print(f"\n===== {target_name}: {len(X)} samples, features = {feature_cols} =====")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )

    # Training-data statistics, used by the predictors to flag extrapolation
    comp_in_features = all(c in feature_cols for c in COMPOSITION_COLS)
    composition_sum = (
        float(X[COMPOSITION_COLS].sum(axis=1).mean()) if comp_in_features else None
    )

    rows = []
    for model_name, base_model in make_models().items():
        grid = GridSearchCV(
            base_model,
            PARAM_GRIDS[model_name],
            cv=CV_FOLDS,
            scoring="neg_mean_squared_error",
        )
        grid.fit(X_train, y_train)

        y_pred = grid.best_estimator_.predict(X_test)
        metrics = {
            "MAE": float(mean_absolute_error(y_test, y_pred)),
            "RMSE": float(np.sqrt(mean_squared_error(y_test, y_pred))),
            "R2": float(r2_score(y_test, y_pred)),
        }

        # Final deployed model: best hyperparameters, refit on all data
        final_model = clone(base_model).set_params(**grid.best_params_)
        final_model.fit(X, y)

        bundle = {
            "model": final_model,
            "model_name": model_name,
            "target": target_name,
            "unit": cfg["unit"],
            "features": feature_cols,
            "feature_min": X.min().to_dict(),
            "feature_max": X.max().to_dict(),
            "composition_sum": composition_sum,
            "best_params": grid.best_params_,
            "test_metrics": metrics,
            "n_samples": int(len(X)),
            "trained_on": date.today().isoformat(),
            "versions": {
                "python": sys.version.split()[0],
                "scikit-learn": sklearn.__version__,
                "xgboost": xgboost.__version__,
            },
        }
        path = os.path.join(OUTPUT_DIR, f"{target_name}_{model_name}.pkl")
        joblib.dump(bundle, path)

        print(
            f"{model_name:4s} | MAE = {metrics['MAE']:.2f}  RMSE = {metrics['RMSE']:.2f}  "
            f"R2 = {metrics['R2']:.3f} | {grid.best_params_} -> {path}"
        )
        rows.append({"Target": target_name, "Model": model_name, **metrics,
                     "Best Parameters": str(grid.best_params_)})
    return rows


def write_requirements():
    """Pin the library versions used for training; the website must match them."""
    lines = [
        f"scikit-learn=={sklearn.__version__}",
        f"xgboost=={xgboost.__version__}",
        f"pandas=={pd.__version__}",
        f"numpy=={np.__version__}",
        f"joblib=={joblib.__version__}",
    ]
    path = os.path.join(OUTPUT_DIR, "requirements.txt")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"\nLibrary versions written to {path} (Python {sys.version.split()[0]})")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df = pd.read_csv(DATA_FILE)
    feature_cols = get_feature_cols(FEATURE_SET)

    all_rows = []
    for target_name, cfg in TARGETS.items():
        all_rows.extend(train_target(df, target_name, cfg, feature_cols))

    perf_path = os.path.join(OUTPUT_DIR, "model_performance.csv")
    pd.DataFrame(all_rows).round(4).to_csv(perf_path, index=False)
    print(f"\nTest-set performance saved to {perf_path}")
    write_requirements()
    print("Done.")


if __name__ == "__main__":
    main()
