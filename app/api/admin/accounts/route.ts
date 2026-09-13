import { createClient } from "@supabase/supabase-js";
import { handleAccountDeletion } from "@/lib/admin/account-deletion";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    return Response.json(
      { error: "Configuration serveur requise." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  });
  return handleAccountDeletion(request, {
    verify: async (token) => {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : data.user;
    },
    prepare: async (actor, target, confirmation) => {
      const { error } = await db.rpc("prepare_admin_account_deletion", {
        p_actor: actor,
        p_user_id: target,
        p_confirmation: confirmation,
      });
      return error;
    },
    remove: async (target) => {
      const { error } = await db.auth.admin.deleteUser(target, false);
      return !error;
    },
  });
}
