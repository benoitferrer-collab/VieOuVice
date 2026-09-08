import type { GameState } from "../game";
import type {
  CompetitionSummary,
  CompetitionStanding,
  SocialHub,
  CompetitionBadge,
  FriendActivityPage,
} from "./types";
import { competitionPhase, competitionScore, rankStandings } from "./rules";
export type DemoSocialState = {
  version: 1;
  share_history: boolean;
  events: CompetitionSummary[];
  badges: CompetitionBadge[];
  finals: Record<string, CompetitionStanding[]>;
};
export function makeDemoSocialState(now = new Date()): DemoSocialState {
  const at = (hours: number) =>
    new Date(now.getTime() + hours * 3600000).toISOString();
  return {
    version: 1,
    share_history: false,
    badges: [],
    finals: {},
    events: [
      {
        id: "demo-event-next",
        title: "Le prochain petit pas · Démo",
        description:
          "Une compétition fictive pour prendre de bonnes habitudes ensemble.",
        starts_at: at(24),
        ends_at: at(192),
        metric: "health_minutes",
        catalog_id: null,
        badge_label: "Petit pas, grande victoire",
        badge_icon: "leaf",
        status: "published",
        joined: false,
        participant_count: 2,
        my_score: null,
        my_rank: null,
      },
      {
        id: "demo-event-active",
        title: "La semaine des survivants · Démo",
        description:
          "Chaque minute gagnée compte. Les joueurs et leurs scores sont fictifs.",
        starts_at: at(-24),
        ends_at: at(48),
        metric: "net_minutes",
        catalog_id: null,
        badge_label: "Survivant de la semaine",
        badge_icon: "trophy",
        status: "published",
        joined: true,
        participant_count: 3,
        my_score: 0,
        my_rank: 3,
      },
    ],
  };
}
function standings(
  event: CompetitionSummary,
  user: GameState,
  now: Date,
): CompetitionStanding[] {
  const started = now.getTime() >= new Date(event.starts_at).getTime();
  const rows = [
    {
      user_id: "demo-sam",
      nickname: "Sam_Suffit · démo",
      avatar: 1,
      score: started ? 80 : 0,
      action_count: started ? 2 : 0,
    },
    {
      user_id: "demo-cleo",
      nickname: "Cléo_patatra · démo",
      avatar: 2,
      score: started ? 120 : 0,
      action_count: started ? 3 : 0,
    },
  ];
  if (event.joined)
    rows.push({
      user_id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      ...(started
        ? competitionScore(event, user.actions)
        : { score: 0, action_count: 0 }),
    });
  return rankStandings(rows);
}
export function getDemoHub(
  state: DemoSocialState,
  user: GameState,
  now = new Date(),
): SocialHub {
  return {
    available: true,
    is_admin: false,
    share_history: state.share_history,
    badges: state.badges,
    events: state.events.map((event) => {
      const table = state.finals[event.id] || standings(event, user, now);
      const own = table.find((r) => r.user_id === user.id);
      return {
        ...event,
        status:
          competitionPhase(event, now) === "ended" ? "completed" : event.status,
        participant_count: table.length,
        my_score: own?.score ?? null,
        my_rank: own?.rank ?? null,
      };
    }),
  };
}
export function settleDemoEvents(
  state: DemoSocialState,
  user: GameState,
  now = new Date(),
): DemoSocialState {
  const next: DemoSocialState = {
    ...state,
    events: state.events.map((e) => ({ ...e })),
    badges: [...state.badges],
    finals: { ...state.finals },
  };
  for (const event of next.events) {
    if (competitionPhase(event, now) !== "ended") continue;
    const table = standings(event, user, now);
    next.finals[event.id] = table;
    event.status = "completed";
    const own = table.find((r) => r.user_id === user.id);
    if (
      own &&
      own.action_count > 0 &&
      !next.badges.some((b) => b.event_id === event.id)
    )
      next.badges.push({
        event_id: event.id,
        event_title: event.title,
        label: event.badge_label,
        icon: event.badge_icon,
        kind:
          own.rank === 1 ? "winner" : own.rank <= 3 ? "podium" : "participant",
        rank: own.rank,
        awarded_at: now.toISOString(),
      });
  }
  return next;
}
export function demoHubRpc(
  original: DemoSocialState,
  user: GameState,
  name: string,
  payload: Record<string, unknown> = {},
  now = new Date(),
): { next: DemoSocialState; data: unknown } {
  const next = settleDemoEvents(original, user, now);
  if (name === "get_social_hub")
    return { next, data: getDemoHub(next, user, now) };
  if (name === "update_history_sharing") {
    if (typeof payload.p_enabled !== "boolean")
      throw Error("Préférence invalide.");
    next.share_history = payload.p_enabled;
    return { next, data: null };
  }
  if (name === "get_friend_activity") {
    const friend = user.friends.find(
      (f) => f.id === payload.p_friend_id && f.status === "accepted",
    );
    if (!friend) throw Error("Cet historique est inaccessible.");
    const shared = friend.id === "demo-sam";
    const data: FriendActivityPage = {
      friend: {
        id: friend.id,
        nickname: friend.nickname,
        avatar: friend.avatar,
      },
      shared,
      next_cursor: null,
      actions: shared
        ? [
            {
              id: "demo-shared-1",
              label: "Prendre l’air",
              kind: "health",
              quantity: 1,
              minutes_impact: 25,
              created_at: new Date(now.getTime() - 2 * 3600000).toISOString(),
            },
            {
              id: "demo-shared-2",
              label: "Craquage gourmand",
              kind: "excess",
              quantity: 1,
              minutes_impact: -20,
              created_at: new Date(now.getTime() - 27 * 3600000).toISOString(),
            },
            {
              id: "demo-shared-3",
              label: "Une vraie pause",
              kind: "health",
              quantity: 2,
              minutes_impact: 30,
              created_at: new Date(now.getTime() - 4 * 86400000).toISOString(),
            },
          ]
        : [],
    };
    return { next, data };
  }
  const event = next.events.find((e) => e.id === payload.p_event_id);
  if (!event)
    throw Error("Cette opération nécessite un compte connecté autorisé.");
  if (name === "get_competition") {
    const summary = getDemoHub(next, user, now).events.find(
      (e) => e.id === event.id,
    )!;
    return {
      next,
      data: {
        ...summary,
        leaderboard: next.finals[event.id] || standings(event, user, now),
        next_offset: null,
      },
    };
  }
  if (name === "join_competition" || name === "leave_competition") {
    if (competitionPhase(event, now) !== "upcoming")
      throw Error("Les inscriptions sont closes.");
    event.joined = name === "join_competition";
    return { next, data: null };
  }
  throw Error("Cette opération nécessite un compte connecté autorisé.");
}
