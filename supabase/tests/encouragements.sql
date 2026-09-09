-- Owner-run assertions after migrations 001–005. Every fixture is rolled back.
-- JWT + SET LOCAL ROLE exercise SQL grants; they do not replace HTTP tests.
begin;
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 act uuid; result jsonb; notice_id uuid; job_id uuid;
 token uuid:=gen_random_uuid(); rejected boolean; before_count integer; i integer;
begin
 insert into auth.users(id) values(a),(b),(c);
 foreach token in array array[a,b,c] loop
  perform set_config('request.jwt.claim.sub',token::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',token,'role','authenticated')::text,true);
  perform public.create_profile('qa_'||substr(replace(token::text,'-',''),1,14),0);
 end loop;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 update public.user_settings set share_history=true where user_id=b;
 perform set_config('request.jwt.claim.sub',b::text,true);
 act:=(public.record_action((select id from public.action_catalog where active limit 1),1,gen_random_uuid())->>'id')::uuid;
 perform public.register_push_subscription('https://fcm.googleapis.com/qa-reactions-'||b,repeat('A',87),repeat('B',22));
 rejected:=false;
 begin perform public.set_action_reaction(act,'clap'); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Self reaction accepted';end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 rejected:=false;
 begin perform public.set_action_reaction(act,'clap'); exception when others then rejected:=true;end;
 if not rejected or public.get_encouragements(array[act])<>'[]'::jsonb then raise exception 'Nonfriend exposed';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 execute 'set local role authenticated';
 result:=public.set_action_reaction(act,'clap');
 if result->>'mine'<>'clap' or (result->'counts'->>'clap')::int<>1 then raise exception 'Invalid reaction contract';end if;
 perform public.set_action_reaction(act,'clap');
 execute 'reset role';
 if (select count(*) from private.reaction_mutations where actor_id=a)<>1 then raise exception 'Retry consumed quota';end if;
 perform public.set_action_reaction(act,'strength');
 perform public.set_action_reaction(act,null);
 perform public.set_action_reaction(act,null);
 perform public.set_action_reaction(act,'laugh');
 if (select count(*) from private.reaction_mutations where actor_id=a)<>4 then raise exception 'Mutation accounting incorrect';end if;
 update public.user_settings set share_history=false where user_id=b;
 if public.get_encouragements(array[act])<>'[]'::jsonb then raise exception 'Private history exposed';end if;
 rejected:=false;
 begin perform public.set_action_reaction(act,'clap'); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Private history mutation accepted';end if;
 update public.user_settings set share_history=true where user_id=b;
 insert into public.blocks(blocker,blocked) values(b,a);
 if public.get_encouragements(array[act])<>'[]'::jsonb then raise exception 'Blocked history exposed';end if;
 delete from public.blocks where blocker=b and blocked=a;
 insert into private.player_access(user_id,suspended) values(b,true);
 if public.get_encouragements(array[act])<>'[]'::jsonb then raise exception 'Suspended author exposed';end if;
 update private.player_access set suspended=false where user_id=b;
 insert into private.player_access(user_id,suspended) values(a,true);
 rejected:=false;
 begin perform public.get_encouragements(array[act]); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Suspended caller accepted';end if;
 update private.player_access set suspended=false where user_id=a;
 rejected:=false;
 begin perform public.get_encouragements(array_fill(act,array[51])); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Read cap bypassed';end if;
 -- Move only private event timestamps, never immutable action rows.
 update private.action_reactions set first_reacted_at=date_trunc('hour',clock_timestamp())-interval '1 minute' where actor_id=a and action_id=act;
 perform private.flush_reaction_digests(b);
 select id into notice_id from public.notifications where user_id=b and kind='reaction_digest';
 if notice_id is null or not private.push_notification_eligible(notice_id) then raise exception 'Digest absent or ineligible';end if;
 if (select actor_id is not null or target_tab<>'survie' or message<>'Tu as reçu 1 encouragement(s) sur 1 déclaration(s).' from public.notifications where id=notice_id) then raise exception 'Digest disclosed details';end if;
 select id into job_id from private.push_outbox where notification_id=notice_id;
 if job_id is null then raise exception 'Digest not queued';end if;
 perform private.flush_reaction_digests(b);
 perform public.set_action_reaction(act,'clap');
 perform private.flush_reaction_digests(b);
 if (select count(*) from public.notifications where user_id=b and kind='reaction_digest')<>1 then raise exception 'Duplicate digest';end if;
 token:=gen_random_uuid();
 update private.push_outbox set status='leased',attempts=1,lease_token=token,lease_until=clock_timestamp()+interval '60 seconds' where id=job_id;
 if private.authorize_push_job(job_id,token) is null then raise exception 'Valid digest push refused';end if;
 -- Consent withdrawn after lease must prevent actual dispatch, even if restored.
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.set_reaction_preferences(false);
 perform public.set_reaction_preferences(true);
 if private.authorize_push_job(job_id,token) is not null then raise exception 'Withdrawn digest authorized';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.set_action_reaction(act,null);
 perform public.set_action_reaction(act,'clap');
 perform private.flush_reaction_digests(b);
 if exists(select 1 from public.notifications where user_id=b and kind='reaction_digest') then raise exception 'Readdition renotified';end if;
 -- Quota applies to replacements/removals, but retries remain free at the cap.
 before_count:=(select count(*) from private.reaction_mutations where actor_id=a and created_at>clock_timestamp()-interval '1 minute');
 for i in before_count+1..20 loop perform public.set_action_reaction(act,case when i%2=0 then 'strength' else 'laugh' end);end loop;
 rejected:=false;
 begin perform public.set_action_reaction(act,'clap'); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Minute quota bypassed';end if;
 perform public.set_action_reaction(act,'strength');
 update private.reaction_mutations set created_at=clock_timestamp()-interval '2 minutes' where actor_id=a;
 insert into private.reaction_mutations(actor_id,created_at) select a,clock_timestamp()-interval '2 minutes' from generate_series(1,80);
 rejected:=false;
 begin perform public.set_action_reaction(act,'clap'); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Daily quota bypassed';end if;
 result:=public.export_my_data();
 if not result ? 'reactions' or jsonb_array_length(result->'reactions')<>1 or not result ? 'push_subscriptions' or not result ? 'competition_badges' then raise exception 'Export chain broken';end if;
 if has_table_privilege('authenticated','private.action_reactions','SELECT') or has_table_privilege('anon','private.reaction_mutations','INSERT') then raise exception 'Private table granted';end if;
 if has_function_privilege('authenticated','private.flush_reaction_digests(uuid)','EXECUTE') or has_function_privilege('anon','public.get_encouragements(uuid[])','EXECUTE') or has_function_privilege('authenticated','private.export_my_data_before_reactions()','EXECUTE') then raise exception 'Internal function exposed';end if;
 if not has_function_privilege('authenticated','public.set_action_reaction(uuid,text)','EXECUTE') then raise exception 'RPC not granted';end if;
 execute 'set local role anon';
 rejected:=false;
 begin perform public.get_encouragements(array[act]); exception when insufficient_privilege then rejected:=true;end;
 execute 'reset role';
 if not rejected then raise exception 'Anon RPC executable';end if;
 raise notice 'Encouragement SQL assertions passed (fixtures rolled back).';
end $test$;
-- Aggregation of several closed hours, expiry, read suppression, own reads.
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); u uuid;
 act1 uuid; act2 uuid; act3 uuid; expired uuid; notice_id uuid; rejected boolean;
begin
 insert into auth.users(id) values(a),(b),(c);
 foreach u in array array[a,b,c] loop
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.create_profile('qa_'||substr(replace(u::text,'-',''),1,14),0);
 end loop;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted'),(c,b,'accepted');
 update public.user_settings set share_history=true where user_id=b;
 perform set_config('request.jwt.claim.sub',b::text,true);
 act1:=(public.record_action((select id from public.action_catalog where active limit 1),1,gen_random_uuid())->>'id')::uuid;
 act2:=(public.record_action((select id from public.action_catalog where active limit 1),1,gen_random_uuid())->>'id')::uuid;
 act3:=(public.record_action((select id from public.action_catalog where active limit 1),1,gen_random_uuid())->>'id')::uuid;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 select user_id,catalog_id,label,kind,quantity,0,tariff_version,season_id,clock_timestamp()-interval '8 days',gen_random_uuid() from public.actions where id=act1 returning id into expired;
 if jsonb_array_length(public.get_encouragements(array[act1]))<>1 or (public.get_encouragements(array[act1])->0->>'can_react')::boolean then raise exception 'Own reaction read invalid';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 if public.get_encouragements(array[expired])<>'[]'::jsonb then raise exception 'Expired action exposed';end if;
 rejected:=false;
 begin perform public.set_action_reaction(expired,'clap'); exception when others then rejected:=true;end;
 if not rejected then raise exception 'Expired action reaction accepted';end if;
 insert into private.action_reactions(action_id,actor_id,reaction,first_reacted_at) values
 (act1,a,'clap',date_trunc('hour',clock_timestamp())-interval '1 minute'),
 (act1,c,'strength',date_trunc('hour',clock_timestamp())-interval '2 hours'),
 (act2,a,'laugh',date_trunc('hour',clock_timestamp())-interval '3 hours'),
 (act2,c,'laugh',clock_timestamp()-interval '25 hours');
 perform private.flush_reaction_digests(b);
 select id into notice_id from public.notifications where user_id=b and kind='reaction_digest';
 if notice_id is null or (select message from public.notifications where id=notice_id)<>'Tu as reçu 3 encouragement(s) sur 2 déclaration(s).' then raise exception 'Closed-hour catchup aggregation invalid';end if;
 if (select processed_at is null from private.action_reactions where action_id=act2 and actor_id=c) then raise exception 'Expired pair not tombstoned';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.read_notification(notice_id);
 if private.push_notification_eligible(notice_id) then raise exception 'Read digest push eligible';end if;
 insert into private.action_reactions(action_id,actor_id,reaction,first_reacted_at) values(act3,a,'clap',date_trunc('hour',clock_timestamp())-interval '1 minute');
 perform private.flush_reaction_digests(b);
 if (select count(*) from public.notifications where user_id=b and kind='reaction_digest')<>1 then raise exception 'More than one delivery in current hour';end if;
 if (select processed_at is not null from private.action_reactions where action_id=act3 and actor_id=a) then raise exception 'New arrivals lost after current-hour delivery';end if;
end $test$;
rollback;
