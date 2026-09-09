"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fingerprint, KeyRound, Trash2 } from "lucide-react";
import type { PasskeyListItem } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";
import { passkeyErrorMessage, requirePasskeyOwner } from "@/lib/auth/passkeys";
import { usePasskeySupport } from "@/lib/auth/use-passkey-support";

export function PasskeySettings({
  userId,
  demo,
}: {
  userId: string;
  demo: boolean;
}) {
  const supported = usePasskeySupport();
  const auth = useMemo(() => (demo ? null : browserClient().auth), [demo]);
  const [keys, setKeys] = useState<PasskeyListItem[]>([]);
  const [busy, setBusy] = useState(!demo);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [sessionChanged, setSessionChanged] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const ceremony = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    generation.current++;
    ceremony.current?.abort();
  }, []);

  useEffect(() => {
    const scope = ++generation.current;
    if (!auth) return;
    let active = true;
    const {
      data: { subscription },
    } = auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== userId)) {
        invalidate();
        setKeys([]);
        setSessionChanged(true);
      }
    });
    async function load() {
      try {
        await requirePasskeyOwner(auth!, userId);
        if (!active || scope !== generation.current) return;
        const result = await auth!.passkey.list();
        if (result.error) throw result.error;
        if (active && scope === generation.current) {
          setKeys(result.data || []);
          setLoaded(true);
        }
      } catch (caught) {
        if (active && scope === generation.current)
          setError(passkeyErrorMessage(caught));
      } finally {
        if (active && scope === generation.current) setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
      invalidate();
      subscription.unsubscribe();
    };
  }, [auth, userId, invalidate]);

  async function run(
    operation: "register" | "delete" | "refresh",
    id?: string,
  ) {
    if (!auth || demo || busy || pending.current || sessionChanged) return;
    pending.current = true;
    const scope = generation.current;
    const controller = new AbortController();
    ceremony.current = controller;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await requirePasskeyOwner(auth, userId, controller.signal);
      if (scope !== generation.current) return;
      if (operation === "register") {
        if (!supported) return;
        const result = await auth.registerPasskey({
          options: { signal: controller.signal },
        });
        if (result.error) throw result.error;
        if (!result.data) throw new Error("Registration not confirmed");
        if (scope !== generation.current) return;
        setMessage(
          "Clé ajoutée. Tu peux maintenant l’utiliser pour retrouver ta partie.",
        );
      } else if (operation === "delete") {
        // Only the explicitly confirmed row can be revoked. Supabase enforces ownership.
        if (!id || removing !== id || !keys.some((key) => key.id === id))
          return;
        const result = await auth.passkey.delete({ passkeyId: id });
        if (result.error) throw result.error;
        if (scope !== generation.current) return;
        setKeys((previous) => previous.filter((key) => key.id !== id));
        setRemoving(null);
        setMessage(
          "Clé retirée du compte. Tu peux aussi l’effacer dans ton gestionnaire de mots de passe.",
        );
      }
      const result = await auth.passkey.list();
      if (result.error) throw result.error;
      if (scope === generation.current) {
        setKeys(result.data || []);
        setLoaded(true);
      }
    } catch (caught) {
      if (scope === generation.current && !controller.signal.aborted)
        setError(passkeyErrorMessage(caught));
    } finally {
      pending.current = false;
      if (scope === generation.current) setBusy(false);
      if (ceremony.current === controller) ceremony.current = null;
    }
  }

  return (
    <section className="passkey-settings" aria-label="Mes clés d’accès">
      <div className="passkey-intro">
        <Fingerprint size={32} aria-hidden="true" />
        <p>
          Retrouve ta partie avec Face ID, Touch ID ou le code de ton appareil.
        </p>
        <p className="muted">
          Ta clé est conservée dans Apple Mots de passe ou un autre gestionnaire
          compatible. Le jeu ne reçoit aucune donnée biométrique.
        </p>
      </div>
      {demo ? (
        <p className="notice">
          Connecte-toi à ton vrai compte pour ajouter une clé. Aucune clé n’est
          créée en démo.
        </p>
      ) : sessionChanged ? (
        <p role="alert">
          La session a changé. Ferme cet écran et reconnecte-toi à ton compte.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="primary full"
            disabled={busy || !supported}
            onClick={() => void run("register")}
          >
            <KeyRound size={18} />{" "}
            {busy ? "Un instant…" : "Ajouter une clé d’accès"}
          </button>
          {!supported && (
            <p className="fine-print">
              Utilise un navigateur compatible sur l’adresse HTTPS du jeu pour
              ajouter une clé.
            </p>
          )}
          <p className="fine-print">
            Ton mot de passe reste utilisable. Sur un appareil partagé, utilise
            ton téléphone ou ta propre clé de sécurité.
          </p>
          {loaded && !keys.length && (
            <p className="muted">
              Tu n’as pas encore enregistré de clé d’accès.
            </p>
          )}
          <ul className="passkey-list">
            {keys.map((key) => (
              <li key={key.id}>
                <div className="passkey-row">
                  <KeyRound size={20} aria-hidden="true" />
                  <div>
                    <strong>{key.friendly_name || "Clé d’accès"}</strong>
                    <small>Ajoutée le {formatDate(key.created_at)}</small>
                    {key.last_used_at && (
                      <small>
                        Dernière utilisation : {formatDate(key.last_used_at)}
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Retirer ${key.friendly_name || "cette clé"}`}
                    onClick={() => setRemoving(key.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                {removing === key.id && (
                  <div className="passkey-confirm">
                    <p>
                      Retirer cette clé du compte ? Elle ne permettra plus de te
                      connecter. Ton mot de passe restera disponible.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => setRemoving(null)}
                      >
                        Conserver
                      </button>
                      <button
                        type="button"
                        className="secondary coral"
                        disabled={busy}
                        onClick={() => void run("delete", key.id)}
                      >
                        Retirer la clé
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p role="status" className="feedback">
            {message || (busy ? "Demande en cours…" : "")}
          </p>
          {error && (
            <p role="alert" className="feedback coral">
              {error}
            </p>
          )}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void run("refresh")}
          >
            Actualiser mes clés
          </button>
        </>
      )}
    </section>
  );
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "date inconnue"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}
