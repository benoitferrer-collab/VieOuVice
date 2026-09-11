import { cooperativeCatalog } from "./cooperative/catalog";
import { expandedCatalog } from "./catalog-expansion";
import { normalizeDemoTime, type LifeStats } from "./life-time";
export type Kind = "excess" | "health";
export type CatalogItem = {
  id: string;
  label: string;
  kind: Kind;
  unit: string;
  max_quantity: number;
  coefficient: number;
  daily_cap: number;
  icon: string;
  creator_id?: string | null;
  creator_name?: string | null;
  created_at?: string | null;
};
export type Action = {
  id: string;
  catalog_id: string;
  label: string;
  kind: Kind;
  quantity: number;
  minutes_impact: number;
  created_at: string;
  idempotency_key: string;
};
export type Player = {
  id: string;
  nickname: string;
  avatar: number;
  weekly_score: number;
  weekly_stats?: LifeStats;
  official_rank?: number;
};
export type Friend = {
  id: string;
  nickname: string;
  avatar: number;
  status: "pending" | "accepted";
  incoming: boolean;
};
export type SocialSettings = {
  share_activity: boolean;
  notify_friends: boolean;
  notify_duels: boolean;
};
export type Notice = {
  id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  kind?: string;
  actor_id?: string | null;
  target_tab?: "survie" | "ligue" | "nemesis" | "amis";
};
export type GameState = {
  id: string;
  nickname: string;
  avatar: number;
  balance: number;
  weekly_score: number;
  loss_scoring?: boolean;
  official_rank?: number;
  league_size?: number;
  life_stats?: LifeStats;
  weekly_stats?: LifeStats;
  actions: Action[];
  catalog: CatalogItem[];
  players: Player[];
  friends: Friend[];
  notifications: Notice[];
  nemesis: Player | null;
  pvp: boolean;
  calm: boolean;
  soft: boolean;
  trophies: string[];
  season_end: string;
  league_name: string;
  community_enabled?: boolean;
  social_settings?: SocialSettings;
};
export const catalog: CatalogItem[] = [
  ...expandedCatalog,
  ...cooperativeCatalog,
  {
    id: "walk",
    label: "Prendre l’air",
    kind: "health",
    unit: "balade de 20 min",
    max_quantity: 3,
    coefficient: 25,
    daily_cap: 75,
    icon: "footprints",
  },
  {
    id: "sleep",
    label: "Une bonne nuit",
    kind: "health",
    unit: "heure de sommeil",
    max_quantity: 12,
    coefficient: 10,
    daily_cap: 80,
    icon: "moon",
  },
  {
    id: "move",
    label: "Bouger un peu",
    kind: "health",
    unit: "séance douce",
    max_quantity: 2,
    coefficient: 40,
    daily_cap: 80,
    icon: "activity",
  },
  {
    id: "pause",
    label: "Une vraie pause",
    kind: "health",
    unit: "pause sans écran",
    max_quantity: 3,
    coefficient: 15,
    daily_cap: 45,
    icon: "leaf",
  },
  {
    id: "drink",
    label: "Un verre de trop",
    kind: "excess",
    unit: "verre déclaré",
    max_quantity: 10,
    coefficient: -30,
    daily_cap: 0,
    icon: "wine",
  },
  {
    id: "snack",
    label: "Craquage gourmand",
    kind: "excess",
    unit: "craquage",
    max_quantity: 5,
    coefficient: -20,
    daily_cap: 0,
    icon: "pizza",
  },
  {
    id: "screen",
    label: "Scroll sans fin",
    kind: "excess",
    unit: "heure d’écran tardif",
    max_quantity: 8,
    coefficient: -15,
    daily_cap: 0,
    icon: "phone",
  },
  {
    id: "night",
    label: "Nuit écourtée",
    kind: "excess",
    unit: "nuit déclarée",
    max_quantity: 1,
    coefficient: -50,
    daily_cap: 0,
    icon: "coffee",
  },
];
export function statusFor(balance: number) {
  return balance <= 0
    ? {
        name: "Zombie",
        className: "coral",
        message: "Solde dans le rouge. Partie toujours ouverte.",
      }
    : balance <= 250
      ? {
          name: "Funambule",
          className: "amber",
          message: "Ça se joue sur un fil.",
        }
      : balance < 2000
        ? {
            name: "Survivant",
            className: "lime",
            message: "La Faucheuse attendra.",
          }
        : {
            name: "Divinité",
            className: "lime",
            message: "L’Olympe te garde une place.",
          };
}
export const gaugePercent = (balance: number) =>
  Math.min(100, Math.max(0, (balance / 2000) * 100));
export const promotionCount = (count: number) => Math.floor(count / 6);
export const parisDay = (instant: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
export const signed = (n: number) =>
  (n > 0 ? "+" : "") + new Intl.NumberFormat("fr-FR").format(n);
export function makeDemo(): GameState {
  const now = new Date();
  const time = (h: number) =>
    new Date(now.getTime() - h * 3600000).toISOString();
  return normalizeDemoTime({
    id: "demo-you",
    nickname: "Mortel_mais_pas_trop",
    avatar: 0,
    balance: 845,
    weekly_score: 185,
    community_enabled: true,
    social_settings: {
      share_activity: false,
      notify_friends: true,
      notify_duels: true,
    },
    pvp: false,
    calm: false,
    soft: false,
    trophies: ["first-step"],
    season_end: new Date(now.getTime() + 4 * 86400000).toISOString(),
    league_name: "Ligue des Survivants",
    catalog,
    actions: [
      {
        id: "demo-1",
        catalog_id: "walk",
        label: "Prendre l’air",
        kind: "health",
        quantity: 1,
        minutes_impact: 25,
        created_at: time(1),
        idempotency_key: "seed1",
      },
      {
        id: "demo-2",
        catalog_id: "snack",
        label: "Craquage gourmand",
        kind: "excess",
        quantity: 1,
        minutes_impact: -20,
        created_at: time(3),
        idempotency_key: "seed2",
      },
      {
        id: "demo-3",
        catalog_id: "sleep",
        label: "Une bonne nuit",
        kind: "health",
        quantity: 8,
        minutes_impact: 80,
        created_at: time(6),
        idempotency_key: "seed3",
      },
    ],
    players: [
      {
        id: "demo-cleo",
        nickname: "Cléo_patatra",
        avatar: 2,
        weekly_score: 320,
      },
      { id: "demo-sam", nickname: "Sam_Suffit", avatar: 1, weekly_score: 240 },
      {
        id: "demo-you",
        nickname: "Mortel_mais_pas_trop",
        avatar: 0,
        weekly_score: 185,
      },
      { id: "demo-jo", nickname: "Jo_le_zombie", avatar: 3, weekly_score: 160 },
      { id: "demo-lou", nickname: "Lou_pé", avatar: 1, weekly_score: 95 },
      { id: "demo-max", nickname: "Max_de_repos", avatar: 2, weekly_score: 60 },
    ],
    nemesis: {
      id: "demo-sam",
      nickname: "Sam_Suffit",
      avatar: 1,
      weekly_score: 240,
    },
    friends: [
      {
        id: "demo-sam",
        nickname: "Sam_Suffit",
        avatar: 1,
        status: "accepted",
        incoming: false,
      },
      {
        id: "demo-jo",
        nickname: "Jo_le_zombie",
        avatar: 3,
        status: "accepted",
        incoming: false,
      },
    ],
    notifications: [
      {
        id: "welcome",
        message: "Bienvenue dans la démo. Ta première vie commence ici.",
        created_at: time(1),
        read_at: null,
      },
    ],
  });
}
// Simulation only. Connected mutations always go through PostgreSQL.
export function applyDemoAction(
  state: GameState,
  item: CatalogItem,
  quantity: number,
  key: string,
): GameState {
  const old = state.actions.find((x) => x.idempotency_key === key);
  if (old) {
    if (old.catalog_id !== item.id || old.quantity !== quantity)
      throw new Error("Cette clé correspond à une autre déclaration.");
    return state;
  }
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > item.max_quantity
  )
    throw new Error("Quantité non autorisée.");
  const date = new Date().toISOString();
  const today = parisDay(date);
  const used = state.actions
    .filter((a) => a.catalog_id === item.id && parisDay(a.created_at) === today)
    .reduce((n, a) => n + Math.max(0, a.minutes_impact), 0);
  const communityUsed = state.actions
    .filter(
      (a) =>
        a.kind === "health" &&
        parisDay(a.created_at) === today &&
        state.catalog.some((c) => c.id === a.catalog_id && c.creator_id),
    )
    .reduce((n, a) => n + Math.max(0, a.minutes_impact), 0);
  const impact =
    item.kind === "health"
      ? Math.max(
          0,
          Math.min(
            item.coefficient * quantity,
            item.daily_cap - used,
            item.creator_id ? 150 - communityUsed : Infinity,
          ),
        )
      : item.coefficient * quantity;
  return normalizeDemoTime({
    ...state,
    balance: state.balance + impact,
    weekly_score: state.weekly_score + impact,
    actions: [
      {
        id: key,
        catalog_id: item.id,
        label: item.label,
        kind: item.kind,
        quantity,
        minutes_impact: impact,
        created_at: date,
        idempotency_key: key,
      },
      ...state.actions,
    ],
    players: state.players.map((p) =>
      p.id === state.id
        ? { ...p, weekly_score: state.weekly_score + impact }
        : p,
    ),
  });
}
