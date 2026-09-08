import { pushServerConfig } from "@/lib/push/config";
export const dynamic = "force-dynamic";
export function GET() {
  const config = pushServerConfig();
  return Response.json({ configured: !!config, publicKey: config?.publicKey ?? null }, { headers: { "Cache-Control": "no-store" } });
}
