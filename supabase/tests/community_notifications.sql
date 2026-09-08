-- Supabase SQL Editor / propriétaire, après V1 + seed + migration 002 (003 facultative).
-- Tests d'intégration transactionnels : toutes les fixtures et mutations sont annulées.
-- NON EXÉCUTÉS par l'agent. Ne pas exécuter en production sous forte charge :
-- les RPC prennent le verrou global et ensure_season peut clôturer une saison, annulée ici.
-- Le propriétaire émule les JWT via request.jwt.claim.sub/claims. Les assertions de
-- privilèges/RLS complètent cette émulation, qui ne remplace pas des requêtes HTTP réelles.
begin;
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 a_name text:='qa_'||substr(replace(a::text,'-',''),1,14);
 b_name text:='qa_'||substr(replace(b::text,'-',''),1,14);
 c_name text:='qa_'||substr(replace(c::text,'-',''),1,14);
 key1 uuid:=gen_random_uuid(); action_key uuid:=gen_random_uuid();
 item jsonb; replay jsonb; cat1 text; cat2 text; excess text;
 result jsonb; state jsonb; failed boolean; n integer; s uuid; notice_id uuid; notice_read_at timestamptz;
begin
 insert into auth.users(id) values(a),(b),(c);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.create_profile(a_name,0);
 state:=public.get_game_state();
 if state->>'community_enabled' is distinct from 'true' or state->'social_settings' is distinct from jsonb_build_object('share_activity',false,'notify_friends',true,'notify_duels',true) then raise exception 'Réglages initiaux';end if;
 if not(state ?& array['catalog','actions','players','friends','nemesis','notifications','calm','soft','pvp','balance','season_end']) then raise exception 'Contrat V1 perdu';end if;
 item:=public.create_catalog_action('  Marche test  ','health',' minutes ',120,10,key1);cat1:=item->>'id';
 if length(cat1)>40 or item->>'label'<>'Marche test' or item->>'unit'<>'minutes' or item->>'creator_id'<>a::text or item->>'creator_name'<>a_name or (item->>'coefficient')::int<>120 or (item->>'daily_cap')::int<>120 or item->>'icon'<>'leaf' then raise exception 'Création/snapshot catalogue';end if;
 replay:=public.create_catalog_action('  Marche test  ','health',' minutes ',120,10,key1);
 if replay<>item then raise exception 'Replay création non stable';end if;
 failed:=false;begin perform public.create_catalog_action('Marche test','health','minutes',120,10,key1);exception when others then failed:=true;end;
 if not failed then raise exception 'Clé création accepte un payload différent après normalisation';end if;
 failed:=false;begin perform public.create_catalog_action('Trop fort','health','minutes',121,10,gen_random_uuid());exception when others then failed:=true;end;
 if not failed then raise exception 'Magnitude >120 acceptée';end if;
 failed:=false;begin perform public.create_catalog_action('Trop court','health','x',1,1,gen_random_uuid());exception when others then failed:=true;end;
 if not failed then raise exception 'Unité invalide acceptée';end if;
 failed:=false;begin perform public.create_catalog_action('Nulle','health','minutes',null,1,gen_random_uuid());exception when others then failed:=true;end;
 if not failed then raise exception 'Magnitude NULL acceptée';end if;
 cat2:=public.create_catalog_action('Course test','health','minutes',120,10,gen_random_uuid())->>'id';
 perform public.create_catalog_action('Variante trois','health','minutes',10,1,gen_random_uuid());
 perform public.create_catalog_action('Variante quatre','health','minutes',10,1,gen_random_uuid());
 perform public.create_catalog_action('Variante cinq','excess','portions',10,1,gen_random_uuid());
 failed:=false;begin perform public.create_catalog_action('Variante six','health','minutes',10,1,gen_random_uuid());exception when others then failed:=true;end;
 if not failed then raise exception 'Sixième création quotidienne acceptée';end if;
 if public.create_catalog_action('  Marche test  ','health',' minutes ',120,10,key1)<>item then raise exception 'Replay refusé au plafond';end if;
 failed:=false;begin update public.action_catalog set label='Modification' where id=cat1;exception when others then failed:=true;end;
 if not failed then raise exception 'Catalogue communautaire mutable';end if;
 failed:=false;begin delete from public.action_catalog where id=cat1;exception when others then failed:=true;end;
 if not failed then raise exception 'Catalogue communautaire supprimable';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 perform public.create_profile(b_name,1);
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 perform public.create_profile(c_name,2);
 excess:=public.create_catalog_action('Écart test','excess','portions',120,10,gen_random_uuid())->>'id';
 if (select coefficient<>-120 or daily_cap<>0 or icon<>'flame' from public.action_catalog where id=excess) then raise exception 'Tarif excès';end if;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted'),(a,c,'pending');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 result:=public.record_action(cat1,10,action_key);
 if (result->>'minutes_impact')::int<>120 or result->>'label'<>item->>'label' or result->>'kind'<>'health' or (result->>'tariff_version')::int<>(item->>'version')::int then raise exception 'Snapshot action/plafond catégorie';end if;
 if exists(select 1 from public.notifications where actor_id=a and kind='friend_action') then raise exception 'Partage désactivé divulgue une action';end if;
 if public.record_action(cat1,10,action_key)<>result then raise exception 'Replay action';end if;
 failed:=false;begin perform public.record_action(cat1,1,action_key);exception when others then failed:=true;end;
 if not failed then raise exception 'Conflit idempotence action accepté';end if;
 result:=public.record_action(cat2,10,gen_random_uuid());
 if (result->>'minutes_impact')::int<>30 then raise exception 'Plafond global communauté 150 contourné';end if;
 result:=public.record_action(cat1,1,gen_random_uuid());
 if (result->>'minutes_impact')::int<>0 then raise exception 'Plafond catégorie contourné';end if;
 perform public.update_settings(true,true,true);
 perform public.update_notification_settings(true,true,true);
 state:=public.get_game_state();
 if not((state->>'calm')::boolean and (state->>'soft')::boolean and (state->>'pvp')::boolean) then raise exception 'Anciens réglages écrasés';end if;
 result:=public.record_action(excess,1,gen_random_uuid());
 if (result->>'minutes_impact')::int<>-120 then raise exception 'Excès plafonné à tort';end if;
 select count(*) into n from public.notifications where user_id=b and actor_id=a and kind='friend_action';
 if n<>1 then raise exception 'Ami accepté non notifié : %',n;end if;
 if exists(select 1 from public.notifications where user_id=c and actor_id=a and kind='friend_action') then raise exception 'Invitation en attente divulgue une action';end if;
 perform public.record_action(excess,1,gen_random_uuid());
 if (select count(*) from public.notifications where user_id=b and actor_id=a and kind='friend_action')<>1 then raise exception 'Coalescence horaire amis';end if;
 perform public.update_notification_settings(false,true,true);
 if exists(select 1 from public.notifications where actor_id=a and kind='friend_action' and read_at is null) then raise exception 'Retrait du partage conserve détails non lus';end if;
 perform public.update_notification_settings(true,true,true);
 perform public.record_action(cat1,1,gen_random_uuid());
 if exists(select 1 from public.notifications where actor_id=a and kind='friend_action') then raise exception 'Réactivation contourne coalescence horaire';end if;
 perform public.update_notification_settings(false,true,true);
 -- Les plafonds officiels sont indépendants des 150 minutes communautaires.
 result:=public.record_action('walk',3,gen_random_uuid());
 if (result->>'minutes_impact')::int<>75 then raise exception 'Plafond communauté affecte catalogue officiel';end if;
 -- Réception désactivée : une autre source autorisée ne peut pas diffuser.
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 perform public.update_notification_settings(false,false,true);
 insert into public.friendships(requester,recipient,status) values(c,b,'accepted');
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 perform public.update_notification_settings(true,true,true);
 perform public.record_action(excess,1,gen_random_uuid());
 if exists(select 1 from public.notifications where user_id=b and actor_id=c and kind='friend_action') then raise exception 'Réception désactivée ignorée';end if;
 -- Fixture bloquée volontairement acceptée pour tester la défense en profondeur.
 update public.friendships set status='accepted' where requester=a and recipient=c;
 insert into public.blocks(blocker,blocked) values(a,c);
 perform public.record_action(excess,1,gen_random_uuid());
 if exists(select 1 from public.notifications where user_id=a and actor_id=c and kind='friend_action') then raise exception 'Blocage ignoré pour les actions';end if;
 -- Une notice étrangère reste non lue ; lire sa propre notice est idempotent.
 select id into notice_id from public.notifications where user_id=a and kind='system' and read_at is null order by created_at limit 1;
 perform public.read_notification(notice_id);
 if (select read_at from public.notifications where id=notice_id) is not null then raise exception 'Lecture d’une notice tierce';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.read_notification(notice_id);
 select read_at into notice_read_at from public.notifications where id=notice_id;
 if notice_read_at is null then raise exception 'Lecture individuelle non enregistrée';end if;
 perform public.read_notification(notice_id);
 if (select read_at from public.notifications where id=notice_id) is distinct from notice_read_at then raise exception 'Lecture individuelle non idempotente';end if;
 -- Une nouvelle paire notifie les deux joueurs opt-in, sans action personnelle.
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 perform public.update_settings(false,false,true);
 select season_id into s from public.league_memberships where user_id=a order by season_id limit 1;
 insert into public.nemesis_pairs(season_id,user_a,user_b) values(s,least(a,b),greatest(a,b));
 if (select count(*) from public.notifications where kind='duel_started' and user_id in(a,b) and actor_id in(a,b))<>2 then raise exception 'Début duel';end if;
 -- A=-15 et B=0; un excès de B retourne le meneur après application du ledger.
 perform public.record_action(excess,1,gen_random_uuid());
 if (select count(*) from public.notifications where kind='duel_lead' and user_id in(a,b) and actor_id in(a,b))<>2 then raise exception 'Changement de meneur';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.record_action(excess,1,gen_random_uuid());
 if (select count(*) from public.notifications where kind='duel_lead' and user_id in(a,b) and actor_id in(a,b))<>2 then raise exception 'Cap horaire changement de meneur';end if;
 update public.seasons set closed_at=clock_timestamp() where id=s;
 if (select count(*) from public.notifications where kind='duel_finished' and user_id in(a,b) and actor_id in(a,b))<>2 then raise exception 'Fin de duel';end if;
 update public.seasons set closed_at=clock_timestamp() where id=s;
 if (select count(*) from public.notifications where kind='duel_finished' and user_id in(a,b) and actor_id in(a,b))<>2 then raise exception 'Fin de duel dupliquée';end if;
 perform public.block_user(b_name);
 if exists(select 1 from public.notifications where read_at is null and ((user_id=a and actor_id=b) or(user_id=b and actor_id=a))) then raise exception 'Blocage conserve notifications sociales non lues';end if;
 if exists(select 1 from public.users u where u.id in(a,b,c) and u.life_balance<>(select coalesce(sum(l.life_delta),0) from private.life_ledger l where l.user_id=u.id)) then raise exception 'Ledger désynchronisé';end if;
 if exists(select 1 from public.leaderboard_entries e where e.user_id in(a,b,c) and e.weekly_score<>(select coalesce(sum(l.league_delta),0) from private.life_ledger l where l.user_id=e.user_id and l.season_id=e.season_id)) then raise exception 'Projection désynchronisée';end if;
 failed:=false;begin perform public.update_notification_settings(null,true,true);exception when others then failed:=true;end;
 if not failed then raise exception 'Réglage NULL accepté';end if;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 failed:=false;begin perform public.create_catalog_action('Anonyme','health','minutes',1,1,gen_random_uuid());exception when others then failed:=true;end;
 if not failed then raise exception 'Création sans authentification';end if;
 raise notice 'Comportements communauté / notifications : OK (transaction annulée en fin de fichier)';
end $test$;
do $test$ begin
 if has_function_privilege('anon','public.read_notification(uuid)','EXECUTE') or has_function_privilege('anon','public.create_catalog_action(text,text,text,integer,integer,uuid)','EXECUTE') or has_function_privilege('anon','public.update_notification_settings(boolean,boolean,boolean)','EXECUTE') then raise exception 'RPC publique anonyme';end if;
 if not has_function_privilege('authenticated','public.create_catalog_action(text,text,text,integer,integer,uuid)','EXECUTE') or not has_function_privilege('authenticated','private.create_catalog_action(text,text,text,integer,integer,uuid)','EXECUTE') then raise exception 'Wrapper inaccessible';end if;
 if has_table_privilege('authenticated','public.action_catalog','INSERT') or has_table_privilege('authenticated','public.notifications','INSERT') or has_table_privilege('authenticated','private.catalog_creation_requests','SELECT') then raise exception 'Accès direct excessif';end if;
 if has_function_privilege('authenticated','private.emit_duel_notifications(uuid,uuid,uuid,text,text)','EXECUTE') or has_function_privilege('authenticated','private.notify_action_social()','EXECUTE') then raise exception 'Helper social exposé';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_catalog_action','update_notification_settings') and p.prosecdef) then raise exception 'Wrapper public definer';end if;
 raise notice 'Privilèges communauté : OK';
end $test$;
rollback;
