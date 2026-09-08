import { createHash, timingSafeEqual } from "node:crypto";
export function authorizedDispatch(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header || header.length > 1024) return false;
  const actual = createHash("sha256").update(header).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(actual, expected);
}
