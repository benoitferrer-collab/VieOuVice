"use client";
import { useCallback, useEffect, useState } from "react";
import { BellOff } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { GameSessionGate } from "@/lib/game-session";
import {
  defaultPreferences,
  parsePreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences/rules";
const categories = [
  ["messages", "Messages privés", "Les nouveaux messages de tes amis."],
  [
    "friends",
    "Activité des amis",
    "Les déclarations qu’ils choisissent de partager.",
  ],
  ["duels", "Duels", "Début, changement de leader et résultat."],
  [
    "reactions",
    "Encouragements",
    "Une alerte dès un nouvel encouragement ; active aussi les alertes des amis.",
  ],
  [
    "competitions",
    "Compétitions",
    "Début et résultats des compétitions rejointes.",
  ],
  [
    "reminders",
    "Rappels facultatifs",
    "Au maximum un par jour pour tes défis et compétitions en cours.",
  ],
] as const;
export function AdvancedNotificationSettings({
  demo,
  userId,
  onSaved,
}: {
  demo: boolean;
  userId: string;
  onSaved?: () => Promise<void>;
}) {
  const [gate] = useState(() => new GameSessionGate());
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const request = useCallback(
    async (name: string, p: Record<string, unknown> = {}) => {
      const ticket = gate.capture();
      if (!gate.isAccount(userId)) throw Error("La session a changé.");
      const db = browserClient();
      const { data } = await db.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw Error("Reconnecte-toi pour continuer.");
      const verified = await db.auth.getUser(token);
      if (
        verified.error ||
        verified.data.user?.id !== userId ||
        !gate.isCurrent(ticket)
      )
        throw Error("La session a changé.");
      const reply = await db
        .rpc(name, p)
        .setHeader("Authorization", `Bearer ${token}`);
      if (!gate.isCurrent(ticket) || !gate.isAccount(userId))
        throw Error("La session a changé.");
      if (reply.error)
        throw Error(
          ["PGRST202", "42883"].includes(reply.error.code)
            ? "Ces réglages seront disponibles après la mise à jour du jeu."
            : reply.error.code === "P0001"
              ? reply.error.message
              : "Réglages indisponibles. Réessaie.",
        );
      return parsePreferences(reply.data);
    },
    [gate, userId],
  );
  useEffect(() => {
    let alive = true;
    let cleanup = () => {};
    if (demo) gate.enterDemo();
    else {
      gate.enterAccount(userId);
      const { data } = browserClient().auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_OUT" || (session && session.user.id !== userId))
            gate.enterSignedOut();
        },
      );
      cleanup = () => data.subscription.unsubscribe();
    }
    const timer = setTimeout(() => {
      if (demo) {
        setPrefs({ ...defaultPreferences });
        return;
      }
      void request("get_notification_preferences")
        .then((p) => {
          if (alive) setPrefs(p);
        })
        .catch((e) => {
          if (alive)
            setError(
              e instanceof Error ? e.message : "Réglages indisponibles.",
            );
        });
    }, 0);
    return () => {
      alive = false;
      gate.enterSignedOut();
      cleanup();
      clearTimeout(timer);
    };
  }, [demo, userId, gate, request]);
  function change(patch: Partial<NotificationPreferences>) {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    setSaved("");
  }
  return (
    <section
      className="advanced-notification-settings"
      aria-label="Préférences des notifications"
    >
      <h3 className="settings-heading">
        <BellOff size={20} /> Mes notifications
      </h3>
      {demo && (
        <p className="fine-print">
          Réglages de démonstration, sans effet sur tes notifications réelles.
        </p>
      )}
      {!prefs && !error && <p role="status">Chargement des réglages…</p>}
      {prefs && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setSaved("");
            try {
              const parsed = parsePreferences(prefs);
              if (!demo) {
                const result = await request("set_notification_preferences", {
                  p_preferences: parsed,
                });
                setPrefs(result);
                await onSaved?.();
              }
              setSaved(
                demo
                  ? "Réglages simulés pour cet aperçu."
                  : "Préférences enregistrées.",
              );
            } catch (e) {
              setError(
                e instanceof Error && e.name !== "ZodError"
                  ? e.message
                  : "Vérifie les horaires et le fuseau horaire.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            {categories.map(([key, title, description]) => (
              <label className="setting-row" key={key}>
                <span>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs[key]}
                  onChange={(e) => change({ [key]: e.target.checked })}
                />
              </label>
            ))}
            <label className="setting-row">
              <span>
                <strong>Horaires silencieux</strong>
                <span>
                  Les alertes téléphone attendent ; les notifications restent
                  dans la cloche.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs.quiet_enabled}
                onChange={(e) => change({ quiet_enabled: e.target.checked })}
              />
            </label>
            {prefs.quiet_enabled && (
              <div className="quiet-fields">
                <label>
                  Début du silence
                  <input
                    type="time"
                    required
                    value={prefs.quiet_start}
                    onChange={(e) => change({ quiet_start: e.target.value })}
                  />
                </label>
                <label>
                  Fin du silence
                  <input
                    type="time"
                    required
                    value={prefs.quiet_end}
                    onChange={(e) => change({ quiet_end: e.target.value })}
                  />
                </label>
                <label className="timezone-field">
                  Fuseau horaire
                  <input
                    type="text"
                    required
                    list="notification-timezones"
                    value={prefs.timezone}
                    onChange={(e) => change({ timezone: e.target.value })}
                  />
                  <datalist id="notification-timezones">
                    {[
                      "Europe/Paris",
                      "Europe/London",
                      "America/Montreal",
                      "America/New_York",
                      "Indian/Reunion",
                      "Pacific/Noumea",
                      "UTC",
                    ].map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
              </div>
            )}
            <p className="fine-print">
              La permission du navigateur reste nécessaire pour le téléphone.
              Les alertes lues ou périmées ne sont pas réenvoyées. Un envoi déjà
              pris en charge par le téléphone peut arriver après le début du
              silence.
            </p>
            <button className="primary" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer mes notifications"}
            </button>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="feedback coral">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="feedback">
          {saved}
        </p>
      )}
    </section>
  );
}
