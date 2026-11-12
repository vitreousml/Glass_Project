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

