import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parisWeek,
  levelForXp,
  missionProgress,
  cosmeticUnlocked,
} from "../lib/progression/rules";
import {
  makeDemoProgression,
  progressionRpc,
  demoProgression,
} from "../lib/progression/demo";
import { makeDemo } from "../lib/game";
import { COSMETICS } from "../lib/progression/metadata";
import type { CompetitionSummary } from "../lib/events/types";
const now = new Date("2026-09-09T12:00:00Z");
const action = (
  catalog_id: string,
  created_at: string,
  minutes_impact = 15,
) => ({
  id: catalog_id + created_at,
  catalog_id,
  created_at,
  minutes_impact,
  kind: "health" as const,
  quantity: 1,
  label: catalog_id,
  idempotency_key: catalog_id + created_at,
});
test("mission weeks follow Paris Monday across both DST changes", () => {
  const spring = parisWeek(new Date("2026-03-29T12:00:00Z"));
  assert.equal(spring.start, "2026-03-22T23:00:00.000Z");
  assert.equal(spring.end, "2026-03-29T22:00:00.000Z");
  const fall = parisWeek(new Date("2026-10-25T12:00:00Z"));
  assert.equal((Date.parse(fall.end) - Date.parse(fall.start)) / 3600000, 169);
});
test("missions count distinct Paris days, exclude losses, zero and future actions", () => {
  const actions = [
    action("pause", "2026-09-06T22:10:00Z"),
    action("pause", "2026-09-07T12:00:00Z"),
    action("pause", "2026-09-08T12:00:00Z"),
    action("pause", "2026-09-09T10:00:00Z", 0),
    action("pause", "2026-09-10T10:00:00Z"),
  ];
  assert.equal(missionProgress("pause_days", actions, [], now), 2);
  assert.equal(
    missionProgress(
      "healthy_variety",
      [
        action("walk", now.toISOString()),
        action("move", now.toISOString(), -5),
      ],
      [],
      now,
    ),
    1,
  );
});
test("new habit checks history before the week and accepts a new category", () => {
  const actions = [
    action("pause", "2026-09-01T10:00:00Z"),
    action("pause", now.toISOString()),
  ];
  assert.equal(missionProgress("new_habit", actions, [], now), 0);
  assert.equal(
    missionProgress(
      "new_habit",
      [...actions, action("walk", now.toISOString())],
      [],
      now,
    ),
    1,
  );
});
test("a zero-value declaration does not consume the first healthy habit", () => {
  assert.equal(
    missionProgress(
      "new_habit",
      [
        action("pause", "2026-09-01T10:00:00Z", 0),
        action("pause", now.toISOString()),
      ],
      [],
      now,
    ),
    1,
  );
});
test("three mission awards remain unique and total at most 150XP for the week", () => {
  const user = {
    ...makeDemo(),
    actions: [
      action("pause", "2026-09-07T10:00:00Z"),
      action("walk", "2026-09-08T10:00:00Z"),
      action("move", "2026-09-09T10:00:00Z"),
    ],
  };
  let state = makeDemoProgression();
  for (const code of ["healthy_days", "healthy_variety", "new_habit"]) {
    state = progressionRpc(
      state,
      user,
      [],
      [],
      "choose_weekly_mission",
      { p_code: code },
      now,
    ).next;
    state = progressionRpc(
      state,
      user,
      [],
      [],
      "choose_weekly_mission",
      { p_code: code },
      now,
    ).next;
  }
  const hub = demoProgression(state, user, [], [], now);
  assert.equal(hub.xp, 150);
  assert.equal(hub.week_xp, 150);
  assert.equal(hub.level, 2);
  assert.ok(hub.badges.some((b) => b.id === "premier_trio"));
  assert.throws(() =>
    progressionRpc(
      state,
      user,
      [],
      [],
      "choose_weekly_mission",
      { p_code: "pause_days" },
      now,
    ),
  );
  assert.equal(
    demoProgression(state, { ...user, actions: [] }, [], [], now).xp,
    150,
  );
});
test("cosmetics require XP or the appropriate competition badge", () => {
  assert.equal(levelForXp(150), 2);
  assert.equal(
    cosmeticUnlocked(
      COSMETICS.find((x) => x.id === "leaf_pin")!,
      99,
      [],
    ),
    false,
  );
  assert.equal(
    cosmeticUnlocked(
      COSMETICS.find((x) => x.id === "golden")!,
      1000,
      [],
    ),
    false,
  );
  assert.throws(() =>
    progressionRpc(
      makeDemoProgression(),
      makeDemo(),
      [],
      [],
      "equip_cosmetic",
      { p_slot: "accessory", p_item_id: "halo" },
      now,
    ),
  );
});
test("competition missions require membership, eligible category and an active time window", () => {
  const event: CompetitionSummary = {
    id: "event",
    title: "Pause",
    description: "",
    starts_at: "2026-09-07T00:00:00Z",
    ends_at: "2026-09-10T00:00:00Z",
    metric: "category_minutes",
    catalog_id: "pause",
    badge_label: "Pause",
    badge_icon: "leaf",
    status: "published",
    joined: true,
    participant_count: 1,
    my_score: 0,
    my_rank: 1,
  };
  const progress = (
    changes: Partial<CompetitionSummary>,
    catalog = "pause",
    at = now.toISOString(),
  ) =>
    missionProgress(
      "competition_action",
      [action(catalog, at)],
      [{ ...event, ...changes }],
      now,
    );
  assert.equal(progress({}), 1);
  assert.equal(progress({ joined: false }), 0);
  assert.equal(progress({ status: "cancelled" }), 0);
  assert.equal(progress({ status: "draft" }), 0);
  assert.equal(progress({}, "walk"), 0);
  assert.equal(progress({ metric: "health_minutes" }, "walk"), 1);
  assert.equal(progress({ ends_at: now.toISOString() }), 0);
  assert.equal(progress({}, "pause", "2026-09-06T23:59:59Z"), 0);
});
