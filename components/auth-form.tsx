"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ArrowLeft, Mail, LockKeyhole } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { credentialsSchema } from "@/lib/validation/schemas";
import { Reaper } from "./avatar";
export function AuthForm({
  onDemo,
  recovery = false,
}: {
  onDemo?: () => void;
  recovery?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "recovery">(
    recovery ? "recovery" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const db = browserClient();
      if (
        mode !== "reset" &&
        mode !== "recovery" &&
        !credentialsSchema.safeParse({ email, password }).success
      )
        throw new Error(
          "Vérifie ton email et choisis un mot de passe d’au moins 10 caractères.",
        );
      let error;
      if (mode === "signup")
        ({ error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        }));
      else if (mode === "login")
        ({ error } = await db.auth.signInWithPassword({ email, password }));
      else if (mode === "reset")
        ({ error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo:
            window.location.origin + "/auth/callback?next=/auth?recovery=1",
        }));
      else {
        if (password.length < 10)
          throw new Error("Choisis au moins 10 caractères.");
        ({ error } = await db.auth.updateUser({ password }));
      }
      if (error)
        throw new Error(
          mode === "login"
            ? "Connexion impossible. Vérifie tes identifiants et la confirmation de ton email."
            : "La demande n’a pas abouti. Réessaie dans un instant.",
        );
      if (mode === "login" || mode === "recovery") {
        router.push("/");
        router.refresh();
      } else
        setMessage(
          mode === "signup"
            ? "Vérifie ta boîte mail pour confirmer ton compte."
            : "Si ce compte existe, un lien de réinitialisation a été envoyé.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Link className="brand" href="/">
        EXCÈS<span>·</span>O<span>·</span>METER
      </Link>
      <Reaper large />
      <p className="eyebrow lime">LA VIE EST UN JEU. CELUI-CI AUSSI.</p>
      <h1>
        {mode === "signup"
          ? "Une nouvelle vie."
          : mode === "reset"
            ? "On repart à zéro ?"
            : mode === "recovery"
              ? "Nouveau mot de passe"
              : "Toujours en vie ?"}
      </h1>
      <p className="muted">
        {mode === "signup"
          ? "Rejoins les survivants. 500 minutes de vie t’attendent."
          : "Retrouve ta partie et tes petits écarts."}
      </p>
      <form onSubmit={submit}>
        {mode !== "recovery" && (
          <label>
            Adresse email
            <div className="input-icon">
              <Mail size={18} />
              <input
                type="email"
                autoComplete="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.fr"
              />
            </div>
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Mot de passe
            <div className="input-icon">
              <LockKeyhole size={18} />
              <input
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="10 caractères minimum"
              />
            </div>
          </label>
        )}
        {mode === "signup" && (
          <label className="checkbox">
            <input type="checkbox" required />
            J’ai 18 ans ou plus. Je comprends que ce score est fictif.
          </label>
        )}
        <button className="primary full" disabled={busy}>
          {busy
            ? "Un instant…"
            : mode === "login"
              ? "Reprendre ma partie"
              : mode === "signup"
                ? "Créer mon compte"
                : mode === "reset"
                  ? "Recevoir le lien"
                  : "Enregistrer"}
          <ArrowRight size={18} />
        </button>
      </form>
      <p role="status" className="feedback">
        {message}
      </p>
      {mode === "login" ? (
        <>
          <button className="text-button" onClick={() => setMode("reset")}>
            Mot de passe oublié ?
          </button>
          <button className="secondary full" onClick={() => setMode("signup")}>
            Je suis un nouveau mortel
          </button>
        </>
      ) : (
        <button className="text-button" onClick={() => setMode("login")}>
          <ArrowLeft size={16} />
          Retour à la connexion
        </button>
      )}
      {onDemo && (
        <button className="text-button" onClick={onDemo}>
          Explorer la démo sans compte
        </button>
      )}
      <p className="fine-print">
        Ceci est un score de jeu, pas un bilan de santé.
      </p>
    </div>
  );
}
