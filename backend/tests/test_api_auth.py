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
    """Test authenticated predict endpoint requires project_id and saves under project."""
    import uuid
    mock_user = {"uid": "test_scientist_123", "email": "scientist@university.edu"}
    app.dependency_overrides[get_current_user] = lambda: mock_user

    # 1. Unselected project must fail
    res_no_proj = client.post("/api/v1/predict", json={
        "composition": {"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0},
        "model_name": "RF"
    })
    assert res_no_proj.status_code == 400
    assert "A project must be created and selected" in res_no_proj.json()["detail"]

    # 2. Create project with unique test name
    unique_name = f"Auth Test Study {uuid.uuid4().hex[:6]}"
    proj_res = client.post("/api/v1/projects", json={
        "name": unique_name,
        "description": "Project for testing auth and prediction"
    })
    assert proj_res.status_code == 200
    proj_id = proj_res.json()["id"]

    # 3. Predict under project
    payload = {
        "project_id": proj_id,
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
    assert data["project_id"] == proj_id
    assert "prediction_id" in data

    # Reset overrides
    app.dependency_overrides.clear()


def _as_signed_in():
    app.dependency_overrides[get_current_user] = lambda: {"uid": "u1", "email": "scientist@university.edu"}
    # Ensure u1 has a default test project
    res = client.post("/api/v1/projects", json={"name": "Default U1 Study", "description": "Auto created"})
    if res.status_code == 200:
        return res.json()["id"]
    projects = client.get("/api/v1/projects").json().get("projects", [])
    return projects[0]["id"] if projects else None

def test_predict_weight_percent_is_converted_to_mol():
    proj_id = _as_signed_in()
    try:
        wt = {"SiO2": 57.8007, "B2O3": 22.3248, "Na2O": 19.8746}
        res_wt = client.post("/api/v1/predict", json={"project_id": proj_id, "composition": wt, "composition_basis": "wt", "model_name": "RF"})
        res_mol = client.post("/api/v1/predict", json={"project_id": proj_id, "composition": {"SiO2": 60, "B2O3": 20, "Na2O": 20}, "model_name": "RF"})
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
    proj_id = _as_signed_in()
    try:
        res = client.post("/api/v1/predict", json={"project_id": proj_id, "composition": {"SiO2": 70, "Na2O": 30}, "model_name": "RF"})
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
    proj_id = _as_signed_in()
    try:
        p = dict(payload)
        p["project_id"] = proj_id
        res = client.post("/api/v1/predict", json=p)
        assert res.status_code == 400
        assert message in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_predict_rejects_unknown_basis():
    proj_id = _as_signed_in()
    try:
        res = client.post("/api/v1/predict", json={"project_id": proj_id, "composition": {"SiO2": 100}, "composition_basis": "vol"})
        assert res.status_code == 422
    finally:
        app.dependency_overrides.clear()

def test_project_crud_and_multiple_predictions():
    """Verify complete User -> Project -> Multiple Predictions lifecycle and cascading delete."""
    import uuid
    uid_test = f"researcher_{uuid.uuid4().hex[:6]}"
    user = {"uid": uid_test, "email": "vidhi@university.edu"}
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        # 1. Create project
        base_name = f"Borate Phase Transition {uuid.uuid4().hex[:4]}"
        create_res = client.post("/api/v1/projects", json={
            "name": base_name,
            "description": "Analyzing high B2O3 compositions"
        })
        assert create_res.status_code == 200
        proj = create_res.json()
        proj_id = proj["id"]
        assert proj["name"] == base_name
        assert proj["predictionCount"] == 0

        # 2. Reject duplicate project name for same user
        dup_res = client.post("/api/v1/projects", json={
            "name": base_name.lower(),
            "description": "Duplicate should fail"
        })
        assert dup_res.status_code == 400
        assert "already exists" in dup_res.json()["detail"]

        # 3. Make prediction 1 under this project
        pred1 = client.post("/api/v1/predict", json={
            "project_id": proj_id,
            "composition": {"SiO2": 50, "B2O3": 30, "Na2O": 20},
            "model_name": "RF"
        })
        assert pred1.status_code == 200
        assert pred1.json()["project_id"] == proj_id

        # 4. Make prediction 2 under the same project
        pred2 = client.post("/api/v1/predict", json={
            "project_id": proj_id,
            "composition": {"SiO2": 60, "B2O3": 20, "Na2O": 20},
            "model_name": "XGB"
        })
        assert pred2.status_code == 200
        assert pred2.json()["project_id"] == proj_id

        # 5. Get project details and verify multiple predictions exist
        details_res = client.get(f"/api/v1/projects/{proj_id}")
        assert details_res.status_code == 200
        details = details_res.json()
        assert details["project"]["predictionCount"] == 2
        assert len(details["predictions"]) == 2
        # Verify prediction details stored correctly
        models_saved = [p["selectedModel"] for p in details["predictions"]]
        assert "RF" in models_saved
        assert "XGB" in models_saved

        # 6. List projects
        list_res = client.get("/api/v1/projects")
        assert list_res.status_code == 200
        project_ids = [p["id"] for p in list_res.json()["projects"]]
        assert proj_id in project_ids

        # 7. Delete project with cascade
        del_res = client.delete(f"/api/v1/projects/{proj_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # 8. Verify project and predictions are deleted
        del_check = client.get(f"/api/v1/projects/{proj_id}")
        assert del_check.status_code == 404
    finally:
        app.dependency_overrides.clear()

