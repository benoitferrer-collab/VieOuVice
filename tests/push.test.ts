import { test } from "node:test";
import assert from "node:assert/strict";
import { validPushEndpoint, pushPayload, pushClickPath, pushRetry } from "../lib/push/policy";
import { authorizedDispatch } from "../lib/push/auth";

test("push allows only official HTTPS services without credentials or custom ports", () => {
  for (const endpoint of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/abc"]) assert.equal(validPushEndpoint(endpoint), true);
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.test/x", "https://push.services.mozilla.com.evil.test/x", "https://evilpush.apple.com/x", "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://127.0.0.1/x", "https://169.254.169.254/x", "https://fcm.googleapis.com/x#secret", "https://FCM.GOOGLEAPIS.COM/x", "https://fcm.googleapis.com/" + "x".repeat(2048)]) assert.equal(validPushEndpoint(endpoint), false, endpoint);
});
test("dispatch fails closed and checks exact bearer token", () => {
  assert.equal(authorizedDispatch(null, "s".repeat(32)), false);
  assert.equal(authorizedDispatch("Bearer " + "s".repeat(32), undefined), false);
  assert.equal(authorizedDispatch("Bearer " + "s".repeat(32), "s".repeat(32)), true);
  assert.equal(authorizedDispatch("bearer " + "s".repeat(32), "s".repeat(32)), false);
  assert.equal(authorizedDispatch("Bearer " + "x".repeat(32), "s".repeat(32)), false);
  assert.equal(authorizedDispatch("Bearer short", "short"), false);
});
test("payload never includes identity, action or event text", () => {
  assert.deepEqual(pushPayload("amis"), { title: "Du nouveau dans ta partie", url: "/?tab=amis" });
  assert.deepEqual(pushPayload("https://evil.test"), { title: "Du nouveau dans ta partie", url: "/?tab=survie" });
  assert.equal(pushClickPath("nemesis"), "/?tab=nemesis");
  assert.equal(pushClickPath("//evil.test"), "/?tab=survie");
});
test("retry decisions expire invalid subscriptions and bound transient attempts", () => {
  assert.equal(pushRetry(410, 1), "expired");
  assert.equal(pushRetry(404, 1), "expired");
  assert.equal(pushRetry(429, 1), "retry");
  assert.equal(pushRetry(503, 4), "retry");
  assert.equal(pushRetry(undefined, 1), "retry");
  assert.equal(pushRetry(503, 5), "failed");
  assert.equal(pushRetry(401, 1), "failed");
});

test("push links accept the dedicated Messages destination", () => {
  assert.equal(pushClickPath("messages"), "/?tab=messages");
});
