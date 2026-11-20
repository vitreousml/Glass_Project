"""
model_storage.py
----------------
Where model files live.

  - "builtin": the original four models shipped in the image under ml/models.
  - "gcs":     uploaded models, in the private Cloud Storage bucket named by
               MODEL_BUCKET. Used in production: Cloud Run's disk is wiped on restart.
  - "local":   uploaded models on this machine's disk (backend/data/models),
               for development when MODEL_BUCKET isn't set.

Every file is saved under its SHA-256, so a stored file never changes.
"""

import hashlib
import os
from pathlib import Path
from typing import Any, Dict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
ML_DIR = PROJECT_ROOT / "ml"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 16):
            h.update(chunk)
    return h.hexdigest().upper()


def _local_dir() -> Path:
    d = Path(os.getenv("REGISTRY_DIR", str(BACKEND_DIR / "data"))) / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_dir() -> Path:
    d = Path(os.getenv("MODEL_CACHE_DIR", str(_local_dir().parent / "model_cache")))
    d.mkdir(parents=True, exist_ok=True)
    return d


def bucket_name() -> str:
    return os.getenv("MODEL_BUCKET", "").strip()


def _bucket():
    from google.cloud import storage  # installed with firebase-admin

    from app.firebase_auth import service_account_path

    if service_account_path.exists():
        client = storage.Client.from_service_account_json(str(service_account_path))
    else:  # Cloud Run: the service's own identity
        client = storage.Client()
    return client.bucket(bucket_name())


def save_upload(data: bytes, original_name: str) -> Dict[str, Any]:
    """Store an uploaded model file; returns the file reference kept in the registry."""
    digest = sha256_bytes(data)
    ext = Path(original_name).suffix.lower() or ".pkl"
    name = f"{digest}{ext}"
    if bucket_name():
        blob = _bucket().blob(f"models/{name}")
        if not blob.exists():
            blob.upload_from_string(data, content_type="application/octet-stream")
        ref = {"storage": "gcs", "path": f"models/{name}"}
        # Keep a local copy so the first prediction doesn't download it again.
        (_cache_dir() / name).write_bytes(data)
    else:
        (_local_dir() / name).write_bytes(data)
        ref = {"storage": "local", "path": name}
    ref.update({"sha256": digest, "size": len(data), "original_name": original_name})
    return ref


def builtin_ref(filename: str) -> Dict[str, Any]:
    path = ML_DIR / "models" / filename
    return {
        "storage": "builtin",
        "path": f"models/{filename}",
        "sha256": sha256_file(path),
        "size": path.stat().st_size,
        "original_name": filename,
    }


def local_path(ref: Dict[str, Any]) -> Path:
    """A path on this machine to load the file from (downloads from the bucket if needed)."""
    storage = ref.get("storage")
    if storage == "builtin":
        return ML_DIR / ref["path"]
    if storage == "local":
        return _local_dir() / ref["path"]
    if storage == "gcs":
        cached = _cache_dir() / Path(ref["path"]).name
        if not cached.exists():
            tmp = cached.with_suffix(cached.suffix + ".part")
            _bucket().blob(ref["path"]).download_to_filename(str(tmp))
            os.replace(tmp, cached)
        return cached
    raise ValueError(f"Unknown storage '{storage}'")


def exists(ref: Dict[str, Any]) -> bool:
    try:
        if ref.get("storage") == "gcs":
            return True  # checked when it is first loaded
        return local_path(ref).exists()
    except Exception:
        return False


def delete(ref: Dict[str, Any]) -> None:
    """Remove a never-published upload. Built-in files are never touched."""
    storage = ref.get("storage")
    try:
        if storage == "local":
            (_local_dir() / ref["path"]).unlink(missing_ok=True)
        elif storage == "gcs":
            _bucket().blob(ref["path"]).delete()
            (_cache_dir() / Path(ref["path"]).name).unlink(missing_ok=True)
    except Exception as e:
        print(f"[WARNING] Couldn't delete model file {ref.get('path')}: {e}")
