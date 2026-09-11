import { cooperativeCatalog } from "./cooperative/catalog";
import { expandedCatalog } from "./catalog-expansion";
import type { Action, GameState, Player } from "./game";
import { parisWeek } from "./progression/rules";
export type LifeStats = {
  lost_minutes: number;
  recovered_minutes: number;
  net_lost_minutes: number;
};
export type LossRanking = "gross" | "net";
export type TimeUnit = "auto" | "minutes" | "hours" | "years";
export function lifeStats(
  actions: Pick<Action, "kind" | "minutes_impact" | "created_at">[],
  now = new Date(),
): LifeStats {
  let lost_minutes = 0,
    recovered_minutes = 0;
  for (const action of actions) {
    if (!(Date.parse(action.created_at) <= now.getTime())) continue;
    if (action.kind === "excess")
      lost_minutes += Math.max(0, -action.minutes_impact);
    if (action.kind === "health")
      recovered_minutes += Math.max(0, action.minutes_impact);
  }
  return {
    lost_minutes,
    recovered_minutes,
    net_lost_minutes: lost_minutes - recovered_minutes,
  };
}
export function formatLifeDuration(value: number) {
  if (!Number.isSafeInteger(value)) return "—";
  let remaining = Math.abs(value);
  const parts: string[] = [];
  for (const [size, label] of [
    [525600, "an"],
    [1440, "j"],
    [60, "h"],
    [1, "min"],
  ] as const) {
    const amount = Math.floor(remaining / size);
    remaining %= size;
    if (amount)
      parts.push(
        `${new Intl.NumberFormat("fr-FR").format(amount)} ${label}${label === "an" && amount > 1 ? "s" : ""}`,
      );
  }
  return parts.join(" ") || "0 min";
}
export function formatLifeValue(value: number, unit: TimeUnit) {
  if (unit === "auto") return formatLifeDuration(value);
  if (!Number.isSafeInteger(value)) return "—";
  const amount =
    Math.abs(value) / (unit === "years" ? 525600 : unit === "hours" ? 60 : 1);
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: unit === "years" ? 6 : unit === "hours" ? 2 : 0,
  }).format(amount);
  return `${formatted} ${unit === "years" ? (amount >= 2 ? "ans" : "an") : unit === "hours" ? "h" : "min"}`;
}
export function lossScore(player: Player, mode: LossRanking) {
  return mode === "gross"
    ? (player.weekly_stats?.lost_minutes ?? player.weekly_score)
    : (player.weekly_stats?.net_lost_minutes ?? -player.weekly_score);
}
export function rankByLoss(players: Player[], mode: LossRanking) {
  return [...players].sort(
    (a, b) =>
      lossScore(b, mode) - lossScore(a, mode) || a.id.localeCompare(b.id),
  );
}
export function normalizeDemoTime(
  state: GameState,
  now = new Date(),
): GameState {
  const week = parisWeek(now);
  const weekly_stats = lifeStats(
    state.actions.filter(
      (a) =>
        Date.parse(a.created_at) >= Date.parse(week.start) &&
        Date.parse(a.created_at) < Date.parse(week.end),
    ),
    now,
  );
  const players = state.players.map((p) => {
    const gross = Math.max(0, p.weekly_score);
    const recovered = Math.floor(gross * (p.avatar === 2 ? 0.9 : 0.2));
    const stats =
      p.id === state.id
        ? weekly_stats
        : (p.weekly_stats ?? {
            lost_minutes: gross,
            recovered_minutes: recovered,
            net_lost_minutes: gross - recovered,
          });
    return { ...p, weekly_score: stats.lost_minutes, weekly_stats: stats };
  });
  const ranking = rankByLoss(players, "gross");
  const rankedPlayers = players.map((p) => ({
    ...p,
    official_rank: ranking.findIndex((r) => r.id === p.id) + 1,
  }));
  return {
    ...state,
    catalog: [
      ...state.catalog,
      ...[...expandedCatalog, ...cooperativeCatalog].filter(
        (item) => !state.catalog.some((existing) => existing.id === item.id),
      ),
    ],
    loss_scoring: true,
    life_stats: lifeStats(state.actions, now),
    weekly_stats,
    weekly_score: weekly_stats.lost_minutes,
    players: rankedPlayers,
    league_size: players.length,
    official_rank: ranking.findIndex((p) => p.id === state.id) + 1,
    season_end: week.end,
    nemesis: state.nemesis
      ? (players.find((p) => p.id === state.nemesis!.id) ?? state.nemesis)
      : null,
  };
}
