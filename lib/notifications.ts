import { z } from "zod";
import type { Notice } from "./game";
const tabs = ["survie", "ligue", "nemesis", "amis", "messages"] as const;
export function notificationTab(value: unknown, kind?: string): (typeof tabs)[number] {
  if (kind === "friend_message") return "messages";
  return tabs.includes(value as (typeof tabs)[number])
    ? (value as (typeof tabs)[number])
    : "survie";
}
const noticeSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).max(500),
  created_at: z.string(),
  read_at: z.string().nullable(),
  kind: z.enum([
    "friend_action",
    "duel_started",
    "duel_lead",
    "duel_finished",
    "friend_accepted",
    "reaction_digest",
    "friend_message",
    "competition_started",
    "competition_finished",
    "activity_reminder",
  ]),
  actor_id: z.string().nullable().optional(),
  target_tab: z.enum(tabs).optional(),
});
export function socialNotice(value: unknown): Notice | null {
  const result = noticeSchema.safeParse(value);
  return result.success ? result.data : null;
}
