import { z } from "zod";
import type { CompetitionDraft } from "../events/types";
export const aiThemes = ["espace", "jungle", "pirates", "zen", "survivants"] as const;
export const generationRequest = z.object({ theme:z.enum(aiThemes), request_id:z.uuid() }).strict();
const text = (max:number) => z.string().trim().min(3).max(max).refine(v=>!/[<>\u0000-\u001f]/.test(v));
const suggestion = z.object({title:text(80),intro:text(350),badge_label:text(60),badge_icon:z.enum(["trophy","medal","leaf","flame"])}).strict();
export const suggestionsSchema = z.array(suggestion).length(3);
export type Suggestion = z.infer<typeof suggestion>;
export type Batch = {id:string;theme:string;created_at:string;source:"ai"|"fallback";suggestions:Suggestion[]};
export function preparedSuggestions(theme:string):Suggestion[] {
  return [
    {title:`Mission ${theme} : petites pauses`,intro:"Une aventure collective, chacun à son rythme.",badge_label:"Gardien du calme",badge_icon:"leaf"},
    {title:`Mission ${theme} : en mouvement`,intro:"Chaque petit pas compte dans cette aventure.",badge_label:"Explorateur du quotidien",badge_icon:"medal"},
    {title:`Mission ${theme} : bonnes habitudes`,intro:"Une semaine pour faire une place aux bonnes habitudes.",badge_label:"Équipe des survivants",badge_icon:"trophy"},
  ];
}
export function parseSuggestions(raw:string):Suggestion[] {
  const parsed = suggestionsSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"")));
  // Model output is presentation only. Never accept medical claims, numeric
  // prescriptions or consumption challenges as automatically generated copy.
  const forbidden=/(alcool|bi[eè]re|cocktail|vodka|gin\b|cigarette|drogue|je[uû]ne|calorie|gu[eé]ri|esp[eé]rance de vie|\d|https?:|www\.)/i;
  if(parsed.some(s=>forbidden.test([s.title,s.intro,s.badge_label].join(" ")))) throw Error("Unsupported generated content");
  return parsed;
}
export function suggestionDraft(s:Suggestion,index:number,now=new Date()):CompetitionDraft {
  const starts=new Date(now.getTime()+86400000);
  const ends=new Date(starts.getTime()+7*86400000);
  const category = index === 0 ? "pause" : index === 1 ? "walk" : null;
  return {id:null,title:s.title,description:`${s.intro}\n\n${category === "pause" ? "Déclare tes pauses habituelles" : category === "walk" ? "Déclare tes marches habituelles" : "Déclare tes bonnes habitudes"}, à ton rythme, pendant la semaine. Le classement utilise les points de jeu des actions éligibles et leurs plafonds habituels. Aucune activité supplémentaire n’est obligatoire.`,starts_at:starts.toISOString(),ends_at:ends.toISOString(),metric:category?"category_minutes":"health_minutes",catalog_id:category,badge_label:s.badge_label,badge_icon:s.badge_icon};
}
export async function generateSuggestions(theme:string,config:{accountId:string;token:string}|null,fetcher:typeof fetch=fetch) {
  if(config) try {
    const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8-fast`,{
      method:"POST",headers:{Authorization:`Bearer ${config.token}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(20000),
      body:JSON.stringify({max_tokens:900,temperature:0.7,messages:[
        {role:"system",content:'Écris en français trois habillages de défis ludiques : pauses, marche, bonnes habitudes, dans cet ordre. Réponds uniquement par un tableau JSON de trois objets avec title (3–80 caractères), intro (3–350), badge_label (3–60), badge_icon (trophy,medal,leaf,flame). Pas de chiffres, pas de promesse médicale, pas de récompense, pas de consigne de consommation, aucun alcool ni restriction alimentaire. Tu écris uniquement une ambiance, jamais les règles ou objectifs.'},
        {role:"user",content:`Thème : ${theme}. Trois ambiances originales et accueillantes.`},
      ]}),
    });
    if(!response.ok) throw Error("Provider unavailable");
    const payload=await response.json();
    if(!payload.success || typeof payload.result?.response!=="string") throw Error("Invalid provider response");
    return {source:"ai" as const,suggestions:parseSuggestions(payload.result.response)};
  } catch { /* Fixed local templates keep the workshop available without billing escalation. */ }
  return {source:"fallback" as const,suggestions:preparedSuggestions(theme)};
}
