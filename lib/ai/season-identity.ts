import { z } from "zod";

export const emblemIcons = ["star", "flame", "leaf", "moon", "crown"] as const;
export const emblemColors = ["gold", "mint", "violet", "coral", "sky"] as const;
export const emblemShapes = ["shield", "circle", "hexagon"] as const;
export const emblemSchema = z
  .object({
    icon: z.enum(emblemIcons),
    color: z.enum(emblemColors),
    shape: z.enum(emblemShapes),
  })
  .strict();
const name = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .refine(
    (v) =>
      /^[A-Za-zÀ-ÖØ-öø-ÿŒœ ’'−–—-]+$/.test(v) &&
      !/(https?|www|guéri|gueri|médic|medic|thérap|therap|diagnos|cancer|diabèt|diabet)/i.test(
        v,
      ),
  );
export const seasonIdentitySchema = z
  .object({
    season_name: name,
    divisions: z.array(emblemSchema.extend({ name }).strict()).length(5),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.divisions.map((d) => d.name.toLocaleLowerCase("fr"))).size ===
      5,
  );
export type SeasonIdentity = z.infer<typeof seasonIdentitySchema>;
export type Emblem = z.infer<typeof emblemSchema>;
export type PlayerSeasonIdentity = {
  season_name: string;
  league_name: string;
  emblem: Emblem;
  source: "ai" | "fallback";
};
export type SeasonGeneration = {
  identity: SeasonIdentity;
  source: "ai" | "fallback";
};
export function preparedSeasonIdentity(startsAt: string): SeasonIdentity {
  const themes = [
    ["La traversée des étoiles", "des étoiles"],
    ["Le réveil de la forêt", "de la forêt"],
    ["Les gardiens de l’aurore", "de l’aurore"],
    ["L’odyssée des lucioles", "des lucioles"],
  ];
  const stamp = Date.parse(startsAt);
  const week = Number.isFinite(stamp) ? Math.floor(stamp / 604800000) : 0;
  const theme =
    themes[((week % themes.length) + themes.length) % themes.length];
  return {
    season_name: theme[0],
    divisions: [
      "Éclaireurs",
      "Veilleurs",
      "Gardiens",
      "Sentinelles",
      "Légendes",
    ].map((prefix, i) => ({
      name: `${prefix} ${theme[1]}`,
      icon: emblemIcons[i],
      color: emblemColors[(i + (week % 5) + 5) % 5],
      shape: emblemShapes[i % 3],
    })),
  };
}
const responseFormat = {
  type: "json_schema",
  json_schema: {
    type: "object",
    additionalProperties: false,
    required: ["season_name", "divisions"],
    properties: {
      season_name: { type: "string", minLength: 3, maxLength: 60 },
      divisions: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "icon", "color", "shape"],
          properties: {
            name: { type: "string", minLength: 3, maxLength: 60 },
            icon: { type: "string", enum: emblemIcons },
            color: { type: "string", enum: emblemColors },
            shape: { type: "string", enum: emblemShapes },
          },
        },
      },
    },
  },
};
export async function generateSeasonIdentity(
  startsAt: string,
  config: { accountId: string; token: string } | null,
  fetcher: typeof fetch = fetch,
): Promise<SeasonGeneration> {
  const fallback: SeasonGeneration = {
    identity: preparedSeasonIdentity(startsAt),
    source: "fallback",
  };
  if (!config) return fallback;
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          max_tokens: 650,
          temperature: 0.8,
          response_format: responseFormat,
          messages: [
            {
              role: "system",
              content:
                "Crée en français une identité de saison pour un jeu social malicieux. JSON uniquement : season_name, divisions (cinq objets name, icon, color, shape). Cinq noms de ligues distincts, courts et assortis à la saison, du rang débutant au rang légendaire. Pas de chiffres, URL, balises, objectifs ou promesses de santé. icon : star,flame,leaf,moon,crown ; color : gold,mint,violet,coral,sky ; shape : shield,circle,hexagon. Aucun autre champ.",
            },
            {
              role: "user",
              content: `Réinvente librement cette ambiance : ${fallback.identity.season_name}. Des noms originaux et des emblèmes variés.`,
            },
          ],
        }),
      },
    );
    if (!response.ok) return fallback;
    const payload = await response.json();
    if (payload.success !== true) return fallback;
    const raw = payload.result?.response;
    const identity = seasonIdentitySchema.parse(
      typeof raw === "string" ? JSON.parse(raw) : raw,
    );
    return { identity, source: "ai" };
  } catch {
    return fallback;
  }
}
