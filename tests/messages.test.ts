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

test("demo inbox includes latest preview and sorts recent conversations first", () => {
  const messages = [{...m("1"), body:"Ancien"}, {...m("2"), recipient_id:"c", body:"Récent", created_at:"2026-09-11T10:00:00Z"}];
  const result = demoMessageRpc<import("../lib/messages/rules").MessageInbox>({messages,enabled:true},"a",["b","c"],"get_message_inbox");
  assert.equal(result.data.conversations[0].friend_id,"c");
  assert.equal(result.data.conversations[0].last_message?.body,"Récent");
});
test("demo message reactions replace, remove, and reject nonparticipants", () => {
  const base = {messages:[m("1")],enabled:true};
  const first = demoMessageRpc<Message>(base,"b",["a"],"set_message_reaction",{p_message_id:"1",p_reaction:"heart"});
  assert.deepEqual(first.data.reactions,[{user_id:"b",reaction:"heart"}]);
  const second = demoMessageRpc<Message>(first.state,"b",["a"],"set_message_reaction",{p_message_id:"1",p_reaction:"clap"});
  assert.deepEqual(second.data.reactions,[{user_id:"b",reaction:"clap"}]);
  const removed = demoMessageRpc<Message>(second.state,"b",["a"],"set_message_reaction",{p_message_id:"1",p_reaction:null});
  assert.deepEqual(removed.data.reactions,[]);
  assert.throws(()=>demoMessageRpc(base,"c",["a"],"set_message_reaction",{p_message_id:"1",p_reaction:"clap"}));
});
