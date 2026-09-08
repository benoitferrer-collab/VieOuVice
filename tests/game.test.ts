import { test } from "node:test";
import assert from "node:assert/strict";
import {
  statusFor,
  gaugePercent,
  promotionCount,
  parisDay,
  applyDemoAction,
  makeDemo,
  catalog,
} from "../lib/game";
import { actionSchema, profileSchema } from "../lib/validation/schemas";
test("signed balance thresholds include zero in zombies", () => {
  assert.equal(statusFor(-500).name, "Zombie");
  assert.equal(statusFor(0).name, "Zombie");
  assert.equal(statusFor(1).name, "Funambule");
  assert.equal(statusFor(250).name, "Funambule");
  assert.equal(statusFor(251).name, "Survivant");
  assert.equal(statusFor(2000).name, "Divinité");
});
test("only graphical fill is clamped", () => {
  assert.equal(gaugePercent(-10), 0);
  assert.equal(gaugePercent(3000), 100);
});
test("incomplete leagues never promote under six members", () => {
  assert.equal(promotionCount(5), 0);
  assert.equal(promotionCount(6), 1);
  assert.equal(promotionCount(30), 5);
});
test("Paris day follows local midnight across DST", () => {
  assert.equal(parisDay("2026-03-29T22:30:00Z"), "2026-03-30");
  assert.equal(parisDay("2026-10-25T23:30:00Z"), "2026-10-26");
});
test("input rejects forged properties and invalid quantities", () => {
  const good = {
    p_catalog_id: "walk",
    p_quantity: 1,
    p_idempotency_key: "6bc315ed-b4ac-4efd-a124-71d9a75b23bc",
  };
  assert.ok(actionSchema.safeParse(good).success);
  for (const quantity of [0, -1, 0.5, 1001, NaN])
    assert.ok(
      !actionSchema.safeParse({ ...good, p_quantity: quantity }).success,
    );
  assert.ok(!actionSchema.safeParse({ ...good, user_id: "victim" }).success);
  assert.ok(!profileSchema.safeParse({ nickname: "!", avatar: 0 }).success);
});
test("demo retries do not duplicate score and changed payload is rejected", () => {
  const state = makeDemo();
  const item = catalog.find((x) => x.id === "walk")!;
  const result = applyDemoAction(state, item, 1, "intent-1");
  const retry = applyDemoAction(result, item, 1, "intent-1");
  assert.equal(retry.balance, result.balance);
  assert.equal(retry.actions.length, result.actions.length);
  assert.throws(() => applyDemoAction(result, item, 2, "intent-1"), /clé/);
});
test("demo health gains are capped per Paris day", () => {
  let state = makeDemo();
  state.actions = [];
  const item = catalog.find((x) => x.id === "walk")!;
  const start = state.balance;
  for (let i = 0; i < 10; i++)
    state = applyDemoAction(state, item, item.max_quantity, "cap-" + i);
  assert.equal(state.balance - start, item.daily_cap);
});
