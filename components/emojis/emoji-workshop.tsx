"use client";
import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import type { MessageRpc } from "@/lib/messages/use-messages";
import {
  emojiThemes,
  type EmojiGeneration,
  type CatalogueEmoji,
} from "@/lib/emojis/recipes";
import { ComposedEmoji } from "./composed-emoji";

export function EmojiWorkshop({
  userId,
  rpc,
}: {
  userId: string;
  rpc: MessageRpc;
}) {
  const [theme, setTheme] = useState<(typeof emojiThemes)[number]>("joie");
  const [history, setHistory] = useState<EmojiGeneration[]>([]);
  const [catalog, setCatalog] = useState<CatalogueEmoji[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const running = useRef(false);
  const intent = useRef<{ theme: string; id: string } | null>(null);
  async function reload() {
    const [h, c] = await Promise.all([
      rpc<EmojiGeneration[]>("admin_emoji_history"),
      rpc<CatalogueEmoji[]>("get_emoji_catalog"),
    ]);
    if (alive.current) {
      setHistory(h);
      setCatalog(c);
      setReady(true);
    }
  }
  useEffect(() => {
    alive.current = true;
    let current = true;
    Promise.all([
      rpc<EmojiGeneration[]>("admin_emoji_history"),
      rpc<CatalogueEmoji[]>("get_emoji_catalog"),
    ])
      .then(([h, c]) => {
        if (current) {
          setHistory(h);
          setCatalog(c);
          setReady(true);
        }
      })
      .catch(() => {
        if (current)
          setStatus("Atelier indisponible : mise à jour emojis requise.");
      });
    return () => {
      current = false;
      alive.current = false;
    };
  }, [rpc, userId]);
  async function act(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setStatus("");
    try {
      await work();
      if (alive.current) await reload();
    } catch (e) {
      if (alive.current)
        setStatus(
          e instanceof Error
            ? e.message
            : "Action non confirmée. Actualise avant de recommencer.",
        );
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function generate() {
    const db = browserClient();
    const { data } = await db.auth.getSession();
    if (!data.session || data.session.user.id !== userId)
      throw Error("Reconnecte-toi.");
    const { data: verified } = await db.auth.getUser(data.session.access_token);
    if (verified.user?.id !== userId)
      throw Error("La session a changé. Reconnecte-toi.");
    intent.current ??= { theme, id: crypto.randomUUID() };
    const response = await fetch("/api/admin/emojis", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        theme: intent.current.theme,
        request_id: intent.current.id,
      }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status !== 503) intent.current = null;
      throw Error(result.error ?? "Génération indisponible.");
    }
    intent.current = null;
    if (alive.current)
      setStatus(
        result.diagnostic ?? "Composition enregistrée. Choisis de la publier.",
      );
  }
  return (
    <section className="events-admin-view">
      <h3>Atelier d’emojis composés</h3>
      <p className="muted">
        L’IA choisit une forme, une couleur, une expression et un accessoire.
        Publie ensuite l’emoji pour que tous les joueurs puissent l’envoyer à
        leurs amis.
      </p>
      <p className="fine-print">
        10 essais maximum par jour pour tout le jeu. Les essais sans résultat
        comptent aussi.
      </p>
      <label>
        Ambiance{" "}
        <select
          value={theme}
          disabled={busy}
          onChange={(e) => {
            setTheme(e.target.value as typeof theme);
            intent.current = null;
          }}
        >
          {emojiThemes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <button
        className="secondary"
        disabled={busy || !ready}
        onClick={() => void act(generate)}
      >
        {busy ? "Patiente…" : "Composer avec l’IA"}
      </button>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void act(reload)}
      >
        Actualiser
      </button>
      <p role="status">{status}</p>
      <div className="events-admin-list">
        {history.map((e) => (
          <article key={e.id} className="events-admin-card">
            {e.recipe ? (
              <>
                <ComposedEmoji recipe={e.recipe} label={`Emoji ${e.theme}`} />
                <p>
                  {e.theme} ·{" "}
                  {e.source === "ai"
                    ? "Composition IA"
                    : "Composition préparée (sans IA)"}
                </p>
                <button
                  className="secondary"
                  disabled={busy || catalog.some((c) => c.id === e.id)}
                  onClick={() =>
                    void act(async () => {
                      await rpc("admin_publish_emoji", { p_id: e.id });
                      if (alive.current)
                        setStatus("Emoji publié dans la messagerie.");
                    })
                  }
                >
                  {catalog.some((c) => c.id === e.id)
                    ? "Publié"
                    : "Publier dans la messagerie"}
                </button>
              </>
            ) : (
              <p>Génération en cours ou interrompue · {e.theme}</p>
            )}
          </article>
        ))}
      </div>
      <h4>Catalogue partagé</h4>
      {ready && !catalog.length && <p>Aucun emoji publié.</p>}
      {catalog.map((e) => (
        <div className="events-subheading" key={e.id}>
          <ComposedEmoji recipe={e.recipe} label={e.label} size={48} />
          <span>{e.label}</span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await rpc("admin_archive_emoji", { p_id: e.id });
                if (alive.current)
                  setStatus(
                    "Retiré du catalogue. Les messages déjà envoyés restent lisibles.",
                  );
              })
            }
          >
            Retirer
          </button>
        </div>
      ))}
    </section>
  );
}
