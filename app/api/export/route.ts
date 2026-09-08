import { serverClient } from "@/lib/supabase/server";
export async function GET() {
  const db = await serverClient();
  if (!db) return new Response("Non configuré", { status: 503 });
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return new Response("Non autorisé", { status: 401 });
  const { data, error } = await db.rpc("export_my_data");
  if (error) return new Response("Export indisponible", { status: 503 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="exces-o-meter-export.json"',
      "Cache-Control": "no-store",
    },
  });
}
