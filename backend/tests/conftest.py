"""
Test setup: the model registry and uploaded files go to a throwaway folder,
never to the real Firestore registry or the developer's local registry.
"""

import os
import sys
import tempfile

_REGISTRY_DIR = tempfile.mkdtemp(prefix="glass_registry_test_")
os.environ["REGISTRY_BACKEND"] = "local"
os.environ["REGISTRY_DIR"] = _REGISTRY_DIR
os.environ.pop("MODEL_BUCKET", None)
os.environ["REGISTRY_REFRESH_SECONDS"] = "0"

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import model_registry  # noqa: E402

model_registry.ensure_builtins()
