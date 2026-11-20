"""
Run the backend locally for trying the admin portal safely:

  - the model registry is a local file (backend/data), not the shared Firestore registry;
  - uploaded model files stay on this machine;
  - the offline demo login counts as an admin.

    python scripts/dev_local_admin.py        (from the backend folder)

Never use this for a real deployment.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

os.environ["ENVIRONMENT"] = "development"
os.environ["REGISTRY_BACKEND"] = "local"
os.environ["DEV_MOCK_ADMIN"] = "true"
os.environ.pop("MODEL_BUCKET", None)

if __name__ == "__main__":
    import uvicorn

    sys.path.insert(0, str(BACKEND_DIR))
    os.chdir(BACKEND_DIR)
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True, reload_dirs=[str(BACKEND_DIR / "app")])
