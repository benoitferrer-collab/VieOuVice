import { test } from "node:test";
import assert from "node:assert/strict";
import { recoveredImpact } from "../lib/intent";
const action = { catalog_id: "walk", quantity: 1, minutes_impact: 25 };
test("timeout recovery only confirms an identical declaration", () => {
  assert.equal(recoveredImpact(action, "walk", 1), 25);
  assert.throws(() => recoveredImpact(action, "sleep", 1), /différent/);
  assert.throws(() => recoveredImpact(action, "walk", 2), /différent/);
});
