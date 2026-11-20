"""
Give (or take away) the admin role for a portal account.

    python scripts/grant_admin.py someone@example.com
    python scripts/grant_admin.py someone@example.com --revoke

The person must have signed in to the portal at least once. They need to sign
out and back in for the change to take effect.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from firebase_admin import auth  # noqa: E402

from app.firebase_auth import init_firebase  # noqa: E402


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        sys.exit(1)
    revoke = "--revoke" in sys.argv
    init_firebase()
    user = auth.get_user_by_email(args[0])
    claims = dict(user.custom_claims or {})
    if revoke:
        claims.pop("admin", None)
    else:
        claims["admin"] = True
    auth.set_custom_user_claims(user.uid, claims or None)
    print(f"{'Removed' if revoke else 'Granted'} admin for {user.email}. They must sign out and back in.")


if __name__ == "__main__":
    main()
