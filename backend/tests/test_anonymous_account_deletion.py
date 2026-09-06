"""
Regression tests for the Phase 0 /auth/account/delete password-check scoping
described in memory/anonymous-purchases-migration-plan.md.

POST /auth/anonymous does not exist yet (Phase 1 of that plan). The anonymous-user
tests below seed the DB directly instead - the same pattern test_kite_trivia.py
already uses for state the API doesn't expose (see test_reset_password_*).

Status against current `main` (before the Phase 0 scoped change lands):
  test_real_account_still_requires_correct_password  -> PASSES today (regression guard)
  test_real_account_wrong_password_is_rejected        -> PASSES today (regression guard)
  test_anonymous_flag_alone_is_not_sufficient          -> PASSES today (regression guard;
                                                           proves is_anonymous alone can't
                                                           skip the check while a real
                                                           password_hash is set)
  test_anonymous_account_deletes_without_password      -> FAILS today (asserts the target
                                                           behavior; today this 500s because
                                                           bcrypt.checkpw raises on an empty/
                                                           missing hash instead of cleanly
                                                           rejecting)

Only that last test is expected to start passing once the scoped change in the plan
doc lands. The other three must keep passing before and after - they're the proof
the change doesn't weaken deletion auth for real accounts.
"""
import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kite-trivia-quest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

REAL_PASSWORD = "DreamySky123!"


def _mongo_db():
    mc = MongoClient(os.environ.get("MONGO_URL"))
    return mc[os.environ.get("DB_NAME", "test_database")]


def _register_real_user(suffix):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    ts = int(time.time() * 1000)
    payload = {
        "email": f"test_del_{suffix}_{ts}@example.com",
        "password": REAL_PASSWORD,
        "name": f"TEST Del {suffix}",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    # The session_token cookie is set Secure - fine over the real HTTPS preview
    # domain these tests default to, but `requests` correctly won't send it back
    # over plain http:// against a local server. Use the Bearer fallback the app
    # already ships for exactly this (see get_current_user / CLAUDE.md's cookie
    # note) instead of relying on the cookie jar.
    s.headers.update({"Authorization": f"Bearer {data['session_token']}"})
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200, me.text
    return s, data["user_id"]


def _seed_session_only_user(db, *, is_anonymous, set_password_hash):
    """
    Inserts a users + user_sessions row directly, bypassing /auth/register, so we
    can construct account states POST /auth/anonymous will produce once it exists
    (is_anonymous=True, no password_hash) without depending on that endpoint.

    email is a required field on the User model today with no default - Phase 0
    of the plan flags this as an open item (make it Optional, or synthesize a
    placeholder). Using a placeholder here is a test-only shim, not an endorsement
    of that being the real fix - see the plan doc's "Open items" section.
    """
    user_id = str(uuid.uuid4())
    session_token = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%dT%H:%M:%S")

    user_doc = {
        "user_id": user_id,
        "email": f"anon_{user_id}@anonymous.local",
        "name": "Anonymous",
        "current_character": "basic_kite",
        "current_sky_theme": "dawn",
        "owned_characters": ["basic_kite"],
        "owned_companions": [],
        "owned_sky_themes": ["dawn"],
        "level": 1,
        "xp": 0,
        "created_at": now,
        "is_anonymous": is_anonymous,
    }
    if set_password_hash:
        # bcrypt hash of REAL_PASSWORD - lets us assert the wrong-password-still-401
        # path even on an is_anonymous=True row, proving the flag alone never
        # bypasses the check.
        import bcrypt
        user_doc["password_hash"] = bcrypt.hashpw(REAL_PASSWORD.encode(), bcrypt.gensalt()).decode()

    db.users.insert_one(user_doc)
    db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": "2099-01-01T00:00:00+00:00",
    })

    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    s.cookies.set("session_token", session_token)
    return s, user_id


def _assert_fully_deleted(db, user_id):
    assert db.users.find_one({"user_id": user_id}) is None
    assert db.user_sessions.find_one({"user_id": user_id}) is None
    assert db.password_resets.find_one({"user_id": user_id}) is None


# ---------- Regression: real accounts must be completely unaffected ----------

def test_real_account_wrong_password_is_rejected():
    s, user_id = _register_real_user("wrongpw")
    r = s.post(f"{API}/auth/account/delete", json={"password": "NotTheRealPassword!"})
    assert r.status_code == 401, r.text

    db = _mongo_db()
    # Must still exist - the rejected attempt must not have deleted anything.
    assert db.users.find_one({"user_id": user_id}) is not None


def test_real_account_still_requires_correct_password():
    s, user_id = _register_real_user("correctpw")
    r = s.post(f"{API}/auth/account/delete", json={"password": REAL_PASSWORD})
    assert r.status_code == 200, r.text

    db = _mongo_db()
    _assert_fully_deleted(db, user_id)


def test_anonymous_flag_alone_is_not_sufficient():
    """is_anonymous=True with a password_hash still set (shouldn't normally happen,
    but is the exact case the double condition in the plan's scoped change guards
    against) must still require the correct password."""
    db = _mongo_db()
    s, user_id = _seed_session_only_user(db, is_anonymous=True, set_password_hash=True)

    r = s.post(f"{API}/auth/account/delete", json={"password": "WrongOne!"})
    assert r.status_code == 401, r.text
    assert db.users.find_one({"user_id": user_id}) is not None

    r2 = s.post(f"{API}/auth/account/delete", json={"password": REAL_PASSWORD})
    assert r2.status_code == 200, r2.text
    _assert_fully_deleted(db, user_id)


# ---------- Target behavior: anonymous accounts with no password ----------

def test_anonymous_account_deletes_without_password():
    """Expected to FAIL against current `main` - see module docstring. Passes once
    the Phase 0 scoped change in the plan doc lands."""
    db = _mongo_db()
    s, user_id = _seed_session_only_user(db, is_anonymous=True, set_password_hash=False)

    r = s.post(f"{API}/auth/account/delete", json={"password": ""})
    assert r.status_code == 200, r.text
    _assert_fully_deleted(db, user_id)
