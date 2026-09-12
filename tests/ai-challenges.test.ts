import { test } from "node:test";
import assert from "node:assert/strict";
import { preparedSuggestions,parseSuggestions,suggestionDraft,generateSuggestions } from "../lib/ai/challenges";
import { competitionDraftSchema } from "../lib/events/validation";
test("AI suggestions cannot supply rewards, executable markup or consumption objectives",()=>{
 const rows=preparedSuggestions("espace");assert.equal(parseSuggestions(JSON.stringify(rows)).length,3);
 assert.throws(()=>parseSuggestions(JSON.stringify([{...rows[0],reward:999},...rows.slice(1)])));
 assert.throws(()=>parseSuggestions(JSON.stringify([{...rows[0],title:"Boire des cocktails"},...rows.slice(1)])));
 assert.throws(()=>parseSuggestions(JSON.stringify([{...rows[0],intro:"<script>alert(1)</script>"},...rows.slice(1)])));
});
test("drafts use fixed healthy categories, dates and no model supplied score",()=>{
 preparedSuggestions("zen").forEach((s,i)=>assert.ok(competitionDraftSchema.safeParse(suggestionDraft(s,i,new Date("2026-09-11T12:00:00Z"))).success));
 assert.equal(suggestionDraft(preparedSuggestions("zen")[0],0).catalog_id,"pause");
});
test("provider failure returns three reusable templates without retrying",async()=>{
 let calls=0;const fake=async()=>{calls++;return new Response("",{status:429});};
 const result=await generateSuggestions("jungle",{accountId:"a".repeat(32),token:"fake"},fake as typeof fetch);
 assert.equal(result.source,"fallback");assert.equal(result.suggestions.length,3);assert.equal(calls,1);
});
test("successful response is validated and provider sees no player data",async()=>{
 let body="";
 const fake=async(_input:unknown,init?:RequestInit)=>{body=String(init?.body);return Response.json({success:true,result:{response:JSON.stringify(preparedSuggestions("pirates"))}});};
 assert.equal((await generateSuggestions("pirates",{accountId:"a".repeat(32),token:"fake"},fake as typeof fetch)).source,"ai");
 assert.equal(JSON.parse(body).max_tokens,900);
});

test("fallback distinguishes configuration, provider refusal and rejected content without leaking details",async()=>{
 assert.equal((await generateSuggestions("zen",null)).diagnostic,"configuration");
 const config={accountId:"a".repeat(32),token:"secret-must-stay-server-side"};
 const refused=await generateSuggestions("zen",config,(async()=>new Response("secret provider response",{status:403})) as typeof fetch);
 assert.equal(refused.diagnostic,"access_denied");
 assert.ok(!JSON.stringify(refused).includes(config.token));
 const invalid=await generateSuggestions("zen",config,(async()=>Response.json({success:true,result:{response:"not json"}})) as typeof fetch);
 assert.equal(invalid.diagnostic,"invalid_output");
});
