import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/admin/challenges/route";
import { preparedSuggestions, suggestionDraft } from "../lib/ai/challenges";

test("deleted batch replay returns 409 and never generates again", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.SUPABASE_SECRET_KEY = "fixture";
  try {
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/auth/v1/user"))
        return Response.json({ id: "11111111-1111-4111-8111-111111111111" });
      if (url.endsWith("/rest/v1/rpc/reserve_ai_challenges"))
        return Response.json({
          claimed: false,
          deleted: true,
          batch: {
            suggestions: [null, null, null],
            deleted_at: "2026-09-14T00:00:00Z",
          },
        });
      throw Error("Unexpected external call");
    };
    const response = await POST(
      new Request("https://fixture.invalid/api/admin/challenges", {
        method: "POST",
        headers: { authorization: "Bearer fixture" },
        body: JSON.stringify({
          theme: "zen",
          request_id: "22222222-2222-4222-8222-222222222222",
        }),
      }),
    );
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /supprimé/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

test("a deleted pause slot leaves walk and health draft categories intact", () => {
  const rows = preparedSuggestions("zen");
  const slots = [null, rows[1], rows[2]];
  const drafts = slots.flatMap((s, i) => (s ? [suggestionDraft(s, i)] : []));
  assert.deepEqual(
    drafts.map((d) => [d.metric, d.catalog_id]),
    [
      ["category_minutes", "walk"],
      ["health_minutes", null],
    ],
  );
});
