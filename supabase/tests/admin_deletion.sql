-- Owner-only isolated PostgreSQL tests after 001–016 + seed; synthetic data only.
-- Direct auth.users DELETE emulates the database phase of Auth Admin deletion,
-- not a production SQL deletion interface. Every fixture is rolled back.
begin;
create function pg_temp.check_fails(command text) returns void language plpgsql as $$declare failed boolean:=false;begin
 begin execute command;exception when others then failed:=true;end;
 if not failed then raise exception 'Expected failure: %',command;end if;
end$$;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid;plain uuid:=gen_random_uuid();ev uuid:=gen_random_uuid();coop uuid:=gen_random_uuid();shared uuid:=gen_random_uuid();act uuid;cat text;nick text;balance integer;xp bigint;push_id uuid;v_notice uuid;owner_name text:=current_user;w date:=private.progression_week_start(clock_timestamp());x jsonb;
begin
 foreach u in array array[a,b,c] loop
 insert into auth.users(id) values(u);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.create_profile('del_'||substr(replace(u::text,'-',''),1,14),0);
 end loop;
 select nickname into nick from public.users where id=b;
 insert into private.player_access values(a,true,false);
 if has_function_privilege('authenticated','public.prepare_admin_account_deletion(uuid,uuid,text)','execute') or has_function_privilege('anon','public.admin_delete_challenge(text,uuid,text)','execute') or has_function_privilege('service_role','private.cleanup_deleted_auth_user()','execute') or has_table_privilege('service_role','private.account_purge_context','insert') or has_function_privilege('authenticated','private.assert_user_before_deletion()','execute') then raise exception 'Unsafe ACL';end if;
 perform pg_temp.check_fails(format('select public.prepare_admin_account_deletion(%L,%L,%L)',c,b,nick));
 perform pg_temp.check_fails(format('select public.prepare_admin_account_deletion(%L,%L,%L)',a,a,nick));
 perform pg_temp.check_fails(format('select public.prepare_admin_account_deletion(%L,%L,%L)',a,b,'wrong'));
 perform pg_temp.check_fails(format('delete from auth.users where id=%L',b));
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform pg_temp.check_fails('select public.admin_list_cooperative_challenges()');
 select id into cat from public.action_catalog where active and kind='health' limit 1;
 x:=public.record_action(cat,1,gen_random_uuid());act:=(x->>'id')::uuid;
 perform public.choose_weekly_mission('new_habit');
 insert into private.xp_awards(user_id,week_start,code) values(b,w,'new_habit') on conflict do nothing;
 insert into private.progression_badges(user_id,code,week_start) values(b,'premier_trio',w);
 insert into private.equipped_cosmetics(user_id) values(b);
 perform set_config('viegame.purge_user',b::text,true);
 perform pg_temp.check_fails(format('delete from public.actions where user_id=%L',b));
 perform pg_temp.check_fails(format('delete from private.life_ledger where user_id=%L',b));
 perform pg_temp.check_fails(format('delete from private.xp_awards where user_id=%L',b));
 -- A shared category survives with identical tariff, and loses its creator metadata.
 select public.create_catalog_action('Test partage','health','portion',10,1,gen_random_uuid())->>'id' into cat;
 insert into public.friendships(requester,recipient,status) values(b,c,'accepted');
 perform public.register_push_subscription('https://fcm.googleapis.com/deletion-'||b,repeat('A',87),repeat('B',22));
 insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key) values(b,'Fixture push','friend_accepted',c,'amis','del-test:'||b) returning id into v_notice;
 select id into push_id from private.push_outbox where private.push_outbox.notification_id=v_notice;
 if push_id is null then raise exception 'Push fixture not queued';end if;

 insert into public.life_transfers(donor,recipient,amount,idempotency_key) values(b,c,1,gen_random_uuid());
 insert into private.friend_messages(sender_id,recipient_id,body,idempotency_key) values(b,c,'Sortant',gen_random_uuid()),(c,b,'Entrant',gen_random_uuid());
 insert into private.competitions(id,title,description,starts_at,ends_at,metric,badge_label,badge_icon,status) values(ev,'A supprimer','',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 day','health_minutes','Badge','medal','published');
 insert into private.competition_members(event_id,user_id) values(ev,b),(ev,c);
 insert into private.competition_results values(ev,b,nick,0,10,1,1),(ev,c,'Autre joueur',0,9,2,1);
 insert into private.competition_badges(event_id,user_id,event_title,label,icon,kind,rank) values(ev,b,'A supprimer','Badge','medal','winner',1),(ev,c,'A supprimer','Badge','medal','podium',2);
 insert into private.cooperative_challenges(id,creator_id,template,target,ends_at) values(coop,b,'walk',60,clock_timestamp()+interval '1 day'),(shared,c,'walk',60,clock_timestamp()+interval '1 day');
 insert into private.cooperative_members(challenge_id,user_id,status) values(coop,b,'accepted'),(coop,c,'accepted'),(shared,c,'accepted'),(shared,b,'invited');
 insert into private.cooperative_badges(challenge_id,user_id) values(coop,b),(coop,c);
 insert into private.cooperative_requests values(c,gen_random_uuid(),jsonb_build_object('friends',jsonb_build_array(b)),shared);
 insert into private.ai_challenge_batches(id,actor_id,theme) values(gen_random_uuid(),b,'zen');
 insert into private.admin_audit(actor_id,action,target_id,reason) values(b,'test',c::text,'fixture');
 select life_balance into balance from public.users where id=c;
 select coalesce(sum(aw.xp),0) into xp from private.xp_awards aw where user_id=c;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.prepare_admin_account_deletion(a,b,nick);
 -- Revalidation after ticket preparation: suspension, expiry and nickname mismatch.
 update private.player_access set suspended=true where user_id=a;
 perform pg_temp.check_fails(format('delete from auth.users where id=%L',b));
 update private.player_access set suspended=false where user_id=a;
 update private.account_delete_tickets set expires_at=clock_timestamp()-interval '1 second' where target_id=b;
 perform pg_temp.check_fails(format('delete from auth.users where id=%L',b));
 perform public.prepare_admin_account_deletion(a,b,nick);
 update private.account_delete_tickets set confirmed_nickname='stale' where target_id=b;
 perform pg_temp.check_fails(format('delete from auth.users where id=%L',b));
 perform public.prepare_admin_account_deletion(a,b,nick);
 -- A downstream Auth failure rolls back *all* cleanup (same transaction).
 begin
 delete from auth.users where id=b;
 raise exception using errcode='ZX001',message='Simulated later Auth failure';
 exception when sqlstate 'ZX001' then null;end;
 if not exists(select 1 from auth.users where id=b) or not exists(select 1 from public.users where id=b) or not exists(select 1 from public.actions where id=act) or not exists(select 1 from private.account_delete_tickets where target_id=b) then raise exception 'Nonatomic cleanup';end if;
 delete from auth.users where id=b;
 if exists(select 1 from public.users where id=b) or exists(select 1 from private.friend_messages where sender_id=b or recipient_id=b) or exists(select 1 from private.cooperative_challenges where id=coop) or exists(select 1 from private.cooperative_requests where payload->'friends' @> jsonb_build_array(b)) or exists(select 1 from private.account_purge_context) then raise exception 'Incomplete cleanup';end if;
 if exists(select 1 from private.push_outbox where id=push_id) or exists(select 1 from public.notifications where id=v_notice) then raise exception 'Push data remains';end if;
 if not exists(select 1 from public.action_catalog where id=cat and creator_id is null and creator_name is null and created_at is null and coefficient=10) then raise exception 'Shared catalogue lost';end if;
 if (select life_balance from public.users where id=c)<>balance or (select coalesce(sum(aw.xp),0) from private.xp_awards aw where user_id=c)<>xp or not exists(select 1 from private.competition_results where event_id=ev and user_id=c and rank=2) then raise exception 'Other player changed';end if;
 perform pg_temp.check_fails(format('delete from private.life_ledger where user_id=%L',c));
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform pg_temp.check_fails('select public.create_profile(''reanimated'',0)');
 insert into auth.users(id) values(plain);delete from auth.users where id=plain;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform pg_temp.check_fails(format('select public.admin_delete_challenge(''competition'',%L,''wrong'')',ev));
 execute 'set local role authenticated';
 x:=public.admin_list_cooperative_challenges();
 perform public.admin_delete_challenge('competition',ev,'A supprimer');
 perform public.admin_delete_challenge('cooperative',shared,'Marcher ensemble');
 execute format('set local role %I',owner_name);
 if exists(select 1 from private.competitions where id=ev) or exists(select 1 from private.cooperative_challenges where id=shared) then raise exception 'Challenge remains';end if;
 if (select life_balance from public.users where id=c)<>balance or (select coalesce(sum(aw.xp),0) from private.xp_awards aw where user_id=c)<>xp then raise exception 'Challenge deletion changed earned balance/XP';end if;
 raise notice 'Admin deletion: ACL, confirmations, tickets, stale JWT, immutable guards, dependencies and rollback passed';
end $test$;
rollback;
