"""A stale/invalid session_token cookie must not shadow a valid Bearer token
in get_current_user (backend/server.py)."""
import os
import time
import uuid

import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kite-trivia-quest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def test_stale_cookie_does_not_block_valid_bearer():
    ts = int(time.time() * 1000)
    reg = requests.post(f"{API}/auth/register", json={
        "email": f"test_stalecookie_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "Stale Cookie Test",
    }).json()
    token = reg["session_token"]

    r = requests.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        cookies={"session_token": f"stale-{uuid.uuid4().hex}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] == reg["user_id"]
