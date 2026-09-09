import { parisDay, type Action } from "../game";
import type { CompetitionBadge, CompetitionSummary } from "../events/types";
import type { CosmeticDefinition, MissionCode } from "./types";
export function levelForXp(xp: number) {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}
function parisMidnight(day: string) {
  const name = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")!.value;
  const hours = Number(name.replace("GMT", ""));
  return new Date(
    Date.parse(`${day}T00:00:00Z`) - hours * 3600000,
  ).toISOString();
}
export function parisWeek(now = new Date()) {
  const calendar = new Date(`${parisDay(now)}T12:00:00Z`);
  calendar.setUTCDate(calendar.getUTCDate() - ((calendar.getUTCDay() + 6) % 7));
  const start = parisMidnight(calendar.toISOString().slice(0, 10));
  calendar.setUTCDate(calendar.getUTCDate() + 7);
  return { start, end: parisMidnight(calendar.toISOString().slice(0, 10)) };
}
export function competitionAvailable(
  events: CompetitionSummary[],
  week: { start: string; end: string },
) {
  return events.some(
    (e) =>
      (e.status === "published" || e.status === "completed") &&
      Date.parse(e.starts_at) < Date.parse(week.end) &&
      Date.parse(e.ends_at) > Date.parse(week.start),
  );
}
export function missionProgress(
  code: MissionCode,
  actions: Action[],
  events: CompetitionSummary[],
  now = new Date(),
  week = parisWeek(now),
): number {
  const healthy = actions.filter(
    (a) =>
      a.kind === "health" &&
      a.minutes_impact > 0 &&
      Date.parse(a.created_at) >= Date.parse(week.start) &&
      Date.parse(a.created_at) < Date.parse(week.end) &&
      Date.parse(a.created_at) <= now.getTime(),
  );
  if (code === "pause_days")
    return Math.min(
      3,
      new Set(
        healthy
          .filter((a) => a.catalog_id === "pause")
          .map((a) => parisDay(a.created_at)),
      ).size,
    );
  if (code === "healthy_days")
    return Math.min(
      3,
      new Set(healthy.map((a) => parisDay(a.created_at))).size,
    );
  if (code === "healthy_variety")
    return Math.min(3, new Set(healthy.map((a) => a.catalog_id)).size);
  if (code === "new_habit") {
    const previous = new Set(
      actions
        .filter(
          (a) =>
            a.kind === "health" &&
            a.minutes_impact > 0 &&
            Date.parse(a.created_at) < Date.parse(week.start),
        )
        .map((a) => a.catalog_id),
    );
    return Number(healthy.some((a) => !previous.has(a.catalog_id)));
  }
  return Number(
    healthy.some((a) =>
      events.some(
        (e) =>
          e.joined &&
          (e.status === "published" || e.status === "completed") &&
          Date.parse(a.created_at) >= Date.parse(e.starts_at) &&
          Date.parse(a.created_at) < Date.parse(e.ends_at) &&
          (e.metric !== "category_minutes" || e.catalog_id === a.catalog_id),
      ),
    ),
  );
}
export function cosmeticUnlocked(
  item: CosmeticDefinition,
  xp: number,
  badges: CompetitionBadge[],
) {
  return (
    xp >= item.xpRequired &&
    (!item.badgeRequirement ||
      (item.badgeRequirement === "any"
        ? badges.length > 0
        : badges.some((b) => b.kind === "winner")))
  );
}
