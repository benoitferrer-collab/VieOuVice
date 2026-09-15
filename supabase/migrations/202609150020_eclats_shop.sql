-- Apply once after 001–019, as database owner. XP remains untouched.
begin;
select pg_advisory_xact_lock(738291);
create table private.cosmetic_shop (
 id text primary key,slot text not null check(slot in('title','accessory','background')),
 price integer not null check(price>0)
);
insert into private.cosmetic_shop values
 ('cosmic_traveler','title',25),('forest_spirit','title',25),('neighborhood_star','title',50),
 ('friendly_star','accessory',50),('lunar_crown','accessory',75),('light_satellites','accessory',100),
 ('astral_mist','background',50),('firefly_garden','background',100),('cosmic_portal','background',150);
create table private.eclats_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 amount integer not null, xp_milestone bigint, item_id text references private.cosmetic_shop(id),
 created_at timestamptz not null default clock_timestamp(),
 check((xp_milestone is not null and xp_milestone>0 and amount=25 and item_id is null)
 or (xp_milestone is null and item_id is not null and amount<0)),
 unique(user_id,xp_milestone),unique(user_id,item_id)
);
create table private.cosmetic_possessions (
 user_id uuid not null references public.users(id) on delete cascade,
 item_id text not null references private.cosmetic_shop(id),
 acquired_at timestamptz not null default clock_timestamp(),primary key(user_id,item_id)
);
-- Cascades execute while migration 016's authenticated purge context is alive.
create trigger eclats_ledger_immutable before update or delete on private.eclats_ledger for each row execute function private.reject_edit();
create trigger cosmetic_possessions_immutable before update or delete on private.cosmetic_possessions for each row execute function private.reject_edit();
create function private.sync_eclats(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$declare milestones bigint;begin
 perform pg_advisory_xact_lock(738291);
 select coalesce(sum(xp),0)/50 into milestones from private.xp_awards where user_id=p_user;
 insert into private.eclats_ledger(user_id,amount,xp_milestone)
 select p_user,25,n from generate_series(1::bigint,milestones)n on conflict(user_id,xp_milestone) do nothing;
end$$;
create function private.eclats_wallet(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('balance',coalesce(sum(amount),0),
 'earned',coalesce(sum(amount) filter(where amount>0),0),
 'spent',-coalesce(sum(amount) filter(where amount<0),0)) from private.eclats_ledger where user_id=p_user
$$;
alter function private.cosmetic_inventory(uuid) rename to cosmetic_inventory_before_shop;
create function private.cosmetic_inventory(p_user uuid) returns table(id text,slot text,unlocked boolean,price integer)
language sql stable security definer set search_path='' as $$
 select i.id,i.slot,i.unlocked,null::integer from private.cosmetic_inventory_before_shop(p_user)i
 union all select s.id,s.slot,exists(select 1 from private.cosmetic_possessions p where p.user_id=p_user and p.item_id=s.id),s.price from private.cosmetic_shop s
$$;
alter table private.equipped_cosmetics drop constraint equipped_cosmetics_accessory_check,
 drop constraint equipped_cosmetics_title_check,drop constraint equipped_cosmetics_background_check;
alter table private.equipped_cosmetics add check(accessory in('leaf_pin','halo','laurel','friendly_star','lunar_crown','light_satellites')),
 add check(title in('encore_debout','pas_apres_pas','arena','cosmic_traveler','forest_spirit','neighborhood_star')),
 add check(background in('aurora','constellation','golden','astral_mist','firefly_garden','cosmic_portal'));
alter function private.get_progression() rename to get_progression_before_shop;
create function private.get_progression() returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();result jsonb;begin
 result:=private.get_progression_before_shop();
 perform private.sync_eclats(u);
 return result||jsonb_build_object('wallet',private.eclats_wallet(u),
 'inventory',(select jsonb_agg(to_jsonb(i) order by i.slot,i.id) from private.cosmetic_inventory(u)i));
end$$;
create or replace function public.get_progression() returns jsonb language sql security invoker set search_path='' as $$select private.get_progression()$$;
create function private.buy_cosmetic(p_item_id text) returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();cost integer;begin
 -- assert_user shares lock 738291 with progression, suspension and account deletion.
 if not exists(select 1 from public.users where id=u) then raise exception 'Profil requis.';end if;
 select price into cost from private.cosmetic_shop where id=p_item_id;
 if not found then raise exception 'Objet inconnu.';end if;
 perform private.close_due_competitions();perform private.settle_progression(u);perform private.sync_eclats(u);
 if exists(select 1 from private.cosmetic_possessions where user_id=u and item_id=p_item_id) then return private.eclats_wallet(u);end if;
 if (private.eclats_wallet(u)->>'balance')::bigint<cost then raise exception 'Éclats insuffisants.';end if;
 insert into private.eclats_ledger(user_id,amount,item_id) values(u,-cost,p_item_id);
 insert into private.cosmetic_possessions(user_id,item_id) values(u,p_item_id);
 return private.eclats_wallet(u);
end$$;
create function public.buy_cosmetic(p_item_id text) returns jsonb language sql security invoker set search_path='' as $$select private.buy_cosmetic(p_item_id)$$;
alter function private.export_my_data() rename to export_my_data_before_shop;
create function private.export_my_data() returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform private.settle_progression(u);perform private.sync_eclats(u);
 return private.export_my_data_before_shop()||jsonb_build_object('wallet',private.eclats_wallet(u),
 'eclats_ledger',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at,l.id) from private.eclats_ledger l where user_id=u),'[]'::jsonb),
 'cosmetic_possessions',coalesce((select jsonb_agg(to_jsonb(p) order by p.acquired_at,p.item_id) from private.cosmetic_possessions p where user_id=u),'[]'::jsonb));
end$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
do $$declare t text;f record;begin
 foreach t in array array['cosmetic_shop','eclats_ledger','cosmetic_possessions'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and p.proname=any(array['sync_eclats','eclats_wallet','cosmetic_inventory','cosmetic_inventory_before_shop','get_progression','get_progression_before_shop','buy_cosmetic','export_my_data','export_my_data_before_shop']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('get_progression','buy_cosmetic','export_my_data') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end$$;
commit;
