"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <h1>Une petite sortie de route.</h1>
      <p>
        Impossible d’afficher la partie. Tes mouvements confirmés restent
        enregistrés.
      </p>
      <button className="primary" onClick={reset}>
        Réessayer
      </button>
    </main>
  );
}
