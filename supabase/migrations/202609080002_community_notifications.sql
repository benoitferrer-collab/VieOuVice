-- Excès-O-Meter V1 -> catalogue communautaire et notifications sociales.
-- Supabase SQL Editor, après 001 + seed. Transaction non destructive ; une seule application.
-- Les montants sont des valeurs fictives du jeu, sans signification médicale.
begin;

alter table public.action_catalog
 add column creator_id uuid references public.users(id) on delete restrict,
 add column creator_name text,
 add column created_at timestamptz,
 add constraint community_catalog_metadata check (
  (creator_id is null and creator_name is null and created_at is null) or
  (creator_id is not null and creator_name is not null and created_at is not null
   and char_length(id)<=40 and char_length(label) between 3 and 60
   and char_length(unit) between 2 and 40 and abs(coefficient) between 1 and 120
   and max_quantity between 1 and 10
   and ((kind='health' and daily_cap=120 and icon='leaf') or
        (kind='excess' and daily_cap=0 and icon='flame'))));
create index catalog_creator_created on public.action_catalog(creator_id,created_at) where creator_id is not null;

-- Payload brut conservé : deux requêtes distinctes ne deviennent pas identiques
-- après trim. Les retries exacts retrouvent le même objet sans consommer de quota.
create table private.catalog_creation_requests (
 user_id uuid not null references public.users(id),
 idempotency_key uuid not null,
 request_payload jsonb not null,
 catalog_id text not null unique references public.action_catalog(id),
 primary key(user_id,idempotency_key)
);
revoke all on private.catalog_creation_requests from public,anon,authenticated;

create function private.reject_community_catalog_edit() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if old.creator_id is not null then raise exception 'Création communautaire immuable : crée une nouvelle variante.';end if;
 if tg_op='UPDATE' then
  if new.creator_id is not null then raise exception 'L’origine d’une catégorie est immuable.';end if;
  return new;
 end if;
 return old;
end$$;
create trigger community_catalog_immutable before update or delete on public.action_catalog
for each row execute function private.reject_community_catalog_edit();

create function private.create_catalog_action(
 p_label text,p_kind text,p_unit text,p_magnitude integer,p_max_quantity integer,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=private.assert_user(); v_name text; payload jsonb; previous private.catalog_creation_requests;
 c public.action_catalog; v_count integer; v_now timestamptz;
begin
 perform pg_advisory_xact_lock(738291);
 select nickname into v_name from public.users where id=u for update;
 if not found then raise exception 'Profil requis.';end if;
 if p_idempotency_key is null then raise exception 'Clé requise.';end if;
 payload:=jsonb_build_object('label',p_label,'kind',p_kind,'unit',p_unit,'magnitude',p_magnitude,'max_quantity',p_max_quantity);
 select * into previous from private.catalog_creation_requests where user_id=u and idempotency_key=p_idempotency_key;
 if found then
  if previous.request_payload is distinct from payload then raise exception 'Clé réutilisée avec un contenu différent.';end if;
  select * into c from public.action_catalog where id=previous.catalog_id;
  return to_jsonb(c);
 end if;
 if p_label is null or char_length(btrim(p_label)) not between 3 and 60
  or p_unit is null or char_length(btrim(p_unit)) not between 2 and 40
  or p_label ~ '[[:cntrl:]]' or p_unit ~ '[[:cntrl:]]'
  or p_kind is null or p_kind not in('health','excess')
  or p_magnitude is null or p_magnitude not between 1 and 120
  or p_max_quantity is null or p_max_quantity not between 1 and 10
 then raise exception 'Catégorie invalide : nom 3–60, unité 2–40, valeur 1–120 et quantité 1–10.';end if;
 v_now:=clock_timestamp();
 insert into private.daily_limits(user_id,operation,local_day,used)
 values(u,'catalog_create',(v_now at time zone 'Europe/Paris')::date,1)
 on conflict(user_id,operation,local_day) do update set used=private.daily_limits.used+1
 where private.daily_limits.used<5 returning used into v_count;
 if v_count is null then raise exception 'Limite de cinq créations par jour atteinte.';end if;
 insert into public.action_catalog(id,label,kind,unit,max_quantity,coefficient,daily_cap,icon,version,active,creator_id,creator_name,created_at)
 values(gen_random_uuid()::text,btrim(p_label),p_kind,btrim(p_unit),p_max_quantity,
  case when p_kind='health' then p_magnitude else -p_magnitude end,
  case when p_kind='health' then 120 else 0 end,
  case when p_kind='health' then 'leaf' else 'flame' end,1,true,u,v_name,v_now)
 returning * into c;
 insert into private.catalog_creation_requests(user_id,idempotency_key,request_payload,catalog_id)
 values(u,p_idempotency_key,payload,c.id);
 return to_jsonb(c);
end$$;
create function public.create_catalog_action(
 p_label text,p_kind text,p_unit text,p_magnitude integer,p_max_quantity integer,p_idempotency_key uuid
) returns jsonb language sql security invoker set search_path='' as $$
 select private.create_catalog_action(p_label,p_kind,p_unit,p_magnitude,p_max_quantity,p_idempotency_key)
$$;

-- Préserve limites V1, idempotence, snapshots et projection ledger. Les catégories
-- officielles conservent leurs plafonds ; toutes les bonnes actions communautaires
-- partagent un plafond supplémentaire de 150 minutes par jour Europe/Paris.
create or replace function private.record_action(p_catalog_id text,p_quantity integer,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();s uuid;c public.action_catalog;a public.actions;
 v_now timestamptz;used integer;community_used integer;impact integer;
begin
 perform pg_advisory_xact_lock(738291);v_now:=clock_timestamp();s:=private.ensure_season(v_now);
 perform 1 from public.users where id=u for update;if not found then raise exception 'Profil requis.';end if;
 if p_idempotency_key is null then raise exception 'Clé requise.';end if;
 select * into a from public.actions where user_id=u and idempotency_key=p_idempotency_key;
 if a.id is not null then
  if a.catalog_id is distinct from p_catalog_id or a.quantity is distinct from p_quantity then raise exception 'Clé réutilisée avec un contenu différent.';end if;
  return to_jsonb(a);
 end if;
 select * into c from public.action_catalog where id=p_catalog_id and active;
 if c.id is null or p_quantity is null or p_quantity<1 or p_quantity>c.max_quantity then raise exception 'Quantité non autorisée.';end if;
 if (select count(*) from public.actions where user_id=u and created_at>=private.day_start(v_now))>=100 then raise exception 'Limite quotidienne de déclarations atteinte.';end if;
 if (select count(*) from public.actions where user_id=u and created_at>v_now-interval '1 minute')>=10 then raise exception 'Trop de déclarations. Patiente une minute.';end if;
 impact:=c.coefficient*p_quantity;
 if c.kind='health' then
  select coalesce(sum(greatest(minutes_impact,0)),0) into used from public.actions
   where user_id=u and catalog_id=c.id and created_at>=private.day_start(v_now);
  impact:=greatest(0,least(impact,c.daily_cap-used));
  if c.creator_id is not null then
   select coalesce(sum(greatest(a2.minutes_impact,0)),0) into community_used
    from public.actions a2 join public.action_catalog c2 on c2.id=a2.catalog_id
    where a2.user_id=u and a2.kind='health' and c2.creator_id is not null and a2.created_at>=private.day_start(v_now);
   impact:=greatest(0,least(impact,150-community_used));
  end if;
 end if;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(u,c.id,c.label,c.kind,p_quantity,impact,c.version,s,v_now,p_idempotency_key) returning * into a;
 return to_jsonb(a);
end$$;

alter table public.user_settings
 add column share_activity boolean not null default false,
 add column notify_friends boolean not null default true,
 add column notify_duels boolean not null default true;
alter table public.notifications
 add column kind text not null default 'system' check(kind in('system','friend_action','duel_started','duel_lead','duel_finished')),
 add column actor_id uuid references public.users(id) on delete restrict,
 add column target_tab text check(target_tab in('survie','ligue','nemesis','amis')),
 add column event_key text unique,
 add constraint social_notification_shape check(kind='system' or (actor_id is not null and actor_id<>user_id and target_tab is not null and event_key is not null));
create index notifications_actor_unread on public.notifications(actor_id,user_id) where read_at is null and kind<>'system';

-- Tombstones privées : réactiver le partage après nettoyage ne contourne pas le
-- plafond horaire et ne répète pas un événement de duel déjà diffusé.
create table private.social_notification_events (
 event_key text primary key,
 created_at timestamptz not null default clock_timestamp()
);
revoke all on private.social_notification_events from public,anon,authenticated;
create function private.reserve_social_notification_event() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.kind='system' then return new;end if;
 insert into private.social_notification_events(event_key) values(new.event_key) on conflict do nothing;
 if not found then return null;end if;
 return new;
end$$;
create trigger social_event_deduplicate before insert on public.notifications
for each row execute function private.reserve_social_notification_event();

create function private.update_notification_settings(p_share_activity boolean,p_notify_friends boolean,p_notify_duels boolean)
returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform pg_advisory_xact_lock(738291);
 if p_share_activity is null or p_notify_friends is null or p_notify_duels is null then raise exception 'Réglages invalides.';end if;
 update public.user_settings set share_activity=p_share_activity,notify_friends=p_notify_friends,notify_duels=p_notify_duels where user_id=u;
 if not found then raise exception 'Profil requis.';end if;
end$$;
create function public.update_notification_settings(p_share_activity boolean,p_notify_friends boolean,p_notify_duels boolean)
returns void language sql security invoker set search_path='' as $$
 select private.update_notification_settings(p_share_activity,p_notify_friends,p_notify_duels)
$$;

-- Lecture individuelle idempotente, sans révéler l'existence d'une notice tierce.
create function private.read_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform pg_advisory_xact_lock(738291);
 if p_id is null then raise exception 'Identifiant requis.';end if;
 update public.notifications set read_at=clock_timestamp() where id=p_id and user_id=u and read_at is null;
end$$;
create function public.read_notification(p_id uuid) returns void
language sql security invoker set search_path='' as $$select private.read_notification(p_id)$$;

-- Les suppressions invalident également une éventuelle outbox 003 liée en cascade.
-- Seuls les détails sociaux encore non lus sont retirés ; les reçus système restent.
create function private.cleanup_social_settings() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(738291);
 if old.share_activity and not new.share_activity then
  delete from public.notifications where actor_id=new.user_id and kind='friend_action' and read_at is null;
 end if;
 if old.notify_friends and not new.notify_friends then
  delete from public.notifications where user_id=new.user_id and kind='friend_action' and read_at is null;
 end if;
 if (old.notify_duels and not new.notify_duels) or (old.pvp and not new.pvp) then
  delete from public.notifications where read_at is null and kind in('duel_started','duel_lead','duel_finished')
   and (user_id=new.user_id or (old.pvp and not new.pvp and actor_id=new.user_id));
 end if;
 return new;
end$$;
create trigger social_settings_cleanup after update on public.user_settings
for each row execute function private.cleanup_social_settings();
create function private.cleanup_social_block() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(738291);
 delete from public.notifications where read_at is null and kind<>'system'
  and ((user_id=new.blocker and actor_id=new.blocked) or (user_id=new.blocked and actor_id=new.blocker));
 return new;
end$$;
create trigger social_block_cleanup after insert on public.blocks
for each row execute function private.cleanup_social_block();

-- Helper réservé aux triggers (aucun GRANT client). Les jobs de saison n'ont pas
-- de JWT ; l'autorité est le trigger protégé, puis les préférences et le blocage.
-- Clés stables : kind:season:recipient:rival[:UTC_hour_epoch].
create function private.emit_duel_notifications(p_season uuid,p_a uuid,p_b uuid,p_kind text,p_bucket text)
returns void language plpgsql security definer set search_path='' as $$
declare r record; v_message text; v_a_score integer; v_b_score integer; v_own_score integer;v_other_score integer;
begin
 perform pg_advisory_xact_lock(738291);
 if p_kind not in('duel_started','duel_lead','duel_finished') or p_kind is null then raise exception 'Type de duel invalide.';end if;
 if p_a=p_b or private.is_blocked(p_a,p_b) then return;end if;
 if not exists(select 1 from public.user_settings sa join public.user_settings sb on sb.user_id=p_b where sa.user_id=p_a and sa.pvp and sb.pvp) then return;end if;
 if not exists(select 1 from public.nemesis_pairs where season_id=p_season and user_a=least(p_a,p_b) and user_b=greatest(p_a,p_b)) then return;end if;
 select weekly_score into v_a_score from public.leaderboard_entries where season_id=p_season and user_id=p_a;
 select weekly_score into v_b_score from public.leaderboard_entries where season_id=p_season and user_id=p_b;
 if v_a_score is null or v_b_score is null then return;end if;
 for r in select x.recipient,x.actor,u.nickname from (values(p_a,p_b),(p_b,p_a)) as x(recipient,actor)
  join public.user_settings pref on pref.user_id=x.recipient and pref.notify_duels
  join public.users u on u.id=x.actor
 loop
  v_own_score:=case when r.recipient=p_a then v_a_score else v_b_score end;
  v_other_score:=case when r.recipient=p_a then v_b_score else v_a_score end;
  v_message:=case p_kind
   when 'duel_started' then 'Ton duel avec '||r.nickname||' commence. Retrouve-le dans Némésis.'
   when 'duel_lead' then 'Le classement de ton duel avec '||r.nickname||' a changé. Consulte Némésis.'
   when 'duel_finished' then 'Duel terminé avec '||r.nickname||' : '||case when v_own_score=v_other_score then 'égalité.' when v_own_score>v_other_score then 'tu remportes ce duel.' else r.nickname||' remporte ce duel.' end
  end;
  insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key)
  values(r.recipient,v_message,p_kind,r.actor,'nemesis',p_kind||':'||p_season||':'||r.recipient||':'||r.actor||case when p_bucket is null then '' else ':'||p_bucket end)
  on conflict(event_key) do nothing;
 end loop;
end$$;

create function private.notify_duel_start() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform private.emit_duel_notifications(new.season_id,new.user_a,new.user_b,'duel_started',null);return new;
end$$;
create trigger social_duel_start after insert on public.nemesis_pairs
for each row execute function private.notify_duel_start();

create function private.notify_action_social() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_hour text;v_name text;n public.nemesis_pairs;v_after integer;v_other integer;v_rival uuid;
begin
 perform pg_advisory_xact_lock(738291);
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
  if sign(v_after-v_other) is distinct from sign(v_after-new.minutes_impact-v_other) then
   perform private.emit_duel_notifications(new.season_id,n.user_a,n.user_b,'duel_lead',v_hour);
  end if;
 end loop;
 return new;
end$$;
create trigger z_action_social after insert on public.actions
for each row execute function private.notify_action_social();

create function private.notify_duel_end() returns trigger
language plpgsql security definer set search_path='' as $$declare n public.nemesis_pairs;begin
 if old.closed_at is null and new.closed_at is not null then
  for n in select * from public.nemesis_pairs where season_id=new.id loop
   perform private.emit_duel_notifications(new.id,n.user_a,n.user_b,'duel_finished',null);
  end loop;
 end if;
 return new;
end$$;
create trigger social_duel_end after update of closed_at on public.seasons
for each row execute function private.notify_duel_end();

-- Même contrat V1, catalogue complet (c.*), champs sociaux supplémentaires.
create or replace function private.get_game_state() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();s uuid;l uuid;v public.users;settings public.user_settings;result jsonb;begin
 s:=private.ensure_season();select * into v from public.users where id=u;if v.id is null then return null;end if;
 select * into settings from public.user_settings where user_id=u;select league_id into l from public.league_memberships where user_id=u and season_id=s;
 select jsonb_build_object('id',u,'nickname',v.nickname,'avatar',v.avatar,'balance',v.life_balance,'weekly_score',coalesce((select weekly_score from public.leaderboard_entries where user_id=u and season_id=s),0),'calm',settings.calm,'soft',settings.soft,'pvp',settings.pvp,'season_end',(select ends_at from public.seasons where id=s),'league_name','Ligue · Division '||(select division from public.leagues where id=l),
 'community_enabled',true,'social_settings',jsonb_build_object('share_activity',settings.share_activity,'notify_friends',settings.notify_friends,'notify_duels',settings.notify_duels),
 'catalog',coalesce((select jsonb_agg(to_jsonb(c) order by kind,id) from public.action_catalog c where active),'[]'),
 'actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from(select id,catalog_id,label,kind,quantity,minutes_impact,created_at,idempotency_key from public.actions where user_id=u order by created_at desc limit 100)a),'[]'),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',e.user_id,'nickname',e.nickname,'avatar',e.avatar,'weekly_score',e.weekly_score) order by weekly_score desc,user_id) from public.leaderboard_entries e where league_id=l),'[]'),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'avatar',p.avatar,'status',f.status,'incoming',f.recipient=u)) from public.friendships f join public.users p on p.id=case when f.requester=u then f.recipient else f.requester end where (f.requester=u or f.recipient=u) and not private.is_blocked(u,p.id)),'[]'),
 'nemesis',(select jsonb_build_object('id',e.user_id,'nickname',e.nickname,'avatar',e.avatar,'weekly_score',e.weekly_score) from public.nemesis_pairs n join public.leaderboard_entries e on e.user_id=case when n.user_a=u then n.user_b else n.user_a end and e.season_id=n.season_id where n.season_id=s and(u=n.user_a or u=n.user_b) limit 1),
 'trophies',coalesce((select jsonb_agg(code) from public.trophies where user_id=u),'[]'),
 'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from(select id,message,created_at,read_at,kind,actor_id,target_tab,event_key from public.notifications where user_id=u order by created_at desc limit 50)n),'[]')) into result;return result;end$$;

-- Accès strictement énuméré. Aucun nouveau helper trigger accessible aux clients.
revoke execute on function private.reserve_social_notification_event() from public,anon,authenticated;
revoke execute on function private.reject_community_catalog_edit() from public,anon,authenticated;
revoke execute on function private.cleanup_social_settings() from public,anon,authenticated;
revoke execute on function private.cleanup_social_block() from public,anon,authenticated;
revoke execute on function private.emit_duel_notifications(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function private.notify_duel_start() from public,anon,authenticated;
revoke execute on function private.notify_action_social() from public,anon,authenticated;
revoke execute on function private.notify_duel_end() from public,anon,authenticated;
revoke execute on function private.create_catalog_action(text,text,text,integer,integer,uuid) from public,anon,authenticated;
revoke execute on function public.create_catalog_action(text,text,text,integer,integer,uuid) from public,anon,authenticated;
revoke execute on function private.update_notification_settings(boolean,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.update_notification_settings(boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function private.create_catalog_action(text,text,text,integer,integer,uuid) to authenticated;
grant execute on function public.create_catalog_action(text,text,text,integer,integer,uuid) to authenticated;
grant execute on function private.update_notification_settings(boolean,boolean,boolean) to authenticated;
grant execute on function public.update_notification_settings(boolean,boolean,boolean) to authenticated;
revoke execute on function private.read_notification(uuid) from public,anon,authenticated;
revoke execute on function public.read_notification(uuid) from public,anon,authenticated;
grant execute on function private.read_notification(uuid) to authenticated;
grant execute on function public.read_notification(uuid) to authenticated;
-- CREATE OR REPLACE conserve les ACL des RPC V1 record_action/get_game_state.

-- Les lectures restent protégées par catalogue_read. Aucun privilège de mutation.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='action_catalog')
 then alter publication supabase_realtime add table public.action_catalog;end if;
end$$;
commit;
