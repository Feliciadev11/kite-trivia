# Migration plan: purchases without an account (Apple 5.1.1(v))

Status: **plan only, nothing implemented**. Written against `origin/main` @ `82239e5`.
Audit this plan is based on: see chat history for the file-by-file auth/purchase/entitlement
audit (`backend/server.py`, `frontend/src/lib/purchases.js`, `PremiumContext.jsx`, `Play.jsx`,
`Shop.jsx`, `Profile.jsx`).

## Decision: backend mints the anonymous identity (reversed from an earlier draft — see below)

Two designs were considered:

- **A — pure RevenueCat anonymous mode.** `Purchases.configure({apiKey})` with no `appUserID`;
  RevenueCat auto-generates `$RCAnonymousID:...`. Nothing on our backend until real registration.
- **B — backend-issued shadow account from first boot.** Backend mints a `user_id` immediately,
  RevenueCat is configured with it as `appUserID` from the start.

**Originally chosen: a synthesis of both** — RevenueCat mints its own anonymous ID first, backend
adopts it. **Reversed during implementation, back to plain Option B (backend mints).** Walking
the "RevenueCat mints first" design through the actual provider structure in `App.js` requires
`AuthProvider` to depend on a RevenueCat call completing inside `PremiumProvider` — a reverse
dependency the current architecture doesn't have and shouldn't grow just for this. The thing that
design bought — `Purchases.logIn()` auto-merging cleanly because the ID was never previously
identified — only actually mattered for the cross-device edge case (see risk 3 below), which
needs a support-flow regardless of which option mints the ID; it isn't schema-dependent. So the
reversal costs nothing functionally and removes an architectural complication. **Current design:
backend mints `user_id` for `POST /auth/anonymous` exactly like `/auth/register` does today; that
`user_id` is what gets passed to `initPurchases()`.** See the scoped section below.

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
  valid `User` without one. **Decided**: `email: Optional[str] = None`. Verify nothing downstream
  assumes `user.email` is always a non-null string before landing this (password-reset flows only
  apply to accounts that have one, so this looks safe on inspection, but check, don't assume).
- New `POST /auth/anonymous`: backend mints its own `user_id` (same format as `/auth/register`),
  creates the `User` doc (`is_anonymous=True`, no `password_hash`, no `email`), issues the same
  `session_token` cookie + Bearer-fallback-in-body flow as `/auth/register` today. See the scoped
  section below for the full design, the `checkAuth()` client change, and the routing-layer answer.
- `/auth/account/delete`: scoped password-check change — **done** (see below, own section, own
  test, verified 4/4).

**Phase 1 — Client boot sequencing** (highest risk to existing users — see below) — **done**,
committed. Implemented as: `bootPremium()` (`frontend/src/lib/premiumBoot.js`) proceeds once
`authLoading` (AuthProvider's own `/auth/me` resolution) is `false`, then calls
`initPurchases(userId)` if `userId` (i.e. `user?.user_id`) is present, or `initPurchases(undefined)`
(true RevenueCat anonymous mode) if not. This shipped *before* `POST /auth/anonymous` existed, so
right now the anonymous branch is what actually fires for a sessionless device — once
`POST /auth/anonymous` lands (this document's next section), `checkAuth()` will populate `user`
for every device, real or anonymous, and `initPurchases(undefined)` becomes a rare fallback (only
if `POST /auth/anonymous` itself fails) rather than the common anonymous path. No changes needed
to `bootPremium`/`initPurchases` for that transition — they already just consume whatever
`user?.user_id` is.

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

## Phase 0, scoped: `POST /auth/anonymous` + the client-side fallback

**Status: scoped, not yet implemented.** This is the other half of Phase 0 — the
`delete_account` fix above was the first half. Without this, Phase 1's `bootPremium` proceeding
past its guard and configuring RevenueCat anonymously does *not* mean a purchase is reachable:
`ProtectedRoute` (`App.js`) still gates `/dashboard`, `/play`, `/shop`, `/profile` on `user`
truthiness, and nothing populates `user` for a sessionless device until this lands. Confirmed by
walking a cold launch through the actual code: `authLoading` flips `false`, `user` stays `null`
(no session existed to find), `bootPremium` proceeds and configures RevenueCat anonymously, but
`ProtectedRoute` still redirects every commerce-capable screen to `/login`, and `Landing.jsx`'s
only two CTAs go to `/signup`/`/login` — there is currently no "play as guest" entry point at all.

### Backend: `POST /auth/anonymous`

Mirrors `/auth/register`'s issuance pattern exactly: generate a `user_id` (same format), insert a
`User` doc (`is_anonymous: True`, `password_hash` absent, `email: None` — requires the
`email: Optional[str]` model change noted above, now decided, not yet landed), insert a
`user_sessions` row, set the same `session_token` cookie, return the doc with `session_token` in
the body (the existing native Bearer-fallback convention, same as register/login/session-exchange).

### Frontend: `AuthProvider.checkAuth()` (`App.js`) — the actual missing wiring

```js
} catch (error) {
  if (error?.response?.status === 401) {
    // No existing session - create an anonymous one so gameplay/purchases
    // work without requiring registration (Apple 5.1.1(v)).
    try {
      const anon = await axios.post(`${API}/auth/anonymous`, {}, { withCredentials: true });
      if (IS_NATIVE && anon.data?.session_token) {
        await SecureStorage.setItem(SESSION_TOKEN_KEY, anon.data.session_token);
      }
      setUser(anon.data);
    } catch (anonError) {
      logError("Failed to create anonymous session", anonError);
      setUser(null);
    }
  } else {
    // Network error, 5xx, etc. - don't spin up a new anonymous account for
    // what might be a transient failure on an otherwise-valid session.
    setUser(null);
  }
} finally {
  setLoading(false);
}
```

**Why the `401`-only branch, specifically**: without it, *any* failure on `/auth/me` — a network
blip, a 500, not just "no session" — would also fall through to minting a fresh anonymous
account. That makes the anonymous-row-buildup problem (risk 4) worse for no reason, and could
silently orphan an *existing* logged-in user's session into a brand-new anonymous one on nothing
more than a flaky connection. Restricting the fallback to a confirmed `401` keeps a transient
failure behaving exactly as it does today (`setUser(null)`, same as now) while only creating an
anonymous account when there's genuinely no session to find.

`bootPremium`/`initPurchases` need **no changes** for this — they already just consume
`user?.user_id`, whatever it is. Once `checkAuth()` populates `user` with the anonymous shadow
account, `bootPremium` receives that `user_id` and calls `initPurchases(userId)` with it instead
of `undefined` — RevenueCat ends up identified with the backend's anonymous `user_id` from the
first boot, the same as a real logged-in user today.

### Routing layer: does `ProtectedRoute` need its own change?

**No.**

```js
if (!user) return <Navigate to="/login" replace />;
```

only checks truthiness — it has no idea, and doesn't need to know, whether `user` is a real
account or an anonymous shadow one. The fix is entirely contained in `checkAuth()`; `ProtectedRoute`
and all six routes it wraps are unaffected. Verified `/login` itself has no
redirect-away-if-already-authenticated guard (`LoginPage` only destructures `login` from
`useAuth()`, never reads `user`), so it stays safely reachable even while `user` is already set —
relevant to the next section.

### Accepted side effect: expired real sessions silently become anonymous

An existing real user whose session has genuinely expired will, under this design, silently
become a fresh anonymous account on relaunch instead of being sent to `/login`. For most users
this is strictly better than a hard wall. For an expired-session **premium subscriber**
specifically, their entitlement is still real on RevenueCat/the App Store — but it won't be
reflected in the new anonymous row until they explicitly log back into their real account, so they
would transiently appear non-premium.

**Decision: proceed as designed** — with one required addition, not optional: a visible way back
to `/login` from the anonymous state, so this is always self-service and never requires
reinstalling or contacting support.

**Verified this doesn't already exist.** Checked `Settings.jsx` and `Profile.jsx` (`origin/main`):
neither has a "Log in" / "Sign in" link anywhere. The only existing path to `/login` is via
`navigate("/login", { replace: true })` *after* logout or account deletion (`Profile.jsx`) — there
is no way to reach it while still authenticated (anonymous or otherwise). Since `/login` has no
guard blocking access while `user` is already set (previous section), the fix is additive and
small: add a visible "Log in to an existing account" link in `Settings.jsx`, shown when
`user?.is_anonymous` is true, navigating to `/login`. The existing `login()` function in
`AuthContext` already overwrites both the cookie (via the backend's `Set-Cookie` response) and the
Keychain-stored Bearer token (`SecureStorage.setItem` inside `login()`) unconditionally — logging
in from an anonymous session requires no special-casing there, only the entry point needs to exist.

## Open items not resolved by this plan

- The anonymous-row retention/cleanup job (risk 4) — not designed here, just flagged as required.
- The cross-device orphaning support flow (risk 3) — not designed here, just flagged as required.
