import { z } from "zod";
const schema = z.strictObject({
  catalogId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(1000),
  key: z.uuid(),
  pending: z.boolean(),
});
export type Draft = z.infer<typeof schema>;
export function parseDraft(raw: string | null): Draft | null {
  try {
    const parsed = schema.safeParse(JSON.parse(raw || "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function readDraft(key: string): Draft | null {
  try {
    return parseDraft(localStorage.getItem(key));
  } catch {
    return null;
  }
}
export function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    /* The in-memory draft remains usable when storage is unavailable. */
  }
}
