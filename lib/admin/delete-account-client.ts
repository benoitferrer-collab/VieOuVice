import { browserClient } from "@/lib/supabase/browser";

export async function deleteAccount(
  actorId: string,
  userId: string,
  confirmation: string,
) {
  const db = browserClient();
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token || data.session?.user.id !== actorId)
    throw Error("La session a changé. Reconnecte-toi.");
  const { data: verified } = await db.auth.getUser(token);
  if (verified.user?.id !== actorId)
    throw Error("La session a changé. Reconnecte-toi.");
  const response = await fetch("/api/admin/accounts", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, confirmation }),
    signal: AbortSignal.timeout(55000),
  });
  const result = await response.json();
  if (!response.ok || result.deleted !== true)
    throw Error(
      result.error ||
        "Suppression non confirmée. Actualise la liste avant de réessayer.",
    );
}
