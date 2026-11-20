"""
admin_auth.py
-------------
Who counts as an admin.

An account is an admin when either:
  - its Firebase token carries the custom claim admin=true
    (set once with: python scripts/grant_admin.py someone@example.com), or
  - its verified email is listed in ADMIN_EMAILS (comma-separated, in backend/.env).

The offline demo login is never an admin, except on a development machine that
explicitly sets DEV_MOCK_ADMIN=true (used to try the admin portal locally).
"""

import os
from typing import Any, Dict

from fastapi import Depends, HTTPException, status

from app.firebase_auth import get_current_user


def _admin_emails() -> set:
    return {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


def is_admin(user: Dict[str, Any]) -> bool:
    if user.get("mock"):
        return (
            os.getenv("ENVIRONMENT", "").lower() == "development"
            and os.getenv("DEV_MOCK_ADMIN", "").lower() in ("1", "true", "yes")
        )
    if user.get("admin") is True:
        return True
    email = (user.get("email") or "").lower()
    return bool(email) and bool(user.get("email_verified")) and email in _admin_emails()


def require_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if not is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access only. Ask the portal owner to give your account the admin role.",
        )
    return user
