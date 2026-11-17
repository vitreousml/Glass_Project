"""First-sign-in profile questions: reading and saving, with an in-memory Firestore."""
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app.main as main
from app.firebase_auth import get_current_user

client = TestClient(main.app)


class FakeDoc:
    def __init__(self, store, key):
        self.store, self.key = store, key

    @property
    def exists(self):
        return self.key in self.store

    def get(self):
        return self

    def to_dict(self):
        return dict(self.store.get(self.key, {}))

    def set(self, data, merge=False):
        base = self.store.get(self.key, {}) if merge else {}
        self.store[self.key] = {**base, **data}


class FakeDB:
    def __init__(self):
        self.users = {}

    def collection(self, name):
        assert name == "users"
        return self

    def document(self, key):
        return FakeDoc(self.users, key)


@pytest.fixture
def db(monkeypatch):
    fake = FakeDB()
    monkeypatch.setattr(main, "get_firestore_db", lambda: fake)
    yield fake
    main.app.dependency_overrides.clear()


def sign_in(mock=False):
    user = {"uid": "u1", "email": "a@uni.edu"}
    if mock:
        user["mock"] = True
    main.app.dependency_overrides[get_current_user] = lambda: user


def test_new_account_is_incomplete(db):
    sign_in()
    res = client.get("/api/v1/auth/profile")
    assert res.status_code == 200
    assert res.json()["profileComplete"] is False


def test_save_student_profile(db):
    sign_in()
    db.users["u1"] = {"uid": "u1", "email": "a@uni.edu", "displayName": "A", "loginCount": 3}
    res = client.put("/api/v1/auth/profile", json={
        "university": "  TIET Patiala ", "position": "student", "course": "M.Tech Materials",
        "position_other": "ignored",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["profileComplete"] is True
    assert body["university"] == "TIET Patiala"
    assert body["course"] == "M.Tech Materials"
    assert "positionOther" not in body
    # Existing fields are kept (merge), and a later read sees the answers.
    assert db.users["u1"]["loginCount"] == 3
    assert client.get("/api/v1/auth/profile").json()["position"] == "student"


def test_other_position_keeps_typed_entry(db):
    sign_in()
    res = client.put("/api/v1/auth/profile", json={
        "university": "Self-employed", "position": "other", "position_other": "Consultant", "course": "x",
    })
    assert res.status_code == 200
    assert res.json()["positionOther"] == "Consultant"
    assert db.users["u1"]["course"] is None


@pytest.mark.parametrize("payload, message", [
    ({"university": " ", "position": "faculty"}, "university"),
    ({"university": "TIET", "position": "student"}, "course"),
    ({"university": "TIET", "position": "student", "course": "   "}, "course"),
    ({"university": "TIET", "position": "other"}, "position"),
])
def test_missing_answers_rejected(db, payload, message):
    sign_in()
    res = client.put("/api/v1/auth/profile", json=payload)
    assert res.status_code == 400
    assert message in res.json()["detail"]
    assert db.users == {}


def test_unknown_position_rejected(db):
    sign_in()
    assert client.put("/api/v1/auth/profile", json={"university": "TIET", "position": "alumni"}).status_code == 422


def test_demo_login_is_never_written(db):
    sign_in(mock=True)
    res = client.put("/api/v1/auth/profile", json={"university": "TIET", "position": "faculty"})
    assert res.status_code == 200
    assert res.json()["recorded"] is False
    assert db.users == {}
    assert client.get("/api/v1/auth/profile").json()["profileComplete"] is False


def test_profile_requires_sign_in(db):
    assert client.get("/api/v1/auth/profile").status_code == 401
    assert client.put("/api/v1/auth/profile", json={"university": "TIET", "position": "faculty"}).status_code == 401
