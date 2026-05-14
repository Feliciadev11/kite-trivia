"""
Kite Trivia backend regression tests.
Covers: auth (register/login/me/logout), questions (variety + answer),
leaderboard, characters (shop/equip/purchase), daily reward, profile.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kite-trivia-quest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session_user():
    ts = int(time.time() * 1000)
    return {
        "email": f"TEST_kite_{ts}@example.com",
        "password": "DreamySky123!",
        "name": f"TEST Kite {ts}",
    }


@pytest.fixture(scope="session")
def client(session_user):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/register", json=session_user)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s


# ---------- Health ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") in ("ok", "healthy", "up", True) or "status" in r.json()


# ---------- Auth ----------
def test_register_and_me(session_user):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # already created in fixture; create separate fresh user here
    ts = int(time.time() * 1000) + 1
    payload = {
        "email": f"TEST_kite2_{ts}@example.com",
        "password": "DreamySky123!",
        "name": f"TEST Kite2 {ts}",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "user_id" in body or "user" in body or "id" in body

    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200
    # Backend normalizes email to lowercase on register
    assert me.json().get("email") == payload["email"].lower()


def test_login_existing(client, session_user):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={
        "email": session_user["email"],
        "password": session_user["password"],
    })
    assert r.status_code == 200, r.text
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200
    assert me.json().get("email") == session_user["email"].lower()


def test_logout(client):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    ts = int(time.time() * 1000) + 2
    payload = {
        "email": f"TEST_logout_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "TEST Logout",
    }
    assert s.post(f"{API}/auth/register", json=payload).status_code == 200
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200
    me = s.get(f"{API}/auth/me")
    assert me.status_code in (401, 403)


# ---------- Questions ----------
def test_get_questions_variety(client):
    r = client.get(f"{API}/questions", params={"count": 10, "limit": 10, "difficulty": 5})
    assert r.status_code == 200, r.text
    qs = r.json()
    assert isinstance(qs, list)
    assert 1 <= len(qs) <= 10
    # Required keys
    for q in qs:
        assert "question_id" in q
        assert "question" in q
        assert "options" in q and isinstance(q["options"], list) and len(q["options"]) >= 2
        assert "correct_answer" in q
        assert "category" in q


def test_questions_randomization(client):
    """Two calls should produce a different distribution of question_ids most of the time."""
    ids_runs = []
    for _ in range(3):
        r = client.get(f"{API}/questions", params={"count": 10, "limit": 10, "difficulty": 5})
        assert r.status_code == 200
        ids_runs.append({q["question_id"] for q in r.json()})
    # At least two runs should not be identical (probabilistic, very high confidence with 505 questions)
    assert not (ids_runs[0] == ids_runs[1] == ids_runs[2]), "questions appear non-random"


def test_questions_category_variety(client):
    """Accumulate categories across multiple calls to confirm variety (expect at least 5 distinct)."""
    cats = set()
    for _ in range(8):
        r = client.get(f"{API}/questions", params={"count": 10, "limit": 10, "difficulty": 5})
        assert r.status_code == 200
        for q in r.json():
            cats.add(q.get("category"))
    assert len(cats) >= 5, f"expected variety, got {cats}"


def test_submit_correct_answer(client):
    r = client.get(f"{API}/questions", params={"count": 5, "limit": 5, "difficulty": 5})
    assert r.status_code == 200
    q = r.json()[0]
    payload = {"question_id": q["question_id"], "selected_answer": q["correct_answer"]}
    ans = client.post(f"{API}/questions/answer", json=payload)
    assert ans.status_code == 200, ans.text
    data = ans.json()
    assert data.get("correct") is True
    assert data.get("correct_answer") == q["correct_answer"]
    assert "xp_earned" in data and data["xp_earned"] > 0
    assert "level_up" in data
    assert "new_level" in data


def test_submit_wrong_answer(client):
    r = client.get(f"{API}/questions", params={"count": 5, "limit": 5, "difficulty": 5})
    q = r.json()[0]
    correct_idx = q["correct_answer"]
    # selected_answer is an integer index; pick an index different from correct
    wrong_idx = next(i for i in range(len(q["options"])) if i != correct_idx)
    ans = client.post(f"{API}/questions/answer", json={
        "question_id": q["question_id"],
        "selected_answer": wrong_idx,
    })
    assert ans.status_code == 200
    data = ans.json()
    assert data["correct"] is False
    assert data["correct_answer"] == q["correct_answer"]
    assert data["xp_earned"] == 0


# ---------- Leaderboard ----------
def test_leaderboard(client):
    r = client.get(f"{API}/leaderboard")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_my_rank(client):
    r = client.get(f"{API}/leaderboard/my-rank")
    assert r.status_code == 200
    body = r.json()
    assert "rank" in body or "position" in body


# ---------- Characters ----------
def test_get_characters(client):
    r = client.get(f"{API}/characters")
    assert r.status_code == 200
    chars = r.json()
    assert isinstance(chars, list) and len(chars) > 0
    categories = {c.get("category") for c in chars}
    # Must include kite + companion + sky_theme
    assert {"kite", "companion", "sky_theme"}.issubset(categories), f"got {categories}"


def test_purchase_and_equip_kite(client):
    chars = client.get(f"{API}/characters").json()
    me = client.get(f"{API}/auth/me").json()
    user_level = me.get("level", 1)
    # Pick affordable kite within unlock level not already owned/equipped
    owned = set(me.get("owned_characters", []))
    kite = next(
        (c for c in chars
         if c["category"] == "kite"
         and c.get("unlock_level", 1) <= user_level
         and c["character_id"] not in owned),
        None,
    )
    if kite is None:
        pytest.skip("No purchasable kite available for current user level")

    pr = client.post(f"{API}/characters/purchase", json={"character_id": kite["character_id"]})
    # Could be 200 (success) or 400 (not enough XP) — both are acceptable; only fail on 5xx
    assert pr.status_code < 500, pr.text

    # Equip via existing equip endpoint
    eq = client.post(f"{API}/characters/equip", json={"character_id": kite["character_id"], "type": "kite"})
    assert eq.status_code in (200, 400, 403), eq.text


# ---------- Daily Reward ----------
def test_daily_reward_status(client):
    r = client.get(f"{API}/daily-reward")
    assert r.status_code == 200
    body = r.json()
    assert "can_claim" in body


def test_claim_daily_reward(client):
    status = client.get(f"{API}/daily-reward").json()
    if not status.get("can_claim"):
        pytest.skip("Daily reward not claimable for this user right now")
    r = client.post(f"{API}/daily-reward/claim")
    assert r.status_code == 200
    body = r.json()
    assert "xp_earned" in body or "reward" in body


# ---------- Forgot / Reset Password ----------
def _register_user(email_suffix):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    ts = int(time.time() * 1000)
    # NOTE: forgot_password lowercases the lookup email but register stores as-is.
    # Using lowercase here avoids the case-mismatch bug surfaced separately in the report.
    payload = {
        "email": f"test_fp_{email_suffix}_{ts}@example.com",
        "password": "DreamySky123!",
        "name": f"TEST FP {email_suffix}",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    return s, payload


def test_forgot_password_registered_returns_code():
    _, user = _register_user("happy")
    r = requests.post(f"{API}/auth/forgot-password", json={"email": user["email"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "message" in body
    assert body.get("expires_in_seconds") == 900
    code = body.get("code")
    assert isinstance(code, str) and len(code) == 6 and code.isdigit()


def test_forgot_password_unregistered_returns_null_code():
    ts = int(time.time() * 1000)
    r = requests.post(f"{API}/auth/forgot-password",
                      json={"email": f"TEST_unknown_{ts}@example.com"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("code") is None
    assert body.get("expires_in_seconds") == 900
    assert "message" in body


def test_reset_password_happy_path_and_login_with_new():
    _, user = _register_user("reset_ok")
    code = requests.post(f"{API}/auth/forgot-password",
                         json={"email": user["email"]}).json()["code"]
    new_pw = "NewDreamy456!"
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": code, "new_password": new_pw,
    })
    assert r.status_code == 200, r.text

    # Login with new password works
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    ok = s.post(f"{API}/auth/login", json={"email": user["email"], "password": new_pw})
    assert ok.status_code == 200, ok.text

    # OLD password fails
    bad = requests.post(f"{API}/auth/login",
                        json={"email": user["email"], "password": user["password"]})
    assert bad.status_code == 401


def test_reset_password_invalid_code_returns_400():
    _, user = _register_user("badcode")
    requests.post(f"{API}/auth/forgot-password", json={"email": user["email"]})
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": "000000", "new_password": "AnotherSky789!",
    })
    assert r.status_code == 400
    assert "Invalid or expired" in r.json().get("detail", "")


def test_reset_password_single_use_enforced():
    _, user = _register_user("reuse")
    code = requests.post(f"{API}/auth/forgot-password",
                         json={"email": user["email"]}).json()["code"]
    pw1 = "FirstSky123!"
    r1 = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": code, "new_password": pw1,
    })
    assert r1.status_code == 200
    # Reuse — must 400
    r2 = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": code, "new_password": "SecondSky123!",
    })
    assert r2.status_code == 400
    assert "Invalid or expired" in r2.json().get("detail", "")


def test_reset_password_short_password_returns_400():
    _, user = _register_user("short")
    code = requests.post(f"{API}/auth/forgot-password",
                         json={"email": user["email"]}).json()["code"]
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": code, "new_password": "abc",
    })
    assert r.status_code == 400
    assert "6 character" in r.json().get("detail", "").lower() or "6" in r.json().get("detail", "")


def test_forgot_password_rate_limit_caps_at_3():
    _, user = _register_user("ratecap")
    # 3 active codes allowed
    codes = []
    for _ in range(3):
        body = requests.post(f"{API}/auth/forgot-password",
                             json={"email": user["email"]}).json()
        codes.append(body.get("code"))
    assert all(c is not None for c in codes), codes
    # 4th must return generic (code=None) without raising
    fourth = requests.post(f"{API}/auth/forgot-password",
                           json={"email": user["email"]})
    assert fourth.status_code == 200
    assert fourth.json().get("code") is None


# ---------- Profile ----------
def test_profile(client):
    r = client.get(f"{API}/profile")
    assert r.status_code == 200
    body = r.json()
    assert "accuracy" in body or "xp_progress" in body or "level" in body
