import { z } from "zod";

const deletionRequest = z
  .object({
    user_id: z.uuid(),
    confirmation: z.string().min(3).max(20),
  })
  .strict();
export type AccountDeletionServices = {
  verify: (token: string) => Promise<{ id: string } | null>;
  prepare: (
    actor: string,
    target: string,
    confirmation: string,
  ) => Promise<{ code: string; message: string } | null>;
  remove: (target: string) => Promise<boolean>;
};
const headers = { "Cache-Control": "no-store" };
const failure = (error: string, status: number) =>
  Response.json({ error }, { status, headers });

/** Auth deletion invokes the SQL cleanup trigger in the same transaction. */
export async function handleAccountDeletion(
  request: Request,
  services: AccountDeletionServices,
) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return failure("Connexion requise.", 401);
  let input: z.infer<typeof deletionRequest>;
  try {
    const raw = await request.text();
    if (raw.length > 1000) return failure("Requête trop longue.", 400);
    input = deletionRequest.parse(JSON.parse(raw));
  } catch {
    return failure("Compte ou confirmation invalide.", 400);
  }
  try {
    const actor = await services.verify(token);
    if (!actor) return failure("Reconnecte-toi.", 401);
    if (actor.id === input.user_id)
      return failure(
        "Tu ne peux pas supprimer ton propre compte administrateur.",
        403,
      );
    const refused = await services.prepare(
      actor.id,
      input.user_id,
      input.confirmation,
    );
    if (refused)
      return failure(
        refused.code === "P0001"
          ? refused.message
          : "Suppression non autorisée ou mise à jour Supabase requise.",
        403,
      );
    if (!(await services.remove(input.user_id)))
      return failure(
        "Suppression non confirmée. Actualise la liste des joueurs avant de réessayer.",
        503,
      );
    return Response.json({ deleted: true }, { headers });
  } catch {
    return failure(
      "Suppression non confirmée. Actualise la liste des joueurs avant de réessayer.",
      503,
    );
  }
}
