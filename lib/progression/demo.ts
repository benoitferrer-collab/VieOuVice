import type { GameState } from "../game";
import type { CompetitionBadge, CompetitionSummary } from "../events/types";
import { COSMETICS, MISSION_DEFINITIONS, emptyLook } from "./metadata";
import {
  competitionAvailable,
  cosmeticUnlocked,
  levelForXp,
  missionProgress,
  parisWeek,
} from "./rules";
import type {
  CosmeticSlot,
  Encouragement,
  EquippedLook,
  MissionCode,
  PlayerLook,
  ProgressionState,
  PublicBadge,
  Reaction,
} from "./types";
export type DemoProgression = {
  version: 1;
  choices: Record<string, MissionCode[]>;
  awards: { week: string; code: MissionCode }[];
  equipped: EquippedLook;
  reactions: Record<string, Reaction | null>;
  notify_reactions: boolean;
};
export const makeDemoProgression = (): DemoProgression => ({
  version: 1,
  choices: {},
  awards: [],
  equipped: emptyLook(),
  reactions: {},
  notify_reactions: true,
});
export function settleProgression(
  original: DemoProgression,
  user: GameState,
  events: CompetitionSummary[],
  now = new Date(),
): DemoProgression {
  const next = structuredClone(original);
  for (const [start, codes] of Object.entries(next.choices)) {
    const week = parisWeek(new Date(Date.parse(start) + 12 * 3600000));
    for (const code of codes) {
      const definition = MISSION_DEFINITIONS.find((m) => m.code === code);
      if (
        definition &&
        !next.awards.some((a) => a.week === start && a.code === code) &&
        missionProgress(code, user.actions, events, now, week) >=
          definition.target
      )
        next.awards.push({ week: start, code });
    }
  }
  return next;
}
function badgesFor(
  state: DemoProgression,
  competitions: CompetitionBadge[],
): PublicBadge[] {
  const badges: PublicBadge[] = competitions.map((b) => ({
    id: b.event_id,
    label: b.label,
    icon: b.icon,
  }));
  if (
    Object.keys(state.choices).some(
      (week) => state.awards.filter((a) => a.week === week).length === 3,
    )
  )
    badges.unshift({ id: "premier_trio", label: "Premier trio", icon: "star" });
  return badges;
}
export function demoProgression(
  original: DemoProgression,
  user: GameState,
  events: CompetitionSummary[],
  competitionBadges: CompetitionBadge[],
  now = new Date(),
): ProgressionState {
  const state = settleProgression(original, user, events, now);
  const week = parisWeek(now),
    choices = state.choices[week.start] || [];
  const xp = state.awards.length * 50;
  return {
    available: true,
    week_start: week.start,
    week_end: week.end,
    xp,
    level: levelForXp(xp),
    week_xp: state.awards.filter((a) => a.week === week.start).length * 50,
    missions: MISSION_DEFINITIONS.map((m) => {
      const awarded = state.awards.some(
        (a) => a.week === week.start && a.code === m.code,
      );
      const progress = awarded
        ? m.target
        : missionProgress(m.code, user.actions, events, now);
      return {
        code: m.code,
        target: m.target,
        progress,
        selected: choices.includes(m.code),
        completed: progress >= m.target,
        awarded,
        xp: 50,
        available:
          m.code !== "competition_action" || competitionAvailable(events, week),
      };
    }),
    inventory: COSMETICS.map((item) => ({
      id: item.id,
      slot: item.slot,
      unlocked: cosmeticUnlocked(item, xp, competitionBadges),
    })),
    equipped: state.equipped,
    badges: badgesFor(state, competitionBadges),
    notify_reactions: state.notify_reactions,
  };
}
function encouragement(
  state: DemoProgression,
  user: GameState,
  id: string,
): Encouragement | null {
  const own = user.actions.some((a) => a.id === id);
  const shared =
    ["demo-shared-1", "demo-shared-2", "demo-shared-3"].includes(id) &&
    user.friends.some((f) => f.id === "demo-sam" && f.status === "accepted");
  if (!own && !shared) return null;
  const mine = own ? null : state.reactions[id] || null;
  const counts = {
    clap: own && id === user.actions[0]?.id ? 2 : 0,
    strength: 0,
    laugh: 0,
  };
  if (mine) counts[mine]++;
  return { action_id: id, mine, counts, can_react: !own };
}
export function progressionRpc(
  original: DemoProgression,
  user: GameState,
  events: CompetitionSummary[],
  badges: CompetitionBadge[],
  name: string,
  payload: Record<string, unknown> = {},
  now = new Date(),
): { next: DemoProgression; data: unknown } {
  let next = settleProgression(original, user, events, now);
  const week = parisWeek(now);
  if (name === "get_progression")
    return { next, data: demoProgression(next, user, events, badges, now) };
  if (name === "choose_weekly_mission") {
    const code = payload.p_code as MissionCode;
    const mission = MISSION_DEFINITIONS.find((m) => m.code === code);
    if (!mission) throw Error("Mission inconnue.");
    const choices = (next.choices[week.start] ||= []);
    if (!choices.includes(code)) {
      if (choices.length >= 3)
        throw Error("Tu as déjà choisi tes trois missions cette semaine.");
      if (code === "competition_action" && !competitionAvailable(events, week))
        throw Error("Aucune compétition disponible cette semaine.");
      choices.push(code);
    }
    next = settleProgression(next, user, events, now);
    return { next, data: null };
  }
  if (name === "equip_cosmetic") {
    const slot = payload.p_slot as CosmeticSlot;
    if (!["accessory", "title", "background"].includes(slot))
      throw Error("Emplacement invalide.");
    if (payload.p_item_id !== null) {
      const item = COSMETICS.find(
        (c) => c.id === payload.p_item_id && c.slot === slot,
      );
      if (!item || !cosmeticUnlocked(item, next.awards.length * 50, badges))
        throw Error("Cette récompense est encore verrouillée.");
    }
    next.equipped[slot] = payload.p_item_id as string | null;
    return { next, data: null };
  }
  if (name === "set_reaction_preferences") {
    if (typeof payload.p_enabled !== "boolean")
      throw Error("Préférence invalide.");
    next.notify_reactions = payload.p_enabled;
    return { next, data: null };
  }
  if (name === "get_encouragements") {
    if (
      !Array.isArray(payload.p_action_ids) ||
      payload.p_action_ids.length > 50 ||
      !payload.p_action_ids.every((id) => typeof id === "string")
    )
      throw Error("Choisir au maximum cinquante déclarations.");
    return {
      next,
      data: [...new Set(payload.p_action_ids)]
        .map((id) => encouragement(next, user, id))
        .filter(Boolean),
    };
  }
  if (name === "set_action_reaction") {
    const id = String(payload.p_action_id),
      reaction = payload.p_reaction;
    if (
      reaction !== null &&
      !["clap", "strength", "laugh"].includes(String(reaction))
    )
      throw Error("Réaction inconnue.");
    const row = encouragement(next, user, id);
    if (!row?.can_react)
      throw Error("Cette déclaration n’est pas accessible aux réactions.");
    next.reactions[id] = reaction as Reaction | null;
    return { next, data: encouragement(next, user, id) };
  }
  if (name === "get_player_looks") {
    if (!Array.isArray(payload.p_user_ids) || payload.p_user_ids.length > 60)
      throw Error("Liste de joueurs invalide.");
    const allowed = new Set([
      user.id,
      ...user.players.map((p) => p.id),
      ...user.friends.filter((f) => f.status === "accepted").map((f) => f.id),
    ]);
    const own = demoProgression(next, user, events, badges, now);
    const data: PlayerLook[] = [...new Set(payload.p_user_ids)]
      .filter((id) => allowed.has(id))
      .map((id) =>
        id === user.id
          ? {
              user_id: id,
              level: own.level,
              equipped: own.equipped,
              badges: own.badges.slice(0, 3),
            }
          : {
              user_id: id,
              level: 3,
              equipped: {
                accessory: "leaf_pin",
                title: "encore_debout",
                background: "aurora",
              },
              badges: [
                { id: "demo-trio", label: "Premier trio · démo", icon: "star" },
              ],
            },
      );
    return { next, data };
  }
  throw Error("Opération de progression inconnue.");
}
