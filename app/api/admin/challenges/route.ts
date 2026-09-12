import { createClient } from "@supabase/supabase-js";
import { generateSuggestions, generationRequest } from "@/lib/ai/challenges";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request) {
  const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if(!token) return Response.json({error:"Connexion requise."},{status:401,headers});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url || !key) return Response.json({error:"Configuration serveur requise."},{status:503,headers});
  let input;
  try {
    const raw=await request.text();
    if(raw.length>1000) return Response.json({error:"Requête trop longue."},{status:400,headers});
    input=generationRequest.parse(JSON.parse(raw));
  } catch {return Response.json({error:"Thème ou requête invalide."},{status:400,headers});}
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(5000)})}});
  try {
    const {data:auth,error}=await db.auth.getUser(token);
    if(error || !auth.user) return Response.json({error:"Reconnecte-toi."},{status:401,headers});
    const {data:reservation,error:reserveError}=await db.rpc("reserve_ai_challenges",{p_actor:auth.user.id,p_id:input.request_id,p_theme:input.theme});
    if(reserveError) return Response.json({error:reserveError.code === "P0001" ? reserveError.message : "La mise à jour de l’atelier IA est requise."},{status:reserveError.message === "Administration requise." ? 403 : 429,headers});
    if(!reservation.claimed) return reservation.batch?.suggestions
      ? Response.json(reservation.batch,{headers})
      : Response.json({error:"Cette génération est déjà en cours. Consulte les propositions enregistrées avant de relancer."},{status:409,headers});
    const accountId=process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const aiToken=process.env.CLOUDFLARE_AI_TOKEN?.trim();
    const config=accountId && /^[a-f0-9]{32}$/.test(accountId) && aiToken ? {accountId,token:aiToken} : null;
    const generated=await generateSuggestions(input.theme,config);
    if(generated.source === "fallback") console.warn("ai_challenge_fallback",{
      request_id:input.request_id,reason:generated.diagnostic,status:generated.provider_status,code:generated.provider_code,
    });
    const {data:batch,error:saveError}=await db.rpc("finish_ai_challenges",{p_actor:auth.user.id,p_id:input.request_id,p_source:generated.source,p_suggestions:generated.suggestions});
    if(saveError) return Response.json({error:"Enregistrement non confirmé. Consulte l’historique avant de relancer."},{status:503,headers});
    return Response.json({...batch,diagnostic:generated.diagnostic,provider_status:generated.provider_status,provider_code:generated.provider_code},{headers});
  } catch {return Response.json({error:"Atelier indisponible. Réessaie plus tard."},{status:503,headers});}
}
