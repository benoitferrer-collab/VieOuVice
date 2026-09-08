import { test } from "node:test";
import assert from "node:assert/strict";
import {
  competitionPhase,
  competitionScore,
  rankStandings,
} from "../lib/events/rules";
import { competitionDraftSchema } from "../lib/events/validation";
import {
  makeDemoSocialState,
  demoHubRpc,
  getDemoHub,
  settleDemoEvents,
} from "../lib/events/demo";
import { makeDemo } from "../lib/game";
const now = new Date("2026-09-08T12:00:00Z");
const draft = {
  id: null,
  title: "Défi de la semaine",
  description: "Un défi convivial",
  starts_at: "2026-09-08T11:00:00Z",
  ends_at: "2026-09-09T11:00:00Z",
  metric: "health_minutes" as const,
  catalog_id: null,
  badge_label: "Pas après pas",
  badge_icon: "leaf" as const,
};
test("competition windows include start and exclude end", () => {
  assert.equal(
    competitionPhase(
      { ...draft, status: "published" },
      new Date(draft.starts_at),
    ),
    "active",
  );
  assert.equal(
    competitionPhase(
      { ...draft, status: "published" },
      new Date(draft.ends_at),
    ),
    "ended",
  );
  assert.equal(
    competitionPhase({ ...draft, status: "cancelled" }, now),
    "cancelled",
  );
});
test("event scores only include server actions inside its window and matching metric", () => {
  const actions = [
    { created_at: draft.starts_at, catalog_id: "walk", minutes_impact: 25 },
    {
      created_at: "2026-09-08T12:00:00Z",
      catalog_id: "snack",
      minutes_impact: -20,
    },
    {
      created_at: "2026-09-08T12:00:00Z",
      catalog_id: "sleep",
      minutes_impact: 30,
    },
    { created_at: draft.ends_at, catalog_id: "walk", minutes_impact: 100 },
  ];
  assert.deepEqual(competitionScore(draft, actions), {
    score: 55,
    action_count: 2,
  });
  assert.deepEqual(
    competitionScore({ ...draft, metric: "net_minutes" }, actions),
    { score: 35, action_count: 3 },
  );
  assert.deepEqual(
    competitionScore(
      { ...draft, metric: "category_minutes", catalog_id: "walk" },
      actions,
    ),
    { score: 25, action_count: 1 },
  );
});
test("equal event scores share rank with deterministic display order", () => {
  const rows = rankStandings([
    { user_id: "b", nickname: "B", avatar: 0, score: 10, action_count: 1 },
    { user_id: "a", nickname: "A", avatar: 0, score: 10, action_count: 2 },
    { user_id: "c", nickname: "C", avatar: 0, score: 5, action_count: 1 },
  ]);
  assert.deepEqual(
    rows.map((r) => [r.user_id, r.rank]),
    [
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ],
  );
});
test("event drafts reject inverted dates, missing category and injected roles", () => {
  assert.equal(competitionDraftSchema.safeParse(draft).success, true);
  assert.equal(
    competitionDraftSchema.safeParse({ ...draft, ends_at: draft.starts_at })
      .success,
    false,
  );
  assert.equal(
    competitionDraftSchema.safeParse({ ...draft, metric: "category_minutes" })
      .success,
    false,
  );
  assert.equal(
    competitionDraftSchema.safeParse({ ...draft, is_admin: true }).success,
    false,
  );
});
test("demo joining is idempotent and cannot happen after event starts", () => {
  const user = makeDemo();
  let social = makeDemoSocialState(now);
  const upcoming = social.events.find(
    (e) => competitionPhase(e, now) === "upcoming",
  )!;
  social = demoHubRpc(
    social,
    user,
    "join_competition",
    { p_event_id: upcoming.id },
    now,
  ).next;
  social = demoHubRpc(
    social,
    user,
    "join_competition",
    { p_event_id: upcoming.id },
    now,
  ).next;
  assert.equal(
    getDemoHub(social, user, now).events.find((e) => e.id === upcoming.id)
      ?.participant_count,
    3,
  );
  assert.throws(() =>
    demoHubRpc(
      social,
      user,
      "leave_competition",
      { p_event_id: upcoming.id },
      new Date(upcoming.starts_at),
    ),
  );
  assert.throws(() => demoHubRpc(social, user, "admin_get_dashboard", {}, now));
});
test("demo history honors accepted friendships and history consent", () => {
  const user = makeDemo();
  const social = makeDemoSocialState(now);
  assert.equal(
    (
      demoHubRpc(
        social,
        user,
        "get_friend_activity",
        { p_friend_id: "demo-jo" },
        now,
      ).data as { shared: boolean }
    ).shared,
    false,
  );
  assert.throws(() =>
    demoHubRpc(
      social,
      user,
      "get_friend_activity",
      { p_friend_id: "unknown" },
      now,
    ),
  );
});

test("demo standings stay at zero before the competition starts", () => {
  const user = makeDemo();
  const social = makeDemoSocialState(now);
  const event = social.events[0];
  const detail = demoHubRpc(
    social,
    user,
    "get_competition",
    { p_event_id: event.id },
    now,
  ).data as {
    leaderboard: { score: number; action_count: number; rank: number }[];
  };
  assert.ok(
    detail.leaderboard.every(
      (row) => row.score === 0 && row.action_count === 0 && row.rank === 1,
    ),
  );
});

test("demo final standings and badges remain frozen after settlement", () => {
  const user = makeDemo();
  const social = makeDemoSocialState(now);
  const event = social.events[1];
  const afterEnd = new Date(event.ends_at);
  const settled = settleDemoEvents(social, user, afterEnd);
  const changedUser = { ...user, actions: [] };
  assert.deepEqual(settleDemoEvents(settled, changedUser, afterEnd), settled);
  assert.deepEqual(
    getDemoHub(settled, changedUser, afterEnd),
    getDemoHub(settled, user, afterEnd),
  );
});
