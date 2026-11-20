"""
project_service.py
------------------
Project-based prediction management service.
Implements the User -> Multiple Projects -> Multiple Predictions hierarchy.
Persists projects and predictions in Firestore under:
  users/{user_id}/projects/{project_id}
  users/{user_id}/projects/{project_id}/predictions/{prediction_id}
Includes local fallback cache for offline dev and test suites.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from fastapi import HTTPException, status
from app.firebase_auth import get_firestore_db

# Local memory store as fallback when Firestore is unreachable or in mock/test mode
_MEMORY_PROJECTS: Dict[str, Dict[str, Any]] = {}
_MEMORY_PREDICTIONS: Dict[str, List[Dict[str, Any]]] = {}

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _use_firestore() -> bool:
    try:
        db = get_firestore_db()
        return db is not None
    except Exception:
        return False

def create_project(user_id: str, name: str, description: Optional[str] = "") -> Dict[str, Any]:
    """
    Create a new project for a user.
    Enforces unique project name per user (case-insensitive).
    """
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project name cannot be empty."
        )
    if len(cleaned_name) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project name must be 100 characters or fewer."
        )

    # Check for existing project with same name for this user
    existing_projects = list_projects(user_id)
    for p in existing_projects:
        if p["name"].lower() == cleaned_name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A project named '{cleaned_name}' already exists. Please choose a unique name."
            )

    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    now = _now_iso()
    project_data = {
        "id": project_id,
        "userId": user_id,
        "name": cleaned_name,
        "description": (description or "").strip(),
        "status": "active",
        "predictionCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }

    # Attempt Firestore write
    saved = False
    if _use_firestore():
        try:
            db = get_firestore_db()
            db.collection("users").document(user_id).collection("projects").document(project_id).set(project_data)
            saved = True
        except Exception as e:
            print(f"[WARN] Firestore create_project failed, falling back to memory: {e}")

    # Fallback / sync memory store
    user_projects = _MEMORY_PROJECTS.setdefault(user_id, {})
    user_projects[project_id] = dict(project_data)
    _MEMORY_PREDICTIONS.setdefault(project_id, [])

    return project_data

def list_projects(user_id: str) -> List[Dict[str, Any]]:
    """
    List all projects for a user, sorted by updatedAt descending.
    """
    projects = []
    if _use_firestore():
        try:
            db = get_firestore_db()
            docs = db.collection("users").document(user_id).collection("projects").stream()
            for doc in docs:
                p = doc.to_dict()
                if p:
                    projects.append(p)
        except Exception as e:
            print(f"[WARN] Firestore list_projects failed, falling back to memory: {e}")

    # If Firestore returned nothing or failed, check memory store
    if not projects and user_id in _MEMORY_PROJECTS:
        projects = list(_MEMORY_PROJECTS[user_id].values())

    # Sort newest updatedAt first
    projects.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    return projects

def get_project(user_id: str, project_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single project by ID for a user.
    """
    if _use_firestore():
        try:
            db = get_firestore_db()
            doc = db.collection("users").document(user_id).collection("projects").document(project_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"[WARN] Firestore get_project failed, falling back to memory: {e}")

    return _MEMORY_PROJECTS.get(user_id, {}).get(project_id)

def get_project_with_predictions(user_id: str, project_id: str) -> Dict[str, Any]:
    """
    Get a project along with all of its associated predictions.
    """
    project = get_project(user_id, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found."
        )

    predictions = []
    if _use_firestore():
        try:
            db = get_firestore_db()
            preds_ref = (
                db.collection("users")
                .document(user_id)
                .collection("projects")
                .document(project_id)
                .collection("predictions")
            )
            for doc in preds_ref.stream():
                p = doc.to_dict()
                if p:
                    predictions.append(p)
        except Exception as e:
            print(f"[WARN] Firestore get predictions failed, falling back to memory: {e}")

    if not predictions and project_id in _MEMORY_PREDICTIONS:
        predictions = list(_MEMORY_PREDICTIONS[project_id])

    # Sort predictions by createdAt descending
    predictions.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    return {
        "project": project,
        "predictions": predictions
    }

def save_prediction_under_project(
    user_id: str,
    project_id: str,
    composition: Dict[str, float],
    composition_basis: str,
    composition_mol_percent: Dict[str, float],
    selected_model: str,
    properties: List[str],
    results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Save a prediction result under a specific project.
    Updates the project's predictionCount and updatedAt timestamp.
    """
    project = get_project(user_id, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found. You must select an existing project."
        )

    # Restrict to maximum 50 predictions per project
    current_count = int(project.get("predictionCount", 0))
    if current_count >= 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project prediction limit reached (50/50). Please create a new project or delete older predictions to proceed."
        )

    prediction_id = f"pred_{uuid.uuid4().hex[:12]}"
    now = _now_iso()
    new_count = current_count + 1

    prediction_record = {
        "id": prediction_id,
        "projectId": project_id,
        "projectName": project.get("name", ""),
        "userId": user_id,
        "composition": composition,
        "compositionBasis": composition_basis,
        "compositionMolPercent": composition_mol_percent,
        "selectedModel": selected_model,
        "properties": properties,
        "results": results,
        "createdAt": now
    }

    # Attempt Firestore write
    if _use_firestore():
        try:
            db = get_firestore_db()
            project_ref = db.collection("users").document(user_id).collection("projects").document(project_id)
            pred_ref = project_ref.collection("predictions").document(prediction_id)
            pred_ref.set(prediction_record)
            project_ref.update({
                "predictionCount": new_count,
                "updatedAt": now
            })
        except Exception as e:
            print(f"[WARN] Firestore save prediction failed, updating memory: {e}")

    # Sync memory store
    if user_id in _MEMORY_PROJECTS and project_id in _MEMORY_PROJECTS[user_id]:
        _MEMORY_PROJECTS[user_id][project_id]["predictionCount"] = new_count
        _MEMORY_PROJECTS[user_id][project_id]["updatedAt"] = now

    _MEMORY_PREDICTIONS.setdefault(project_id, []).append(prediction_record)

    return prediction_record

def delete_project(user_id: str, project_id: str) -> Dict[str, Any]:
    """
    Delete a project and cascade-delete all predictions associated with it.
    """
    project = get_project(user_id, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found."
        )

    deleted_preds_count = 0

    if _use_firestore():
        try:
            db = get_firestore_db()
            project_ref = db.collection("users").document(user_id).collection("projects").document(project_id)
            preds_ref = project_ref.collection("predictions")

            # Cascade delete predictions
            for doc in preds_ref.stream():
                doc.reference.delete()
                deleted_preds_count += 1

            # Delete project document
            project_ref.delete()
        except Exception as e:
            print(f"[WARN] Firestore delete_project failed: {e}")

    # Remove from memory store
    if user_id in _MEMORY_PROJECTS and project_id in _MEMORY_PROJECTS[user_id]:
        del _MEMORY_PROJECTS[user_id][project_id]
    if project_id in _MEMORY_PREDICTIONS:
        deleted_preds_count = max(deleted_preds_count, len(_MEMORY_PREDICTIONS[project_id]))
        del _MEMORY_PREDICTIONS[project_id]

    return {
        "success": True,
        "deletedProjectId": project_id,
        "deletedPredictionsCount": deleted_preds_count,
        "message": f"Project '{project.get('name')}' and all {deleted_preds_count} predictions were deleted."
    }

def delete_prediction(user_id: str, project_id: str, prediction_id: str) -> Dict[str, Any]:
    """
    Delete a single prediction from a project and decrement predictionCount.
    """
    project = get_project(user_id, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found."
        )

    now = _now_iso()
    new_count = max(0, int(project.get("predictionCount", 1)) - 1)

    if _use_firestore():
        try:
            db = get_firestore_db()
            project_ref = db.collection("users").document(user_id).collection("projects").document(project_id)
            pred_ref = project_ref.collection("predictions").document(prediction_id)
            pred_ref.delete()
            project_ref.update({
                "predictionCount": new_count,
                "updatedAt": now
            })
        except Exception as e:
            print(f"[WARN] Firestore delete_prediction failed: {e}")

    # Sync memory store
    if user_id in _MEMORY_PROJECTS and project_id in _MEMORY_PROJECTS[user_id]:
        _MEMORY_PROJECTS[user_id][project_id]["predictionCount"] = new_count
        _MEMORY_PROJECTS[user_id][project_id]["updatedAt"] = now

    if project_id in _MEMORY_PREDICTIONS:
        _MEMORY_PREDICTIONS[project_id] = [
            p for p in _MEMORY_PREDICTIONS[project_id] if p.get("id") != prediction_id
        ]

    return {
        "success": True,
        "deletedPredictionId": prediction_id,
        "remainingCount": new_count,
        "message": "Prediction deleted successfully."
    }
