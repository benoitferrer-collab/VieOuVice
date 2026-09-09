-- Additive migration after 004. Apply once as owner; no network or secrets.
begin;
alter table public.user_settings add column notify_reactions boolean not null default true;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in('system','friend_action','friend_accepted','duel_started','duel_lead','duel_finished','reaction_digest'));
alter table public.notifications drop constraint social_notification_shape;
alter table public.notifications add constraint social_notification_shape check(
 kind='system' or
 (kind='reaction_digest' and actor_id is null and target_tab is not null and target_tab='survie' and event_key is not null) or
 (kind not in('system','reaction_digest') and actor_id is not null and actor_id<>user_id and target_tab is not null and event_key is not null));

-- Null reactions remain as tombstones. first_reacted_at and processed_at never
-- reset when an emoji is replaced, removed or re-added.
create table private.action_reactions(
 action_id uuid not null references public.actions(id) on delete cascade,
 actor_id uuid not null references public.users(id) on delete cascade,
 reaction text check(reaction in('clap','strength','laugh')),
 first_reacted_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 processed_at timestamptz,
 primary key(action_id,actor_id)
);
create index reaction_pending on private.action_reactions(first_reacted_at) where processed_at is null;
create table private.reaction_mutations(
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.users(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp()
);
create index reaction_mutation_quota on private.reaction_mutations(actor_id,created_at);
-- Deferred notification FK allows the AFTER INSERT push trigger to evaluate
-- members immediately, before it queues the existing generic WebPush payload.
create table private.reaction_digest_members(
 notification_id uuid not null references public.notifications(id) on delete cascade deferrable initially deferred,
 action_id uuid not null,
 actor_id uuid not null,
 primary key(notification_id,action_id,actor_id),
 foreign key(action_id,actor_id) references private.action_reactions(action_id,actor_id) on delete cascade
);
alter table private.action_reactions enable row level security;
alter table private.reaction_mutations enable row level security;
alter table private.reaction_digest_members enable row level security;
revoke all on private.action_reactions,private.reaction_mutations,private.reaction_digest_members from public,anon,authenticated,service_role;
revoke all on sequence private.reaction_mutations_id_seq from public,anon,authenticated,service_role;

create function private.reaction_allowed(p_actor uuid,p_action uuid,p_now timestamptz) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.actions a join public.user_settings s on s.user_id=a.user_id
 where a.id=p_action and p_actor<>a.user_id and s.share_history
 and a.created_at>=p_now-interval '7 days' and a.created_at<=p_now
 and not private.is_blocked(p_actor,a.user_id)
 and not exists(select 1 from private.player_access p where p.user_id in(p_actor,a.user_id) and p.suspended)
 and exists(select 1 from public.friendships f where f.status='accepted'
 and least(f.requester,f.recipient)=least(p_actor,a.user_id) and greatest(f.requester,f.recipient)=greatest(p_actor,a.user_id)))
$$;
create function private.encouragement_value(p_actor uuid,p_action uuid,p_now timestamptz) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('action_id',p_action,'counts',jsonb_build_object(
 'clap',count(*) filter(where r.reaction='clap'),
 'strength',count(*) filter(where r.reaction='strength'),
 'laugh',count(*) filter(where r.reaction='laugh')),
 'mine',max(r.reaction) filter(where r.actor_id=p_actor),
 'can_react',private.reaction_allowed(p_actor,p_action,p_now))
 from private.action_reactions r where r.action_id=p_action and r.reaction is not null
 and private.reaction_allowed(r.actor_id,r.action_id,p_now)
$$;

-- Invalidated members are permanently removed: restoring consent or re-adding
-- an emoji cannot resurrect an already processed encouragement notification.
create function private.refresh_reaction_digests() returns void
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp();begin
 perform pg_advisory_xact_lock(738291);
 delete from private.reaction_digest_members m using public.notifications n
 where n.id=m.notification_id and n.kind='reaction_digest' and n.read_at is null
 and (not private.reaction_allowed(m.actor_id,m.action_id,v_now)
 or not exists(select 1 from private.action_reactions r where r.action_id=m.action_id and r.actor_id=m.actor_id and r.reaction is not null)
 or not exists(select 1 from public.user_settings s where s.user_id=n.user_id and s.notify_reactions and s.notify_friends));
 delete from public.notifications n where n.kind='reaction_digest' and n.read_at is null
 and not exists(select 1 from private.reaction_digest_members m where m.notification_id=n.id);
 update public.notifications n set message='Tu as reçu '||x.total||' encouragement(s) sur '||x.actions||' déclaration(s).'
 from(select notification_id,count(*) total,count(distinct action_id) actions from private.reaction_digest_members group by notification_id)x
 where n.id=x.notification_id and n.kind='reaction_digest' and n.read_at is null
 and n.message is distinct from 'Tu as reçu '||x.total||' encouragement(s) sur '||x.actions||' déclaration(s).';
end$$;

create function private.flush_reaction_digests(p_recipient uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz; v_hour timestamptz; recipient uuid; notice_id uuid; event text; total bigint; actions bigint;
begin
 perform pg_advisory_xact_lock(738291);
 v_now:=clock_timestamp();v_hour:=date_trunc('hour',v_now at time zone 'UTC') at time zone 'UTC';
 perform private.refresh_reaction_digests();
 -- Catch up only the last 24 hours; old pairs still become permanent tombstones.
 update private.action_reactions r set processed_at=v_now from public.actions a
 where a.id=r.action_id and r.processed_at is null and r.first_reacted_at<v_now-interval '24 hours'
 and (p_recipient is null or a.user_id=p_recipient);
 for recipient in select distinct a.user_id from private.action_reactions r join public.actions a on a.id=r.action_id
 where r.processed_at is null and r.first_reacted_at<v_hour and (p_recipient is null or a.user_id=p_recipient)
 loop
  event:='reaction_digest:'||recipient||':'||floor(extract(epoch from v_hour))::bigint;
  -- Already emitted this hour: leave later arrivals for the next hour.
  if exists(select 1 from private.social_notification_events where event_key=event) then continue;end if;
  notice_id:=gen_random_uuid();
  insert into private.reaction_digest_members(notification_id,action_id,actor_id)
  select notice_id,r.action_id,r.actor_id from private.action_reactions r join public.actions a on a.id=r.action_id
  join public.user_settings s on s.user_id=a.user_id and s.notify_reactions and s.notify_friends
  where a.user_id=recipient and r.processed_at is null and r.first_reacted_at<v_hour
  and r.first_reacted_at>=v_now-interval '24 hours' and r.reaction is not null
  and private.reaction_allowed(r.actor_id,r.action_id,v_now);
  select count(*),count(distinct action_id) into total,actions from private.reaction_digest_members where notification_id=notice_id;
  update private.action_reactions r set processed_at=v_now from public.actions a
  where a.id=r.action_id and a.user_id=recipient and r.processed_at is null and r.first_reacted_at<v_hour;
  if total>0 then
   insert into public.notifications(id,user_id,message,kind,actor_id,target_tab,event_key)
   values(notice_id,recipient,'Tu as reçu '||total||' encouragement(s) sur '||actions||' déclaration(s).','reaction_digest',null,'survie',event);
  end if;
 end loop;
 -- Rate accounting only requires today's and the rolling minute's events.
 delete from private.reaction_mutations where created_at<least(private.day_start(v_now),v_now-interval '1 minute');
end$$;

alter function private.push_notification_eligible(uuid) rename to push_notification_eligible_before_reactions;
create function private.push_notification_eligible(p_notification uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when n.kind='reaction_digest' then
 n.actor_id is null and n.read_at is null and n.created_at>now()-interval '24 hours'
 and s.notify_reactions and s.notify_friends
 and exists(select 1 from private.reaction_digest_members m join private.action_reactions r using(action_id,actor_id)
 where m.notification_id=n.id and r.reaction is not null and private.reaction_allowed(m.actor_id,m.action_id,now()))
 else private.push_notification_eligible_before_reactions(n.id) end
 from public.notifications n join public.user_settings s on s.user_id=n.user_id where n.id=p_notification),false)
$$;
create or replace function private.enqueue_notification_push() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.kind in('friend_action','friend_accepted','duel_started','duel_lead','duel_finished','reaction_digest') and private.push_notification_eligible(new.id) then
 insert into private.push_outbox(notification_id,subscription_id) select new.id,s.id from private.push_subscriptions s where s.user_id=new.user_id on conflict do nothing;
 end if;return new;
end$$;

create function private.cleanup_reaction_visibility() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform private.refresh_reaction_digests();return null;
end$$;
create trigger reactions_settings_cleanup after update of share_history,notify_reactions,notify_friends on public.user_settings for each statement execute function private.cleanup_reaction_visibility();
create trigger reactions_blocks_cleanup after insert or update or delete on public.blocks for each statement execute function private.cleanup_reaction_visibility();
create trigger reactions_friendship_cleanup after insert or update or delete on public.friendships for each statement execute function private.cleanup_reaction_visibility();
create trigger reactions_suspension_cleanup after insert or update or delete on private.player_access for each statement execute function private.cleanup_reaction_visibility();
create trigger reactions_state_cleanup after update of reaction or delete on private.action_reactions for each statement execute function private.cleanup_reaction_visibility();

create function private.get_encouragements(p_action_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();v_now timestamptz:=clock_timestamp();result jsonb;begin
 if p_action_ids is null or cardinality(p_action_ids)>50 then raise exception 'Maximum 50 déclarations.';end if;
 perform private.flush_reaction_digests(u);
 select coalesce(jsonb_agg(private.encouragement_value(u,a.id,v_now) order by a.id),'[]'::jsonb) into result
 from public.actions a where a.id=any(p_action_ids)
 and ((a.user_id=u and a.created_at>=v_now-interval '7 days' and a.created_at<=v_now) or private.reaction_allowed(u,a.id,v_now));
 return result;
end$$;
create function private.set_action_reaction(p_action_id uuid,p_reaction text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();v_now timestamptz:=clock_timestamp();previous text;begin
 perform pg_advisory_xact_lock(738291);
 if p_reaction is not null and p_reaction not in('clap','strength','laugh') then raise exception 'Encouragement invalide.';end if;
 if not private.reaction_allowed(u,p_action_id,v_now) then raise exception 'Déclaration indisponible pour les encouragements.';end if;
 select reaction into previous from private.action_reactions where actor_id=u and action_id=p_action_id;
 if previous is not distinct from p_reaction then return private.encouragement_value(u,p_action_id,v_now);end if;
 if (select count(*) from private.reaction_mutations where actor_id=u and created_at>=private.day_start(v_now))>=100 then raise exception 'Limite de 100 encouragements par jour atteinte.';end if;
 if (select count(*) from private.reaction_mutations where actor_id=u and created_at>v_now-interval '1 minute')>=20 then raise exception 'Trop d’encouragements. Patiente une minute.';end if;
 insert into private.reaction_mutations(actor_id,created_at) values(u,v_now);
 insert into private.action_reactions(action_id,actor_id,reaction,first_reacted_at,updated_at) values(p_action_id,u,p_reaction,v_now,v_now)
 on conflict(action_id,actor_id) do update set reaction=excluded.reaction,updated_at=excluded.updated_at;
 return private.encouragement_value(u,p_action_id,v_now);
end$$;
create function private.set_reaction_preferences(p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 if p_enabled is null then raise exception 'Consentement requis.';end if;
 update public.user_settings set notify_reactions=p_enabled where user_id=u;
 if not found then raise exception 'Profil requis.';end if;
 perform private.flush_reaction_digests(u);
end$$;
create function public.get_encouragements(p_action_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.get_encouragements(p_action_ids)$$;
create function public.set_action_reaction(p_action_id uuid,p_reaction text) returns jsonb language sql security invoker set search_path='' as $$select private.set_action_reaction(p_action_id,p_reaction)$$;
create function public.set_reaction_preferences(p_enabled boolean) returns void language sql security invoker set search_path='' as $$select private.set_reaction_preferences(p_enabled)$$;

alter function private.export_my_data() rename to export_my_data_before_reactions;
create function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 return private.export_my_data_before_reactions()||jsonb_build_object(
 'notify_reactions',(select notify_reactions from public.user_settings where user_id=u),
 'reactions',coalesce((select jsonb_agg(to_jsonb(r) order by r.first_reacted_at,r.action_id) from private.action_reactions r where r.actor_id=u),'[]'::jsonb));
end$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and p.proname=any(array['reaction_allowed','encouragement_value','refresh_reaction_digests','flush_reaction_digests','push_notification_eligible','push_notification_eligible_before_reactions','enqueue_notification_push','cleanup_reaction_visibility','get_encouragements','set_action_reaction','set_reaction_preferences','export_my_data','export_my_data_before_reactions']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('get_encouragements','set_action_reaction','set_reaction_preferences','export_my_data') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end$$;
commit;
