import type { CatalogItem } from "../game";
// Coefficients de jeu fictifs, sans estimation médicale.
export const cooperativeCatalog: CatalogItem[] = [
  {
    id: "beer",
    label: "Bière",
    kind: "excess",
    unit: "bière déclarée",
    max_quantity: 5,
    coefficient: -20,
    daily_cap: 0,
    icon: "wine",
  },
  {
    id: "gin-cocktail",
    label: "Cocktail au gin",
    kind: "excess",
    unit: "cocktail",
    max_quantity: 5,
    coefficient: -25,
    daily_cap: 0,
    icon: "wine",
  },
  {
    id: "sport-15",
    label: "Activité sportive · 15 minutes",
    kind: "health",
    unit: "quart d’heure",
    max_quantity: 4,
    coefficient: 20,
    daily_cap: 80,
    icon: "activity",
  },
];
