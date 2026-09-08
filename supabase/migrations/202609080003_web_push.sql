-- Apply after 202609080002_community_notifications.sql. No secrets in SQL.
begin;
create or replace function private.valid_push_endpoint(p_endpoint text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(length(p_endpoint)<=2048 and p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com)/[^[:space:]#\\]+$',false)
$$;
create table if not exists private.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 endpoint text not null unique check(private.valid_push_endpoint(endpoint)),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'),
 auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}$'),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index if not exists push_subscriptions_user on private.push_subscriptions(user_id);
create table if not exists private.push_outbox (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references private.push_subscriptions(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','leased','sent','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 available_at timestamptz not null default clock_timestamp(),
 lease_until timestamptz,
 lease_token uuid,
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 unique(notification_id,subscription_id)
);
create index if not exists push_outbox_ready on private.push_outbox(available_at) where status in ('pending','leased');
alter table private.push_subscriptions enable row level security;
alter table private.push_outbox enable row level security;
revoke all on private.push_subscriptions, private.push_outbox from public,anon,authenticated,service_role;

create or replace function private.register_push_subscription(p_endpoint text,p_p256dh text,p_auth text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user(); owner_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('push-user:'||u::text,0));
 if not private.valid_push_endpoint(p_endpoint) or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'Abonnement navigateur invalide.'; end if;
 -- Serialize endpoint registration too: another account can never steal it.
 perform pg_advisory_xact_lock(hashtextextended('push-endpoint:'||p_endpoint,0));
 select user_id into owner_id from private.push_subscriptions where endpoint=p_endpoint;
 if owner_id is not null and owner_id<>u then raise exception 'Réinitialisez les notifications de ce navigateur avant de les activer.'; end if;
 if owner_id is null and (select count(*) from private.push_subscriptions where user_id=u)>=10 then raise exception 'Limite de dix navigateurs atteinte.'; end if;
 insert into private.push_subscriptions(user_id,endpoint,p256dh,auth) values(u,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,updated_at=clock_timestamp() where private.push_subscriptions.user_id=u;
end$$;
create or replace function private.unregister_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path='' as $$
begin delete from private.push_subscriptions where user_id=private.assert_user() and endpoint=p_endpoint;end$$;
create or replace function private.get_push_subscription_status(p_endpoint text) returns boolean
language plpgsql security definer set search_path='' as $$
begin return exists(select 1 from private.push_subscriptions where user_id=private.assert_user() and endpoint=p_endpoint);end$$;
create or replace function public.register_push_subscription(p_endpoint text,p_p256dh text,p_auth text) returns void language sql security invoker set search_path='' as $$select private.register_push_subscription(p_endpoint,p_p256dh,p_auth)$$;
create or replace function public.unregister_push_subscription(p_endpoint text) returns void language sql security invoker set search_path='' as $$select private.unregister_push_subscription(p_endpoint)$$;
create or replace function public.get_push_subscription_status(p_endpoint text) returns boolean language sql security invoker set search_path='' as $$select private.get_push_subscription_status(p_endpoint)$$;

-- Live eligibility is used at enqueue, lease and again just before network I/O.
create or replace function private.push_notification_eligible(p_notification uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select n.actor_id is not null and n.actor_id<>n.user_id
 and n.read_at is null
 and n.created_at > now()-interval '24 hours'
 and not private.is_blocked(n.user_id,n.actor_id)
 and case
 when n.kind in ('friend_action','friend_accepted') then r.notify_friends
   and (n.kind<>'friend_action' or a.share_activity)
   and exists(select 1 from public.friendships f where f.status='accepted' and least(f.requester,f.recipient)=least(n.user_id,n.actor_id) and greatest(f.requester,f.recipient)=greatest(n.user_id,n.actor_id))
 when n.kind in ('duel_started','duel_lead','duel_finished') then r.notify_duels and r.pvp and a.pvp
   and exists(select 1 from public.nemesis_pairs d join public.seasons s on s.id=d.season_id
    where d.season_id::text=split_part(n.event_key,':',2)
    and d.user_a=least(n.user_id,n.actor_id) and d.user_b=greatest(n.user_id,n.actor_id)
    and ((n.kind='duel_finished' and s.closed_at is not null and s.ends_at>now()-interval '24 hours') or (n.kind<>'duel_finished' and s.closed_at is null and s.ends_at>now())))
 else false end
 from public.notifications n join public.user_settings r on r.user_id=n.user_id join public.user_settings a on a.user_id=n.actor_id where n.id=p_notification),false)
$$;
create or replace function private.enqueue_notification_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind in ('friend_action','friend_accepted','duel_started','duel_lead','duel_finished') and private.push_notification_eligible(new.id) then
  insert into private.push_outbox(notification_id,subscription_id) select new.id,s.id from private.push_subscriptions s where s.user_id=new.user_id on conflict do nothing;
 end if;
 return new;
end$$;
drop trigger if exists queue_social_push on public.notifications;
create trigger queue_social_push after insert on public.notifications for each row execute function private.enqueue_notification_push();

create or replace function private.claim_push_job() returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.push_outbox;
begin
 -- Limited retention, no message or endpoint recorded in diagnostics.
 delete from private.push_outbox where created_at<now()-interval '7 days';
 update private.push_outbox set status='failed',completed_at=clock_timestamp(),lease_until=null,lease_token=null where status in ('pending','leased') and (created_at<now()-interval '24 hours' or (attempts>=5 and (lease_until is null or lease_until<now())));
 select * into job from private.push_outbox where attempts<5 and available_at<=now() and (status='pending' or (status='leased' and lease_until<now())) order by available_at for update skip locked limit 1;
 if not found then return null; end if;
 update private.push_outbox set status='leased',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',lease_token=gen_random_uuid() where id=job.id returning * into job;
 return jsonb_build_object('id',job.id,'lease_token',job.lease_token,'attempts',job.attempts);
end$$;
create or replace function private.authorize_push_job(p_job_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.push_outbox; result jsonb;
begin
 select * into job from private.push_outbox where id=p_job_id and lease_token=p_lease_token and status='leased' and lease_until>clock_timestamp() for update;
 if not found then return null; end if;
 if not private.push_notification_eligible(job.notification_id) then
  update private.push_outbox set status='cancelled',completed_at=clock_timestamp(),lease_until=null,lease_token=null where id=job.id;
  return null;
 end if;
 select jsonb_build_object('endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'target_tab',n.target_tab) into result
 from private.push_subscriptions s join public.notifications n on n.id=job.notification_id where s.id=job.subscription_id and s.user_id=n.user_id;
 return result;
end$$;
create or replace function private.finish_push_job(p_job_id uuid,p_lease_token uuid,p_result text) returns void
language plpgsql security definer set search_path='' as $$
declare job private.push_outbox;
begin
 if p_result is null or p_result not in ('sent','expired','retry','failed','cancelled') then raise exception 'Invalid push result'; end if;
 select * into job from private.push_outbox where id=p_job_id and lease_token=p_lease_token and status='leased' and lease_until>clock_timestamp() for update;
 if not found then return; end if;
 if p_result='expired' then delete from private.push_subscriptions where id=job.subscription_id;return;end if;
 update private.push_outbox set
  status=case when p_result='retry' and job.attempts<5 then 'pending' when p_result='retry' then 'failed' else p_result end,
  available_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,job.attempts)::integer)),
  completed_at=case when p_result='retry' and job.attempts<5 then null else clock_timestamp() end,
  lease_token=null,lease_until=null where id=job.id;
end$$;
create or replace function public.claim_push_job() returns jsonb language sql security invoker set search_path='' as $$select private.claim_push_job()$$;
create or replace function public.authorize_push_job(p_job_id uuid,p_lease_token uuid) returns jsonb language sql security invoker set search_path='' as $$select private.authorize_push_job(p_job_id,p_lease_token)$$;
create or replace function public.finish_push_job(p_job_id uuid,p_lease_token uuid,p_result text) returns void language sql security invoker set search_path='' as $$select private.finish_push_job(p_job_id,p_lease_token,p_result)$$;

-- Preserve the existing export while adding only this user's subscription status.
-- The name guard makes this additive wrapper safe if this migration is reapplied.
do $$begin
 if to_regprocedure('private.export_my_data_without_push()') is null then alter function private.export_my_data() rename to export_my_data_without_push;end if;
end$$;
create or replace function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 return private.export_my_data_without_push() || jsonb_build_object('push_subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'updated_at',updated_at)) from private.push_subscriptions where user_id=u),'[]'::jsonb));
end$$;
-- Refresh the public wrapper after renaming its former dependency.
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
revoke all on function private.export_my_data_without_push() from public,anon,authenticated,service_role;
revoke all on function private.export_my_data(),public.export_my_data() from public,anon;
grant execute on function private.export_my_data(),public.export_my_data() to authenticated;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname in ('valid_push_endpoint','register_push_subscription','unregister_push_subscription','get_push_subscription_status','push_notification_eligible','enqueue_notification_push','claim_push_job','authorize_push_job','finish_push_job') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('register_push_subscription','unregister_push_subscription','get_push_subscription_status') then execute format('grant execute on function %s to authenticated',f.signature);end if;
  if f.proname in ('claim_push_job','authorize_push_job','finish_push_job') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end$$;
grant usage on schema private to service_role;
commit;
