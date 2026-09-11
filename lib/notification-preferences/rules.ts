import { z } from "zod";
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const schema = z
  .object({
    messages: z.boolean(),
    friends: z.boolean(),
    duels: z.boolean(),
    reactions: z.boolean(),
    competitions: z.boolean(),
    reminders: z.boolean(),
    quiet_enabled: z.boolean(),
    quiet_start: clock,
    quiet_end: clock,
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("fr", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
  })
  .refine((p) => !p.quiet_enabled || p.quiet_start !== p.quiet_end);
export type NotificationPreferences = z.infer<typeof schema>;
export const defaultPreferences: NotificationPreferences = {
  messages: true,
  friends: true,
  duels: true,
  reactions: true,
  competitions: true,
  reminders: false,
  quiet_enabled: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  timezone: "Europe/Paris",
};
export function parsePreferences(value: unknown): NotificationPreferences {
  return schema.parse(value);
}
export function quietAt(p: NotificationPreferences, date: Date): boolean {
  if (!p.quiet_enabled) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: p.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const time = `${parts.find((v) => v.type === "hour")!.value}:${parts.find((v) => v.type === "minute")!.value}`;
  return p.quiet_start < p.quiet_end
    ? time >= p.quiet_start && time < p.quiet_end
    : time >= p.quiet_start || time < p.quiet_end;
}
