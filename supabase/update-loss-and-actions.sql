-- Mise à jour 007 + 008, à appliquer une seule fois après la progression 006.
begin;
-- Additive owner installation after 001-006. Official league/duel score = gross losses.
-- Life balance and special competitions retain their existing semantics.
select pg_advisory_xact_lock(738291);

-- Owner-only aggregate. A null season means all history. Never expose this helper
-- as an RPC: the caller-facing wrapper supplies only self or authorized opponents.
create function private.loss_stats(p_user uuid,p_season uuid,p_at timestamptz)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('lost_minutes',lost,'recovered_minutes',recovered,'net_lost_minutes',lost-recovered)
 from (select
  coalesce(sum(-(a.minutes_impact::bigint)) filter(where a.kind='excess' and a.minutes_impact<0),0) lost,
  coalesce(sum(a.minutes_impact::bigint) filter(where a.kind='health' and a.minutes_impact>0),0) recovered
 from public.actions a where a.user_id=p_user and (p_season is null or a.season_id=p_season)
 and a.created_at<=p_at) totals
$$;

-- Preserve the immutable ledger and its projection invariant. One compensation
-- per existing user/season, including zero adjustments, makes retries no-ops.
-- This runs before ensure_season can close any overdue, still-open season.
create function private.rebase_loss_scores() returns void
language plpgsql security definer set search_path='' as $$
declare at_time timestamptz;
begin
 perform pg_advisory_xact_lock(738291);
 at_time:=clock_timestamp();
 insert into private.life_ledger(user_id,life_delta,league_delta,reason,source_id,season_id,event_key)
 select e.user_id,0,
  ((private.loss_stats(e.user_id,e.season_id,at_time)->>'lost_minutes')::bigint-e.weekly_score)::integer,
  'loss_scoring_rebase',e.season_id,e.season_id,'loss_scoring_v1:'||e.season_id||':'||e.user_id
 from public.leaderboard_entries e join public.seasons s on s.id=e.season_id
 where s.closed_at is null
 on conflict(event_key) do nothing;
end$$;
revoke all on function private.loss_stats(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.rebase_loss_scores() from public,anon,authenticated,service_role;
select private.rebase_loss_scores();

create or replace function private.action_ledger() returns trigger
language plpgsql security definer set search_path='' as $$begin
 insert into private.life_ledger(user_id,life_delta,league_delta,reason,source_id,season_id,event_key)
 values(new.user_id,new.minutes_impact,case when new.kind='excess' then greatest(-new.minutes_impact,0) else 0 end,
  'action',new.id,new.season_id,'action:'||new.id);
 insert into public.notifications(user_id,message) values(new.user_id,'Un nouveau mouvement a été confirmé dans ta partie.');
 insert into public.trophies(user_id,code,source_id) values(new.user_id,'first-step',new.id) on conflict do nothing;
 return new;
end$$;
revoke all on function private.action_ledger() from public,anon,authenticated,service_role;

-- Friend activity keeps its signed life message. Duel lead uses the new league delta.
create or replace function private.notify_action_social() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_hour text;v_name text;n public.nemesis_pairs;v_after integer;v_other integer;v_rival uuid;v_league_delta integer;
begin
 perform pg_advisory_xact_lock(738291);
 v_league_delta:=case when new.kind='excess' then greatest(-new.minutes_impact,0) else 0 end;
 v_hour:=(floor(extract(epoch from new.created_at)/3600)*3600)::bigint::text;
 if exists(select 1 from public.user_settings where user_id=new.user_id and share_activity) then
  select nickname into v_name from public.users where id=new.user_id;
  insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key)
  select r.recipient,v_name||' a déclaré « '||new.label||' » ('||case when new.minutes_impact>0 then '+' else '' end||new.minutes_impact||' min de vie).',
   'friend_action',new.user_id,'amis','friend_action:'||r.recipient||':'||new.user_id||':'||v_hour
  from (select case when f.requester=new.user_id then f.recipient else f.requester end as recipient
   from public.friendships f where f.status='accepted' and (f.requester=new.user_id or f.recipient=new.user_id)) r
  join public.user_settings pref on pref.user_id=r.recipient and pref.notify_friends
  where r.recipient<>new.user_id and not private.is_blocked(new.user_id,r.recipient)
  on conflict(event_key) do nothing;
 end if;
 -- PostgreSQL exécute les AFTER ROW triggers par nom : z_ suit action_to_ledger.
 -- La projection inclut donc déjà cet impact. Aucun détail d'action n'est révélé
 -- aux adversaires ; seul un changement du classement est annoncé.
 for n in select * from public.nemesis_pairs where season_id=new.season_id and (user_a=new.user_id or user_b=new.user_id) loop
  v_rival:=case when n.user_a=new.user_id then n.user_b else n.user_a end;
  select weekly_score into v_after from public.leaderboard_entries where user_id=new.user_id and season_id=new.season_id;
  select weekly_score into v_other from public.leaderboard_entries where user_id=v_rival and season_id=new.season_id;
  if sign(v_after-v_other) is distinct from sign(v_after-v_league_delta-v_other) then
   perform private.emit_duel_notifications(new.season_id,n.user_a,n.user_b,'duel_lead',v_hour);
  end if;
 end loop;
 return new;
end$$;
revoke all on function private.notify_action_social() from public,anon,authenticated,service_role;

-- Keep all 002 contract fields by wrapping its existing implementation.
alter function private.get_game_state() rename to get_game_state_before_loss_scoring;
revoke all on function private.get_game_state_before_loss_scoring() from public,anon,authenticated,service_role;
create function private.get_game_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();s uuid;l uuid;result jsonb;at_time timestamptz;
begin
 -- assert_user retains 004 suspension checks and acquires the shared mutation lock.
 result:=private.get_game_state_before_loss_scoring();
 if result is null then return null;end if;
 -- Match the exact season returned by the base call even across a week boundary.
 select id into s from public.seasons where ends_at=(result->>'season_end')::timestamptz order by starts_at desc limit 1;
 at_time:=clock_timestamp();
 select league_id into l from public.league_memberships where user_id=u and season_id=s;
 result:=result||jsonb_build_object(
  'loss_scoring',true,
  'life_stats',private.loss_stats(u,null,at_time),
  'weekly_stats',private.loss_stats(u,s,at_time),
  -- Match season closure ranks over every entry, before visibility filtering.
  -- Only the count and authorized players' positions leave this function.
  'league_size',(select count(*) from public.leaderboard_entries where season_id=s and league_id=l),
  'official_rank',(select ranked.official_rank from (
   select e.user_id,row_number() over(order by e.weekly_score desc,e.user_id) official_rank
   from public.leaderboard_entries e where e.season_id=s and e.league_id=l
  ) ranked where ranked.user_id=u),
  'players',coalesce((select jsonb_agg(jsonb_build_object(
   'id',e.user_id,'nickname',e.nickname,'avatar',e.avatar,'weekly_score',e.weekly_score,
   'official_rank',e.official_rank,'weekly_stats',private.loss_stats(e.user_id,s,at_time)) order by e.weekly_score desc,e.user_id)
   from (select entries.*,row_number() over(order by entries.weekly_score desc,entries.user_id) official_rank
    from public.leaderboard_entries entries where entries.season_id=s and entries.league_id=l) e
   join public.league_memberships m on m.user_id=e.user_id and m.season_id=e.season_id and m.league_id=e.league_id
   where e.season_id=s and e.league_id=l and not private.is_blocked(u,e.user_id)
   and not exists(select 1 from private.player_access p where p.user_id=e.user_id and p.suspended)), '[]'::jsonb),
  'nemesis',(select jsonb_build_object(
   'id',e.user_id,'nickname',e.nickname,'avatar',e.avatar,'weekly_score',e.weekly_score,
   'weekly_stats',private.loss_stats(e.user_id,s,at_time))
   from public.nemesis_pairs n
   join public.leaderboard_entries e on e.user_id=case when n.user_a=u then n.user_b else n.user_a end and e.season_id=n.season_id
   where n.season_id=s and (n.user_a=u or n.user_b=u) and not private.is_blocked(u,e.user_id)
   and not exists(select 1 from private.player_access p where p.user_id=e.user_id and p.suspended)
   order by e.user_id limit 1));
 return result;
end$$;
-- Rebind the SQL facade explicitly after renaming its previous target.
create or replace function public.get_game_state() returns jsonb
language sql security invoker set search_path='' as $$select private.get_game_state()$$;
revoke all on function private.get_game_state() from public,anon,authenticated,service_role;
revoke all on function public.get_game_state() from public,anon,authenticated,service_role;
grant execute on function private.get_game_state() to authenticated;
grant execute on function public.get_game_state() to authenticated;
-- Ajouts au catalogue : barèmes de jeu fictifs, aucune estimation médicale.
-- Les anciennes catégories et les déclarations historiques restent inchangées.
insert into public.action_catalog(id,label,kind,unit,max_quantity,coefficient,daily_cap,icon) values
('cocktail-light','Cocktail léger / dilué','excess','cocktail',5,-25,0,'wine'),
('cocktail-strong','Cocktail fort / sucré','excess','cocktail',5,-45,0,'wine'),
('spirit-shot','Shot d’alcool fort','excess','shot',5,-30,0,'wine'),
('vegetables','Légumes frais / salade composée','health','portion',3,20,60,'leaf'),
('berries-nuts','Fruits rouges ou noix','health','portion',2,25,50,'leaf'),
('plant-meal','Repas végétalisé riche en fibres','health','repas',2,40,80,'leaf'),
('brisk-walk','Marche rapide de 30 minutes','health','marche de 30 min',2,90,180,'footprints'),
('short-nap','Sieste courte de 15 à 25 minutes','health','sieste',1,30,30,'moon'),
('restful-night','Nuit réparatrice de 7 à 8 heures','health','nuit',1,90,90,'moon'),
('calm-break','Déconnexion / repos calme','health','pause de 30 min',3,20,60,'leaf'),
('real-holiday','Vacances / vraie coupure','health','journée',1,180,180,'leaf'),
('standard-drink','Verre de vin ou bière standard','excess','verre',5,-20,0,'wine'),
('sweet-cocktail','Cocktail sucré (mojito, margarita)','excess','cocktail',5,-35,0,'wine'),
('heavy-meal','Repas lourd (fast-food, friture)','excess','repas',3,-45,0,'pizza'),
('processed-meat','Charcuterie / viande ultra-transformée','excess','portion',3,-30,0,'pizza'),
('stress-day','Journée de stress intense','excess','journée',1,-180,0,'activity'),
('sleepless-night','Nuit blanche ou sommeil inférieur à 5 h','excess','nuit',1,-150,0,'coffee'),
('cigarette','Cigarette','excess','cigarette',20,-12,0,'flame')
on conflict(id) do nothing;
commit;
