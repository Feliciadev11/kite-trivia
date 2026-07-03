"""Iteration 17 regression: verify /api/questions works for a fresh user,
and the free-tier gate (HTTP 402) fires exactly on the 4th round call."""
import os
import secrets
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kite-trivia-quest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def fresh_user_session():
    """Register a brand-new user; return an authenticated requests.Session."""
    session = requests.Session()
    email = f"TEST_iter17_{secrets.token_hex(6)}@example.com"
    password = "Tp-" + secrets.token_urlsafe(16)
    resp = session.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": "Iter17 Tester"},
        timeout=20,
    )
    assert resp.status_code == 200, f"register failed: {resp.status_code} {resp.text}"
    # Confirm cookie set + /auth/me works
    me = session.get(f"{API}/auth/me", timeout=10)
    assert me.status_code == 200, f"/auth/me failed: {me.status_code} {me.text}"
    body = me.json()
    assert body["email"].lower() == email.lower()
    assert body.get("rounds_played_today", 0) == 0
    session.email = email  # attach for later assertions
    return session


def test_fresh_user_questions_returns_10(fresh_user_session):
    """PRIMARY: /api/questions returns 200 with 10 valid trivia questions."""
    r = fresh_user_session.get(f"{API}/questions", params={"limit": 10}, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:400]}"
    data = r.json()
    assert isinstance(data, list) and len(data) == 10, f"expected 10 items, got {len(data)}"
    # Structural checks on each question
    for q in data:
        assert "question_id" in q and q["question_id"]
        assert "question" in q and isinstance(q["question"], str) and q["question"].strip()
        assert "options" in q and isinstance(q["options"], list) and len(q["options"]) == 4
        # difficulty should be present
        assert "difficulty" in q


def test_second_and_third_round_also_ok(fresh_user_session):
    """Rounds 2 & 3 must still return 200 (free tier allows 3/day)."""
    for i in (2, 3):
        r = fresh_user_session.get(f"{API}/questions", params={"limit": 10}, timeout=15)
        assert r.status_code == 200, f"round {i} failed: {r.status_code} {r.text[:400]}"
        assert len(r.json()) == 10


def test_fourth_round_hits_free_tier_gate(fresh_user_session):
    """4th /api/questions call must return HTTP 402 with structured detail."""
    r = fresh_user_session.get(f"{API}/questions", params={"limit": 10}, timeout=15)
    assert r.status_code == 402, f"expected 402 gate, got {r.status_code}: {r.text[:400]}"
    body = r.json()
    detail = body.get("detail") or {}
    assert detail.get("code") == "free_tier_limit_reached", f"detail={detail}"
    assert detail.get("free_rounds_per_day") == 3
    assert detail.get("rounds_played_today") >= 3
    assert isinstance(detail.get("message"), str) and detail["message"]
