"use client";
import { useEffect, useState } from "react";
import { Check, ArrowRight, Minus, Plus, Search, Users } from "lucide-react";
import { readDraft, writeDraft } from "@/lib/draft";
import { signed, type CatalogItem, type Kind } from "@/lib/game";
import { Sheet } from "./sheet";
import { ActionIcon } from "./action-icon";
import { CommunityActionForm } from "./community-action-form";
import { filterCatalog, type CatalogSource } from "@/lib/community";
import type { CommunityActionInput } from "@/lib/validation/community";

export function ActionSheet({
  scope,
  kind,
  items,
  onClose,
  record,
  demo,
  communityEnabled,
  create,
}: {
  scope: string;
  kind: Kind;
  items: CatalogItem[];
  onClose: () => void;
  record: (item: CatalogItem, quantity: number, key: string) => Promise<number>;
  demo: boolean;
  communityEnabled: boolean;
  create: (input: CommunityActionInput) => Promise<CatalogItem>;
}) {
  const [creating, setCreating] = useState(false);
  const [source, setSource] = useState<CatalogSource>("all");
  const [query, setQuery] = useState("");
  const storageKey = "exces:draft:" + scope + ":" + kind;
  const [initial] = useState(() => readDraft(storageKey));
  const initialItem = items.find(
    (i) => i.id === initial?.catalogId && i.kind === kind,
  );
  const [selected, setSelected] = useState<CatalogItem | null>(
    initialItem || null,
  );
  const [quantity, setQuantity] = useState(
    initialItem ? initial?.quantity || 1 : 1,
  );
  const [intent, setIntent] = useState<{
    key: string;
    item: CatalogItem;
    quantity: number;
  } | null>(
    initial?.pending && initialItem
      ? { key: initial.key, item: initialItem, quantity: initial.quantity }
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<number | null>(null);
  useEffect(() => {
    if (result !== null) {
      writeDraft(storageKey, null);
      return;
    }
    if (selected)
      writeDraft(storageKey, {
        catalogId: selected.id,
        quantity,
        key: intent?.key || crypto.randomUUID(),
        pending: !!intent,
      });
  }, [selected, quantity, intent, result, storageKey]);
  async function confirm() {
    if (!selected || busy) return;
    const pending = intent || {
      key: crypto.randomUUID(),
      item: selected,
      quantity,
    };
    setIntent(pending);
    writeDraft(storageKey, {
      catalogId: pending.item.id,
      quantity: pending.quantity,
      key: pending.key,
      pending: true,
    });
    setBusy(true);
    setError("");
    try {
      const impact = await record(pending.item, pending.quantity, pending.key);
      writeDraft(storageKey, null);
      setResult(impact);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aucun mouvement confirmé.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={
        creating
          ? "Créer une action"
          : result !== null
            ? "C’est dans le journal."
            : kind === "health"
              ? "Une bonne habitude"
              : "Un petit écart"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {creating ? (
        <CommunityActionForm
          kind={kind}
          demo={demo}
          create={create}
          onCancel={() => setCreating(false)}
          onCreated={(item) => {
            setSelected(item);
            setQuantity(1);
            setQuery("");
            setSource("community");
            setCreating(false);
            setError("");
          }}
        />
      ) : result !== null ? (
        <div className="action-success">
          <span className="success-icon">
            <Check size={30} />
          </span>
          <h3 className={kind === "health" ? "lime" : "coral"}>
            {signed(result)}{" "}
            <small>
              {result > 0
                ? "min de vie gagnées"
                : result < 0
                  ? "min de vie perdues"
                  : "min de vie"}
            </small>
          </h3>
          <p>
            {result === 0
              ? "Plafond du jour atteint. L’action est enregistrée sans gain supplémentaire."
              : kind === "health"
                ? "Un petit pas. Une jolie avancée."
                : "C’est noté. Demain est un autre jour."}
          </p>
          <p className="fine-print">
            {demo
              ? "Simulation de démo enregistrée dans ce navigateur."
              : "Mouvement confirmé par le serveur."}
          </p>
          <button className="primary full" onClick={onClose}>
            Retour à ma partie <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          {initial && (
            <p className="notice">
              Brouillon retrouvé. Rien ne sera envoyé sans ta confirmation.
            </p>
          )}
          <p className="muted sheet-description">
            {kind === "health"
              ? "Les petites habitudes font leur chemin."
              : "Sans jugement. On tient juste le compte du jeu."}
          </p>
          <p className="muted sheet-description">
            Barèmes fictifs : choisis une seule catégorie pour une même
            consommation ou activité.
          </p>
          {communityEnabled && (
            <button
              type="button"
              className="community-create secondary full"
              disabled={busy || !!intent}
              onClick={() => setCreating(true)}
            >
              <Plus size={18} />
              Créer {kind === "health" ? "une bonne action" : "un petit écart"}
              <Users size={18} />
            </button>
          )}
          <label className="catalog-search">
            <span className="sr-only">Rechercher une action</span>
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une action…"
              disabled={busy || !!intent}
            />
          </label>
          <div className="segmented" aria-label="Origine des actions">
            {(["all", "official", "community"] as const).map((filter) => (
              <button
                type="button"
                key={filter}
                className={source === filter ? "selected" : ""}
                aria-pressed={source === filter}
                onClick={() => setSource(filter)}
              >
                {filter === "all"
                  ? "Toutes"
                  : filter === "official"
                    ? "Officielles"
                    : "Communauté"}
              </button>
            ))}
          </div>
          {filterCatalog(items, kind, source, query).length === 0 && (
            <p className="empty-copy">
              Aucune action trouvée.
              {communityEnabled ? " Crée la première pour la communauté." : ""}
            </p>
          )}
          <div className="catalog-grid">
            {filterCatalog(items, kind, source, query).map((item) => (
              <button
                className={
                  "catalog-option " +
                  (selected?.id === item.id ? "selected" : "")
                }
                disabled={busy || !!intent}
                key={item.id}
                onClick={() => {
                  setSelected(item);
                  setQuantity(1);
                  setError("");
                }}
              >
                <span className={kind === "health" ? "lime" : "coral"}>
                  <ActionIcon name={item.icon} />
                </span>
                <strong>{item.label}</strong>
                <span className="small muted">
                  {signed(item.coefficient)} min / unité
                </span>
                {item.creator_id && (
                  <span className="catalog-author">
                    <Users size={11} />
                    Par {item.creator_name || "un joueur"}
                  </span>
                )}
                {selected?.id === item.id && (
                  <Check className="selection-check" size={14} />
                )}
              </button>
            ))}
          </div>
          {selected && (
            <>
              <div className="quantity-row">
                <div>
                  <strong>Quelle quantité ?</strong>
                  <span className="small muted">{selected.unit}</span>
                </div>
                <div className="stepper">
                  <button
                    aria-label="Diminuer la quantité"
                    disabled={quantity <= 1 || busy || !!intent}
                    onClick={() => setQuantity((q) => q - 1)}
                  >
                    <Minus size={17} />
                  </button>
                  <output>{quantity}</output>
                  <button
                    aria-label="Augmenter la quantité"
                    disabled={
                      quantity >= selected.max_quantity || busy || !!intent
                    }
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              {kind === "health" && (
                <p className="notice">
                  Gain plafonné à {selected.daily_cap} min de vie par jour pour
                  cette catégorie.{" "}
                  {selected.creator_id
                    ? "Toutes les bonnes actions communautaires partagent aussi un plafond de 150 min par jour."
                    : ""}{" "}
                  Le serveur confirme le montant final.
                </p>
              )}
            </>
          )}
          <p role="alert" className="feedback coral">
            {error}
          </p>
          <button
            className={
              "primary full " + (kind === "excess" ? "coral-button" : "")
            }
            disabled={!selected || busy}
            onClick={() => void confirm()}
          >
            {busy
              ? "Confirmation en cours…"
              : intent
                ? "Réessayer cette déclaration"
                : "Confirmer ma déclaration"}
            <Check size={18} />
          </button>
          <p className="fine-print">
            Aucun calcul de santé. Aucun conseil médical.
          </p>
        </>
      )}
    </Sheet>
  );
}
