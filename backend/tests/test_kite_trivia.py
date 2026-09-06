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
    # The session_token cookie is Secure - fine over the real HTTPS preview
    # domain this suite defaults to, but `requests` won't send it back over a
    # plain http:// local server. Bearer is the native app's own fallback for
    # exactly this (see get_current_user) - use it so the suite is runnable
    # against a local server too.
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    user_id = s.get(f"{API}/auth/me").json()["user_id"]

    # Mark the test user as premium so gameplay tests aren't blocked by the
    # free-tier 3-rounds/day gate. /api/premium/sync independently verifies
    # against RevenueCat's REST API and ignores client-claimed entitlement
    # state (see sync_premium in server.py) - it can't be used to fake
    # premium for a test account that never made a real purchase. Seed the
    # DB directly instead, the same way other tests in this file seed state
    # the API doesn't expose (see test_reset_password_*, test_purchase_sync_*).
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_premium": True,
            "premium_source": "pytest_seed",
            "premium_product_id": "kite_premium_test",
            "premium_expires_at": None,
        }},
    )
    status = s.get(f"{API}/premium/status").json()
    assert status.get("is_premium") is True, f"premium seed did not take effect: {status}"
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
    s.headers.update({"Authorization": f"Bearer {body['session_token']}"})

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
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
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


def test_claim_and_equip_free_kite(client):
    me = client.get(f"{API}/auth/me").json()
    user_id = me["user_id"]
    # Promote user past progressive gates so common kites are buyable
    import os
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    mc[os.environ.get("DB_NAME", "test_database")].users.update_one(
        {"user_id": user_id}, {"$set": {"level": 5}}
    )
    chars = client.get(f"{API}/characters").json()
    owned = set(me.get("owned_characters", []))
    kite = next(
        (c for c in chars
         if c["category"] == "kite"
         and float(c.get("price", 0)) == 0
         and c.get("unlock_level", 1) <= 5
         and c["character_id"] not in owned),
        None,
    )
    if kite is None:
        pytest.skip("No claimable free kite available after level bump")

    pr = client.post(f"{API}/characters/claim", json={"character_id": kite["character_id"]})
    assert pr.status_code < 500, pr.text

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
#
# The reset code is intentionally never returned by /auth/forgot-password (see
# the SECURITY note on that endpoint in server.py) and is stored bcrypt-hashed
# in password_resets.code_hash - a one-way hash, so there is no way to recover
# a real generated code from the DB either. Tests that need to drive
# /auth/reset-password with a *known* code seed a password_resets document
# directly, hashed the exact same way the endpoint hashes a real one
# (_seed_reset_code below). This never touches or weakens production code -
# it only gives the test a code it already knows the plaintext of.
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
    return s, payload, r.json()["user_id"]


def _seed_reset_code(email, user_id, code="123456"):
    """Insert a password_resets doc with a known plaintext code, hashed the
    same way /auth/forgot-password hashes a real one (bcrypt). Lets tests
    drive /auth/reset-password deterministically without the endpoint ever
    needing to expose a real generated code."""
    import bcrypt
    import uuid as _uuid
    from datetime import datetime, timedelta, timezone
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    now = datetime.now(timezone.utc)
    db.password_resets.insert_one({
        "reset_id": f"rst_test_{_uuid.uuid4().hex[:16]}",
        "email": email,
        "user_id": user_id,
        "code_hash": bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode(),
        "used": False,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=900)).isoformat(),
    })
    return code


def test_forgot_password_registered_never_returns_code_but_seeds_pending_reset():
    """SECURITY: the response must never carry the code (see server.py), for a
    registered email exactly as much as an unregistered one. Verify the
    generic-response contract *and* that the endpoint actually did its job
    server-side (a real, unused password_resets row got created) - so this
    isn't just testing an empty response, it's testing real code generation
    that merely stays server-side."""
    _, user, user_id = _register_user("happy")
    r = requests.post(f"{API}/auth/forgot-password", json={"email": user["email"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "message" in body
    assert body.get("expires_in_seconds") == 900
    assert "code" not in body, "SECURITY REGRESSION: /auth/forgot-password must never return the code"

    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    pending = db.password_resets.count_documents({"user_id": user_id, "used": False})
    assert pending >= 1, "forgot-password did not actually generate a reset code server-side"


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
    _, user, user_id = _register_user("reset_ok")
    code = _seed_reset_code(user["email"], user_id)
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
    _, user, user_id = _register_user("badcode")
    _seed_reset_code(user["email"], user_id)
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": "000000", "new_password": "AnotherSky789!",
    })
    assert r.status_code == 400
    assert "Invalid or expired" in r.json().get("detail", "")


def test_reset_password_single_use_enforced():
    _, user, user_id = _register_user("reuse")
    code = _seed_reset_code(user["email"], user_id)
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
    _, user, user_id = _register_user("short")
    code = _seed_reset_code(user["email"], user_id)
    r = requests.post(f"{API}/auth/reset-password", json={
        "email": user["email"], "code": code, "new_password": "abc",
    })
    assert r.status_code == 400
    assert "6 character" in r.json().get("detail", "").lower() or "6" in r.json().get("detail", "")


def test_forgot_password_rate_limit_caps_at_3():
    """The real rate-limit lives in /auth/forgot-password itself (max 3 active
    codes/email) - exercise the real endpoint and verify it server-side via
    the password_resets count, since the response never reveals codes or
    counts either way."""
    _, user, user_id = _register_user("ratecap")
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]

    for _ in range(3):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": user["email"]})
        assert r.status_code == 200, r.text
        assert "code" not in r.json()
    assert db.password_resets.count_documents({"user_id": user_id, "used": False}) == 3

    # 4th must be capped — no new row, still a generic 200 response.
    fourth = requests.post(f"{API}/auth/forgot-password", json={"email": user["email"]})
    assert fourth.status_code == 200
    assert "code" not in fourth.json()
    assert db.password_resets.count_documents({"user_id": user_id, "used": False}) == 3


# ---------- Profile ----------
def test_profile(client):
    r = client.get(f"{API}/profile")
    assert r.status_code == 200
    body = r.json()
    assert "accuracy" in body or "xp_progress" in body or "level" in body



# ---------- RevenueCat purchases ----------
def test_claim_free_sky_theme_grants_directly(client):
    """Free items (price=0) should be granted directly via /characters/claim."""
    # 'dawn' is price=0 and already owned by default, pick something else that's free.
    chars = client.get(f"{API}/characters").json()
    free = next((c for c in chars if float(c.get("price", 0)) == 0), None)
    assert free is not None
    me = client.get(f"{API}/auth/me").json()
    # If already owned, expect 400 already owned.
    if free["character_id"] in me.get("owned_sky_themes", []) + me.get("owned_characters", []):
        r = client.post(f"{API}/characters/claim",
                        json={"character_id": free["character_id"]})
        assert r.status_code == 400
        assert "owned" in r.json().get("detail", "").lower()
    else:
        r = client.post(f"{API}/characters/claim",
                        json={"character_id": free["character_id"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("free") is True and body.get("granted") is True


def test_claim_rejects_paid_item(client):
    """/characters/claim must refuse items that require payment — those go
    through /characters/purchase/sync instead."""
    me = client.get(f"{API}/auth/me").json()
    user_id = me["user_id"]
    import os
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    mc[os.environ.get("DB_NAME", "test_database")].users.update_one(
        {"user_id": user_id}, {"$set": {"level": 8}}
    )
    chars = client.get(f"{API}/characters").json()
    owned = set(me.get("owned_characters", []) +
                me.get("owned_companions", []) +
                me.get("owned_sky_themes", []))
    paid = next(
        (c for c in chars
         if float(c.get("price", 0)) > 0
         and c.get("unlock_level", 0) <= 8
         and c["character_id"] not in owned),
        None,
    )
    if paid is None:
        pytest.skip("No purchasable paid item")

    r = client.post(f"{API}/characters/claim", json={"character_id": paid["character_id"]})
    assert r.status_code == 400, r.text
    assert "payment" in r.json().get("detail", "").lower()


def _category_to_equip_type(category):
    return {"companion": "companion", "sky_theme": "sky_theme"}.get(category, "kite")


def _grant_purchased_item_via_webhook(user_id, nonce_suffix=""):
    """Grant a paid catalog item to user_id the same way a real RevenueCat
    purchase would (via the authoritative /premium/webhook NON_RENEWING_PURCHASE
    path), bypassing the need for a real store transaction. Returns the granted
    character dict, or None if there's no purchasable item in the catalog."""
    webhook_secret = os.environ.get("REVENUECAT_WEBHOOK_SECRET")
    if not webhook_secret:
        return None, "no_webhook_secret"

    r = requests.get(f"{API}/characters")
    chars = r.json()
    paid = next((c for c in chars if float(c.get("price", 0)) > 0), None)
    if paid is None:
        return None, "no_paid_item"

    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    nonce = f"{int(time.time() * 1000)}{nonce_suffix}"
    product_id = f"test_ownership_product_{paid['character_id']}_{nonce}"
    transaction_id = f"test_ownership_txn_{paid['character_id']}_{nonce}"
    db.characters.update_one({"character_id": paid["character_id"]}, {"$set": {"product_id": product_id}})

    payload = {"event": {
        "type": "NON_RENEWING_PURCHASE",
        "app_user_id": user_id,
        "product_id": product_id,
        "id": transaction_id,
    }}
    resp = requests.post(
        f"{API}/premium/webhook", json=payload,
        headers={"Authorization": f"Bearer {webhook_secret}"},
    )
    if resp.status_code != 200:
        return None, f"webhook_failed_{resp.status_code}"
    return paid, None


def test_purchased_item_ownership_persists_across_logout_and_new_login_session():
    """Ownership must be tied to the account (DB), not the session/cookie/device -
    a purchased item should survive logout and come back on a brand-new login
    session (no cookie carried over), the same way a reinstall/new-device
    login would see it."""
    ts = int(time.time() * 1000)
    email = f"TEST_persist_{ts}@example.com"
    password = "DreamySky123!"

    s1 = requests.Session()
    s1.headers.update({"Content-Type": "application/json"})
    r = s1.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Persist"})
    assert r.status_code == 200, r.text
    s1.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    user_id = s1.get(f"{API}/auth/me").json()["user_id"]

    item, skip_reason = _grant_purchased_item_via_webhook(user_id, "_persist")
    if item is None:
        pytest.skip(f"Could not set up a purchased item for this test: {skip_reason}")

    equip_type = _category_to_equip_type(item.get("category", "kite"))
    eq = s1.post(f"{API}/characters/equip", json={"character_id": item["character_id"], "type": equip_type})
    assert eq.status_code == 200, eq.text

    assert s1.post(f"{API}/auth/logout").status_code == 200
    assert s1.get(f"{API}/auth/me").status_code in (401, 403)

    # Brand-new session object: no cookie carried over at all, simulating a
    # fresh login on a new device/reinstall.
    s2 = requests.Session()
    s2.headers.update({"Content-Type": "application/json"})
    login = s2.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    s2.headers.update({"Authorization": f"Bearer {login.json()['session_token']}"})

    me2 = s2.get(f"{API}/auth/me").json()
    owned2 = set(me2.get("owned_characters", []) + me2.get("owned_companions", []) + me2.get("owned_sky_themes", []))
    assert item["character_id"] in owned2, "purchased item did not survive logout + new login session"

    equip_field = {"companion": "current_companion", "sky_theme": "current_sky_theme"}.get(
        item.get("category", "kite"), "current_character"
    )
    assert me2.get(equip_field) == item["character_id"], "equipped state did not survive logout + new login session"


def test_purchased_item_ownership_does_not_leak_between_users():
    """A different user must never see or be able to use an item purchased by
    someone else's account - ownership must not leak across users."""
    ts = int(time.time() * 1000)

    a = requests.Session()
    a.headers.update({"Content-Type": "application/json"})
    r_a = a.post(f"{API}/auth/register", json={
        "email": f"TEST_leak_a_{ts}@example.com", "password": "DreamySky123!", "name": "A",
    })
    a.headers.update({"Authorization": f"Bearer {r_a.json()['session_token']}"})
    user_id_a = a.get(f"{API}/auth/me").json()["user_id"]

    item, skip_reason = _grant_purchased_item_via_webhook(user_id_a, "_leak")
    if item is None:
        pytest.skip(f"Could not set up a purchased item for this test: {skip_reason}")

    b = requests.Session()
    b.headers.update({"Content-Type": "application/json"})
    r_b = b.post(f"{API}/auth/register", json={
        "email": f"TEST_leak_b_{ts}@example.com", "password": "DreamySky123!", "name": "B",
    })
    b.headers.update({"Authorization": f"Bearer {r_b.json()['session_token']}"})
    me_b = b.get(f"{API}/auth/me").json()
    owned_b = set(me_b.get("owned_characters", []) + me_b.get("owned_companions", []) + me_b.get("owned_sky_themes", []))
    assert item["character_id"] not in owned_b, (
        f"VULNERABILITY: user B sees an item only user A purchased: {item['character_id']}"
    )

    equip_type = _category_to_equip_type(item.get("category", "kite"))
    eq = b.post(f"{API}/characters/equip", json={"character_id": item["character_id"], "type": equip_type})
    assert eq.status_code == 403, (
        f"VULNERABILITY: user B was able to equip an item only user A owns (status {eq.status_code})"
    )


def test_purchase_sync_rejects_product_id_mismatch(client):
    """/characters/purchase/sync must reject a product_id that doesn't match
    the character's configured store product, before ever calling out to
    RevenueCat."""
    chars = client.get(f"{API}/characters").json()
    paid = next((c for c in chars if float(c.get("price", 0)) > 0), None)
    if paid is None:
        pytest.skip("No paid item in catalog")

    r = client.post(f"{API}/characters/purchase/sync", json={
        "character_id": paid["character_id"],
        "product_id": "not_the_real_product_id",
        "transaction_id": "txn_fake",
    })
    assert r.status_code in (400, 404), r.text


def test_purchase_sync_unverified_transaction_not_granted(client):
    """A syntactically valid sync payload whose transaction RevenueCat has
    never seen must not grant the item — either because verification runs
    and finds nothing (`not_yet_visible`), because REVENUECAT_SECRET_API_KEY
    isn't configured in this environment (500), or because it's configured
    with a key RevenueCat itself rejects (502) - all are "not granted"."""
    me = client.get(f"{API}/auth/me").json()
    user_id = me["user_id"]
    import os
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]

    chars = client.get(f"{API}/characters").json()
    owned = set(me.get("owned_characters", []) +
                me.get("owned_companions", []) +
                me.get("owned_sky_themes", []))
    paid = next(
        (c for c in chars if float(c.get("price", 0)) > 0
         and c["character_id"] not in owned),
        None,
    )
    if paid is None:
        pytest.skip("No purchasable paid item")

    test_product_id = f"test_product_{paid['character_id']}"
    db.characters.update_one(
        {"character_id": paid["character_id"]},
        {"$set": {"product_id": test_product_id}},
    )
    try:
        r = client.post(f"{API}/characters/purchase/sync", json={
            "character_id": paid["character_id"],
            "product_id": test_product_id,
            "transaction_id": "txn_never_happened",
        })
        if r.status_code in (500, 502):
            pytest.skip(f"RevenueCat not reachable/configured in this env: {r.status_code} {r.text}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is False
        assert body.get("granted") is False

        me2 = client.get(f"{API}/auth/me").json()
        assert paid["character_id"] not in (
            me2.get("owned_characters", []) + me2.get("owned_companions", []) + me2.get("owned_sky_themes", [])
        )
    finally:
        db.characters.update_one(
            {"character_id": paid["character_id"]},
            {"$set": {"product_id": None}},
        )


def test_old_stripe_purchase_endpoint_removed(client):
    """The old Stripe checkout-session endpoint should no longer exist."""
    r = client.post(f"{API}/characters/purchase", json={"character_id": "rainbow_kite"})
    assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}: {r.text}"


def test_old_cashapp_endpoint_removed(client):
    """Old confirm-purchase endpoint should no longer exist."""
    r = client.post(f"{API}/characters/confirm-purchase",
                    json={"character_id": "rainbow_kite"})
    assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}: {r.text}"


def test_checkout_status_endpoint_removed():
    r = requests.get(f"{API}/payments/checkout/status/cs_test_does_not_exist_xyz_123")
    assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}: {r.text}"


def test_stripe_webhook_endpoint_removed():
    r = requests.post(f"{API}/webhook/stripe",
                      data=b"{}",
                      headers={"Stripe-Signature": "invalid",
                               "Content-Type": "application/json"})
    assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}: {r.text}"


def test_premium_webhook_rejects_missing_or_wrong_auth(client):
    """The webhook must never process an event without a valid bearer secret —
    it must fail closed (401/500), not silently accept, regardless of whether
    REVENUECAT_WEBHOOK_SECRET happens to be configured on this server."""
    payload = {"event": {"type": "NON_RENEWING_PURCHASE", "app_user_id": "nobody", "product_id": "x", "id": "y"}}

    r_no_auth = requests.post(f"{API}/premium/webhook", json=payload)
    assert r_no_auth.status_code in (401, 500), r_no_auth.text

    r_wrong_auth = requests.post(
        f"{API}/premium/webhook", json=payload,
        headers={"Authorization": "Bearer definitely-not-the-secret"},
    )
    assert r_wrong_auth.status_code in (401, 500), r_wrong_auth.text


def test_premium_webhook_grants_non_renewing_purchase_and_is_idempotent(client):
    """RevenueCat webhook NON_RENEWING_PURCHASE events are the authoritative,
    idempotent grant path — same purchase_transactions dedupe key that
    /characters/purchase/sync uses."""
    webhook_secret = os.environ.get("REVENUECAT_WEBHOOK_SECRET")
    if not webhook_secret:
        pytest.skip("REVENUECAT_WEBHOOK_SECRET not set in test environment")

    me = client.get(f"{API}/auth/me").json()
    user_id = me["user_id"]
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]

    chars = client.get(f"{API}/characters").json()
    owned = set(me.get("owned_characters", []) +
                me.get("owned_companions", []) +
                me.get("owned_sky_themes", []))
    item = next((c for c in chars if c["character_id"] not in owned), None)
    if item is None:
        pytest.skip("No unowned item to grant")

    # Include a per-run nonce: transaction_id is the idempotency dedupe key
    # (see _grant_purchase in server.py), so a fixed string would collide
    # with a leftover row from an earlier test run against a non-fresh DB
    # and get silently treated as "already granted to that other run's user".
    nonce = int(time.time() * 1000)
    test_product_id = f"test_webhook_product_{item['character_id']}_{nonce}"
    transaction_id = f"test_webhook_txn_{item['character_id']}_{nonce}"
    db.characters.update_one(
        {"character_id": item["character_id"]},
        {"$set": {"product_id": test_product_id}},
    )
    try:
        payload = {"event": {
            "type": "NON_RENEWING_PURCHASE",
            "app_user_id": user_id,
            "product_id": test_product_id,
            "id": transaction_id,
        }}
        r1 = requests.post(
            f"{API}/premium/webhook",
            json=payload,
            headers={"Authorization": f"Bearer {webhook_secret}"},
        )
        assert r1.status_code == 200, r1.text

        me2 = client.get(f"{API}/auth/me").json()
        owned2 = set(me2.get("owned_characters", []) +
                     me2.get("owned_companions", []) +
                     me2.get("owned_sky_themes", []))
        assert item["character_id"] in owned2

        # Redelivery of the same event must not double-grant. RevenueCat sends
        # the same static bearer header on every delivery attempt, including
        # redeliveries, so this needs it too now that the endpoint fails
        # closed on missing/invalid auth.
        r2 = requests.post(
            f"{API}/premium/webhook",
            json=payload,
            headers={"Authorization": f"Bearer {webhook_secret}"},
        )
        assert r2.status_code == 200, r2.text
        grant_count = db.purchase_transactions.count_documents({"transaction_id": transaction_id})
        assert grant_count == 1
    finally:
        db.characters.update_one(
            {"character_id": item["character_id"]},
            {"$set": {"product_id": None}},
        )



# --- CORS hardening (iter 9) — must hit FastAPI directly (localhost) so the K8s
# ingress (which adds wildcard CORS headers of its own) does not mask the result.
LOCAL_API = "http://localhost:8001/api"


def _get_acao(headers):
    """Return ACAO header (case-insensitive) or None."""
    for k, v in headers.items():
        if k.lower() == "access-control-allow-origin":
            return v
    return None


def test_cors_blocks_evil_origin():
    """Evil origin must NOT receive Access-Control-Allow-Origin header from FastAPI."""
    r = requests.get(f"{LOCAL_API}/health",
                     headers={"Origin": "https://evil.example.com"})
    assert r.status_code == 200
    assert _get_acao(r.headers) is None, (
        f"Evil origin must NOT get ACAO. Got: {_get_acao(r.headers)}"
    )


def test_cors_allows_configured_origin():
    """The configured CORS_ORIGINS entry must be echoed back exactly."""
    origin = "https://kite-trivia-quest.preview.emergentagent.com"
    r = requests.get(f"{LOCAL_API}/health", headers={"Origin": origin})
    assert r.status_code == 200
    assert _get_acao(r.headers) == origin


def test_cors_allows_preview_regex_origin():
    """Arbitrary *.preview.emergentagent.com origin must match the regex."""
    origin = "https://another-preview-app.preview.emergentagent.com"
    r = requests.get(f"{LOCAL_API}/health", headers={"Origin": origin})
    assert r.status_code == 200
    assert _get_acao(r.headers) == origin


def test_cors_blocks_subdomain_attack():
    """A domain that contains the suffix as a non-tail substring must be rejected."""
    r = requests.get(f"{LOCAL_API}/health",
                     headers={"Origin": "https://evil.preview.emergentagent.com.attacker.com"})
    assert r.status_code == 200
    assert _get_acao(r.headers) is None



# --- iter 18: SECURITY UPDATE — Cookie SameSite=None + Secure on all 3 auth endpoints ---
# Rationale: Native Capacitor iOS webview origin (capacitor://localhost) is
# cross-site to the API. SameSite=Lax cookies are NOT attached on cross-site
# requests, which broke auth on native builds. SameSite=None + Secure is the
# standard hybrid-app pattern. Secure=True is enforced (required to pair with
# SameSite=None).
def _get_set_cookies(response):
    """Return list of all Set-Cookie header values (case-insensitive)."""
    # requests exposes raw headers via response.raw.headers.get_all when available;
    # fall back to response.headers which combines them.
    try:
        return response.raw.headers.getlist("Set-Cookie")
    except Exception:
        val = response.headers.get("Set-Cookie") or response.headers.get("set-cookie")
        return [val] if val else []


def _session_cookie(response):
    for c in _get_set_cookies(response):
        if c and c.lower().startswith("session_token="):
            return c
    return None


def test_register_sets_samesite_none_secure_cookie():
    ts = int(time.time() * 1000)
    payload = {
        "email": f"TEST_kite_iter18_reg_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "TEST Iter18 Reg",
    }
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    cookie = _session_cookie(r)
    assert cookie is not None, f"session_token cookie missing. Set-Cookie: {_get_set_cookies(r)}"
    low = cookie.lower()
    assert "samesite=none" in low, f"Expected SameSite=None (native support), got: {cookie}"
    assert "secure" in low, f"Secure attribute MUST be set with SameSite=None, got: {cookie}"
    assert "httponly" in low, f"HttpOnly MUST be set, got: {cookie}"


def test_login_sets_samesite_none_secure_cookie():
    ts = int(time.time() * 1000)
    payload = {
        "email": f"TEST_kite_iter18_login_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "TEST Iter18 Login",
    }
    # Register first
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    # Now login
    r2 = requests.post(f"{API}/auth/login",
                       json={"email": payload["email"], "password": payload["password"]})
    assert r2.status_code == 200, r2.text
    cookie = _session_cookie(r2)
    assert cookie is not None, f"session_token cookie missing on login: {_get_set_cookies(r2)}"
    low = cookie.lower()
    assert "samesite=none" in low, f"Expected SameSite=None on login, got: {cookie}"
    assert "secure" in low, f"Secure attribute MUST be set with SameSite=None on login, got: {cookie}"


def test_session_exchange_endpoint_uses_samesite_none_in_source():
    """
    /api/auth/session requires a valid Emergent OAuth `session_id` from the header
    X-Session-ID. We can't get a real one in tests, so instead verify the source
    file uses samesite="none" at the session-exchange cookie call. This validates
    that native-app auth stays consistent across all three cookie-setting paths.
    """
    import re
    server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
    with open(server_path, "r") as f:
        src = f.read()
    # find all samesite= arguments
    matches = re.findall(r'samesite\s*=\s*["\']([a-zA-Z]+)["\']', src)
    assert len(matches) >= 3, f"Expected >=3 samesite calls, found {matches}"
    assert all(m.lower() == "none" for m in matches), (
        f"All samesite values must be 'none' for native support, got: {matches}"
    )
    # extra: ensure no samesite="lax" regressions creep back in
    assert 'samesite="lax"' not in src.lower().replace("'", '"'), (
        "samesite=\"lax\" must not remain in server.py (breaks native iOS auth)"
    )


# ---------- Premium / Paywall ----------
def test_free_tier_gate_blocks_after_daily_cap():
    """Fresh (non-premium) user gets HTTP 402 after FREE_ROUNDS_PER_DAY rounds."""
    ts = int(time.time() * 1000)
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_free_{ts}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "DreamySky123!", "name": "F"})
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})

    # Play the allowed budget
    for i in range(3):
        r = s.get(f"{API}/questions", params={"limit": 10})
        assert r.status_code == 200, f"round {i+1} failed unexpectedly: {r.status_code} {r.text}"

    # 4th should be blocked
    blocked = s.get(f"{API}/questions", params={"limit": 10})
    assert blocked.status_code == 402, f"expected 402, got {blocked.status_code}"
    detail = blocked.json().get("detail", {})
    assert detail.get("code") == "free_tier_limit_reached"
    assert detail.get("free_rounds_per_day") == 3


def test_seeded_premium_bypasses_free_tier_gate():
    """A user with is_premium=True in the DB gets unlimited rounds.

    /api/premium/sync can't be used to set this up in a test: it independently
    verifies against RevenueCat's REST API and ignores whatever the client
    claims (see sync_premium in server.py), so a fabricated payload for a
    user_id that never made a real purchase is never granted. Seed the DB
    directly instead - this test is about whether the *gate* correctly honors
    is_premium, not about how that field gets set. Spoofing /premium/sync
    itself is covered separately by test_premium_sync_rejects_spoofed_payload.
    """
    ts = int(time.time() * 1000)
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/register", json={
        "email": f"TEST_premsync_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "P",
    })
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})
    user_id = s.get(f"{API}/auth/me").json()["user_id"]

    # Exhaust free budget
    for _ in range(3):
        s.get(f"{API}/questions", params={"limit": 10})
    assert s.get(f"{API}/questions", params={"limit": 10}).status_code == 402

    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_premium": True, "premium_source": "pytest_seed", "premium_product_id": "monthly"}},
    )

    status = s.get(f"{API}/premium/status").json()
    assert status["is_premium"] is True
    assert status["premium_product_id"] == "monthly"
    assert status["rounds_remaining_today"] is None

    # Post-premium round should succeed
    ok = s.get(f"{API}/questions", params={"limit": 10})
    assert ok.status_code == 200
    assert len(ok.json()) > 0


def test_premium_sync_rejects_spoofed_payload():
    """/premium/sync must never grant premium based on the client's claim.

    Posts a fabricated entitlement_active=true for a user_id that never made
    a real purchase. The only unacceptable outcome is is_premium: true coming
    back - if RevenueCat isn't reachable/configured the endpoint should fail
    outright (500/502) rather than fall back to trusting the payload."""
    ts = int(time.time() * 1000)
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/register", json={
        "email": f"TEST_sync_spoof_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "Sp",
    })
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['session_token']}"})

    spoof = s.post(f"{API}/premium/sync", json={
        "entitlement_active": True,
        "product_id": "monthly",
        "expires_at_iso": "2099-01-01T00:00:00Z",
        "source": "spoofed",
    })
    if spoof.status_code == 200:
        assert spoof.json().get("is_premium") is not True, (
            f"VULNERABILITY: spoofed /premium/sync payload granted premium: {spoof.text}"
        )

    # Regardless of the sync call's outcome, the gate must not have opened.
    for _ in range(3):
        s.get(f"{API}/questions", params={"limit": 10})
    gated = s.get(f"{API}/questions", params={"limit": 10})
    assert gated.status_code == 402, (
        f"VULNERABILITY: free-tier gate bypassed via spoofed /premium/sync (got {gated.status_code})"
    )


def test_premium_status_shape():
    """/premium/status returns the expected client contract."""
    ts = int(time.time() * 1000)
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    reg = s.post(f"{API}/auth/register", json={
        "email": f"TEST_prem_status_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "S",
    })
    s.headers.update({"Authorization": f"Bearer {reg.json()['session_token']}"})
    r = s.get(f"{API}/premium/status")
    assert r.status_code == 200
    body = r.json()
    for key in [
        "is_premium", "premium_expires_at", "premium_source", "premium_product_id",
        "free_rounds_per_day", "rounds_played_today", "rounds_remaining_today",
        "entitlement_id",
    ]:
        assert key in body, f"missing key {key} in status body: {body}"
    assert body["entitlement_id"] == "Kite Premium"
    assert body["free_rounds_per_day"] == 3
    assert body["is_premium"] is False
    assert body["rounds_remaining_today"] == 3


def test_premium_sync_downgrades_previously_seeded_premium():
    """/premium/sync must demote a user whose real RevenueCat subscriber has
    no active entitlement - even if our DB currently says is_premium=True
    (e.g. a lapsed subscription). This exercises the real downgrade path in
    sync_premium against a genuine RevenueCat lookup, so it needs a working
    REVENUECAT_SECRET_API_KEY; skip rather than fail if that isn't available
    in this environment, since the property can't be observed either way."""
    ts = int(time.time() * 1000)
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    reg = s.post(f"{API}/auth/register", json={
        "email": f"TEST_prem_down_{ts}@example.com",
        "password": "DreamySky123!",
        "name": "D",
    })
    s.headers.update({"Authorization": f"Bearer {reg.json()['session_token']}"})
    user_id = s.get(f"{API}/auth/me").json()["user_id"]

    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_premium": True, "premium_source": "pytest_seed", "premium_product_id": "monthly"}},
    )
    assert s.get(f"{API}/premium/status").json()["is_premium"] is True

    # This user_id never made a real purchase, so a working RC lookup will
    # find no active entitlement and sync_premium should downgrade it.
    sync = s.post(f"{API}/premium/sync", json={"entitlement_active": False})
    if sync.status_code != 200:
        pytest.skip(f"RevenueCat not reachable/configured in this environment ({sync.status_code}); "
                    "can't verify the real downgrade path here")

    status = sync.json()
    assert status["is_premium"] is False, f"expected downgrade to False, got: {status}"
    assert status["rounds_remaining_today"] == 3

    # Consume budget again
    for _ in range(3):
        s.get(f"{API}/questions", params={"limit": 10})
    assert s.get(f"{API}/questions", params={"limit": 10}).status_code == 402
