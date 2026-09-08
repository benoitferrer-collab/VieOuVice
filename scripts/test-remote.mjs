/** Non-destructive integration tests on disposable, pre-created test accounts.
 * No service-role client; every gameplay request carries the user's real JWT.
 * Creates a harmless bounded declaration, never deletes/reset remote data.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=process.env;
for(const name of ['TEST_SUPABASE_URL','TEST_SUPABASE_PUBLIC_KEY','TEST_A_EMAIL','TEST_A_PASSWORD','TEST_B_EMAIL','TEST_B_PASSWORD'])assert.ok(env[name],`${name} requis`);
assert.equal(env.CONFIRM_DISPOSABLE_TEST_PROJECT,'yes','Utiliser uniquement un projet SaaS de test dédié.');
const url=env.TEST_SUPABASE_URL,key=env.TEST_SUPABASE_PUBLIC_KEY;
assert.ok(!key.startsWith('sb_secret_'),'Clé publique uniquement');
if(key.startsWith('eyJ'))assert.equal(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role,'anon');
const make=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const a=make(),b=make(),anon=make();
async function login(client,email,password){const {data,error}=await client.auth.signInWithPassword({email,password});assert.equal(error,null,'Connexion au compte de test');assert.ok(data.user);return data.user.id}
const [aid,bid]=await Promise.all([login(a,env.TEST_A_EMAIL,env.TEST_A_PASSWORD),login(b,env.TEST_B_EMAIL,env.TEST_B_PASSWORD)]);
for(const [client,id] of [[a,aid],[b,bid]]){const {data,error}=await client.rpc('get_game_state');assert.equal(error,null,'Installation SQL requise');if(!data){const p=await client.rpc('create_profile',{p_nickname:'Test_'+id.slice(0,10),p_avatar:0});assert.equal(p.error,null)}}
assert.ok((await anon.from('actions').select('*')).error,'Anonyme interdit');
const hidden=await a.from('actions').select('id').eq('user_id',bid);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[],'Journal de B invisible à A');
assert.ok((await a.from('users').update({life_balance:99999}).eq('id',aid)).error,'Score non modifiable');
assert.ok((await a.from('actions').insert({user_id:aid,minutes_impact:999})).error,'Insertion directe interdite');
assert.ok((await a.rpc('record_action',{p_catalog_id:'pause',p_quantity:1,p_idempotency_key:randomUUID(),user_id:bid})).error,'Argument forgé interdit');
const intent={p_catalog_id:'pause',p_quantity:1,p_idempotency_key:randomUUID()};
const results=await Promise.all([a.rpc('record_action',intent),a.rpc('record_action',intent),a.rpc('record_action',intent)]);
results.forEach(r=>assert.equal(r.error,null,'Retry concurrent réussi'));
assert.equal(new Set(results.map(r=>r.data.id)).size,1,'Un seul événement');
const rows=await a.from('actions').select('id').eq('idempotency_key',intent.p_idempotency_key);assert.equal(rows.data?.length,1);
assert.ok((await a.rpc('record_action',{...intent,p_quantity:2})).error,'Payload différent rejeté');
assert.ok((await a.rpc('record_action',{...intent,p_quantity:0,p_idempotency_key:randomUUID()})).error,'Quantité zéro rejetée');
const exportResult=await a.rpc('export_my_data');assert.equal(exportResult.error,null);assert.equal(exportResult.data.profile.id,aid);assert.ok(exportResult.data.actions.every(x=>x.user_id===aid));
const otherMembership=await a.from('league_memberships').select('*').eq('user_id',bid);assert.deepEqual(otherMembership.data,[]);
console.log('OK : authentification A/B, RLS journaux/appartenances, anti-falsification, idempotence concurrente, quantité, export privé.');
console.log('Non exécutés ici : dons après 24 h, capacité 30, Realtime inter-ligues, clôture concurrente et confidentialité avancée. Voir docs/testing.md.');
await Promise.all([a.auth.signOut(),b.auth.signOut()]);
