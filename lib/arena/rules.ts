export type ArenaMove = "quick" | "heavy" | "guard" | "special";
export type ArenaFighter = {
  user_id: string;
  nickname: string;
  avatar: number;
  hp: number;
  energy: number;
  guard: boolean;
};
export type ArenaDuel = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status:
    "pending" | "active" | "finished" | "declined" | "expired" | "cancelled";
  turn_user_id: string | null;
  turn_number: number;
  deadline: string;
  created_at: string;
  winner_id: string | null;
  finish_reason: string | null;
  fighters: ArenaFighter[];
  moves: {
    turn: number;
    actor_id: string;
    move: ArenaMove;
    damage: number;
    healing: number;
    created_at: string;
  }[];
  reward: number;
};
export const MOVES = {
  quick: {
    label: "Frappe rapide",
    cost: 0,
    description: "12 dégâts · +1 énergie",
  },
  heavy: {
    label: "Frappe lourde",
    cost: 2,
    description: "24 dégâts · −2 énergie",
  },
  guard: {
    label: "Garde",
    cost: 0,
    description: "Prochain coup ÷2 · +2 énergie",
  },
  special: {
    label: "Pouvoir",
    cost: 3,
    description: "Pouvoir de ton personnage · −3 énergie",
  },
} as const;
export const SPECIALS = [
  { damage: 20, heal: 8 },
  { damage: 26, heal: 0 },
  { damage: 12, heal: 16 },
  { damage: 16, heal: 12 },
];
export function combatMove(
  source: ArenaDuel,
  actor: string,
  move: ArenaMove,
  expectedTurn: number,
  now = new Date(),
): ArenaDuel {
  if (
    source.status !== "active" ||
    source.turn_user_id !== actor ||
    source.turn_number !== expectedTurn
  )
    throw Error("Ce tour a déjà changé. Actualise le duel.");
  if (new Date(source.deadline).getTime() <= now.getTime())
    throw Error("Le délai de ce tour est terminé.");
  const d = structuredClone(source),
    a = d.fighters.find((f) => f.user_id === actor)!,
    b = d.fighters.find((f) => f.user_id !== actor)!;
  if (!MOVES[move] || a.energy < MOVES[move].cost)
    throw Error("Énergie insuffisante.");
  a.energy -= MOVES[move].cost;
  let damage = 0,
    healing = 0;
  if (move === "quick") {
    damage = 12;
    a.energy = Math.min(4, a.energy + 1);
  }
  if (move === "heavy") damage = 24;
  if (move === "guard") {
    a.guard = true;
    a.energy = Math.min(4, a.energy + 2);
  }
  if (move === "special") {
    const s = SPECIALS[((a.avatar % 4) + 4) % 4];
    damage = s.damage;
    healing = Math.min(s.heal, 100 - a.hp);
    a.hp += healing;
  }
  if (damage && b.guard) {
    damage = Math.ceil(damage / 2);
    b.guard = false;
  }
  damage = Math.min(b.hp, damage);
  b.hp = Math.max(0, b.hp - damage);
  d.moves.push({
    turn: expectedTurn,
    actor_id: actor,
    move,
    damage,
    healing,
    created_at: now.toISOString(),
  });
  d.turn_number++;
  d.turn_user_id = b.user_id;
  d.deadline = new Date(now.getTime() + 86400000).toISOString();
  if (!b.hp || d.moves.length >= 40) {
    d.status = "finished";
    d.turn_user_id = null;
    d.finish_reason = !b.hp ? "ko" : "turn_limit";
    d.winner_id = a.hp === b.hp ? null : a.hp > b.hp ? a.user_id : b.user_id;
  }
  return d;
}
export function arenaReward(d: ArenaDuel, claimedToday: number) {
  return d.status === "finished" &&
    !!d.winner_id &&
    ["ko", "turn_limit"].includes(d.finish_reason ?? "") &&
    d.fighters.every(
      (f) => d.moves.filter((m) => m.actor_id === f.user_id).length >= 3,
    )
    ? Math.max(0, Math.min(10, 30 - claimedToday))
    : 0;
}
