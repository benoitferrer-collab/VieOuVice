"use client";
import { useState } from "react";
import { Bell, Shield } from "lucide-react";
import type { SocialSettings } from "@/lib/game";
export const defaultSocialSettings: SocialSettings = {
  share_activity: false,
  notify_friends: true,
  notify_duels: true,
};
export function SocialNotificationSettings({
  settings,
  available,
  save,
}: {
  settings?: SocialSettings;
  available: boolean;
  save: (settings: SocialSettings) => Promise<void>;
}) {
  const value = settings || defaultSocialSettings;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="social-settings">
      <h3 className="settings-heading">
        <Bell size={18} />
        Mon cercle et mes alertes
      </h3>
      {!available && (
        <p className="notice">
          Ces préférences seront disponibles après la mise à jour du jeu.
        </p>
      )}
      {(
        [
          {
            key: "share_activity",
            title: "Partager mes déclarations avec mes amis",
            detail:
              "Tes amis acceptés pourront voir le nom de l’action et sa valeur dans leurs notifications. Désactivé au départ.",
          },
          {
            key: "notify_friends",
            title: "Activité de mes amis",
            detail:
              "Recevoir les déclarations qu’ils choisissent de partager. Une alerte par ami et par heure.",
          },
          {
            key: "notify_duels",
            title: "Événements de duel",
            detail: "Début du duel, changement de leader et résultat final.",
          },
        ] as const
      ).map((item) => (
        <label key={item.key} className="setting-row">
          <span>
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={value[item.key]}
            disabled={busy || !available}
            onChange={async (e) => {
              setBusy(true);
              setError("");
              try {
                await save({ ...value, [item.key]: e.target.checked });
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Préférences non enregistrées.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      ))}
      <p className="notice">
        <Shield size={16} />
        Ton journal complet reste privé. Les blocages coupent les interactions
        futures.
      </p>
      <p role="status" className="feedback coral">
        {error}
      </p>
    </section>
  );
}
