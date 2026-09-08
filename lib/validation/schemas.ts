import { z } from "zod";
export const actionSchema = z.strictObject({
  p_catalog_id: z.string().min(1).max(40),
  p_quantity: z.number().int().min(1).max(1000),
  p_idempotency_key: z.uuid(),
});
export const profileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[\p{L}\p{N}_-]+$/u),
  avatar: z.number().int().min(0).max(3),
});
export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(10).max(128),
});
