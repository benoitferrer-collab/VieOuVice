-- Excès-O-Meter / installation V1, projet Supabase vierge uniquement.
-- Transaction atomique. Une réexécution échoue sans supprimer aucune donnée.
begin;
create schema private;
revoke all on schema private from public, anon, authenticated;
create table public.users(id uuid primary key references auth.users(id) on delete restrict, nickname text not null check(nickname ~ '^[[:alnum:]_-]{3,20}$'), avatar smallint not null default 0 check(avatar between 0 and 3),life_balance integer not null default 0,created_at timestamptz not null default now());
create unique index users_nickname_lower on public.users(lower(nickname));
create table public.user_settings(user_id uuid primary key references public.users on delete cascade,calm boolean not null default false,soft boolean not null default false,pvp boolean not null default false);
create table public.action_catalog(id text primary key,label text not null,kind text not null check(kind in ('health','excess')),unit text not null,max_quantity integer not null check(max_quantity between 1 and 1000),coefficient integer not null,daily_cap integer not null default 0,icon text not null,version integer not null default 1,active boolean not null default true,check((kind='health' and coefficient>0 and daily_cap>0) or (kind='excess' and coefficient<0 and daily_cap=0)));
create table public.seasons(id uuid primary key default gen_random_uuid(),starts_at timestamptz not null unique,ends_at timestamptz not null,closed_at timestamptz,check(ends_at>starts_at));
create table public.leagues(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons,division integer not null default 1 check(division between 1 and 5));
create index leagues_season on public.leagues(season_id);
create table public.league_memberships(user_id uuid not null references public.users,season_id uuid not null references public.seasons,league_id uuid not null references public.leagues,final_rank integer,primary key(user_id,season_id));
create index memberships_league on public.league_memberships(league_id);
create table public.leaderboard_entries(user_id uuid not null references public.users,season_id uuid not null references public.seasons,league_id uuid not null references public.leagues,nickname text not null,avatar smallint not null,weekly_score integer not null default 0,primary key(user_id,season_id));
create index leaderboard_league_score on public.leaderboard_entries(league_id,weekly_score desc,user_id);
create table public.actions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users,catalog_id text not null references public.action_catalog,label text not null,kind text not null check(kind in('health','excess')),quantity integer not null check(quantity between 1 and 1000),minutes_impact integer not null,tariff_version integer not null,season_id uuid not null references public.seasons,created_at timestamptz not null default clock_timestamp(),idempotency_key uuid not null,unique(user_id,idempotency_key));
create index actions_user_time on public.actions(user_id,created_at desc);
create index actions_catalog on public.actions(catalog_id);
create index actions_season on public.actions(season_id);
create table private.life_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users,life_delta integer not null,league_delta integer not null default 0,reason text not null,source_id uuid not null,season_id uuid references public.seasons,event_key text not null unique,created_at timestamptz not null default clock_timestamp(),check(league_delta=0 or season_id is not null));
create index ledger_user on private.life_ledger(user_id,created_at);
create table public.friendships(requester uuid not null references public.users,recipient uuid not null references public.users,status text not null default 'pending' check(status in('pending','accepted')),created_at timestamptz not null default clock_timestamp(),primary key(requester,recipient),check(requester<>recipient));
create unique index friendships_pair on public.friendships(least(requester,recipient),greatest(requester,recipient));
create index friendships_recipient on public.friendships(recipient);
create table public.blocks(blocker uuid not null references public.users,blocked uuid not null references public.users,created_at timestamptz not null default clock_timestamp(),primary key(blocker,blocked),check(blocker<>blocked));
create index blocks_blocked on public.blocks(blocked);
create table public.life_transfers(id uuid primary key default gen_random_uuid(),donor uuid not null references public.users,recipient uuid not null references public.users,amount integer not null check(amount between 1 and 100),idempotency_key uuid not null,created_at timestamptz not null default clock_timestamp(),check(donor<>recipient),unique(donor,idempotency_key));
create index transfers_donor_time on public.life_transfers(donor,created_at);
create index transfers_recipient on public.life_transfers(recipient);
create table public.nemesis_pairs(season_id uuid not null references public.seasons,user_a uuid not null references public.users,user_b uuid not null references public.users,primary key(season_id,user_a),unique(season_id,user_b),check(user_a<user_b));
create index nemesis_b on public.nemesis_pairs(user_b,season_id);
create table public.trophy_definitions(code text primary key,label text not null,description text not null,version integer not null default 1);
create table public.trophies(user_id uuid not null references public.users,code text not null references public.trophy_definitions,source_id uuid not null,awarded_at timestamptz not null default clock_timestamp(),primary key(user_id,code));
create index trophies_code on public.trophies(code);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.users,message text not null,created_at timestamptz not null default clock_timestamp(),read_at timestamptz);
create index notifications_user on public.notifications(user_id,created_at desc);
create table private.daily_limits(user_id uuid not null references public.users,operation text not null,local_day date not null,used integer not null check(used>0),primary key(user_id,operation,local_day));
create table private.job_runs(season_id uuid primary key references public.seasons,finished_at timestamptz not null default clock_timestamp());

create function private.assert_user() returns uuid language plpgsql security invoker set search_path='' as $$ begin if auth.uid() is null then raise exception 'Authentification requise.';end if;return auth.uid();end $$;
create function private.day_start(p_now timestamptz) returns timestamptz language sql immutable set search_path='' as $$select date_trunc('day',p_now at time zone 'Europe/Paris') at time zone 'Europe/Paris'$$;
create function private.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.blocks where (blocker=a and blocked=b) or (blocker=b and blocked=a))$$;
create function private.own_league(p_league uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.league_memberships where user_id=auth.uid() and league_id=p_league)$$;
create function private.reject_edit() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Journal immuable : utilisez un événement inverse autorisé.';end$$;
create trigger ledger_immutable before update or delete on private.life_ledger for each row execute function private.reject_edit();
create trigger actions_immutable before update or delete on public.actions for each row execute function private.reject_edit();
create function private.apply_ledger() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.users set life_balance=life_balance+new.life_delta where id=new.user_id;
 if new.league_delta<>0 then update public.leaderboard_entries set weekly_score=weekly_score+new.league_delta where user_id=new.user_id and season_id=new.season_id;if not found then raise exception 'Appartenance de saison absente.';end if;end if;
 return new;end$$;
create trigger ledger_apply after insert on private.life_ledger for each row execute function private.apply_ledger();
create function private.action_ledger() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into private.life_ledger(user_id,life_delta,league_delta,reason,source_id,season_id,event_key) values(new.user_id,new.minutes_impact,new.minutes_impact,'action',new.id,new.season_id,'action:'||new.id);
 insert into public.notifications(user_id,message) values(new.user_id,'Un nouveau mouvement a été confirmé dans ta partie.');
 insert into public.trophies(user_id,code,source_id) values(new.user_id,'first-step',new.id) on conflict do nothing;
 return new;end$$;
create trigger action_to_ledger after insert on public.actions for each row execute function private.action_ledger();

create function private.assign_league(p_user uuid,p_season uuid,p_division integer) returns void language plpgsql security definer set search_path='' as $$declare v_league uuid;begin
 if exists(select 1 from public.league_memberships where user_id=p_user and season_id=p_season) then return;end if;
 select l.id into v_league from public.leagues l where l.season_id=p_season and l.division=p_division and (select count(*) from public.league_memberships m where m.league_id=l.id)<30 order by l.id limit 1;
 if v_league is null then insert into public.leagues(season_id,division) values(p_season,p_division) returning id into v_league;end if;
 insert into public.league_memberships(user_id,season_id,league_id) values(p_user,p_season,v_league);
 insert into public.leaderboard_entries(user_id,season_id,league_id,nickname,avatar) select id,p_season,v_league,nickname,avatar from public.users where id=p_user;
end$$;
create function private.pair_nemeses(p_season uuid) returns void language plpgsql security definer set search_path='' as $$declare a record;b uuid;begin
 for a in select e.* from public.leaderboard_entries e join public.user_settings s on s.user_id=e.user_id where e.season_id=p_season and s.pvp order by e.user_id loop
 if exists(select 1 from public.nemesis_pairs where season_id=p_season and (user_a=a.user_id or user_b=a.user_id)) then continue;end if;
 select e.user_id into b from public.leaderboard_entries e join public.user_settings s on s.user_id=e.user_id where e.season_id=p_season and e.league_id=a.league_id and s.pvp and e.user_id<>a.user_id and not private.is_blocked(a.user_id,e.user_id) and not exists(select 1 from public.nemesis_pairs n where n.season_id=p_season and (n.user_a=e.user_id or n.user_b=e.user_id))
 order by exists(select 1 from public.nemesis_pairs n where n.season_id<>p_season and n.user_a=least(a.user_id,e.user_id) and n.user_b=greatest(a.user_id,e.user_id)),abs(coalesce((select x.weekly_score from public.leaderboard_entries x join public.seasons s2 on s2.id=x.season_id where x.user_id=e.user_id and s2.closed_at is not null order by s2.starts_at desc limit 1),0)-coalesce((select x.weekly_score from public.leaderboard_entries x join public.seasons s2 on s2.id=x.season_id where x.user_id=a.user_id and s2.closed_at is not null order by s2.starts_at desc limit 1),0)),e.user_id limit 1;
 if b is not null then insert into public.nemesis_pairs values(p_season,least(a.user_id,b),greatest(a.user_id,b));end if;
 end loop;end$$;
create function private.ensure_season(p_at timestamptz default clock_timestamp()) returns uuid language plpgsql security definer set search_path='' as $$declare v_now timestamptz;v_start timestamptz;s public.seasons;v_next uuid;r record;begin
 perform pg_advisory_xact_lock(738291);
 v_now:=p_at;v_start:=date_trunc('week',v_now at time zone 'Europe/Paris') at time zone 'Europe/Paris';
 select * into s from public.seasons order by starts_at desc limit 1;
 if s.id is null then insert into public.seasons(starts_at,ends_at) values(v_start,((v_start at time zone 'Europe/Paris')+interval '7 days') at time zone 'Europe/Paris') returning id into v_next;return v_next;end if;
 while s.ends_at<=v_now loop
 insert into public.seasons(starts_at,ends_at) values(s.ends_at,((s.ends_at at time zone 'Europe/Paris')+interval '7 days') at time zone 'Europe/Paris') returning id into v_next;
 for r in select e.user_id,l.division,row_number() over(partition by e.league_id order by e.weekly_score desc,e.user_id)::integer as rank,count(*) over(partition by e.league_id)::integer as total from public.leaderboard_entries e join public.leagues l on l.id=e.league_id where e.season_id=s.id loop
 update public.league_memberships set final_rank=r.rank where user_id=r.user_id and season_id=s.id;
 perform private.assign_league(r.user_id,v_next,greatest(1,least(5,r.division+case when r.rank<=floor(r.total/6.0) then 1 when r.rank>r.total-floor(r.total/6.0) then -1 else 0 end)));
 insert into public.notifications(user_id,message) values(r.user_id,'Une nouvelle saison commence. Retrouve ton classement dans le jeu.');
 end loop;
 update public.seasons set closed_at=clock_timestamp() where id=s.id;
 insert into private.job_runs(season_id) values(s.id) on conflict do nothing;
 perform private.pair_nemeses(v_next);
 select * into s from public.seasons where id=v_next;
 end loop;return s.id;end$$;

create function private.create_profile(p_nickname text,p_avatar integer) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();s uuid;begin
 if p_nickname is null or p_nickname!~'^[[:alnum:]_-]{3,20}$' or p_avatar is null or p_avatar not between 0 and 3 then raise exception 'Pseudonyme ou avatar invalide.';end if;
 s:=private.ensure_season();if exists(select 1 from public.users where id=u) then return;end if;
 begin insert into public.users(id,nickname,avatar) values(u,p_nickname,p_avatar);exception when unique_violation then raise exception 'Ce pseudonyme est déjà utilisé.';end;
 insert into public.user_settings(user_id) values(u);
 perform private.assign_league(u,s,1);
 insert into private.life_ledger(user_id,life_delta,reason,source_id,event_key) values(u,500,'welcome',u,'welcome:'||u);
 insert into public.notifications(user_id,message) values(u,'Bienvenue dans la partie. 500 minutes de vie t’attendent.');
end$$;
create function private.record_action(p_catalog_id text,p_quantity integer,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();s uuid;c public.action_catalog;a public.actions;v_now timestamptz;used integer;impact integer;begin
 perform pg_advisory_xact_lock(738291);v_now:=clock_timestamp();s:=private.ensure_season(v_now);perform 1 from public.users where id=u for update;if not found then raise exception 'Profil requis.';end if;
 if p_idempotency_key is null then raise exception 'Clé requise.';end if;
 select * into a from public.actions where user_id=u and idempotency_key=p_idempotency_key;
 if a.id is not null then if a.catalog_id is distinct from p_catalog_id or a.quantity is distinct from p_quantity then raise exception 'Clé réutilisée avec un contenu différent.';end if;return to_jsonb(a);end if;
 select * into c from public.action_catalog where id=p_catalog_id and active;
 if c.id is null or p_quantity is null or p_quantity<1 or p_quantity>c.max_quantity then raise exception 'Quantité non autorisée.';end if;
 if (select count(*) from public.actions where user_id=u and created_at>=private.day_start(v_now))>=100 then raise exception 'Limite quotidienne de déclarations atteinte.';end if;
 if (select count(*) from public.actions where user_id=u and created_at>v_now-interval '1 minute')>=10 then raise exception 'Trop de déclarations. Patiente une minute.';end if;
 impact:=c.coefficient*p_quantity;
 if c.kind='health' then select coalesce(sum(greatest(minutes_impact,0)),0) into used from public.actions where user_id=u and catalog_id=c.id and created_at>=private.day_start(v_now);impact:=greatest(0,least(impact,c.daily_cap-used));end if;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values(u,c.id,c.label,c.kind,p_quantity,impact,c.version,s,v_now,p_idempotency_key) returning * into a;
 return to_jsonb(a);end$$;
create function private.invite_friend(p_nickname text) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();v uuid;v_count integer;begin
 perform pg_advisory_xact_lock(738291);select id into v from public.users where lower(nickname)=lower(p_nickname);
 if v is null or v=u or private.is_blocked(u,v) then raise exception 'Invitation impossible pour ce pseudonyme.';end if;
 if exists(select 1 from public.friendships where least(requester,recipient)=least(u,v) and greatest(requester,recipient)=greatest(u,v)) then return;end if;
 insert into private.daily_limits(user_id,operation,local_day,used) values(u,'invite',(clock_timestamp() at time zone 'Europe/Paris')::date,1) on conflict(user_id,operation,local_day) do update set used=private.daily_limits.used+1 where private.daily_limits.used<20 returning used into v_count;
 if v_count is null then raise exception 'Limite quotidienne d’invitations atteinte.';end if;
 insert into public.friendships(requester,recipient) values(u,v);
 insert into public.notifications(user_id,message) values(v,'Une invitation t’attend dans ton cercle.');end$$;
create function private.respond_friend(p_friend_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform pg_advisory_xact_lock(738291);if private.is_blocked(u,p_friend_id) then raise exception 'Interaction indisponible.';end if;
 if p_accept then update public.friendships set status='accepted' where requester=p_friend_id and recipient=u;else delete from public.friendships where requester=p_friend_id and recipient=u and status='pending';end if;end$$;
create function private.transfer_life(p_recipient uuid,p_amount integer,p_idempotency_key uuid) returns uuid language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();t public.life_transfers;balance integer;born timestamptz;begin
 perform pg_advisory_xact_lock(738291);
 if p_idempotency_key is null then raise exception 'Clé requise.';end if;
 select * into t from public.life_transfers where donor=u and idempotency_key=p_idempotency_key;
 if t.id is not null then if t.recipient is distinct from p_recipient or t.amount is distinct from p_amount then raise exception 'Clé réutilisée avec un contenu différent.';end if;return t.id;end if;
 if p_amount is null or p_amount not between 1 and 100 or p_recipient=u then raise exception 'Montant non autorisé.';end if;
 perform 1 from public.users where id in(u,p_recipient) order by id for update;
 select life_balance,created_at into balance,born from public.users where id=u;
 if balance is null or balance-p_amount<1 then raise exception 'Garde au moins une minute.';end if;
 if born>clock_timestamp()-interval '24 hours' then raise exception 'Ton compte doit avoir au moins 24 heures.';end if;
 if not exists(select 1 from public.friendships where status='accepted' and least(requester,recipient)=least(u,p_recipient) and greatest(requester,recipient)=greatest(u,p_recipient)) or private.is_blocked(u,p_recipient) then raise exception 'Amitié acceptée requise.';end if;
 if (select coalesce(sum(amount),0) from public.life_transfers where donor=u and created_at>=private.day_start(clock_timestamp()))+p_amount>200 then raise exception 'Plafond quotidien de dons atteint.';end if;
 insert into public.life_transfers(donor,recipient,amount,idempotency_key) values(u,p_recipient,p_amount,p_idempotency_key) returning * into t;
 insert into private.life_ledger(user_id,life_delta,reason,source_id,event_key) values(u,-p_amount,'donation_sent',t.id,'donation:debit:'||t.id),(p_recipient,p_amount,'donation_received',t.id,'donation:credit:'||t.id);
 insert into public.notifications(user_id,message) values(p_recipient,'Un ami t’a envoyé un coup de pouce.');return t.id;end$$;
create function private.block_user(p_nickname text) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();v uuid;begin
 perform pg_advisory_xact_lock(738291);select id into v from public.users where lower(nickname)=lower(p_nickname);
 if v is null or v=u then raise exception 'Ce joueur ne peut pas être bloqué.';end if;
 insert into public.blocks(blocker,blocked) values(u,v) on conflict do nothing;
 delete from public.friendships where least(requester,recipient)=least(u,v) and greatest(requester,recipient)=greatest(u,v);
 delete from public.nemesis_pairs n using public.seasons s where n.season_id=s.id and s.closed_at is null and n.user_a=least(u,v) and n.user_b=greatest(u,v);end$$;
create function private.update_settings(p_calm boolean,p_soft boolean,p_pvp boolean) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform pg_advisory_xact_lock(738291);update public.user_settings set calm=p_calm,soft=p_soft,pvp=p_pvp where user_id=u;
 if not p_pvp then delete from public.nemesis_pairs n using public.seasons s where n.season_id=s.id and s.closed_at is null and (n.user_a=u or n.user_b=u);end if;end$$;
create function private.read_notifications() returns void language plpgsql security definer set search_path='' as $$begin update public.notifications set read_at=clock_timestamp() where user_id=private.assert_user() and read_at is null;end$$;
create function private.get_game_state() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();s uuid;l uuid;v public.users;settings public.user_settings;result jsonb;begin
 s:=private.ensure_season();select * into v from public.users where id=u;if v.id is null then return null;end if;
 select * into settings from public.user_settings where user_id=u;select league_id into l from public.league_memberships where user_id=u and season_id=s;
 select jsonb_build_object('id',u,'nickname',v.nickname,'avatar',v.avatar,'balance',v.life_balance,'weekly_score',coalesce((select weekly_score from public.leaderboard_entries where user_id=u and season_id=s),0),'calm',settings.calm,'soft',settings.soft,'pvp',settings.pvp,'season_end',(select ends_at from public.seasons where id=s),'league_name','Ligue · Division '||(select division from public.leagues where id=l),
 'catalog',coalesce((select jsonb_agg(to_jsonb(c) order by kind,id) from public.action_catalog c where active),'[]'),
 'actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from(select id,catalog_id,label,kind,quantity,minutes_impact,created_at,idempotency_key from public.actions where user_id=u order by created_at desc limit 100)a),'[]'),
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',e.user_id,'nickname',e.nickname,'avatar',e.avatar,'weekly_score',e.weekly_score) order by weekly_score desc,user_id) from public.leaderboard_entries e where league_id=l),'[]'),
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'avatar',p.avatar,'status',f.status,'incoming',f.recipient=u)) from public.friendships f join public.users p on p.id=case when f.requester=u then f.recipient else f.requester end where (f.requester=u or f.recipient=u) and not private.is_blocked(u,p.id)),'[]'),
 'nemesis',(select jsonb_build_object('id',e.user_id,'nickname',e.nickname,'avatar',e.avatar,'weekly_score',e.weekly_score) from public.nemesis_pairs n join public.leaderboard_entries e on e.user_id=case when n.user_a=u then n.user_b else n.user_a end and e.season_id=n.season_id where n.season_id=s and(u=n.user_a or u=n.user_b) limit 1),
 'trophies',coalesce((select jsonb_agg(code) from public.trophies where user_id=u),'[]'),
 'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from(select id,message,created_at,read_at from public.notifications where user_id=u order by created_at desc limit 50)n),'[]')) into result;return result;end$$;
create function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin return jsonb_build_object('exported_at',clock_timestamp(),'profile',(select to_jsonb(p) from public.users p where id=u),'settings',(select to_jsonb(s) from public.user_settings s where user_id=u),'actions',coalesce((select jsonb_agg(to_jsonb(a)) from public.actions a where user_id=u),'[]'),'ledger',coalesce((select jsonb_agg(to_jsonb(l)) from private.life_ledger l where user_id=u),'[]'),'friendships',coalesce((select jsonb_agg(to_jsonb(f)) from public.friendships f where requester=u or recipient=u),'[]'),'transfers',coalesce((select jsonb_agg(to_jsonb(t)) from public.life_transfers t where donor=u or recipient=u),'[]'),'trophies',coalesce((select jsonb_agg(to_jsonb(t)) from public.trophies t where user_id=u),'[]'),'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from public.notifications n where user_id=u),'[]'));end$$;

-- API invoker étroite. Les helpers privés non listés restent réservés au propriétaire.
create function public.create_profile(p_nickname text,p_avatar integer) returns void language sql security invoker set search_path='' as $$select private.create_profile(p_nickname,p_avatar)$$;
create function public.record_action(p_catalog_id text,p_quantity integer,p_idempotency_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.record_action(p_catalog_id,p_quantity,p_idempotency_key)$$;
create function public.get_game_state() returns jsonb language sql security invoker set search_path='' as $$select private.get_game_state()$$;
create function public.invite_friend(p_nickname text) returns void language sql security invoker set search_path='' as $$select private.invite_friend(p_nickname)$$;
create function public.respond_friend(p_friend_id uuid,p_accept boolean) returns void language sql security invoker set search_path='' as $$select private.respond_friend(p_friend_id,p_accept)$$;
create function public.transfer_life(p_recipient uuid,p_amount integer,p_idempotency_key uuid) returns uuid language sql security invoker set search_path='' as $$select private.transfer_life(p_recipient,p_amount,p_idempotency_key)$$;
create function public.block_user(p_nickname text) returns void language sql security invoker set search_path='' as $$select private.block_user(p_nickname)$$;
create function public.update_settings(p_calm boolean,p_soft boolean,p_pvp boolean) returns void language sql security invoker set search_path='' as $$select private.update_settings(p_calm,p_soft,p_pvp)$$;
create function public.read_notifications() returns void language sql security invoker set search_path='' as $$select private.read_notifications()$$;
create function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;

-- RLS et privilèges : aucune écriture directe depuis le navigateur.
do $$declare t text;begin foreach t in array array['users','user_settings','action_catalog','seasons','leagues','league_memberships','leaderboard_entries','actions','friendships','blocks','life_transfers','nemesis_pairs','trophy_definitions','trophies','notifications'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on table public.%I from public, anon, authenticated',t);execute format('grant select on table public.%I to authenticated',t);end loop;end$$;
create policy self_read on public.users for select to authenticated using(id=(select auth.uid()));
create policy self_read on public.user_settings for select to authenticated using(user_id=(select auth.uid()));
create policy catalogue_read on public.action_catalog for select to authenticated using(active);
create policy seasons_read on public.seasons for select to authenticated using(true);
create policy leagues_read on public.leagues for select to authenticated using(private.own_league(id));
create policy memberships_read on public.league_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy leaderboard_read on public.leaderboard_entries for select to authenticated using(private.own_league(league_id));
create policy actions_read on public.actions for select to authenticated using(user_id=(select auth.uid()));
create policy friendships_read on public.friendships for select to authenticated using(requester=(select auth.uid()) or recipient=(select auth.uid()));
create policy blocks_read on public.blocks for select to authenticated using(blocker=(select auth.uid()));
create policy transfers_read on public.life_transfers for select to authenticated using(donor=(select auth.uid()) or recipient=(select auth.uid()));
create policy nemesis_read on public.nemesis_pairs for select to authenticated using(user_a=(select auth.uid()) or user_b=(select auth.uid()));
create policy definitions_read on public.trophy_definitions for select to authenticated using(true);
create policy trophies_read on public.trophies for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
revoke all on all tables in schema private from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.own_league(uuid) to authenticated;
do $$declare n text;f record;begin foreach n in array array['create_profile','record_action','get_game_state','invite_friend','respond_friend','transfer_life','block_user','update_settings','read_notifications','export_my_data'] loop for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where p.proname=n and ns.nspname in('public','private') loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end loop;end$$;
alter default privileges in schema private revoke execute on functions from public;
commit;
