"""
Model registry and admin portal: catalog, uploads and their checks, publish,
replace, restore, switch off, new elements, and the admin role.

Every test runs against its own empty registry folder (seeded with the four
built-in models), so nothing leaks between tests or into other test files.
"""

import io
import os
import uuid

import joblib
import numpy as np
import pandas as pd
import pytest
import sklearn
from fastapi.testclient import TestClient
from sklearn.neighbors import KNeighborsRegressor

from app import admin_auth, model_registry, registry_store
from app.admin_auth import require_admin
from app.firebase_auth import get_current_user
from app.main import app
from app.model_storage import ML_DIR

client = TestClient(app)
ADMIN = {"uid": "admin_1", "email": "admin@lab.edu", "email_verified": True}
SCIENTIST = {"uid": "sci_1", "email": "sci@lab.edu", "email_verified": True}


@pytest.fixture(autouse=True)
def fresh_registry(tmp_path, monkeypatch):
    old_dir = os.environ["REGISTRY_DIR"]
    monkeypatch.setenv("REGISTRY_DIR", str(tmp_path))
    registry_store.reset_store_for_tests()
    model_registry.ensure_builtins()
    app.dependency_overrides[require_admin] = lambda: ADMIN
    app.dependency_overrides[get_current_user] = lambda: ADMIN
    yield
    app.dependency_overrides.clear()
    monkeypatch.setenv("REGISTRY_DIR", old_dir)
    registry_store.reset_store_for_tests()
    model_registry.refresh(force=True)


def _versions():
    import xgboost

    return {"python": "3.12", "scikit-learn": sklearn.__version__, "xgboost": xgboost.__version__}


def _bundle(features, target="Tg", name="KNN2", fn=None, mae=15.0, versions=None, unit="K", data=None):
    """A small trained model saved the way ml/train_models.py saves its models."""
    if data is None:
        rng = np.random.default_rng(0)
        X = rng.uniform(0, 1, size=(80, len(features)))
        X = X / X.sum(axis=1, keepdims=True) * 100
        df = pd.DataFrame(X, columns=features)
        y = fn(df) if fn else 500 + 4 * df[features[0]]
    else:
        df, y = data
    model = KNeighborsRegressor(n_neighbors=3).fit(df, y)
    bundle = {
        "model": model,
        "model_name": name,
        "target": target,
        "unit": unit,
        "features": list(features),
        "feature_min": {f: float(df[f].min()) for f in features},
        "feature_max": {f: float(df[f].max()) for f in features},
        "composition_sum": 100.0,
        "test_metrics": {"MAE": mae, "RMSE": mae * 1.4, "R2": 0.85},
        "n_samples": len(df),
        "trained_on": "2026-11-20",
        "versions": versions or _versions(),
    }
    buf = io.BytesIO()
    joblib.dump(bundle, buf)
    return buf.getvalue()


def _upload(data: bytes, filename="model.pkl"):
    return client.post("/api/v1/admin/models/upload", files={"file": (filename, data, "application/octet-stream")})


def _check(resp_json, check_id):
    return next(c for c in resp_json["checks"] if c["id"] == check_id)


AL_FEATURES = ["SiO2", "B2O3", "Na2O", "Al2O3"]


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

def test_catalog_starts_with_the_four_builtin_models():
    cat = client.get("/api/v1/catalog").json()
    assert [m["code"] for m in cat["models"]] == ["RF", "XGB", "KNN", "SVM"]
    assert [o["formula"] for o in cat["oxides"]] == ["SiO2", "B2O3", "Na2O"]
    assert cat["oxides"][0]["element"] == "Si"
    tg = cat["properties"][0]
    assert tg["id"] == "Tg" and tg["unit"] == "K" and tg["default_model"] == "RF"
    assert all(m["unit"] == "K" for m in cat["models"])
    assert client.get("/api/v1/catalog/version").json()["version"] == cat["version"]


def test_builtins_are_registered_only_once():
    before = len(model_registry.all_models())
    model_registry.ensure_builtins()
    assert len(model_registry.all_models()) == before == 4


# ---------------------------------------------------------------------------
# Admin role
# ---------------------------------------------------------------------------

def test_admin_endpoints_reject_non_admins():
    app.dependency_overrides.pop(require_admin)
    app.dependency_overrides[get_current_user] = lambda: SCIENTIST
    assert client.get("/api/v1/admin/models").status_code == 403
    assert _upload(b"x").status_code == 403


def test_who_is_admin(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "Boss@Lab.edu, other@lab.edu")
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("DEV_MOCK_ADMIN", raising=False)
    assert admin_auth.is_admin({"email": "boss@lab.edu", "email_verified": True})
    assert not admin_auth.is_admin({"email": "boss@lab.edu", "email_verified": False})
    assert not admin_auth.is_admin({"email": "someone@lab.edu", "email_verified": True})
    assert admin_auth.is_admin({"email": "x@y.z", "admin": True})
    # The demo login is never an admin unless a development machine opts in.
    assert not admin_auth.is_admin({"email": "boss@lab.edu", "email_verified": True, "mock": True})
    monkeypatch.setenv("DEV_MOCK_ADMIN", "true")
    assert admin_auth.is_admin({"mock": True})
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert not admin_auth.is_admin({"mock": True})


def test_profile_reports_admin_flag(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "admin@lab.edu")
    mock = {"uid": "admin_1", "email": "admin@lab.edu", "email_verified": True, "mock": True}
    app.dependency_overrides[get_current_user] = lambda: mock
    monkeypatch.delenv("DEV_MOCK_ADMIN", raising=False)
    assert client.get("/api/v1/auth/profile").json()["isAdmin"] is False


# ---------------------------------------------------------------------------
# Upload checks
# ---------------------------------------------------------------------------

def test_upload_new_element_model_is_ready_but_not_live():
    res = _upload(_bundle(AL_FEATURES, name="KNN-Al"))
    body = res.json()
    assert res.status_code == 200, body
    assert body["status"] == "ready"
    assert all(c["status"] in ("pass", "skip") for c in body["checks"]), body["checks"]
    assert [o["formula"] for o in body["info"]["new_oxides"]] == ["Al2O3"]
    assert body["info"]["new_oxides"][0]["element_name"] == "Aluminium"
    assert "Aluminium (Al2O3)" in _check(body, "inputs")["detail"]
    assert body["model"]["status"] == "ready" and body["model"]["family"] == "Tg:KNN-Al"
    # Not on the portal until published.
    assert "Al2O3" not in [o["formula"] for o in client.get("/api/v1/catalog").json()["oxides"]]


def test_upload_rejects_wrong_file_type_and_garbage():
    body = _upload(b"hello", filename="model.txt").json()
    assert body["status"] == "failed" and _check(body, "file")["status"] == "fail"
    body = _upload(b"definitely not a pickle", filename="model.pkl").json()
    assert body["status"] == "failed" and _check(body, "loads")["status"] == "fail"
    assert _check(body, "format")["status"] == "skip"
    assert len(model_registry.all_models()) == 4  # nothing saved


def test_upload_rejects_bare_estimator():
    buf = io.BytesIO()
    joblib.dump(KNeighborsRegressor(), buf)
    body = _upload(buf.getvalue()).json()
    assert body["status"] == "failed"
    assert "model bundle" in _check(body, "format")["detail"]


def test_upload_rejects_non_oxide_inputs():
    body = _upload(_bundle(["SiO2", "B2O3", "Q4"])).json()
    assert body["status"] == "failed"
    check = _check(body, "inputs")
    assert check["status"] == "fail" and "Q4" in check["detail"]


def test_upload_rejects_other_library_versions():
    body = _upload(_bundle(AL_FEATURES, versions={"scikit-learn": "1.5.2", "xgboost": _versions()["xgboost"]})).json()
    assert body["status"] == "failed"
    check = _check(body, "versions")
    assert check["status"] == "fail" and "1.5.2" in check["detail"]


def test_upload_rejects_implausible_predictions():
    body = _upload(_bundle(AL_FEATURES, fn=lambda df: 100000 + df["SiO2"])).json()
    assert body["status"] == "failed"
    assert _check(body, "predicts")["status"] == "fail"


def test_upload_rejects_duplicate_file():
    data = _bundle(AL_FEATURES)
    assert _upload(data).json()["status"] == "ready"
    body = _upload(data).json()
    assert body["status"] == "failed" and _check(body, "duplicate")["status"] == "fail"


def test_reference_check_flags_a_model_in_the_wrong_unit():
    df = pd.read_csv(ML_DIR / "glass_data.csv")
    features = ["SiO2", "B2O3", "Na2O"]
    celsius = df["Tg"] - 273.15  # trained on °C but the property is in K
    body = _upload(_bundle(features, name="RF-C", data=(df[features], celsius))).json()
    assert body["status"] == "ready"  # a warning, not a failure: the admin decides
    check = _check(body, "reference")
    assert check["status"] == "warn" and "reference glasses" in check["detail"]


# ---------------------------------------------------------------------------
# Publish, new elements, replace, restore, switch off
# ---------------------------------------------------------------------------

def _project_for(user):
    app.dependency_overrides[get_current_user] = lambda: user
    res = client.post("/api/v1/projects", json={"name": f"Admin test {uuid.uuid4().hex[:6]}"})
    return res.json()["id"]


def test_publish_adds_new_element_everywhere():
    model = _upload(_bundle(AL_FEATURES, name="KNN-Al")).json()["model"]

    # Try it before publishing: with Al2O3 at 0 the built-ins can compare.
    tried = client.post(f"/api/v1/admin/models/{model['id']}/try",
                        json={"composition": {"SiO2": 60, "B2O3": 20, "Na2O": 20}}).json()
    assert tried["result"]["model"] == "KNN-Al"
    assert {c["model"] for c in tried["compare"]} == {"RF", "XGB", "KNN", "SVM"}

    published = client.post(f"/api/v1/admin/models/{model['id']}/publish").json()
    assert published["status"] == "live"

    cat = client.get("/api/v1/catalog").json()
    al = next(o for o in cat["oxides"] if o["formula"] == "Al2O3")
    assert al["element"] == "Al" and al["molar_mass"] == pytest.approx(101.961, abs=0.01)
    assert "Al" in client.get("/api/v1/elements").json()["supported_elements"]

    # Predicting a glass with Al2O3 uses only the model that accepts it.
    proj = _project_for(SCIENTIST)
    res = client.post("/api/v1/predict", json={
        "project_id": proj, "composition": {"SiO2": 60, "B2O3": 15, "Na2O": 15, "Al2O3": 10},
    })
    assert res.status_code == 200, res.json()
    body = res.json()
    assert [r["model"] for r in body["results"]] == ["KNN-Al"]
    assert body["results"][0]["model_id"] == model["id"] and body["results"][0]["model_version"] == 1
    assert body["composition_mol_percent"]["Al2O3"] == 10.0

    # Weight % works for the new oxide too (molar mass from its formula).
    res = client.post("/api/v1/predict", json={
        "project_id": proj, "composition": {"SiO2": 60, "Al2O3": 40}, "composition_basis": "wt",
    })
    assert res.status_code == 200

    # A glass without Al2O3 still gets all five models.
    res = client.post("/api/v1/predict", json={"project_id": proj, "composition": {"SiO2": 70, "Na2O": 30}})
    assert {r["model"] for r in res.json()["results"]} == {"RF", "XGB", "KNN", "SVM", "KNN-Al"}

    # Asking an original model for an Al2O3 glass explains why it can't.
    res = client.post("/api/v1/predict", json={
        "project_id": proj, "composition": {"SiO2": 60, "Al2O3": 40}, "model_name": "RF",
    })
    assert res.status_code == 400 and "can't predict" in res.json()["detail"]


def test_new_version_replaces_and_old_version_can_be_restored():
    v1 = _upload(_bundle(AL_FEATURES, name="GB")).json()["model"]
    client.post(f"/api/v1/admin/models/{v1['id']}/publish")
    v2 = _upload(_bundle(AL_FEATURES, name="GB", fn=lambda df: 600 + 3 * df["SiO2"])).json()["model"]
    assert v2["family"] == v1["family"] and v2["version"] == 2

    client.post(f"/api/v1/admin/models/{v2['id']}/publish")
    assert model_registry.get_model(v1["id"])["status"] == "archived"
    assert [m["id"] for m in model_registry.live_models() if m["family"] == "Tg:GB"] == [v2["id"]]

    # Roll back: publish version 1 again.
    restored = client.post(f"/api/v1/admin/models/{v1['id']}/publish").json()
    assert restored["status"] == "live"
    assert model_registry.get_model(v2["id"])["status"] == "archived"
    actions = [e["action"] for e in client.get("/api/v1/admin/audit").json()["entries"]]
    assert actions[:2] == ["restore", "publish"]


def test_switching_off_the_last_model_needs_confirmation():
    model = _upload(_bundle(["SiO2", "Na2O"], target="density", name="DEN", unit="g/cm3",
                            fn=lambda df: 2.2 + 0.01 * df["Na2O"])).json()
    assert model["status"] == "ready"
    assert model["info"]["property_exists"] is False
    m = model["model"]
    client.patch(f"/api/v1/admin/models/{m['id']}", json={"property_name": "Density", "unit": "g/cm³"})
    client.post(f"/api/v1/admin/models/{m['id']}/publish")
    cat = client.get("/api/v1/catalog").json()
    den = next(p for p in cat["properties"] if p["id"] == "density")
    assert den["name"] == "Density" and den["unit"] == "g/cm³" and den["unit_kind"] == "other"

    res = client.post(f"/api/v1/admin/models/{m['id']}/archive", json={})
    assert res.status_code == 409 and "last live model" in res.json()["detail"]
    res = client.post(f"/api/v1/admin/models/{m['id']}/archive", json={"confirm": True})
    assert res.json()["status"] == "archived"
    assert "density" not in [p["id"] for p in client.get("/api/v1/catalog").json()["properties"]]


def test_set_default_and_edit_and_discard():
    rf = "builtin-Tg-RF"
    xgb = "builtin-Tg-XGB"
    client.post(f"/api/v1/admin/models/{xgb}/default")
    cat = client.get("/api/v1/catalog").json()
    assert cat["properties"][0]["default_model"] == "XGB"
    assert client.get("/api/v1/bank/summary").status_code == 200

    client.patch(f"/api/v1/admin/models/{rf}", json={"name": "Random Forest (2025)"})
    assert next(m for m in client.get("/api/v1/catalog").json()["models"] if m["id"] == rf)["name"] == "Random Forest (2025)"

    draft = _upload(_bundle(AL_FEATURES)).json()["model"]
    res = client.patch(f"/api/v1/admin/models/{draft['id']}", json={"code": "ALL"})
    assert res.status_code == 400
    assert client.patch(f"/api/v1/admin/models/{draft['id']}", json={"code": "KNN4"}).json()["family"] == "Tg:KNN4"
    assert client.delete(f"/api/v1/admin/models/{draft['id']}").json()["success"] is True
    assert client.delete(f"/api/v1/admin/models/{rf}").status_code == 409  # published: archive, never delete
    assert all(m["id"] != draft["id"] for m in model_registry.all_models())


def test_zen_uses_registry_models():
    proj_user = SCIENTIST
    app.dependency_overrides[get_current_user] = lambda: proj_user
    res = client.post("/api/v1/zen/discover", json={"target_tg": 800, "tolerance": 25, "model_name": "XGB"})
    assert res.status_code == 200 and res.json()["features"] == ["SiO2", "B2O3", "Na2O"]
    res = client.post("/api/v1/zen/discover", json={"target_tg": 800, "tolerance": 25, "model_name": "NOPE"})
    assert res.status_code == 400
