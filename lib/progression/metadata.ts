import type { CosmeticDefinition, MissionCode, Reaction } from "./types";
export const REACTIONS: { code: Reaction; emoji: string; label: string }[] = [
  { code: "clap", emoji: "👏", label: "Bravo" },
  { code: "strength", emoji: "💪", label: "Courage" },
  { code: "laugh", emoji: "😂", label: "Ça me fait rire" },
];
export const MISSION_DEFINITIONS: {
  code: MissionCode;
  label: string;
  description: string;
  target: number;
}[] = [
  {
    code: "pause_days",
    label: "Le droit de souffler",
    description: "Déclare une vraie pause sur trois jours différents.",
    target: 3,
  },
  {
    code: "healthy_days",
    label: "Pas après pas",
    description: "Déclare une bonne habitude sur trois jours différents.",
    target: 3,
  },
  {
    code: "healthy_variety",
    label: "Changer d’air",
    description: "Essaie trois catégories de bonnes habitudes cette semaine.",
    target: 3,
  },
  {
    code: "new_habit",
    label: "Une première fois",
    description:
      "Essaie une bonne habitude jamais déclarée avant cette semaine.",
    target: 1,
  },
  {
    code: "competition_action",
    label: "Dans l’arène",
    description:
      "Réalise une bonne action éligible dans une compétition à laquelle tu participes.",
    target: 1,
  },
];
export const COSMETICS: CosmeticDefinition[] = [
  {
    id: "encore_debout",
    slot: "title",
    label: "Encore debout",
    description: "Ton premier titre de survivant.",
    xpRequired: 50,
  },
  {
    id: "leaf_pin",
    slot: "accessory",
    label: "Broche feuillue",
    description: "Un petit signe de tes bonnes habitudes.",
    xpRequired: 100,
  },
  {
    id: "aurora",
    slot: "background",
    label: "Aurore boréale",
    description: "Un ciel vert et violet autour de ton avatar.",
    xpRequired: 150,
  },
  {
    id: "pas_apres_pas",
    slot: "title",
    label: "Pas après pas",
    description: "Ta progression a trouvé son rythme.",
    xpRequired: 300,
  },
  {
    id: "halo",
    slot: "accessory",
    label: "Halo de survie",
    description: "Une couronne de lumière pour ta silhouette.",
    xpRequired: 450,
  },
  {
    id: "constellation",
    slot: "background",
    label: "Constellation",
    description: "Un ciel étoilé pour ta prochaine aventure.",
    xpRequired: 600,
  },
  {
    id: "laurel",
    slot: "accessory",
    label: "Couronne de laurier",
    description: "Obtiens un badge de compétition.",
    xpRequired: 0,
    badgeRequirement: "any",
  },
  {
    id: "arena",
    slot: "title",
    label: "Dans l’arène",
    description: "Obtiens un badge de compétition.",
    xpRequired: 0,
    badgeRequirement: "any",
  },
  {
    id: "golden",
    slot: "background",
    label: "Aube dorée",
    description: "Remporte un badge gagnant de compétition.",
    xpRequired: 0,
    badgeRequirement: "winner",
  },
  {
    id: "cosmic_traveler",
    slot: "title",
    label: "Voyageur cosmique",
    description: "Un titre pour partir vers de nouveaux horizons.",
    xpRequired: 0,
    price: 25,
    animated: false,
  },
  {
    id: "forest_spirit",
    slot: "title",
    label: "Esprit de la forêt",
    description: "Une présence paisible parmi les survivants.",
    xpRequired: 0,
    price: 25,
    animated: false,
  },
  {
    id: "neighborhood_star",
    slot: "title",
    label: "Étoile du quartier",
    description: "Une signature qui brille auprès de tes amis.",
    xpRequired: 0,
    price: 50,
    animated: false,
  },
  {
    id: "friendly_star",
    slot: "accessory",
    label: "Étoile complice",
    description: "Une broche étoilée pour ta prochaine aventure.",
    xpRequired: 0,
    price: 50,
    animated: false,
  },
  {
    id: "lunar_crown",
    slot: "accessory",
    label: "Couronne lunaire",
    description: "Un croissant argenté au-dessus de ta capuche.",
    xpRequired: 0,
    price: 75,
    animated: false,
  },
  {
    id: "light_satellites",
    slot: "accessory",
    label: "Satellites lumineux",
    description: "Trois petites lumières tournent autour de toi.",
    xpRequired: 0,
    price: 100,
    animated: true,
  },
  {
    id: "astral_mist",
    slot: "background",
    label: "Brume astrale",
    description: "Un nuage mauve au cœur du cosmos.",
    xpRequired: 0,
    price: 50,
    animated: false,
  },
  {
    id: "firefly_garden",
    slot: "background",
    label: "Jardin des lucioles",
    description: "Des lucioles scintillent dans un écrin végétal.",
    xpRequired: 0,
    price: 100,
    animated: true,
  },
  {
    id: "cosmic_portal",
    slot: "background",
    label: "Portail cosmique",
    description: "Un anneau céleste accompagne tes aventures.",
    xpRequired: 0,
    price: 150,
    animated: true,
  },
];
export const emptyLook = () => ({
  accessory: null,
  title: null,
  background: null,
});
