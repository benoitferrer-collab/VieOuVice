-- Mise à jour après install.sql déjà appliqué. Exécuter une seule fois dans SQL Editor.
-- Catalogue partagé + notifications sociales + infrastructure Web Push.
-- Aucune donnée de jeu supprimée ; aucune clé requise ici.
begin;
-- Source : 202609080002_community_notifications.sql
-- Excès-O-Meter V1 -> catalogue communautaire et notifications sociales.
-- Supabase SQL Editor, après 001 + seed. Transaction non destructive ; une seule application.
-- Les montants sont des valeurs fictives du jeu, sans signification médicale.

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

-- Source : 202609080003_web_push.sql
-- Apply after 202609080002_community_notifications.sql. No secrets in SQL.
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
