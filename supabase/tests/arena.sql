-- Owner-only synthetic regression; fixtures roll back.
begin;
create function pg_temp.arena_fails(command text) returns void language plpgsql as $$declare failed boolean:=false;begin
 begin execute command;exception when others then failed:=true;end;
 if not failed then raise exception 'Expected failure: %',command;end if;
end$$;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid;req uuid:=gen_random_uuid();d uuid;r jsonb;prior jsonb;i int;actor uuid;
begin
 foreach u in array array[a,b,c] loop insert into auth.users(id) values(u);perform set_config('request.jwt.claim.sub',u::text,true);perform public.create_profile('arena_'||substr(replace(u::text,'-',''),1,13),0);end loop;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 perform set_config('request.jwt.claim.sub',a::text,true);
 r:=public.arena_invite(b,req);d:=(r->>'id')::uuid;
 if public.arena_invite(b,req)<>r then raise exception 'Invite retry mismatch';end if;
 perform pg_temp.arena_fails(format('select public.arena_invite(%L,%L)',c,req));
 perform set_config('request.jwt.claim.sub',c::text,true);perform pg_temp.arena_fails(format('select public.get_arena_duel(%L)',d));
 perform set_config('request.jwt.claim.sub',b::text,true);r:=public.arena_respond(d,true);
 if r->>'turn_user_id'<>b::text or r->>'turn_number'<>'1' then raise exception 'First turn incorrect';end if;
 r:=public.arena_move(d,'guard',1);if public.arena_move(d,'guard',1)<>r then raise exception 'Move retry mismatch';end if;
 perform pg_temp.arena_fails(format('select public.arena_move(%L,''quick'',1)',d));
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.arena_move(d,'heavy',2);
 if r->'fighters'->1->>'hp'<>'88' or r->'fighters'->1->>'energy'<>'4' then raise exception 'Guard/energy incorrect %',r;end if;
 for i in 3..40 loop
 actor:=case when i%2=1 then b else a end;perform set_config('request.jwt.claim.sub',actor::text,true);
 r:=public.arena_move(d,'quick',i);exit when r->>'status'='finished';end loop;
 if r->>'status'<>'finished' or r->>'reward'<>'10' then raise exception 'Finish reward wrong %',r;end if;
 prior:=r;r:=public.arena_move(d,'quick',(r->>'turn_number')::int-1);if r<>prior then raise exception 'Final move retry failed';end if;
 if (select count(*) from private.eclats_ledger where arena_duel_id=d)<>1 then raise exception 'Reward duplicated';end if;
 if not exists(select 1 from public.notifications where arena_duel_id=d and kind='arena_finished') then raise exception 'Finish notice missing';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.arena_invite(b,gen_random_uuid());d:=(r->>'id')::uuid;
 update private.arena_duels set deadline=clock_timestamp()-interval '1 second' where id=d;
 if public.get_arena_duel(d)->>'status'<>'expired' then raise exception 'Pending timeout failed';end if;
 r:=public.arena_invite(b,gen_random_uuid());d:=(r->>'id')::uuid;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.arena_respond(d,true);
 update private.arena_duels set deadline=clock_timestamp()-interval '1 second' where id=d;
 r:=public.get_arena_duel(d);if r->>'finish_reason'<>'timeout' or r->>'winner_id'<>a::text or r->>'reward'<>'0' then raise exception 'Turn timeout failed';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.arena_invite(b,gen_random_uuid());d:=(r->>'id')::uuid;
 insert into public.blocks(blocker,blocked) values(a,b);
 if public.get_arena_duel(d)->>'status'<>'cancelled' then raise exception 'Block cancellation failed';end if;
 if has_table_privilege('authenticated','private.arena_duels','SELECT') or has_function_privilege('anon','public.get_arena()','EXECUTE') or has_function_privilege('authenticated','private.arena_finish(uuid,uuid,text)','EXECUTE') then raise exception 'Arena ACL unsafe';end if;
 raise notice 'Arena invite/CAS/combat/reward/privacy/timeout checks passed';
end$test$;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();u uuid;d uuid;r jsonb;i int;j int;actor uuid;notice_id uuid;old_notice uuid;winner_nick text;
begin
 foreach u in array array[a,b] loop insert into auth.users(id) values(u);perform set_config('request.jwt.claim.sub',u::text,true);perform public.create_profile('arenax_'||substr(replace(u::text,'-',''),1,12),0);end loop;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 insert into private.player_access(user_id,is_admin) values(b,true);
 for j in 1..4 loop
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.arena_invite(b,gen_random_uuid());d:=(r->>'id')::uuid;
 select id into notice_id from public.notifications where arena_duel_id=d and kind='arena_invite';
 if not private.push_notification_eligible(notice_id) then raise exception 'Invitation push not eligible';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);r:=public.arena_respond(d,true);
 if private.push_notification_eligible(notice_id) then raise exception 'Obsolete invite push eligible';end if;
 select id into old_notice from public.notifications where arena_duel_id=d and kind='arena_turn';
 if not private.push_notification_eligible(old_notice) then raise exception 'Turn push missing';end if;
 for i in 1..6 loop actor:=case when i%2=1 then b else a end;perform set_config('request.jwt.claim.sub',actor::text,true);r:=public.arena_move(d,'quick',i);end loop;
 if private.push_notification_eligible(old_notice) then raise exception 'Obsolete turn eligible';end if;
 update private.arena_fighters set hp=1 where duel_id=d and user_id=a;
 perform set_config('request.jwt.claim.sub',b::text,true);r:=public.arena_move(d,'quick',7);
 if (r->>'reward')::int<>(case when j<=3 then 10 else 0 end) then raise exception 'Daily cap failed %',r;end if;
 end loop;
 if public.get_progression()->'wallet'->>'balance'<>'30' then raise exception 'Arena reward not spendable';end if;
 if jsonb_array_length(public.export_my_data()->'arena_duels')<>4 then raise exception 'Arena export missing';end if;
 if not exists(select 1 from jsonb_array_elements(public.get_game_state()->'notifications') n where n->>'arena_duel_id'=d::text) then raise exception 'Game state deep link missing';end if;
 update public.user_settings set notify_duels=false where user_id=b;
 if exists(select 1 from public.notifications where user_id=b and arena_duel_id is not null and read_at is null) then raise exception 'Mute did not consume notices';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);r:=public.arena_invite(b,gen_random_uuid());d:=(r->>'id')::uuid;
 if exists(select 1 from public.notifications where arena_duel_id=d) then raise exception 'Muted invitation created';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.arena_respond(d,true);
 insert into private.player_access(user_id,suspended) values(a,true);
 r:=public.get_arena_duel(d);if r->>'status'<>'cancelled' then raise exception 'Suspension ignored';end if;
 select nickname into winner_nick from public.users where id=a;
 perform public.prepare_admin_account_deletion(b,a,winner_nick);delete from auth.users where id=a;
 if exists(select 1 from private.arena_duels where challenger_id=a or opponent_id=a) then raise exception 'Purge missed arena';end if;
 if public.get_progression()->'wallet'->>'balance'<>'30' then raise exception 'Opponent purge removed winner grants';end if;
 raise notice 'Arena push relevance/mute/dailycap/export/purge checks passed';
end$test$;
rollback;
