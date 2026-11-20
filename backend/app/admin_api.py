"""
admin_api.py
------------
Admin portal endpoints: upload and check a model, review and edit it, try it,
publish it, switch it off, restore an older version, pick the default, and read
the activity log. Every endpoint requires the admin role.
"""

from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app import ml_adapter, model_registry, model_storage, model_validator, oxides
from app.admin_auth import require_admin
from app.model_registry import RegistryError

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _raise(e: RegistryError):
    raise HTTPException(status_code=e.status_code, detail=str(e))


class ModelEdit(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    code: Optional[str] = Field(None, max_length=12)
    property_name: Optional[str] = Field(None, max_length=120)
    unit: Optional[str] = Field(None, max_length=20)


class TryInput(BaseModel):
    composition: Dict[str, float]
    composition_basis: Literal["mol", "wt"] = "mol"


class ArchiveInput(BaseModel):
    confirm: bool = False


def _overview() -> Dict[str, Any]:
    return {
        "version": model_registry.version(),
        "models": model_registry.all_models(),
        "properties": list(model_registry.properties().values()),
        "live_oxides": [oxides.parse_oxide(o) or {"formula": o} for o in model_registry.live_oxides()],
        "server_versions": model_validator.server_versions(),
        "max_upload_mb": model_validator.MAX_BYTES // (1024 * 1024),
    }


@router.get("/me")
def admin_me(user: Dict[str, Any] = Depends(require_admin)):
    return {"is_admin": True, "email": user.get("email")}


@router.get("/models")
def list_models(user: Dict[str, Any] = Depends(require_admin)):
    """Every model in the registry (live, ready to publish, and archived)."""
    return _overview()


@router.post("/models/upload")
def upload_model(file: UploadFile = File(...), user: Dict[str, Any] = Depends(require_admin)):
    """
    Check an uploaded model file. If every check passes, it is saved as
    'ready to publish' (not live yet). Otherwise nothing is saved.
    """
    data = file.file.read(model_validator.MAX_BYTES + 1)
    report = model_validator.run_checks(
        data,
        file.filename or "",
        existing_models=model_registry.all_models(),
        properties=model_registry.properties(),
        live_oxides=model_registry.live_oxides(),
    )
    if not report["passed"]:
        return {"status": "failed", "checks": report["checks"], "info": report["info"]}
    file_ref = model_storage.save_upload(data, file.filename or "model.pkl")
    model = model_registry.create_draft(report["info"], file_ref, report["checks"], user)
    return {"status": "ready", "checks": report["checks"], "info": report["info"], "model": model}


@router.patch("/models/{model_id}")
def edit_model(model_id: str, data: ModelEdit, user: Dict[str, Any] = Depends(require_admin)):
    try:
        return model_registry.update_model(model_id, data.model_dump(exclude_none=True), user)
    except RegistryError as e:
        _raise(e)


@router.post("/models/{model_id}/try")
def try_model(model_id: str, data: TryInput, user: Dict[str, Any] = Depends(require_admin)):
    """Predict one glass with this model, next to the live models for the same property."""
    comp = data.composition
    if any(v < 0 for v in comp.values()):
        raise HTTPException(status_code=400, detail="Oxide amounts cannot be negative.")
    if sum(comp.values()) <= 0:
        raise HTTPException(status_code=400, detail="Composition must contain at least one oxide above 0.")
    try:
        mol = ml_adapter.wt_to_mol_percent(comp) if data.composition_basis == "wt" else dict(comp)
        return model_registry.try_model(model_id, mol)
    except RegistryError as e:
        _raise(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/models/{model_id}/publish")
def publish_model(model_id: str, user: Dict[str, Any] = Depends(require_admin)):
    """Make a ready (or archived) model live across the portal."""
    try:
        return model_registry.publish(model_id, user)
    except RegistryError as e:
        _raise(e)


@router.post("/models/{model_id}/archive")
def archive_model(model_id: str, data: ArchiveInput = ArchiveInput(), user: Dict[str, Any] = Depends(require_admin)):
    """Switch a live model off. It can be restored later."""
    try:
        return model_registry.archive(model_id, user, confirm=data.confirm)
    except RegistryError as e:
        _raise(e)


@router.post("/models/{model_id}/default")
def make_default(model_id: str, user: Dict[str, Any] = Depends(require_admin)):
    try:
        return model_registry.set_default(model_id, user)
    except RegistryError as e:
        _raise(e)


@router.delete("/models/{model_id}")
def discard_model(model_id: str, user: Dict[str, Any] = Depends(require_admin)):
    """Delete an upload that was never published."""
    try:
        model_registry.discard(model_id, user)
        return {"success": True}
    except RegistryError as e:
        _raise(e)


@router.get("/audit")
def audit(limit: int = Query(100, ge=1, le=500), user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, List]:
    return {"entries": model_registry.audit_log(limit)}
