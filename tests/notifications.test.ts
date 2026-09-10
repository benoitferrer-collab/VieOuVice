import { test } from "node:test";
import assert from "node:assert/strict";
import { socialNotice, notificationTab } from "../lib/notifications";
const notice = {
  id: "1",
  message: "Sam a déclaré une action.",
  created_at: "2026-09-08T12:00:00Z",
  read_at: null,
  kind: "friend_action",
  target_tab: "amis",
};
test("social toasts accept social events and skip self-system notifications", () => {
  assert.ok(socialNotice(notice));
  assert.equal(socialNotice({ ...notice, kind: "system" }), null);
  assert.equal(socialNotice({ message: "incomplete" }), null);
});
test("notification routing only accepts game destinations", () => {
  assert.equal(notificationTab("nemesis"), "nemesis");
  assert.equal(notificationTab("https://attacker.test"), "survie");
  assert.equal(notificationTab("//attacker.test"), "survie");
});
test("encouragement digests use the journal destination", () => {
  const digest = { ...notice, kind: "reaction_digest", target_tab: "survie" };
  assert.ok(socialNotice(digest));
  assert.equal(notificationTab(digest.target_tab), "survie");
});

test("private message notices route to friends without needing message content", () => {
  const message = socialNotice({
    ...notice,
    kind: "friend_message",
    message: "Tu as reçu un message privé.",
  });
  assert.ok(message);
  assert.equal(notificationTab(message.target_tab), "amis");
});
