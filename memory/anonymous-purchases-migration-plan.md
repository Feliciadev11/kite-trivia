# Migration plan: purchases without an account (Apple 5.1.1(v))

Status: **plan only, nothing implemented**. Written against `origin/main` @ `82239e5`.
Audit this plan is based on: see chat history for the file-by-file auth/purchase/entitlement
audit (`backend/server.py`, `frontend/src/lib/purchases.js`, `PremiumContext.jsx`, `Play.jsx`,
`Shop.jsx`, `Profile.jsx`).

## Decision: RevenueCat owns the anonymous identity; backend adopts it

Two designs were considered:

- **A — pure RevenueCat anonymous mode.** `Purchases.configure({apiKey})` with no `appUserID`;
  RevenueCat auto-generates `$RCAnonymousID:...`. Nothing on our backend until real registration.
- **B — backend-issued shadow account from first boot.** Backend mints a `user_id` immediately,
  RevenueCat is configured with it as `appUserID` from the start.

**Chosen: a synthesis of both.** RevenueCat generates its own true anonymous ID client-side
first (Option A's mechanism); the backend then creates a row *using that same ID* as its
`user_id` (Option B's persistence). This matters for one concrete reason: `Purchases.logIn()`
only auto-merges entitlements when logging in to an ID that was **never previously identified**.
If the backend pre-invents the ID (original Option B), that specific guarantee isn't really
being exercised. If RevenueCat generates it, the eventual `logIn(realUserId)` at registration is
a genuine anonymous → never-before-identified transition — the one case RevenueCat's own docs
guarantee merges correctly.

### Why a backend row is needed at all (not just for purchases)

`GET /api/questions` (the free-round gate), `/api/characters/claim` (free-item grants), and
`/api/characters/equip` (ownership checks) are **already** `Depends(get_current_user)` today,
for players who've never paid anything. The code's own comments are explicit about why:
"the server enforces the gate independently of client trust." Moving any of that to
client-local storage for anonymous users would be a real regression to the app's existing
anti-cheat posture — it has nothing to do with purchases specifically. So some backend-side,
durable state for anonymous users is required regardless of which purchase-identity design is
chosen.

### Why the row ends up nearly as big as a full `User` row

A "minimal" anonymous record still needs: round count + last-round-date (free-tier gate),
premium bypass state (a paying anonymous subscriber shouldn't be limited to 3 rounds/day either),
level/XP (losing progress every relaunch is a worse product than today), and owned items. That's
nearly every field on the current `User` model **except** the credential/identity fields —
`email`, `password_hash`, `name`, `picture`. The row is unavoidable; what's avoidable is putting
identity fields on it before there's an identity.

## Where `owned_characters` / `owned_sky_themes` live

**Unchanged — on the `User` document, same as today.** No parallel storage, no client-side
derivation from `customerInfo.nonSubscriptionTransactions`. The only change is *when* the
document is created (first boot, via the anonymous flow) rather than *at registration*. Every
existing endpoint (`/characters/equip`, `/claim`, `/purchase/sync`, `/sky/seasonal/claim`,
`/characters/gates`, the round gate on `/questions`) keeps working unchanged, because they all
already just read/write fields on whatever `User` document `current_user.user_id` resolves to.

## Phased plan

**Phase 0 — Backend groundwork**
- `User` model: add `is_anonymous: bool = False`.
- `email: str` is currently **required** with no default — an anonymous row can't construct a
  valid `User` without one. Needs a decision before Phase 1 lands: make `email: Optional[str] =
  None`, or is a synthesized placeholder acceptable. Flagging this as an open item — it blocks
  Phase 1, wasn't part of the original ask, and shouldn't be decided implicitly by a test seed.
- New `POST /auth/anonymous`: takes a client-generated (RevenueCat) anonymous ID, creates the
  `User` doc keyed on it (`is_anonymous=True`, no `password_hash`), issues the same
  `session_token` cookie flow as `/auth/register` today.
- `/auth/account/delete`: scoped password-check change — see below, own section, own test.

**Phase 1 — Client boot sequencing** (highest risk to existing users — see below)
1. Check for an existing persisted session first (Keychain-backed token, existing fallback).
2. Found → today's path, unchanged: `initPurchases(existingUserId)`.
3. Not found → `Purchases.configure({apiKey})` (no appUserID, true RevenueCat anonymous), read
   the resulting anonymous ID, call `POST /auth/anonymous` with it, persist the returned session.
4. **No `/premium/sync` or purchase call fires until this resolution is fully settled.** This is
   the guard against the boot-order race described in risk 1.

**Phase 2 — Registration = "claim," not "create"**
- Same-device (the common case): `/auth/register` gets an "upgrade in place" mode — attach
  `email`/`password_hash` to the *existing* anonymous `user_id` rather than minting a new one.
  RevenueCat `appUserID` never changes. **No `logIn()` call needed for this path** — there's
  nothing to alias, the ID was never anonymous-and-then-abandoned, it's continuously the same ID.
- Cross-device (user already has a real account, logs into it on a device with its own local
  anonymous identity): `/auth/login` returns the real `user_id`; client calls
  `Purchases.logIn(realUserId)`, then re-runs `restorePurchases()` /
  `_syncRestoredItemPurchases`. See risk 3 for what this does and doesn't cover.

**Phase 3 — Ownership/gates.** No changes (see "Where ownership lives" above).

**Phase 4 — Frontend UX.** Landing page's primary CTA routes into gameplay directly (triggering
Phase 1), instead of forcing `/login`/`/signup` first. Add an optional, low-friction "save your
progress" prompt (post-purchase, or from Profile) instead of gating entry.

**Phase 5 — Rollout safety.** Native-only (web already degrades gracefully — RevenueCat SDK is
native-only per `purchases.js`). Log every anonymous→real conversion and every `logIn()` onto an
already-identified target, for post-launch monitoring. Explicit test: an existing logged-in
premium subscriber relaunches the new build — `/premium/status` must report `is_premium: true`
immediately, no transient blip, before this ships.

## What could break for existing paying users

1. **Boot-order race (the one that matters most).** Existing subscribers already have
   `appUserID == their real backend user_id` — fine by default. The risk is entirely in Phase 1's
   sequencing: if the anonymous-first path runs before the existing-session check completes, and
   `/premium/sync` fires during that window, it pushes whatever RevenueCat reports for the
   *wrong* (momentarily anonymous) identity into the DB — for a real subscriber that looks like
   "no entitlement," flipping `is_premium` to `false` for a paying user. Mitigated by the
   readiness guard in Phase 1, but needs explicit test coverage before rollout, not just code
   review.
2. **Restore-purchases assumes a backend session today.** `_syncRestoredItemPurchases` reads
   `user?.owned_characters` and posts to `/characters/purchase/sync` with `withCredentials`. If
   invoked before Phase 1's anonymous session exists, it 401s. Same readiness guard covers it.
3. **Cross-device purchase orphaning.** `Purchases.logIn()` only auto-merges entitlements
   anonymous → never-before-identified. Identified → already-identified does **not** auto-merge.
   This is a property of RevenueCat's own semantics, not something either backend-schema design
   (A or B) changes — I initially implied choosing "no shadow rows" would shrink this risk; it
   doesn't. It only affects the narrower case of buying on a device *before* logging into a
   *pre-existing, different* account there. Needs an explicit support/reconciliation path, not a
   schema fix.
4. **Anonymous row buildup.** Real, but mitigated by retention, not by schema size: TTL-expire
   `is_anonymous: true` rows with zero entries in `purchase_transactions` after N days of
   inactivity. Needs a scheduled cleanup job (Mongo TTL indexes can't condition across
   collections directly) — not built as part of this plan, called out as a dependency.
5. **Account deletion regression risk.** The password-check relaxation (below) must not
   accidentally weaken deletion auth for real accounts — see the scoped change and its test.
6. **Webhook path is unaffected.** `/premium/webhook`'s `_grant_purchase` keys on whatever
   `app_user_id` the RevenueCat event carries — that'll be the anonymous-then-adopted `user_id`,
   which is a real row in `users`. No change needed there.

## Account deletion — full scope, not just the password-check bug

The password-check fix below is necessary but not sufficient — it only stops the endpoint from
500ing for anonymous accounts. What deletion actually *means* for an anonymous account needs to
be explicit:

- **What it does, same as today for real accounts**: hard-deletes the `users` row, all
  `user_sessions` rows, all `password_resets` rows for that `user_id`. `purchase_transactions` is
  deliberately **not** touched — same audit-trail carve-out that already applies to real accounts
  (see the existing docstring on `delete_account`). This doesn't change for anonymous accounts;
  it shouldn't.
- **What it does NOT do, and can't**: RevenueCat's own customer/transaction record for that
  anonymous ID is untouched. Deleting our `users` row doesn't un-purchase anything, doesn't touch
  App Store/Play Store records, and doesn't revoke the entitlement RevenueCat still associates
  with that anonymous ID. This is correct (deletion should not be a way to fraudulently re-trigger
  "restore" logic elsewhere), but it has a concrete consequence: if the same device later calls
  `POST /auth/anonymous` again — reinstall, or any flow that re-establishes an anonymous session
  using the *same* still-locally-cached RevenueCat anonymous ID — `/premium/sync` and
  `/characters/purchase/sync` will re-derive entitlements from RevenueCat and can re-grant
  previously-owned items into the **new** row. That's very likely the right behavior (they did
  buy it), but it's a real product decision, not an accidental side effect, and should be called
  out as such rather than discovered later.
- **Test scope, accordingly**: the regression tests below verify full deletion side effects
  (`users`, `user_sessions` rows actually gone — not just a 200 status code) for both the real-account
  and anonymous-account paths, so the two stay in parity except for the password step itself.

## Phase 0, scoped: `/auth/account/delete` password-check change

Current (`backend/server.py`, `delete_account`):

```python
user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
if not user_doc or not verify_password(payload.password, user_doc.get("password_hash", "")):
    raise HTTPException(status_code=401, detail="Incorrect password")
```

Problem: an anonymous row has no `password_hash`. Today this doesn't just fail closed with 401 —
`bcrypt.checkpw(..., "".encode())` raises on a malformed/empty hash, so it'd 500, not 401.

Scoped change — **implemented and verified** (see Status below):

```python
user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
if not user_doc:
    raise HTTPException(status_code=401, detail="Incorrect password")

# Gated purely on whether a password_hash actually exists to check against - never
# on is_anonymous. Any account that has a password_hash set, anonymous-flagged or
# not, must still supply the correct password. Only an account with no password_hash
# at all (e.g. one that never had credentials set) has nothing to verify, so it
# can't be put through verify_password() without that raising (bcrypt.checkpw
# errors on an empty/missing hash rather than returning False).
password_hash = user_doc.get("password_hash")
if password_hash:
    if not payload.password or not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")
```

Note this superseded an earlier draft of this fix that gated on `is_anonymous AND no
password_hash` — that version still crashed for the (shouldn't-happen-but-possible) case of a
non-anonymous account somehow missing its `password_hash`. Gating on hash-presence alone covers
that case too, without weakening the check for any account that does have one.

Everything below this (the actual delete + session/reset cleanup + cookie clear) is unchanged.

Regression test: `backend/tests/test_anonymous_account_deletion.py` (see repo; the anonymous-user
tests seed the DB directly, matching the existing pattern in `test_kite_trivia.py` for state the
API doesn't expose, since `POST /auth/anonymous` — Phase 1 — doesn't exist yet).

**Status: verified 4/4 passing** against a local backend + isolated MongoDB instance (not the
shared/production database) after the scoped change above was applied. Before the change, 3 of
the 4 passed (the regression guards) and `test_anonymous_account_deletes_without_password` failed
with a 500 (`bcrypt.checkpw` raising on the empty hash) — confirmed live, not just reasoned about,
matching the traceback at `server.py`'s prior `delete_account` implementation exactly.

## Open items not resolved by this plan

- `email: Optional[str]` model change (blocks Phase 1) — needs an explicit decision, not an
  implicit one made by a test seed or by Phase 0 code.
- The anonymous-row retention/cleanup job (risk 4) — not designed here, just flagged as required.
- The cross-device orphaning support flow (risk 3) — not designed here, just flagged as required.
