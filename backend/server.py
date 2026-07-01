from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import httpx
import random
from questions_db import QUESTIONS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    coins: int = 0
    current_character: str = "basic_kite"
    current_companion: Optional[str] = None
    current_sky_theme: str = "dawn"
    owned_characters: List[str] = ["basic_kite"]
    owned_companions: List[str] = []
    owned_sky_themes: List[str] = ["dawn"]
    level: int = 1
    xp: int = 0
    total_correct: int = 0
    total_questions: int = 0
    weekly_score: int = 0
    created_at: datetime
    # Daily reward fields
    login_streak: int = 0
    last_login_date: Optional[str] = None
    total_rewards_claimed: int = 0
    recently_seen_questions: List[str] = []
    unlocked_milestones: List[str] = []

class Character(BaseModel):
    model_config = ConfigDict(extra="ignore")
    character_id: str
    name: str
    description: str
    price: float
    category: str  # "kite", "companion", "sky_theme"
    rarity: str = "common"  # common, rare, epic, legendary
    image_url: str
    unlock_level: int = 0

class TriviaQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    question_id: str
    question: str
    options: List[str]
    correct_answer: int
    category: str
    difficulty: int  # 1-5 (1 = 5th grade level)
    xp_reward: int = 10

class AnswerSubmission(BaseModel):
    question_id: str
    selected_answer: int

class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    name: str
    picture: Optional[str] = None
    weekly_score: int
    level: int
    current_character: str

class PurchaseRequest(BaseModel):
    character_id: str
    origin_url: Optional[str] = None

# ==================== AUTH HELPERS ====================

async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(default=None)
) -> User:
    # Check cookie first, then Authorization header
    token = session_token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Convert datetime if string
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    # Normalize email to lowercase to keep auth lookups consistent across the app
    normalized_email = user_data.email.lower().strip()
    # Check if user exists
    existing = await db.users.find_one({"email": normalized_email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "user_id": user_id,
        "email": normalized_email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "picture": None,
        "coins": 0,
        "current_character": "basic_kite",
        "current_companion": None,
        "current_sky_theme": "dawn",
        "owned_characters": ["basic_kite"],
        "owned_companions": [],
        "owned_sky_themes": ["dawn"],
        "level": 1,
        "xp": 0,
        "total_correct": 0,
        "total_questions": 0,
        "weekly_score": 0,
        "login_streak": 0,
        "last_login_date": None,
        "total_rewards_claimed": 0,
        "created_at": now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=7*24*60*60
    )
    
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    user_doc["created_at"] = now
    return User(**user_doc)

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    normalized_email = credentials.email.lower().strip()
    user_doc = await db.users.find_one({"email": normalized_email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = user_doc["user_id"]
    now = datetime.now(timezone.utc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=7*24*60*60
    )
    
    user_doc.pop("password_hash", None)
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    return User(**user_doc)

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange Emergent OAuth session_id for app session"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client_http:
        try:
            resp = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = resp.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=500, detail="Auth service error")
    
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")

    # Normalize email for consistent lookups
    if email:
        email = email.lower().strip()
    
    now = datetime.now(timezone.utc)
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update picture if changed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"picture": picture, "name": name}}
        )
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "coins": 0,
            "current_character": "basic_kite",
            "current_companion": None,
            "current_sky_theme": "dawn",
            "owned_characters": ["basic_kite"],
            "owned_companions": [],
            "owned_sky_themes": ["dawn"],
            "level": 1,
            "xp": 0,
            "total_correct": 0,
            "total_questions": 0,
            "weekly_score": 0,
            "login_streak": 0,
            "last_login_date": None,
            "total_rewards_claimed": 0,
            "created_at": now.isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
        max_age=7*24*60*60
    )
    
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== PASSWORD RESET ====================
# In-app reset flow (no email provider). A 6-digit code is generated, hashed at rest,
# returned ONLY in the API response (user-chosen display-on-screen UX), and expires in 15 min.

import secrets as _secrets

RESET_CODE_TTL_SECONDS = 15 * 60
MAX_ACTIVE_CODES_PER_EMAIL = 3

def _hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()

def _verify_code(code: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(code.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False

@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """Generate a 6-digit reset code. To avoid user enumeration, always return a
    generic success message — but only include the actual code when the email is
    registered (the frontend handles either case identically and only renders the
    code if present in the response)."""
    email = payload.email.lower().strip()
    now = datetime.now(timezone.utc)

    user_doc = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})

    # Generic response shape regardless of outcome
    generic = {
        "message": "If that email is registered, a reset code has been generated below.",
        "code": None,
        "expires_in_seconds": RESET_CODE_TTL_SECONDS,
    }

    if not user_doc:
        # Don't reveal that the email is unregistered
        return generic

    # Rate-limit: cap active (non-expired, non-used) codes per email
    active_count = await db.password_resets.count_documents({
        "email": email,
        "used": False,
        "expires_at": {"$gt": now.isoformat()},
    })
    if active_count >= MAX_ACTIVE_CODES_PER_EMAIL:
        # Return the same generic shape; do not leak that they hit the cap
        return generic

    # Generate a 6-digit code (zero-padded) — easy to type, single-use
    code = f"{_secrets.randbelow(1_000_000):06d}"
    expires_at = now + timedelta(seconds=RESET_CODE_TTL_SECONDS)

    await db.password_resets.insert_one({
        "reset_id": f"rst_{uuid.uuid4().hex[:16]}",
        "email": email,
        "user_id": user_doc["user_id"],
        "code_hash": _hash_code(code),
        "used": False,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    })

    return {
        "message": "Reset code generated. Use it within 15 minutes.",
        "code": code,
        "expires_in_seconds": RESET_CODE_TTL_SECONDS,
    }

@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    """Verify a 6-digit code and set a new password. Codes are single-use and expire."""
    email = payload.email.lower().strip()
    submitted_code = payload.code.strip()

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    now = datetime.now(timezone.utc)

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        # Same error wording as a wrong code to avoid enumeration
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    # Find candidate active codes for this email (newest first)
    candidates = await db.password_resets.find({
        "email": email,
        "used": False,
        "expires_at": {"$gt": now.isoformat()},
    }).sort("created_at", -1).to_list(MAX_ACTIVE_CODES_PER_EMAIL + 2)

    matched = None
    for doc in candidates:
        if _verify_code(submitted_code, doc["code_hash"]):
            matched = doc
            break

    if not matched:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    # Update password
    await db.users.update_one(
        {"user_id": user_doc["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )

    # Mark this code as used
    await db.password_resets.update_one(
        {"reset_id": matched["reset_id"]},
        {"$set": {"used": True, "used_at": now.isoformat()}},
    )

    # Invalidate any other outstanding codes for this email (defense in depth)
    await db.password_resets.update_many(
        {"email": email, "used": False},
        {"$set": {"used": True, "used_at": now.isoformat()}},
    )

    # Invalidate all existing sessions so the user re-logs in with the new password
    await db.user_sessions.delete_many({"user_id": user_doc["user_id"]})

    return {"message": "Password reset successful. Please sign in with your new password."}

# ==================== TRIVIA ROUTES ====================

# ==================== DIFFICULTY CURVE ====================

def difficulty_mix_for_level(level: int) -> dict:
    """
    Return weighted mix of difficulty buckets based on user level.
    Mix is normalized — values sum to 1.0. Used to compose a 10-question round.

    Curve design:
      Level 1     → 80% easy (d1), 20% medium (d2), 0% hard (d3)
      Level 2-3   → 60% d1, 30% d2, 10% d3
      Level 4-5   → 40% d1, 40% d2, 20% d3
      Level 6-8   → 20% d1, 40% d2, 40% d3
      Level 9+    → 10% d1, 30% d2, 60% d3
    """
    if level <= 1:
        return {1: 0.80, 2: 0.20, 3: 0.0}
    if level <= 3:
        return {1: 0.60, 2: 0.30, 3: 0.10}
    if level <= 5:
        return {1: 0.40, 2: 0.40, 3: 0.20}
    if level <= 8:
        return {1: 0.20, 2: 0.40, 3: 0.40}
    return {1: 0.10, 2: 0.30, 3: 0.60}


@api_router.get("/questions", response_model=List[TriviaQuestion])
async def get_questions(
    limit: int = 10,
    difficulty: Optional[int] = None,
    current_user: User = Depends(get_current_user),
):
    """Return a level-tuned bag of questions, avoiding recently-seen ones.

    The bag is composed per `difficulty_mix_for_level(user.level)`. Recently
    served question_ids are tracked on the user and excluded from sampling so
    rounds feel fresh. The exclusion list auto-trims when it gets large relative
    to the available pool, so the user never runs out of questions."""

    # Lazy seed
    total = await db.questions.count_documents({})
    if total == 0:
        await seed_questions()

    # Pull recently-seen ids and decide whether to clip them so the pool never starves
    recent = list(current_user.recently_seen_questions or [])
    # If recent buffer covers > 60% of the total pool, trim it back to last 25%
    if len(recent) > int(total * 0.6):
        recent = recent[-int(total * 0.25):]

    excluded = {"question_id": {"$nin": recent}} if recent else {}

    async def sample(match_extra: dict, n: int) -> list:
        match = {**match_extra, **excluded}
        docs = await db.questions.aggregate([
            {"$match": match},
            {"$sample": {"size": n}},
            {"$project": {"_id": 0}},
        ]).to_list(n)
        # Fallback: bucket exhausted under exclusion → relax exclusion
        if len(docs) < n:
            fill = await db.questions.aggregate([
                {"$match": match_extra},
                {"$sample": {"size": n - len(docs)}},
                {"$project": {"_id": 0}},
            ]).to_list(n - len(docs))
            existing = {d["question_id"] for d in docs}
            docs.extend([d for d in fill if d["question_id"] not in existing])
        return docs

    # Override path
    if difficulty is not None:
        bag = await sample({"difficulty": {"$lte": difficulty}}, limit)
    else:
        # Weighted mix by level
        mix = difficulty_mix_for_level(current_user.level)
        bag: list = []
        for bucket, weight in mix.items():
            count = round(weight * limit)
            if count <= 0:
                continue
            chunk = await sample({"difficulty": bucket}, count)
            bag.extend(chunk)

        # Top-up if rounding under-filled
        if len(bag) < limit:
            seen_ids = {q["question_id"] for q in bag}
            fillers = await db.questions.aggregate([
                {"$match": {"difficulty": 1, "question_id": {"$nin": list(seen_ids) + recent}}},
                {"$sample": {"size": limit - len(bag)}},
                {"$project": {"_id": 0}},
            ]).to_list(limit - len(bag))
            bag.extend(fillers)

    random.shuffle(bag)
    bag = bag[:limit]

    # Track the served IDs on the user so the next round doesn't repeat them.
    # Cap the recent buffer at 80 entries (~8 rounds of memory).
    served_ids = [q["question_id"] for q in bag]
    if served_ids:
        new_recent = (recent + served_ids)[-80:]
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"recently_seen_questions": new_recent}},
        )

    return bag


@api_router.post("/questions/answer")
async def submit_answer(
    answer: AnswerSubmission,
    current_user: User = Depends(get_current_user)
):
    """Submit answer and get result"""
    question = await db.questions.find_one(
        {"question_id": answer.question_id},
        {"_id": 0}
    )
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    is_correct = answer.selected_answer == question["correct_answer"]
    xp_earned = question.get("xp_reward", 10) if is_correct else 0
    
    # Update user stats
    update_data = {
        "$inc": {
            "total_questions": 1,
            "xp": xp_earned,
            "weekly_score": 1 if is_correct else 0
        }
    }
    if is_correct:
        update_data["$inc"]["total_correct"] = 1
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        update_data
    )
    
    # Check for level up
    new_xp = current_user.xp + xp_earned
    new_level = current_user.level
    xp_for_next_level = xp_required_for_next_level(new_level)

    if new_xp >= xp_for_next_level:
        new_level += 1
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"level": new_level}}
        )

    # Detect any newly-crossed progressive gates between old & new level.
    # Returned to the frontend so the UI can show a Sky Wanderer celebration.
    new_milestones: list = []
    if new_level > current_user.level:
        crossed = [
            {"category": cat, "rarity": rarity, "level": lvl}
            for (cat, rarity), lvl in PROGRESSIVE_GATES.items()
            if current_user.level < lvl <= new_level
        ]
        # Filter against already-recorded milestones (idempotency on retries)
        already = set(current_user.unlocked_milestones or [])
        for m in crossed:
            key = f"{m['category']}_{m['rarity']}_{m['level']}"
            if key not in already:
                m["key"] = key
                new_milestones.append(m)

        if new_milestones:
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$addToSet": {"unlocked_milestones": {"$each": [m["key"] for m in new_milestones]}}},
            )

    return {
        "correct": is_correct,
        "correct_answer": question["correct_answer"],
        "xp_earned": xp_earned,
        "new_xp": new_xp,
        "new_level": new_level,
        "level_up": new_level > current_user.level,
        "new_milestones": new_milestones,
    }

# ==================== XP / LEVELING ====================
# Smart curve: 150 + level * 150. Early levels stay quick to hook players,
# then spacing widens gradually. L1→L2=300, L5→L6=900, L10→L11=1650,
# L20→L21=3150.
def xp_required_for_next_level(level: int) -> int:
    return 150 + level * 150


# ==================== CHARACTER ROUTES ====================

# ==================== PROGRESSIVE UNLOCK GATES ====================
# Players unlock items by rarity + category as they level up. The gate is
# applied on top of any per-item unlock_level — whichever is higher wins.
# Designed to feel like discovery, not a paywall.
PROGRESSIVE_GATES = {
    ("kite", "common"): 3,
    ("sky_theme", "common"): 4,
    ("companion", "common"): 5,
    ("kite", "rare"): 8,
    ("sky_theme", "rare"): 9,
    ("companion", "rare"): 10,
    ("kite", "epic"): 14,
    ("sky_theme", "epic"): 15,
    ("companion", "epic"): 16,
    ("kite", "legendary"): 20,
    ("sky_theme", "legendary"): 20,
    ("companion", "legendary"): 22,
}

def _effective_unlock_level(character: dict) -> int:
    """Higher of per-item unlock_level and the rarity/category gate."""
    cat = character.get("category", "kite")
    rarity = character.get("rarity", "common")
    gate = PROGRESSIVE_GATES.get((cat, rarity), 0)
    return max(int(character.get("unlock_level", 0)), gate)


@api_router.get("/characters", response_model=List[Character])
async def get_characters(category: Optional[str] = None, include_seasonal_free: bool = False):
    """Get all available characters, optionally filtered by category.
    Effective unlock_level reflects progressive rarity gates.
    Free monthly seasonal themes are hidden by default."""
    query = {} if not category else {"category": category}
    if not include_seasonal_free:
        query["seasonal_free"] = {"$ne": True}
    characters = await db.characters.find(query, {"_id": 0}).to_list(200)

    if not characters:
        await seed_characters()
        characters = await db.characters.find(query, {"_id": 0}).to_list(200)

    for c in characters:
        c["unlock_level"] = _effective_unlock_level(c)
    return characters

@api_router.get("/characters/gates")
async def get_unlock_gates(current_user: User = Depends(get_current_user)):
    """Return the rarity gate structure so the UI can show 'Unlocks at level N' headers."""
    gates = [
        {"category": cat, "rarity": rarity, "unlock_level": lvl,
         "unlocked": current_user.level >= lvl}
        for (cat, rarity), lvl in PROGRESSIVE_GATES.items()
    ]
    return {"gates": gates, "user_level": current_user.level}

@api_router.get("/characters/next-unlock")
async def get_next_unlock(current_user: User = Depends(get_current_user)):
    """Return a teaser for the next collectible the player will unlock as they level up.

    Picks the nearest upcoming gate (smallest unlock_level above current level),
    then samples one matching item the player doesn't yet own. Falls back to
    a random matching item if all are owned."""
    user_level = current_user.level

    # Find the smallest gate above user's current level
    upcoming = [(cat, rarity, lvl) for (cat, rarity), lvl in PROGRESSIVE_GATES.items()
                if lvl > user_level]
    if not upcoming:
        return {"next_unlock": None, "user_level": user_level}

    upcoming.sort(key=lambda x: x[2])
    cat, rarity, gate_level = upcoming[0]

    # Sample a matching item
    owned_field = {
        "kite": "owned_characters",
        "companion": "owned_companions",
        "sky_theme": "owned_sky_themes",
    }[cat]
    owned_list = getattr(current_user, owned_field, [])

    items = await db.characters.find(
        {"category": cat, "rarity": rarity},
        {"_id": 0},
    ).to_list(50)
    if not items:
        return {"next_unlock": None, "user_level": user_level}

    unowned = [i for i in items if i["character_id"] not in owned_list]
    sample = random.choice(unowned) if unowned else random.choice(items)

    return {
        "next_unlock": {
            "category": cat,
            "rarity": rarity,
            "unlock_level": gate_level,
            "levels_remaining": gate_level - user_level,
            "sample_item": {
                "character_id": sample["character_id"],
                "name": sample["name"],
                "description": sample["description"],
                "rarity": sample["rarity"],
                "category": sample["category"],
            },
        },
        "user_level": user_level,
    }

# ==================== SEASONAL SKY ====================

def _current_season() -> dict:
    """Returns the currently active seasonal theme based on the server month.
    Mapping: Mar-May → spring, Jun-Aug → summer, Sep-Nov → autumn, Dec-Feb → winter."""
    m = datetime.now(timezone.utc).month
    if m in (3, 4, 5):
        return {"season": "spring", "character_id": "seasonal_spring", "label": "Spring"}
    if m in (6, 7, 8):
        return {"season": "summer", "character_id": "seasonal_summer", "label": "Summer"}
    if m in (9, 10, 11):
        return {"season": "autumn", "character_id": "seasonal_autumn", "label": "Autumn"}
    return {"season": "winter", "character_id": "seasonal_winter", "label": "Winter"}


@api_router.get("/sky/seasonal")
async def get_seasonal_sky(current_user: User = Depends(get_current_user)):
    """Return the currently active free seasonal sky theme."""
    season = _current_season()
    character = await db.characters.find_one(
        {"character_id": season["character_id"]},
        {"_id": 0},
    )
    if not character:
        return {"season": season, "theme": None, "owned": False}

    owned = season["character_id"] in (current_user.owned_sky_themes or [])
    return {
        "season": season["season"],
        "label": season["label"],
        "theme": character,
        "owned": owned,
        "equipped": current_user.current_sky_theme == season["character_id"],
    }


@api_router.post("/sky/seasonal/claim")
async def claim_seasonal_sky(current_user: User = Depends(get_current_user)):
    """Grant the current month's seasonal theme to the user (idempotent)."""
    season = _current_season()
    character = await db.characters.find_one(
        {"character_id": season["character_id"]},
        {"_id": 0},
    )
    if not character:
        raise HTTPException(status_code=404, detail="Seasonal theme not configured")

    if season["character_id"] not in (current_user.owned_sky_themes or []):
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$addToSet": {"owned_sky_themes": season["character_id"]}},
        )

    return {
        "granted": True,
        "character_id": season["character_id"],
        "season": season["season"],
        "label": season["label"],
    }

@api_router.post("/characters/equip")
async def equip_character(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Equip an owned character, companion, or sky theme"""
    character_id = data.get("character_id")
    item_type = data.get("type", "kite")  # kite, companion, sky_theme
    
    if item_type == "companion":
        if character_id and character_id not in current_user.owned_companions:
            raise HTTPException(status_code=403, detail="Companion not owned")
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"current_companion": character_id}}
        )
        return {"message": "Companion equipped", "companion_id": character_id}
    elif item_type == "sky_theme":
        if character_id not in current_user.owned_sky_themes:
            raise HTTPException(status_code=403, detail="Sky theme not owned")
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"current_sky_theme": character_id}}
        )
        return {"message": "Sky theme equipped", "sky_theme_id": character_id}
    else:
        if character_id not in current_user.owned_characters:
            raise HTTPException(status_code=403, detail="Character not owned")
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"current_character": character_id}}
        )
        return {"message": "Character equipped", "character_id": character_id}

# ---------------------------------------------------------------------------
# Open-Redirect defense for Stripe checkout URLs (CWE-601).
# `origin_url` in PurchaseRequest is client-supplied and would otherwise be
# echoed into success_url/cancel_url. We only honour it when it matches the
# same allowlist we use for CORS.
# ---------------------------------------------------------------------------
import re as _re

def _origin_allowlist():
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip() and o.strip() != "*"]
    regex = os.environ.get("CORS_ORIGIN_REGEX", r"^https://[a-z0-9-]+\.preview\.emergentagent\.com$")
    return origins, regex

def _resolve_safe_origin(candidate: Optional[str], request: Request) -> str:
    """Return `candidate` iff it matches the CORS allowlist; else fall back
    to the backend's own base_url (safe by construction)."""
    fallback = str(request.base_url).rstrip("/")
    if not candidate or not isinstance(candidate, str):
        return fallback
    candidate = candidate.strip().rstrip("/")
    if not (candidate.startswith("http://") or candidate.startswith("https://")):
        return fallback
    origins, regex = _origin_allowlist()
    if candidate in origins:
        return candidate
    if regex and _re.match(regex, candidate):
        return candidate
    return fallback


@api_router.post("/characters/purchase")
async def purchase_character(
    purchase: PurchaseRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Create a Stripe Checkout Session for the requested item."""
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest,
    )
    character = await db.characters.find_one(
        {"character_id": purchase.character_id},
        {"_id": 0}
    )
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    category = character.get("category", "kite")
    if category == "companion":
        owned_list = current_user.owned_companions
    elif category == "sky_theme":
        owned_list = current_user.owned_sky_themes
    else:
        owned_list = current_user.owned_characters

    if purchase.character_id in owned_list:
        raise HTTPException(status_code=400, detail="Already owned")

    effective_lvl = _effective_unlock_level(character)
    if effective_lvl > current_user.level:
        raise HTTPException(
            status_code=403,
            detail=f"Requires level {effective_lvl}",
        )

    # Server-side authoritative pricing — never trust frontend
    price_usd = float(character["price"])
    if price_usd <= 0:
        # Free items: grant directly
        field_map = {"companion": "owned_companions", "sky_theme": "owned_sky_themes"}
        field = field_map.get(category, "owned_characters")
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$addToSet": {field: purchase.character_id}},
        )
        return {"free": True, "granted": True, "character_id": purchase.character_id}

    # Build success/cancel URLs from the request origin (provided by frontend).
    # SECURITY: origin_url is client-controlled — validate against the CORS
    # allowlist to prevent Open Redirect (CWE-601). If unknown, fall back to
    # the request's own base_url (backend-derived, safe).
    origin = _resolve_safe_origin(purchase.origin_url, request)
    success_url = f"{origin.rstrip('/')}/shop?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin.rstrip('/')}/shop?canceled=1"

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payments not configured")

    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "user_id": current_user.user_id,
        "character_id": purchase.character_id,
        "category": category,
        "source": "kite_shop",
    }
    checkout_request = CheckoutSessionRequest(
        amount=price_usd,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    # MANDATORY: store transaction BEFORE redirect
    now = datetime.now(timezone.utc)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": current_user.user_id,
        "character_id": purchase.character_id,
        "category": category,
        "amount": price_usd,
        "currency": "usd",
        "payment_status": "initiated",
        "status": "open",
        "granted": False,
        "metadata": metadata,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    })

    return {
        "session_id": session.session_id,
        "url": session.url,
        "amount": price_usd,
    }


@api_router.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Poll Stripe for the latest session status and grant the item once."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    txn = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": current_user.user_id},
        {"_id": 0},
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Already granted — return cached state
    if txn.get("granted"):
        return {
            "payment_status": txn.get("payment_status", "paid"),
            "status": txn.get("status", "complete"),
            "granted": True,
            "character_id": txn["character_id"],
        }

    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    status_response = await stripe_checkout.get_checkout_status(session_id)

    now_iso = datetime.now(timezone.utc).isoformat()
    update = {
        "payment_status": status_response.payment_status,
        "status": status_response.status,
        "updated_at": now_iso,
    }

    granted = False
    if status_response.payment_status == "paid" and not txn.get("granted"):
        # Grant the item idempotently
        category = txn.get("category", "kite")
        field_map = {"companion": "owned_companions", "sky_theme": "owned_sky_themes"}
        field = field_map.get(category, "owned_characters")

        # Atomically mark granted=true and set granted_at
        result = await db.payment_transactions.update_one(
            {"session_id": session_id, "granted": {"$ne": True}},
            {"$set": {**update, "granted": True, "granted_at": now_iso}},
        )
        if result.modified_count == 1:
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$addToSet": {field: txn["character_id"]}},
            )
            granted = True
    else:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update},
        )

    return {
        "payment_status": status_response.payment_status,
        "status": status_response.status,
        "granted": granted or bool(txn.get("granted")),
        "character_id": txn["character_id"],
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook for redundant payment confirmation (idempotent)."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url)
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.warning(f"Webhook verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")

    if evt.payment_status == "paid" and evt.session_id:
        txn = await db.payment_transactions.find_one(
            {"session_id": evt.session_id}, {"_id": 0}
        )
        if txn and not txn.get("granted"):
            category = txn.get("category", "kite")
            field_map = {"companion": "owned_companions", "sky_theme": "owned_sky_themes"}
            field = field_map.get(category, "owned_characters")
            now_iso = datetime.now(timezone.utc).isoformat()
            result = await db.payment_transactions.update_one(
                {"session_id": evt.session_id, "granted": {"$ne": True}},
                {"$set": {
                    "payment_status": "paid",
                    "status": "complete",
                    "granted": True,
                    "granted_at": now_iso,
                    "updated_at": now_iso,
                }},
            )
            if result.modified_count == 1:
                await db.users.update_one(
                    {"user_id": txn["user_id"]},
                    {"$addToSet": {field: txn["character_id"]}},
                )

    return {"received": True}


# ==================== LEADERBOARD ROUTES ====================

@api_router.get("/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(limit: int = 20):
    """Get weekly leaderboard"""
    users = await db.users.find(
        {},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "weekly_score": 1, "level": 1, "current_character": 1}
    ).sort("weekly_score", -1).limit(limit).to_list(limit)
    
    return [LeaderboardEntry(**u) for u in users]

@api_router.get("/leaderboard/my-rank")
async def get_my_rank(current_user: User = Depends(get_current_user)):
    """Get current user's rank"""
    higher_count = await db.users.count_documents(
        {"weekly_score": {"$gt": current_user.weekly_score}}
    )
    return {"rank": higher_count + 1, "weekly_score": current_user.weekly_score}

# ==================== USER PROFILE ====================

@api_router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get detailed user profile"""
    accuracy = 0
    if current_user.total_questions > 0:
        accuracy = round((current_user.total_correct / current_user.total_questions) * 100, 1)
    
    xp_for_next_level = xp_required_for_next_level(current_user.level)
    xp_progress = (current_user.xp / xp_for_next_level) * 100 if xp_for_next_level > 0 else 0
    
    return {
        **current_user.model_dump(),
        "accuracy": accuracy,
        "xp_for_next_level": xp_for_next_level,
        "xp_progress": min(xp_progress, 100)
    }

# ==================== DAILY REWARDS ====================

@api_router.get("/daily-reward")
async def get_daily_reward_status(current_user: User = Depends(get_current_user)):
    """Check daily reward status"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    last_login = current_user.last_login_date
    
    can_claim = last_login != today
    streak = current_user.login_streak
    
    # Calculate reward based on streak
    base_xp = 25
    streak_bonus = min(streak, 7) * 5  # Max bonus at 7 days
    total_xp = base_xp + streak_bonus
    
    # Milestone rewards
    milestone_reward = None
    if can_claim:
        next_streak = streak + 1 if last_login == (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d") else 1
        if next_streak == 7:
            milestone_reward = {"type": "character_discount", "value": "10% off next character"}
        elif next_streak == 14:
            milestone_reward = {"type": "bonus_xp", "value": 100}
        elif next_streak == 30:
            milestone_reward = {"type": "special_badge", "value": "30-Day Streak Master"}
    
    return {
        "can_claim": can_claim,
        "current_streak": streak,
        "xp_reward": total_xp,
        "milestone_reward": milestone_reward,
        "last_claim_date": last_login
    }

@api_router.post("/daily-reward/claim")
async def claim_daily_reward(current_user: User = Depends(get_current_user)):
    """Claim daily login reward"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    if current_user.last_login_date == today:
        raise HTTPException(status_code=400, detail="Already claimed today")
    
    # Calculate streak
    if current_user.last_login_date == yesterday:
        new_streak = current_user.login_streak + 1
    else:
        new_streak = 1  # Reset streak if missed a day
    
    # Calculate XP reward
    base_xp = 25
    streak_bonus = min(new_streak, 7) * 5
    total_xp = base_xp + streak_bonus
    
    # Check for milestone rewards
    milestone_reward = None
    bonus_xp = 0
    if new_streak == 7:
        milestone_reward = "7-day streak! 10% off next character purchase"
    elif new_streak == 14:
        milestone_reward = "14-day streak! Bonus 100 XP"
        bonus_xp = 100
    elif new_streak == 30:
        milestone_reward = "30-day streak! You're a Kite Master!"
        bonus_xp = 200
    
    total_xp += bonus_xp
    
    # Update user
    new_xp = current_user.xp + total_xp
    new_level = current_user.level
    xp_for_next_level = xp_required_for_next_level(new_level)
    
    level_up = False
    if new_xp >= xp_for_next_level:
        new_level += 1
        level_up = True
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "last_login_date": today,
                "login_streak": new_streak,
                "level": new_level
            },
            "$inc": {
                "xp": total_xp,
                "total_rewards_claimed": 1
            }
        }
    )
    
    return {
        "success": True,
        "xp_earned": total_xp,
        "new_streak": new_streak,
        "new_xp": new_xp,
        "new_level": new_level,
        "level_up": level_up,
        "milestone_reward": milestone_reward
    }

# ==================== SEED DATA ====================

async def seed_questions():
    """Seed expanded trivia questions from external questions_db module."""
    for q in QUESTIONS:
        await db.questions.update_one(
            {"question_id": q["question_id"]},
            {"$set": q},
            upsert=True
        )
    print(f"Seeded {len(QUESTIONS)} questions across categories.")


async def seed_characters():
    """Seed expanded marketplace with kites, companions, and sky themes"""
    characters = [
        # ========== KITES ==========
        # Free starter
        {"character_id": "basic_kite", "name": "Basic Kite", "description": "A classic diamond kite to start your journey", "price": 0, "category": "kite", "rarity": "common", "image_url": "kite_basic", "unlock_level": 0},
        
        # Common Kites (Level 1-2)
        {"character_id": "rainbow_kite", "name": "Rainbow Kite", "description": "A gentle arc of colors dancing in the breeze", "price": 1.99, "category": "kite", "rarity": "common", "image_url": "kite_rainbow", "unlock_level": 1},
        {"character_id": "heart_kite", "name": "Heart Kite", "description": "A lovely heart that floats with warmth", "price": 1.99, "category": "kite", "rarity": "common", "image_url": "kite_heart", "unlock_level": 1},
        {"character_id": "cloud_kite", "name": "Cloud Kite", "description": "As soft and dreamy as the clouds themselves", "price": 2.49, "category": "kite", "rarity": "common", "image_url": "kite_cloud", "unlock_level": 2},
        {"character_id": "butterfly_kite", "name": "Butterfly Kite", "description": "Delicate wings that catch the gentle wind", "price": 2.49, "category": "kite", "rarity": "common", "image_url": "kite_butterfly", "unlock_level": 2},
        
        # Rare Kites (Level 3-4)
        {"character_id": "star_kite", "name": "Star Kite", "description": "A twinkling star that glows softly at dusk", "price": 3.99, "category": "kite", "rarity": "rare", "image_url": "kite_star", "unlock_level": 3},
        {"character_id": "owl_kite", "name": "Owl Kite", "description": "A wise companion for evening flights", "price": 3.99, "category": "kite", "rarity": "rare", "image_url": "kite_owl", "unlock_level": 3},
        {"character_id": "fish_kite", "name": "Koi Fish Kite", "description": "Graceful as a koi swimming through sky-waters", "price": 3.49, "category": "kite", "rarity": "rare", "image_url": "kite_fish", "unlock_level": 3},
        {"character_id": "retro_rainbow", "name": "Retro Rainbow Kite", "description": "Nostalgic vibes from simpler times", "price": 4.49, "category": "kite", "rarity": "rare", "image_url": "kite_retro", "unlock_level": 4},
        {"character_id": "sakura_kite", "name": "Sakura Blossom Kite", "description": "Cherry blossoms drift eternally on this peaceful kite", "price": 4.99, "category": "kite", "rarity": "rare", "image_url": "kite_sakura", "unlock_level": 4},
        
        # Epic Kites (Level 5-7)
        {"character_id": "celestial_kite", "name": "Celestial Kite", "description": "Woven from starlight and moonbeams", "price": 5.99, "category": "kite", "rarity": "epic", "image_url": "kite_celestial", "unlock_level": 5},
        {"character_id": "dragon_kite", "name": "Dragon Kite", "description": "A gentle dragon that rides the wind currents", "price": 5.99, "category": "kite", "rarity": "epic", "image_url": "kite_dragon", "unlock_level": 5},
        {"character_id": "moon_stars_kite", "name": "Moon & Stars Kite", "description": "The night sky captured in fabric and string", "price": 6.49, "category": "kite", "rarity": "epic", "image_url": "kite_moon", "unlock_level": 6},
        {"character_id": "jellyfish_kite", "name": "Jellyfish Kite", "description": "Ethereal tentacles flow like underwater dreams", "price": 6.99, "category": "kite", "rarity": "epic", "image_url": "kite_jellyfish", "unlock_level": 6},
        {"character_id": "storm_kite", "name": "Storm Kite", "description": "Calm within the tempest, beautiful in its power", "price": 6.99, "category": "kite", "rarity": "epic", "image_url": "kite_storm", "unlock_level": 7},
        {"character_id": "eagle_kite", "name": "Eagle Kite", "description": "Majestic and free, soaring above all", "price": 6.99, "category": "kite", "rarity": "epic", "image_url": "kite_eagle", "unlock_level": 7},
        
        # Legendary Kites (Level 8+)
        {"character_id": "phoenix_kite", "name": "Phoenix Kite", "description": "Reborn with each sunrise, eternally radiant", "price": 9.99, "category": "kite", "rarity": "legendary", "image_url": "kite_phoenix", "unlock_level": 8},
        {"character_id": "black_gold_kite", "name": "Black & Gold Luxury Kite", "description": "Elegant sophistication against any sky", "price": 9.99, "category": "kite", "rarity": "legendary", "image_url": "kite_luxury", "unlock_level": 8},
        {"character_id": "neon_cyber_kite", "name": "Neon Cyber Kite", "description": "A glimpse into dreamy digital horizons", "price": 11.99, "category": "kite", "rarity": "legendary", "image_url": "kite_cyber", "unlock_level": 10},
        {"character_id": "aurora_kite", "name": "Aurora Kite", "description": "Dancing lights of the northern sky", "price": 12.99, "category": "kite", "rarity": "legendary", "image_url": "kite_aurora", "unlock_level": 12},
        
        # ========== COMPANIONS ==========
        # Common Companions (Level 2-3)
        {"character_id": "fox_companion", "name": "Little Fox", "description": "A curious fox that follows your kite", "price": 2.99, "category": "companion", "rarity": "common", "image_url": "companion_fox", "unlock_level": 2},
        {"character_id": "owl_companion", "name": "Night Owl", "description": "A wise owl companion for evening adventures", "price": 2.99, "category": "companion", "rarity": "common", "image_url": "companion_owl", "unlock_level": 2},
        {"character_id": "black_cat", "name": "Black Cat", "description": "A mysterious feline friend bringing good luck", "price": 2.99, "category": "companion", "rarity": "common", "image_url": "companion_cat", "unlock_level": 3},
        {"character_id": "corgi_aviator", "name": "Aviator Corgi", "description": "A fluffy pilot ready for sky adventures", "price": 3.49, "category": "companion", "rarity": "common", "image_url": "companion_corgi", "unlock_level": 3},
        
        # Rare Companions (Level 4-5)
        {"character_id": "red_panda", "name": "Red Panda", "description": "A gentle red panda napping on the breeze", "price": 4.49, "category": "companion", "rarity": "rare", "image_url": "companion_panda", "unlock_level": 4},
        {"character_id": "snow_fox", "name": "Snow Fox", "description": "An arctic beauty with eyes like winter stars", "price": 4.99, "category": "companion", "rarity": "rare", "image_url": "companion_snowfox", "unlock_level": 5},
        {"character_id": "raven_companion", "name": "Raven", "description": "A mystical raven that speaks in riddles", "price": 4.99, "category": "companion", "rarity": "rare", "image_url": "companion_raven", "unlock_level": 5},
        
        # Epic Companions (Level 6-7)
        {"character_id": "firefly_swarm", "name": "Firefly Swarm", "description": "Dancing lights that follow your journey", "price": 5.99, "category": "companion", "rarity": "epic", "image_url": "companion_fireflies", "unlock_level": 6},
        {"character_id": "jellyfish_creature", "name": "Floating Jellyfish", "description": "An ethereal creature from dreamy depths", "price": 6.49, "category": "companion", "rarity": "epic", "image_url": "companion_jellyfish", "unlock_level": 7},
        
        # Legendary Companions (Level 8+)
        {"character_id": "tiny_dragon", "name": "Tiny Dragon", "description": "A small dragon with a big heart", "price": 8.99, "category": "companion", "rarity": "legendary", "image_url": "companion_dragon", "unlock_level": 8},
        {"character_id": "spirit_deer", "name": "Spirit Deer", "description": "A celestial deer made of stardust", "price": 9.99, "category": "companion", "rarity": "legendary", "image_url": "companion_deer", "unlock_level": 10},
        
        # ========== SKY THEMES ==========
        # Free starter
        {"character_id": "dawn", "name": "Dawn Sky", "description": "Soft morning light breaking through", "price": 0, "category": "sky_theme", "rarity": "common", "image_url": "sky_dawn", "unlock_level": 0},
        
        # Common Sky Themes
        {"character_id": "clear_day", "name": "Clear Day", "description": "Bright blue skies with gentle clouds", "price": 1.99, "category": "sky_theme", "rarity": "common", "image_url": "sky_day", "unlock_level": 2},
        {"character_id": "sunset_glow", "name": "Sunset Glow", "description": "Warm oranges and pinks of evening", "price": 2.49, "category": "sky_theme", "rarity": "common", "image_url": "sky_sunset", "unlock_level": 3},
        
        # Rare Sky Themes
        {"character_id": "twilight", "name": "Twilight", "description": "The magical hour between day and night", "price": 3.49, "category": "sky_theme", "rarity": "rare", "image_url": "sky_twilight", "unlock_level": 4},
        {"character_id": "cloudy_dreams", "name": "Cloudy Dreams", "description": "Soft, dreamy clouds on a gentle day", "price": 3.49, "category": "sky_theme", "rarity": "rare", "image_url": "sky_cloudy", "unlock_level": 4},
        {"character_id": "golden_hour", "name": "Golden Hour", "description": "Everything glows with warm, soft light", "price": 3.99, "category": "sky_theme", "rarity": "rare", "image_url": "sky_golden", "unlock_level": 5},
        
        # Epic Sky Themes
        {"character_id": "starry_night", "name": "Starry Night", "description": "A canvas of twinkling stars", "price": 4.99, "category": "sky_theme", "rarity": "epic", "image_url": "sky_stars", "unlock_level": 6},
        {"character_id": "moonlit", "name": "Moonlit", "description": "Silver moonlight illuminates the world", "price": 5.49, "category": "sky_theme", "rarity": "epic", "image_url": "sky_moon", "unlock_level": 7},
        {"character_id": "gentle_rain", "name": "Gentle Rain", "description": "Soft rain with distant rolling clouds", "price": 5.49, "category": "sky_theme", "rarity": "epic", "image_url": "sky_rain", "unlock_level": 7},
        
        # Legendary Sky Themes
        {"character_id": "aurora_borealis", "name": "Aurora Borealis", "description": "Northern lights dance across the heavens", "price": 7.99, "category": "sky_theme", "rarity": "legendary", "image_url": "sky_aurora", "unlock_level": 9},
        {"character_id": "celestial_night", "name": "Celestial Night", "description": "Deep space with nebulas and distant galaxies", "price": 8.99, "category": "sky_theme", "rarity": "legendary", "image_url": "sky_celestial", "unlock_level": 10},
        {"character_id": "cherry_blossom_sky", "name": "Cherry Blossom Sky", "description": "Petals drift through a pink-hued sky", "price": 8.99, "category": "sky_theme", "rarity": "legendary", "image_url": "sky_sakura", "unlock_level": 11},

        # ---- Buyable Seasonal Themes ----
        {"character_id": "spring_bloom", "name": "Spring Bloom", "description": "Pastel petals on a soft mint sky", "price": 3.49, "category": "sky_theme", "rarity": "rare", "image_url": "sky_spring", "unlock_level": 4, "seasonal_collection": True},
        {"character_id": "summer_heatwave", "name": "Summer Heatwave", "description": "Bright coral horizon with sun haze", "price": 3.49, "category": "sky_theme", "rarity": "rare", "image_url": "sky_summer", "unlock_level": 5, "seasonal_collection": True},
        {"character_id": "autumn_leaves", "name": "Autumn Leaves", "description": "Amber and burgundy with falling leaves", "price": 5.49, "category": "sky_theme", "rarity": "epic", "image_url": "sky_autumn", "unlock_level": 7, "seasonal_collection": True},
        {"character_id": "winter_frost", "name": "Winter Frost", "description": "Pale silver with delicate snowflakes", "price": 5.49, "category": "sky_theme", "rarity": "epic", "image_url": "sky_winter", "unlock_level": 7, "seasonal_collection": True},

        # ---- Free Monthly Rotating Themes (hidden from main shop) ----
        # Each is auto-claimable for free during its active season window.
        {"character_id": "seasonal_spring", "name": "Spring Whisper", "description": "Free this season — a gift from the sky", "price": 0, "category": "sky_theme", "rarity": "common", "image_url": "sky_season_spring", "unlock_level": 0, "seasonal_free": True},
        {"character_id": "seasonal_summer", "name": "Summer Breeze", "description": "Free this season — a gift from the sky", "price": 0, "category": "sky_theme", "rarity": "common", "image_url": "sky_season_summer", "unlock_level": 0, "seasonal_free": True},
        {"character_id": "seasonal_autumn", "name": "Autumn Hush", "description": "Free this season — a gift from the sky", "price": 0, "category": "sky_theme", "rarity": "common", "image_url": "sky_season_autumn", "unlock_level": 0, "seasonal_free": True},
        {"character_id": "seasonal_winter", "name": "Winter Lull", "description": "Free this season — a gift from the sky", "price": 0, "category": "sky_theme", "rarity": "common", "image_url": "sky_season_winter", "unlock_level": 0, "seasonal_free": True},
    ]
    
    for c in characters:
        await db.characters.update_one(
            {"character_id": c["character_id"]},
            {"$set": c},
            upsert=True
        )

# ==================== ROOT ROUTE ====================

@api_router.get("/")
async def root():
    return {"message": "Kite Trivia API", "version": "1.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

# CORS: never combine "*" with allow_credentials=True (CWE-942).
# When credentials are enabled, browsers require an explicit origin in
# Access-Control-Allow-Origin. We honour CORS_ORIGINS as a comma-separated
# allowlist and use CORS_ORIGIN_REGEX for the emergent preview/prod domains.
_cors_origins_raw = os.environ.get('CORS_ORIGINS', '').strip()
_cors_origin_regex = os.environ.get('CORS_ORIGIN_REGEX', r'^https://[a-z0-9-]+\.preview\.emergentagent\.com$')
_cors_origins = [o.strip() for o in _cors_origins_raw.split(',') if o.strip() and o.strip() != '*']

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Seed data on startup
    await seed_questions()
    await seed_characters()
    # TTL index: password reset codes auto-expire when expires_at (stored as ISO string) passes.
    # Note: Mongo TTL works on BSON dates. We store ISO strings, so we additionally check
    # expiry in code; this index is a safety net for any future date-typed inserts.
    try:
        await db.password_resets.create_index("email")
        await db.password_resets.create_index("created_at")
    except Exception as _e:
        logger.warning(f"Index creation skipped: {_e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
