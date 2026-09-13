"use client";

import { useEffect, useState } from "react";
import type { HubRpc } from "@/lib/events/types";
import { AdminDeleteConfirmation } from "./admin-delete-confirmation";

type CoopPage = {
  challenges: {
    id: string;
    title: string;
    creator_name: string;
    status: string;
    ends_at: string;
    participant_count: number;
  }[];
  next_offset: number | null;
};
export function AdminCooperative({
  rpc,
  busy,
  mutate,
}: {
  rpc: HubRpc;
  busy: string;
  mutate: (
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<boolean>;
}) {
  const [page, setPage] = useState<CoopPage>({
    challenges: [],
    next_offset: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    rpc<CoopPage>("admin_list_cooperative_challenges", { p_offset: 0 })
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active)
          setError(
            "Applique la mise à jour Administration dans Supabase, puis rouvre ce menu.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rpc]);
  return (
    <div className="events-admin-list">
      <p className="muted">
        La suppression retire la mission pour toute l’équipe, ses inscriptions
        et son badge collectif.
      </p>
      {page.challenges.map((challenge) => (
        <article className="events-admin-card" key={challenge.id}>
          <h3>{challenge.title}</h3>
          <p>
            Par {challenge.creator_name} · {challenge.participant_count}{" "}
            participants ·{" "}
            {{ active: "En cours", completed: "Terminée", expired: "Expirée" }[
              challenge.status
            ] ?? challenge.status}
          </p>
          <p>Fin : {new Date(challenge.ends_at).toLocaleString("fr-FR")}</p>
          <AdminDeleteConfirmation
            name={challenge.title}
            description="Les inscriptions et badges collectifs de cette mission seront effacés. Les actions déclarées par les joueurs restent dans leur historique."
            disabled={!!busy || loading}
            onConfirm={async (confirmation) => {
              const done = await mutate(
                `coop-delete-${challenge.id}`,
                () =>
                  rpc("admin_delete_challenge", {
                    p_kind: "cooperative",
                    p_id: challenge.id,
                    p_confirmation: confirmation,
                  }),
                "Mission coopérative supprimée.",
              );
              if (done) {
                setLoading(true);
                try {
                  setPage(
                    await rpc<CoopPage>("admin_list_cooperative_challenges", {
                      p_offset: 0,
                    }),
                  );
                } catch {
                  setPage((old) => ({
                    ...old,
                    challenges: old.challenges.filter(
                      (c) => c.id !== challenge.id,
                    ),
                  }));
                  setError(
                    "Mission supprimée. Rouvre ce menu pour actualiser la liste.",
                  );
                } finally {
                  setLoading(false);
                }
              }
              return done;
            }}
          />
        </article>
      ))}
      {loading && <p role="status">Chargement des missions…</p>}
      {!loading && !error && !page.challenges.length && (
        <p>Aucune mission coopérative.</p>
      )}
      {error && (
        <p className="events-error" role="alert">
          {error}
        </p>
      )}
      {page.next_offset !== null && (
        <button
          className="secondary full"
          disabled={!!busy || loading}
          onClick={async () => {
            setLoading(true);
            setError("");
            try {
              const next = await rpc<CoopPage>(
                "admin_list_cooperative_challenges",
                { p_offset: page.next_offset },
              );
              setPage((old) => ({
                challenges: [...old.challenges, ...next.challenges],
                next_offset: next.next_offset,
              }));
            } catch {
              setError("Chargement impossible. Réessaie.");
            } finally {
              setLoading(false);
            }
          }}
        >
          Voir la suite
        </button>
      )}
    </div>
  );
}
