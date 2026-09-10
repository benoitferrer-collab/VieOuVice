import { test } from "node:test";
import assert from "node:assert/strict";
import {
  messageBody,
  mergeMessages,
  demoMessageRpc,
  type Message,
} from "../lib/messages/rules";
const m = (id: string): Message => ({
  id,
  sender_id: "a",
  recipient_id: "b",
  body: "Salut",
  created_at: "2026-09-10T10:00:00Z",
  read_at: null,
});
test("messages trim whitespace, preserve literal text and reject empty or oversized text", () => {
  assert.equal(
    messageBody(" <script>alert(1)</script> "),
    "<script>alert(1)</script>",
  );
  assert.throws(() => messageBody(" \n "));
  assert.throws(() => messageBody("a".repeat(2001)));
});
test("pagination merges overlapping pages without losing bigint precision", () => {
  assert.deepEqual(
    mergeMessages(
      [m("9007199254740993"), m("2")],
      [m("9007199254740992"), m("2")],
    ).map((x) => x.id),
    ["2", "9007199254740992", "9007199254740993"],
  );
});
test("demo retries stay idempotent and only selected incoming messages become read", () => {
  const friends = ["b"];
  let state = {
    messages: [{ ...m("1"), sender_id: "b", recipient_id: "a" }],
    enabled: true,
  };
  const args = { p_friend: "b", p_body: "Bonjour", p_key: "retry" };
  const first = demoMessageRpc<Message>(
    state,
    "a",
    friends,
    "send_friend_message",
    args,
  );
  state = first.state;
  const retry = demoMessageRpc<Message>(
    state,
    "a",
    friends,
    "send_friend_message",
    args,
  );
  assert.deepEqual(retry.state, state);
  assert.equal(retry.data.id, first.data.id);
  assert.throws(() =>
    demoMessageRpc(state, "a", friends, "send_friend_message", {
      ...args,
      p_body: "Autre",
    }),
  );
  assert.throws(() =>
    demoMessageRpc(state, "a", [], "get_friend_messages", { p_friend: "b" }),
  );
  const read = demoMessageRpc(state, "a", friends, "read_friend_messages", {
    p_friend: "b",
    p_ids: ["1"],
  });
  assert.ok(read.state.messages[0].read_at);
  assert.equal(read.state.messages[1].read_at, null);
});
