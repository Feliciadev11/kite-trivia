"""Regression coverage for POST /auth/anonymous (Apple Guideline 5.1.1(v)):
gameplay and purchase-adjacent endpoints must be reachable with zero
registration, and the Bearer fallback (native's cookie-persistence
workaround) must work for anonymous sessions exactly like real ones.
"""
import os

import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kite-trivia-quest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _create_anonymous_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/anonymous", json={})
    assert r.status_code == 200, r.text
    return s, r.json()


def test_anonymous_session_has_no_credentials():
    s, data = _create_anonymous_session()
    assert data["is_anonymous"] is True
    assert data.get("email") is None
    assert data["user_id"].startswith("user_")
    assert "session_token" in data


def test_anonymous_session_can_play_via_bearer():
    """Mirrors the native client: cookie may not persist from a WKWebView, so
    the Bearer fallback alone must be enough to reach gated gameplay routes."""
    s, data = _create_anonymous_session()
    bearer = requests.Session()
    bearer.headers.update({"Authorization": f"Bearer {data['session_token']}"})

    me = bearer.get(f"{API}/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["user_id"] == data["user_id"]

    questions = bearer.get(f"{API}/questions", params={"level": 1})
    assert questions.status_code == 200, questions.text
    assert len(questions.json()) > 0


def test_anonymous_session_premium_status_reachable_without_registration():
    """Guideline 5.1.1(v): premium status/purchase paths must not require an
    account - they must at least be reachable (200), not gated behind auth
    that only a registered user could pass."""
    s, data = _create_anonymous_session()
    bearer = requests.Session()
    bearer.headers.update({"Authorization": f"Bearer {data['session_token']}"})

    status = bearer.get(f"{API}/premium/status")
    assert status.status_code == 200, status.text


if __name__ == "__main__":
    test_anonymous_session_has_no_credentials()
    test_anonymous_session_can_play_via_bearer()
    test_anonymous_session_premium_status_reachable_without_registration()
    print("ok")
