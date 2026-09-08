import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDraft } from "../lib/draft";
const valid = {
  catalogId: "walk",
  quantity: 1,
  key: "6bc315ed-b4ac-4efd-a124-71d9a75b23bc",
  pending: true,
};
test("pending draft keeps exact retry identity across serialization", () => {
  assert.deepEqual(parseDraft(JSON.stringify(valid)), valid);
});
test("corrupt or forged drafts are discarded", () => {
  for (const value of [
    "{",
    null,
    JSON.stringify({ ...valid, quantity: 0 }),
    JSON.stringify({ ...valid, key: "bad" }),
    JSON.stringify({ ...valid, user_id: "victim" }),
  ])
    assert.equal(parseDraft(value), null);
});
