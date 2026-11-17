import pytest
import sys
import os
from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.firebase_auth import get_current_user
import app.ml_adapter as ml_adapter

client = TestClient(app)

def test_public_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_public_elements():
    res = client.get("/api/v1/elements")
    assert res.status_code == 200
    data = res.json()
    assert "Si" in data["supported_elements"]
    assert data["unit"] == "K"

def test_unauthenticated_predict_rejected():
    """Ensure POST /api/v1/predict rejects unauthenticated requests with 401 Unauthorized."""
    payload = {
        "composition": {"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0},
        "model_name": "RF"
    }
    res = client.post("/api/v1/predict", json=payload)
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]

def test_unauthenticated_zen_rejected():
    """Ensure POST /api/v1/zen/discover rejects unauthenticated requests with 401 Unauthorized."""
    payload = {"target_tg": 850.0, "tolerance": 20.0, "model_name": "RF"}
    res = client.post("/api/v1/zen/discover", json=payload)
    assert res.status_code == 401

def test_authenticated_predict_with_dependency_override():
    """Test authenticated predict endpoint using verified mock user token."""
    mock_user = {"uid": "test_scientist_123", "email": "scientist@university.edu"}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    payload = {
        "composition": {"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0},
        "model_name": "RF"
    }
    res = client.post("/api/v1/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["selected_model"] == "RF"
    assert data["results"][0]["property"] == "Tg"
    assert data["results"][0]["unit"] == "K"
    assert data["authenticated_user"] == "scientist@university.edu"

    # Reset overrides
    app.dependency_overrides.clear()


def _as_signed_in():
    app.dependency_overrides[get_current_user] = lambda: {"uid": "u1", "email": "scientist@university.edu"}

def test_predict_weight_percent_is_converted_to_mol():
    _as_signed_in()
    try:
        wt = {"SiO2": 57.8007, "B2O3": 22.3248, "Na2O": 19.8746}
        res_wt = client.post("/api/v1/predict", json={"composition": wt, "composition_basis": "wt", "model_name": "RF"})
        res_mol = client.post("/api/v1/predict", json={"composition": {"SiO2": 60, "B2O3": 20, "Na2O": 20}, "model_name": "RF"})
        assert res_wt.status_code == 200 and res_mol.status_code == 200
        data = res_wt.json()
        assert data["input_basis"] == "wt %"
        assert data["composition_mol_percent"]["SiO2"] == pytest.approx(60.0, abs=0.01)
        assert data["results"][0]["unit"] == "K"
        # Same glass either way, so the same prediction.
        assert data["results"][0]["value"] == pytest.approx(res_mol.json()["results"][0]["value"], abs=0.5)
    finally:
        app.dependency_overrides.clear()

def test_predict_fills_missing_oxides_with_zero():
    _as_signed_in()
    try:
        res = client.post("/api/v1/predict", json={"composition": {"SiO2": 70, "Na2O": 30}, "model_name": "RF"})
        assert res.status_code == 200
        assert res.json()["composition_mol_percent"] == {"SiO2": 70.0, "B2O3": 0.0, "Na2O": 30.0}
    finally:
        app.dependency_overrides.clear()

@pytest.mark.parametrize("payload, message", [
    ({"composition": {"SiO2": 60, "Al2O3": 40}}, "Unsupported oxides"),
    ({"composition": {"SiO2": 60, "Na2O": -5}}, "negative"),
    ({"composition": {"SiO2": 0}}, "at least one oxide"),
    ({"composition": {"SiO2": 100}, "properties": ["density"]}, "No trained model"),
    ({"composition": {"SiO2": 100}, "properties": []}, "at least one property"),
    ({"composition": {"SiO2": 100}, "model_name": "LGBM"}, "Invalid model"),
])
def test_predict_rejects_bad_input(payload, message):
    _as_signed_in()
    try:
        res = client.post("/api/v1/predict", json=payload)
        assert res.status_code == 400
        assert message in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_predict_rejects_unknown_basis():
    _as_signed_in()
    try:
        res = client.post("/api/v1/predict", json={"composition": {"SiO2": 100}, "composition_basis": "vol"})
        assert res.status_code == 422
    finally:
        app.dependency_overrides.clear()
