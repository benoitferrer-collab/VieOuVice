"use client";
import { useState } from "react";
import { ArrowLeft, Check, Users } from "lucide-react";
import {
  communityActionSchema,
  type CommunityActionInput,
} from "@/lib/validation/community";
import { signed, type CatalogItem, type Kind } from "@/lib/game";
export function CommunityActionForm({
  kind,
  demo,
  onCancel,
  onCreated,
  create,
}: {
  kind: Kind;
  demo: boolean;
  onCancel: () => void;
  onCreated: (item: CatalogItem) => void;
  create: (input: CommunityActionInput) => Promise<CatalogItem>;
}) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("fois");
  const [magnitude, setMagnitude] = useState(20);
  const [maximum, setMaximum] = useState(1);
  const [pending, setPending] = useState<CommunityActionInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="community-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const candidate = pending || {
          p_label: label,
          p_kind: kind,
          p_unit: unit,
          p_magnitude: magnitude,
          p_max_quantity: maximum,
          p_idempotency_key: crypto.randomUUID(),
        };
        const parsed = communityActionSchema.safeParse(candidate);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message || "Vérifie les valeurs.");
          return;
        }
        setPending(parsed.data);
        setBusy(true);
        setError("");
        try {
          onCreated(await create(parsed.data));
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Création non confirmée. Réessaie.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <button
        type="button"
        className="text-button"
        onClick={onCancel}
        disabled={busy}
      >
        <ArrowLeft size={16} />
        Retour au catalogue
      </button>
      <div className="notice">
        <Users size={20} />
        <span>
          {demo
            ? "En démo, cette création reste dans ton navigateur."
            : "Ta création sera visible et réutilisable par tous les joueurs."}{" "}
          Son nom et sa valeur sont ensuite conservés.
        </span>
      </div>
      <label>
        Nom de {kind === "health" ? "la bonne action" : "l’écart"}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          minLength={3}
          maxLength={60}
          required
          disabled={busy || !!pending}
          placeholder={
            kind === "health"
              ? "Ex. : Faire une pause lecture"
              : "Ex. : Encore un épisode"
          }
        />
      </label>
      <label>
        Une unité correspond à…
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          minLength={2}
          maxLength={40}
          required
          disabled={busy || !!pending}
          placeholder="Ex. : un épisode"
        />
      </label>
      <div className="community-values">
        <label>
          Minutes de vie {kind === "health" ? "gagnées" : "perdues"}
          <input
            type="number"
            min={1}
            max={120}
            step={1}
            value={magnitude}
            onChange={(e) => setMagnitude(Number(e.target.value))}
            required
            disabled={busy || !!pending}
          />
        </label>
        <label>
          Quantité maximale
          <input
            type="number"
            min={1}
            max={10}
            step={1}
            value={maximum}
            onChange={(e) => setMaximum(Number(e.target.value))}
            required
            disabled={busy || !!pending}
          />
        </label>
      </div>
      <p
        className={
          "community-preview " + (kind === "health" ? "lime" : "coral")
        }
      >
        {signed(kind === "health" ? magnitude : -magnitude)} min de vie /{" "}
        {unit || "unité"}
      </p>
      <p className="fine-print">
        Valeurs fictives, de 1 à 120 min par unité. Cinq créations par jour.
        {kind === "health"
          ? " Gains communautaires : 120 min maximum par catégorie et 150 min au total par jour."
          : ""}
      </p>
      <p role="alert" className="coral feedback">
        {error}
      </p>
      <button className="primary full" disabled={busy}>
        {busy
          ? "Publication en cours…"
          : pending
            ? "Réessayer cette création"
            : "Ajouter au catalogue"}
        <Check size={18} />
      </button>
    </form>
  );
}
