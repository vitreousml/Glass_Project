import pytest
import sys
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
sys.path.insert(0, BACKEND_DIR)

import app.ml_adapter as ml_adapter

def test_model_checksums():
    checksums = ml_adapter.verify_model_checksums()
    for model_file, is_valid in checksums.items():
        assert is_valid is True, f"Checksum verification failed for {model_file}"

def test_predict_single_model():
    comp = {"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0}
    for model_name in ["RF", "XGB", "KNN", "SVM"]:
        res = ml_adapter.predict_single_model(comp, model_name)
        assert res["property"] == "Tg"
        assert res["unit"] == "K"
        assert res["composition_basis"] == "mol %"
        assert 400.0 < res["value"] < 1200.0
        assert isinstance(res["warnings"], list)

def test_predict_all_models():
    comp = {"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0}
    results = ml_adapter.predict_all_models(comp)
    assert len(results) == 4
    model_names = [r["model"] for r in results]
    assert set(model_names) == {"RF", "XGB", "KNN", "SVM"}

