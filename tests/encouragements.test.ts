import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDemoProgression, progressionRpc } from "../lib/progression/demo";
import { makeDemo } from "../lib/game";
import type { Encouragement } from "../lib/progression/types";
const now = new Date("2026-09-09T12:00:00Z");
test("demo reaction retries, replacements and removal represent final state", () => {
  const user = makeDemo();
  let local = makeDemoProgression();
  const send = (reaction: string | null) => {
    const result = progressionRpc(
      local,
      user,
      [],
      [],
      "set_action_reaction",
      { p_action_id: "demo-shared-1", p_reaction: reaction },
      now,
    );
    local = result.next;
    return result.data as Encouragement;
  };
  assert.deepEqual(send("clap"), send("clap"));
  const changed = send("strength");
  assert.equal(changed.mine, "strength");
  assert.equal(changed.counts.clap, 0);
  assert.equal(changed.counts.strength, 1);
  assert.equal(send(null).counts.strength, 0);
  assert.throws(() => send("fake"));
});
test("demo rejects reacting to own or unknown declarations and lost friendships", () => {
  const user = makeDemo();
  for (const id of [user.actions[0].id, "unknown"])
    assert.throws(() =>
      progressionRpc(
        makeDemoProgression(),
        user,
        [],
        [],
        "set_action_reaction",
        { p_action_id: id, p_reaction: "clap" },
        now,
      ),
    );
  assert.throws(() =>
    progressionRpc(
      makeDemoProgression(),
      { ...user, friends: [] },
      [],
      [],
      "set_action_reaction",
      { p_action_id: "demo-shared-1", p_reaction: "clap" },
      now,
    ),
  );
});
