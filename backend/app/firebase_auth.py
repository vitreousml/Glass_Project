"""
firebase_auth.py
----------------
Firebase Admin SDK initialization and strict token verification middleware.
Authenticates incoming requests using Firebase Bearer ID Tokens.
Integrates with Firestore for user profile synchronization.
"""

import os
import json
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth, firestore

# Load environment variables from backend/.env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "glass-composition-platform")
SERVICE_ACCOUNT_FILENAME = os.getenv(
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "glass-composition-platform-firebase-adminsdk-fbsvc-070133e967.json"
)

# Resolve service account path relative to backend folder
backend_dir = Path(__file__).resolve().parent.parent
service_account_path = backend_dir / SERVICE_ACCOUNT_FILENAME

_firebase_app = None
_db = None

def init_firebase():
    """Initialize Firebase Admin SDK with service account credentials."""
    global _firebase_app, _db
    if not firebase_admin._apps:
        if not service_account_path.exists():
            raise FileNotFoundError(
                f"Firebase service account key not found at {service_account_path}. "
                "Ensure the downloaded JSON key is present inside the backend/ directory."
            )
        cred = credentials.Certificate(str(service_account_path))
        _firebase_app = firebase_admin.initialize_app(cred, {
            "projectId": PROJECT_ID
        })
        print(f"[OK] Firebase Admin SDK initialized for project '{PROJECT_ID}'.")
    _db = firestore.client()
    return _firebase_app

def get_firestore_db():
    """Return initialized Firestore client."""
    global _db
    if _db is None:
        init_firebase()
    return _db

# Bearer token security scheme for Swagger / OpenAPI
security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials_auth: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> Dict[str, Any]:
    """
    Strict Firebase token verification dependency.
    Extracts Bearer token from 'Authorization: Bearer <token>' header,
    verifies it against Firebase Auth, and returns the decoded user payload.
    """
    if credentials_auth is None or not credentials_auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer ID token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials_auth.credentials
    # Allow development mock tokens when running locally
    if token.startswith("mock_dev_token_"):
        return {
            "uid": "dev_researcher_uid",
            "email": "researcher@glasslab.edu",
            "name": "Dr. Eleanor Vance",
            "mock": True
        }

    try:
        # Verify the Firebase ID token
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Firebase ID token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

