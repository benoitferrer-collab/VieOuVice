import type { GameState } from "../game";
import {
  arenaReward,
  combatMove,
  type ArenaDuel,
  type ArenaMove,
} from "./rules";
export type ArenaDemo = {
  duels: ArenaDuel[];
  requests: Record<string, string>;
  grants: Record<string, { day: string; amount: number; winner: string }>;
};
export function emptyArena(): ArenaDemo {
  return { duels: [], requests: {}, grants: {} };
}
export function demoArenaRpc(
  state: ArenaDemo,
  game: GameState,
  name: string,
  p: Record<string, unknown> = {},
): unknown {
  const now = new Date(),
    day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      now,
    );
  for (const d of state.duels) {
    if (
      ["pending", "active"].includes(d.status) &&
      !game.friends.some(
        (f) => f.id === d.opponent_id && f.status === "accepted",
      )
    ) {
      d.status = "cancelled";
      d.turn_user_id = null;
      d.finish_reason = "unavailable";
    }

    if (
      ["pending", "active"].includes(d.status) &&
      Date.parse(d.deadline) <= now.getTime()
    ) {
      if (d.status === "pending") d.status = "expired";
      else {
        d.status = "finished";
        d.finish_reason = "timeout";
        d.winner_id = d.fighters.find(
          (f) => f.user_id !== d.turn_user_id,
        )!.user_id;
      }
      d.turn_user_id = null;
    }
  }
  if (name === "get_arena") return { duels: state.duels.slice(0, 30) };
  if (name === "arena_invite") {
    const known = state.duels.find(
      (d) => d.id === state.requests[String(p.p_request_id)],
    );
    if (known) {
      if (known.opponent_id !== p.p_friend_id)
        throw Error("Invitation différente.");
      return known;
    }
    const friend = game.friends.find(
      (f) => f.id === p.p_friend_id && f.status === "accepted",
    );
    if (!friend) throw Error("Choisis un ami accepté.");
    if (
      state.duels.some(
        (d) =>
          ["pending", "active"].includes(d.status) &&
          d.opponent_id === friend.id,
      )
    )
      throw Error("Un duel est déjà ouvert avec cet ami.");
    if (
      state.duels.filter((d) => ["pending", "active"].includes(d.status))
        .length >= 3
    )
      throw Error("Trois duels maximum à la fois.");
    if (
      state.duels.filter(
        (d) =>
          new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
            new Date(d.created_at),
          ) === day,
      ).length >= 10
    )
      throw Error("Dix invitations maximum par jour.");
    const d: ArenaDuel = {
      id: crypto.randomUUID(),
      challenger_id: game.id,
      opponent_id: friend.id,
      status: "active",
      turn_user_id: friend.id,
      turn_number: 1,
      deadline: new Date(+now + 86400000).toISOString(),
      created_at: now.toISOString(),
      winner_id: null,
      finish_reason: null,
      reward: 0,
      moves: [],
      fighters: [game, friend].map((f) => ({
        user_id: f.id,
        nickname: f.nickname,
        avatar: f.avatar,
        hp: 100,
        energy: 2,
        guard: false,
      })),
    };
    // The labelled simulator accepts immediately and takes the opponent's first turn.
    const started = combatMove(d, friend.id, "guard", 1);
    state.duels.unshift(started);
    state.requests[String(p.p_request_id)] = d.id;
    return started;
  }
  const index = state.duels.findIndex((d) => d.id === p.p_duel_id);
  if (index < 0) throw Error("Duel introuvable.");
  let d = state.duels[index];
  if (name === "get_arena_duel") return d;
  if (name === "arena_surrender") {
    if (d.status !== "active") throw Error("Ce duel est terminé.");
    d.status = "finished";
    d.winner_id = d.fighters.find((f) => f.user_id !== game.id)!.user_id;
    d.finish_reason = "surrender";
    d.turn_user_id = null;
  } else if (name === "arena_move") {
    const old = d.moves.find((m) => m.turn === Number(p.p_expected_turn));
    if (old) {
      if (old.actor_id === game.id && old.move === p.p_move) return d;
      throw Error("Ce tour a déjà été joué.");
    }

    d = combatMove(
      d,
      game.id,
      p.p_move as ArenaMove,
      Number(p.p_expected_turn),
    );
    if (d.status === "active") {
      const bot = d.fighters.find((f) => f.user_id !== game.id)!;
      const move: ArenaMove =
        bot.energy >= 3
          ? "special"
          : bot.energy >= 2 && d.turn_number % 3 === 0
            ? "heavy"
            : "quick";
      d = combatMove(d, bot.user_id, move, d.turn_number);
    }
  } else if (name !== "arena_surrender")
    throw Error("Action indisponible dans le simulateur.");
  if (d.status === "finished" && !state.grants[d.id]) {
    const earned = Object.values(state.grants)
      .filter((g) => g.day === day && g.winner === d.winner_id)
      .reduce((a, g) => a + g.amount, 0);
    const reward = arenaReward(d, earned);
    state.grants[d.id] = { day, amount: reward, winner: d.winner_id ?? "" };
    d.reward = d.winner_id === game.id ? reward : 0;
  }
  state.duels[index] = d;
  return d;
}
