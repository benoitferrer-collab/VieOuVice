import { z } from "zod";
export const emojiThemes = ["joie", "courage", "fête", "calme"] as const;
export const recipeSchema = z
  .object({
    face: z.enum(["round", "cat", "bear"]),
    color: z.enum(["gold", "rose", "mint", "sky"]),
    expression: z.enum(["smile", "laugh", "wink", "love"]),
    accessory: z.enum(["none", "crown", "party", "star"]),
  })
  .strict();
export type EmojiRecipe = z.infer<typeof recipeSchema>;
export type CatalogueEmoji = {
  id: string;
  label: string;
  recipe: EmojiRecipe;
  source: "ai" | "fallback";
};
export type EmojiGeneration = {
  id: string;
  theme: string;
  recipe: EmojiRecipe | null;
  source: "ai" | "fallback" | null;
  created_at: string;
};
export const emojiRequest = z
  .object({ theme: z.enum(emojiThemes), request_id: z.uuid() })
  .strict();
export function parseRecipe(value: unknown): EmojiRecipe {
  return recipeSchema.parse(
    typeof value === "string" ? JSON.parse(value) : value,
  );
}
export const fallbackRecipe: EmojiRecipe = {
  face: "round",
  color: "gold",
  expression: "smile",
  accessory: "star",
};
export async function generateEmoji(
  theme: string,
  config: { accountId: string; token: string } | null,
  fetcher: typeof fetch = fetch,
) {
  const fallback = (diagnostic: string) => ({
    source: "fallback" as const,
    recipe: fallbackRecipe,
    diagnostic,
  });
  if (!config)
    return fallback(
      "Configuration IA absente : composition préparée, sans génération IA.",
    );
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          max_tokens: 150,
          temperature: 0.7,
          response_format: {
            type: "json_schema",
            json_schema: {
              type: "object",
              additionalProperties: false,
              required: ["face", "color", "expression", "accessory"],
              properties: {
                face: { type: "string", enum: ["round", "cat", "bear"] },
                color: {
                  type: "string",
                  enum: ["gold", "rose", "mint", "sky"],
                },
                expression: {
                  type: "string",
                  enum: ["smile", "laugh", "wink", "love"],
                },
                accessory: {
                  type: "string",
                  enum: ["none", "crown", "party", "star"],
                },
              },
            },
          },
          messages: [
            {
              role: "system",
              content:
                "Compose un emoji. Réponds uniquement par un objet JSON à quatre clés : face (round,cat,bear), color (gold,rose,mint,sky), expression (smile,laugh,wink,love), accessory (none,crown,party,star). Aucun autre champ ni texte.",
            },
            { role: "user", content: `Thème : ${theme}` },
          ],
        }),
      },
    );
    if (!response.ok)
      return fallback(
        `IA indisponible (${response.status}) : composition préparée.`,
      );
    const data = await response.json();
    if (data.success !== true)
      return fallback("Réponse IA invalide : composition préparée.");
    return {
      source: "ai" as const,
      recipe: parseRecipe(data.result?.response),
      diagnostic: undefined,
    };
  } catch {
    return fallback(
      "Réponse IA invalide ou délai dépassé : composition préparée.",
    );
  }
}
