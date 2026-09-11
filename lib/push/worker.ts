import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { pushServerConfig } from "./config";
import { pushPayload, pushRetry, validPushEndpoint } from "./policy";

type Job = { id: string; lease_token: string; attempts: number };
type Delivery = {
  endpoint: string;
  p256dh: string;
  auth: string;
  target_tab: string;
};
export async function dispatchPush(
  config: NonNullable<ReturnType<typeof pushServerConfig>>,
) {
  const db = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    },
  });
  const pump = await db.rpc("pump_scheduled_notifications");
  if (pump.error && !["PGRST202", "42883"].includes(pump.error.code))
    throw new Error("Scheduled notifications unavailable");
  let sent = 0;
  let processed = 0;
  const deadline = Date.now() + 20000;
  while (processed < 10 && Date.now() < deadline) {
    const { data, error } = await db.rpc("claim_push_job");
    if (error) throw new Error("Push queue unavailable");
    const job = data as Job | null;
    if (!job) break;
    // A second DB check immediately before delivery invalidates stale consent,
    // removed friendships, blocks and outdated duels after queue creation.
    const { data: current, error: validationError } = await db.rpc(
      "authorize_push_job",
      { p_job_id: job.id, p_lease_token: job.lease_token },
    );
    if (validationError) throw new Error("Push authorization unavailable");
    const delivery = current as Delivery | null;
    let result: "sent" | "expired" | "retry" | "failed" | "cancelled" =
      "cancelled";
    if (delivery && validPushEndpoint(delivery.endpoint)) {
      try {
        await webpush.sendNotification(
          {
            endpoint: delivery.endpoint,
            keys: { p256dh: delivery.p256dh, auth: delivery.auth },
          },
          JSON.stringify(pushPayload(delivery.target_tab)),
          {
            TTL: 300,
            urgency: "normal",
            timeout: 5000,
            vapidDetails: {
              subject: config.subject,
              publicKey: config.publicKey,
              privateKey: config.privateKey,
            },
          },
        );
        result = "sent";
        sent++;
      } catch (error) {
        const status =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof error.statusCode === "number"
            ? error.statusCode
            : undefined;
        result = pushRetry(status, job.attempts);
      }
    }
    const { error: finishError } = await db.rpc("finish_push_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_result: result,
    });
    if (finishError) throw new Error("Push queue acknowledgement unavailable");
    processed++;
  }
  return { processed, sent };
}
