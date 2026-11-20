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


def test_wt_to_mol_equal_moles():
    # Weights equal to each molar mass are one mole each, so equal mol % apiece.
    comp_wt = dict(ml_adapter.MOLAR_MASSES)
    comp_mol = ml_adapter.wt_to_mol_percent(comp_wt)
    expected = 100.0 / len(comp_wt)
    for ox in comp_wt:
        assert comp_mol[ox] == pytest.approx(expected)

def test_wt_to_mol_known_glass():
    # 60/20/20 mol % SiO2/B2O3/Na2O is about 57.80/22.32/19.87 wt %.
    comp_mol = ml_adapter.wt_to_mol_percent({"SiO2": 57.8007, "B2O3": 22.3248, "Na2O": 19.8746})
    assert comp_mol["SiO2"] == pytest.approx(60.0, abs=0.01)
    assert comp_mol["B2O3"] == pytest.approx(20.0, abs=0.01)
    assert comp_mol["Na2O"] == pytest.approx(20.0, abs=0.01)
    assert sum(comp_mol.values()) == pytest.approx(100.0)

def test_wt_to_mol_rejects_empty():
    with pytest.raises(ValueError):
        ml_adapter.wt_to_mol_percent({"SiO2": 0.0})
