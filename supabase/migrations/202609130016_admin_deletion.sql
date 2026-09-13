-- Apply once after 001–015, as database owner. No account is deleted by installation.
begin;
select pg_advisory_xact_lock(738291);
create table private.account_delete_tickets(
 target_id uuid primary key references public.users(id) on delete cascade,
 actor_id uuid not null references public.users(id) on delete cascade,
 confirmed_nickname text not null,expires_at timestamptz not null
);
create table private.account_purge_context(transaction_id xid8 primary key,target_id uuid not null);
alter table private.account_delete_tickets enable row level security;
alter table private.account_purge_context enable row level security;
revoke all on private.account_delete_tickets,private.account_purge_context from public,anon,authenticated,service_role;

alter function private.assert_user() rename to assert_user_before_deletion;
create function private.assert_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 perform pg_advisory_xact_lock(738291);
 u:=auth.uid();
 if u is null or not exists(select 1 from auth.users where id=u) then raise exception 'Authentification requise.';end if;
 return private.assert_user_before_deletion();
end$$;
revoke all on function private.assert_user(),private.assert_user_before_deletion() from public,anon,authenticated,service_role;

create function private.account_purge_allowed(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select pg_trigger_depth()>0 and exists(select 1 from private.account_purge_context where transaction_id=pg_current_xact_id() and target_id=p_user)
$$;
create or replace function private.reject_edit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='DELETE' and private.account_purge_allowed(old.user_id) then return old;end if;
 raise exception 'Journal immuable : utilisez un événement inverse autorisé.';
end$$;
create or replace function private.reject_community_catalog_edit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' then
  if old.creator_id is not null and private.account_purge_allowed(old.creator_id)
   and new.creator_id is null and new.creator_name is null and new.created_at is null
   and (to_jsonb(new)-array['creator_id','creator_name','created_at'])=(to_jsonb(old)-array['creator_id','creator_name','created_at']) then return new;end if;
  if (to_jsonb(new)-'active')=(to_jsonb(old)-'active') and private.is_admin() then return new;end if;
 end if;
 raise exception 'Catalogue immuable : seule la modération de visibilité est autorisée.';
end$$;

create function public.prepare_admin_account_deletion(p_actor uuid,p_user_id uuid,p_confirmation text) returns void
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.player_access a join auth.users u on u.id=a.user_id where a.user_id=p_actor and a.is_admin and not a.suspended) then raise exception 'Administration requise.';end if;
 if p_actor=p_user_id then raise exception 'Impossible de supprimer son propre compte.';end if;
 if not exists(select 1 from public.users where id=p_user_id and nickname=p_confirmation) then raise exception 'Confirmation incorrecte ou compte indisponible.';end if;
 if exists(select 1 from private.player_access where user_id=p_user_id and is_admin and not suspended) and (select count(*) from private.player_access where is_admin and not suspended)<=1 then raise exception 'Le dernier administrateur doit être conservé.';end if;
 delete from private.account_delete_tickets where expires_at<=clock_timestamp();
 insert into private.account_delete_tickets values(p_user_id,p_actor,p_confirmation,clock_timestamp()+interval '5 minutes')
 on conflict(target_id) do update set actor_id=excluded.actor_id,confirmed_nickname=excluded.confirmed_nickname,expires_at=excluded.expires_at;
end$$;

create function private.delete_challenge_data(p_kind text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare member_id uuid;begin
 if p_kind='competition' then
  for member_id in select user_id from private.competition_members where event_id=p_id loop perform private.settle_progression(member_id);end loop;
  delete from private.social_notification_events where split_part(event_key,':',1) in('competition_started','competition_finished') and split_part(event_key,':',2)=p_id::text;
  delete from private.scheduled_notification_events where split_part(event_key,':',1) in('competition_started','competition_finished') and split_part(event_key,':',2)=p_id::text;
  delete from public.notifications where split_part(event_key,':',1) in('competition_started','competition_finished') and split_part(event_key,':',2)=p_id::text;
  delete from private.competition_badges where event_id=p_id;
  delete from private.competition_results where event_id=p_id;
  delete from private.competition_requests where event_id=p_id;
  delete from private.competition_members where event_id=p_id;
  delete from private.competitions where id=p_id;
 elsif p_kind='cooperative' then
  delete from private.cooperative_badges where challenge_id=p_id;
  delete from private.cooperative_requests where challenge_id=p_id;
  delete from private.cooperative_members where challenge_id=p_id;
  delete from private.cooperative_challenges where id=p_id;
 else raise exception 'Type de défi invalide.';end if;
end$$;
create function public.admin_delete_challenge(p_kind text,p_id uuid,p_confirmation text) returns void
language plpgsql security definer set search_path='' as $$declare actor uuid:=private.assert_admin();title text;begin
 if p_kind='competition' then select c.title into title from private.competitions c where id=p_id;
 elsif p_kind='cooperative' then select case template when 'sport' then 'Bouger ensemble' when 'walk' then 'Marcher ensemble' else 'Faire une pause ensemble' end into title from private.cooperative_challenges where id=p_id;
 else raise exception 'Type de défi invalide.';end if;
 if title is null or p_confirmation is distinct from title then raise exception 'Confirmation incorrecte ou défi indisponible.';end if;
 perform private.delete_challenge_data(p_kind,p_id);
 insert into private.admin_audit(actor_id,action,target_id,reason) values(actor,'delete_'||p_kind,p_id::text,'Suppression définitive confirmée');
end$$;
create function public.admin_list_cooperative_challenges(p_offset int default 0) returns jsonb
language plpgsql security definer set search_path='' as $$declare items jsonb;more boolean;begin
 perform private.assert_admin();
 if p_offset is null or p_offset<0 then raise exception 'Pagination invalide.';end if;
 select coalesce(jsonb_agg(to_jsonb(q)-'created_at' order by created_at desc,id),'[]') into items from (
  select c.id,case template when 'sport' then 'Bouger ensemble' when 'walk' then 'Marcher ensemble' else 'Faire une pause ensemble' end title,u.nickname creator_name,c.status,c.ends_at,c.participant_count,c.created_at
  from private.cooperative_challenges c join public.users u on u.id=c.creator_id order by c.created_at desc,c.id limit 50 offset p_offset)q;
 select exists(select 1 from private.cooperative_challenges offset p_offset+50) into more;
 return jsonb_build_object('challenges',items,'next_offset',case when more then p_offset+50 else null end);
end$$;

create function private.cleanup_deleted_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare ticket private.account_delete_tickets;cid uuid;v_target uuid:=old.id;begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from public.users where id=v_target) then return old;end if;
 select * into ticket from private.account_delete_tickets where target_id=v_target for update;
 if not found or ticket.expires_at<=clock_timestamp() or not exists(select 1 from public.users where id=v_target and nickname=ticket.confirmed_nickname) then raise exception 'Suppression administrative confirmée requise.';end if;
 if ticket.actor_id=v_target or not exists(select 1 from private.player_access a join auth.users u on u.id=a.user_id where a.user_id=ticket.actor_id and a.is_admin and not a.suspended) then raise exception 'Administration requise.';end if;
 if exists(select 1 from private.player_access where user_id=v_target and is_admin and not suspended) and (select count(*) from private.player_access where is_admin and not suspended)<=1 then raise exception 'Le dernier administrateur doit être conservé.';end if;
 insert into private.account_purge_context values(pg_current_xact_id(),v_target);
 for cid in select id from private.cooperative_challenges where creator_id=v_target loop perform private.delete_challenge_data('cooperative',cid);end loop;
 -- Request payloads retain invited UUIDs even after an invitation is declined.
 delete from private.cooperative_requests where creator_id=v_target or payload->'friends' @> jsonb_build_array(v_target::text);
 delete from private.cooperative_badges where user_id=v_target;
 delete from private.cooperative_members where user_id=v_target;
 delete from private.social_notification_events where v_target::text=any(string_to_array(event_key,':')) or event_key in(select event_key from public.notifications where user_id=v_target or actor_id=v_target);
 delete from public.notifications where user_id=v_target or actor_id=v_target;
 delete from private.friend_messages where sender_id=v_target or recipient_id=v_target;
 delete from private.catalog_creation_requests where user_id=v_target;
 update public.action_catalog set creator_id=null,creator_name=null,created_at=null where creator_id=v_target;
 delete from private.competition_badges where user_id=v_target;
 delete from private.competition_results where user_id=v_target;
 delete from private.competition_requests where actor_id=v_target;
 delete from private.competition_members where user_id=v_target;
 delete from private.xp_awards where user_id=v_target;
 delete from private.progression_badges where user_id=v_target;
 delete from private.weekly_mission_choices where user_id=v_target;
 delete from private.equipped_cosmetics where user_id=v_target;
 delete from private.life_ledger where user_id=v_target;
 delete from public.actions where user_id=v_target;
 delete from public.trophies where user_id=v_target;
 delete from public.life_transfers where donor=v_target or recipient=v_target;
 delete from public.nemesis_pairs where user_a=v_target or user_b=v_target;
 delete from public.friendships where requester=v_target or recipient=v_target;
 delete from public.blocks where blocker=v_target or blocked=v_target;
 delete from public.leaderboard_entries where user_id=v_target;
 delete from public.league_memberships where user_id=v_target;
 delete from private.daily_limits where user_id=v_target;
 delete from private.admin_audit where actor_id=v_target or target_id=v_target::text;
 delete from private.ai_challenge_batches where actor_id=v_target;
 delete from private.player_access where user_id=v_target;
 -- Remaining settings, reactions, push subscriptions/outbox and tickets cascade.
 delete from public.users where id=v_target;
 delete from private.account_purge_context where transaction_id=pg_current_xact_id();
 insert into private.admin_audit(actor_id,action,target_id,reason) values(ticket.actor_id,'delete_account',v_target::text,'Suppression définitive confirmée');
 return old;
end$$;
create trigger viegame_cleanup_before_auth_delete before delete on auth.users for each row execute function private.cleanup_deleted_auth_user();
revoke all on function private.account_purge_allowed(uuid),private.reject_edit(),private.reject_community_catalog_edit(),private.delete_challenge_data(text,uuid),private.cleanup_deleted_auth_user(),public.prepare_admin_account_deletion(uuid,uuid,text),public.admin_delete_challenge(text,uuid,text),public.admin_list_cooperative_challenges(int) from public,anon,authenticated,service_role;
grant execute on function public.prepare_admin_account_deletion(uuid,uuid,text) to service_role;
grant execute on function public.admin_delete_challenge(text,uuid,text),public.admin_list_cooperative_challenges(int) to authenticated;
commit;
