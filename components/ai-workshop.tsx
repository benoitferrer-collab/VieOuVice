"use client";
import { useEffect, useRef, useState } from "react";
import { Leaf, Medal, Trophy, Flame, Sparkles } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { aiDiagnostics, aiThemes, suggestionDraft, type Batch } from "@/lib/ai/challenges";
import type { CompetitionDraft, HubRpc } from "@/lib/events/types";
const icons={leaf:Leaf,medal:Medal,trophy:Trophy,flame:Flame};
export function AIWorkshop({userId,rpc,onChoose}:{userId:string;rpc:HubRpc;onChoose:(draft:CompetitionDraft)=>void}) {
  const [theme,setTheme]=useState<(typeof aiThemes)[number]>("espace");
  const [batches,setBatches]=useState<Batch[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [ready,setReady]=useState(false);
  const alive=useRef(true);
  const intent=useRef<{id:string;theme:string}|null>(null);
  useEffect(()=>{alive.current=true;rpc<Batch[]>("admin_ai_history").then(rows=>{if(alive.current){setBatches(rows);setReady(true);}}).catch(()=>{if(alive.current)setError("Exécute la mise à jour Atelier IA dans Supabase pour l’activer.");});return()=>{alive.current=false;};},[rpc]);
  async function generate() {
    if(busy)return;setBusy(true);setError("");
    try {
      const db=browserClient();const {data}=await db.auth.getSession();
      const token=data.session?.access_token;
      if(!token || data.session?.user.id!==userId)throw Error("Reconnecte-toi avant de générer.");
      const {data:verified}=await db.auth.getUser(token);
      if(verified.user?.id!==userId)throw Error("La session a changé.");
      intent.current??={id:crypto.randomUUID(),theme};
      const response=await fetch("/api/admin/challenges",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({theme:intent.current.theme,request_id:intent.current.id}),signal:AbortSignal.timeout(45000)});
      const result=await response.json();
      if(!response.ok){if(response.status!==503)intent.current=null;throw Error(result.error || "Génération indisponible.");}
      if(!alive.current)return;
      setBatches(old=>[result,...old.filter(b=>b.id!==result.id)].slice(0,20));intent.current=null;
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:"Génération indisponible.");}
    finally{if(alive.current)setBusy(false);}
  }
  return <section className="ai-workshop" aria-label="Atelier IA">
    <h3><Sparkles size={18}/> Atelier de défis</h3>
    <p className="muted">Trois idées et leurs badges. Relis et adapte chaque proposition avant publication.</p>
    <label>Ambiance<select value={theme} disabled={busy} onChange={e=>{setTheme(e.target.value as typeof theme);intent.current=null;}}>{aiThemes.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
    <button className="secondary full" disabled={busy || !ready} onClick={()=>void generate()}>{busy?"Préparation des propositions…":"Générer 3 défis"}</button>
    <p className="fine-print">Dix lots maximum par jour pour tout le jeu. Les propositions enregistrées sont réutilisables sans appel IA.</p>
    {error && <p role="alert" className="coral">{error}</p>}
    {batches.map(batch=><article key={batch.id} className="ai-batch">
      <p className="fine-print">{batch.theme} · {new Date(batch.created_at).toLocaleDateString("fr-FR")} · {batch.source==="ai"?"Propositions IA":"Modèles préparés : IA non configurée, indisponible ou réponse écartée"}</p>
      {batch.diagnostic && <p role="status" className="notice">{aiDiagnostics[batch.diagnostic]}{batch.provider_status ? ` HTTP ${batch.provider_status}.` : ""}{batch.provider_code !== undefined ? ` Code Cloudflare : ${batch.provider_code}.` : ""}</p>}
      {batch.suggestions.map((s,i)=>{const Icon=icons[s.badge_icon];return <div key={i} className="ai-suggestion">
        <span className={`ai-badge ai-badge-${s.badge_icon}`}><Icon size={28}/></span>
        <div><strong>{s.title}</strong><p>{s.intro}</p><small>Badge : {s.badge_label}</small></div>
        <button className="text-button" disabled={busy} onClick={()=>onChoose(suggestionDraft(s,i))}>Modifier et préparer</button>
      </div>;})}
    </article>)}
  </section>;
}
