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
const tabs = new Set(["survie", "ligue", "nemesis", "amis"]);
export function pushClickPath(tab: unknown) {
  return `/?tab=${typeof tab === "string" && tabs.has(tab) ? tab : "survie"}`;
}
export function pushPayload(tab: unknown) {
  return { title: "Du nouveau dans ta partie", url: pushClickPath(tab) };
}
export function pushRetry(status: number | undefined, attempt: number): "expired" | "retry" | "failed" {
  if (status === 410 || status === 404) return "expired";
  if (attempt >= 5) return "failed";
  return status === undefined || status === 408 || status === 429 || status >= 500 ? "retry" : "failed";
}
