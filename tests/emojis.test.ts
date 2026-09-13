import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  fallbackRecipe,
  parseRecipe,
  generateEmoji,
  emojiRequest,
} from "../lib/emojis/recipes";
import { ComposedEmoji } from "../components/emojis/composed-emoji";
import { demoMessageRpc, type DemoMessages } from "../lib/messages/rules";
test("emoji recipes reject markup, URLs, unknown keys and missing enums", () => {
  assert.deepEqual(parseRecipe(JSON.stringify(fallbackRecipe)), fallbackRecipe);
  for (const recipe of [
    { ...fallbackRecipe, svg: "<script/>" },
    { ...fallbackRecipe, face: "https://evil.test" },
    { ...fallbackRecipe, color: "url(evil)" },
    { ...fallbackRecipe, accessory: null },
    {},
  ])
    assert.throws(() => parseRecipe(recipe));
  assert.equal(
    emojiRequest.safeParse({ theme: "<img>", request_id: crypto.randomUUID() })
      .success,
    false,
  );
  const html = renderToStaticMarkup(
    createElement(ComposedEmoji, {
      recipe: { ...fallbackRecipe, face: "<script/>" },
      label: "<script>alert(1)</script>",
    }),
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<svg"));
  const safe = renderToStaticMarkup(
    createElement(ComposedEmoji, { recipe: fallbackRecipe, label: "Joie" }),
  );
  assert.ok(safe.includes("<svg"));
  assert.ok(safe.includes('aria-label="Joie"'));
});
test("one bounded provider call, no player content, explicit fallback and no retry", async () => {
  let calls = 0;
  let requestBody = "";
  const config = { accountId: "a".repeat(32), token: "fake-secret" };
  const success = await generateEmoji("joie", config, (async (_url, init) => {
    calls++;
    requestBody = String(init?.body);
    return Response.json({
      success: true,
      result: { response: JSON.stringify(fallbackRecipe) },
    });
  }) as typeof fetch);
  assert.equal(success.source, "ai");
  assert.equal(calls, 1);
  assert.equal(JSON.parse(requestBody).max_tokens, 150);
  assert.equal(JSON.parse(requestBody).response_format.type, "json_schema");
  assert.ok(!requestBody.includes("fake-secret"));
  for (const status of [401, 429, 500]) {
    calls = 0;
    const failed = await generateEmoji("joie", config, (async () => {
      calls++;
      return new Response("secret", { status });
    }) as typeof fetch);
    assert.equal(failed.source, "fallback");
    assert.equal(calls, 1);
    assert.ok(!JSON.stringify(failed).includes("secret"));
  }
  const invalid = await generateEmoji("joie", config, (async () =>
    Response.json({
      success: true,
      result: { response: { ...fallbackRecipe, svg: "<svg/>" } },
    })) as typeof fetch);
  assert.equal(invalid.source, "fallback");
  calls = 0;
  assert.equal(
    (
      await generateEmoji("joie", null, (async () => {
        calls++;
        throw Error();
      }) as typeof fetch)
    ).source,
    "fallback",
  );
  assert.equal(calls, 0);
});
test("stickers share text quota, durable recipe, replay and friend restrictions in demo", () => {
  const initial: DemoMessages = { messages: [], enabled: true };
  const key = crypto.randomUUID();
  const first = demoMessageRpc(initial, "a", ["b"], "send_friend_emoji", {
    p_friend: "b",
    p_emoji: "demo-star",
    p_key: key,
  });
  assert.deepEqual(first.state.messages[0].emoji_snapshot, fallbackRecipe);
  assert.equal(
    demoMessageRpc(first.state, "a", ["b"], "send_friend_emoji", {
      p_friend: "b",
      p_emoji: "demo-star",
      p_key: key,
    }).state.messages.length,
    1,
  );
  assert.throws(() =>
    demoMessageRpc(first.state, "a", ["b"], "send_friend_message", {
      p_friend: "b",
      p_body: "Emoji : joie",
      p_key: key,
    }),
  );
  assert.throws(() =>
    demoMessageRpc(initial, "a", [], "send_friend_emoji", {
      p_friend: "b",
      p_emoji: "demo-star",
      p_key: key,
    }),
  );
  let state = first.state;
  for (let i = 0; i < 19; i++)
    state = demoMessageRpc(state, "a", ["b"], "send_friend_message", {
      p_friend: "b",
      p_body: "hi",
      p_key: crypto.randomUUID(),
    }).state;
  assert.throws(() =>
    demoMessageRpc(state, "a", ["b"], "send_friend_emoji", {
      p_friend: "b",
      p_emoji: "demo-star",
      p_key: crypto.randomUUID(),
    }),
  );
});
test("installer matches migration and protects generation endpoints and helper bypass", () => {
  const sql = readFileSync(
    "supabase/migrations/202609130017_emojis.sql",
    "utf8",
  );
  assert.equal(readFileSync("supabase/update-emojis.sql", "utf8"), sql);
  assert.match(
    sql,
    /grant execute on function public.reserve_ai_emoji\(uuid,uuid,text\),public.finish_ai_emoji\(uuid,uuid,text,jsonb\) to service_role/,
  );
  assert.match(sql, /count\(\*\) from private.emoji_generations[\s\S]*?>=10/);
  assert.match(sql, /on delete set null/);
  assert.match(
    sql,
    /private.send_friend_message_before_emojis\(uuid,text,uuid\)[\s\S]*?from public,anon,authenticated,service_role/,
  );
});
