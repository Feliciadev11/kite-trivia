import axios from "axios";
import { findUnsyncedPurchases, syncCharacterPurchase, resolveIdentitySync } from "./purchases";

jest.mock("axios");

const CHARACTERS = [
  { character_id: "butterfly_kite", product_id: "kite_butterfly_kite" },
  { character_id: "rainbow_kite", product_id: "kite_rainbow_kite" },
  { character_id: "basic_kite" }, // free item, no product_id — never a candidate
];

test("a RevenueCat transaction for an item the user doesn't own yet needs syncing", () => {
  const owned = new Set(["basic_kite"]);
  const transactions = {
    kite_butterfly_kite: { transactionIdentifier: "txn_1" },
  };
  expect(findUnsyncedPurchases(CHARACTERS, owned, transactions)).toEqual([
    { characterId: "butterfly_kite", productId: "kite_butterfly_kite", transactionId: "txn_1" },
  ]);
});

test("already-owned items are skipped even if a transaction exists", () => {
  const owned = new Set(["butterfly_kite"]);
  const transactions = { kite_butterfly_kite: { transactionIdentifier: "txn_1" } };
  expect(findUnsyncedPurchases(CHARACTERS, owned, transactions)).toEqual([]);
});

test("no transaction on file means nothing to sync, regardless of ownership", () => {
  expect(findUnsyncedPurchases(CHARACTERS, new Set(), {})).toEqual([]);
});

test("free items with no product_id are never candidates", () => {
  const transactions = { basic_kite: { transactionIdentifier: "txn_x" } }; // shouldn't happen, but be safe
  expect(findUnsyncedPurchases(CHARACTERS, new Set(), transactions)).toEqual([]);
});

test("syncCharacterPurchase retries a dropped POST (no error.response) then succeeds", async () => {
  axios.post
    .mockRejectedValueOnce({ message: "Network Error" }) // no .response — same shape as offline/timeout
    .mockResolvedValueOnce({ data: { ok: true, granted: true } });

  const result = await syncCharacterPurchase("cloud_kite", "kite_cloud", "txn_1", { delayMs: 0 });
  expect(result).toEqual({ ok: true, granted: true });
  expect(axios.post).toHaveBeenCalledTimes(2);
});

test("syncCharacterPurchase does not retry a real server rejection (has error.response)", async () => {
  axios.post.mockRejectedValueOnce({ response: { status: 400 }, message: "Bad Request" });

  await expect(syncCharacterPurchase("cloud_kite", "kite_cloud", "txn_1", { delayMs: 0 })).rejects.toMatchObject({
    response: { status: 400 },
  });
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test("syncCharacterPurchase gives up after retries exhausted on repeated network drops", async () => {
  axios.post.mockRejectedValue({ message: "Network Error" });

  await expect(
    syncCharacterPurchase("cloud_kite", "kite_cloud", "txn_1", { retries: 2, delayMs: 0 })
  ).rejects.toMatchObject({ message: "Network Error" });
  expect(axios.post).toHaveBeenCalledTimes(3);
});

// resolveIdentitySync: the RevenueCat identity the SDK should be configured
// as, given the currently-configured appUserId and the newly-requested one.
// Bug this covers: switching Kite accounts within one app session (no
// relaunch) used to silently no-op past the first-ever configure() call,
// leaving RevenueCat permanently attached to whichever account booted first
// — purchases and entitlement checks for every account after that kept
// hitting the FIRST account's RevenueCat identity.

test("not yet configured -> configure with the given user id", () => {
  expect(resolveIdentitySync({ initialized: false, currentAppUserId: null }, "user_1")).toEqual({
    action: "configure",
    appUserId: "user_1",
  });
});

test("not yet configured, no user id -> configure anonymous", () => {
  expect(resolveIdentitySync({ initialized: false, currentAppUserId: null }, undefined)).toEqual({
    action: "configure",
    appUserId: null,
  });
});

test("already configured as the same user -> no-op", () => {
  expect(resolveIdentitySync({ initialized: true, currentAppUserId: "user_1" }, "user_1")).toEqual({
    action: "noop",
  });
});

test("already configured as user_1, now user_2 logs in -> logIn(user_2), not silently ignored", () => {
  expect(resolveIdentitySync({ initialized: true, currentAppUserId: "user_1" }, "user_2")).toEqual({
    action: "logIn",
    appUserId: "user_2",
  });
});

test("already configured as a real user, app session logs out -> logOut back to anonymous", () => {
  expect(resolveIdentitySync({ initialized: true, currentAppUserId: "user_1" }, undefined)).toEqual({
    action: "logOut",
  });
});

test("already anonymous, still anonymous -> no-op (not a spurious logOut)", () => {
  expect(resolveIdentitySync({ initialized: true, currentAppUserId: null }, undefined)).toEqual({
    action: "noop",
  });
});
