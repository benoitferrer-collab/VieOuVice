/** Keep aligned with private.valid_push_endpoint in migration 003. */
export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  // Canonical lowercase hosts only; never allow credentials, ports or fragments.
  if (!/^https:\/\/(?:fcm\.googleapis\.com|(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com)\/[^\s#\\]+$/.test(endpoint)) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash;
  } catch { return false; }
}
const tabs = new Set(["survie", "ligue", "nemesis", "amis", "messages"]);
export function pushClickPath(tab: unknown, friendId?: string) {
  const selected = typeof tab === "string" && tabs.has(tab) ? tab : "survie";
  const peer = selected === "messages" && friendId && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(friendId) ? `&friend=${friendId}` : "";
  return `/?tab=${selected}${peer}`;
}
export function pushPayload(tab: unknown, deliveryId?: string, friendId?: string) {
  return { title: "Du nouveau dans ta partie", url: pushClickPath(tab, friendId),
    ...(deliveryId && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(deliveryId) ? { deliveryId } : {}),
  };
}
export function pushRetry(status: number | undefined, attempt: number): "expired" | "retry" | "failed" {
  if (status === 410 || status === 404) return "expired";
  if (attempt >= 5) return "failed";
  return status === undefined || status === 408 || status === 429 || status >= 500 ? "retry" : "failed";
}
