import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preparedSeasonIdentity,
  seasonIdentitySchema,
  generateSeasonIdentity,
} from "../lib/ai/season-identity";
import {
  processSeasonIdentity,
  type SeasonIdentityStore,
} from "../lib/ai/season-worker";
const starts = "2026-09-14T00:00:00+02:00";
test("season identities use five bounded divisions and fixed renderable emblems", () => {
  const identity = preparedSeasonIdentity(starts);
  assert.ok(seasonIdentitySchema.safeParse(identity).success);
  assert.equal(identity.divisions.length, 5);
  for (const changed of [
    { ...identity, reward: 500 },
    { ...identity, season_name: "<script>" },
    { ...identity, divisions: identity.divisions.slice(1) },
    {
      ...identity,
      divisions: identity.divisions.map((d) => ({ ...d, icon: "http://bad" })),
    },
  ])
    assert.equal(seasonIdentitySchema.safeParse(changed).success, false);
  assert.deepEqual(preparedSeasonIdentity(starts), identity);
  assert.notDeepEqual(
    preparedSeasonIdentity("2026-09-21T00:00:00+02:00"),
    identity,
  );
});
test("generation sends only a season theme and validates structured response, falling back without retry", async () => {
  let calls = 0,
    body = "";
  const expected = preparedSeasonIdentity(starts);
  const config = { accountId: "a".repeat(32), token: "fake" };
  const result = await generateSeasonIdentity(
    starts,
    config,
    async (_url, init) => {
      calls++;
      body = String(init?.body);
      return Response.json({ success: true, result: { response: expected } });
    },
  );
  assert.equal(result.source, "ai");
  assert.equal(calls, 1);
  assert.equal(JSON.parse(body).response_format.type, "json_schema");
  assert.ok(!body.includes("fake"));
  calls = 0;
  const failed = await generateSeasonIdentity(starts, config, async () => {
    calls++;
    return new Response("private provider detail", { status: 429 });
  });
  assert.equal(failed.source, "fallback");
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(failed).includes("private provider"));
  const invalid = await generateSeasonIdentity(starts, config, async () =>
    Response.json({
      success: true,
      result: { response: { ...expected, season_name: "Boire 10 bières" } },
    }),
  );
  assert.equal(invalid.source, "fallback");
});
test("season worker leaves completed/leased identities alone, and never calls AI on expired lease fallback", async () => {
  let generated = 0,
    saved = 0;
  const generate = async () => {
    generated++;
    return { identity: preparedSeasonIdentity(starts), source: "ai" as const };
  };
  const store: SeasonIdentityStore = {
    claim: async () => null,
    finish: async () => {
      saved++;
      return true;
    },
  };
  assert.equal(await processSeasonIdentity(store, generate), "idle");
  assert.equal(generated, 0);
  store.claim = async () => ({
    season_id: "season",
    starts_at: starts,
    lease_token: "lease",
    generate: false,
  });
  assert.equal(await processSeasonIdentity(store, generate), "fallback");
  assert.equal(generated, 0);
  assert.equal(saved, 1);
  store.claim = async () => ({
    season_id: "season",
    starts_at: starts,
    lease_token: "lease",
    generate: true,
  });
  assert.equal(await processSeasonIdentity(store, generate), "ai");
  assert.equal(generated, 1);
  store.finish = async () => false;
  assert.equal(await processSeasonIdentity(store, generate), "stale");
});

test("every prepared season emblem renders and malformed emblem data cannot become markup",async()=>{
 const {renderToStaticMarkup}=await import("react-dom/server");
 const {createElement}=await import("react");
 const {SeasonEmblem}=await import("../components/season-emblem");
 for(let week=0;week<12;week++) {
  const identity=preparedSeasonIdentity(new Date(Date.parse(starts)+week*604800000).toISOString());
  assert.ok(seasonIdentitySchema.safeParse(identity).success);
  for(const {name,...emblem} of identity.divisions)assert.match(renderToStaticMarkup(createElement(SeasonEmblem,{emblem,label:name})),/<svg/);
 }
 assert.equal(renderToStaticMarkup(createElement(SeasonEmblem,{emblem:{icon:"<script>",color:"gold",shape:"circle"},label:"unsafe"})),"");
});
