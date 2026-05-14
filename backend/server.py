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
        samesite="none",
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
        samesite="none",
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
        samesite="none",
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

@api_router.get("/questions", response_model=List[TriviaQuestion])
async def get_questions(
    difficulty: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """Get randomized trivia questions by difficulty (1-5, 1 is easiest 5th grade level)"""
    # Get total count for this difficulty
    total_count = await db.questions.count_documents({"difficulty": {"$lte": difficulty}})
    
    # If no questions, seed them
    if total_count == 0:
        await seed_questions()
        total_count = await db.questions.count_documents({"difficulty": {"$lte": difficulty}})
    
    # Use aggregation with $sample for random selection
    questions = await db.questions.aggregate([
        {"$match": {"difficulty": {"$lte": difficulty}}},
        {"$sample": {"size": min(limit, total_count)}},
        {"$project": {"_id": 0}}
    ]).to_list(limit)
    
    return questions

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
    xp_for_next_level = new_level * 100
    
    if new_xp >= xp_for_next_level:
        new_level += 1
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$set": {"level": new_level}}
        )
    
    return {
        "correct": is_correct,
        "correct_answer": question["correct_answer"],
        "xp_earned": xp_earned,
        "new_xp": new_xp,
        "new_level": new_level,
        "level_up": new_level > current_user.level
    }

# ==================== CHARACTER ROUTES ====================

@api_router.get("/characters", response_model=List[Character])
async def get_characters(category: Optional[str] = None):
    """Get all available characters, optionally filtered by category"""
    query = {} if not category else {"category": category}
    characters = await db.characters.find(query, {"_id": 0}).to_list(200)
    
    if not characters:
        await seed_characters()
        characters = await db.characters.find(query, {"_id": 0}).to_list(200)
    
    return characters

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

@api_router.post("/characters/purchase")
async def purchase_character(
    purchase: PurchaseRequest,
    current_user: User = Depends(get_current_user)
):
    """Record purchase intent - directs to CashApp"""
    character = await db.characters.find_one(
        {"character_id": purchase.character_id},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Check which list to check based on category
    category = character.get("category", "kite")
    if category == "companion":
        owned_list = current_user.owned_companions
    elif category == "sky_theme":
        owned_list = current_user.owned_sky_themes
    else:
        owned_list = current_user.owned_characters
    
    if purchase.character_id in owned_list:
        raise HTTPException(status_code=400, detail="Already owned")
    
    # Check level requirement
    if character.get("unlock_level", 0) > current_user.level:
        raise HTTPException(
            status_code=403,
            detail=f"Requires level {character['unlock_level']}"
        )
    
    # Create purchase record
    purchase_id = f"purchase_{uuid.uuid4().hex[:12]}"
    purchase_doc = {
        "purchase_id": purchase_id,
        "user_id": current_user.user_id,
        "character_id": purchase.character_id,
        "category": category,
        "price": character["price"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.purchases.insert_one(purchase_doc)
    
    return {
        "purchase_id": purchase_id,
        "character": character,
        "cashapp_handle": "fabfeliciaxo",
        "amount": character["price"],
        "instructions": f"Send ${character['price']:.2f} to $fabfeliciaxo on CashApp with note: KITE-{purchase_id}"
    }

@api_router.post("/characters/confirm-purchase")
async def confirm_purchase(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Confirm a purchase (manual verification by admin in real scenario)"""
    purchase_id = data.get("purchase_id")
    
    purchase = await db.purchases.find_one(
        {"purchase_id": purchase_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Update purchase status
    await db.purchases.update_one(
        {"purchase_id": purchase_id},
        {"$set": {"status": "completed"}}
    )
    
    # Add to appropriate owned list based on category
    category = purchase.get("category", "kite")
    if category == "companion":
        field = "owned_companions"
    elif category == "sky_theme":
        field = "owned_sky_themes"
    else:
        field = "owned_characters"
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {field: purchase["character_id"]}}
    )
    
    return {"message": "Purchase confirmed", "character_id": purchase["character_id"]}

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
    
    xp_for_next_level = current_user.level * 100
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
    xp_for_next_level = new_level * 100
    
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
