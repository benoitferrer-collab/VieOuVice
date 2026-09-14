import { createClient } from "@supabase/supabase-js";
import {
  generateSeasonIdentity,
  preparedSeasonIdentity,
  type SeasonGeneration,
  type SeasonIdentity,
} from "./season-identity";
export type SeasonClaim = {
  season_id: string;
  starts_at: string;
  lease_token: string;
  generate: boolean;
};
export type SeasonIdentityStore = {
  claim: () => Promise<SeasonClaim | null>;
  finish: (
    claim: SeasonClaim,
    identity: SeasonIdentity,
    source: "ai" | "fallback",
  ) => Promise<boolean>;
};
export async function processSeasonIdentity(
  store: SeasonIdentityStore,
  generate: (startsAt: string) => Promise<SeasonGeneration>,
) {
  const claim = await store.claim();
  if (!claim) return "idle";
  const result = claim.generate
    ? await generate(claim.starts_at)
    : {
        identity: preparedSeasonIdentity(claim.starts_at),
        source: "fallback" as const,
      };
  return (await store.finish(claim, result.identity, result.source))
    ? result.source
    : "stale";
}
/** Runs only from the authenticated periodic dispatch, after phone alerts. */
export async function dispatchSeasonIdentity(config: {
  url: string;
  secretKey: string;
}) {
  const db = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
    },
  });
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_AI_TOKEN?.trim();
  const aiConfig =
    accountId && /^[a-f0-9]{32}$/.test(accountId) && token
      ? { accountId, token }
      : null;
  return processSeasonIdentity(
    {
      claim: async () => {
        const { data, error } = await db.rpc("claim_season_identity");
        if (error) throw Error("Season identity unavailable");
        return data as SeasonClaim | null;
      },
      finish: async (claim, identity, source) => {
        const { data, error } = await db.rpc("finish_season_identity", {
          p_season_id: claim.season_id,
          p_lease_token: claim.lease_token,
          p_identity: identity,
          p_source: source,
        });
        if (error) throw Error("Season identity save unconfirmed");
        return data === true;
      },
    },
    (starts) => generateSeasonIdentity(starts, aiConfig),
  );
}
