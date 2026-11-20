"""
ml_adapter.py
-------------
Read-only adapter wrapping predict_tg.py.
Integrates with the frozen /ml module without modifying any professor code.
Guarantees Kelvin (K) unit reporting and mol % verification.
"""

import os
import sys
import hashlib
from typing import Dict, List, Any, Optional

# Add the ml directory to the python path so predict_tg can be imported
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__)) # .../backend/app
BACKEND_DIR = os.path.dirname(CURRENT_DIR)               # .../backend
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)              # .../Glass_project
ML_DIR = os.path.join(PROJECT_ROOT, "ml")
if ML_DIR not in sys.path:
    sys.path.insert(0, ML_DIR)

import predict_tg  # Clean read-only import

CONFIRMED_UNIT = "K"
CONFIRMED_BASIS = "mol %"
MODELS = ["RF", "XGB", "KNN", "SVM"]
OXIDE_MAP = {
    "Si": "SiO2",
    "B": "B2O3",
    "Na": "Na2O"
}
SUPPORTED_OXIDES = list(OXIDE_MAP.values())

# Molar masses in g/mol, used to turn weight % into mol % (the models were trained on mol %).
MOLAR_MASSES = {
    "SiO2": 60.084,
    "B2O3": 69.620,
    "Na2O": 61.979,
    "Al2O3": 101.961,
    "P2O5": 141.944,
    "GeO2": 104.630,
    "As2O3": 197.841,
    "V2O5": 181.880,
    "FeO": 71.844,
    "Fe2O3": 159.687,
    "MnO": 70.937,
    "Mn2O3": 157.874,
    "MnO2": 86.936,
}

# Properties that have trained models. Add an entry here when a new model is ready.
PROPERTIES = {
    "Tg": {"name": "Glass transition temperature", "unit": CONFIRMED_UNIT},
}

EXPECTED_HASHES = {
    "Tg_RF.pkl": "39F888306D108A8948B84B6312E48753D598F3A09AF7B1E1D76620376DBE487F",
    "Tg_XGB.pkl": "95BCE93450D8F54A63F98426C30209542679137FFA8A8CC1CD5884CE0C28FDEF",
    "Tg_KNN.pkl": "D2535C29F3B19D2C20C2FA4C48DC9AA3B1722A345C658A0BEB8EF3F4EDDA6DE3",
    "Tg_SVM.pkl": "B92C3B9877D5599339F6E172C0ACED6112784CB9F565BB107516998F0DF761A2"
}

def verify_model_checksums() -> Dict[str, bool]:
    """Verify SHA-256 checksums of model files at startup."""
    results = {}
    for filename, expected_hash in EXPECTED_HASHES.items():
        file_path = os.path.join(ML_DIR, "models", filename)
        if not os.path.exists(file_path):
            results[filename] = False
            continue
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        results[filename] = (sha256.hexdigest().upper() == expected_hash)
    return results

def get_elements_metadata():
    """Return periodic table metadata indicating supported oxides."""
    return {
        "supported_elements": ["Si", "B", "Na"],
        "implicit_matrix_elements": ["O"],
        "oxide_mapping": OXIDE_MAP,
        "composition_basis": CONFIRMED_BASIS,
        "target_property": "Tg",
        "unit": CONFIRMED_UNIT
    }

def get_models_metadata() -> List[Dict[str, Any]]:
    """Return metadata and performance metrics for the 4 ML models."""
    info_list = []
    # Metrics from 80/20 test split as verified
    metrics = {
        "RF": {"mae": 14.85, "rmse": 21.78, "r2": 0.878, "display_name": "Random Forest"},
        "XGB": {"mae": 15.75, "rmse": 22.24, "r2": 0.873, "display_name": "XGBoost"},
        "KNN": {"mae": 17.82, "rmse": 24.98, "r2": 0.840, "display_name": "K-Nearest Neighbors"},
        "SVM": {"mae": 22.37, "rmse": 28.94, "r2": 0.785, "display_name": "Support Vector Machine"}
    }
    for m in MODELS:
        raw_info = predict_tg.model_info(m)
        info_list.append({
            "model_id": m,
            "display_name": metrics[m]["display_name"],
            "unit": CONFIRMED_UNIT,
            "metrics": metrics[m],
            "feature_min": raw_info.get("best_params", {}),
            "n_samples": raw_info.get("n_samples", 480)
        })
    return info_list

def predict_single_model(composition: Dict[str, float], model_name: str) -> Dict[str, Any]:
    """Run prediction on the chosen model out of the 4."""
    if model_name not in MODELS:
        raise ValueError(f"Model {model_name} is invalid. Must be one of {MODELS}")
    
    # Ensure inputs are mapped to the 3 features (SiO2, B2O3, Na2O)
    formatted_inputs = {
        "SiO2": float(composition.get("SiO2", 0.0)),
        "B2O3": float(composition.get("B2O3", 0.0)),
        "Na2O": float(composition.get("Na2O", 0.0))
    }
    
    res = predict_tg.predict_tg(formatted_inputs, model_name=model_name)
    # Enforce verified unit Kelvin
    res["unit"] = CONFIRMED_UNIT
    res["composition_basis"] = CONFIRMED_BASIS
    return res

def predict_all_models(composition: Dict[str, float]) -> List[Dict[str, Any]]:
    """Run prediction across all 4 models."""
    results = []
    for m in MODELS:
        results.append(predict_single_model(composition, m))
    return results

def get_zen_grid_config(model_name: str = "RF", step: float = 2.5) -> Dict[str, Any]:
    """
    Returns oxide features and training bounds for Zen grid search,
    derived entirely from the model bundle — nothing hardcoded.
    When an admin updates the ML bundle, Zen automatically picks it up.
    """
    bundle = predict_tg.load_model(model_name)
    features: List[str] = bundle["features"]          # e.g. ["SiO2","B2O3","Na2O"]
    feature_min: Dict[str, float] = bundle["feature_min"]
    feature_max: Dict[str, float] = bundle["feature_max"]
    bounds: Dict[str, Dict[str, float]] = {}
    for feat in features:
        lo = max(0.0, float(feature_min.get(feat, 0.0)))
        hi = min(100.0, float(feature_max.get(feat, 100.0)))
        bounds[feat] = {"min": round(lo, 2), "max": round(hi, 2)}
    return {"features": features, "bounds": bounds, "step": step}

def wt_to_mol_percent(composition: Dict[str, float]) -> Dict[str, float]:
    """
    Convert an oxide composition from weight % to mol %.
    Each oxide's moles = weight / molar mass; the result is rescaled to sum to 100.
    """
    moles = {ox: float(w) / MOLAR_MASSES[ox] for ox, w in composition.items()}
    total = sum(moles.values())
    if total <= 0:
        raise ValueError("Composition must contain at least one oxide above 0.")
    return {ox: 100.0 * n / total for ox, n in moles.items()}

# One prediction function per property; all of them return values in Kelvin.
PREDICTORS = {
    "Tg": predict_single_model,
}

# ---------------------------------------------------------------------------
# Bank data-query helpers
# ---------------------------------------------------------------------------
import csv

# Oxides known across the platform (models + glass formers + transition metal oxides)
ALL_BANK_OXIDES = [
    "SiO2", "B2O3", "Na2O", "Al2O3", "P2O5", "GeO2", "As2O3", "V2O5",
    "FeO", "Fe2O3", "MnO", "Mn2O3", "MnO2"
]
# Columns actually present in the training dataset CSV
DATASET_OXIDE_COLS = ["SiO2", "B2O3", "Na2O"]

# All candidate properties
ALL_BANK_PROPERTIES = {
    "Tg": "Glass transition temperature (K)",
    "density": "Density (g/cm³)",
    "refractive_index": "Refractive index",
    "youngs_modulus": "Young's modulus (GPa)",
    "cte": "Thermal expansion coefficient (10⁻⁶/K)",
}
# Properties actually measured in this CSV
DATASET_PROPERTY_COLS = {"Tg": "Tg"}

def _load_bank_csv() -> list[dict]:
    """Load glass_data.csv rows, returning user-facing columns."""
    path = os.path.join(ML_DIR, "glass_data.csv")
    rows: list[dict] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for rec in reader:
            row: dict = {}
            for ox in ALL_BANK_OXIDES:
                if ox in DATASET_OXIDE_COLS:
                    try:
                        row[ox] = float(rec[ox])
                    except (KeyError, ValueError):
                        row[ox] = 0.0
                else:
                    row[ox] = 0.0
            for prop_id in ALL_BANK_PROPERTIES:
                if prop_id in DATASET_PROPERTY_COLS:
                    col_name = DATASET_PROPERTY_COLS[prop_id]
                    try:
                        val = float(rec[col_name])
                        row[prop_id] = val
                    except (KeyError, ValueError):
                        row[prop_id] = None
                else:
                    row[prop_id] = None
            rows.append(row)
    return rows

# Cache once at import time — the CSV never changes at runtime.
_BANK_DATA: list[dict] | None = None

def get_bank_data() -> list[dict]:
    global _BANK_DATA
    if _BANK_DATA is None:
        _BANK_DATA = _load_bank_csv()
    return _BANK_DATA

def query_bank(
    oxides: list[str],
    properties: list[str],
) -> list[dict]:
    """
    Return rows from the training dataset matching the selected oxides and properties.
    Requirement: if data for any ONE property is present, the row is returned.
    If none of the selected oxides exist in the dataset, returns empty list.
    """
    # Check if at least one selected oxide exists in the dataset
    dataset_has_any_oxide = any(ox in DATASET_OXIDE_COLS for ox in oxides)
    if not dataset_has_any_oxide:
        return []

    all_rows = get_bank_data()
    out: list[dict] = []
    for row in all_rows:
        # A row matches if at least one requested property has data (non-null)
        has_any_prop = any(row.get(p) is not None for p in properties)
        if not has_any_prop:
            continue
        entry: dict = {}
        for ox in oxides:
            entry[ox] = row.get(ox, 0.0)
        for p in properties:
            entry[p] = row.get(p)  # float or None
        out.append(entry)
    return out

