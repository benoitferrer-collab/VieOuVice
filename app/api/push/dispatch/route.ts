import { authorizedDispatch } from "@/lib/push/auth";
import { pushServerConfig } from "@/lib/push/config";
import { dispatchSeasonIdentity } from "@/lib/ai/season-worker";
import { dispatchPush } from "@/lib/push/worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (
    !authorizedDispatch(
      request.headers.get("authorization"),
      process.env.WEB_PUSH_DISPATCH_SECRET,
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const config = pushServerConfig();
  if (!config)
    return Response.json(
      { error: "Push deployment configuration required" },
      { status: 503, headers },
    );
  // No request body or target is consumed. Only durable server-created jobs send.
  const started = Date.now();
  try {
    const result = await dispatchPush(config);
    // Keep notification processing first. A busy dispatch leaves this to the
    // next cron tick; the SQL lease allows only one AI attempt per season.
    let season = "deferred";
    if (Date.now() - started < 30000) {
      try {
        season = await dispatchSeasonIdentity(config);
      } catch {
        season = "unavailable";
      }
    }
    return Response.json({ ...result, season }, { headers });
  } catch {
    return Response.json(
      { error: "Push dispatch unavailable" },
      { status: 503, headers },
    );
  }
}
