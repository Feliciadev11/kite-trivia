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

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    coins: int = 0
    current_character: str = "basic_kite"
    owned_characters: List[str] = ["basic_kite"]
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
    category: str  # "cute_kite" or "animal_kite"
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
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "picture": None,
        "coins": 0,
        "current_character": "basic_kite",
        "owned_characters": ["basic_kite"],
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
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
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
            "owned_characters": ["basic_kite"],
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
async def get_characters():
    """Get all available characters"""
    characters = await db.characters.find({}, {"_id": 0}).to_list(100)
    
    if not characters:
        await seed_characters()
        characters = await db.characters.find({}, {"_id": 0}).to_list(100)
    
    return characters

@api_router.post("/characters/equip")
async def equip_character(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Equip an owned character"""
    character_id = data.get("character_id")
    
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
    
    if purchase.character_id in current_user.owned_characters:
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
    
    # Add character to user
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {"owned_characters": purchase["character_id"]}}
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
    """Seed expanded trivia questions with multiple categories"""
    questions = [
        # ========== ANIMALS (20 questions) ==========
        {"question_id": "animal_1", "question": "What is the fastest land animal?", "options": ["Lion", "Cheetah", "Horse", "Gazelle"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_2", "question": "How many legs does an octopus have?", "options": ["6", "8", "10", "12"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_3", "question": "What animal is known as man's best friend?", "options": ["Cat", "Horse", "Dog", "Hamster"], "correct_answer": 2, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_4", "question": "What do pandas mainly eat?", "options": ["Fish", "Bamboo", "Meat", "Berries"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_5", "question": "Which bird cannot fly?", "options": ["Eagle", "Penguin", "Hawk", "Sparrow"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_6", "question": "What is a baby dog called?", "options": ["Kitten", "Cub", "Puppy", "Calf"], "correct_answer": 2, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_7", "question": "Which animal has a hump on its back?", "options": ["Elephant", "Camel", "Horse", "Buffalo"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_8", "question": "What sound does a cow make?", "options": ["Bark", "Meow", "Moo", "Oink"], "correct_answer": 2, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_9", "question": "Which animal is called King of the Jungle?", "options": ["Tiger", "Elephant", "Lion", "Bear"], "correct_answer": 2, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_10", "question": "How many wings does a butterfly have?", "options": ["2", "4", "6", "8"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_11", "question": "What is the largest mammal in the world?", "options": ["Elephant", "Blue Whale", "Giraffe", "Hippo"], "correct_answer": 1, "category": "animals", "difficulty": 2, "xp_reward": 15},
        {"question_id": "animal_12", "question": "Which animal sleeps upside down?", "options": ["Owl", "Bat", "Sloth", "Koala"], "correct_answer": 1, "category": "animals", "difficulty": 2, "xp_reward": 15},
        {"question_id": "animal_13", "question": "What is a group of lions called?", "options": ["Pack", "Herd", "Pride", "Flock"], "correct_answer": 2, "category": "animals", "difficulty": 2, "xp_reward": 15},
        {"question_id": "animal_14", "question": "Which animal has black and white stripes?", "options": ["Tiger", "Zebra", "Leopard", "Cheetah"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_15", "question": "What do you call a baby cat?", "options": ["Puppy", "Cub", "Kitten", "Joey"], "correct_answer": 2, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_16", "question": "Which animal has the longest neck?", "options": ["Camel", "Giraffe", "Ostrich", "Llama"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_17", "question": "What do bees make?", "options": ["Milk", "Honey", "Silk", "Wax only"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        {"question_id": "animal_18", "question": "Which animal changes color to blend in?", "options": ["Frog", "Chameleon", "Lizard", "Snake"], "correct_answer": 1, "category": "animals", "difficulty": 2, "xp_reward": 15},
        {"question_id": "animal_19", "question": "How many eyes does a spider have?", "options": ["2", "4", "6", "8"], "correct_answer": 3, "category": "animals", "difficulty": 2, "xp_reward": 15},
        {"question_id": "animal_20", "question": "Which animal carries its baby in a pouch?", "options": ["Bear", "Kangaroo", "Deer", "Wolf"], "correct_answer": 1, "category": "animals", "difficulty": 1, "xp_reward": 10},
        
        # ========== SPACE (20 questions) ==========
        {"question_id": "space_1", "question": "What planet is known as the Red Planet?", "options": ["Venus", "Mars", "Jupiter", "Saturn"], "correct_answer": 1, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_2", "question": "What is the closest star to Earth?", "options": ["Polaris", "Alpha Centauri", "The Sun", "Sirius"], "correct_answer": 2, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_3", "question": "How many planets are in our solar system?", "options": ["7", "8", "9", "10"], "correct_answer": 1, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_4", "question": "What planet has rings around it?", "options": ["Mars", "Jupiter", "Saturn", "Neptune"], "correct_answer": 2, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_5", "question": "What do we call a person who travels to space?", "options": ["Pilot", "Astronaut", "Navigator", "Captain"], "correct_answer": 1, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_6", "question": "What is Earth's natural satellite called?", "options": ["Sun", "Star", "Moon", "Asteroid"], "correct_answer": 2, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_7", "question": "Which planet is the biggest?", "options": ["Saturn", "Jupiter", "Uranus", "Neptune"], "correct_answer": 1, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_8", "question": "What is the Milky Way?", "options": ["A planet", "A star", "A galaxy", "A moon"], "correct_answer": 2, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_9", "question": "Which planet is closest to the Sun?", "options": ["Venus", "Mercury", "Earth", "Mars"], "correct_answer": 1, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_10", "question": "What shape is Earth?", "options": ["Flat", "Square", "Sphere", "Cube"], "correct_answer": 2, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_11", "question": "How long does it take Earth to orbit the Sun?", "options": ["1 day", "1 week", "1 month", "1 year"], "correct_answer": 3, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_12", "question": "What causes a solar eclipse?", "options": ["Moon blocks Sun", "Earth blocks Sun", "Clouds", "Night time"], "correct_answer": 0, "category": "space", "difficulty": 2, "xp_reward": 15},
        {"question_id": "space_13", "question": "Which planet is known as Earth's twin?", "options": ["Mars", "Venus", "Mercury", "Neptune"], "correct_answer": 1, "category": "space", "difficulty": 2, "xp_reward": 15},
        {"question_id": "space_14", "question": "What is a shooting star actually?", "options": ["A dying star", "A meteor", "A comet", "A satellite"], "correct_answer": 1, "category": "space", "difficulty": 2, "xp_reward": 15},
        {"question_id": "space_15", "question": "What planet is famous for its Great Red Spot?", "options": ["Mars", "Saturn", "Jupiter", "Venus"], "correct_answer": 2, "category": "space", "difficulty": 2, "xp_reward": 15},
        {"question_id": "space_16", "question": "How many moons does Earth have?", "options": ["0", "1", "2", "3"], "correct_answer": 1, "category": "space", "difficulty": 1, "xp_reward": 10},
        {"question_id": "space_17", "question": "What keeps planets orbiting the Sun?", "options": ["Wind", "Gravity", "Magnetism", "Heat"], "correct_answer": 1, "category": "space", "difficulty": 2, "xp_reward": 15},
        {"question_id": "space_18", "question": "Which planet spins on its side?", "options": ["Neptune", "Saturn", "Uranus", "Pluto"], "correct_answer": 2, "category": "space", "difficulty": 3, "xp_reward": 20},
        {"question_id": "space_19", "question": "What is the hottest planet in our solar system?", "options": ["Mercury", "Venus", "Mars", "Jupiter"], "correct_answer": 1, "category": "space", "difficulty": 2, "xp_reward": 15},
        {"question_id": "space_20", "question": "What are Saturn's rings made of?", "options": ["Gas", "Fire", "Ice and rock", "Liquid"], "correct_answer": 2, "category": "space", "difficulty": 2, "xp_reward": 15},
        
        # ========== GEOGRAPHY (20 questions) ==========
        {"question_id": "geo_1", "question": "What is the largest continent?", "options": ["Africa", "Europe", "Asia", "North America"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_2", "question": "What is the capital of France?", "options": ["London", "Berlin", "Paris", "Rome"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_3", "question": "Which ocean is the largest?", "options": ["Atlantic", "Indian", "Pacific", "Arctic"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_4", "question": "What is the longest river in the world?", "options": ["Amazon", "Nile", "Mississippi", "Yangtze"], "correct_answer": 1, "category": "geography", "difficulty": 2, "xp_reward": 15},
        {"question_id": "geo_5", "question": "How many continents are there?", "options": ["5", "6", "7", "8"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_6", "question": "What country is shaped like a boot?", "options": ["Spain", "Greece", "Italy", "France"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_7", "question": "What is the capital of Japan?", "options": ["Beijing", "Seoul", "Tokyo", "Bangkok"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_8", "question": "Which desert is the largest hot desert?", "options": ["Gobi", "Sahara", "Arabian", "Mojave"], "correct_answer": 1, "category": "geography", "difficulty": 2, "xp_reward": 15},
        {"question_id": "geo_9", "question": "What is the smallest country in the world?", "options": ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], "correct_answer": 1, "category": "geography", "difficulty": 2, "xp_reward": 15},
        {"question_id": "geo_10", "question": "What mountain is the tallest?", "options": ["K2", "Kilimanjaro", "Mount Everest", "Denali"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_11", "question": "Which country has the most people?", "options": ["USA", "India", "China", "Russia"], "correct_answer": 2, "category": "geography", "difficulty": 2, "xp_reward": 15},
        {"question_id": "geo_12", "question": "What is the capital of Australia?", "options": ["Sydney", "Melbourne", "Canberra", "Perth"], "correct_answer": 2, "category": "geography", "difficulty": 2, "xp_reward": 15},
        {"question_id": "geo_13", "question": "Which river flows through Egypt?", "options": ["Amazon", "Nile", "Thames", "Ganges"], "correct_answer": 1, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_14", "question": "What is the capital of the United States?", "options": ["New York", "Los Angeles", "Washington D.C.", "Chicago"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_15", "question": "Which continent is the coldest?", "options": ["Europe", "Asia", "Antarctica", "North America"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_16", "question": "What country is known for kangaroos?", "options": ["New Zealand", "Australia", "South Africa", "India"], "correct_answer": 1, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_17", "question": "What ocean is between USA and Europe?", "options": ["Pacific", "Indian", "Atlantic", "Arctic"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_18", "question": "What is the largest island in the world?", "options": ["Madagascar", "Great Britain", "Greenland", "Iceland"], "correct_answer": 2, "category": "geography", "difficulty": 2, "xp_reward": 15},
        {"question_id": "geo_19", "question": "What country has the Great Wall?", "options": ["Japan", "India", "China", "Korea"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        {"question_id": "geo_20", "question": "Which country has maple leaf on its flag?", "options": ["USA", "UK", "Canada", "Australia"], "correct_answer": 2, "category": "geography", "difficulty": 1, "xp_reward": 10},
        
        # ========== MUSIC (20 questions) ==========
        {"question_id": "music_1", "question": "How many keys does a standard piano have?", "options": ["52", "66", "88", "100"], "correct_answer": 2, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_2", "question": "What instrument has strings and you strum it?", "options": ["Piano", "Drums", "Guitar", "Flute"], "correct_answer": 2, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_3", "question": "What do you call a group of singers?", "options": ["Band", "Orchestra", "Choir", "Duo"], "correct_answer": 2, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_4", "question": "Which instrument do you blow into?", "options": ["Violin", "Drums", "Flute", "Guitar"], "correct_answer": 2, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_5", "question": "What does 'forte' mean in music?", "options": ["Soft", "Loud", "Fast", "Slow"], "correct_answer": 1, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_6", "question": "How many strings does a violin have?", "options": ["3", "4", "5", "6"], "correct_answer": 1, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_7", "question": "What instrument is Mickey Mouse known for?", "options": ["Piano", "Drums", "Saxophone", "Guitar"], "correct_answer": 0, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_8", "question": "What is the lowest singing voice type?", "options": ["Soprano", "Alto", "Tenor", "Bass"], "correct_answer": 3, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_9", "question": "What color are piano's sharp keys?", "options": ["White", "Black", "Red", "Brown"], "correct_answer": 1, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_10", "question": "What do you hit drums with?", "options": ["Fingers", "Sticks", "Bow", "Pick"], "correct_answer": 1, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_11", "question": "What is a song with no instruments called?", "options": ["Solo", "A cappella", "Instrumental", "Duet"], "correct_answer": 1, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_12", "question": "How many notes are in a musical scale?", "options": ["5", "6", "7", "8"], "correct_answer": 2, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_13", "question": "What instrument is SpongeBob's friend Patrick associated with?", "options": ["Guitar", "Mayonnaise", "Piano", "Drums"], "correct_answer": 1, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_14", "question": "What country is K-Pop from?", "options": ["Japan", "China", "South Korea", "Thailand"], "correct_answer": 2, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_15", "question": "What is a musical play called?", "options": ["Concert", "Opera", "Musical", "Recital"], "correct_answer": 2, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_16", "question": "Which instrument is biggest in an orchestra?", "options": ["Cello", "Tuba", "Harp", "Double Bass"], "correct_answer": 1, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_17", "question": "What do we call the speed of music?", "options": ["Volume", "Pitch", "Tempo", "Beat"], "correct_answer": 2, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_18", "question": "What is the first note in 'Do Re Mi'?", "options": ["Re", "Mi", "Do", "Fa"], "correct_answer": 2, "category": "music", "difficulty": 1, "xp_reward": 10},
        {"question_id": "music_19", "question": "What pop star is known as the 'Queen of Pop'?", "options": ["Beyoncé", "Madonna", "Lady Gaga", "Rihanna"], "correct_answer": 1, "category": "music", "difficulty": 2, "xp_reward": 15},
        {"question_id": "music_20", "question": "What instrument does a DJ use?", "options": ["Guitar", "Turntables", "Violin", "Trumpet"], "correct_answer": 1, "category": "music", "difficulty": 1, "xp_reward": 10},
        
        # ========== WEIRD FACTS (20 questions) ==========
        {"question_id": "weird_1", "question": "What is the only food that never spoils?", "options": ["Rice", "Honey", "Salt", "Sugar"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_2", "question": "How many noses does a slug have?", "options": ["1", "2", "4", "None"], "correct_answer": 2, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_3", "question": "What animal can sleep for 3 years?", "options": ["Bear", "Snail", "Bat", "Cat"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_4", "question": "Which fruit floats on water?", "options": ["Grape", "Banana", "Cranberry", "Cherry"], "correct_answer": 2, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_5", "question": "What is the only mammal that can fly?", "options": ["Flying squirrel", "Bat", "Sugar glider", "Lemur"], "correct_answer": 1, "category": "weird_facts", "difficulty": 1, "xp_reward": 10},
        {"question_id": "weird_6", "question": "How long is a goldfish's memory?", "options": ["3 seconds", "3 months", "1 week", "1 day"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_7", "question": "Which animal has blue blood?", "options": ["Octopus", "Shark", "Whale", "Dolphin"], "correct_answer": 0, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_8", "question": "What is a group of flamingos called?", "options": ["Flock", "Flamboyance", "Herd", "Pack"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_9", "question": "Which planet rains diamonds?", "options": ["Mars", "Jupiter", "Neptune", "Venus"], "correct_answer": 2, "category": "weird_facts", "difficulty": 3, "xp_reward": 20},
        {"question_id": "weird_10", "question": "How many hearts does an octopus have?", "options": ["1", "2", "3", "4"], "correct_answer": 2, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_11", "question": "What color is a polar bear's skin?", "options": ["White", "Pink", "Black", "Gray"], "correct_answer": 2, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_12", "question": "Which animal has fingerprints like humans?", "options": ["Monkey", "Koala", "Dog", "Raccoon"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_13", "question": "What is the fear of long words called?", "options": ["Longophobia", "Hippopotomonstro...", "Verbophobia", "Wordophobia"], "correct_answer": 1, "category": "weird_facts", "difficulty": 3, "xp_reward": 20},
        {"question_id": "weird_14", "question": "How many teeth do adult humans have?", "options": ["28", "30", "32", "36"], "correct_answer": 2, "category": "weird_facts", "difficulty": 1, "xp_reward": 10},
        {"question_id": "weird_15", "question": "Which animal never sleeps?", "options": ["Shark", "Bullfrog", "Owl", "Ant"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_16", "question": "What is the strongest muscle in your body?", "options": ["Heart", "Jaw", "Leg", "Arm"], "correct_answer": 1, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_17", "question": "Which animal can't stick its tongue out?", "options": ["Dog", "Cat", "Crocodile", "Snake"], "correct_answer": 2, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_18", "question": "What is the dot over i and j called?", "options": ["Point", "Tittle", "Dot", "Speck"], "correct_answer": 1, "category": "weird_facts", "difficulty": 3, "xp_reward": 20},
        {"question_id": "weird_19", "question": "Which animal has the longest lifespan?", "options": ["Elephant", "Whale", "Tortoise", "Parrot"], "correct_answer": 2, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        {"question_id": "weird_20", "question": "How many bones do sharks have?", "options": ["0", "100", "206", "50"], "correct_answer": 0, "category": "weird_facts", "difficulty": 2, "xp_reward": 15},
        
        # ========== GENERAL/ORIGINAL QUESTIONS (kept for variety) ==========
        {"question_id": "gen_1", "question": "What color do you get mixing red and blue?", "options": ["Green", "Purple", "Orange", "Brown"], "correct_answer": 1, "category": "general", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_2", "question": "How many days are in a week?", "options": ["5", "6", "7", "8"], "correct_answer": 2, "category": "general", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_3", "question": "What is H2O commonly known as?", "options": ["Oxygen", "Hydrogen", "Water", "Carbon"], "correct_answer": 2, "category": "general", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_4", "question": "What is the largest organ in the human body?", "options": ["Heart", "Liver", "Brain", "Skin"], "correct_answer": 3, "category": "general", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_5", "question": "Who was the first President of the USA?", "options": ["Lincoln", "Jefferson", "Washington", "Adams"], "correct_answer": 2, "category": "history", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_6", "question": "What color is Pikachu?", "options": ["Red", "Blue", "Yellow", "Green"], "correct_answer": 2, "category": "pop_culture", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_7", "question": "In Finding Nemo, what type of fish is Nemo?", "options": ["Goldfish", "Clownfish", "Betta", "Guppy"], "correct_answer": 1, "category": "pop_culture", "difficulty": 1, "xp_reward": 10},
        {"question_id": "gen_8", "question": "What is the chemical symbol for gold?", "options": ["Go", "Gd", "Au", "Ag"], "correct_answer": 2, "category": "science", "difficulty": 2, "xp_reward": 15},
        {"question_id": "gen_9", "question": "Who wrote 'Romeo and Juliet'?", "options": ["Dickens", "Shakespeare", "Twain", "Austen"], "correct_answer": 1, "category": "general", "difficulty": 2, "xp_reward": 15},
        {"question_id": "gen_10", "question": "What is the powerhouse of the cell?", "options": ["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"], "correct_answer": 2, "category": "science", "difficulty": 3, "xp_reward": 20},
    ]
    
    for q in questions:
        await db.questions.update_one(
            {"question_id": q["question_id"]},
            {"$set": q},
            upsert=True
        )

async def seed_characters():
    """Seed initial characters"""
    characters = [
        # Free starter
        {"character_id": "basic_kite", "name": "Basic Kite", "description": "A classic diamond kite to start your journey!", "price": 0, "category": "cute_kite", "image_url": "kite_basic", "unlock_level": 0},
        
        # Cute Kites
        {"character_id": "rainbow_kite", "name": "Rainbow Kite", "description": "A colorful rainbow kite that sparkles in the sky!", "price": 2.99, "category": "cute_kite", "image_url": "kite_rainbow", "unlock_level": 2},
        {"character_id": "star_kite", "name": "Star Kite", "description": "A star-shaped kite that glows at night!", "price": 4.99, "category": "cute_kite", "image_url": "kite_star", "unlock_level": 3},
        {"character_id": "heart_kite", "name": "Heart Kite", "description": "A lovely heart-shaped kite full of love!", "price": 3.99, "category": "cute_kite", "image_url": "kite_heart", "unlock_level": 2},
        {"character_id": "cloud_kite", "name": "Cloud Kite", "description": "A fluffy cloud kite that floats among the clouds!", "price": 5.99, "category": "cute_kite", "image_url": "kite_cloud", "unlock_level": 4},
        
        # Animal Kites
        {"character_id": "butterfly_kite", "name": "Butterfly Kite", "description": "A beautiful butterfly kite with colorful wings!", "price": 3.99, "category": "animal_kite", "image_url": "kite_butterfly", "unlock_level": 2},
        {"character_id": "dragon_kite", "name": "Dragon Kite", "description": "A fierce dragon kite that breathes wind!", "price": 6.99, "category": "animal_kite", "image_url": "kite_dragon", "unlock_level": 5},
        {"character_id": "owl_kite", "name": "Owl Kite", "description": "A wise owl kite with big eyes!", "price": 4.99, "category": "animal_kite", "image_url": "kite_owl", "unlock_level": 3},
        {"character_id": "fish_kite", "name": "Fish Kite", "description": "A swimming fish kite that rides the wind currents!", "price": 3.49, "category": "animal_kite", "image_url": "kite_fish", "unlock_level": 2},
        {"character_id": "eagle_kite", "name": "Eagle Kite", "description": "A majestic eagle kite soaring high!", "price": 7.99, "category": "animal_kite", "image_url": "kite_eagle", "unlock_level": 6},
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
