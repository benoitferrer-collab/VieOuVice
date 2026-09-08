import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTransferDraft } from "../lib/transfer-draft";
const draft = {
  id: "6bc315ed-b4ac-4efd-a124-71d9a75b23bc",
  amount: 25,
  key: "6bc315ed-b4ac-4efd-a124-71d9a75b23bd",
};
test("transfer retry keeps recipient amount and key", () =>
  assert.deepEqual(parseTransferDraft(JSON.stringify(draft)), draft));
test("invalid transfer amounts never become persisted intentions", () => {
  assert.equal(
    parseTransferDraft(JSON.stringify({ ...draft, amount: -1 })),
    null,
  );
  assert.equal(
    parseTransferDraft(JSON.stringify({ ...draft, amount: 101 })),
    null,
  );
  assert.equal(parseTransferDraft("{"), null);
});
