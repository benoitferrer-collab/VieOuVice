import type { GameState } from "../game";
import type { ArenaDuel } from "../arena/rules";
import type { MessageInbox } from "../messages/rules";
import { COSMETICS } from "../progression/metadata";
import type { ProgressionState } from "../progression/types";

export type HomePriority = {
  kind: "turn" | "invite" | "friend" | "message";
  id: string;
  label: string;
  detail: string;
  count: number;
};
export function homePriorities(
  game: Pick<GameState, "id" | "friends">,
  duels: ArenaDuel[],
  inbox: MessageInbox | null,
  now = new Date(),
): HomePriority[] {
  const accepted = new Set(
    game.friends.filter((f) => f.status === "accepted").map((f) => f.id),
  );
  const valid = duels
    .filter(
      (d) =>
        [d.challenger_id, d.opponent_id].includes(game.id) &&
        accepted.has(
          d.challenger_id === game.id ? d.opponent_id : d.challenger_id,
        ) &&
        Date.parse(d.deadline) > now.getTime(),
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const result: HomePriority[] = [];
  for (const kind of ["turn", "invite"] as const)
    for (const duel of valid) {
      if (
        kind === "turn"
          ? duel.status !== "active" || duel.turn_user_id !== game.id
          : duel.status !== "pending" || duel.opponent_id !== game.id
      )
        continue;
      const other = game.friends.find(
        (f) =>
          f.id ===
          (duel.challenger_id === game.id
            ? duel.opponent_id
            : duel.challenger_id),
      );
      result.push({
        kind,
        id: duel.id,
        label: kind === "turn" ? "À toi de jouer" : "Invitation au duel",
        detail: other?.nickname ?? "Un ami",
        count: 1,
      });
    }
  const invitations = game.friends.filter(
    (f) => f.status === "pending" && f.incoming,
  );
  if (invitations.length)
    result.push({
      kind: "friend",
      id: invitations[0].id,
      label:
        invitations.length === 1
          ? "Une demande d’amitié"
          : `${invitations.length} demandes d’amitié`,
      detail: invitations[0].nickname,
      count: invitations.length,
    });
  const unread =
    inbox?.conversations
      .filter((c) => accepted.has(c.friend_id) && c.unread_count > 0)
      .sort((a, b) =>
        (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
      ) ?? [];
  const count = unread.reduce((sum, c) => sum + c.unread_count, 0);
  if (count)
    result.push({
      kind: "message",
      id: unread.length === 1 ? unread[0].friend_id : "",
      label: `${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""}`,
      detail:
        unread.length === 1
          ? (game.friends.find((f) => f.id === unread[0].friend_id)?.nickname ??
            "Un ami")
          : `Dans ${unread.length} conversations`,
      count,
    });
  return result;
}

export function ongoingMission(progression: ProgressionState | null) {
  return (
    progression?.missions
      .filter((m) => m.selected && !m.completed && m.available && m.target > 0)
      .sort((a, b) => b.progress / b.target - a.progress / a.target)[0] ?? null
  );
}

export function nextAccessory(progression: ProgressionState) {
  const candidates = COSMETICS.filter(
    (c) =>
      c.slot === "accessory" &&
      progression.inventory.some(
        (i) => i.id === c.id && i.slot === c.slot && !i.unlocked,
      ) &&
      (c.price === undefined || progression.wallet !== undefined),
  );
  const priority = (c: (typeof COSMETICS)[number]) =>
    c.badgeRequirement ? 2 : c.price !== undefined ? 1 : 0;
  const item = candidates.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      (a.price ?? a.xpRequired) - (b.price ?? b.xpRequired),
  )[0];
  if (!item) return null;
  if (item.badgeRequirement)
    return {
      item,
      current: Math.min(1, progression.badges.length),
      total: 1,
      unit: "badge" as const,
      condition: "Obtenir un badge de compétition",
    };
  if (item.price !== undefined)
    return {
      item,
      current: Math.min(item.price, Math.max(0, progression.wallet!.balance)),
      total: item.price,
      unit: "Éclats" as const,
      condition: "À acheter avec tes Éclats disponibles",
    };
  return {
    item,
    current: Math.min(item.xpRequired, Math.max(0, progression.xp)),
    total: item.xpRequired,
    unit: "XP" as const,
    condition: "Se débloque avec ta progression",
  };
}
