import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("fresh install and initial migration stay identical", () =>
  assert.equal(
    readFileSync("supabase/init.sql", "utf8"),
    readFileSync("supabase/migrations/202609080001_initial.sql", "utf8"),
  ));
test("community upgrade bundles migrations 002 and 003 in one transaction", () => {
  const upgrade = readFileSync("supabase/update-community-notifications.sql", "utf8");
  assert.equal(upgrade.match(/^begin;$/gm)?.length, 1);
  assert.equal(upgrade.match(/^commit;$/gm)?.length, 1);
  let previous = -1;
  for (const migration of [
    "202609080002_community_notifications.sql",
    "202609080003_web_push.sql",
  ]) {
    const body = readFileSync(`supabase/migrations/${migration}`, "utf8")
      .split(/\r?\n/)
      .filter((line) => !["begin;", "commit;"].includes(line.trim().toLowerCase()))
      .join("\n")
      .trimEnd();
    const position = upgrade.indexOf(body);
    assert.ok(position > previous, `${migration} must be included unchanged and in order`);
    previous = position;
  }
});
