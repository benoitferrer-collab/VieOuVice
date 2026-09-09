-- Additive upgrade after 001-005. Manual owner installation only.
begin;

create function private.progression_week_start(p_at timestamptz) returns date
language sql immutable security definer set search_path='' as $$
 select date_trunc('week',p_at at time zone 'Europe/Paris')::date
$$;
create function private.progression_week_end(p_week date) returns timestamptz
language sql immutable security definer set search_path='' as $$
 select (p_week+7)::timestamp at time zone 'Europe/Paris'
$$;

create table private.weekly_mission_choices (
 user_id uuid not null references public.users,
 week_start date not null check(isfinite(week_start) and extract(isodow from week_start)=1),
 code text not null check(code in('pause_days','healthy_days','healthy_variety','new_habit','competition_action')),
 chosen_at timestamptz not null default clock_timestamp(),
 primary key(user_id,week_start,code)
);
create table private.xp_awards (
 user_id uuid not null,week_start date not null,code text not null,
 xp integer not null default 50 check(xp=50),awarded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,week_start,code),
 foreign key(user_id,week_start,code) references private.weekly_mission_choices(user_id,week_start,code)
);
create table private.progression_badges (
 user_id uuid not null references public.users,code text not null check(code='premier_trio'),
 week_start date not null,awarded_at timestamptz not null default clock_timestamp(),primary key(user_id,code)
);
create table private.equipped_cosmetics (
 user_id uuid primary key references public.users,
 accessory text check(accessory in('leaf_pin','halo','laurel')),
 title text check(title in('encore_debout','pas_apres_pas','arena')),
 background text check(background in('aurora','constellation','golden')),
 updated_at timestamptz not null default clock_timestamp()
);
create trigger mission_choices_immutable before update or delete on private.weekly_mission_choices for each row execute function private.reject_edit();
create trigger xp_awards_immutable before update or delete on private.xp_awards for each row execute function private.reject_edit();
create trigger progression_badges_immutable before update or delete on private.progression_badges for each row execute function private.reject_edit();
-- Defense in depth: even an internal future caller cannot exceed three choices.
create function private.guard_mission_choice() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.weekly_mission_choices where user_id=new.user_id and week_start=new.week_start and code=new.code)
 and (select count(*) from private.weekly_mission_choices where user_id=new.user_id and week_start=new.week_start)>=3 then
 raise exception 'Trois missions maximum par semaine.';end if;
 return new;
end$$;
create trigger mission_choice_limit before insert on private.weekly_mission_choices for each row execute function private.guard_mission_choice();

-- One bounded week of positive actions, plus indexed prior-use checks for new_habit.
-- Timestamp comparisons use civil Paris boundaries, never a fixed 168-hour week.
create function private.progression_missions(p_user uuid,p_week date)
returns table(code text,target integer,progress integer,available boolean)
language sql stable security definer set search_path='' as $$
 with bounds as (
 select p_week::timestamp at time zone 'Europe/Paris' as starts_at,private.progression_week_end(p_week) as ends_at
 ), healthy as materialized (
 select a.catalog_id,a.created_at from public.actions a,bounds b
 where a.user_id=p_user and a.kind='health' and a.minutes_impact>0
 and a.created_at>=b.starts_at and a.created_at<b.ends_at and a.created_at<=statement_timestamp()
 ), metrics as (
 select least(3,count(distinct (created_at at time zone 'Europe/Paris')::date) filter(where catalog_id='pause'))::integer pause_days,
 least(3,count(distinct (created_at at time zone 'Europe/Paris')::date))::integer healthy_days,
 least(3,count(distinct catalog_id))::integer healthy_variety from healthy
 ), events as (
 select e.* from private.competitions e,bounds b
 where e.status in('published','completed') and e.starts_at<b.ends_at and e.ends_at>b.starts_at
 )
 select 'pause_days',3,m.pause_days,true from metrics m
 union all select 'healthy_days',3,m.healthy_days,true from metrics m
 union all select 'healthy_variety',3,m.healthy_variety,true from metrics m
 union all select 'new_habit',1,case when exists(
 select 1 from healthy h,bounds b where not exists(
 select 1 from public.actions old where old.user_id=p_user and old.catalog_id=h.catalog_id
 and old.kind='health' and old.minutes_impact>0 and old.created_at<b.starts_at
 )) then 1 else 0 end,true
 union all select 'competition_action',1,case when exists(
 select 1 from healthy h join events e on h.created_at>=e.starts_at and h.created_at<e.ends_at
 join private.competition_members m on m.event_id=e.id and m.user_id=p_user and h.created_at>=m.joined_at
 where e.metric in('health_minutes','net_minutes') or (e.metric='category_minutes' and h.catalog_id=e.catalog_id)
 ) then 1 else 0 end,exists(select 1 from events)
$$;
create index actions_progression_prior on public.actions(user_id,catalog_id,created_at) where kind='health' and minutes_impact>0;

create function private.settle_progression(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$declare w record;begin
 perform pg_advisory_xact_lock(738291);
 for w in select distinct c.week_start from private.weekly_mission_choices c
 where c.user_id=p_user and c.week_start<=private.progression_week_start(clock_timestamp())
 and not exists(select 1 from private.xp_awards x where (x.user_id,x.week_start,x.code)=(c.user_id,c.week_start,c.code)) loop
  insert into private.xp_awards(user_id,week_start,code)
  select p_user,w.week_start,c.code from private.weekly_mission_choices c
  join private.progression_missions(p_user,w.week_start) m on m.code=c.code
  where c.user_id=p_user and c.week_start=w.week_start and m.progress>=m.target
  on conflict do nothing;
  insert into private.progression_badges(user_id,code,week_start)
  select p_user,'premier_trio',w.week_start where (select count(*) from private.xp_awards where user_id=p_user and week_start=w.week_start)=3
  on conflict do nothing;
 end loop;
end$$;

-- Settle earned participation XP before cancelling a live event. Reading the
-- mission before versus after cancellation must not change an earned reward.
alter function private.admin_set_competition_status(uuid,text) rename to admin_set_competition_status_before_progression;
create function private.admin_set_competition_status(p_event_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$declare member_id uuid;begin
 perform private.assert_admin();perform pg_advisory_xact_lock(738291);
 if p_status='cancelled' then
  for member_id in select distinct m.user_id from private.competitions e
  join private.competition_members m on m.event_id=e.id
  join private.weekly_mission_choices c on c.user_id=m.user_id and c.code='competition_action'
  where e.id=p_event_id and e.status='published'
  and c.week_start::timestamp at time zone 'Europe/Paris'<e.ends_at
  and private.progression_week_end(c.week_start)>e.starts_at loop
   perform private.settle_progression(member_id);
  end loop;
 end if;
 perform private.admin_set_competition_status_before_progression(p_event_id,p_status);
end$$;
create or replace function public.admin_set_competition_status(p_event_id uuid,p_status text) returns void
language sql security invoker set search_path='' as $$select private.admin_set_competition_status(p_event_id,p_status)$$;
revoke all on function private.admin_set_competition_status_before_progression(uuid,text),private.admin_set_competition_status(uuid,text),public.admin_set_competition_status(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.admin_set_competition_status(uuid,text),public.admin_set_competition_status(uuid,text) to authenticated;

create function private.cosmetic_inventory(p_user uuid)
returns table(id text,slot text,unlocked boolean)
language sql stable security definer set search_path='' as $$
 with earned as (select coalesce(sum(xp),0) xp from private.xp_awards where user_id=p_user),
 badges as (select exists(select 1 from private.competition_badges where user_id=p_user) any_badge,
 exists(select 1 from private.competition_badges where user_id=p_user and kind='winner') winner)
 select c.id,c.slot,earned.xp>=c.required_xp and case c.requirement when 'any' then badges.any_badge when 'winner' then badges.winner else true end
 from (values
 ('encore_debout','title',50,''),('leaf_pin','accessory',100,''),('aurora','background',150,''),
 ('pas_apres_pas','title',300,''),('halo','accessory',450,''),('constellation','background',600,''),
 ('laurel','accessory',0,'any'),('arena','title',0,'any'),('golden','background',0,'winner')
 )c(id,slot,required_xp,requirement),earned,badges
$$;
create function private.progression_equipped(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('accessory',e.accessory,'title',e.title,'background',e.background)
 from (select p_user user_id) u left join private.equipped_cosmetics e using(user_id)
$$;
create function private.public_progression_badges(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'icon',b.icon) order by b.priority,b.awarded_at desc,b.id),'[]'::jsonb)
 from (
 select * from (
 select code id,'Premier trio'::text label,'star'::text icon,0 priority,awarded_at from private.progression_badges where user_id=p_user
 union all
 select event_id::text,label,icon,1,awarded_at from private.competition_badges where user_id=p_user
 ) all_badges order by priority,awarded_at desc,id limit 3
 )b
$$;

create function private.get_progression() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();w date:=private.progression_week_start(clock_timestamp());total_xp bigint;missions jsonb;begin
 if not exists(select 1 from public.users where id=u) then raise exception 'Profil requis.';end if;
 perform private.flush_reaction_digests(u);
 perform private.close_due_competitions();
 perform private.settle_progression(u);
 select coalesce(sum(xp),0) into total_xp from private.xp_awards where user_id=u;
 select jsonb_agg(jsonb_build_object('code',m.code,'target',m.target,'progress',m.progress,
 'selected',c.code is not null,'completed',m.progress>=m.target,'awarded',x.code is not null,'xp',50,'available',m.available)
 order by array_position(array['pause_days','healthy_days','healthy_variety','new_habit','competition_action'],m.code)) into missions
 from private.progression_missions(u,w) m left join private.weekly_mission_choices c on c.user_id=u and c.week_start=w and c.code=m.code
 left join private.xp_awards x on x.user_id=u and x.week_start=w and x.code=m.code;
 return jsonb_build_object('available',true,'week_start',w::timestamp at time zone 'Europe/Paris','week_end',private.progression_week_end(w),
 'xp',total_xp,'level',1+total_xp/100,'week_xp',(select coalesce(sum(xp),0) from private.xp_awards where user_id=u and week_start=w),
 'missions',missions,'inventory',(select jsonb_agg(to_jsonb(i)) from private.cosmetic_inventory(u)i),
 'equipped',private.progression_equipped(u),'badges',private.public_progression_badges(u),
 'notify_reactions',coalesce((select notify_reactions from public.user_settings where user_id=u),true));
end$$;
create function private.choose_weekly_mission(p_code text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();w date:=private.progression_week_start(clock_timestamp());begin
 if p_code is null or p_code not in('pause_days','healthy_days','healthy_variety','new_habit','competition_action') then raise exception 'Mission inconnue.';end if;
 if not exists(select 1 from public.users where id=u) then raise exception 'Profil requis.';end if;
 -- Existing choices are final and retries succeed even if an event was cancelled since selection.
 if exists(select 1 from private.weekly_mission_choices where user_id=u and week_start=w and code=p_code) then return;end if;
 if p_code='competition_action' and not exists(select 1 from private.competitions
 where status in('published','completed') and starts_at<private.progression_week_end(w) and ends_at>w::timestamp at time zone 'Europe/Paris') then raise exception 'Aucune compétition cette semaine.';end if;
 insert into private.weekly_mission_choices(user_id,week_start,code) values(u,w,p_code) on conflict do nothing;
 perform private.settle_progression(u);
end$$;
create function private.equip_cosmetic(p_slot text,p_item_id text) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 if p_slot is null or p_slot not in('accessory','title','background') then raise exception 'Emplacement inconnu.';end if;
 if not exists(select 1 from public.users where id=u) then raise exception 'Profil requis.';end if;
 perform private.close_due_competitions();perform private.settle_progression(u);
 if p_item_id is not null and not exists(select 1 from private.cosmetic_inventory(u) where id=p_item_id and slot=p_slot and unlocked) then raise exception 'Objet inconnu, verrouillé ou incompatible.';end if;
 insert into private.equipped_cosmetics(user_id) values(u) on conflict do nothing;
 update private.equipped_cosmetics set
 accessory=case when p_slot='accessory' then p_item_id else accessory end,
 title=case when p_slot='title' then p_item_id else title end,
 background=case when p_slot='background' then p_item_id else background end,
 updated_at=clock_timestamp() where user_id=u;
end$$;
create function private.get_player_looks(p_user_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();result jsonb;begin
 if p_user_ids is null or cardinality(p_user_ids)>60 then raise exception 'Soixante joueurs maximum.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'level',1+(select coalesce(sum(xp),0)/100 from private.xp_awards where user_id=p.id),
 'equipped',private.progression_equipped(p.id),'badges',private.public_progression_badges(p.id)) order by p.id),'[]'::jsonb) into result
 from public.users p where p.id=any(p_user_ids)
 and not private.is_blocked(u,p.id) and not exists(select 1 from private.player_access where user_id=p.id and suspended)
 and (p.id=u or exists(select 1 from public.friendships where status='accepted' and least(requester,recipient)=least(u,p.id) and greatest(requester,recipient)=greatest(u,p.id))
 or exists(select 1 from public.league_memberships mine join public.league_memberships theirs on theirs.league_id=mine.league_id where mine.user_id=u and theirs.user_id=p.id)
 or exists(select 1 from private.competition_members mine join private.competition_members theirs on theirs.event_id=mine.event_id
 join private.competitions e on e.id=mine.event_id where mine.user_id=u and theirs.user_id=p.id and e.status in('published','completed')));
 return result;
end$$;

create function public.get_progression() returns jsonb language sql security invoker set search_path='' as $$select private.get_progression()$$;
create function public.choose_weekly_mission(p_code text) returns void language sql security invoker set search_path='' as $$select private.choose_weekly_mission(p_code)$$;
create function public.equip_cosmetic(p_slot text,p_item_id text) returns void language sql security invoker set search_path='' as $$select private.equip_cosmetic(p_slot,p_item_id)$$;
create function public.get_player_looks(p_user_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$select private.get_player_looks(p_user_ids)$$;

alter function private.export_my_data() rename to export_my_data_before_progression;
create function private.export_my_data() returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 return private.export_my_data_before_progression() || jsonb_build_object(
 'weekly_mission_choices',coalesce((select jsonb_agg(to_jsonb(c) order by week_start,code) from private.weekly_mission_choices c where user_id=u),'[]'::jsonb),
 'xp_awards',coalesce((select jsonb_agg(to_jsonb(x) order by week_start,code) from private.xp_awards x where user_id=u),'[]'::jsonb),
 'progression_badges',coalesce((select jsonb_agg(to_jsonb(b) order by awarded_at,code) from private.progression_badges b where user_id=u),'[]'::jsonb),
 'equipped_cosmetics',private.progression_equipped(u));
end$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
revoke all on function private.export_my_data_before_progression() from public,anon,authenticated,service_role;
revoke all on function private.export_my_data(),public.export_my_data() from public,anon,authenticated,service_role;
grant execute on function private.export_my_data(),public.export_my_data() to authenticated;

do $$declare t text;f record;begin
 foreach t in array array['weekly_mission_choices','xp_awards','progression_badges','equipped_cosmetics'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and p.proname=any(array['progression_week_start','progression_week_end','guard_mission_choice','progression_missions','settle_progression','cosmetic_inventory','progression_equipped','public_progression_badges','get_progression','choose_weekly_mission','equip_cosmetic','get_player_looks']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname=any(array['get_progression','choose_weekly_mission','equip_cosmetic','get_player_looks']) then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end$$;
commit;
