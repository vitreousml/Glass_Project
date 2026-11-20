"""
ml_adapter.py
-------------
Thin layer between the API and the model registry (app/model_registry.py).

Models, supported oxides and properties are no longer listed here: they come
from the registry, which holds the original four models plus anything an admin
publishes. The professor's ml/ folder is untouched; the original model files are
read from it as built-ins.
"""

import hashlib
import os
from typing import Any, Dict, List

from app import model_registry, oxides

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))  # .../backend/app
BACKEND_DIR = os.path.dirname(CURRENT_DIR)                 # .../backend
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)                # .../Glass_project
ML_DIR = os.path.join(PROJECT_ROOT, "ml")

CONFIRMED_UNIT = "K"
CONFIRMED_BASIS = "mol %"

# Molar masses (g/mol) for oxides the screens offer. Any other oxide's molar mass
# is worked out from its formula (app/oxides.py), so new elements need no entry here.
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

EXPECTED_HASHES = {
    "Tg_RF.pkl": "39F888306D108A8948B84B6312E48753D598F3A09AF7B1E1D76620376DBE487F",
    "Tg_XGB.pkl": "95BCE93450D8F54A63F98426C30209542679137FFA8A8CC1CD5884CE0C28FDEF",
    "Tg_KNN.pkl": "D2535C29F3B19D2C20C2FA4C48DC9AA3B1722A345C658A0BEB8EF3F4EDDA6DE3",
    "Tg_SVM.pkl": "B92C3B9877D5599339F6E172C0ACED6112784CB9F565BB107516998F0DF761A2"
}

def verify_model_checksums() -> Dict[str, bool]:
    """Verify SHA-256 checksums of the built-in model files at startup."""
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

# ---------------------------------------------------------------------------
# What is live, read from the registry
# ---------------------------------------------------------------------------

def live_codes(prop: str = "Tg") -> List[str]:
    """Short codes (RF, XGB, ...) of the live models for a property."""
    return [m["code"] for m in model_registry.live_models(prop)]

def supported_oxides() -> List[str]:
    """Every oxide at least one live model accepts."""
    return model_registry.live_oxides()

def available_properties() -> Dict[str, Dict[str, Any]]:
    """Properties with at least one live model."""
    return {p["id"]: {"name": p["name"], "unit": p["unit"]} for p in model_registry.catalog()["properties"]}

def molar_mass(oxide: str) -> float:
    return MOLAR_MASSES.get(oxide) or oxides.molar_mass(oxide)

def __getattr__(name: str):
    """Old constant names still work, and always reflect what is live right now."""
    if name == "MODELS":
        return live_codes("Tg")
    if name == "SUPPORTED_OXIDES":
        return supported_oxides()
    if name == "PROPERTIES":
        return available_properties()
    if name == "OXIDE_MAP":
        return {o["element"]: o["formula"] for o in model_registry.catalog()["oxides"]}
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

def get_elements_metadata():
    """Periodic table metadata: which elements have a live model, and their oxides."""
    cat = model_registry.catalog()
    return {
        "supported_elements": [o["element"] for o in cat["oxides"]],
        "implicit_matrix_elements": ["O"],
        "oxide_mapping": {o["element"]: o["formula"] for o in cat["oxides"]},
        "composition_basis": CONFIRMED_BASIS,
        "target_property": "Tg",
        "properties": [p["id"] for p in cat["properties"]],
        "unit": CONFIRMED_UNIT,
    }

def get_models_metadata() -> List[Dict[str, Any]]:
    """Metadata and test metrics for every live model."""
    out = []
    for m in model_registry.catalog()["models"]:
        out.append({
            "model_id": m["code"],
            "id": m["id"],
            "display_name": m["name"],
            "property": m["property"],
            "unit": m["unit"],
            "metrics": {**(m.get("metrics") or {}), "display_name": m["name"]},
            "features": m["features"],
            "n_samples": m.get("n_samples"),
            "version": m.get("version"),
            "is_default": m.get("is_default"),
        })
    return out

def _live_model(model_name: str, prop: str = "Tg") -> Dict[str, Any]:
    match = next((m for m in model_registry.live_models(prop)
                  if m["code"] == model_name or m["id"] == model_name), None)
    if match is None:
        raise ValueError(f"Model {model_name} is invalid. Must be one of {live_codes(prop)}")
    return match

def predict_single_model(composition: Dict[str, float], model_name: str, prop: str = "Tg") -> Dict[str, Any]:
    """Predict with one live model (by short code or id). Missing oxides count as 0."""
    return model_registry.predict(_live_model(model_name, prop), composition)

def predict_all_models(composition: Dict[str, float], prop: str = "Tg") -> List[Dict[str, Any]]:
    """Predict with every live model for a property."""
    return [model_registry.predict(m, composition) for m in model_registry.live_models(prop)]

def get_zen_grid_config(model_name: str = "", step: float = 2.5) -> Dict[str, Any]:
    """
    Oxide features and training bounds for the Zen grid search, taken from the
    model's registry record (read from its bundle at upload). With no model name,
    the default Tg model is used.
    """
    if model_name:
        m = _live_model(model_name)
    else:
        cat = model_registry.catalog()
        default = next((x for x in cat["models"] if x["property"] == "Tg" and x["is_default"]), None)
        if default is None:
            raise ValueError("No live model for Tg.")
        m = _live_model(default["id"])
    features: List[str] = m["features"]
    bounds: Dict[str, Dict[str, float]] = {}
    for feat in features:
        lo = max(0.0, float(m["feature_min"].get(feat, 0.0)))
        hi = min(100.0, float(m["feature_max"].get(feat, 100.0)))
        bounds[feat] = {"min": round(lo, 2), "max": round(hi, 2)}
    return {"features": features, "bounds": bounds, "step": step}

def wt_to_mol_percent(composition: Dict[str, float]) -> Dict[str, float]:
    """
    Convert an oxide composition from weight % to mol %.
    Each oxide's moles = weight / molar mass; the result is rescaled to sum to 100.
    """
    moles = {ox: float(w) / molar_mass(ox) for ox, w in composition.items()}
    total = sum(moles.values())
    if total <= 0:
        raise ValueError("Composition must contain at least one oxide above 0.")
    return {ox: 100.0 * n / total for ox, n in moles.items()}

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

