"use client";
import { useState } from "react";
import { Handshake, Medal, Plus } from "lucide-react";
import type { GameState } from "@/lib/game";
import type { HubRpc } from "@/lib/events/types";
import type { CoopHub, CoopTemplate } from "@/lib/cooperative/types";
import { COOP_TEMPLATES } from "@/lib/cooperative/rules";
import { Sheet } from "../sheet";
export function CooperativeHub({
  state,
  hub,
  error,
  demo,
  rpc,
  refresh,
}: {
  state: GameState;
  hub: CoopHub | null;
  error: string;
  demo: boolean;
  rpc: HubRpc;
  refresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  async function act(id: string, name: string, p: Record<string, unknown>) {
    setBusy(id);
    setFeedback("");
    try {
      await rpc(name, { p_id: id, ...p });
      await refresh();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Action non confirmée.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="coop-section" aria-label="Défis coopératifs">
      <div className="coop-heading">
        <div>
          <span className="eyebrow">ENSEMBLE, ON AVANCE</span>
          <h2>
            <Handshake size={22} /> Défis coopératifs
          </h2>
        </div>
        <button
          className="text-button"
          disabled={!hub}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} /> Créer
        </button>
      </div>
      <p className="muted">
        Sept jours, un objectif commun et un badge pour les participants qui
        contribuent.
      </p>
      {demo && (
        <p className="fine-print">
          Démo · groupe et contributions fictifs. Les invitations ne sont pas
          envoyées.
        </p>
      )}
      {error && (
        <p role="status" className="notice">
          {error}{" "}
          <button className="text-button" onClick={() => void refresh()}>
            Réessayer
          </button>
        </p>
      )}
      {hub?.challenges.length === 0 && (
        <p className="empty-copy">
          Lance ton premier défi avec un à quatre amis.
        </p>
      )}
      {hub?.challenges
        .filter(
          (c) =>
            c.member_status === "accepted" || c.member_status === "invited",
        )
        .map((c) => (
          <article key={c.id} className="coop-card">
            <div className="coop-heading">
              <h3>{c.title}</h3>
              <span className="fine-print">
                {c.status === "completed"
                  ? "Réussi"
                  : c.status === "expired"
                    ? "Terminé"
                    : "En cours"}
              </span>
            </div>
            <p className="fine-print">
              Créé par {c.creator_name} · Jusqu’au{" "}
              {new Date(c.ends_at).toLocaleString("fr-FR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              · {c.participant_count} participant
              {c.participant_count > 1 ? "s" : ""}
            </p>
            {c.member_status === "invited" ? (
              <>
                <p>
                  Tu es invité à atteindre {c.target} {c.unit} ensemble. En
                  acceptant, tu partages ton avancement dans le total du groupe,
                  sans partager ton journal.
                </p>
                <div className="coop-buttons">
                  <button
                    className="primary"
                    disabled={!!busy || c.status !== "active"}
                    onClick={() =>
                      void act(c.id, "respond_cooperative_challenge", {
                        p_accept: true,
                      })
                    }
                  >
                    Participer
                  </button>
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() =>
                      void act(c.id, "respond_cooperative_challenge", {
                        p_accept: false,
                      })
                    }
                  >
                    Décliner
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="coop-total">
                  <strong>{c.progress}</strong> / {c.target} {c.unit}
                </p>
                <progress
                  value={Math.min(c.progress, c.target)}
                  max={c.target}
                  aria-label={`Progression : ${c.title}`}
                />
                <p>
                  Ta contribution :{" "}
                  <strong>
                    {c.my_progress} {c.unit}
                  </strong>{" "}
                  · {c.contributor_count} contributeur
                  {c.contributor_count > 1 ? "s" : ""}
                </p>
                {c.badge ? (
                  <p className="coop-badge">
                    <Medal size={20} /> Badge obtenu : Ensemble, on avance
                  </p>
                ) : c.status === "active" ? (
                  <>
                    <p className="fine-print">
                      Au moins deux contributeurs sont nécessaires. Seules les
                      déclarations après ton acceptation comptent, dans les
                      plafonds quotidiens.
                    </p>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() =>
                        void act(c.id, "leave_cooperative_challenge", {})
                      }
                    >
                      Quitter ce défi
                    </button>
                  </>
                ) : (
                  <p className="fine-print">
                    Pas de badge pour cette participation. Une nouvelle aventure
                    t’attend.
                  </p>
                )}
              </>
            )}
          </article>
        ))}
      {feedback && (
        <p role="alert" className="feedback coral">
          {feedback}
        </p>
      )}
      {creating && (
        <CreateChallenge
          state={state}
          demo={demo}
          rpc={rpc}
          done={async () => {
            await refresh();
            setCreating(false);
          }}
          close={() => setCreating(false)}
        />
      )}
    </section>
  );
}
function CreateChallenge({
  state,
  demo,
  rpc,
  done,
  close,
}: {
  state: GameState;
  demo: boolean;
  rpc: HubRpc;
  done: () => Promise<void>;
  close: () => void;
}) {
  const [template, setTemplate] = useState<CoopTemplate>("sport");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<{
    template: CoopTemplate;
    friends: string[];
    key: string;
  } | null>(null);
  const definition = COOP_TEMPLATES.find((t) => t.id === template)!;
  const friends = state.friends.filter((f) => f.status === "accepted");
  return (
    <Sheet title="Un défi, ensemble" onClose={close}>
      <form
        className="coop-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const draft = intent ?? {
            template,
            friends: selected,
            key: crypto.randomUUID(),
          };
          setIntent(draft);
          setBusy(true);
          setError("");
          try {
            await rpc("create_cooperative_challenge", {
              p_template: draft.template,
              p_friends: draft.friends,
              p_key: draft.key,
            });
            await done();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Création non confirmée.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Votre défi
          <select
            value={template}
            disabled={busy || !!intent}
            onChange={(e) => setTemplate(e.target.value as CoopTemplate)}
          >
            {COOP_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <p className="notice">
          {definition.description} Sept jours à partir de la création ; chaque
          ami choisit de participer.
        </p>
        <fieldset disabled={busy || !!intent}>
          <legend>Inviter des amis ({selected.length}/4)</legend>
          {friends.length ? (
            friends.map((f) => (
              <label className="setting-row" key={f.id}>
                <span>{f.nickname}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(f.id)}
                  disabled={!selected.includes(f.id) && selected.length >= 4}
                  onChange={(e) =>
                    setSelected((old) =>
                      e.target.checked
                        ? [...old, f.id]
                        : old.filter((id) => id !== f.id),
                    )
                  }
                />
              </label>
            ))
          ) : (
            <p>Ajoute d’abord un ami et attends qu’il accepte.</p>
          )}
        </fieldset>
        <p className="fine-print">
          Tes contributions alimenteront le total visible par l’équipe. Le badge
          récompense une réussite avec au moins deux contributeurs ; aucun bonus
          de minutes ou d’XP. Un seul défi créé en cours.
        </p>
        {demo && (
          <p className="notice">
            Simulation uniquement. Tes amis fictifs n’acceptent pas
            automatiquement les nouvelles invitations.
          </p>
        )}
        {error && (
          <p role="alert" className="feedback coral">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy || selected.length === 0}>
          {busy
            ? "Création…"
            : intent
              ? "Réessayer la même création"
              : "Créer et inviter"}
        </button>
        {intent && !busy && (
          <p className="fine-print">
            En cas de connexion interrompue, réessaie ici pour éviter un
            doublon. Après fermeture, consulte d’abord tes défis avant de créer
            à nouveau.
          </p>
        )}
      </form>
    </Sheet>
  );
}
