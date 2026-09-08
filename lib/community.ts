import {
  communityActionSchema,
  type CommunityActionInput,
} from "./validation/community";
import { parisDay, type CatalogItem, type GameState, type Kind } from "./game";
export type CatalogSource = "all" | "official" | "community";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .trim();
export function filterCatalog(
  items: CatalogItem[],
  kind: Kind,
  source: CatalogSource,
  query: string,
) {
  const text = normalize(query);
  return items.filter(
    (item) =>
      item.kind === kind &&
      (source === "all" ||
        (source === "community" ? !!item.creator_id : !item.creator_id)) &&
      normalize(
        item.label + " " + item.unit + " " + (item.creator_name || ""),
      ).includes(text),
  );
}
export function createDemoCatalogItem(
  state: GameState,
  input: CommunityActionInput,
): { state: GameState; item: CatalogItem } {
  const data = communityActionSchema.parse(input);
  const existing = state.catalog.find((c) => c.id === data.p_idempotency_key);
  const coefficient =
    data.p_kind === "health" ? data.p_magnitude : -data.p_magnitude;
  if (existing) {
    if (
      existing.creator_id !== state.id ||
      existing.label !== data.p_label ||
      existing.kind !== data.p_kind ||
      existing.unit !== data.p_unit ||
      existing.coefficient !== coefficient ||
      existing.max_quantity !== data.p_max_quantity
    )
      throw new Error("Cette clé correspond à un contenu différent.");
    return { state, item: existing };
  }
  if (
    state.catalog.filter(
      (c) =>
        c.creator_id === state.id &&
        c.created_at &&
        parisDay(c.created_at) === parisDay(new Date()),
    ).length >= 5
  )
    throw new Error("Tu peux créer cinq actions communautaires par jour.");
  const item: CatalogItem = {
    id: data.p_idempotency_key,
    label: data.p_label,
    kind: data.p_kind,
    unit: data.p_unit,
    max_quantity: data.p_max_quantity,
    coefficient,
    daily_cap: data.p_kind === "health" ? 120 : 0,
    icon: data.p_kind === "health" ? "leaf" : "flame",
    creator_id: state.id,
    creator_name: state.nickname,
    created_at: new Date().toISOString(),
  };
  return { state: { ...state, catalog: [...state.catalog, item] }, item };
}
