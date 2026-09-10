import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lifeStats,
  formatLifeDuration,
  formatLifeValue,
  rankByLoss,
  normalizeDemoTime,
} from "../lib/life-time";
import { makeDemo, applyDemoAction, catalog, type Player } from "../lib/game";
const now = new Date("2026-09-09T12:00:00Z");
const action = (
  impact: number,
  kind: "excess" | "health",
  date = "2026-09-08T12:00:00Z",
) => ({ minutes_impact: impact, kind, created_at: date });

test("loss counters include all declarations, preserve a negative net and ignore future or wrong-sign actions", () => {
  const actions = [
    ...Array.from({ length: 110 }, () => action(-20, "excess")),
    action(2400, "health"),
    action(-500, "excess", "2026-09-10T00:00:00Z"),
    action(100, "excess"),
    action(-100, "health"),
  ];
  assert.deepEqual(lifeStats(actions, now), {
    lost_minutes: 2200,
    recovered_minutes: 2400,
    net_lost_minutes: -200,
  });
  assert.deepEqual(lifeStats([], now), {
    lost_minutes: 0,
    recovered_minutes: 0,
    net_lost_minutes: 0,
  });
});
test("duration formatting decomposes exact minutes through conventional 365-day years", () => {
  assert.equal(formatLifeDuration(0), "0 min");
  assert.equal(formatLifeDuration(61), "1 h 1 min");
  assert.equal(
    formatLifeDuration(525600 + 2 * 1440 + 3 * 60 + 4),
    "1 an 2 j 3 h 4 min",
  );
  assert.equal(formatLifeDuration(-120), "2 h");
  assert.equal(formatLifeValue(120, "hours"), "2 h");
  assert.equal(formatLifeValue(1051200, "years"), "2 ans");
});
test("gross and net rankings can have different winners, with deterministic ties", () => {
  const p = (id: string, lost: number, recovered: number): Player => ({
    id,
    nickname: id,
    avatar: 0,
    weekly_score: lost,
    weekly_stats: {
      lost_minutes: lost,
      recovered_minutes: recovered,
      net_lost_minutes: lost - recovered,
    },
  });
  const players = [p("a", 200, 190), p("c", 100, 0), p("b", 100, 0)];
  assert.deepEqual(
    rankByLoss(players, "gross").map((p) => p.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    rankByLoss(players, "net").map((p) => p.id),
    ["b", "c", "a"],
  );
});
test("legacy demo upgrades from actions, ignoring balance gifts and resetting the weekly window", () => {
  const demo = makeDemo();
  const original = {
    ...demo,
    balance: 99999,
    actions: [
      { ...demo.actions[0], ...action(-90, "excess", "2026-09-01T00:00:00Z") },
      { ...demo.actions[1], ...action(-20, "excess") },
      { ...demo.actions[2], ...action(30, "health") },
    ],
  };
  const updated = normalizeDemoTime(original, now);
  assert.deepEqual(updated.life_stats, {
    lost_minutes: 110,
    recovered_minutes: 30,
    net_lost_minutes: 80,
  });
  assert.equal(updated.weekly_score, 20);
  assert.equal(updated.weekly_stats?.net_lost_minutes, -10);
  assert.equal(updated.balance, 99999);
  assert.equal(updated.actions.length, 3);
});
test("healthy actions recover life without raising the official loss score; retries stay idempotent", () => {
  const demo = normalizeDemoTime(makeDemo());
  const health = catalog.find((c) => c.id === "walk")!;
  const excess = catalog.find((c) => c.id === "snack")!;
  const good = applyDemoAction(demo, health, 1, "time-health");
  assert.equal(good.weekly_score, demo.weekly_score);
  const loss = applyDemoAction(good, excess, 1, "time-excess");
  assert.equal(loss.weekly_score, good.weekly_score - excess.coefficient);
  assert.equal(loss.balance, good.balance + excess.coefficient);
  assert.equal(
    applyDemoAction(loss, excess, 1, "time-excess").weekly_score,
    loss.weekly_score,
  );
});
