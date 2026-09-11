import test from "node:test";
import assert from "node:assert/strict";
import {
  contribution,
  consumptionSummary,
  templateDefinition,
} from "../lib/cooperative/rules";
import type { Action } from "../lib/game";
const action = (
  id: string,
  quantity: number,
  date: string,
  kind: "health" | "excess" = "health",
): Action => ({
  id: crypto.randomUUID(),
  catalog_id: id,
  label: id,
  kind,
  quantity,
  minutes_impact: kind === "health" ? 20 : -20,
  created_at: date,
  idempotency_key: crypto.randomUUID(),
});
test("cooperative sport counts minutes after joining and caps each Paris day", () => {
  const actions = [
    action("sport-15", 4, "2026-09-10T12:00:00Z"),
    action("sport-15", 4, "2026-09-10T13:00:00Z"),
    action("sport-15", 2, "2026-09-11T12:00:00Z"),
    action("sport-15", 4, "2026-09-09T12:00:00Z"),
    action("beer", 5, "2026-09-10T12:00:00Z", "excess"),
  ];
  assert.equal(
    contribution(
      "sport",
      actions,
      "2026-09-10T00:00:00Z",
      "2026-09-17T00:00:00Z",
      "2026-09-12T00:00:00Z",
    ),
    90,
  );
});
test("cooperative pause counts distinct days, excludes end boundary and zero impacts", () => {
  const a = action("pause", 3, "2026-09-10T20:00:00Z");
  const zero = {
    ...a,
    id: "zero",
    created_at: "2026-09-11T12:00:00Z",
    minutes_impact: 0,
  };
  assert.equal(
    contribution(
      "pause",
      [a, a, zero, action("pause", 1, "2026-09-17T00:00:00Z")],
      "2026-09-10T00:00:00Z",
      "2026-09-17T00:00:00Z",
      "2026-09-18T00:00:00Z",
    ),
    1,
  );
  assert.throws(() => templateDefinition("beer"));
});
test("descriptive consumption totals preserve ambiguous categories and time boundaries", () => {
  const rows = consumptionSummary(
    [
      action("beer", 2, "2026-09-10T12:00:00Z", "excess"),
      action("standard-drink", 3, "2026-09-10T12:00:00Z", "excess"),
      action("beer", 5, "2026-08-01T12:00:00Z", "excess"),
      action("beer", 9, "2026-09-20T12:00:00Z", "excess"),
    ],
    7,
    "2026-09-11T12:00:00Z",
  );
  assert.equal(rows.items.find((x) => x.catalog_id === "beer")?.quantity, 2);
  assert.equal(
    rows.items.find((x) => x.catalog_id === "standard-drink")?.quantity,
    3,
  );
  assert.equal(rows.items.length, 2);
});
