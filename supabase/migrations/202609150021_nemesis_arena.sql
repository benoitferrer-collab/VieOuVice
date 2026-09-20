-- Apply once after 001–020, as database owner. Combat never changes XP.
begin;
select pg_advisory_xact_lock(738291);
create table private.arena_duels(
 id uuid primary key default gen_random_uuid(),challenger_id uuid not null references public.users(id) on delete cascade,
 opponent_id uuid not null references public.users(id) on delete cascade,request_id uuid not null,
 status text not null default 'pending' check(status in('pending','active','finished','declined','expired','cancelled')),
 turn_user_id uuid,turn_number integer not null default 1 check(turn_number between 1 and 41),
 deadline timestamptz not null default clock_timestamp()+interval '24 hours',created_at timestamptz not null default clock_timestamp(),
 winner_id uuid,finish_reason text,reward integer not null default 0 check(reward in(0,10)),
 check(challenger_id<>opponent_id),check(turn_user_id is null or turn_user_id in(challenger_id,opponent_id)),
 check(winner_id is null or winner_id in(challenger_id,opponent_id)),unique(challenger_id,request_id)
);
create unique index arena_open_pair on private.arena_duels(least(challenger_id,opponent_id),greatest(challenger_id,opponent_id)) where status in('pending','active');
create index arena_challenger_history on private.arena_duels(challenger_id,created_at desc);
create index arena_opponent_history on private.arena_duels(opponent_id,created_at desc);
create index arena_deadline on private.arena_duels(deadline) where status in('pending','active');
create table private.arena_fighters(
 duel_id uuid not null references private.arena_duels(id) on delete cascade,user_id uuid not null references public.users(id) on delete cascade,
 nickname text not null,avatar smallint not null check(avatar between 0 and 3),
 hp integer not null default 100 check(hp between 0 and 100),energy integer not null default 2 check(energy between 0 and 4),guard boolean not null default false,
 primary key(duel_id,user_id)
);
create table private.arena_moves(
 duel_id uuid not null references private.arena_duels(id) on delete cascade,turn integer not null check(turn between 1 and 40),
 actor_id uuid not null references public.users(id) on delete cascade,move text not null check(move in('quick','heavy','guard','special')),
 damage integer not null check(damage>=0),healing integer not null check(healing>=0),created_at timestamptz not null default clock_timestamp(),primary key(duel_id,turn)
);
-- Deliberately no duel FK: an opponent's account purge removes history, but cannot
-- erase or mutate the remaining player's immutable wallet grant.
alter table private.eclats_ledger add column arena_duel_id uuid unique;
alter table private.eclats_ledger drop constraint eclats_ledger_check;
alter table private.eclats_ledger add constraint eclats_ledger_check check(
 (arena_duel_id is null and ((xp_milestone is not null and xp_milestone>0 and amount=25 and item_id is null) or (xp_milestone is null and item_id is not null and amount<0)))
 or (arena_duel_id is not null and xp_milestone is null and item_id is null and amount=10));
alter table public.notifications add column arena_duel_id uuid references private.arena_duels(id) on delete cascade;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in('system','friend_action','friend_accepted','duel_started','duel_lead','duel_finished','reaction_digest','friend_message','competition_started','competition_finished','activity_reminder','arena_invite','arena_turn','arena_finished'));
alter table public.notifications add constraint arena_notification_shape check((kind in('arena_invite','arena_turn','arena_finished'))=(arena_duel_id is not null));

create function private.arena_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select (to_jsonb(d)-'request_id')||jsonb_build_object('fighters',coalesce((select jsonb_agg(to_jsonb(f)-'duel_id' order by (f.user_id=d.challenger_id) desc) from private.arena_fighters f where f.duel_id=d.id),'[]'),
 'moves',coalesce((select jsonb_agg(to_jsonb(m)-'duel_id' order by m.turn) from private.arena_moves m where m.duel_id=d.id),'[]')) from private.arena_duels d where d.id=p_id
$$;
create function private.arena_notify(p_id uuid,p_target uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare d private.arena_duels;begin
 select * into d from private.arena_duels where id=p_id;
 if not private.message_pair_allowed(d.challenger_id,d.opponent_id) or not coalesce((select notify_duels from public.user_settings where user_id=p_target),false) then return;end if;
 insert into public.notifications(user_id,actor_id,message,kind,target_tab,event_key,arena_duel_id)
 values(p_target,case when p_target=d.challenger_id then d.opponent_id else d.challenger_id end,
 case p_kind when 'arena_invite' then 'Une invitation en arène t’attend.' when 'arena_turn' then 'À toi de jouer dans l’arène.' else 'Ton duel en arène est terminé.' end,
 p_kind,'nemesis',p_kind||':'||d.id||':'||p_target||':'||d.turn_number,d.id) on conflict do nothing;
end$$;
create function private.arena_finish(p_id uuid,p_winner uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare d private.arena_duels;credit integer:=0;begin
 perform pg_advisory_xact_lock(738291);
 select * into d from private.arena_duels where id=p_id for update;
 if d.status<>'active' then return;end if;
 if p_winner is not null and p_reason in('ko','turn_limit')
 and (select count(*) from private.arena_moves where duel_id=p_id and actor_id=d.challenger_id)>=3
 and (select count(*) from private.arena_moves where duel_id=p_id and actor_id=d.opponent_id)>=3
 and (select coalesce(sum(amount),0) from private.eclats_ledger where user_id=p_winner and arena_duel_id is not null and (created_at at time zone 'Europe/Paris')::date=(clock_timestamp() at time zone 'Europe/Paris')::date)<30 then
 insert into private.eclats_ledger(user_id,amount,arena_duel_id) values(p_winner,10,p_id) on conflict(arena_duel_id) do nothing;
 if found then credit:=10;end if;
 end if;
 update private.arena_duels set status='finished',turn_user_id=null,winner_id=p_winner,finish_reason=p_reason,reward=credit where id=p_id;
 perform private.arena_notify(p_id,d.challenger_id,'arena_finished');perform private.arena_notify(p_id,d.opponent_id,'arena_finished');
end$$;
create function private.arena_refresh(p_user uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare d private.arena_duels;begin
 perform pg_advisory_xact_lock(738291);
 for d in select * from private.arena_duels where status in('pending','active') and (p_user is null or p_user in(challenger_id,opponent_id)) order by id for update loop
 if not private.message_pair_allowed(d.challenger_id,d.opponent_id) then
 update private.arena_duels set status='cancelled',turn_user_id=null,finish_reason='unavailable' where id=d.id;
 elsif d.deadline<=clock_timestamp() then
 if d.status='pending' then update private.arena_duels set status='expired',finish_reason='timeout' where id=d.id;
 else perform private.arena_finish(d.id,case when d.turn_user_id=d.challenger_id then d.opponent_id else d.challenger_id end,'timeout');end if;
 end if;end loop;
end$$;
create function private.get_arena() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 perform private.arena_refresh(u);
 return jsonb_build_object('duels',coalesce((select jsonb_agg(private.arena_json(d.id) order by d.created_at desc,d.id) from(select id,created_at from private.arena_duels where u in(challenger_id,opponent_id) order by created_at desc,id limit 30)d),'[]'));
end$$;
create function private.get_arena_duel(p_duel_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 if not exists(select 1 from private.arena_duels where id=p_duel_id and u in(challenger_id,opponent_id)) then raise exception 'Duel indisponible.';end if;
 perform private.arena_refresh(u);return private.arena_json(p_duel_id);
end$$;
create function private.arena_invite(p_friend_id uuid,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();d private.arena_duels;begin
 if p_request_id is null or p_friend_id is null then raise exception 'Invitation invalide.';end if;
 perform private.arena_refresh(u);perform private.arena_refresh(p_friend_id);
 select * into d from private.arena_duels where challenger_id=u and request_id=p_request_id;
 if found then
 if d.opponent_id<>p_friend_id then raise exception 'Cette requête désigne une autre invitation.';end if;
 return private.arena_json(d.id);end if;
 if not private.message_pair_allowed(u,p_friend_id) then raise exception 'Ami indisponible.';end if;
 if exists(select 1 from private.arena_duels where status in('pending','active') and least(challenger_id,opponent_id)=least(u,p_friend_id) and greatest(challenger_id,opponent_id)=greatest(u,p_friend_id)) then raise exception 'Un duel est déjà ouvert.';end if;
 if (select count(*) from private.arena_duels where status in('pending','active') and u in(challenger_id,opponent_id))>=3 or (select count(*) from private.arena_duels where status in('pending','active') and p_friend_id in(challenger_id,opponent_id))>=3 then raise exception 'Trois duels ouverts maximum.';end if;
 if (select count(*) from private.arena_duels where challenger_id=u and (created_at at time zone 'Europe/Paris')::date=(clock_timestamp() at time zone 'Europe/Paris')::date)>=10 then raise exception 'Dix invitations par jour maximum.';end if;
 insert into private.arena_duels(challenger_id,opponent_id,request_id) values(u,p_friend_id,p_request_id) returning * into d;
 insert into private.arena_fighters(duel_id,user_id,nickname,avatar) select d.id,id,nickname,avatar from public.users where id in(u,p_friend_id);
 perform private.arena_notify(d.id,p_friend_id,'arena_invite');return private.arena_json(d.id);
end$$;
create function private.arena_respond(p_duel_id uuid,p_accept boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();d private.arena_duels;begin
 perform private.get_arena_duel(p_duel_id);select * into d from private.arena_duels where id=p_duel_id for update;
 if u<>d.opponent_id or p_accept is null then raise exception 'Réponse invalide.';end if;
 if (d.status='active' and p_accept) or (d.status='declined' and not p_accept) then return private.arena_json(d.id);end if;
 if d.status<>'pending' then return private.arena_json(d.id);end if;
 update private.arena_duels set status=case when p_accept then 'active' else 'declined' end,turn_user_id=case when p_accept then u else null end,deadline=clock_timestamp()+interval '24 hours' where id=d.id;
 if p_accept then perform private.arena_notify(d.id,u,'arena_turn');end if;
 return private.arena_json(d.id);
end$$;
create function private.arena_move(p_duel_id uuid,p_move text,p_expected_turn integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();d private.arena_duels;f private.arena_fighters;enemy private.arena_fighters;previous private.arena_moves;damage integer:=0;healing integer:=0;cost integer:=0;gain integer:=0;winner uuid;begin
 perform private.get_arena_duel(p_duel_id);select * into d from private.arena_duels where id=p_duel_id for update;
 if p_move is null or p_move not in('quick','heavy','guard','special') or p_expected_turn is null then raise exception 'Action invalide.';end if;
 select * into previous from private.arena_moves where duel_id=d.id and turn=p_expected_turn;
 if found then
 if previous.actor_id=u and previous.move=p_move then return private.arena_json(d.id);end if;
 raise exception 'Ce tour a déjà été joué.';end if;
 if d.status in('cancelled','expired') or (d.status='finished' and d.finish_reason='timeout') then return private.arena_json(d.id);end if;
 if d.status<>'active' or d.turn_user_id<>u or d.turn_number<>p_expected_turn then raise exception 'Ce n’est pas ton tour.';end if;
 select * into f from private.arena_fighters where duel_id=d.id and user_id=u;
 select * into enemy from private.arena_fighters where duel_id=d.id and user_id<>u;
 case p_move when 'quick' then damage:=12;gain:=1;
 when 'heavy' then damage:=24;cost:=2;
 when 'guard' then gain:=2;
 when 'special' then cost:=3;damage:=case f.avatar when 0 then 20 when 1 then 26 when 2 then 12 else 16 end;healing:=case f.avatar when 0 then 8 when 1 then 0 when 2 then 16 else 12 end;end case;
 if f.energy<cost then raise exception 'Énergie insuffisante.';end if;
 if damage>0 and enemy.guard then damage:=(damage+1)/2;end if;
 damage:=least(enemy.hp,damage);healing:=least(100-f.hp,healing);
 update private.arena_fighters set hp=hp+healing,energy=least(4,energy-cost+gain),guard=guard or p_move='guard' where duel_id=d.id and user_id=u;
 update private.arena_fighters set hp=hp-damage,guard=case when damage>0 then false else guard end where duel_id=d.id and user_id=enemy.user_id;
 insert into private.arena_moves(duel_id,turn,actor_id,move,damage,healing) values(d.id,d.turn_number,u,p_move,damage,healing);
 update private.arena_duels set turn_number=turn_number+1,turn_user_id=enemy.user_id,deadline=clock_timestamp()+interval '24 hours' where id=d.id;
 if enemy.hp-damage=0 then perform private.arena_finish(d.id,u,'ko');
 elsif d.turn_number=40 then
 winner:=case when f.hp+healing>enemy.hp-damage then u when f.hp+healing<enemy.hp-damage then enemy.user_id else null end;
 perform private.arena_finish(d.id,winner,'turn_limit');
 else perform private.arena_notify(d.id,enemy.user_id,'arena_turn');end if;
 return private.arena_json(d.id);
end$$;
create function private.arena_surrender(p_duel_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();d private.arena_duels;begin
 perform private.get_arena_duel(p_duel_id);select * into d from private.arena_duels where id=p_duel_id for update;
 if d.status='active' then perform private.arena_finish(d.id,case when u=d.challenger_id then d.opponent_id else d.challenger_id end,'surrender');
 elsif d.status='pending' then update private.arena_duels set status='cancelled',finish_reason='surrender' where id=d.id;end if;
 return private.arena_json(d.id);
end$$;

-- Consume muted arena notices so enabling the preference cannot replay them.
create function private.arena_settings_changed() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.notify_duels and not new.notify_duels then update public.notifications set read_at=clock_timestamp() where user_id=new.user_id and arena_duel_id is not null and read_at is null;end if;
 return new;
end$$;
create trigger arena_settings_changed after update of notify_duels on public.user_settings for each row execute function private.arena_settings_changed();

alter function private.push_notification_eligible(uuid) rename to push_notification_eligible_before_arena;
create function private.push_notification_eligible(p_notification uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case when n.kind in('arena_invite','arena_turn','arena_finished') then
 n.read_at is null and n.created_at>now()-interval '24 hours' and coalesce(s.notify_duels,true)
 and private.message_pair_allowed(n.user_id,n.actor_id)
 and n.user_id in(d.challenger_id,d.opponent_id) and n.actor_id in(d.challenger_id,d.opponent_id)
 and case n.kind when 'arena_invite' then d.status='pending' and n.user_id=d.opponent_id and d.deadline>now()
 when 'arena_turn' then d.status='active' and d.turn_user_id=n.user_id and d.deadline>now() and split_part(n.event_key,':',4)=d.turn_number::text
 else d.status='finished' end
 else private.push_notification_eligible_before_arena(n.id) end
 from public.notifications n left join private.arena_duels d on d.id=n.arena_duel_id left join public.user_settings s on s.user_id=n.user_id where n.id=p_notification),false)
$$;
alter function private.authorize_push_job(uuid,uuid) rename to authorize_push_job_before_arena;
create function private.authorize_push_job(p_job_id uuid,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare delivery jsonb;duel uuid;begin
 delivery:=private.authorize_push_job_before_arena(p_job_id,p_lease_token);if delivery is null then return null;end if;
 select n.arena_duel_id into duel from private.push_outbox q join public.notifications n on n.id=q.notification_id where q.id=p_job_id;
 if duel is not null then delivery:=delivery||jsonb_build_object('arena_duel_id',duel);end if;return delivery;
end$$;
alter function private.pump_scheduled_notifications() rename to pump_scheduled_notifications_before_arena;
create function private.pump_scheduled_notifications() returns void language plpgsql security definer set search_path='' as $$begin
 perform private.arena_refresh();perform private.pump_scheduled_notifications_before_arena();
end$$;
alter function private.get_game_state() rename to get_game_state_before_arena;
create function private.get_game_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();result jsonb;begin
 result:=private.get_game_state_before_arena();
 return result||jsonb_build_object('notifications',coalesce((select jsonb_agg(n.value||jsonb_build_object('arena_duel_id',p.arena_duel_id) order by n.ordinality) from jsonb_array_elements(result->'notifications') with ordinality n left join public.notifications p on p.id=(n.value->>'id')::uuid and p.user_id=u),'[]'));
end$$;
alter function private.export_my_data() rename to export_my_data_before_arena;
create function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 perform private.arena_refresh(u);
 return private.export_my_data_before_arena()||jsonb_build_object('arena_duels',coalesce((select jsonb_agg(private.arena_json(id) order by created_at,id) from private.arena_duels where u in(challenger_id,opponent_id)),'[]'));
end$$;
create function public.get_arena() returns jsonb language sql security invoker set search_path='' as $$select private.get_arena()$$;
create function public.get_arena_duel(p_duel_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.get_arena_duel(p_duel_id)$$;
create function public.arena_invite(p_friend_id uuid,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.arena_invite(p_friend_id,p_request_id)$$;
create function public.arena_respond(p_duel_id uuid,p_accept boolean) returns jsonb language sql security invoker set search_path='' as $$select private.arena_respond(p_duel_id,p_accept)$$;
create function public.arena_move(p_duel_id uuid,p_move text,p_expected_turn integer) returns jsonb language sql security invoker set search_path='' as $$select private.arena_move(p_duel_id,p_move,p_expected_turn)$$;
create function public.arena_surrender(p_duel_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.arena_surrender(p_duel_id)$$;
create or replace function public.get_game_state() returns jsonb language sql security invoker set search_path='' as $$select private.get_game_state()$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
do $$declare t text;f record;begin
 foreach t in array array['arena_duels','arena_fighters','arena_moves'] loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and (p.proname like 'arena_%' or p.proname like '%_before_arena' or p.proname in('get_arena','get_arena_duel','get_game_state','export_my_data','push_notification_eligible','authorize_push_job','pump_scheduled_notifications')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('get_arena','get_arena_duel','arena_invite','arena_respond','arena_move','arena_surrender','get_game_state','export_my_data') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 if f.proname in('authorize_push_job','pump_scheduled_notifications') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end$$;
commit;
