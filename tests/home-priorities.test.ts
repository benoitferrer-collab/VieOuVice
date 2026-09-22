import { test } from "node:test";
import assert from "node:assert/strict";
import {
  homePriorities,
  nextAccessory,
  ongoingMission,
} from "../lib/home/priorities";
import { makeDemo } from "../lib/game";
import type { ArenaDuel } from "../lib/arena/rules";
import type { ProgressionState } from "../lib/progression/types";
const game = makeDemo();
const friend = game.friends.find((f) => f.status === "accepted")!;
const duel = {
  id: "duel",
  challenger_id: game.id,
  opponent_id: friend.id,
  status: "active",
  turn_user_id: game.id,
  deadline: "2026-09-23T00:00:00Z",
  fighters: [{ user_id: friend.id, nickname: friend.nickname }],
  created_at: "2026-09-22T00:00:00Z",
} as ArenaDuel;
const now = new Date("2026-09-22T12:00:00Z");
test("home mission is selected, available and incomplete", () => {
  const mission = {
    code: "pause_days",
    target: 3,
    progress: 2,
    selected: true,
    completed: false,
    awarded: false,
    xp: 50,
    available: true,
  } as const;
  const progression = {
    missions: [
      { ...mission, completed: true },
      { ...mission, selected: false },
      { ...mission, available: false },
      mission,
    ],
  } as ProgressionState;
  assert.equal(ongoingMission(progression), mission);
  assert.equal(ongoingMission(null), null);
  assert.equal(ongoingMission({ ...progression, missions: [] }), null);
});
test("home prioritizes actual turns, invites and unread accepted-friend messages", () => {
  const inbox = {
    enabled: true,
    unread_count: 9,
    conversations: [
      {
        friend_id: friend.id,
        unread_count: 2,
        last_message_at: now.toISOString(),
      },
      {
        friend_id: "stranger",
        unread_count: 7,
        last_message_at: now.toISOString(),
      },
    ],
  };
  const result = homePriorities(game, [duel], inbox, now);
  assert.equal(result[0].kind, "turn");
  assert.equal(result[0].id, "duel");
  assert.equal(result.find((r) => r.kind === "message")?.count, 2);
  assert.equal(
    result.some((r) => r.id === "stranger"),
    false,
  );
  assert.equal(
    homePriorities(
      game,
      [{ ...duel, deadline: now.toISOString() }],
      null,
      now,
    ).some((r) => r.kind === "turn"),
    false,
  );
  assert.equal(
    homePriorities({ ...game, friends: [] }, [duel], inbox, now).length,
    0,
  );
  assert.equal(
    homePriorities(
      game,
      [
        {
          ...duel,
          status: "pending",
          opponent_id: game.id,
          challenger_id: friend.id,
        },
      ],
      null,
      now,
    )[0].kind,
    "invite",
  );
  assert.equal(
    homePriorities(game, [{ ...duel, status: "pending" }], null, now).some(
      (r) => r.kind === "invite",
    ),
    false,
  );
});
test("next accessory distinguishes XP unlocks, spendable wallet and badge conditions", () => {
  const progression = {
    xp: 50,
    wallet: { balance: 30, earned: 100, spent: 70 },
    inventory: [
      { id: "leaf_pin", slot: "accessory", unlocked: false },
      { id: "friendly_star", slot: "accessory", unlocked: false },
    ],
    equipped: { accessory: null, title: null, background: null },
    badges: [],
  } as unknown as ProgressionState;
  let target = nextAccessory(progression)!;
  assert.equal(target.item.id, "leaf_pin");
  assert.equal(target.current, 50);
  assert.equal(target.total, 100);
  target = nextAccessory({
    ...progression,
    inventory: progression.inventory.map((i) => ({
      ...i,
      unlocked: i.id === "leaf_pin",
    })),
  })!;
  assert.equal(target.item.id, "friendly_star");
  assert.equal(target.unit, "Éclats");
  assert.equal(target.current, 30);
  assert.equal(target.total, 50);
  assert.equal(nextAccessory({ ...progression, inventory: [] }), null);
  assert.equal(
    nextAccessory({
      ...progression,
      inventory: progression.inventory.map((i) => ({ ...i, unlocked: true })),
    }),
    null,
  );
  target = nextAccessory({
    ...progression,
    inventory: [{ id: "laurel", slot: "accessory", unlocked: false }],
  })!;
  assert.equal(target.unit, "badge");
  assert.equal(target.current, 0);
});
