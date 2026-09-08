import { z } from "zod";
export const communityActionSchema = z.strictObject({
  p_label: z
    .string()
    .trim()
    .min(3, "Donne un nom de 3 à 60 caractères.")
    .max(60)
    .regex(
      /^[^\u0000-\u001f\u007f]+$/,
      "Le nom contient des caractères non autorisés.",
    ),
  p_kind: z.enum(["health", "excess"]),
  p_unit: z
    .string()
    .trim()
    .min(2, "Précise une unité de 2 à 40 caractères.")
    .max(40)
    .regex(/^[^\u0000-\u001f\u007f]+$/),
  p_magnitude: z.number().int().min(1).max(120),
  p_max_quantity: z.number().int().min(1).max(10),
  p_idempotency_key: z.uuid(),
});
export type CommunityActionInput = z.infer<typeof communityActionSchema>;
