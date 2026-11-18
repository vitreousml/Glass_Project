"""
test_bank_query.py
------------------
Unit tests for the new Bank dataset query endpoint:
POST /api/v1/bank/query
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app

client = TestClient(app)
AUTH_HEADER = {"Authorization": "Bearer mock_dev_token_bank_test"}

def test_bank_query_requires_auth():
    """Unauthenticated requests must be rejected with 401."""
    res = client.post("/api/v1/bank/query", json={"oxides": ["SiO2"], "properties": ["Tg"]})
    assert res.status_code == 401

def test_bank_query_standard():
    """Standard query with 3 oxides and Tg returns 480 dataset rows."""
    res = client.post(
        "/api/v1/bank/query",
        json={"oxides": ["SiO2", "B2O3", "Na2O"], "properties": ["Tg"]},
        headers=AUTH_HEADER
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 480
    assert len(data["rows"]) == 480
    row = data["rows"][0]
    assert "SiO2" in row and "B2O3" in row and "Na2O" in row and "Tg" in row
    assert isinstance(row["Tg"], (int, float))

def test_bank_query_or_logic_multiple_properties():
    """
    Requirement: 'make sure if data for any one property is present then also we will give them that row'
    When Tg (recorded) and density (unrecorded in this CSV) are selected,
    rows with Tg must still be returned with Tg value and density as None.
    """
    res = client.post(
        "/api/v1/bank/query",
        json={"oxides": ["SiO2", "B2O3"], "properties": ["Tg", "density"]},
        headers=AUTH_HEADER
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 480
    row = data["rows"][0]
    assert row["Tg"] is not None
    assert row["density"] is None

def test_bank_query_max_properties_constraint():
    """Constraint: max 2 properties can be selected."""
    res = client.post(
        "/api/v1/bank/query",
        json={"oxides": ["SiO2"], "properties": ["Tg", "density", "refractive_index"]},
        headers=AUTH_HEADER
    )
    assert res.status_code == 400
    assert "between 1 and 2 properties" in res.json()["detail"]

def test_bank_query_max_oxides_constraint():
    """Constraint: max 5 oxides can be selected."""
    res = client.post(
        "/api/v1/bank/query",
        json={
            "oxides": ["SiO2", "B2O3", "Na2O", "Al2O3", "P2O5", "GeO2"],
            "properties": ["Tg"]
        },
        headers=AUTH_HEADER
    )
    assert res.status_code == 400
    assert "between 1 and 5 oxides" in res.json()["detail"]

def test_bank_query_empty_when_no_matching_properties():
    """If selected properties have no data in the CSV, 0 rows are returned."""
    res = client.post(
        "/api/v1/bank/query",
        json={"oxides": ["SiO2"], "properties": ["density"]},
        headers=AUTH_HEADER
    )
    assert res.status_code == 200
    assert res.json()["total"] == 0
    assert len(res.json()["rows"]) == 0

def test_bank_query_empty_when_no_matching_oxides():
    """If none of the selected oxides exist in the dataset, 0 rows are returned."""
    res = client.post(
        "/api/v1/bank/query",
        json={"oxides": ["Al2O3"], "properties": ["Tg"]},
        headers=AUTH_HEADER
    )
    assert res.status_code == 200
    assert res.json()["total"] == 0
