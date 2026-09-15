"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, LockKeyhole, Sparkles } from "lucide-react";
import { PurchaseError, purchaseCosmetic } from "@/lib/progression/purchase";
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
  progression: incoming,
  rpc,
  changed,
  demo,
  variant,
  onClose,
}: WardrobeProps) {
  const lock = useRef(false);
  // Keep this dialogue's confirmed snapshot; an older parent refresh must not
  // overwrite an acknowledged purchase while the wardrobe is open.
  const [progression, setProgression] = useState(incoming);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"shop" | "collection">("shop");
  const [confirm, setConfirm] = useState(false);
  const [slot, setSlot] = useState<CosmeticSlot>("accessory");
  const [preview, setPreview] = useState(progression.equipped);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void rpc<typeof incoming>("get_progression")
      .then((fresh) => {
        if (active) {
          setProgression(fresh);
          setRecoveryRequired(false);
        }
      })
      .catch(() => {
        if (active) {
          setRecoveryRequired(true);
          setError("Actualise le portefeuille avant de continuer.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rpc]);

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
    setConfirm(false);
    setPreview((current) => ({ ...current, [slot]: itemId }));
    setError("");
    setNotice("");
  }

  async function buy() {
    if (
      lock.current ||
      loading ||
      !selectedItem ||
      selectedItem.price === undefined ||
      unlocked ||
      !progression.wallet ||
      recoveryRequired
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await purchaseCosmetic(rpc, selectedItem.id);
      setProgression(
        result.progression || {
          ...progression,
          wallet: result.wallet,
          inventory: progression.inventory.map((i) =>
            i.id === selectedItem.id ? { ...i, unlocked: true } : i,
          ),
        },
      );
      setConfirm(false);
      setNotice("Achat confirmé. Tu peux maintenant équiper cette pièce.");
    } catch (caught) {
      const refreshed =
        caught instanceof PurchaseError ? caught.progression : undefined;
      if (refreshed) setProgression(refreshed);
      setRecoveryRequired(!refreshed);
      setConfirm(false);
      setError(
        (caught instanceof Error ? caught.message : "Achat non confirmé.") +
          " Une pièce ne sera débitée qu’une seule fois.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function recover() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const fresh = await rpc<typeof incoming>("get_progression");
      setProgression(fresh);
      setRecoveryRequired(false);
      setError("");
      setNotice("Portefeuille et collection actualisés.");
    } catch {
      setError(
        "Reconnexion nécessaire pour vérifier le résultat de l’achat. Aucun nouvel achat ne sera envoyé avant cette vérification.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function equip() {
    if (lock.current || loading || !unlocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await rpc("equip_cosmetic", { p_slot: slot, p_item_id: selectedId });
      setProgression({
        ...progression,
        equipped: { ...progression.equipped, [slot]: selectedId },
      });
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
    <Sheet
      title="Ton vestiaire"
      className="shop-sheet"
      onClose={() => {
        if (!lock.current) {
          void changed();
          onClose();
        }
      }}
    >
      <div className="wardrobe" aria-busy={busy || loading}>
        <div className="shop-wallet">
          <div>
            <span>Ton portefeuille</span>
            <strong>
              {progression.wallet
                ? `${progression.wallet.balance} Éclats`
                : "Boutique bientôt disponible"}
            </strong>
          </div>
          <Sparkles size={26} aria-hidden="true" />
          {loading && (
            <small role="status">Actualisation du portefeuille…</small>
          )}
          <small>50 XP gagnés = 25 Éclats · tes XP restent acquis.</small>
        </div>
        <div
          className="wardrobe-slots shop-views"
          role="group"
          aria-label="Boutique ou collection"
        >
          <button
            disabled={busy || loading}
            aria-pressed={view === "shop"}
            onClick={() => {
              setView("shop");
              setConfirm(false);
            }}
          >
            Boutique
          </button>
          <button
            disabled={busy || loading}
            aria-pressed={view === "collection"}
            onClick={() => {
              setView("collection");
              setConfirm(false);
            }}
          >
            Ma collection
          </button>
        </div>
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
              disabled={busy || loading}
              onClick={() => {
                setSlot(item.id);
                setConfirm(false);
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
          {view === "collection" && (
            <button
              type="button"
              className="wardrobe-item"
              aria-pressed={selectedId === null}
              disabled={busy || loading}
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
          )}
          {COSMETICS.filter(
            (item) =>
              item.slot === slot &&
              (view === "shop"
                ? item.price !== undefined
                : item.price === undefined ||
                  progression.inventory.some(
                    (i) => i.id === item.id && i.unlocked,
                  )),
          ).map((item) => {
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
                disabled={busy || loading}
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
                {item.animated && (
                  <span className="shop-animated-label">
                    ✦ Animé sur le profil
                  </span>
                )}
                <small>
                  {worn
                    ? "Équipé"
                    : owned
                      ? "Acquis · disponible"
                      : item.price !== undefined
                        ? `${item.price} Éclats`
                        : `Verrouillé · ${unlockReason(item)}`}
                </small>
              </button>
            );
          })}
        </div>
        <div className="wardrobe-apply">
          {selectedItem && !unlocked && selectedItem.price === undefined && (
            <p className="progression-note">
              <LockKeyhole size={14} aria-hidden="true" />
              {unlockReason(selectedItem)} pour équiper cette pièce. L’essayage
              est libre.
            </p>
          )}
          {recoveryRequired ? (
            <button
              className="primary full"
              disabled={busy || loading}
              onClick={() => void recover()}
            >
              {busy ? "Vérification…" : "Actualiser le portefeuille"}
            </button>
          ) : selectedItem?.price !== undefined && !unlocked ? (
            <div className="shop-purchase">
              <strong>
                {selectedItem.label} · {selectedItem.price} Éclats
              </strong>
              {!progression.wallet ? (
                <p>La boutique n’est pas encore activée sur ce serveur.</p>
              ) : progression.wallet.balance < selectedItem.price ? (
                <p>
                  Il te manque {selectedItem.price - progression.wallet.balance}{" "}
                  Éclats. Tes missions t’aideront à les gagner.
                </p>
              ) : confirm ? (
                <>
                  <p>
                    Acheter cette pièce pour {selectedItem.price} Éclats ? Elle
                    restera dans ta collection.
                  </p>
                  <button
                    className="primary full"
                    disabled={busy || loading}
                    onClick={() => void buy()}
                  >
                    {busy
                      ? "Vérification…"
                      : `Confirmer · ${selectedItem.price} Éclats`}
                  </button>
                  <button
                    className="secondary full"
                    disabled={busy || loading}
                    onClick={() => setConfirm(false)}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <button
                  className="primary full"
                  disabled={busy || loading}
                  onClick={() => setConfirm(true)}
                >
                  Acheter · {selectedItem.price} Éclats
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="primary full"
              disabled={busy || loading || !unlocked || (equipped && !error)}
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
          )}
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
