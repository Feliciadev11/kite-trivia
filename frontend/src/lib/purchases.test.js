import axios from "axios";
import { findUnsyncedPurchases, syncCharacterPurchase } from "./purchases";

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
