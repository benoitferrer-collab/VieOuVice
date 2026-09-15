import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "../lib/game";
import {
  makeDemoProgression,
  progressionRpc,
  demoProgression,
} from "../lib/progression/demo";

const user = makeDemo();
const now = new Date("2026-09-15T12:00:00Z");
function fixture() {
  const state = makeDemoProgression();
  state.awards = Array.from({ length: 6 }, (_, i) => ({
    week: `2026-08-${String(i + 1).padStart(2, "0")}`,
    code: "pause_days" as const,
  }));
  return state;
}
test("historical XP fund the shop without changing levels; purchases are repeatable safely", () => {
  const initial = fixture();
  const before = demoProgression(initial, user, [], [], now);
  assert.deepEqual(before.wallet, { balance: 150, earned: 150, spent: 0 });
  const bought = progressionRpc(
    initial,
    user,
    [],
    [],
    "buy_cosmetic",
    { p_item_id: "friendly_star" },
    now,
  );
  const replay = progressionRpc(
    bought.next,
    user,
    [],
    [],
    "buy_cosmetic",
    { p_item_id: "friendly_star" },
    now,
  );
  const after = demoProgression(replay.next, user, [], [], now);
  assert.deepEqual(after.wallet, { balance: 100, earned: 150, spent: 50 });
  assert.equal(after.xp, before.xp);
  assert.equal(after.level, before.level);
  assert.equal(
    after.inventory.find((i) => i.id === "friendly_star")?.unlocked,
    true,
  );
  assert.equal(
    after.inventory.find((i) => i.id === "leaf_pin")?.unlocked,
    true,
  );
});
test("unowned shop objects cannot be equipped and overspending is rejected", () => {
  const initial = fixture();
  assert.throws(() =>
    progressionRpc(
      initial,
      user,
      [],
      [],
      "equip_cosmetic",
      { p_slot: "accessory", p_item_id: "friendly_star" },
      now,
    ),
  );
  const bought = progressionRpc(
    initial,
    user,
    [],
    [],
    "buy_cosmetic",
    { p_item_id: "cosmic_portal" },
    now,
  );
  assert.throws(
    () =>
      progressionRpc(
        bought.next,
        user,
        [],
        [],
        "buy_cosmetic",
        { p_item_id: "friendly_star" },
        now,
      ),
    /Éclats/,
  );
  const worn = progressionRpc(
    bought.next,
    user,
    [],
    [],
    "equip_cosmetic",
    { p_slot: "background", p_item_id: "cosmic_portal" },
    now,
  );
  assert.equal(worn.next.equipped.background, "cosmic_portal");
  assert.throws(() =>
    progressionRpc(
      initial,
      user,
      [],
      [],
      "buy_cosmetic",
      { p_item_id: "leaf_pin" },
      now,
    ),
  );
});

test("lost purchase response is confirmed from the refreshed owned inventory", async () => {
  const { purchaseCosmetic } = await import("../lib/progression/purchase");
  const state = fixture();
  const purchased = progressionRpc(
    state,
    user,
    [],
    [],
    "buy_cosmetic",
    { p_item_id: "friendly_star" },
    now,
  ).next;
  const { progression, wallet } = await purchaseCosmetic(
    async <T>(name: string): Promise<T> => {
      if (name === "buy_cosmetic") throw new Error("Network response lost");
      return demoProgression(purchased, user, [], [], now) as T;
    },
    "friendly_star",
  );
  assert.equal(wallet.balance, 100);
  assert.equal(
    progression?.inventory.find((i) => i.id === "friendly_star")?.unlocked,
    true,
  );
});

test("an unconfirmed purchase never becomes a client success", async () => {
  const { purchaseCosmetic } = await import("../lib/progression/purchase");
  await assert.rejects(
    () =>
      purchaseCosmetic(async <T>(name: string): Promise<T> => {
        if (name === "buy_cosmetic") throw new Error("Éclats insuffisants");
        return demoProgression(fixture(), user, [], [], now) as T;
      }, "friendly_star"),
    /Éclats insuffisants/,
  );
  await assert.rejects(
    () =>
      purchaseCosmetic(async () => {
        throw new Error("Offline");
      }, "friendly_star"),
    /Offline/,
  );
});

test("purchase failure retains the refreshed wallet even when the item is not owned", async () => {
  const { purchaseCosmetic, PurchaseError } =
    await import("../lib/progression/purchase");
  const spent = progressionRpc(
    fixture(),
    user,
    [],
    [],
    "buy_cosmetic",
    { p_item_id: "cosmic_portal" },
    now,
  ).next;
  await assert.rejects(
    () =>
      purchaseCosmetic(async <T>(name: string): Promise<T> => {
        if (name === "buy_cosmetic") throw new Error("Éclats insuffisants");
        return demoProgression(spent, user, [], [], now) as T;
      }, "friendly_star"),
    (error: unknown) => {
      assert.ok(error instanceof PurchaseError);
      assert.equal(error.progression?.wallet?.balance, 0);
      assert.equal(
        error.progression?.inventory.find((i) => i.id === "cosmic_portal")
          ?.unlocked,
        true,
      );
      return true;
    },
  );
});
