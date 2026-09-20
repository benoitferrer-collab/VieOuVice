import { test } from "node:test";
import assert from "node:assert/strict";
import { combatMove, arenaReward, type ArenaDuel } from "../lib/arena/rules";
import { demoArenaRpc, emptyArena } from "../lib/arena/demo";
import { makeDemo } from "../lib/game";
const now = new Date("2026-09-15T12:00:00Z");
function duel(): ArenaDuel {
  return {
    id: "d",
    challenger_id: "a",
    opponent_id: "b",
    status: "active",
    turn_user_id: "b",
    turn_number: 1,
    deadline: "2026-09-16T12:00:00Z",
    created_at: now.toISOString(),
    winner_id: null,
    finish_reason: null,
    reward: 0,
    moves: [],
    fighters: ["a", "b"].map((user_id) => ({
      user_id,
      nickname: user_id,
      avatar: 0,
      hp: 100,
      energy: 2,
      guard: false,
    })),
  };
}
test("combat alternates turns, charges energy and consumes one shield", () => {
  const start = duel();
  const guarded = combatMove(start, "b", "guard", 1, now);
  const hit = combatMove(guarded, "a", "heavy", 2, now);
  assert.equal(hit.fighters[1].hp, 88);
  assert.equal(hit.fighters[1].energy, 4);
  assert.equal(hit.fighters[1].guard, false);
  assert.equal(hit.fighters[0].energy, 0);
  assert.equal(start.fighters[1].guard, false);
  assert.throws(() => combatMove(hit, "a", "quick", 3, now));
  assert.throws(() => combatMove(hit, "b", "quick", 2, now));
});
test("specials are deterministic, heal within100 and require energy", () => {
  for (const [avatar, damage, heal] of [
    [0, 20, 8],
    [1, 26, 0],
    [2, 12, 16],
    [3, 16, 12],
  ]) {
    const d = duel();
    d.fighters[1] = { ...d.fighters[1], avatar, hp: 80, energy: 3 };
    const after = combatMove(d, "b", "special", 1, now);
    assert.equal(after.fighters[0].hp, 100 - damage);
    assert.equal(after.fighters[1].hp, 80 + heal);
    assert.equal(after.fighters[1].energy, 0);
  }
  assert.throws(() => combatMove(duel(), "b", "special", 1, now), /Énergie/);
});
test("KO records actual damage and40 moves end the fight", () => {
  const d = duel();
  d.fighters[0].hp = 5;
  const ko = combatMove(d, "b", "quick", 1, now);
  assert.equal(ko.status, "finished");
  assert.equal(ko.winner_id, "b");
  assert.equal(ko.moves[0].damage, 5);
  let long = duel();
  for (let i = 1; i <= 40; i++)
    long = combatMove(long, long.turn_user_id!, "guard", i, now);
  assert.equal(long.status, "finished");
  assert.equal(long.finish_reason, "turn_limit");
  assert.equal(long.winner_id, null);
});
test("rewards exclude quick wins, surrender, draws and enforce daily cap", () => {
  const d = duel();
  d.status = "finished";
  d.finish_reason = "ko";
  d.winner_id = "a";
  assert.equal(arenaReward(d, 0), 0);
  d.moves = Array.from({ length: 6 }, (_, i) => ({
    turn: i + 1,
    actor_id: i % 2 ? "a" : "b",
    move: "quick",
    damage: 12,
    healing: 0,
    created_at: now.toISOString(),
  }));
  assert.equal(arenaReward(d, 20), 10);
  assert.equal(arenaReward(d, 30), 0);
  d.finish_reason = "surrender";
  assert.equal(arenaReward(d, 0), 0);
});
test("demo request retries do not create new invitations or replay turns", () => {
  const game = makeDemo(),
    state = emptyArena(),
    friend = game.friends.find((f) => f.status === "accepted")!;
  const d = demoArenaRpc(state, game, "arena_invite", {
    p_friend_id: friend.id,
    p_request_id: "req",
  }) as ArenaDuel;
  assert.equal(
    (
      demoArenaRpc(state, game, "arena_invite", {
        p_friend_id: friend.id,
        p_request_id: "req",
      }) as ArenaDuel
    ).id,
    d.id,
  );
  const payload = {
    p_duel_id: d.id,
    p_move: "quick",
    p_expected_turn: d.turn_number,
  };
  const after = demoArenaRpc(state, game, "arena_move", payload) as ArenaDuel;
  assert.deepEqual(demoArenaRpc(state, game, "arena_move", payload), after);
});
