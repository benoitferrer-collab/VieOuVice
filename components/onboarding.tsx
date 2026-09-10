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
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="auth-page">
      <p className="eyebrow lime">BIENVENUE CHEZ LES VIVANTS</p>
      <ol className="welcome-steps" aria-label="Étapes de bienvenue">
        {["Ton avatar", "Tes compteurs", "Ta première mission"].map(
          (label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined}>
              {index + 1}. {label}
            </li>
          ),
        )}
      </ol>
      <h1>
        {
          [
            "Quel mortel es-tu ?",
            "Des minutes, pour jouer.",
            "Ton premier petit pas.",
          ][step]
        }
      </h1>
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
          if (!adult) {
            setError(
              "Confirme que tu as 18 ans ou plus et que les minutes sont fictives.",
            );
            return;
          }
          setError("");
          if (step < 2) {
            setStep(step + 1);
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
        {step === 0 && (
          <>
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
              <input
                type="checkbox"
                required
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
              />
              J’ai 18 ans ou plus et je comprends que les minutes sont fictives.
            </label>
          </>
        )}
        {step === 1 && (
          <section
            className="welcome-cards"
            aria-label="Comprendre les compteurs"
          >
            <article>
              <h2>Excès cumulés</h2>
              <p>
                Le total fictif des minutes perdues avec tes écarts. Dans la
                ligue, le plus grand total de la semaine est premier.
              </p>
            </article>
            <article>
              <h2>Bonnes habitudes</h2>
              <p>
                Les minutes récupérées après les plafonds. Elles améliorent ton
                bilan sans diminuer ton score d’excès cumulés.
              </p>
            </article>
            <article>
              <h2>Bilan net</h2>
              <p>
                120 minutes perdues − 45 récupérées = 75 minutes perdues au
                bilan. Les bonus, dons et XP ne comptent pas dans ce calcul.
              </p>
            </article>
            <p className="notice">
              Tu commences avec un capital séparé de 500 minutes fictives. Aucun
              compteur ne prédit ta santé ni ta durée de vie. Le classement
              n’est pas un objectif de consommation.
            </p>
          </section>
        )}
        {step === 2 && (
          <section
            className="welcome-cards"
            aria-label="Découvrir sa première mission"
          >
            <article>
              <span className="eyebrow lime">UNE PREMIÈRE FOIS · 50 XP</span>
              <h2>Découvre une bonne habitude</h2>
              <p>
                Une mission accessible pour commencer : déclarer une bonne
                habitude que tu n’avais jamais enregistrée avant cette semaine.
              </p>
            </article>
            <ol className="welcome-mission">
              <li>Dans Survie, ouvre « Tes missions de la semaine ».</li>
              <li>
                Choisis « Une première fois » si tu souhaites la réaliser.
              </li>
              <li>
                Après une activité réellement effectuée, utilise « Bonne
                habitude » et confirme ta déclaration.
              </li>
            </ol>
            <p>
              Une mission accomplie rapporte 50 XP. Tu peux en choisir jusqu’à
              trois, pour 150 XP maximum par semaine. Les XP débloquent des
              apparences, sans changer tes minutes.
            </p>
            <p className="notice">
              Rien n’est sélectionné automatiquement. Tes choix de missions sont
              définitifs pour la semaine : prends le temps de les découvrir. Le
              Guide du joueur reste disponible dans Profil.
            </p>
          </section>
        )}
        <p role="alert" className="coral">
          {error}
        </p>
        {step > 0 && (
          <button
            type="button"
            className="secondary full"
            disabled={busy}
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
          >
            Retour
          </button>
        )}
        <button className="primary full" disabled={busy}>
          {busy
            ? "Création…"
            : step < 2
              ? "Continuer"
              : "Créer mon profil et découvrir les missions"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}
