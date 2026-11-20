"""
model_registry.py
-----------------
The single source of truth for which models exist and which are live.

- The catalog (live models, the properties they predict, the oxides they use)
  is what every page reads instead of hardcoded lists.
- Any registered model is loaded from its stored file and predicts the same way,
  whether it is one of the four originals or an upload.
- Admin actions (upload, publish, archive, restore, set default, discard) live
  here and write an audit entry each.

Each server instance caches the registry and re-checks a version counter every
few seconds, so a change made on one instance reaches all of them quickly.
"""

import math
import os
import threading
import time
import uuid
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

from app import model_storage, oxides
from app.model_validator import unit_kind
from app.registry_store import get_store, now_iso

REFRESH_SECONDS = float(os.getenv("REGISTRY_REFRESH_SECONDS", "5"))

# The original four models, shipped in the image under ml/models.
BUILTIN_MODELS = [
    ("RF", "Random Forest", "Tg_RF.pkl"),
    ("XGB", "XGBoost", "Tg_XGB.pkl"),
    ("KNN", "K-nearest neighbours", "Tg_KNN.pkl"),
    ("SVM", "Support vector machine", "Tg_SVM.pkl"),
]
BUILTIN_PROPERTIES = [
    {
        "id": "Tg",
        "name": "Glass transition temperature",
        "unit": "K",  # the original bundles say °C, but their values are Kelvin
        "unit_kind": "temperature",
        "plausible_min": 200.0,
        "plausible_max": 2500.0,
        "default_family": "Tg:RF",
    }
]


class RegistryError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


_lock = threading.RLock()
_state: Dict[str, Any] = {"version": None, "checked": 0.0, "models": [], "properties": {}}
_bundles: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

def refresh(force: bool = False) -> None:
    """Reload the registry if another instance (or this one) changed it."""
    with _lock:
        now = time.monotonic()
        if not force and _state["version"] is not None and now - _state["checked"] < REFRESH_SECONDS:
            return
        store = get_store()
        version = store.get_version()
        _state["checked"] = now
        if force or version != _state["version"]:
            _state["models"] = store.list_models()
            _state["properties"] = {p["id"]: p for p in store.list_properties()}
            _state["version"] = version
            # Forget loaded files for models that are no longer live.
            live_ids = {m["id"] for m in _state["models"] if m.get("status") in ("live", "ready")}
            for model_id in list(_bundles):
                if model_id not in live_ids:
                    _bundles.pop(model_id, None)


def _changed() -> None:
    get_store().bump_version()
    refresh(force=True)


def all_models() -> List[Dict[str, Any]]:
    refresh()
    return sorted(_state["models"], key=_sort_key)


def properties() -> Dict[str, Dict[str, Any]]:
    refresh()
    return dict(_state["properties"])


def version() -> int:
    refresh()
    return int(_state["version"] or 0)


def _sort_key(m: Dict[str, Any]):
    return (m.get("property", ""), m.get("order", 1e9), m.get("family", ""), -int(m.get("version", 0)))


def live_models(prop: Optional[str] = None) -> List[Dict[str, Any]]:
    return [
        m for m in all_models()
        if m.get("status") == "live" and (prop is None or m.get("property") == prop)
        and model_storage.exists(m.get("file") or {})
    ]


def live_oxides() -> List[str]:
    seen: List[str] = []
    for m in live_models():
        for f in m.get("features", []):
            if f not in seen:
                seen.append(f)
    return seen


def get_model(model_id: str) -> Dict[str, Any]:
    m = next((m for m in all_models() if m["id"] == model_id), None)
    if not m:
        raise RegistryError(f"No model with id '{model_id}'.", 404)
    return m


# ---------------------------------------------------------------------------
# Built-in models
# ---------------------------------------------------------------------------

def ensure_builtins() -> None:
    """Register the original four models and the Tg property, once."""
    store = get_store()
    existing = {m["id"]: m for m in store.list_models()}
    props = {p["id"] for p in store.list_properties()}
    changed = False
    for prop in BUILTIN_PROPERTIES:
        if prop["id"] not in props:
            store.put_property({**prop, "created_at": now_iso(), "builtin": True})
            changed = True
    for order, (code, name, filename) in enumerate(BUILTIN_MODELS):
        model_id = f"builtin-Tg-{code}"
        if model_id in existing:
            continue
        path = model_storage.ML_DIR / "models" / filename
        if not path.exists():
            print(f"[WARNING] Built-in model file missing: {path}")
            continue
        bundle = joblib.load(path)
        metrics = {str(k).lower(): float(v) for k, v in (bundle.get("test_metrics") or {}).items()}
        family = f"Tg:{code}"
        family_live = any(m.get("family") == family and m.get("status") == "live" for m in existing.values())
        record = {
            "id": model_id,
            "family": family,
            "code": code,
            "name": name,
            "description": "One of the original four models trained on the sodium borosilicate dataset.",
            "property": "Tg",
            "unit": "K",
            "features": [str(f) for f in bundle["features"]],
            "feature_min": {str(k): float(v) for k, v in bundle["feature_min"].items()},
            "feature_max": {str(k): float(v) for k, v in bundle["feature_max"].items()},
            "composition_sum": bundle.get("composition_sum"),
            "metrics": {k: metrics[k] for k in ("mae", "rmse", "r2") if k in metrics},
            "n_samples": bundle.get("n_samples"),
            "trained_on": bundle.get("trained_on"),
            "best_params": {str(k): v for k, v in (bundle.get("best_params") or {}).items()},
            "library_versions": {str(k): str(v) for k, v in (bundle.get("versions") or {}).items()},
            "estimator": type(bundle["model"]).__name__,
            "file": model_storage.builtin_ref(filename),
            "status": "archived" if family_live else "live",
            "version": 1,
            "order": order,
            "builtin": True,
            "checks": [],
            "created_at": now_iso(),
            "created_by": "system",
            "published_at": now_iso(),
            "published_by": "system",
        }
        store.put_model(record)
        changed = True
    if changed:
        store.bump_version()
    refresh(force=True)


# ---------------------------------------------------------------------------
# Catalog (public)
# ---------------------------------------------------------------------------

def _default_family(prop: Dict[str, Any], live: List[Dict[str, Any]]) -> Optional[str]:
    families = [m["family"] for m in live if m["property"] == prop["id"]]
    if prop.get("default_family") in families:
        return prop["default_family"]
    return families[0] if families else None


def public_model(m: Dict[str, Any], default_family: Optional[str] = None) -> Dict[str, Any]:
    keys = ["id", "family", "code", "name", "description", "property", "unit", "features", "feature_min",
            "feature_max", "metrics", "n_samples", "trained_on", "version", "builtin", "published_at", "estimator"]
    view = {k: m.get(k) for k in keys}
    view["is_default"] = m.get("family") == default_family
    return view


def catalog() -> Dict[str, Any]:
    """Everything that is live, for every page of the portal."""
    live = live_models()
    props = properties()
    out_props, defaults = [], {}
    for prop_id in dict.fromkeys(m["property"] for m in live):
        prop = props.get(prop_id) or {"id": prop_id, "name": prop_id, "unit": live[0]["unit"]}
        defaults[prop_id] = _default_family(prop, live)
        out_props.append({
            "id": prop_id,
            "name": prop.get("name", prop_id),
            "unit": prop.get("unit"),
            "unit_kind": prop.get("unit_kind") or unit_kind(prop.get("unit", "")),
            "default_model": next((m["code"] for m in live if m["family"] == defaults[prop_id]), None),
        })
    oxide_list = []
    for formula in live_oxides():
        info = oxides.parse_oxide(formula) or {"formula": formula, "element": None, "element_name": None,
                                               "molar_mass": None}
        info["properties"] = sorted({m["property"] for m in live if formula in m["features"]})
        oxide_list.append(info)
    return {
        "version": version(),
        "properties": out_props,
        "models": [public_model(m, defaults.get(m["property"])) for m in live],
        "oxides": oxide_list,
    }


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def _load(m: Dict[str, Any]):
    with _lock:
        if m["id"] in _bundles:
            return _bundles[m["id"]]
    ref = m.get("file") or {}
    path = model_storage.local_path(ref)
    if not path.exists():
        raise RegistryError(f"The file for {m.get('name')} is missing on the server.", 503)
    if ref.get("sha256") and model_storage.sha256_file(path) != ref["sha256"]:
        raise RegistryError(f"The file for {m.get('name')} doesn't match its checksum; it may have been altered.", 503)
    bundle = joblib.load(path)
    with _lock:
        _bundles[m["id"]] = bundle
    return bundle


def _warnings(m: Dict[str, Any], inputs: Dict[str, float]) -> List[str]:
    out = []
    fmin, fmax = m.get("feature_min") or {}, m.get("feature_max") or {}
    for f in m["features"]:
        if f in fmin and f in fmax:
            value, lo, hi = inputs[f], fmin[f], fmax[f]
            if value < lo or value > hi:
                out.append(
                    f"{f} = {value:g} is outside the training range ({lo:g} to {hi:g}); "
                    "the prediction is an extrapolation."
                )
    expected = m.get("composition_sum")
    if expected:
        total = sum(inputs.values())
        if abs(total - expected) > 0.01 * expected:
            out.append(
                f"Composition adds up to {total:g}, but training compositions add up "
                f"to about {expected:g}. Check the units."
            )
    return out


def predict(m: Dict[str, Any], composition_mol: Dict[str, float]) -> Dict[str, Any]:
    """Predict with one registered model. Oxides the model uses but the glass lacks count as 0."""
    bundle = _load(m)
    features = m["features"]
    inputs = {f: float(composition_mol.get(f, 0.0)) for f in features}
    X = pd.DataFrame([[inputs[f] for f in features]], columns=features)
    value = float(bundle["model"].predict(X)[0])
    if not math.isfinite(value):
        raise RegistryError(f"{m.get('name')} returned an invalid number for this glass.", 500)
    return {
        "property": m["property"],
        "model": m["code"],
        "model_id": m["id"],
        "model_name": m.get("name"),
        "model_version": m.get("version"),
        "value": value,
        "unit": m["unit"],
        "warnings": _warnings(m, inputs),
        "composition_basis": "mol %",
    }


def covering(prop: str, used_oxides: List[str], code: Optional[str] = None) -> List[Dict[str, Any]]:
    """Live models for a property that accept every oxide in the glass (optionally one code)."""
    used = set(used_oxides)
    return [
        m for m in live_models(prop)
        if used.issubset(m["features"]) and (code is None or m["code"] == code or m["id"] == code)
    ]


# ---------------------------------------------------------------------------
# Admin actions
# ---------------------------------------------------------------------------

def _audit(action: str, actor: Dict[str, Any], m: Optional[Dict[str, Any]], summary: str) -> None:
    get_store().add_audit({
        "id": f"a_{uuid.uuid4().hex[:16]}",
        "at": now_iso(),
        "action": action,
        "actor": actor.get("email") or actor.get("uid") or "unknown",
        "actor_uid": actor.get("uid"),
        "model_id": m.get("id") if m else None,
        "model_name": m.get("name") if m else None,
        "family": m.get("family") if m else None,
        "summary": summary,
    })


def _next_version(family: str) -> int:
    return 1 + max([int(m.get("version", 0)) for m in all_models() if m.get("family") == family] or [0])


def create_draft(info: Dict[str, Any], file_ref: Dict[str, Any], checks: List[Dict[str, Any]],
                 actor: Dict[str, Any]) -> Dict[str, Any]:
    family = f"{info['property']}:{info['code']}"
    record = {
        "id": f"m_{uuid.uuid4().hex[:12]}",
        "family": family,
        "code": info["code"],
        "name": info["name"],
        "description": "",
        "property": info["property"],
        "property_name": None if info["property_exists"] else info["property"],
        "unit": info["unit"],
        "features": info["features"],
        "feature_min": info["feature_min"],
        "feature_max": info["feature_max"],
        "composition_sum": info.get("composition_sum"),
        "metrics": info["metrics"],
        "n_samples": info.get("n_samples"),
        "trained_on": info.get("trained_on"),
        "best_params": info.get("best_params"),
        "library_versions": info.get("library_versions"),
        "estimator": info.get("estimator"),
        "file": file_ref,
        "status": "ready",
        "version": _next_version(family),
        "order": 1000 + len(all_models()),
        "builtin": False,
        "checks": checks,
        "new_oxides": [o["formula"] for o in info.get("new_oxides", [])],
        "created_at": now_iso(),
        "created_by": actor.get("email"),
    }
    get_store().put_model(record)
    _audit("upload", actor, record, f"Uploaded {record['name']} ({record['code']}) for {record['property']}.")
    _changed()
    return get_model(record["id"])


def update_model(model_id: str, fields: Dict[str, Any], actor: Dict[str, Any]) -> Dict[str, Any]:
    m = dict(get_model(model_id))
    changes = []
    for key in ("name", "description"):
        if key in fields and fields[key] is not None:
            value = str(fields[key]).strip()
            if key == "name" and not value:
                raise RegistryError("The display name can't be empty.")
            if value != m.get(key):
                m[key] = value[:120] if key == "name" else value[:1000]
                changes.append(key)
    if m["status"] == "ready":
        if fields.get("code") is not None:
            import re

            code = str(fields["code"]).strip()
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,12}", code) or code.upper() == "ALL":
                raise RegistryError("The short code must be 1–12 letters, digits, - or _ (and not 'ALL').")
            if code != m["code"]:
                m["code"] = code
                m["family"] = f"{m['property']}:{code}"
                m["version"] = _next_version(m["family"])
                changes.append("code")
        if m.get("property_name") is not None:
            if fields.get("property_name"):
                m["property_name"] = str(fields["property_name"]).strip()[:120]
                changes.append("property_name")
            if fields.get("unit"):
                m["unit"] = str(fields["unit"]).strip()[:20]
                changes.append("unit")
    if changes:
        get_store().put_model(m)
        _audit("edit", actor, m, f"Edited {', '.join(changes)} of {m['name']}.")
        _changed()
    return get_model(model_id)


def publish(model_id: str, actor: Dict[str, Any]) -> Dict[str, Any]:
    """Make a model live. Replaces the live version of the same model, if any."""
    m = dict(get_model(model_id))
    if m["status"] not in ("ready", "archived"):
        raise RegistryError(f"{m['name']} is already {m['status']}.", 409)
    if not model_storage.exists(m.get("file") or {}):
        raise RegistryError("The model file is missing on the server, so it can't go live.", 409)
    store = get_store()
    restoring = m["status"] == "archived"

    props = properties()
    prop = props.get(m["property"])
    if prop is None:
        prop = {
            "id": m["property"],
            "name": m.get("property_name") or m["property"],
            "unit": m["unit"],
            "unit_kind": unit_kind(m["unit"]),
            "plausible_min": None,
            "plausible_max": None,
            "default_family": m["family"],
            "created_at": now_iso(),
        }
        store.put_property(prop)

    replaced = []
    for other in all_models():
        if other["family"] == m["family"] and other["status"] == "live" and other["id"] != m["id"]:
            other = dict(other)
            other.update({"status": "archived", "archived_at": now_iso(), "archived_by": actor.get("email"),
                          "replaced_by": m["id"]})
            store.put_model(other)
            replaced.append(other)

    m.update({"status": "live", "published_at": now_iso(), "published_by": actor.get("email")})
    m.pop("replaced_by", None)
    store.put_model(m)

    if not any(x["family"] == prop.get("default_family") and x["status"] == "live"
               for x in store.list_models()):
        store.put_property({**prop, "default_family": m["family"]})

    what = f"version {m['version']} of {m['name']}"
    if replaced:
        summary = f"{'Restored' if restoring else 'Published'} {what}, replacing version {replaced[0]['version']}."
    else:
        summary = f"{'Restored' if restoring else 'Published'} {what} for {m['property']}."
    _audit("restore" if restoring else "publish", actor, m, summary)
    _changed()
    return get_model(model_id)


def archive(model_id: str, actor: Dict[str, Any], confirm: bool = False) -> Dict[str, Any]:
    """Take a live model off the portal. It stays in the registry and can be restored."""
    m = dict(get_model(model_id))
    if m["status"] != "live":
        raise RegistryError(f"{m['name']} isn't live.", 409)
    others = [x for x in live_models(m["property"]) if x["id"] != m["id"]]
    if not others and not confirm:
        raise RegistryError(
            f"{m['name']} is the last live model for {m['property']}. Switching it off removes "
            f"{m['property']} from the portal until another model is published.", 409)
    m.update({"status": "archived", "archived_at": now_iso(), "archived_by": actor.get("email")})
    get_store().put_model(m)
    _audit("archive", actor, m, f"Switched off version {m['version']} of {m['name']}.")
    _changed()
    return get_model(model_id)


def set_default(model_id: str, actor: Dict[str, Any]) -> Dict[str, Any]:
    m = get_model(model_id)
    if m["status"] != "live":
        raise RegistryError("Only a live model can be the default.", 409)
    prop = properties().get(m["property"])
    if prop is None:
        raise RegistryError(f"Property {m['property']} isn't registered.", 404)
    get_store().put_property({**prop, "default_family": m["family"]})
    _audit("default", actor, m, f"Made {m['name']} the default model for {m['property']}.")
    _changed()
    return get_model(model_id)


def discard(model_id: str, actor: Dict[str, Any]) -> None:
    """Delete an upload that was never published. Published models are archived, never deleted."""
    m = get_model(model_id)
    if m["status"] != "ready":
        raise RegistryError("Only an unpublished upload can be discarded. Switch off live models instead.", 409)
    get_store().delete_model(model_id)
    model_storage.delete(m.get("file") or {})
    _audit("discard", actor, m, f"Discarded the unpublished upload {m['name']}.")
    _changed()


def try_model(model_id: str, composition_mol: Dict[str, float]) -> Dict[str, Any]:
    """Predict with any model (even unpublished), next to the live ones for the same property."""
    m = get_model(model_id)
    used = [ox for ox, v in composition_mol.items() if v > 0]
    unknown = [ox for ox in used if ox not in m["features"]]
    if unknown:
        raise RegistryError(f"{m['name']} doesn't use {', '.join(unknown)}.")
    result = predict(m, composition_mol)
    compare = [predict(x, composition_mol) for x in covering(m["property"], used) if x["id"] != m["id"]]
    return {"result": result, "compare": compare}


def audit_log(limit: int = 100) -> List[Dict[str, Any]]:
    return get_store().list_audit(limit)
