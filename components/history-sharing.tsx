"use client";
import { useState } from "react";
import { BookOpen } from "lucide-react";
export function HistorySharing({
  enabled,
  save,
}: {
  enabled: boolean;
  save: (enabled: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="social-settings">
      <h3 className="settings-heading">
        <BookOpen size={18} />
        Ma semaine avec mes amis
      </h3>
      <label className="setting-row">
        <span>
          <strong>Partager mes sept derniers jours</strong>
          <span>
            Mes amis acceptés peuvent consulter toutes mes déclarations de la
            semaine : nom, quantité, date et minutes de vie. Je peux arrêter ce
            partage à tout moment.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={busy}
          onChange={async (e) => {
            const value = e.target.checked;
            setBusy(true);
            setError("");
            try {
              await save(value);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Préférence non enregistrée.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p role="status" className="coral feedback">
        {error}
      </p>
    </section>
  );
}
