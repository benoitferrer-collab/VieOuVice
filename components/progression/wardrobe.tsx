"use client";

import { useRef, useState } from "react";
import { Check, Eye, LockKeyhole, Sparkles } from "lucide-react";
import { COSMETICS } from "@/lib/progression/metadata";
import type {
  CosmeticDefinition,
  CosmeticSlot,
  WardrobeProps,
} from "@/lib/progression/types";
import { Reaper } from "../avatar";
import { Sheet } from "../sheet";
import "./progression.css";

const slots: { id: CosmeticSlot; label: string }[] = [
  { id: "accessory", label: "Accessoires" },
  { id: "title", label: "Titres" },
  { id: "background", label: "Décors" },
];

function unlockReason(item: CosmeticDefinition) {
  if (item.badgeRequirement === "winner")
    return "Obtenir un badge gagnant de compétition";
  if (item.badgeRequirement === "any") return "Obtenir un badge de compétition";
  return `Atteindre ${item.xpRequired} XP`;
}

export function Wardrobe({
  progression,
  rpc,
  changed,
  demo,
  variant,
  onClose,
}: WardrobeProps) {
  const lock = useRef(false);
  const [slot, setSlot] = useState<CosmeticSlot>("accessory");
  const [preview, setPreview] = useState(progression.equipped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedId = preview[slot];
  const selectedItem = COSMETICS.find(
    (item) => item.id === selectedId && item.slot === slot,
  );
  const unlocked =
    selectedId === null ||
    progression.inventory.some(
      (item) => item.id === selectedId && item.slot === slot && item.unlocked,
    );
  const equipped = progression.equipped[slot] === selectedId;
  const previewTitle = COSMETICS.find(
    (item) => item.id === preview.title && item.slot === "title",
  );

  function select(itemId: string | null) {
    setPreview((current) => ({ ...current, [slot]: itemId }));
    setError("");
    setNotice("");
  }

  async function equip() {
    if (lock.current || !unlocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await rpc("equip_cosmetic", { p_slot: slot, p_item_id: selectedId });
      await changed();
      setNotice(
        selectedId
          ? "Ton apparence a été mise à jour."
          : "Cet emplacement est maintenant libre.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "L’apparence n’a pas pu être enregistrée. Ton aperçu est conservé pour réessayer.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Sheet title="Ton vestiaire" onClose={onClose}>
      <div className="wardrobe" aria-busy={busy}>
        <p className="progression-intro">
          Des détails gagnés à ton rythme. Essaie une pièce pour découvrir ton
          prochain look.
        </p>
        <div className="wardrobe-preview">
          <span className="wardrobe-preview-label">
            <Eye size={14} aria-hidden="true" />
            Aperçu
          </span>
          <Reaper variant={variant} large cosmetics={preview} />
          <strong>{previewTitle?.label ?? "À ta façon"}</strong>
          <span>
            Niveau {progression.level} · {progression.xp} XP
          </span>
        </div>
        <dl
          className="wardrobe-equipped"
          aria-label="Apparence actuellement équipée"
        >
          {slots.map((item) => (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd>
                {COSMETICS.find(
                  (cosmetic) =>
                    cosmetic.id === progression.equipped[item.id] &&
                    cosmetic.slot === item.id,
                )?.label ?? "Aucun"}
              </dd>
            </div>
          ))}
        </dl>
        <div
          className="wardrobe-slots"
          role="group"
          aria-label="Emplacement à personnaliser"
        >
          {slots.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={slot === item.id}
              disabled={busy}
              onClick={() => {
                setSlot(item.id);
                setError("");
                setNotice("");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="wardrobe-inventory"
          role="group"
          aria-label={`Choix : ${slots.find((item) => item.id === slot)?.label}`}
        >
          <button
            type="button"
            className="wardrobe-item"
            aria-pressed={selectedId === null}
            disabled={busy}
            onClick={() => select(null)}
          >
            <span className="wardrobe-item-heading">
              <strong>Aucun</strong>
              {progression.equipped[slot] === null && (
                <Check size={16} aria-hidden="true" />
              )}
            </span>
            <small>Libérer cet emplacement</small>
          </button>
          {COSMETICS.filter((item) => item.slot === slot).map((item) => {
            const owned = progression.inventory.some(
              (inventoryItem) =>
                inventoryItem.id === item.id &&
                inventoryItem.slot === slot &&
                inventoryItem.unlocked,
            );
            const worn = progression.equipped[slot] === item.id;
            return (
              <button
                type="button"
                key={item.id}
                className={`wardrobe-item${!owned ? " wardrobe-item-locked" : ""}`}
                aria-pressed={selectedId === item.id}
                disabled={busy}
                onClick={() => select(item.id)}
              >
                <span className="wardrobe-item-heading">
                  <strong>{item.label}</strong>
                  {worn ? (
                    <Check size={16} aria-hidden="true" />
                  ) : owned ? (
                    <Sparkles size={16} aria-hidden="true" />
                  ) : (
                    <LockKeyhole size={16} aria-hidden="true" />
                  )}
                </span>
                <span>{item.description}</span>
                <small>
                  {worn
                    ? "Équipé"
                    : owned
                      ? "Acquis · disponible"
                      : `Verrouillé · ${unlockReason(item)}`}
                </small>
              </button>
            );
          })}
        </div>
        <div className="wardrobe-apply">
          {selectedItem && !unlocked && (
            <p className="progression-note">
              <LockKeyhole size={14} aria-hidden="true" />
              {unlockReason(selectedItem)} pour équiper cette pièce. L’essayage
              est libre.
            </p>
          )}
          <button
            type="button"
            className="primary full"
            disabled={busy || !unlocked || (equipped && !error)}
            onClick={() => void equip()}
          >
            {busy
              ? "Enregistrement…"
              : !unlocked
                ? "Pièce verrouillée"
                : error
                  ? "Réessayer cet équipement"
                  : equipped
                    ? "Déjà équipé"
                    : selectedId === null
                      ? "Retirer de cet emplacement"
                      : "Équiper cette pièce"}
          </button>
        </div>
        {error && (
          <p className="progression-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="progression-earned" role="status">
            <Check size={16} aria-hidden="true" />
            {notice}
          </p>
        )}
        {demo && (
          <p className="progression-demo">
            Démo · ce vestiaire et ses récompenses sont fictifs.
          </p>
        )}
      </div>
    </Sheet>
  );
}
