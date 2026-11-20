"""
registry_store.py
-----------------
Where the model registry is kept: which models exist, which are live, the
properties they predict, an audit log, and a version counter that tells every
server instance (and browser) when something changed.

Two interchangeable backends:
  - FirestoreStore: production. Collections `models`, `properties`, `auditLog`
    and the document `registry/meta`.
  - LocalStore: a JSON file, for local development and tests.

REGISTRY_BACKEND=firestore|local picks one; by default Firestore is used when
it can be reached, otherwise the local file.
"""

import copy
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LocalStore:
    """Registry in one JSON file. Safe for one process (the dev server or tests)."""

    kind = "local"

    def __init__(self, directory: Path):
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.path = self.dir / "registry.json"
        self._lock = threading.RLock()

    def _read(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"models": {}, "properties": {}, "audit": [], "meta": {"version": 0}}
        with open(self.path, encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data: Dict[str, Any]) -> None:
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, self.path)

    def list_models(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [copy.deepcopy(m) for m in self._read()["models"].values()]

    def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            m = self._read()["models"].get(model_id)
            return copy.deepcopy(m) if m else None

    def put_model(self, record: Dict[str, Any]) -> None:
        with self._lock:
            data = self._read()
            data["models"][record["id"]] = record
            self._write(data)

    def delete_model(self, model_id: str) -> None:
        with self._lock:
            data = self._read()
            data["models"].pop(model_id, None)
            self._write(data)

    def list_properties(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [copy.deepcopy(p) for p in self._read()["properties"].values()]

    def put_property(self, record: Dict[str, Any]) -> None:
        with self._lock:
            data = self._read()
            data["properties"][record["id"]] = record
            self._write(data)

    def add_audit(self, entry: Dict[str, Any]) -> None:
        with self._lock:
            data = self._read()
            data["audit"].append(entry)
            data["audit"] = data["audit"][-2000:]
            self._write(data)

    def list_audit(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            return list(reversed(self._read()["audit"]))[:limit]

    def get_version(self) -> int:
        with self._lock:
            return int(self._read()["meta"].get("version", 0))

    def bump_version(self) -> int:
        with self._lock:
            data = self._read()
            data["meta"]["version"] = int(data["meta"].get("version", 0)) + 1
            data["meta"]["updated_at"] = now_iso()
            self._write(data)
            return data["meta"]["version"]


class FirestoreStore:
    """Registry in Firestore, shared by every server instance."""

    kind = "firestore"

    def __init__(self, db):
        self.db = db

    def list_models(self) -> List[Dict[str, Any]]:
        return [d.to_dict() for d in self.db.collection("models").stream()]

    def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        doc = self.db.collection("models").document(model_id).get()
        return doc.to_dict() if doc.exists else None

    def put_model(self, record: Dict[str, Any]) -> None:
        self.db.collection("models").document(record["id"]).set(record)

    def delete_model(self, model_id: str) -> None:
        self.db.collection("models").document(model_id).delete()

    def list_properties(self) -> List[Dict[str, Any]]:
        return [d.to_dict() for d in self.db.collection("properties").stream()]

    def put_property(self, record: Dict[str, Any]) -> None:
        self.db.collection("properties").document(record["id"]).set(record)

    def add_audit(self, entry: Dict[str, Any]) -> None:
        self.db.collection("auditLog").document(entry["id"]).set(entry)

    def list_audit(self, limit: int = 100) -> List[Dict[str, Any]]:
        from firebase_admin import firestore

        q = self.db.collection("auditLog").order_by("at", direction=firestore.Query.DESCENDING).limit(limit)
        return [d.to_dict() for d in q.stream()]

    def get_version(self) -> int:
        doc = self.db.collection("registry").document("meta").get()
        return int((doc.to_dict() or {}).get("version", 0)) if doc.exists else 0

    def bump_version(self) -> int:
        from firebase_admin import firestore

        ref = self.db.collection("registry").document("meta")
        ref.set({"version": firestore.Increment(1), "updated_at": now_iso()}, merge=True)
        return self.get_version()


_store = None
_store_lock = threading.Lock()


def get_store():
    """The registry backend for this process (created on first use)."""
    global _store
    with _store_lock:
        if _store is not None:
            return _store
        choice = os.getenv("REGISTRY_BACKEND", "").strip().lower()
        local_dir = Path(os.getenv("REGISTRY_DIR", str(BACKEND_DIR / "data")))
        if choice == "local":
            _store = LocalStore(local_dir)
        else:
            try:
                from app.firebase_auth import get_firestore_db

                _store = FirestoreStore(get_firestore_db())
            except Exception as e:
                if choice == "firestore":
                    raise
                print(f"[WARNING] Firestore unavailable ({e}); using the local model registry in {local_dir}.")
                _store = LocalStore(local_dir)
        return _store


def reset_store_for_tests() -> None:
    global _store
    with _store_lock:
        _store = None
