import { test } from "node:test";
import assert from "node:assert/strict";
import { communityActionSchema } from "../lib/validation/community";
import { createDemoCatalogItem, filterCatalog } from "../lib/community";
import { makeDemo, applyDemoAction } from "../lib/game";
const valid = {
  p_label: "Faire une vraie pause",
  p_kind: "health" as const,
  p_unit: "pause",
  p_magnitude: 75,
  p_max_quantity: 2,
  p_idempotency_key: "6bc315ed-b4ac-4efd-a124-71d9a75b23bc",
};
test("community creation accepts bounded values and rejects forged score/author", () => {
  assert.ok(communityActionSchema.safeParse(valid).success);
  for (const bad of [
    { p_magnitude: 0 },
    { p_magnitude: 121 },
    { p_magnitude: 2.5 },
    { p_max_quantity: 11 },
    { p_label: "a" },
    { p_kind: "admin" },
    { user_id: "someone" },
    { coefficient: 99999 },
  ])
    assert.ok(!communityActionSchema.safeParse({ ...valid, ...bad }).success);
});
test("custom excess values become negative and never award gains", () => {
  const state = makeDemo();
  const { item } = createDemoCatalogItem(state, { ...valid, p_kind: "excess" });
  assert.equal(item.coefficient, -75);
  assert.equal(item.daily_cap, 0);
});
test("catalog retries share the same category and reject different payload", () => {
  const first = createDemoCatalogItem(makeDemo(), valid);
  const retry = createDemoCatalogItem(first.state, valid);
  assert.equal(retry.state.catalog.length, first.state.catalog.length);
  assert.equal(retry.item.id, first.item.id);
  assert.throws(
    () => createDemoCatalogItem(first.state, { ...valid, p_magnitude: 15 }),
    /différent/,
  );
});
test("separate community health categories cannot bypass global daily cap", () => {
  let state = makeDemo();
  state.actions = [];
  const start = state.balance;
  for (let i = 0; i < 3; i++) {
    const result = createDemoCatalogItem(state, {
      ...valid,
      p_idempotency_key: `6bc315ed-b4ac-4efd-a124-71d9a75b23b${i}`,
      p_label: "Pause différente " + i,
      p_magnitude: 120,
    });
    state = applyDemoAction(result.state, result.item, 1, "action-" + i);
  }
  assert.equal(state.balance - start, 150);
});
test("catalog filters combine type source and accent-insensitive search", () => {
  const { state } = createDemoCatalogItem(makeDemo(), {
    ...valid,
    p_label: "Méditer au calme",
  });
  assert.equal(
    filterCatalog(state.catalog, "health", "community", "mediter").length,
    1,
  );
  assert.equal(
    filterCatalog(state.catalog, "excess", "community", "mediter").length,
    0,
  );
  assert.equal(
    filterCatalog(state.catalog, "health", "official", "mediter").length,
    0,
  );
});
