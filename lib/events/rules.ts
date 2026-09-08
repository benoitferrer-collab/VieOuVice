import type {
  CompetitionDraft,
  CompetitionStanding,
  CompetitionStatus,
} from "./types";
export function competitionPhase(
  event: Pick<CompetitionDraft, "starts_at" | "ends_at"> & {
    status: CompetitionStatus;
  },
  now = new Date(),
) {
  if (event.status !== "published") return event.status;
  if (now.getTime() < Date.parse(event.starts_at)) return "upcoming" as const;
  if (now.getTime() >= Date.parse(event.ends_at)) return "ended" as const;
  return "active" as const;
}
export function competitionScore(
  event: Pick<
    CompetitionDraft,
    "starts_at" | "ends_at" | "metric" | "catalog_id"
  >,
  actions: { created_at: string; catalog_id: string; minutes_impact: number }[],
) {
  const start = Date.parse(event.starts_at),
    end = Date.parse(event.ends_at);
  const eligible = actions.filter((a) => {
    const time = Date.parse(a.created_at);
    return (
      time >= start &&
      time < end &&
      (event.metric === "net_minutes" ||
        (a.minutes_impact > 0 &&
          (event.metric === "health_minutes" ||
            a.catalog_id === event.catalog_id)))
    );
  });
  return {
    score: eligible.reduce((sum, a) => sum + a.minutes_impact, 0),
    action_count: eligible.length,
  };
}
export function rankStandings(
  rows: Omit<CompetitionStanding, "rank">[],
): CompetitionStanding[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || a.user_id.localeCompare(b.user_id),
  );
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.score !== sorted[i - 1].score) rank = i + 1;
    return { ...row, rank };
  });
}
