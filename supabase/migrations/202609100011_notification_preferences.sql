-- Apply after 010. No network calls, secrets, cron or environment changes.
begin;
create table private.notification_preferences(
 user_id uuid primary key references public.users(id) on delete cascade,
 competitions boolean not null default true, reminders boolean not null default false,
 quiet_enabled boolean not null default false, quiet_start time not null default '22:00', quiet_end time not null default '07:00', timezone text not null default 'Europe/Paris',
 check(not quiet_enabled or quiet_start<>quiet_end)
);
create table private.scheduled_notification_events(event_key text primary key,user_id uuid not null references public.users(id) on delete cascade,kind text not null,created_at timestamptz not null default clock_timestamp());
create index scheduled_reminder_recency on private.scheduled_notification_events(user_id,created_at) where kind='activity_reminder';
alter table private.notification_preferences enable row level security;
alter table private.scheduled_notification_events enable row level security;
revoke all on private.notification_preferences,private.scheduled_notification_events from public,anon,authenticated,service_role;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in('system','friend_action','friend_accepted','duel_started','duel_lead','duel_finished','reaction_digest','friend_message','competition_started','competition_finished','activity_reminder'));
alter table public.notifications drop constraint social_notification_shape;
alter table public.notifications add constraint social_notification_shape check(kind='system' or (kind='reaction_digest' and actor_id is null and target_tab is not null and target_tab='survie' and event_key is not null) or (kind in('competition_started','competition_finished','activity_reminder') and actor_id is null and target_tab is not null and event_key is not null) or (kind not in('system','reaction_digest','competition_started','competition_finished','activity_reminder') and actor_id is not null and actor_id<>user_id and target_tab is not null and event_key is not null));

create function private.get_notification_preferences() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user(); result jsonb;
begin
 select jsonb_build_object('messages',s.notify_messages,'friends',s.notify_friends,'duels',s.notify_duels,'reactions',s.notify_reactions,'competitions',coalesce(p.competitions,true),'reminders',coalesce(p.reminders,false),'quiet_enabled',coalesce(p.quiet_enabled,false),'quiet_start',coalesce(to_char(p.quiet_start,'HH24:MI'),'22:00'),'quiet_end',coalesce(to_char(p.quiet_end,'HH24:MI'),'07:00'),'timezone',coalesce(p.timezone,'Europe/Paris')) into result from public.user_settings s left join private.notification_preferences p on p.user_id=s.user_id where s.user_id=u;
 return result;
end$$;
create function private.set_notification_preferences(p_preferences jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();k text;
begin
 perform pg_advisory_xact_lock(738291);
 if p_preferences is null or jsonb_typeof(p_preferences)<>'object' then raise exception 'Préférences invalides.';end if;
 foreach k in array array['messages','friends','duels','reactions','competitions','reminders','quiet_enabled'] loop
 if jsonb_typeof(p_preferences->k) is distinct from 'boolean' then raise exception 'Préférences invalides.';end if;
 end loop;
 if coalesce(p_preferences->>'quiet_start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_preferences->>'quiet_end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or not exists(select 1 from pg_timezone_names where name=p_preferences->>'timezone') or ((p_preferences->>'quiet_enabled')::boolean and p_preferences->>'quiet_start'=p_preferences->>'quiet_end') then raise exception 'Horaires ou fuseau horaire invalides.';end if;
 update public.user_settings set notify_messages=(p_preferences->>'messages')::boolean,notify_friends=(p_preferences->>'friends')::boolean,notify_duels=(p_preferences->>'duels')::boolean,notify_reactions=(p_preferences->>'reactions')::boolean where user_id=u;
 insert into private.notification_preferences(user_id,competitions,reminders,quiet_enabled,quiet_start,quiet_end,timezone) values(u,(p_preferences->>'competitions')::boolean,(p_preferences->>'reminders')::boolean,(p_preferences->>'quiet_enabled')::boolean,(p_preferences->>'quiet_start')::time,(p_preferences->>'quiet_end')::time,p_preferences->>'timezone') on conflict(user_id) do update set competitions=excluded.competitions,reminders=excluded.reminders,quiet_enabled=excluded.quiet_enabled,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,timezone=excluded.timezone;
 -- Withdrawing a category also consumes its pending notices so re-enabling cannot replay them.
 update public.notifications set read_at=clock_timestamp() where user_id=u and read_at is null and (
 (kind='friend_message' and not (p_preferences->>'messages')::boolean) or
 (kind in('friend_action','friend_accepted','reaction_digest') and not (p_preferences->>'friends')::boolean) or
 (kind in('duel_started','duel_lead','duel_finished') and not (p_preferences->>'duels')::boolean) or
 (kind='reaction_digest' and not (p_preferences->>'reactions')::boolean) or
 (kind in('competition_started','competition_finished') and not (p_preferences->>'competitions')::boolean) or
 (kind='activity_reminder' and not (p_preferences->>'reminders')::boolean));
 return private.get_notification_preferences();
end$$;
create function private.notification_quiet_at(p_user uuid,p_at timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.quiet_enabled and case when p.quiet_start<p.quiet_end then (p_at at time zone p.timezone)::time>=p.quiet_start and (p_at at time zone p.timezone)::time<p.quiet_end else (p_at at time zone p.timezone)::time>=p.quiet_start or (p_at at time zone p.timezone)::time<p.quiet_end end from private.notification_preferences p where p.user_id=p_user),false)
$$;
create function private.has_active_reminder_activity(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.competition_members m join private.competitions e on e.id=m.event_id where m.user_id=p_user and e.status='published' and e.starts_at<=now() and e.ends_at>now()) or exists(select 1 from private.cooperative_members m join private.cooperative_challenges c on c.id=m.challenge_id where m.user_id=p_user and m.status='accepted' and c.status='active' and c.ends_at>now() and private.cooperative_member_allowed(c.id,p_user))
$$;
-- Keep all existing privacy/consent checks in the old eligibility chain.
alter function private.push_notification_eligible(uuid) rename to push_notification_eligible_before_preferences;
create function private.push_notification_eligible(p_notification uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when n.kind in('competition_started','competition_finished','activity_reminder') then n.read_at is null and n.created_at>now()-interval '24 hours' and not exists(select 1 from private.player_access a where a.user_id=n.user_id and a.suspended) and case when n.kind='activity_reminder' then coalesce(p.reminders,false) and private.has_active_reminder_activity(n.user_id) else coalesce(p.competitions,true) and exists(select 1 from private.competition_members m join private.competitions e on e.id=m.event_id where m.user_id=n.user_id and e.id::text=split_part(n.event_key,':',2) and ((n.kind='competition_started' and e.status='published' and e.starts_at<=now() and e.ends_at>now()) or (n.kind='competition_finished' and e.status='completed' and e.ends_at>now()-interval '24 hours'))) end else private.push_notification_eligible_before_preferences(n.id) end from public.notifications n left join private.notification_preferences p on p.user_id=n.user_id where n.id=p_notification),false)
$$;
create or replace function private.enqueue_notification_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if private.push_notification_eligible(new.id) then insert into private.push_outbox(notification_id,subscription_id) select new.id,s.id from private.push_subscriptions s where s.user_id=new.user_id on conflict do nothing;end if;
 return new;
end$$;
create or replace function private.claim_push_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.push_outbox;
begin
 delete from private.push_outbox where created_at<now()-interval '7 days';
 update private.push_outbox set status='failed',completed_at=clock_timestamp(),lease_until=null,lease_token=null where status in('pending','leased') and (created_at<now()-interval '24 hours' or (attempts>=5 and (lease_until is null or lease_until<now())));
 -- Quiet periods do not consume attempts or discard queued notifications. Checking
 -- wall time each tick handles DST gaps and repeated hours without UTC guessing.
 update private.push_outbox o set status='pending',available_at=clock_timestamp()+interval '5 minutes',lease_until=null,lease_token=null from public.notifications n where n.id=o.notification_id and o.available_at<=now() and (o.status='pending' or (o.status='leased' and o.lease_until<now())) and private.notification_quiet_at(n.user_id,clock_timestamp());
 select * into job from private.push_outbox where attempts<5 and available_at<=now() and (status='pending' or(status='leased' and lease_until<now())) order by available_at for update skip locked limit 1;
 if not found then return null;end if;
 update private.push_outbox set status='leased',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds',lease_token=gen_random_uuid() where id=job.id returning * into job;
 return jsonb_build_object('id',job.id,'lease_token',job.lease_token,'attempts',job.attempts);
end$$;
create or replace function private.authorize_push_job(p_job_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.push_outbox;result jsonb;u uuid;
begin
 select * into job from private.push_outbox where id=p_job_id and lease_token=p_lease_token and status='leased' and lease_until>clock_timestamp() for update;
 if not found then return null;end if;
 if not private.push_notification_eligible(job.notification_id) then update private.push_outbox set status='cancelled',completed_at=clock_timestamp(),lease_until=null,lease_token=null where id=job.id;return null;end if;
 select user_id into u from public.notifications where id=job.notification_id;
 if private.notification_quiet_at(u,clock_timestamp()) then
 update private.push_outbox set status='pending',available_at=clock_timestamp()+interval '5 minutes',attempts=greatest(0,attempts-1),lease_until=null,lease_token=null where id=job.id;return null;
 end if;
 select jsonb_build_object('endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'target_tab',n.target_tab) into result from private.push_subscriptions s join public.notifications n on n.id=job.notification_id where s.id=job.subscription_id and s.user_id=n.user_id;
 return result;
end$$;

create function private.pump_scheduled_notifications() returns void language plpgsql security definer set search_path='' as $$
declare r record;k text;inserted text;
begin
 perform pg_advisory_xact_lock(738291);
 perform private.close_due_competitions();
 perform private.refresh_cooperative_challenges();
 for r in select m.user_id,e.id,e.status from private.competition_members m join private.competitions e on e.id=m.event_id left join private.notification_preferences p on p.user_id=m.user_id where coalesce(p.competitions,true) and not exists(select 1 from private.player_access a where a.user_id=m.user_id and a.suspended) and ((e.status='published' and e.starts_at<=now() and e.starts_at>now()-interval '24 hours' and e.ends_at>now()) or (e.status='completed' and e.ends_at>now()-interval '24 hours')) and not exists(select 1 from private.scheduled_notification_events x where x.event_key=(case when e.status='completed' then 'competition_finished' else 'competition_started' end)||':'||e.id||':'||m.user_id) order by e.starts_at,m.user_id limit 1000 loop
 k:=(case when r.status='completed' then 'competition_finished' else 'competition_started' end)||':'||r.id||':'||r.user_id;
 insert into private.scheduled_notification_events(event_key,user_id,kind) values(k,r.user_id,split_part(k,':',1)) on conflict do nothing returning event_key into inserted;
 if inserted is not null then insert into public.notifications(user_id,message,kind,target_tab,event_key) values(r.user_id,case when r.status='completed' then 'Ta compétition est terminée. Les résultats sont disponibles.' else 'Ta compétition commence. Retrouve-la sur ton accueil.' end,split_part(k,':',1),'survie',k) on conflict do nothing;end if;
 end loop;
 for r in select p.user_id,p.timezone from private.notification_preferences p where p.reminders and not exists(select 1 from private.player_access a where a.user_id=p.user_id and a.suspended) and private.has_active_reminder_activity(p.user_id) and not exists(select 1 from private.scheduled_notification_events x where x.user_id=p.user_id and x.kind='activity_reminder' and (x.created_at>now()-interval '24 hours' or (x.created_at at time zone p.timezone)::date=(now() at time zone p.timezone)::date)) order by p.user_id limit 1000 loop
 k:='activity_reminder:'||r.user_id||':'||(now() at time zone r.timezone)::date;
 insert into private.scheduled_notification_events(event_key,user_id,kind) values(k,r.user_id,'activity_reminder') on conflict do nothing returning event_key into inserted;
 if inserted is not null then insert into public.notifications(user_id,message,kind,target_tab,event_key) values(r.user_id,'Ton groupe t’attend : consulte tes compétitions et défis de bonnes habitudes en cours.','activity_reminder','survie',k) on conflict do nothing;end if;
 end loop;
end$$;
-- Reading the game also catches up; only service role can invoke the global pump directly.
alter function private.get_game_state() rename to get_game_state_before_preferences;
create function private.get_game_state() returns jsonb language plpgsql security definer set search_path='' as $$begin perform private.assert_user();perform private.pump_scheduled_notifications();return private.get_game_state_before_preferences();end$$;
create or replace function public.get_game_state() returns jsonb language sql security invoker set search_path='' as $$select private.get_game_state()$$;
alter function private.export_my_data() rename to export_my_data_before_preferences;
create function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$begin return private.export_my_data_before_preferences()||jsonb_build_object('notification_preferences',private.get_notification_preferences());end$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
create function public.get_notification_preferences() returns jsonb language sql security invoker set search_path='' as $$select private.get_notification_preferences()$$;
create function public.set_notification_preferences(p_preferences jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.set_notification_preferences(p_preferences)$$;
create function public.pump_scheduled_notifications() returns void language sql security invoker set search_path='' as $$select private.pump_scheduled_notifications()$$;
-- Renames retain grants: explicitly close every internal helper and preserved body.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname=any(array['get_notification_preferences','set_notification_preferences','notification_quiet_at','has_active_reminder_activity','push_notification_eligible','push_notification_eligible_before_preferences','enqueue_notification_push','claim_push_job','authorize_push_job','pump_scheduled_notifications','get_game_state','get_game_state_before_preferences','export_my_data','export_my_data_before_preferences']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('get_notification_preferences','set_notification_preferences','get_game_state','export_my_data') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 if f.proname in('claim_push_job','authorize_push_job','pump_scheduled_notifications') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end$$;
commit;
