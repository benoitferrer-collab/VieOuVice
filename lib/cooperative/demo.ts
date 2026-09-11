import type { GameState } from "../game";
import type { CoopChallenge, CoopHub } from "./types";
import { contribution, consumptionSummary, templateDefinition } from "./rules";
type DemoChallenge = CoopChallenge & {
  joined_at: string;
  creator: boolean;
  key?: string;
  invited?: string[];
  friend_progress: number;
};
export type CoopDemo = { challenges: DemoChallenge[] };
export function makeCoopDemo(now = new Date().toISOString()): CoopDemo {
  return {
    challenges: [
      {
        id: "demo-coop-pause",
        creator_name: "Sam_Suffit",
        template: "pause",
        title: "Le droit de souffler ensemble · démo",
        target: 10,
        unit: "pauses",
        progress: 4,
        my_progress: 0,
        status: "active",
        ends_at: new Date(Date.parse(now) + 7 * 86400000).toISOString(),
        joined_at: now,
        creator: false,
        member_status: "accepted",
        participant_count: 2,
        contributor_count: 1,
        badge: false,
        friend_progress: 4,
      },
    ],
  };
}
export function settleCoopDemo(
  state: CoopDemo,
  game: GameState,
  now = new Date().toISOString(),
): CoopDemo {
  return {
    challenges: state.challenges.map((c) => {
      if (c.status !== "active" || c.member_status !== "accepted") return c;
      const mine = contribution(
        c.template,
        game.actions,
        c.joined_at,
        c.ends_at,
        now,
      );
      const contributors = (mine > 0 ? 1 : 0) + (c.friend_progress > 0 ? 1 : 0);
      const completed =
        mine + c.friend_progress >= c.target && contributors >= 2;
      return {
        ...c,
        my_progress: mine,
        progress: mine + c.friend_progress,
        contributor_count: contributors,
        status: completed
          ? "completed"
          : Date.parse(c.ends_at) <= Date.parse(now)
            ? "expired"
            : "active",
        badge: completed && mine > 0,
      };
    }),
  };
}
export function coopDemoRpc(
  state: CoopDemo,
  game: GameState,
  name: string,
  p: Record<string, unknown>,
  now = new Date().toISOString(),
): { state: CoopDemo; data: unknown } {
  const next = settleCoopDemo(structuredClone(state), game, now);
  if (name === "get_cooperative_hub")
    return {
      state: next,
      data: { challenges: next.challenges } satisfies CoopHub,
    };
  if (name === "get_consumption_summary")
    return {
      state: next,
      data: consumptionSummary(game.actions, Number(p.p_days), now),
    };
  if (name === "create_cooperative_challenge") {
    const def = templateDefinition(String(p.p_template));
    const friends = Array.isArray(p.p_friends)
      ? p.p_friends.map(String).sort()
      : [];
    if (
      friends.length < 1 ||
      friends.length > 4 ||
      new Set(friends).size !== friends.length ||
      friends.some(
        (id) =>
          !game.friends.some((f) => f.id === id && f.status === "accepted"),
      )
    )
      throw Error("Choisis de un à quatre amis acceptés.");
    const old = next.challenges.find((c) => c.key === p.p_key);
    if (old) {
      if (
        old.template !== def.id ||
        JSON.stringify(old.invited) !== JSON.stringify(friends)
      )
        throw Error("Reprise différente du défi initial.");
      return { state: next, data: old.id };
    }
    if (next.challenges.some((c) => c.creator && c.status === "active"))
      throw Error("Tu as déjà créé un défi en cours.");
    const c: DemoChallenge = {
      id: crypto.randomUUID(),
      creator_name: game.nickname,
      template: def.id,
      title: def.title,
      target: def.target,
      unit: def.unit,
      progress: 0,
      my_progress: 0,
      status: "active",
      ends_at: new Date(Date.parse(now) + 7 * 86400000).toISOString(),
      joined_at: now,
      member_status: "accepted",
      participant_count: 1,
      contributor_count: 0,
      badge: false,
      creator: true,
      key: String(p.p_key),
      invited: friends,
      friend_progress: 0,
    };
    next.challenges.push(c);
    return { state: next, data: c.id };
  }
  const c = next.challenges.find((c) => c.id === p.p_id);
  if (!c) throw Error("Défi indisponible.");
  if (name === "respond_cooperative_challenge") {
    if (c.member_status === "invited") {
      c.member_status = p.p_accept === true ? "accepted" : "declined";
      c.joined_at = now;
      if (p.p_accept === true) c.participant_count++;
    }
    return { state: next, data: null };
  }
  if (name === "leave_cooperative_challenge") {
    c.member_status = "left";
    c.participant_count = Math.max(0, c.participant_count - 1);
    return { state: next, data: null };
  }
  throw Error("Action indisponible en démo.");
}
