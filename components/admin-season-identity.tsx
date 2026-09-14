"use client";
import { useEffect, useRef, useState } from "react";
import type { HubRpc } from "@/lib/events/types";
import type { SeasonIdentity } from "@/lib/ai/season-identity";
import { SeasonEmblem } from "./season-emblem";
type CurrentIdentity = {
  season_id: string;
  starts_at: string;
  status: "pending" | "generating" | "awaiting_fallback" | "ready";
  identity: SeasonIdentity | null;
  source: "ai" | "fallback" | null;
};
export function AdminSeasonIdentity({ rpc }: { rpc: HubRpc }) {
  const [current, setCurrent] = useState<CurrentIdentity | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    rpc<CurrentIdentity>("admin_season_identity")
      .then((value) => {
        if (active) setCurrent(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Installe la mise à jour Identités de saisons dans Supabase pour activer ce panneau.",
          );
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [rpc]);
  return (
    <section
      className="ai-workshop"
      aria-label="Identité automatique de la saison"
    >
      <h3>Identité de la saison</h3>
      <p className="muted">
        Un nom de saison et cinq emblèmes de ligue sont préparés automatiquement
        à chaque nouvelle saison. Une seule tentative IA, avec un thème de
        secours si nécessaire.
      </p>
      {current?.identity ? (
        <>
          <strong>{current.identity.season_name}</strong>
          <p className="fine-print">
            {current.source === "ai"
              ? "Identité générée par l’IA"
              : "Thème préparé de secours"}{" "}
            · Saison du{" "}
            {new Date(current.starts_at).toLocaleDateString("fr-FR")}
          </p>
          <div className="season-identity-grid">
            {current.identity.divisions.map((division, index) => (
              <div key={index}>
                <SeasonEmblem
                  emblem={{
                    icon: division.icon,
                    color: division.color,
                    shape: division.shape,
                  }}
                  label={division.name}
                  size={64}
                />
                <small>Division {index + 1}</small>
                <strong>{division.name}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        current && (
          <p role="status">
            {current.status === "generating"
              ? "L’IA prépare l’identité…"
              : current.status === "awaiting_fallback"
                ? "Le prochain passage appliquera le thème de secours."
                : "En attente du prochain passage automatique."}
          </p>
        )
      )}
      {error && (
        <p role="alert" className="events-error">
          {error}
        </p>
      )}
      <button
        className="text-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const value = await rpc<CurrentIdentity>("admin_season_identity");
            if (alive.current) setCurrent(value);
          } catch {
            if (alive.current)
              setError("État indisponible. Réessaie plus tard.");
          } finally {
            if (alive.current) setBusy(false);
          }
        }}
      >
        {busy ? "Actualisation…" : "Actualiser l’état"}
      </button>
    </section>
  );
}
