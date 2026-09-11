-- LOCAL PostgreSQL only: fake pg_net + fake Vault; never run on a hosted project.
begin;
create schema net;
create schema vault;
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into vault.decrypted_secrets values('viegame_push_dispatch_url','https://viegame.vercel.app/api/push/dispatch'),('viegame_push_dispatch_token',repeat('x',32));
create table private.test_push_requests(id bigint generated always as identity,body jsonb);
create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language plpgsql as $$
declare result bigint;begin
 if current_setting('viegame.test_net_failure',true)='1' then raise exception 'Synthetic network enqueue failure';end if;
 if url<>'https://viegame.vercel.app/api/push/dispatch' or headers->>'Authorization'<>'Bearer '||repeat('x',32) then raise exception 'Wrong dispatch arguments';end if;
 insert into private.test_push_requests(body) values(body) returning id into result;return result;
end$$;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();act uuid;p jsonb;season uuid;
begin
 if has_function_privilege('authenticated','public.request_push_dispatch()','EXECUTE') or has_function_privilege('anon','private.request_push_dispatch()','EXECUTE') then raise exception 'Wake exposed';end if;
 insert into auth.users(id) values(a),(b);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.create_profile('qa_'||substr(replace(a::text,'-',''),1,14),0);
 perform public.update_notification_settings(true,true,true);
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.create_profile('qa_'||substr(replace(b::text,'-',''),1,14),1);
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 perform public.register_push_subscription('https://fcm.googleapis.com/qa-'||b,repeat('A',87),repeat('B',22));
 select id into season from public.seasons order by starts_at desc limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'pause','Pause','health',1,15,1,season,now()-interval '1 minute',gen_random_uuid()) returning id into act;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'pause','Pause','health',1,15,1,season,now()-interval '1 minute',gen_random_uuid());
 if (select count(*) from public.notifications where user_id=b and kind='friend_action')<>2 then raise exception 'Activities still grouped';end if;
 if (select count(*) from private.test_push_requests)<>1 then raise exception 'Expected one wake per transaction';end if;
 if exists(select 1 from private.test_push_requests where body<>'{}'::jsonb) then raise exception 'Private payload leaked';end if;
 update private.push_outbox set status='sent';
 perform set_config('viegame.push_requested','',true);
 if private.request_push_dispatch() then raise exception 'Empty queue wakes';end if;
 -- A first reaction is immediate; edits/removal/re-add never generate a storm.
 update public.user_settings set share_history=true where user_id=a;
 perform public.set_action_reaction(act,'clap');
 if (select count(*) from public.notifications where user_id=a and kind='reaction_digest')<>1 then raise exception 'Reaction not immediate';end if;
 perform public.set_action_reaction(act,'strength');perform public.set_action_reaction(act,null);perform public.set_action_reaction(act,'clap');
 if (select count(*) from public.notifications where user_id=a and kind='reaction_digest')>1 then raise exception 'Reaction retries duplicated';end if;
 -- Quiet hours retain the job without an HTTP request.
 p:=public.get_notification_preferences();
 perform public.set_notification_preferences(p||jsonb_build_object('quiet_enabled',true,'quiet_start',to_char(clock_timestamp() at time zone 'UTC'-interval '1 hour','HH24:MI'),'quiet_end',to_char(clock_timestamp() at time zone 'UTC'+interval '1 hour','HH24:MI'),'timezone','UTC'));
 insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key) values(b,'Test','friend_action',a,'amis','quiet:'||gen_random_uuid());
 if (select count(*) from private.test_push_requests)<>1 then raise exception 'Quiet hours woke worker';end if;
 perform public.set_notification_preferences(p);
 if not private.request_push_dispatch() then raise exception 'Ready queue not continued';end if;
 perform set_config('viegame.push_requested','',true);
 update vault.decrypted_secrets set decrypted_secret='https://evil.example' where name='viegame_push_dispatch_url';
 if private.request_push_dispatch() then raise exception 'Unsafe destination accepted';end if;
 insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key) values(b,'Test','friend_action',a,'amis','bad-config:'||gen_random_uuid());
 if (select count(*) from private.test_push_requests)<>2 then raise exception 'Invalid config sent';end if;
 update vault.decrypted_secrets set decrypted_secret='https://viegame.vercel.app/api/push/dispatch' where name='viegame_push_dispatch_url';
 perform set_config('viegame.test_net_failure','1',true);
 insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key) values(b,'Test','friend_action',a,'amis','net-failure:'||b);
 if not exists(select 1 from private.push_outbox q join public.notifications n on n.id=q.notification_id where n.event_key='net-failure:'||b and q.status='pending') then raise exception 'Enqueue failure lost durable job';end if;
 raise notice 'Instant notifications: OK, fake HTTP only';
end $test$;
rollback;
