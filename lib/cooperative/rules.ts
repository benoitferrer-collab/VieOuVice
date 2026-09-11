import type { Action } from "../game";
import { parisDay } from "../game";
import { expandedCatalog } from "../catalog-expansion";
import { cooperativeCatalog } from "./catalog";
import type { ConsumptionSummary, CoopTemplate } from "./types";
export const COOP_TEMPLATES = [
  {
    id: "sport" as const,
    title: "Trois heures ensemble",
    target: 180,
    unit: "minutes de sport",
    description:
      "180 minutes de sport en équipe. Maximum 60 minutes par personne et par jour.",
  },
  {
    id: "walk" as const,
    title: "Prendre l’air ensemble",
    target: 200,
    unit: "minutes de marche",
    description:
      "200 minutes de marche en équipe. Maximum 60 minutes par personne et par jour.",
  },
  {
    id: "pause" as const,
    title: "Le droit de souffler ensemble",
    target: 10,
    unit: "pauses",
    description:
      "Dix pauses en équipe. Une contribution par personne et par jour.",
  },
];
export function templateDefinition(id: string) {
  const t = COOP_TEMPLATES.find((t) => t.id === id);
  if (!t) throw Error("Défi inconnu.");
  return t;
}
export function contribution(
  template: CoopTemplate,
  actions: Action[],
  joined: string,
  ends: string,
  now = new Date().toISOString(),
) {
  templateDefinition(template);
  const days = new Map<string, number>();
  const seen = new Set<string>();
  for (const a of actions) {
    const at = Date.parse(a.created_at);
    if (
      seen.has(a.id) ||
      a.kind !== "health" ||
      a.minutes_impact <= 0 ||
      at < Date.parse(joined) ||
      at >= Date.parse(ends) ||
      at > Date.parse(now)
    )
      continue;
    seen.add(a.id);
    const units =
      template === "sport" && a.catalog_id === "sport-15"
        ? 15
        : template === "walk" && a.catalog_id === "walk"
          ? 20
          : template === "walk" && a.catalog_id === "brisk-walk"
            ? 30
            : template === "pause" && a.catalog_id === "pause"
              ? 1
              : 0;
    const day = parisDay(new Date(at));
    days.set(
      day,
      Math.min(
        template === "pause" ? 1 : 60,
        (days.get(day) ?? 0) + units * a.quantity,
      ),
    );
  }
  return [...days.values()].reduce((a, b) => a + b, 0);
}
const drinks = new Map(
  [
    ...expandedCatalog,
    ...cooperativeCatalog,
    { id: "drink", label: "Verres non précisés", unit: "verre déclaré" },
  ]
    .filter((x) =>
      [
        "beer",
        "gin-cocktail",
        "cocktail-light",
        "cocktail-strong",
        "sweet-cocktail",
        "spirit-shot",
        "standard-drink",
        "drink",
      ].includes(x.id),
    )
    .map((x) => [x.id, x]),
);
export function consumptionSummary(
  actions: Action[],
  days: number,
  now = new Date().toISOString(),
): ConsumptionSummary {
  if (days !== 7 && days !== 30) throw Error("Période invalide.");
  const end = Date.parse(now),
    start = end - days * 86400000;
  const totals = new Map<string, number>();
  const seen = new Set<string>();
  for (const a of actions) {
    const at = Date.parse(a.created_at);
    if (
      seen.has(a.id) ||
      a.kind !== "excess" ||
      !drinks.has(a.catalog_id) ||
      at < start ||
      at > end
    )
      continue;
    seen.add(a.id);
    totals.set(a.catalog_id, (totals.get(a.catalog_id) ?? 0) + a.quantity);
  }
  return {
    days,
    items: [...totals]
      .map(([catalog_id, quantity]) => ({
        catalog_id,
        quantity,
        label: drinks.get(catalog_id)!.label,
        unit: drinks.get(catalog_id)!.unit,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr")),
  };
}
