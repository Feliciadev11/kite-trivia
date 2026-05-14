# Test Credentials — Kite Trivia App

## Auth Strategy
- JWT cookie-based auth via session_token (httpOnly, secure, samesite=none)
- Emergent Google OAuth available via `/auth/session`
- Forgot-password flow (in-app display) at `/forgot-password`

## Test Accounts
No seeded admin/test account. Tests create ephemeral users via the register endpoint.

Pattern used by automated tests:
- Email: `TEST_kite_<random>@example.com`
- Password: `DreamySky123!`
- Name: `Test User`

## Auth Endpoints
- `POST /api/auth/register` — Create account; sets `session_token` cookie
- `POST /api/auth/login` — Email/password login; sets `session_token` cookie
- `POST /api/auth/session` — Exchange Emergent OAuth `session_id`
- `GET /api/auth/me` — Get current user (cookie required)
- `POST /api/auth/logout` — Clear session
- `POST /api/auth/forgot-password` — Body: `{"email": "..."}`. Returns `{message, code, expires_in_seconds}`. Code is `null` if email not registered; UI shows generic copy in that case.
- `POST /api/auth/reset-password` — Body: `{"email": "...", "code": "123456", "new_password": "..."}`. Password ≥ 6 chars. Single-use code, expires in 15 min.

## Forgot Password — How to test
1. Register: `POST /api/auth/register` with `{email, password, name}`
2. Request code: `POST /api/auth/forgot-password` with `{email}` — copy the returned `code`
3. Reset: `POST /api/auth/reset-password` with `{email, code, new_password}`
4. Login with new password to verify
5. Confirm code reuse returns 400 "Invalid or expired code"
