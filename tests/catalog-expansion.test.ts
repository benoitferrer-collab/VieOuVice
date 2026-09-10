import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expandedCatalog } from "../lib/catalog-expansion";
import { makeDemo, catalog } from "../lib/game";
import { normalizeDemoTime } from "../lib/life-time";

test("18 fictional tariffs have unique IDs and matching SQL values", () => {
  assert.equal(expandedCatalog.length, 18);
  assert.equal(new Set(catalog.map((i) => i.id)).size, catalog.length);
  const sql = readFileSync(
    "supabase/migrations/202609100008_catalog_expansion.sql",
    "utf8",
  );
  for (const item of expandedCatalog) {
    const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
    assert.ok(
      sql.includes(
        `(${[item.id, item.label, item.kind, item.unit].map(quote).join(",")},${item.max_quantity},${item.coefficient},${item.daily_cap},${quote(item.icon)})`,
      ),
    );
    assert.equal(item.coefficient > 0, item.kind === "health");
    assert.ok(
      item.kind === "excess"
        ? item.daily_cap === 0
        : item.daily_cap >= item.coefficient,
    );
    assert.ok(!/cuite|blackout|vomissement/i.test(item.label));
  }
});
test("saved demo receives catalogue additions once without losing custom actions", () => {
  const state = makeDemo();
  const original = state.catalog.find((i) => i.id === "walk")!;
  const custom = { ...original, id: "custom-test" };
  state.catalog = [original, custom];
  const upgraded = normalizeDemoTime(state);
  assert.equal(upgraded.catalog.length, 20);
  assert.deepEqual(normalizeDemoTime(upgraded).catalog, upgraded.catalog);
  assert.deepEqual(upgraded.catalog[1], custom);
});
