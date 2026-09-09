-- Executed on 2026-09-08 with migration 004 inside an outer rollback-only transaction.
-- Standalone owner-only integration checks after 001-004 + seed.
-- Synthetic users only; all changes (including season maintenance) ROLLBACK.
-- JWT emulation is supplemented by ACL assertions, not a substitute for HTTP tests.
begin;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();e uuid;k uuid:=gen_random_uuid();payload jsonb;x jsonb;y jsonb;failed boolean;cat text;s uuid;anchor timestamptz:=clock_timestamp();i int;table_name text;visible_count bigint;owner_role text:=current_user;net_event uuid:=gen_random_uuid();category_event uuid:=gen_random_uuid();cancelled_event uuid:=gen_random_uuid();excess_cat text;
begin
 insert into auth.users(id) values(a),(b),(c);
 foreach e in array array[a,b,c] loop
 perform set_config('request.jwt.claim.sub',e::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',e,'role','authenticated')::text,true);
 perform public.create_profile('qa_'||substr(replace(e::text,'-',''),1,14),0);
 end loop;
 failed:=false;begin perform public.admin_get_dashboard();exception when others then failed:=true;end;if not failed then raise exception 'Ordinary user reached admin RPC';end if;
 insert into private.player_access values(a,true,false);
 perform set_config('request.jwt.claim.sub',a::text,true);
 if (select count(*) from private.player_access where is_admin and not suspended)=1 then
 failed:=false;begin perform public.admin_update_user(a,false,false,'test');exception when others then failed:=true;end;if not failed then raise exception 'Last administrator removed';end if;
 else raise notice 'Last-admin runtime case skipped: existing admins preserved; run on empty staging before bootstrap for this case.';end if;
 failed:=false;begin perform public.admin_update_user(a,true,true,'test');exception when others then failed:=true;end;if not failed then raise exception 'Self suspension accepted';end if;
 perform public.admin_update_user(b,false,true,'test suspension');
 perform set_config('request.jwt.claim.sub',b::text,true);
 failed:=false;begin perform public.get_game_state();exception when others then failed:=true;end;if not failed then raise exception 'Suspended game state readable';end if;
 -- Actual client role: definer RPC emulation alone cannot detect missing RLS gates.
 begin
  execute 'set local role authenticated';
  foreach table_name in array array['users','user_settings','action_catalog','seasons','leagues','league_memberships','leaderboard_entries','actions','friendships','blocks','life_transfers','nemesis_pairs','trophy_definitions','trophies','notifications'] loop
   execute format('select count(*) from public.%I',table_name) into visible_count;
   if visible_count<>0 then raise exception 'Suspended direct SELECT leaked rows in %',table_name;end if;
  end loop;
  execute format('set local role %I',owner_role);
 exception when others then
  execute format('set local role %I',owner_role);raise;
 end;
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.admin_update_user(b,false,false,'test restore');
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin
  execute 'set local role authenticated';
  select count(*) into visible_count from public.users where id=b;
  if visible_count<>1 then raise exception 'Reactivated own profile not readable';end if;
  execute format('set local role %I',owner_role);
 exception when others then
  execute format('set local role %I',owner_role);raise;
 end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 failed:=false;begin perform public.get_friend_activity(b);exception when others then failed:=true;end;if not failed then raise exception 'Nonfriend history accessible';end if;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 x:=public.get_friend_activity(b);if (x->>'shared')::boolean then raise exception 'History opt-in default not false';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.update_history_sharing(true);
 select id into cat from public.action_catalog where kind='health' and active order by id limit 1;
 if cat is null then raise exception 'Seed healthy catalogue required';end if;
 -- Existing action quota and exact retry still apply under the new assert_user.
 select public.record_action(cat,max_quantity,k) into x from public.action_catalog where id=cat;
 select public.record_action(cat,max_quantity,k) into y from public.action_catalog where id=cat;
 if x<>y or (x->>'minutes_impact')::int>(select daily_cap from public.action_catalog where id=cat) then raise exception 'Action replay/cap regression';end if;
 failed:=false;begin perform public.record_action(cat,1001,gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Quantity quota regression';end if;
 select season_id into s from public.league_memberships where user_id=b order by season_id limit 1;
 -- Synthetic tied timestamps test keyset, immutable journal shape and seven-day exclusion.
 for i in 1..52 loop
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values(b,cat,'Synthetic', 'health',1,1,1,s,anchor-interval '1 hour',gen_random_uuid());
 end loop;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values(b,cat,'Old', 'health',1,1,1,s,anchor-interval '8 days',gen_random_uuid());
 perform set_config('request.jwt.claim.sub',a::text,true);x:=public.get_friend_activity(b);
 if jsonb_array_length(x->'actions')<>50 or x->'next_cursor'='null'::jsonb or (x->'actions'->0) ? 'idempotency_key' then raise exception 'History page shape';end if;
 y:=public.get_friend_activity(b,(x->'next_cursor'->>'created_at')::timestamptz,(x->'next_cursor'->>'id')::uuid);
 if jsonb_array_length(y->'actions')<>3 or y->'next_cursor'<>'null'::jsonb then raise exception 'Keyset boundary/7 days';end if;
 insert into public.blocks(blocker,blocked) values(b,a);
 failed:=false;begin perform public.get_friend_activity(b);exception when others then failed:=true;end;if not failed then raise exception 'Reverse block ignored';end if;delete from public.blocks where blocker=b and blocked=a;
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.update_history_sharing(false);perform set_config('request.jwt.claim.sub',a::text,true);
 if jsonb_array_length(public.get_friend_activity(b)->'actions')<>0 then raise exception 'Consent withdrawal ignored';end if;
 payload:=jsonb_build_object('id',null,'title','Test event','description','Synthetic','starts_at',anchor+interval '1 day','ends_at',anchor+interval '2 days','metric','health_minutes','catalog_id',null,'badge_label','Test badge','badge_icon','trophy');
 x:=public.admin_save_competition(payload,k);e:=(x->>'id')::uuid;
 if public.admin_save_competition(payload,k)<>x then raise exception 'Creation retry changed';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('title','Other'),k);exception when others then failed:=true;end;if not failed then raise exception 'Idempotency mismatch accepted';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('ends_at',anchor),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Invalid dates accepted';end if;
 -- Limits mirror the strict browser schema, and cannot be bypassed via RPC.
 y:=public.admin_save_competition(payload||jsonb_build_object('id',e,'badge_label',repeat('b',60)),gen_random_uuid());
 if length(y->>'badge_label')<>60 then raise exception 'Valid 60-character badge rejected';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('badge_label',repeat('b',61)),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception '61-character badge accepted';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('description',repeat('d',1201)),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception '1201-character description accepted';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('ends_at',anchor+interval '92 days'),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception '91-day event accepted';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('status','completed'),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Injected field accepted';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('title',123),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Numeric title accepted';end if;
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('title','Bad'||chr(1)||'Title'),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Control character accepted';end if;
 perform public.admin_set_competition_status(e,'published');
 failed:=false;begin perform public.admin_save_competition(payload||jsonb_build_object('id',e),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Published rules edited';end if;
 perform public.join_competition(e);perform public.join_competition(e);if (select count(*) from private.competition_members where event_id=e)<>1 then raise exception 'Duplicate enrollment';end if;
 perform public.leave_competition(e);perform public.leave_competition(e);perform public.join_competition(e);
 perform set_config('request.jwt.claim.sub',c::text,true);perform public.join_competition(e);
 -- Owner-only time travel fixture; no application RPC accepts historical registration.
 update private.competitions set starts_at=anchor-interval '2 hours',ends_at=anchor-interval '30 minutes' where id=e;
 update private.competition_members set joined_at=anchor-interval '3 hours' where event_id=e;
 foreach k in array array[a,c] loop
 select season_id into s from public.league_memberships where user_id=k order by season_id limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values(k,cat,'Tie', 'health',1,5,1,s,anchor-interval '1 hour',gen_random_uuid());end loop;
 failed:=false;begin perform public.join_competition(e);exception when others then failed:=true;end;if not failed then raise exception 'Retroactive enrollment';end if;
 perform private.close_due_competitions();perform private.close_due_competitions();
 if (select count(*) from private.competition_badges where event_id=e and kind='winner' and rank=1)<>2 then raise exception 'Ties/badge idempotence';end if;
 if (select count(*) from private.competition_results where event_id=e and score=5 and rank=1)<>2 then raise exception 'Frozen tied results';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 failed:=false;begin perform public.admin_set_competition_status(e,'cancelled');exception when others then failed:=true;end;if not failed then raise exception 'Completed event cancelled';end if;
 perform public.admin_set_catalog_active(cat,false,'Test moderation');perform public.admin_set_catalog_active(cat,true,'Restore test');
 failed:=false;begin update public.action_catalog set coefficient=coefficient+1 where id=cat;exception when others then failed:=true;end;if not failed then raise exception 'Tariff mutable';end if;
 if has_table_privilege('authenticated','private.player_access','SELECT') or has_table_privilege('authenticated','private.admin_audit','SELECT') or has_function_privilege('authenticated','private.close_due_competitions()','EXECUTE') or has_function_privilege('authenticated','private.is_admin()','EXECUTE') or has_function_privilege('anon','public.get_social_hub()','EXECUTE') then raise exception 'Excessive privileges';end if;
 if not has_function_privilege('authenticated','private.get_social_hub()','EXECUTE') or not has_function_privilege('authenticated','public.get_social_hub()','EXECUTE') then raise exception 'RPC unavailable';end if;
 x:=public.export_my_data();
 if not (x ?& array['push_subscriptions','share_history','competition_entries','competition_badges']) or jsonb_array_length(x->'competition_badges')<>1 or jsonb_array_length(x->'competition_entries')<>1 then raise exception 'Own competition export incomplete';end if;
 if exists(select 1 from jsonb_array_elements(x->'competition_entries') item where item->'final_result' ? 'user_id') then raise exception 'Unexpected export user identifier';end if;
 -- Additional isolated old-window fixtures: boundary, metric and frozen results.
 select id into excess_cat from public.action_catalog where kind='excess' and active order by id limit 1;
 if excess_cat is null then raise exception 'Seed excess catalogue required';end if;
 insert into private.competitions(id,title,description,starts_at,ends_at,metric,catalog_id,badge_label,badge_icon,status) values
 (net_event,'Net fixture','',anchor-interval '5 days',anchor-interval '4 days','net_minutes',null,'Net badge','trophy','published'),
 (category_event,'Category fixture','',anchor-interval '5 days',anchor-interval '4 days','category_minutes',cat,'Category badge','leaf','published'),
 (cancelled_event,'Cancelled fixture','',anchor-interval '5 days',anchor-interval '4 days','health_minutes',null,'No badge','medal','cancelled');
 foreach e in array array[net_event,category_event,cancelled_event] loop
  insert into private.competition_members(event_id,user_id,joined_at) values(e,a,anchor-interval '6 days'),(e,b,anchor-interval '6 days'),(e,c,anchor-interval '6 days');
 end loop;
 select season_id into s from public.league_memberships where user_id=a order by season_id limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (a,cat,'At start','health',1,10,1,s,anchor-interval '5 days',gen_random_uuid()),
 (a,excess_cat,'Net penalty','excess',1,-3,1,s,anchor-interval '4 days 12 hours',gen_random_uuid()),
 (a,cat,'At end excluded','health',1,100,1,s,anchor-interval '4 days',gen_random_uuid()),
 (a,cat,'Before start excluded','health',1,100,1,s,anchor-interval '5 days 1 second',gen_random_uuid());
 select season_id into s from public.league_memberships where user_id=b order by season_id limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (b,cat,'Zero cap','health',1,0,1,s,anchor-interval '4 days 12 hours',gen_random_uuid());
 perform private.close_due_competitions();
 if not exists(select 1 from private.competition_results where event_id=net_event and user_id=a and score=7 and action_count=2) then raise exception 'Net metric/start-inclusive/end-exclusive';end if;
 if not exists(select 1 from private.competition_results where event_id=category_event and user_id=a and score=10 and action_count=1) then raise exception 'Category metric';end if;
 if not exists(select 1 from private.competition_badges where event_id=net_event and user_id=b and kind='podium' and rank=2) then raise exception 'Net zero action/podium';end if;
 if exists(select 1 from private.competition_badges where event_id in(net_event,category_event) and user_id=c) or exists(select 1 from private.competition_badges where event_id=category_event and user_id=b) then raise exception 'Zero eligible actions earned badge';end if;
 if exists(select 1 from private.competition_badges where event_id=cancelled_event) or exists(select 1 from private.competition_results where event_id=cancelled_event) then raise exception 'Cancelled awards/results';end if;
 select season_id into s from public.league_memberships where user_id=a order by season_id limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values(a,cat,'Backdated after close','health',1,500,1,s,anchor-interval '4 days 12 hours',gen_random_uuid());
 perform private.close_due_competitions();
 if (select score from private.competition_standings(category_event) where user_id=a)<>10 or (select score from private.competition_standings(net_event) where user_id=a)<>7 then raise exception 'Completed results not frozen';end if;
 raise notice 'Admin/competitions assertions passed; transaction will rollback.';
end $test$;
rollback;
