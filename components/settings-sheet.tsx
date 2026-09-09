"use client";
import { useState } from "react";
import { SocialNotificationSettings } from "./social-notification-settings";
import { WebPushSettings } from "./web-push-settings";
import { HistorySharing } from "./history-sharing";
import type { GameState, SocialSettings } from "@/lib/game";
import { Sheet } from "./sheet";

export function SettingsSheet({
  state,
  demo,
  onClose,
  save,
  mutate,
  saveSocial,
  historySharing,
  reactionDigest,
}: {
  state: GameState;
  demo: boolean;
  saveSocial: (settings: SocialSettings) => Promise<void>;
  historySharing?: {
    enabled: boolean;
    save: (enabled: boolean) => Promise<void>;
  };
  reactionDigest?: {
    enabled: boolean;
    save: (enabled: boolean) => Promise<void>;
  };
  onClose: () => void;
  save: (patch: Partial<GameState>) => Promise<void>;
  mutate: (name: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [block, setBlock] = useState("");
  return (
    <Sheet title="À ta façon" onClose={onClose}>
      {(
        [
          {
            key: "calm",
            label: "Moins d’animations",
            description: "Une expérience plus calme.",
          },
          {
            key: "soft",
            label: "Humour atténué",
            description: "Des messages plus sobres.",
          },
          {
            key: "pvp",
            label: "Participer aux duels",
            description:
              "Appariement à la prochaine saison. Désactivé par défaut.",
          },
        ] as const
      ).map((s) => (
        <label className="setting-row" key={s.key}>
          <span>
            <strong>{s.label}</strong>
            <span>{s.description}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={state[s.key]}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              try {
                await save({ [s.key]: e.target.checked });
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      ))}
      <SocialNotificationSettings
        settings={state.social_settings}
        available={!!state.community_enabled}
        save={saveSocial}
      />
      <WebPushSettings demo={demo} />
      {historySharing && <HistorySharing {...historySharing} />}
      {reactionDigest && (
        <label className="setting-row">
          <span>
            <strong>Récapitulatif des encouragements</strong>
            <span>
              Regrouper les réactions de mes amis dans une alerte horaire. Le
              réglage « Activité de mes amis » doit aussi être activé.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={reactionDigest.enabled}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              setError("");
              try {
                await reactionDigest.save(e.target.checked);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Préférence non enregistrée.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      <h3 className="settings-heading">Gérer mon cercle</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await mutate("block_user", { p_nickname: block });
            setBlock("");
            setError("Joueur bloqué. Les interactions futures sont coupées.");
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Pseudonyme à bloquer
          <input
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            required
            maxLength={20}
          />
        </label>
        <button className="secondary full" disabled={busy || demo}>
          Bloquer ce joueur
        </button>
      </form>
      <p className="fine-print">
        {demo
          ? "La gestion des comptes est disponible en mode connecté."
          : "Le blocage retire l’amitié et le duel en cours. Tes déclarations restent privées."}
      </p>
      <p role="status" className="feedback">
        {error}
      </p>
    </Sheet>
  );
}
