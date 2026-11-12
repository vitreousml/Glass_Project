"""
FastAPI Server for Glass Composition Prediction Platform
Provides endpoints for Seer, Bank, and Zen.
Protected with strict Firebase Authentication token verification.
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime

import app.ml_adapter as ml_adapter
from app.firebase_auth import init_firebase, get_firestore_db, get_current_user

app = FastAPI(
    title="Glass Composition Prediction Platform API",
    description="Physics-Informed ML Platform serving Random Forest, XGBoost, KNN, and SVM models for Glass Transition Temperature (Tg) predictions. Secured by Firebase Authentication.",
    version="1.0.0"
)

# CORS setup for frontend development & production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to specific domains in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompositionInput(BaseModel):
    composition: Dict[str, float] = Field(
        ...,
        example={"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0},
        description="Oxide mole percentages summing to 100 mol %"
    )
    model_name: Optional[str] = Field(
        None,
        example="RF",
        description="One of the 4 models: RF, XGB, KNN, SVM. If omitted/null, returns predictions from all 4."
    )

class ZenDiscoverInput(BaseModel):
    target_tg: float = Field(..., example=800.0, description="Target Tg in Kelvin")
    tolerance: float = Field(default=25.0, example=20.0, description="Tolerance band (+/- K)")
    model_name: str = Field(default="RF", example="RF", description="Model to use for screening")

class UserProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    role: Optional[str] = "Glass Research Scientist"

@app.on_event("startup")
def startup_event():
    # 1. Initialize Firebase Admin SDK & connect Firestore
    try:
        init_firebase()
    except Exception as e:
        print(f"[ERROR] Failed to initialize Firebase Admin SDK: {e}")

    # 2. Verify model integrity (SHA-256)
    check_results = ml_adapter.verify_model_checksums()
    for model_file, is_valid in check_results.items():
        if not is_valid:
            print(f"[WARNING] Checksum verification mismatch for {model_file}!")
        else:
            print(f"[OK] Verified SHA-256 for {model_file}")

# -------------------------------------------------------------
# Public Endpoints (Metadata & Health)
# -------------------------------------------------------------

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Glass Composition Prediction Platform",
        "firebase_project": "glass-composition-platform"
    }

@app.get("/api/v1/elements")
def get_elements():
    """Return periodic table supported elements and metadata (publicly accessible)."""
    return ml_adapter.get_elements_metadata()

@app.get("/api/v1/models/info")
def get_models_info():
    """Return model performance metrics and properties (publicly accessible)."""
    return ml_adapter.get_models_metadata()

@app.get("/api/v1/bank/summary")
def get_bank_summary():
    """
    Bank exploration overview: returns safe statistical boundaries without revealing raw private data rows.
    """
    return {
        "system": "Na2O - B2O3 - SiO2 ternary glass system",
        "sample_count": 480,
        "target_property": "Tg (Glass Transition Temperature)",
        "unit": "Kelvin (K)",
        "composition_basis": "mol %",
        "ranges": {
            "SiO2": {"min": 40.0, "max": 85.0, "unit": "mol %"},
            "B2O3": {"min": 0.0, "max": 40.0, "unit": "mol %"},
            "Na2O": {"min": 0.0, "max": 45.0, "unit": "mol %"},
            "Tg": {"min": 496.15, "max": 998.15, "unit": "K"}
        },
        "models_available": ml_adapter.MODELS
    }

# -------------------------------------------------------------
# Authenticated Endpoints (Requires Firebase Bearer ID Token)
# -------------------------------------------------------------

@app.get("/api/v1/auth/me")
def get_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns authenticated user profile from Firebase Token and syncs/fetches user record in Firestore.
    Does NOT store prediction history (respecting privacy constraints).
    """
    uid = user.get("uid")
    db = get_firestore_db()
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()

    if not doc.exists:
        profile_data = {
            "uid": uid,
            "email": user.get("email"),
            "displayName": user.get("name") or user.get("email", "").split("@")[0],
            "plan": "Free Tier (Scale to Zero)",
            "role": "Glass Research Scientist",
            "createdAt": datetime.utcnow().isoformat()
        }
        user_ref.set(profile_data)
        return profile_data
    return doc.to_dict()

@app.post("/api/v1/predict")
def predict_glass(
    data: CompositionInput,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Predict Tg (in Kelvin) for given glass composition (in mol %).
    Requires authenticated user (Firebase ID Token).
    Does NOT record individual user prediction history to Firestore.
    """
    comp = data.composition
    try:
        if data.model_name:
            if data.model_name not in ml_adapter.MODELS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid model '{data.model_name}'. Choose from: {ml_adapter.MODELS}"
                )
            result = ml_adapter.predict_single_model(comp, data.model_name)
            return {
                "results": [result],
                "selected_model": data.model_name,
                "authenticated_user": user.get("email")
            }
        else:
            results = ml_adapter.predict_all_models(comp)
            return {
                "results": results,
                "selected_model": "ALL",
                "authenticated_user": user.get("email")
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/zen/discover")
def discover_compositions(
    data: ZenDiscoverInput,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Zen inverse design: given target Tg in Kelvin, screens composition space and returns candidates.
    Requires authenticated user (Firebase ID Token).
    Runs grid search locally on the server without exposing private raw dataset.
    """
    candidates = []
    step = 2.5
    sio2_vals = [x * step for x in range(16, 35)]  # 40 to ~85 mol %
    
    for s in sio2_vals:
        rem = 100.0 - s
        if rem <= 0:
            continue
        b_vals = [y * step for y in range(0, int(rem / step) + 1)]
        for b in b_vals:
            na = 100.0 - (s + b)
            if na < 0:
                continue
            comp = {"SiO2": s, "B2O3": b, "Na2O": na}
            res = ml_adapter.predict_single_model(comp, data.model_name)
            pred_tg = res["value"]
            diff = abs(pred_tg - data.target_tg)
            if diff <= data.tolerance:
                candidates.append({
                    "composition": comp,
                    "predicted_tg": round(pred_tg, 1),
                    "difference": round(diff, 1),
                    "warnings": res.get("warnings", []),
                    "unit": "K"
                })
            if len(candidates) >= 50:
                break
        if len(candidates) >= 50:
            break
            
    candidates.sort(key=lambda x: x["difference"])
    return {
        "target_tg": data.target_tg,
        "model_used": data.model_name,
        "tolerance": data.tolerance,
        "candidates_count": len(candidates),
        "candidates": candidates[:20],
        "authenticated_user": user.get("email")
    }
