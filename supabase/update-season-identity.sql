-- Automatic, non-personal season identity. One AI allowance per season.
begin;
select pg_advisory_xact_lock(738291);
create table private.season_identities(
 season_id uuid primary key references public.seasons(id),
 lease_token uuid not null,
 lease_until timestamptz not null,
 fallback_only boolean not null default false,
 identity jsonb,
 source text check(source in('ai','fallback')),
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 check((identity is null and source is null and completed_at is null) or (identity is not null and source is not null and completed_at is not null))
);
alter table private.season_identities enable row level security;
revoke all on private.season_identities from public,anon,authenticated,service_role;

create function private.valid_season_identity_name(p_name jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p_name)='string' and length(p_name#>>'{}') between 3 and 60
 and (p_name#>>'{}')=btrim(p_name#>>'{}')
 and (p_name#>>'{}') ~ '^[A-Za-zÀ-ÖØ-öø-ÿŒœ ''’−–—-]+$'
 and (p_name#>>'{}') !~* '(https?|www|guéri|gueri|médic|medic|thérap|therap|diagnos|cancer|diabèt|diabet)',false)
$$;
create function private.valid_season_identity(p_identity jsonb) returns boolean
language plpgsql immutable set search_path='' as $$declare d jsonb;begin
 if p_identity is null or jsonb_typeof(p_identity)<>'object' then return false;end if;
 if not(p_identity ?& array['season_name','divisions']) or p_identity-array['season_name','divisions']<>'{}'::jsonb or not private.valid_season_identity_name(p_identity->'season_name') then return false;end if;
 if jsonb_typeof(p_identity->'divisions')<>'array' then return false;end if;
 if jsonb_array_length(p_identity->'divisions')<>5 then return false;end if;
 if (select count(distinct lower(value->>'name')) from jsonb_array_elements(p_identity->'divisions'))<>5 then return false;end if;
 for d in select value from jsonb_array_elements(p_identity->'divisions') loop
  if jsonb_typeof(d)<>'object' then return false;end if;
  if not(d ?& array['name','icon','color','shape']) or d-array['name','icon','color','shape']<>'{}'::jsonb or not private.valid_season_identity_name(d->'name') then return false;end if;
  if not coalesce(d->>'icon'=any(array['star','flame','leaf','moon','crown']) and d->>'color'=any(array['gold','mint','violet','coral','sky']) and d->>'shape'=any(array['shield','circle','hexagon']),false) then return false;end if;
 end loop;
 return true;
end$$;
alter table private.season_identities add constraint season_identity_recipe check(identity is null or private.valid_season_identity(identity));

create function public.claim_season_identity() returns jsonb
language plpgsql security definer set search_path='' as $$
declare s uuid;t timestamptz;r private.season_identities;fresh boolean:=false;begin
 perform pg_advisory_xact_lock(738291);t:=clock_timestamp();s:=private.ensure_season(t);
 -- Guard even against a manually inserted future season.
 if not exists(select 1 from public.seasons where id=s and starts_at<=t and ends_at>t and closed_at is null) then return null;end if;
 select * into r from private.season_identities where season_id=s for update;
 if not found then
  insert into private.season_identities(season_id,lease_token,lease_until) values(s,gen_random_uuid(),clock_timestamp()+interval '90 seconds') returning * into r;
  fresh:=true;
 elsif r.identity is not null or r.lease_until>clock_timestamp() then return null;
 else
  update private.season_identities set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',fallback_only=true where season_id=s returning * into r;
 end if;
 return jsonb_build_object('season_id',s,'starts_at',(select starts_at from public.seasons where id=s),'lease_token',r.lease_token,'generate',fresh);
end$$;
create function public.finish_season_identity(p_season_id uuid,p_lease_token uuid,p_identity jsonb,p_source text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r private.season_identities;t timestamptz;begin
 perform pg_advisory_xact_lock(738291);t:=clock_timestamp();
 select * into r from private.season_identities where season_id=p_season_id for update;
 if not found or r.identity is not null or r.lease_token is distinct from p_lease_token or r.lease_until<=t then return false;end if;
 if not exists(select 1 from public.seasons where id=p_season_id and starts_at<=t and ends_at>t and closed_at is null) then return false;end if;
 if p_source is null or p_source not in('ai','fallback') or (r.fallback_only and p_source<>'fallback') or not private.valid_season_identity(p_identity) then raise exception 'Identité de saison invalide.';end if;
 update private.season_identities set identity=p_identity,source=p_source,completed_at=clock_timestamp() where season_id=p_season_id;
 return true;
end$$;
create function public.admin_season_identity() returns jsonb
language plpgsql security definer set search_path='' as $$declare s uuid;begin
 perform private.assert_admin();
 select id into s from public.seasons where starts_at<=clock_timestamp() and ends_at>clock_timestamp() and closed_at is null order by starts_at desc limit 1;
 return (select jsonb_build_object('season_id',s,'starts_at',se.starts_at,'status',case when i.identity is not null then 'ready' when i.season_id is null then 'pending' when i.lease_until<=clock_timestamp() then 'awaiting_fallback' else 'generating' end,'identity',i.identity,'source',i.source) from public.seasons se left join private.season_identities i on i.season_id=se.id where se.id=s);
end$$;

alter function private.get_game_state() rename to get_game_state_before_season_identity;
revoke all on function private.get_game_state_before_season_identity() from public,anon,authenticated,service_role;
create function private.get_game_state() returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();r jsonb;i jsonb;begin
 r:=private.get_game_state_before_season_identity();if r is null then return null;end if;
 select jsonb_build_object('season_name',si.identity->>'season_name','league_name',si.identity->'divisions'->(l.division-1)->>'name','emblem',(si.identity->'divisions'->(l.division-1))-'name','source',si.source) into i
 from private.season_identities si join public.seasons s on s.id=si.season_id join public.league_memberships m on m.season_id=s.id and m.user_id=u join public.leagues l on l.id=m.league_id
 where si.identity is not null and s.starts_at<=clock_timestamp() and s.ends_at>clock_timestamp() and s.closed_at is null order by s.starts_at desc limit 1;
 return r||jsonb_build_object('season_identity',i);
end$$;
create or replace function public.get_game_state() returns jsonb language sql security invoker set search_path='' as $$select private.get_game_state()$$;
revoke all on function private.valid_season_identity_name(jsonb),private.valid_season_identity(jsonb),public.claim_season_identity(),public.finish_season_identity(uuid,uuid,jsonb,text),public.admin_season_identity(),private.get_game_state(),public.get_game_state() from public,anon,authenticated,service_role;
grant execute on function public.claim_season_identity(),public.finish_season_identity(uuid,uuid,jsonb,text) to service_role;
grant execute on function public.admin_season_identity(),private.get_game_state(),public.get_game_state() to authenticated;
commit;
