"""
FastAPI Server for Glass Composition Prediction Platform
Provides endpoints for Seer, Bank, and Zen.
Protected with strict Firebase Authentication token verification.
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Literal, Optional, Any
from datetime import datetime

import app.ml_adapter as ml_adapter
import app.model_registry as model_registry
import app.project_service as project_service
from app.admin_api import router as admin_router
from app.admin_auth import is_admin
from app.firebase_auth import init_firebase, get_firestore_db, get_current_user
from app.model_registry import RegistryError

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

# Admin portal: model upload, checks, publish, archive, restore, audit log.
app.include_router(admin_router)

class CompositionInput(BaseModel):
    project_id: Optional[str] = Field(
        None,
        example="proj_a1b2c3d4",
        description="Project ID under which this prediction will be saved. Required before predicting."
    )
    composition: Dict[str, float] = Field(
        ...,
        example={"SiO2": 60.0, "B2O3": 20.0, "Na2O": 20.0},
        description="Oxide percentages summing to 100, in the unit given by composition_basis"
    )
    composition_basis: Literal["mol", "wt"] = Field(
        "mol",
        example="mol",
        description="'mol' for mol % or 'wt' for weight %. Weight % is converted to mol % before predicting."
    )
    model_name: Optional[str] = Field(
        None,
        example="RF",
        description="One of the 4 models: RF, XGB, KNN, SVM. If omitted/null, returns predictions from all 4."
    )
    properties: List[str] = Field(
        default_factory=lambda: ["Tg"],
        example=["Tg"],
        description="Properties to predict. Only properties with a trained model are accepted."
    )

class ProjectCreateInput(BaseModel):
    name: str = Field(..., example="Sodium Borosilicate High-Tg Study", description="Unique name for the project")
    description: Optional[str] = Field("", example="Research on thermal stability in nuclear waste glasses", description="Project description or notes")


class ZenDiscoverInput(BaseModel):
    target_tg: float = Field(..., example=800.0, description="Target Tg in Kelvin")
    tolerance: float = Field(default=25.0, example=20.0, description="Tolerance band (+/- K)")
    model_name: str = Field(default="RF", example="RF", description="Model to use for screening")

class BankQueryInput(BaseModel):
    oxides: List[str] = Field(
        ...,
        example=["SiO2", "B2O3", "Na2O"],
        description="Oxide columns to include (1-5). Must be from SiO2, B2O3, Na2O."
    )
    properties: List[str] = Field(
        ...,
        example=["Tg"],
        description="Properties to include (1-2). Currently only 'Tg' is available."
    )

class ProfileDetails(BaseModel):
    """What a new account is asked once, right after first sign-in."""
    university: str = Field(..., max_length=120, example="Thapar Institute of Engineering and Technology",
                            description="University, or organisation for industry and others")
    position: Literal["student", "faculty", "industry", "other"] = Field(..., example="student")
    position_other: Optional[str] = Field(None, max_length=80, example="Independent researcher",
                                          description="Required when position is 'other'")
    course: Optional[str] = Field(None, max_length=120, example="M.Tech Materials Science",
                                  description="Required when position is 'student'")

# Profile fields returned to the signed-in user (never other people's records).
PROFILE_FIELDS = ["uid", "email", "displayName", "university", "position", "positionOther", "course"]

def _profile_view(record: Dict[str, Any], recorded: bool = True, admin: bool = False) -> Dict[str, Any]:
    view = {k: record[k] for k in PROFILE_FIELDS if record.get(k) is not None}
    view["profileComplete"] = bool(record.get("profileCompletedAt"))
    view["recorded"] = recorded
    view["isAdmin"] = admin  # shows the Admin screen; the API checks the role again on every admin call
    return view

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

    # 3. Model registry: register the original four models once, then load what is live.
    try:
        model_registry.ensure_builtins()
        live = model_registry.live_models()
        print(f"[OK] Model registry ready: {len(live)} live model(s) " + ", ".join(m["code"] for m in live))
    except Exception as e:
        print(f"[ERROR] Model registry failed to start: {e}")

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

@app.get("/api/v1/catalog")
def get_catalog():
    """
    Everything that is live: properties, models (with inputs, ranges and accuracy)
    and the oxides they accept. Every page reads this instead of hardcoded lists.
    """
    return model_registry.catalog()

@app.get("/api/v1/catalog/version")
def get_catalog_version():
    """Cheap check: browsers re-fetch the catalog when this number changes."""
    return {"version": model_registry.version()}

@app.get("/api/v1/bank/summary")
def get_bank_summary():
    """
    Bank exploration overview: returns safe statistical boundaries without revealing raw private data rows.
    Oxide ranges are derived from the ML model bundle — no hardcoding.
    """
    config = ml_adapter.get_zen_grid_config()
    bounds = config["bounds"]
    features = config["features"]
    ranges: dict = {
        feat: {"min": v["min"], "max": v["max"], "unit": "mol %"}
        for feat, v in bounds.items()
    }
    # Tg range from actual dataset stats (dataset metadata, not model metadata)
    ranges["Tg"] = {"min": 496.15, "max": 998.15, "unit": "K"}
    system_label = " – ".join(reversed(features)) + " glass system"
    return {
        "system": system_label,
        "sample_count": 480,
        "target_property": "Tg (Glass Transition Temperature)",
        "unit": "Kelvin (K)",
        "composition_basis": "mol %",
        "ranges": ranges,
        "models_available": ml_adapter.MODELS,
        "features": features,
    }

@app.post("/api/v1/bank/query")
def query_bank_data(
    data: BankQueryInput,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Query the training dataset. Returns matching rows with the requested
    oxide compositions and properties. Rows that have data for at least one
    of the requested properties are included (OR logic, not AND).
    Authenticated endpoint — requires a valid Firebase Bearer token.
    """
    # Validate oxides (up to 5 oxides)
    if len(data.oxides) < 1 or len(data.oxides) > 5:
        raise HTTPException(status_code=400, detail="Select between 1 and 5 oxides.")
    allowed_ox = list(dict.fromkeys(ml_adapter.ALL_BANK_OXIDES + ml_adapter.supported_oxides()))
    invalid_ox = [ox for ox in data.oxides if ox not in allowed_ox]
    if invalid_ox:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid oxide(s): {invalid_ox}. Allowed: {allowed_ox}"
        )

    # Validate properties (up to 2 properties)
    if len(data.properties) < 1 or len(data.properties) > 2:
        raise HTTPException(status_code=400, detail="Select between 1 and 2 properties.")
    invalid_prop = [p for p in data.properties if p not in ml_adapter.ALL_BANK_PROPERTIES]
    if invalid_prop:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid property/ies: {invalid_prop}. Available: {list(ml_adapter.ALL_BANK_PROPERTIES.keys())}"
        )

    rows = ml_adapter.query_bank(data.oxides, data.properties)
    return {
        "oxides": data.oxides,
        "properties": data.properties,
        "total": len(rows),
        "rows": rows,
        "unit_info": {p: ml_adapter.ALL_BANK_PROPERTIES.get(p, p) for p in data.properties},
        "composition_basis": "mol %",
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
    email = user.get("email") or ""
    name = user.get("name") or email.split("@")[0]
    now = datetime.utcnow().isoformat()

    # The offline demo login is fake: never write it to the database.
    if user.get("mock"):
        return {
            "uid": uid, "email": email, "displayName": name,
            "plan": "Demo (not saved)", "role": "Glass Research Scientist",
            "recorded": False,
        }

    db = get_firestore_db()
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()

    # First sign-in: create the record with name and email.
    if not doc.exists:
        profile_data = {
            "uid": uid,
            "email": email,
            "displayName": name,
            "plan": "Free Tier (Scale to Zero)",
            "role": "Glass Research Scientist",
            "createdAt": now,
            "lastLoginAt": now,
            "loginCount": 1,
        }
        user_ref.set(profile_data)
        return profile_data

    # Returning user: note the new login and keep name/email up to date.
    existing = doc.to_dict() or {}
    updates = {"lastLoginAt": now, "loginCount": (existing.get("loginCount") or 0) + 1}
    if email and email != existing.get("email"):
        updates["email"] = email
    if user.get("name") and user["name"] != existing.get("displayName"):
        updates["displayName"] = user["name"]
    user_ref.update(updates)
    existing.update(updates)
    return existing

@app.get("/api/v1/auth/profile")
def read_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """
    The signed-in user's own profile, and whether they have answered the
    first-sign-in questions (profileComplete). Read-only: does not count a login.
    """
    uid = user.get("uid")
    if user.get("mock"):
        return _profile_view({"uid": uid, "email": user.get("email")}, recorded=False, admin=is_admin(user))
    doc = get_firestore_db().collection("users").document(uid).get()
    record = doc.to_dict() if doc.exists else {"uid": uid, "email": user.get("email")}
    return _profile_view(record or {}, admin=is_admin(user))

@app.put("/api/v1/auth/profile")
def save_profile(data: ProfileDetails, user: Dict[str, Any] = Depends(get_current_user)):
    """Save the first-sign-in answers (university, position, and course for students)."""
    university = data.university.strip()
    position_other = (data.position_other or "").strip()
    course = (data.course or "").strip()

    if len(university) < 2:
        raise HTTPException(status_code=400, detail="Enter your university or organisation.")
    if data.position == "student" and not course:
        raise HTTPException(status_code=400, detail="Enter the course you are studying.")
    if data.position == "other" and not position_other:
        raise HTTPException(status_code=400, detail="Describe your position.")

    record = {
        "uid": user.get("uid"),
        "email": user.get("email") or "",
        "university": university,
        "position": data.position,
        # Only keep the follow-up answer that applies to the chosen position.
        "positionOther": position_other if data.position == "other" else None,
        "course": course if data.position == "student" else None,
        "profileCompletedAt": datetime.utcnow().isoformat(),
    }

    # The offline demo login is fake: never write it to the database.
    if user.get("mock"):
        return _profile_view(record, recorded=False, admin=is_admin(user))

    get_firestore_db().collection("users").document(user["uid"]).set(record, merge=True)
    return _profile_view(record, admin=is_admin(user))

# -------------------------------------------------------------
# Project Management Endpoints (User -> Projects -> Predictions)
# -------------------------------------------------------------

@app.get("/api/v1/projects")
def list_user_projects(user: Dict[str, Any] = Depends(get_current_user)):
    """
    List all projects belonging to the authenticated user.
    Ordered by last updated date descending.
    """
    uid = user.get("uid")
    return {
        "projects": project_service.list_projects(uid),
        "total": len(project_service.list_projects(uid))
    }

@app.post("/api/v1/projects")
def create_user_project(
    data: ProjectCreateInput,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Create a new project container.
    Requires a unique project name per user.
    """
    uid = user.get("uid")
    project = project_service.create_project(
        user_id=uid,
        name=data.name,
        description=data.description
    )
    return project

@app.get("/api/v1/projects/{project_id}")
def get_user_project_details(
    project_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve project details along with all prediction records made under it.
    """
    uid = user.get("uid")
    return project_service.get_project_with_predictions(user_id=uid, project_id=project_id)

@app.delete("/api/v1/projects/{project_id}")
def delete_user_project(
    project_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a project and cascade-delete all predictions associated with it.
    """
    uid = user.get("uid")
    return project_service.delete_project(user_id=uid, project_id=project_id)

@app.delete("/api/v1/projects/{project_id}/predictions/{prediction_id}")
def delete_user_prediction(
    project_id: str,
    prediction_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a single prediction from a project.
    """
    uid = user.get("uid")
    return project_service.delete_prediction(user_id=uid, project_id=project_id, prediction_id=prediction_id)

@app.post("/api/v1/predict")
def predict_glass(
    data: CompositionInput,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Predict the chosen properties for a glass composition given in mol % or weight %.
    Weight % is converted to mol % here, because the models were trained on mol %.
    Every value is returned in Kelvin (K).
    Requires authenticated user (Firebase ID Token) and a valid selected project_id.
    Saves the prediction under the selected project.
    """
    uid = user.get("uid")
    if not data.project_id:
        raise HTTPException(
            status_code=400,
            detail="A project must be created and selected before performing a prediction. Please provide project_id."
        )

    # Verify project exists and belongs to user
    project = project_service.get_project(uid, data.project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{data.project_id}' not found or not owned by you. Please select a valid project."
        )

    comp = data.composition

    supported = ml_adapter.supported_oxides()
    unknown = [ox for ox in comp if ox not in supported]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported oxides: {unknown}. Supported: {supported}"
        )
    if any(v < 0 for v in comp.values()):
        raise HTTPException(status_code=400, detail="Oxide amounts cannot be negative.")
    if sum(comp.values()) <= 0:
        raise HTTPException(status_code=400, detail="Composition must contain at least one oxide above 0.")

    if not data.properties:
        raise HTTPException(status_code=400, detail="Choose at least one property to predict.")
    available = ml_adapter.available_properties()
    no_model = [p for p in data.properties if p not in available]
    if no_model:
        raise HTTPException(
            status_code=400,
            detail=f"No trained model yet for: {no_model}. Available: {list(available)}"
        )

    live_codes = list(dict.fromkeys(m["code"] for p in data.properties for m in model_registry.live_models(p)))
    if data.model_name and not any(
        data.model_name in (m["code"], m["id"]) for p in data.properties for m in model_registry.live_models(p)
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model '{data.model_name}'. Choose from: {live_codes}"
        )

    if data.composition_basis == "wt":
        comp_mol = ml_adapter.wt_to_mol_percent(comp)
    else:
        comp_mol = dict(comp)

    # Only models that accept every oxide in this glass can predict it.
    used = [ox for ox, v in comp_mol.items() if v > 0]
    chosen = []
    for prop in data.properties:
        matches = model_registry.covering(prop, used, data.model_name)
        if not matches:
            who = f"Model '{data.model_name}'" if data.model_name else f"No live {prop} model"
            raise HTTPException(
                status_code=400,
                detail=f"{who} can't predict {prop} for a glass with {', '.join(used)} together."
            )
        chosen.extend(matches)

    # Report every oxide the chosen models use, so the user sees exactly what was evaluated.
    evaluated = list(dict.fromkeys(f for m in chosen for f in m["features"]))
    comp_mol = {ox: float(comp_mol.get(ox, 0.0)) for ox in evaluated}

    try:
        results = [model_registry.predict(m, comp_mol) for m in chosen]
    except RegistryError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    clean_mol = {ox: round(v, 4) for ox, v in comp_mol.items()}

    # Save prediction under the selected project
    saved_record = project_service.save_prediction_under_project(
        user_id=uid,
        project_id=data.project_id,
        composition=comp,
        composition_basis=data.composition_basis,
        composition_mol_percent=clean_mol,
        selected_model=data.model_name or "ALL",
        properties=data.properties,
        results=results
    )

    return {
        "results": results,
        "selected_model": data.model_name or "ALL",
        "input_basis": "wt %" if data.composition_basis == "wt" else "mol %",
        "composition_mol_percent": clean_mol,
        "authenticated_user": user.get("email"),
        "project_id": data.project_id,
        "project_name": project.get("name"),
        "prediction_id": saved_record.get("id"),
        "created_at": saved_record.get("createdAt")
    }

@app.post("/api/v1/zen/discover")
def discover_compositions(
    data: ZenDiscoverInput,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Zen inverse design: given target Tg in Kelvin, screens composition space and returns candidates.
    Uses model bundle to derive features and bounds — nothing hardcoded.
    Requires authenticated user (Firebase ID Token).
    """
    try:
        config = ml_adapter.get_zen_grid_config(data.model_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    features: list = config["features"]
    bounds: dict = config["bounds"]
    step: float = config["step"]
    candidates: list = []

    def recurse(idx: int, rem: float, partial: dict) -> None:
        if len(candidates) >= 50:
            return
        if idx == len(features) - 1:
            feat = features[-1]
            lo = bounds[feat]["min"]
            hi = bounds[feat]["max"]
            val = round(rem, 4)
            if lo - 1e-5 <= val <= hi + 1e-5:
                comp = {**partial, feat: val}
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
            return
        feat = features[idx]
        lo = bounds[feat]["min"]
        hi_v = min(bounds[feat]["max"], rem)
        v = lo
        while v <= hi_v + 1e-5:
            if len(candidates) >= 50:
                break
            recurse(idx + 1, rem - v, {**partial, feat: round(v, 4)})
            v += step

    recurse(0, 100.0, {})
    candidates.sort(key=lambda x: x["difference"])
    return {
        "target_tg": data.target_tg,
        "model_used": data.model_name,
        "tolerance": data.tolerance,
        "candidates_count": len(candidates),
        "candidates": candidates[:20],
        "features": features,
        "authenticated_user": user.get("email")
    }
