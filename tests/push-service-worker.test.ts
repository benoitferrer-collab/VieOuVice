import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("service worker ignores untrusted titles and constrains every click to game tabs", async () => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  let shown: { title: string; options: { data: { url: string } } } | undefined;
  let opened = "";
  let pending: Promise<unknown> = Promise.resolve();
  const context = { URL, self: {
    location: { origin: "https://game.example" },
    addEventListener: (name: string, callback: (event: Record<string, unknown>) => void) => listeners.set(name, callback),
    registration: { showNotification: async (title: string, options: { data: { url: string } }) => { shown = { title, options }; } },
    clients: { matchAll: async () => [], openWindow: async (url: string) => { opened = url; } },
  } };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), context);
  assert.equal(listeners.has("fetch"), false, "No private responses are cached");
  for (const url of ["https://evil.example/?tab=amis", "//evil.example/?tab=amis", "javascript:alert(1)", "/private?tab=amis", "/?tab=not-a-tab"]) {
    listeners.get("push")!({ data: { json: () => ({ title: "Alice drank wine", body: "private details", url }) }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    assert.equal(shown?.title, "Du nouveau dans ta partie");
    assert.equal(shown?.options.data.url, "/?tab=survie");
    assert.ok(!JSON.stringify(shown).includes("Alice"));
    listeners.get("notificationclick")!({ notification: { close() {}, data: { url } }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    assert.equal(opened, "/?tab=survie");
  }
  listeners.get("notificationclick")!({ notification: { close() {}, data: { url: "/?tab=nemesis&secret=ignored" } }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
  await pending;
  assert.equal(opened, "/?tab=nemesis");
});
