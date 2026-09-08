-- Additive upgrade after 001, 002, 003. Run manually as database owner.
begin;
alter table public.user_settings add column share_history boolean not null default false;
create table private.player_access(user_id uuid primary key references public.users, is_admin boolean not null default false, suspended boolean not null default false);
create table private.admin_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.users,action text not null,target_id text not null,reason text not null,created_at timestamptz not null default clock_timestamp());
create table private.competitions(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 3 and 80),description text not null check(length(description)<=1200),starts_at timestamptz not null,ends_at timestamptz not null,metric text not null check(metric in ('health_minutes','net_minutes','category_minutes')),catalog_id text references public.action_catalog,badge_label text not null check(length(badge_label) between 3 and 60),badge_icon text not null check(badge_icon in ('trophy','medal','leaf','flame')),status text not null default 'draft' check(status in ('draft','published','cancelled','completed')),check(isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at and ends_at-starts_at<=interval '90 days'),check((metric='category_minutes')=(catalog_id is not null)));
create table private.competition_members(event_id uuid not null references private.competitions,user_id uuid not null references public.users,joined_at timestamptz not null default clock_timestamp(),primary key(event_id,user_id));
create table private.competition_results(event_id uuid not null references private.competitions,user_id uuid not null references public.users,nickname text not null,avatar smallint not null,score bigint not null,rank bigint not null,action_count bigint not null,primary key(event_id,user_id));
create table private.competition_badges(event_id uuid not null references private.competitions,user_id uuid not null references public.users,event_title text not null,label text not null,icon text not null,kind text not null check(kind in ('winner','podium','participant')),rank bigint not null,awarded_at timestamptz not null default clock_timestamp(),primary key(event_id,user_id));
create table private.competition_requests(actor_id uuid not null references public.users,request_id uuid not null,payload jsonb not null,event_id uuid not null references private.competitions,primary key(actor_id,request_id));
create index competition_due on private.competitions(ends_at) where status='published';
create index actions_history_keyset on public.actions(user_id,created_at desc,id desc);
create or replace function private.assert_user() returns uuid language plpgsql security definer set search_path='' as $$declare u uuid:=auth.uid();begin
 perform pg_advisory_xact_lock(738291);
 if u is null then raise exception 'Authentification requise.';end if;
 -- No profile requirement: create_profile must remain usable by new accounts.
 if exists(select 1 from private.player_access where user_id=u and suspended) then raise exception 'Compte suspendu.';end if;return u;end$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.player_access where user_id=auth.uid() and is_admin and not suspended)$$;
create function private.assert_admin() returns uuid language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin if not private.is_admin() then raise exception 'Administration requise.';end if;return u;end$$;
-- The existing eligibility body is retained, and all its runtime callers resolve this wrapper.
alter function private.push_notification_eligible(uuid) rename to push_notification_eligible_before_suspension;
create function private.push_notification_eligible(p_notification uuid) returns boolean language sql stable security definer set search_path='' as $$select private.push_notification_eligible_before_suspension(p_notification) and not exists(select 1 from public.notifications n join private.player_access p on p.user_id in(n.user_id,n.actor_id) where n.id=p_notification and p.suspended)$$;
create function private.competition_standings(p_event_id uuid) returns table(user_id uuid,nickname text,avatar smallint,score bigint,rank bigint,action_count bigint) language sql stable security definer set search_path='' as $$
 select r.user_id,r.nickname,r.avatar,r.score,r.rank,r.action_count from private.competition_results r join private.competitions e on e.id=r.event_id where e.id=p_event_id and e.status='completed'
 union all
 select x.user_id,x.nickname,x.avatar,x.score,rank() over(order by x.score desc),x.action_count from (
 select m.user_id,u.nickname,u.avatar,coalesce(sum(a.minutes_impact),0)::bigint score,count(a.id) action_count
 from private.competitions e join private.competition_members m on m.event_id=e.id join public.users u on u.id=m.user_id
 left join public.actions a on a.user_id=m.user_id and a.created_at>=e.starts_at and a.created_at<e.ends_at and a.created_at>=m.joined_at
 and (e.metric='net_minutes' or (a.kind='health' and a.minutes_impact>0 and (e.metric='health_minutes' or a.catalog_id=e.catalog_id)))
 where e.id=p_event_id and e.status<>'completed' group by m.user_id,u.nickname,u.avatar)x
$$;
create function private.close_due_competitions() returns void language plpgsql security definer set search_path='' as $$declare e record;begin
 perform pg_advisory_xact_lock(738291);
 for e in select id from private.competitions where status='published' and ends_at<=clock_timestamp() for update loop
 insert into private.competition_results select e.id,s.* from private.competition_standings(e.id) s;
 insert into private.competition_badges(event_id,user_id,event_title,label,icon,kind,rank)
 select c.id,r.user_id,c.title,c.badge_label,c.badge_icon,case when r.rank=1 then 'winner' when r.rank<=3 then 'podium' else 'participant' end,r.rank from private.competition_results r join private.competitions c on c.id=r.event_id where c.id=e.id and r.action_count>0;
 update private.competitions set status='completed' where id=e.id;
 end loop;end$$;
create function private.competition_summary(p_event_id uuid,p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(e)||jsonb_build_object('joined',exists(select 1 from private.competition_members m where m.event_id=e.id and m.user_id=p_user),'participant_count',(select count(*) from private.competition_members m where m.event_id=e.id),'my_score',(select score from private.competition_standings(e.id) where user_id=p_user),'my_rank',(select rank from private.competition_standings(e.id) where user_id=p_user)) from private.competitions e where e.id=p_event_id$$;
create function private.get_social_hub() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform private.close_due_competitions();return jsonb_build_object('available',true,'is_admin',private.is_admin(),'share_history',coalesce((select share_history from public.user_settings where user_id=u),false),'events',coalesce((select jsonb_agg(private.competition_summary(e.id,u) order by e.starts_at) from (select id,starts_at from private.competitions where status='published' or (status='completed' and ends_at>clock_timestamp()-interval '30 days') order by starts_at desc limit 100)e),'[]'::jsonb),'badges',coalesce((select jsonb_agg(to_jsonb(b)-'user_id' order by awarded_at desc) from private.competition_badges b where user_id=u),'[]'::jsonb));end$$;
create function private.update_history_sharing(p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin if p_enabled is null then raise exception 'Consentement requis.';end if;update public.user_settings set share_history=p_enabled where user_id=u;end$$;
create function private.get_friend_activity(p_friend_id uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit int default 50) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();f jsonb;sharing boolean;items jsonb;cursor_value jsonb;begin
 if p_limit is null or p_limit not between 1 and 50 or (p_before is null)<>(p_before_id is null) then raise exception 'Pagination invalide.';end if;
 if private.is_blocked(u,p_friend_id) or not exists(select 1 from public.friendships where status='accepted' and least(requester,recipient)=least(u,p_friend_id) and greatest(requester,recipient)=greatest(u,p_friend_id)) then raise exception 'Amitié acceptée requise.';end if;
 select jsonb_build_object('id',id,'nickname',nickname,'avatar',avatar) into f from public.users where id=p_friend_id;
 select share_history into sharing from public.user_settings where user_id=p_friend_id;
 if not coalesce(sharing,false) then return jsonb_build_object('friend',f,'shared',false,'actions','[]'::jsonb,'next_cursor',null);end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id desc),'[]'::jsonb) into items from (select id,label,kind,quantity,minutes_impact,created_at from public.actions where user_id=p_friend_id and created_at>=clock_timestamp()-interval '7 days' and (p_before is null or (created_at,id)<(p_before,p_before_id)) order by created_at desc,id desc limit p_limit+1)x;
 if jsonb_array_length(items)>p_limit then items:=items-p_limit;cursor_value:=jsonb_build_object('created_at',items->(p_limit-1)->'created_at','id',items->(p_limit-1)->'id');end if;
 return jsonb_build_object('friend',f,'shared',true,'actions',items,'next_cursor',cursor_value);end$$;
create function private.get_competition(p_event_id uuid,p_offset int default 0) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();items jsonb;total bigint;begin
 if p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Pagination invalide.';end if;perform private.close_due_competitions();
 if not exists(select 1 from private.competitions where id=p_event_id and (status<>'draft' or private.is_admin())) then raise exception 'Événement indisponible.';end if;
 select count(*) into total from private.competition_members where event_id=p_event_id;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.rank,s.user_id),'[]'::jsonb) into items from (select * from private.competition_standings(p_event_id) order by rank,user_id limit 50 offset p_offset)s;
 return private.competition_summary(p_event_id,u)||jsonb_build_object('leaderboard',items,'next_offset',case when p_offset+50<total then p_offset+50 else null end);end$$;
create function private.join_competition(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.competitions where id=p_event_id and status='published' and starts_at>clock_timestamp()) then raise exception 'Les inscriptions sont fermées.';end if;
 insert into private.competition_members(event_id,user_id) values(p_event_id,u) on conflict do nothing;end$$;
create function private.leave_competition(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.competitions where id=p_event_id and status='published' and starts_at>clock_timestamp()) then raise exception 'Les inscriptions sont fermées.';end if;delete from private.competition_members where event_id=p_event_id and user_id=u;end$$;
create function private.admin_save_competition(p_event jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_admin();r private.competition_requests;e private.competitions;field_name text;begin
 perform pg_advisory_xact_lock(738291);if p_request_id is null or p_event is null or jsonb_typeof(p_event)<>'object' then raise exception 'Requête invalide.';end if;
 -- Match the strict CompetitionDraft object; JSON numbers/booleans are not strings.
 if not (p_event ?& array['id','title','description','starts_at','ends_at','metric','catalog_id','badge_label','badge_icon'])
 or (p_event-array['id','title','description','starts_at','ends_at','metric','catalog_id','badge_label','badge_icon'])<>'{}'::jsonb then raise exception 'Champs de brouillon invalides.';end if;
 foreach field_name in array array['title','description','starts_at','ends_at','metric','badge_label','badge_icon'] loop
  if jsonb_typeof(p_event->field_name)<>'string' then raise exception 'Type de champ invalide : %',field_name;end if;
 end loop;
 foreach field_name in array array['id','catalog_id'] loop
  if jsonb_typeof(p_event->field_name) not in ('string','null') then raise exception 'Type de champ invalide : %',field_name;end if;
 end loop;
 if p_event->>'catalog_id' is not null and length(p_event->>'catalog_id') not between 1 and 80 then raise exception 'Identifiant de catégorie invalide.';end if;
 foreach field_name in array array['title','description','badge_label'] loop
  if (p_event->>field_name) ~ ('['||chr(1)||'-'||chr(8)||chr(11)||chr(12)||chr(14)||'-'||chr(31)||chr(127)||']') then raise exception 'Caractère non autorisé.';end if;
 end loop;
 foreach field_name in array array['starts_at','ends_at'] loop
  if (p_event->>field_name) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Date ISO avec fuseau requise.';end if;
 end loop;
 select * into r from private.competition_requests where actor_id=u and request_id=p_request_id;
 if found then if r.payload<>p_event then raise exception 'Clé réutilisée avec un contenu différent.';end if;return private.competition_summary(r.event_id,u);end if;
 e.id:=coalesce((p_event->>'id')::uuid,gen_random_uuid());e.title:=regexp_replace(p_event->>'title','^[[:space:]]+|[[:space:]]+$','','g');e.description:=regexp_replace(p_event->>'description','^[[:space:]]+|[[:space:]]+$','','g');e.starts_at:=(p_event->>'starts_at')::timestamptz;e.ends_at:=(p_event->>'ends_at')::timestamptz;e.metric:=p_event->>'metric';e.catalog_id:=p_event->>'catalog_id';e.badge_label:=regexp_replace(p_event->>'badge_label','^[[:space:]]+|[[:space:]]+$','','g');e.badge_icon:=p_event->>'badge_icon';
 if e.starts_at is null or e.starts_at<=clock_timestamp() then raise exception 'Le début doit être futur.';end if;
 if e.metric='category_minutes' and not exists(select 1 from public.action_catalog where id=e.catalog_id and kind='health' and active) then raise exception 'Catégorie saine active requise.';end if;
 if p_event->>'id' is not null then
 if not exists(select 1 from private.competitions where id=e.id and status='draft') then raise exception 'Seul un brouillon peut être modifié.';end if;
 update private.competitions set title=e.title,description=e.description,starts_at=e.starts_at,ends_at=e.ends_at,metric=e.metric,catalog_id=e.catalog_id,badge_label=e.badge_label,badge_icon=e.badge_icon where id=e.id;
 else insert into private.competitions(id,title,description,starts_at,ends_at,metric,catalog_id,badge_label,badge_icon) values(e.id,e.title,e.description,e.starts_at,e.ends_at,e.metric,e.catalog_id,e.badge_label,e.badge_icon);end if;
 insert into private.competition_requests values(u,p_request_id,p_event,e.id);
 insert into private.admin_audit(actor_id,action,target_id,reason) values(u,'save_competition',e.id::text,'Brouillon enregistré');return private.competition_summary(e.id,u);end$$;
create function private.admin_set_competition_status(p_event_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_admin();e private.competitions;begin
 perform pg_advisory_xact_lock(738291);perform private.close_due_competitions();select * into e from private.competitions where id=p_event_id;
 if e.id is null or p_status is null or p_status not in ('published','cancelled') then raise exception 'Transition invalide.';end if;if e.status=p_status then return;end if;
 if (p_status='published' and (e.status<>'draft' or e.starts_at<=clock_timestamp())) or (p_status='cancelled' and e.status not in ('draft','published')) then raise exception 'Transition invalide.';end if;
 update private.competitions set status=p_status where id=p_event_id;insert into private.admin_audit(actor_id,action,target_id,reason) values(u,'competition_status',p_event_id::text,p_status);end$$;
create function private.admin_update_user(p_user_id uuid,p_is_admin boolean,p_suspended boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_admin();begin
 perform pg_advisory_xact_lock(738291);
 if p_is_admin is null or p_suspended is null or p_reason is null or length(trim(p_reason)) not between 3 and 500 or not exists(select 1 from public.users where id=p_user_id) then raise exception 'Modification invalide.';end if;
 if p_user_id=u and p_suspended then raise exception 'Impossible de suspendre son propre compte.';end if;
 if (not p_is_admin or p_suspended) and exists(select 1 from private.player_access where user_id=p_user_id and is_admin and not suspended) and (select count(*) from private.player_access where is_admin and not suspended)<=1 then raise exception 'Le dernier administrateur doit être conservé.';end if;
 insert into private.player_access values(p_user_id,p_is_admin,p_suspended) on conflict(user_id) do update set is_admin=excluded.is_admin,suspended=excluded.suspended;
 insert into private.admin_audit(actor_id,action,target_id,reason) values(u,'user_access:'||p_is_admin::text||':'||p_suspended::text,p_user_id::text,trim(p_reason));end$$;
-- Every tariff and origin is immutable, including seeded catalogue rows.
create or replace function private.reject_community_catalog_edit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' then if (to_jsonb(new)-'active')=(to_jsonb(old)-'active') and private.is_admin() then return new;end if;end if;
 raise exception 'Catalogue immuable : seule la modération de visibilité est autorisée.';end$$;
create function private.admin_set_catalog_active(p_catalog_id text,p_active boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_admin();begin perform pg_advisory_xact_lock(738291);
 if p_active is null or p_reason is null or length(trim(p_reason)) not between 3 and 500 then raise exception 'Motif requis.';end if;
 update public.action_catalog set active=p_active where id=p_catalog_id;if not found then raise exception 'Catégorie inconnue.';end if;
 insert into private.admin_audit(actor_id,action,target_id,reason) values(u,'catalog_active:'||p_active::text,p_catalog_id,trim(p_reason));end$$;
create function private.admin_get_dashboard(p_search text default '',p_offset int default 0) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_admin();items jsonb;total bigint;begin
 if p_search is null or length(p_search)>100 or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Recherche invalide.';end if;perform private.close_due_competitions();
 select count(*) into total from public.users p join auth.users a on a.id=p.id where strpos(lower(p.nickname),lower(p_search))>0 or strpos(lower(coalesce(a.email,'')),lower(p_search))>0;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]'::jsonb) into items from (select p.id,p.nickname,coalesce(a.email,'') email,p.avatar,coalesce(r.is_admin,false) is_admin,coalesce(r.suspended,false) suspended,p.created_at from public.users p join auth.users a on a.id=p.id left join private.player_access r on r.user_id=p.id where strpos(lower(p.nickname),lower(p_search))>0 or strpos(lower(coalesce(a.email,'')),lower(p_search))>0 order by p.created_at desc,p.id limit 50 offset p_offset)x;
 return jsonb_build_object('users',items,'next_offset',case when p_offset+50<total then p_offset+50 else null end,'events',coalesce((select jsonb_agg(private.competition_summary(e.id,u) order by e.starts_at desc) from (select id,starts_at from private.competitions order by starts_at desc limit 100)e),'[]'::jsonb),'catalog',coalesce((select jsonb_agg(to_jsonb(c) order by c.kind,c.id) from public.action_catalog c),'[]'::jsonb),'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from private.admin_audit order by created_at desc,id limit 100)a),'[]'::jsonb));end$$;
create function public.get_social_hub() returns jsonb language sql security invoker set search_path='' as $$select private.get_social_hub()$$;
create function public.get_friend_activity(p_friend_id uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit int default 50) returns jsonb language sql security invoker set search_path='' as $$select private.get_friend_activity(p_friend_id,p_before,p_before_id,p_limit)$$;
create function public.update_history_sharing(p_enabled boolean) returns void language sql security invoker set search_path='' as $$select private.update_history_sharing(p_enabled)$$;
create function public.get_competition(p_event_id uuid,p_offset int default 0) returns jsonb language sql security invoker set search_path='' as $$select private.get_competition(p_event_id,p_offset)$$;
create function public.join_competition(p_event_id uuid) returns void language sql security invoker set search_path='' as $$select private.join_competition(p_event_id)$$;
create function public.leave_competition(p_event_id uuid) returns void language sql security invoker set search_path='' as $$select private.leave_competition(p_event_id)$$;
create function public.admin_get_dashboard(p_search text default '',p_offset int default 0) returns jsonb language sql security invoker set search_path='' as $$select private.admin_get_dashboard(p_search,p_offset)$$;
create function public.admin_save_competition(p_event jsonb,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.admin_save_competition(p_event,p_request_id)$$;
create function public.admin_set_competition_status(p_event_id uuid,p_status text) returns void language sql security invoker set search_path='' as $$select private.admin_set_competition_status(p_event_id,p_status)$$;
create function public.admin_update_user(p_user_id uuid,p_is_admin boolean,p_suspended boolean,p_reason text) returns void language sql security invoker set search_path='' as $$select private.admin_update_user(p_user_id,p_is_admin,p_suspended,p_reason)$$;
create function public.admin_set_catalog_active(p_catalog_id text,p_active boolean,p_reason text) returns void language sql security invoker set search_path='' as $$select private.admin_set_catalog_active(p_catalog_id,p_active,p_reason)$$;
-- Private storage has no client policies or table privileges.
do $$declare t text;begin
 foreach t in array array['player_access','admin_audit','competitions','competition_members','competition_results','competition_badges','competition_requests'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;end$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname=any(array['get_social_hub','get_friend_activity','update_history_sharing','get_competition','join_competition','leave_competition','admin_get_dashboard','admin_save_competition','admin_set_competition_status','admin_update_user','admin_set_catalog_active','assert_user','is_admin','assert_admin','push_notification_eligible','push_notification_eligible_before_suspension','competition_standings','close_due_competitions','competition_summary']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname=any(array['get_social_hub','get_friend_activity','update_history_sharing','get_competition','join_competition','leave_competition','admin_get_dashboard','admin_save_competition','admin_set_competition_status','admin_update_user','admin_set_catalog_active']) then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;end$$;
-- Existing JWTs also lose direct PostgREST/Realtime SELECT visibility.
-- The helper reveals only the caller's own read eligibility, never another role.
create function private.game_read_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(
  select 1 from private.player_access where user_id=auth.uid() and suspended
 )
$$;
revoke all on function private.game_read_allowed() from public,anon,authenticated,service_role;
grant execute on function private.game_read_allowed() to authenticated;
do $$declare t text;begin
 foreach t in array array['users','user_settings','action_catalog','seasons','leagues','league_memberships','leaderboard_entries','actions','friendships','blocks','life_transfers','nemesis_pairs','trophy_definitions','trophies','notifications'] loop
 execute format('create policy active_player_read on public.%I as restrictive for select to authenticated using ((select private.game_read_allowed()))',t);
 end loop;
end$$;
-- Preserve the V1 + push export, adding only the caller's new stored data.
alter function private.export_my_data() rename to export_my_data_before_competitions;
create function private.export_my_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 return private.export_my_data_before_competitions() || jsonb_build_object(
  'share_history',coalesce((select share_history from public.user_settings where user_id=u),false),
  'competition_entries',coalesce((select jsonb_agg(jsonb_build_object(
   'event_id',m.event_id,'joined_at',m.joined_at,
   'event',private.competition_summary(m.event_id,u),
   'final_result',(select to_jsonb(r)-'user_id' from private.competition_results r where r.event_id=m.event_id and r.user_id=u)
  ) order by m.joined_at desc) from private.competition_members m where m.user_id=u),'[]'::jsonb),
  'competition_badges',coalesce((select jsonb_agg(to_jsonb(b)-'user_id' order by b.awarded_at desc) from private.competition_badges b where b.user_id=u),'[]'::jsonb)
 );end$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
revoke all on function private.export_my_data_before_competitions() from public,anon,authenticated,service_role;
revoke all on function private.export_my_data(),public.export_my_data() from public,anon,authenticated,service_role;
grant execute on function private.export_my_data(),public.export_my_data() to authenticated;
-- is_admin/assert_user are intentionally not directly callable by clients.
commit;
