import { z } from "zod";
const schema = z.strictObject({
  id: z.uuid(),
  amount: z.number().int().min(1).max(100),
  key: z.uuid(),
});
export type TransferDraft = z.infer<typeof schema>;
export function parseTransferDraft(raw: string | null): TransferDraft | null {
  try {
    const result = schema.safeParse(JSON.parse(raw || "null"));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function readTransferDraft(scope: string) {
  try {
    return parseTransferDraft(localStorage.getItem("exces:transfer:" + scope));
  } catch {
    return null;
  }
}
export function writeTransferDraft(scope: string, value: TransferDraft | null) {
  try {
    if (value)
      localStorage.setItem("exces:transfer:" + scope, JSON.stringify(value));
    else localStorage.removeItem("exces:transfer:" + scope);
  } catch {
    /* Keep the current in-memory intent usable. */
  }
}
