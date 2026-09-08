"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { profileSchema } from "@/lib/validation/schemas";
import { Reaper } from "./avatar";

export function Onboarding({
  save,
}: {
  save: (name: string, avatar: number) => Promise<void>;
}) {
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="auth-page">
      <p className="eyebrow lime">BIENVENUE CHEZ LES VIVANTS</p>
      <h1>Quel mortel es-tu ?</h1>
      <p className="muted">
        500 minutes fictives pour commencer. Le score ne mesure jamais ta santé
        réelle.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = profileSchema.safeParse({ nickname, avatar });
          if (!result.success) {
            setError(
              "Pseudo de 3 à 20 lettres, chiffres, tirets ou underscores.",
            );
            return;
          }
          setBusy(true);
          try {
            await save(result.data.nickname, avatar);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Création impossible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Ton pseudonyme
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            minLength={3}
            maxLength={20}
            placeholder="Mortel_mais_pas_trop"
          />
        </label>
        <label>Ton avatar</label>
        <div className="avatar-picker">
          {[0, 1, 2, 3].map((v) => (
            <button
              type="button"
              className={avatar === v ? "selected" : ""}
              key={v}
              onClick={() => setAvatar(v)}
              aria-label={"Choisir l’avatar " + (v + 1)}
              aria-pressed={avatar === v}
            >
              <Reaper variant={v} />
            </button>
          ))}
        </div>
        <label className="checkbox">
          <input type="checkbox" required />
          J’ai 18 ans ou plus et je comprends que les minutes sont fictives.
        </label>
        <p role="alert" className="coral">
          {error}
        </p>
        <button className="primary full" disabled={busy}>
          {busy ? "Création…" : "Entrer dans la partie"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}
