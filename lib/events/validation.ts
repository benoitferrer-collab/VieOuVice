import { z } from "zod";
const clean = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v),
      "Caractère non autorisé.",
    );
export const competitionDraftSchema = z
  .object({
    id: z.uuid().nullable(),
    title: clean(3, 80),
    description: clean(0, 1200),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    metric: z.enum(["health_minutes", "net_minutes", "category_minutes"]),
    catalog_id: z.string().min(1).max(80).nullable(),
    badge_label: clean(3, 60),
    badge_icon: z.enum(["trophy", "medal", "leaf", "flame"]),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Date.parse(data.ends_at) <= Date.parse(data.starts_at))
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "La fin doit être après le début.",
      });
    if (Date.parse(data.ends_at) - Date.parse(data.starts_at) > 90 * 86400000)
      ctx.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "Durée maximale : 90 jours.",
      });
    if (data.metric === "category_minutes" && !data.catalog_id)
      ctx.addIssue({
        code: "custom",
        path: ["catalog_id"],
        message: "Choisis une bonne action pour ce défi.",
      });
    if (data.metric !== "category_minutes" && data.catalog_id !== null)
      ctx.addIssue({
        code: "custom",
        path: ["catalog_id"],
        message: "La catégorie concerne uniquement les défis ciblés.",
      });
  });
