"""
predict_tg.py
-------------
Predict the glass transition temperature (Tg) of a glass from its
composition, using the models saved by train_models.py.

Project : Physics-Informed Machine Learning to Accelerate the Discovery of
          Novel Glass Compositions for Energy-Harvesting Applications
Project ID: DSAI2025-EE-1018 (funded by COE-DSAI, TIET Patiala)

Expects the files models/Tg_RF.pkl, Tg_XGB.pkl, Tg_SVM.pkl, Tg_KNN.pkl
next to this script.

Use from the web application
    from predict_tg import predict_tg, predict_tg_all_models, predict_tg_batch

    predict_tg({"SiO2": 60, "B2O3": 20, "Na2O": 20}, model_name="RF")
    -> {"property": "Tg", "model": "RF", "value": ..., "unit": ..., "warnings": [...]}

    predict_tg_all_models({"SiO2": 60, "B2O3": 20, "Na2O": 20})
    -> list with one result per model

    predict_tg_batch(dataframe, model_name="RF")
    -> copy of the dataframe with predicted Tg added (for uploaded CSV files)

Use from the command line
    python predict_tg.py SiO2=60 B2O3=20 Na2O=20
"""

import os
import sys

import joblib
import pandas as pd

TARGET = "Tg"
AVAILABLE_MODELS = ["RF", "XGB", "SVM", "KNN"]
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

_loaded = {}  # cache so each .pkl is read from disk only once


def load_model(model_name="RF"):
    """Load (and cache) the saved model bundle for the given model name."""
    if model_name not in AVAILABLE_MODELS:
        raise ValueError(f"model_name must be one of {AVAILABLE_MODELS}")
    if model_name not in _loaded:
        path = os.path.join(MODEL_DIR, f"{TARGET}_{model_name}.pkl")
        if not os.path.exists(path):
            raise FileNotFoundError(f"{path} not found. Run train_models.py first.")
        _loaded[model_name] = joblib.load(path)
    return _loaded[model_name]


def _check_inputs(inputs, bundle):
    """Validate one composition; return warnings about extrapolation."""
    missing = [f for f in bundle["features"] if f not in inputs]
    if missing:
        raise ValueError(f"Missing inputs: {missing}. Required: {bundle['features']}")

    warnings = []
    for f in bundle["features"]:
        value = float(inputs[f])
        lo, hi = bundle["feature_min"][f], bundle["feature_max"][f]
        if value < lo or value > hi:
            warnings.append(
                f"{f} = {value:g} is outside the training range ({lo:g} to {hi:g}); "
                "the prediction is an extrapolation."
            )

    expected_sum = bundle.get("composition_sum")
    if expected_sum:
        total = sum(float(inputs[f]) for f in ("SiO2", "B2O3", "Na2O"))
        if abs(total - expected_sum) > 0.01 * expected_sum:
            warnings.append(
                f"Composition adds up to {total:g}, but training compositions add up "
                f"to about {expected_sum:g}. Check the units."
            )
    return warnings


def predict_tg(inputs, model_name="RF"):
    """Predict Tg for one composition given as a dict, e.g. {"SiO2": 60, ...}."""
    bundle = load_model(model_name)
    warnings = _check_inputs(inputs, bundle)
    X = pd.DataFrame([[float(inputs[f]) for f in bundle["features"]]],
                     columns=bundle["features"])
    value = float(bundle["model"].predict(X)[0])
    return {
        "property": TARGET,
        "model": model_name,
        "value": value,
        "unit": bundle["unit"],
        "warnings": warnings,
    }


def predict_tg_all_models(inputs):
    """Predict Tg for one composition with every available model."""
    return [predict_tg(inputs, m) for m in AVAILABLE_MODELS]


def predict_tg_batch(df, model_name="RF"):
    """Predict Tg for every row of a dataframe (e.g. an uploaded CSV)."""
    bundle = load_model(model_name)
    features = bundle["features"]
    missing = [f for f in features if f not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}. Required: {features}")

    X = df[features].astype(float)
    out = df.copy()
    out[f"{TARGET}_predicted_{model_name}"] = bundle["model"].predict(X)
    in_range = pd.Series(True, index=df.index)
    for f in features:
        in_range &= X[f].between(bundle["feature_min"][f], bundle["feature_max"][f])
    out["within_training_range"] = in_range
    return out


def model_info(model_name="RF"):
    """Details to show on the website: test metrics, training size, inputs."""
    b = load_model(model_name)
    return {k: b[k] for k in ("model_name", "target", "unit", "features",
                              "test_metrics", "n_samples", "best_params", "trained_on")}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict_tg.py SiO2=60 B2O3=20 Na2O=20")
        sys.exit(1)
    composition = {}
    for arg in sys.argv[1:]:
        key, value = arg.split("=")
        composition[key.strip()] = float(value)

    for r in predict_tg_all_models(composition):
        print(f"{r['model']:4s}: {TARGET} = {r['value']:.1f} {r['unit']}")
    for w in predict_tg(composition)["warnings"]:
        print("Warning:", w)
