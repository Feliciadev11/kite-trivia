# Kite Trivia App - Product Requirements Document

## Original Problem Statement
Build a trivia app called Kite with:
- Floating kite animation on loading
- In-app purchases for characters (via CashApp fabfeliciaxo)
- Weekly leaderboard
- 5th grade level questions to start
- Both JWT auth and Google OAuth login
- Light/clean, dreamy sky theme — never arcade-like

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Framer Motion + Shadcn UI
- **Backend**: FastAPI (Python) with async MongoDB (Motor)
- **Database**: MongoDB (test_database)
- **Auth**: JWT sessions (cookie-based) + Emergent Google OAuth

## User Personas
1. **Casual Player**: Quick, calming trivia sessions
2. **Collector**: Motivated by unlocking kites, companions, sky themes
3. **Competitor**: Aims for the weekly leaderboard

## Core Requirements (Static)
- [x] Authentication (JWT + Google OAuth)
- [x] Account persistence
- [x] Trivia gameplay with XP/leveling
- [x] Character unlock system with level gates
- [x] Weekly leaderboard
- [x] CashApp payment (manual verification)
- [x] 5th grade starting difficulty
- [x] Ambient music + sound effects with user controls
- [x] Calm, dreamy, non-arcade visual identity

## Feature Status

| Feature | Status |
|---------|--------|
| Authentication (JWT + Google) | Working |
| Account / XP / Level | Working |
| Leaderboard + my-rank | Working |
| Character unlock + equip | Working |
| Daily rewards + streak | Working |
| Question randomization (505 Qs) | Working |
| Ambient music + 3 tracks | Working |
| Sound effects (WebAudio chimes) | Working |
| Settings page (persistent) | Working |
| Gentle answer-feedback palette | Working |
| Shop / CashApp purchase | Manual verification |

## What's Been Implemented

### v1.0 — MVP
- Auth (JWT + Google OAuth)
- 20 trivia questions
- 10 starter characters
- Leaderboard, profile, CashApp purchase flow

### v1.1 — Audit & Improvements
- 110+ new questions, daily rewards, streak tracking, randomization, answer feedback animations

### v1.2 — Atmospheric Enhancement
- Ambient audio system + 3 royalty-free tracks
- Atmospheric background (clouds, particles, wind lines, 12 sky themes)
- Expanded marketplace: 20 kites, 11 companions, 12 sky themes (rarity tiers)
- 220 total questions across 15 categories

### v1.3 — Depth & Calm Settings (Feb 2026)
- **505 trivia questions** across 12 categories (animals, nature, travel, art, science, pop_culture, history, whimsical, general, space, music, movies)
- Backend refactor: inline 230-line seed list extracted to `/app/backend/questions_db.py`; `seed_questions()` is now 6 lines
- **New Settings page** (`/settings`) with:
  - Ambient music on/off toggle (persisted)
  - Volume slider with soft cap (persisted)
  - Three ambient tracks: Serene Sky, Sleepy Clouds, Dream Drift (persisted)
  - Sound-effects toggle + preview buttons (persisted)
- **Gentle sound effects** generated with WebAudio (no external assets): soft major-triad chime for correct, calm minor-second descent for incorrect, magical chime for level-up/reward
- **Polished Play feedback**: emerald glow on correct answer, amber tone on incorrect (no harsh red/green)
- LocalStorage persistence: `kite_audio_isPlaying`, `kite_audio_volume`, `kite_audio_track`, `kite_audio_sfx`
- Dashboard nav now has gear icon → Settings

### v1.4 — Forgot Password Flow (Feb 2026 — current)
- "Forgot your password?" link added to the Login (home) screen
- New `/forgot-password` 2-step page (calm sky aesthetic, glass card):
  - Step 1: enter email → backend generates a 6-digit code
  - Step 2: code is displayed in a gradient card with copy button → user enters code + new password
- Backend endpoints `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`
- Security: codes bcrypt-hashed at rest, single-use, 15-min expiry, max 3 active codes per email, generic responses on unknown email (no enumeration), all sessions invalidated on successful reset
- Email casing normalized to lowercase on register / login / OAuth session so reset works regardless of input casing
- 23/23 backend pytest pass; full frontend E2E pass; aesthetic remains calm and dreamy

## Database Collections
- `users`: accounts + game stats + ownership
- `user_sessions`: 7-day cookie sessions
- `questions`: **505** trivia questions
- `characters`: 43 marketplace items
- `purchases`: purchase records (manual confirmation)

## Prioritized Backlog

### P0 (Critical — Before Beta)
- [ ] Admin panel for purchase verification
- [ ] Email confirmation for purchases

### P1 (Important)
- [ ] Push notifications for daily rewards
- [ ] More categories (Sports, Food, Mythology)
- [ ] Difficulty curve refinement

### P2 (Nice to Have)
- [ ] Multiplayer / friends list
- [ ] Achievement badges
- [ ] Seasonal sky themes (autumn, winter)

## Key Files
- `/app/backend/server.py` — FastAPI app, all routes
- `/app/backend/questions_db.py` — 505 questions
- `/app/backend/tests/test_kite_trivia.py` — pytest regression (16 tests)
- `/app/frontend/src/contexts/AudioContext.jsx` — audio + SFX state, localStorage persistence
- `/app/frontend/src/pages/Settings.jsx` — calming settings page
- `/app/frontend/src/pages/Play.jsx` — dreamy feedback palette
- `/app/frontend/src/pages/Dashboard.jsx` — nav with Settings

## Testing
- Backend: 16/16 pytest (auth, questions variety, answers, leaderboard, characters, daily reward, profile)
- Frontend: All data-testids verified; persistence across reload confirmed; gentle palette confirmed

## Next Action Items
1. Build admin panel for CashApp purchase verification (P0)
2. Add push notification scaffolding for daily rewards (P1)
3. Difficulty curve refinement based on player level (P1)
