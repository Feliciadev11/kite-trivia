# Kite Trivia App - Product Requirements Document

## Original Problem Statement
Build a trivia app called Kite with:
- Floating kite animation on loading
- In-app purchases for characters (via CashApp fabfeliciaxo)
- Weekly leaderboard
- 5th grade level questions to start
- Both JWT auth and Google OAuth login
- Light/clean sky theme

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI (Python) with async MongoDB (Motor)
- **Database**: MongoDB (test_database)
- **Auth**: JWT sessions (cookie-based) + Emergent Google OAuth

## User Personas
1. **Casual Player**: Wants quick, fun trivia sessions
2. **Collector**: Motivated by unlocking characters
3. **Competitor**: Aims for leaderboard rankings

## Core Requirements (Static)
- [x] Authentication (JWT + Google OAuth)
- [x] Account persistence
- [x] Trivia gameplay with XP/leveling
- [x] Character unlock system with level gates
- [x] Weekly leaderboard
- [x] CashApp payment integration (manual)
- [x] 5th grade starting difficulty

## What's Been Implemented

### v1.0 - MVP (Initial Build)
- Full authentication system (JWT + Google OAuth)
- 20 trivia questions (General, Science, History, Pop Culture)
- 10 characters (5 cute kites, 5 animal kites)
- Leaderboard with rankings
- User profiles with stats
- CashApp purchase flow

### v1.1 - Audit & Improvements (Current)
- **110 NEW questions** across 5 categories:
  - Animals (20 questions)
  - Space (20 questions)
  - Geography (20 questions)
  - Music (20 questions)
  - Weird Facts (20 questions)
  - Plus original 10 questions
- **Daily Reward System**:
  - Login streak tracking
  - Base 25 XP + streak bonus (up to 35 XP)
  - Milestone rewards at 7, 14, 30 days
- **Question Randomization**: Using MongoDB $sample aggregation
- **UI Polish**:
  - Answer feedback animations
  - Daily reward banner on dashboard
  - Streak counter display

## Feature Status

| Feature | Status |
|---------|--------|
| Authentication | ✅ Fully Working |
| Account Persistence | ✅ Fully Working |
| XP Saving | ✅ Fully Working |
| Level Progression | ✅ Fully Working |
| Leaderboard | ✅ Fully Working |
| Character Unlock System | ✅ Fully Working |
| Question Randomization | ✅ Fully Working |
| Daily Rewards | ✅ Fully Working |
| Shop Purchase (CashApp) | ⚠️ Manual Verification Required |

## Prioritized Backlog

### P0 (Critical - Before Beta)
- [ ] Admin panel for purchase verification
- [ ] Email confirmation for purchases

### P1 (Important)
- [ ] More question categories (Movies, Sports, Food)
- [ ] Difficulty progression within levels
- [ ] Sound effects (optional toggle)

### P2 (Nice to Have)
- [ ] Multiplayer mode
- [ ] Friends list
- [ ] Achievement badges
- [ ] Seasonal events

## Database Collections
- `users`: User accounts with game stats
- `user_sessions`: Auth sessions (7-day expiry)
- `questions`: 130 trivia questions
- `characters`: 10 kite characters
- `purchases`: Purchase records

## Next Tasks
1. Add admin endpoint for purchase confirmation
2. Add more question categories
3. Consider push notifications for daily rewards
