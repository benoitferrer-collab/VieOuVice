"use client";
import { useState } from "react";
import { ArrowRight, Eye } from "lucide-react";
import { nextAccessory } from "@/lib/home/priorities";
import type { ProgressionState } from "@/lib/progression/types";
import { Reaper } from "../avatar";
export function NextAccessory({
  progression,
  variant,
  onPreview,
}: {
  progression: ProgressionState;
  variant: number;
  onPreview: (id: string) => void;
}) {
  const target = nextAccessory(progression);
  const [preview, setPreview] = useState(true);
  if (!target)
    return (
      <div className="next-accessory-complete">
        {progression.inventory.some(
          (i) => i.slot === "accessory" && !i.unlocked,
        )
          ? "Ouvre la boutique pour actualiser tes prochains accessoires."
          : "Tous les accessoires disponibles sont dans ta collection ✦"}
      </div>
    );
  return (
    <section className="next-accessory" aria-label="Ton prochain accessoire">
      <div className="next-accessory-preview">
        <Reaper
          variant={variant}
          cosmetics={
            preview
              ? { ...progression.equipped, accessory: target.item.id }
              : progression.equipped
          }
        />
        <span>{preview ? "APERÇU" : "ACTUEL"}</span>
      </div>
      <div className="next-accessory-copy">
        <span className="eyebrow">PROCHAIN ACCESSOIRE</span>
        <h3>{target.item.label}</h3>
        <p>{target.condition}</p>
        <progress
          value={target.current}
          max={target.total || 1}
          aria-label={`Progression vers ${target.item.label}`}
        />
        <small>
          {target.current} / {target.total} {target.unit}
          {target.unit === "Éclats" && target.current === target.total
            ? " · budget disponible"
            : ""}
        </small>
        <div className="next-accessory-buttons">
          <button onClick={() => setPreview(!preview)} aria-pressed={preview}>
            <Eye size={14} />
            {preview ? "Comparer" : "Essayer"}
          </button>
          <button onClick={() => onPreview(target.item.id)}>
            Voir <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
