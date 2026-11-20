"""
model_validator.py
------------------
Every check an uploaded model goes through before it can be published, with
results written for a non-technical admin.

Each check is {"id", "label", "status", "detail"} where status is one of
pass, warn (can still publish), fail (can't publish) or skip (not checked).
"""

import json
import math
import os
import re
import subprocess
import sys
import tempfile
from importlib import metadata
from pathlib import Path
from typing import Any, Dict, List, Optional

from app import oxides
from app.model_storage import ML_DIR, sha256_bytes

MAX_BYTES = 30 * 1024 * 1024  # Cloud Run accepts requests up to 32 MB
ALLOWED_EXTENSIONS = {".pkl", ".joblib"}
INSPECT_TIMEOUT_S = 90
INSPECT_SCRIPT = Path(__file__).resolve().parent / "model_inspect.py"
REFERENCE_CSV = ML_DIR / "glass_data.csv"
CHECKED_LIBRARIES = ["scikit-learn", "xgboost"]

CHECKS = [
    ("file", "File type and size"),
    ("duplicate", "Not already in the portal"),
    ("loads", "Opens safely"),
    ("format", "Has the standard model details"),
    ("versions", "Made with the same library versions as the server"),
    ("inputs", "Inputs are oxide amounts"),
    ("predicts", "Gives sensible answers"),
    ("reference", "Agrees with reference measurements"),
]

# Friendly names and short codes for common model types.
ESTIMATORS = {
    "RandomForestRegressor": ("RF", "Random Forest"),
    "XGBRegressor": ("XGB", "XGBoost"),
    "KNeighborsRegressor": ("KNN", "K-nearest neighbours"),
    "SVR": ("SVM", "Support vector machine"),
    "GradientBoostingRegressor": ("GBR", "Gradient boosting"),
    "HistGradientBoostingRegressor": ("HGB", "Gradient boosting"),
    "ExtraTreesRegressor": ("ET", "Extra trees"),
    "DecisionTreeRegressor": ("DT", "Decision tree"),
    "LGBMRegressor": ("LGBM", "LightGBM"),
    "CatBoostRegressor": ("CAT", "CatBoost"),
    "MLPRegressor": ("MLP", "Neural network"),
    "GaussianProcessRegressor": ("GPR", "Gaussian process"),
    "LinearRegression": ("LR", "Linear regression"),
    "Ridge": ("RIDGE", "Ridge regression"),
    "Lasso": ("LASSO", "Lasso regression"),
}

CODE_RE = re.compile(r"^[A-Za-z0-9_-]{1,12}$")


def server_versions() -> Dict[str, str]:
    out = {}
    for lib in CHECKED_LIBRARIES:
        try:
            out[lib] = metadata.version(lib)
        except metadata.PackageNotFoundError:
            pass
    return out


def clean_unit(unit: Any) -> str:
    """Bundles sometimes store '°C' with a broken degree sign."""
    text = str(unit or "").strip()
    if text.endswith("C") and len(text) <= 3 and text != "C":
        return "°C"
    return text


def unit_kind(unit: str) -> str:
    return "temperature" if unit in ("K", "°C") else "other"


def _minor(version: str) -> str:
    return ".".join(str(version).split(".")[:2])


def _fmt(x: float) -> str:
    return f"{x:,.0f}" if abs(x) >= 100 else f"{x:.3g}"


def _inspect(path: Path) -> Dict[str, Any]:
    """Run model_inspect.py on the file in a separate, time-limited process."""
    args = [sys.executable, "-I", str(INSPECT_SCRIPT), str(path)]
    if REFERENCE_CSV.exists():
        args.append(str(REFERENCE_CSV))
    # Only what Python needs to start: no credentials or other settings.
    env = {k: v for k, v in os.environ.items() if k.upper() in {"PATH", "SYSTEMROOT", "TEMP", "TMP", "HOME", "LANG"}}
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=INSPECT_TIMEOUT_S, env=env)
    except subprocess.TimeoutExpired:
        return {"ok": False, "stage": "timeout"}
    lines = [ln for ln in proc.stdout.strip().splitlines() if ln.startswith("{")]
    if not lines:
        tail = (proc.stderr or "").strip().splitlines()[-1:] or ["no output"]
        return {"ok": False, "stage": "crash", "error": tail[0][:300]}
    return json.loads(lines[-1])


def run_checks(
    data: bytes,
    filename: str,
    existing_models: List[Dict[str, Any]],
    properties: Dict[str, Dict[str, Any]],
    live_oxides: List[str],
) -> Dict[str, Any]:
    """
    Check an uploaded file. Returns {"passed", "checks", "info", "sha256"}.
    `info` holds what was read from the file (None if it couldn't be read).
    """
    results: Dict[str, Dict[str, Any]] = {}

    def put(check_id: str, status: str, detail: str) -> None:
        label = dict(CHECKS)[check_id]
        results[check_id] = {"id": check_id, "label": label, "status": status, "detail": detail}

    def finish(info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        checks = [
            results.get(cid) or {"id": cid, "label": label, "status": "skip",
                                 "detail": "Not checked, because an earlier check failed."}
            for cid, label in CHECKS
        ]
        return {
            "passed": all(c["status"] != "fail" for c in checks) and all(c["status"] != "skip" or c["id"] == "reference" for c in checks),
            "checks": checks,
            "info": info,
            "sha256": digest,
        }

    digest = sha256_bytes(data) if data else ""

    # 1. File type and size
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        put("file", "fail", f"Expected a .pkl or .joblib model file, but got '{filename}'.")
        return finish()
    if not data:
        put("file", "fail", "The file is empty.")
        return finish()
    if len(data) > MAX_BYTES:
        put("file", "fail", f"The file is {len(data) / 1e6:.1f} MB; the limit is {MAX_BYTES // (1024 * 1024)} MB.")
        return finish()
    put("file", "pass", f"{ext} file, {len(data) / 1e6:.2f} MB.")

    # 2. Duplicate
    same = next((m for m in existing_models if (m.get("file") or {}).get("sha256") == digest), None)
    if same:
        put("duplicate", "fail",
            f"This exact file is already in the portal as {same.get('name')} "
            f"(version {same.get('version')}, {same.get('status')}).")
        return finish()
    put("duplicate", "pass", "This file hasn't been uploaded before.")

    # 3. Opens safely
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"upload{ext}"
        path.write_bytes(data)
        report = _inspect(path)
    if not report.get("ok"):
        stage = report.get("stage")
        if stage == "timeout":
            put("loads", "fail", f"The file took longer than {INSPECT_TIMEOUT_S} seconds to open.")
        else:
            put("loads", "fail", f"The file couldn't be opened: {report.get('error', 'unknown error')}. "
                                 "It may be damaged or saved with a different program.")
        return finish()
    put("loads", "pass", "Opened in a separate, time-limited process.")

    # 4. Standard details
    if not report.get("is_bundle"):
        put("format", "fail",
            f"The file holds a bare {report.get('type')} instead of a model bundle. Save it the way "
            "ml/train_models.py does: a dictionary with the model, its target, unit, features and ranges.")
        return finish()
    meta = report.get("meta") or {}
    missing = [k for k in ("target", "features") if not meta.get(k)]
    if report.get("estimator") is None:
        missing.insert(0, "model")
    if missing:
        put("format", "fail", f"The bundle is missing: {', '.join(missing)}.")
        return finish()
    if not report.get("has_predict"):
        put("format", "fail", f"The saved {report.get('estimator')} can't make predictions.")
        return finish()
    features = [str(f) for f in meta["features"]]
    fmin, fmax = meta.get("feature_min") or {}, meta.get("feature_max") or {}
    no_range = [f for f in features if f not in fmin or f not in fmax]
    raw_metrics = {str(k).lower(): v for k, v in (meta.get("test_metrics") or {}).items()}
    format_notes = []
    if no_range:
        format_notes.append(f"no training range for {', '.join(no_range)}, so out-of-range warnings won't appear")
    if "mae" not in raw_metrics:
        format_notes.append("no test accuracy (MAE) recorded")
    put("format", "warn" if format_notes else "pass",
        ("Readable, but " + "; ".join(format_notes) + ".") if format_notes
        else f"{report.get('estimator')} predicting {meta['target']} from {len(features)} inputs.")

    # 5. Library versions
    server = server_versions()
    trained = {str(k): str(v) for k, v in (meta.get("versions") or {}).items()}
    mismatched = [
        f"{lib} {trained[lib]} (server has {server[lib]})"
        for lib in CHECKED_LIBRARIES
        if lib in trained and lib in server and _minor(trained[lib]) != _minor(server[lib])
    ]
    version_warnings = [w for w in report.get("load_warnings", []) if "version" in w.lower()]
    if mismatched or version_warnings:
        detail = (f"Made with {', '.join(mismatched)}. " if mismatched else "") + \
                 "Ask the person who trained it to re-save it with " + \
                 ", ".join(f"{lib} {v}" for lib, v in server.items()) + "."
        put("versions", "fail", detail)
        return finish()
    if not any(lib in trained for lib in CHECKED_LIBRARIES):
        put("versions", "warn", "The file doesn't record which library versions made it, and it opened without "
                                "version warnings. Ask for a re-save if predictions look wrong.")
    else:
        put("versions", "pass", "Matches the server: " + ", ".join(f"{lib} {v}" for lib, v in server.items()) + ".")

    # 6. Inputs are oxides
    parsed = {f: oxides.parse_oxide(f) for f in features}
    bad = [f for f, p in parsed.items() if p is None]
    if bad:
        put("inputs", "fail",
            f"These inputs aren't oxide amounts: {', '.join(bad)}. People can only type in oxide amounts, so a "
            "model must take only oxides (anything else has to be calculated inside the model).")
        return finish()
    new_oxides = [f for f in features if f not in live_oxides]
    if new_oxides:
        names = ", ".join(f"{parsed[f]['element_name']} ({f})" for f in new_oxides)
        put("inputs", "pass", f"Uses {', '.join(features)}. Adds new element{'s' if len(new_oxides) > 1 else ''}: {names}.")
    else:
        put("inputs", "pass", f"Uses {', '.join(features)}, all already in the portal.")

    # 7. Sensible answers
    target = str(meta["target"])
    prop = properties.get(target)
    unit = prop["unit"] if prop else clean_unit(meta.get("unit"))
    preds = report.get("test_predictions")
    if report.get("predict_error") or not preds:
        put("predicts", "fail", f"It couldn't predict a typical glass: {report.get('predict_error', 'no result')}.")
        return finish()
    if not all(math.isfinite(p) for p in preds):
        put("predicts", "fail", "It gave an invalid number (not finite) for a typical glass.")
        return finish()
    lo, hi = (prop or {}).get("plausible_min"), (prop or {}).get("plausible_max")
    outside = [p for p in preds if (lo is not None and p < lo) or (hi is not None and p > hi)]
    if outside:
        put("predicts", "fail",
            f"It predicted {_fmt(outside[0])} {unit} for a glass inside its own training range; {target} should be "
            f"between {_fmt(lo)} and {_fmt(hi)} {unit}. The model or its unit may be wrong.")
        return finish()
    put("predicts", "pass",
        f"Typical glasses came out between {_fmt(min(preds))} and {_fmt(max(preds))} {unit}.")

    # 8. Reference measurements
    claimed = raw_metrics.get("mae")
    ref = report.get("reference")
    if not ref:
        put("reference", "skip", f"No reference measurements for {target} with these oxides yet.")
    else:
        mae = ref["mae"]
        allowed = max(2.5 * claimed, claimed + 30) if claimed else None
        if not ref.get("finite"):
            put("reference", "warn", "Some reference glasses gave invalid numbers.")
        elif allowed is not None and mae > allowed:
            put("reference", "warn",
                f"On {ref['n']} reference glasses it is off by {_fmt(mae)} {unit} on average, much more than the "
                f"{_fmt(claimed)} {unit} the file claims. Check the model's unit and training data before publishing.")
        else:
            put("reference", "pass",
                f"On {ref['n']} reference glasses it is off by {_fmt(mae)} {unit} on average"
                + (f" (the file claims {_fmt(claimed)} {unit})." if claimed else "."))

    code, friendly = ESTIMATORS.get(report.get("estimator") or "", (None, None))
    raw_code = str(meta.get("model_name") or code or "MODEL")
    clean_code = re.sub(r"[^A-Za-z0-9_-]", "", raw_code)[:12] or "MODEL"
    info = {
        "code": clean_code,
        "name": friendly or clean_code,
        "estimator": report.get("estimator"),
        "property": target,
        "property_exists": prop is not None,
        "unit": unit,
        "bundle_unit": clean_unit(meta.get("unit")),
        "features": features,
        "feature_min": {f: float(fmin[f]) for f in features if f in fmin},
        "feature_max": {f: float(fmax[f]) for f in features if f in fmax},
        "composition_sum": meta.get("composition_sum"),
        "metrics": {k: float(raw_metrics[k]) for k in ("mae", "rmse", "r2") if k in raw_metrics},
        "n_samples": meta.get("n_samples"),
        "trained_on": meta.get("trained_on"),
        "best_params": meta.get("best_params"),
        "library_versions": trained,
        "new_oxides": [parsed[f] for f in new_oxides],
        "oxides": [parsed[f] for f in features],
        "reference": ref,
    }
    return finish(info)
