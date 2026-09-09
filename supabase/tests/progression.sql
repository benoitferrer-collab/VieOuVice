-- Owner-only integration assertions after 001-006 + seed. Synthetic data, rollback only.
-- JWT emulation + real role/ACL checks; does not claim HTTP validation.
begin;
do $test$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();u uuid;
 s uuid;ev uuid:=gen_random_uuid();bad_ev uuid:=gen_random_uuid();cat_ev uuid:=gen_random_uuid();
 w date:=(date_trunc('week',clock_timestamp() at time zone 'Europe/Paris'))::date;
 old_w date:='2025-03-24';old_start timestamptz:='2025-03-23 23:00Z';
 x jsonb;y jsonb;failed boolean;i integer;n bigint;role_name text:=current_user;t text;
 before_balance integer;
begin
 if private.progression_week_start('2026-03-29 23:59:59+02')<>'2026-03-23'::date
 or private.progression_week_start('2026-03-30 00:00:00+02')<>'2026-03-30'::date then raise exception 'Paris Monday boundary';end if;
 if private.progression_week_end('2026-03-23')-('2026-03-23'::date::timestamp at time zone 'Europe/Paris')<>interval '167 hours'
 or private.progression_week_end('2026-10-19')-('2026-10-19'::date::timestamp at time zone 'Europe/Paris')<>interval '169 hours' then raise exception 'DST duration';end if;
 insert into auth.users(id) values(a),(b),(c),(d);
 foreach u in array array[a,b,c,d] loop
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.create_profile('pg_'||substr(replace(u::text,'-',''),1,14),0);
 end loop;
 perform set_config('request.jwt.claim.sub',a::text,true);
 select season_id into s from public.league_memberships where user_id=a order by season_id limit 1;
 perform public.choose_weekly_mission('new_habit');perform public.choose_weekly_mission('new_habit');
 perform public.choose_weekly_mission('pause_days');perform public.choose_weekly_mission('healthy_variety');
 if (select count(*) from private.weekly_mission_choices where user_id=a and week_start=w)<>3 then raise exception 'Choice retries';end if;
 failed:=false;begin perform public.choose_weekly_mission('healthy_days');exception when others then failed:=true;end;if not failed then raise exception 'Fourth choice accepted';end if;
 failed:=false;begin perform public.choose_weekly_mission(null);exception when others then failed:=true;end;if not failed then raise exception 'Null code accepted';end if;
 failed:=false;begin update private.weekly_mission_choices set code='healthy_days' where user_id=a and code='pause_days';exception when others then failed:=true;end;if not failed then raise exception 'Choices mutable';end if;
 failed:=false;begin perform public.equip_cosmetic('accessory','halo');exception when others then failed:=true;end;if not failed then raise exception 'Locked cosmetic equipped';end if;
 failed:=false;begin perform public.equip_cosmetic('invalid',null);exception when others then failed:=true;end;if not failed then raise exception 'Invalid slot accepted';end if;
 -- Old selections are settled using that week's history, regardless of current-week choices.
 insert into private.weekly_mission_choices(user_id,week_start,code) values(a,old_w,'pause_days'),(a,old_w,'healthy_days'),(a,old_w,'healthy_variety');
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 select a,'pause','Fixture pause','health',1,15,1,s,old_start+make_interval(days=>i),gen_random_uuid() from generate_series(0,2) i;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (a,'walk','Fixture walk','health',1,25,1,s,old_start+interval '1 hour',gen_random_uuid()),
 (a,'sleep','Fixture sleep','health',1,10,1,s,old_start+interval '2 hours',gen_random_uuid());
 select life_balance into before_balance from public.users where id=a;
 x:=public.get_progression();y:=public.get_progression();
 if (x->>'xp')::int<>150 or x->>'xp'<>y->>'xp' or (x->>'level')::int<>2 or (x->>'week_xp')::int<>0 then raise exception 'Historical settlement/idempotency';end if;
 if (select life_balance from public.users where id=a)<>before_balance then raise exception 'XP changed life minutes';end if;
 if (select sum(xp) from private.xp_awards where user_id=a and week_start=old_w)<>150 then raise exception 'Weekly XP cap';end if;
 if not exists(select 1 from private.progression_badges where user_id=a and code='premier_trio') then raise exception 'Trio missing';end if;
 failed:=false;begin update private.xp_awards set xp=50 where user_id=a;exception when others then failed:=true;end;if not failed then raise exception 'XP mutable';end if;
 failed:=false;begin delete from private.xp_awards where user_id=a;exception when others then failed:=true;end;if not failed then raise exception 'XP deletable';end if;
 perform public.equip_cosmetic('background','aurora');perform public.equip_cosmetic('background','aurora');
 failed:=false;begin perform public.equip_cosmetic('title','aurora');exception when others then failed:=true;end;if not failed then raise exception 'Wrong-slot cosmetic';end if;
 perform public.equip_cosmetic('background',null);
 if public.get_progression()->'equipped'->'background'<>'null'::jsonb then raise exception 'Unequip failed';end if;
 if jsonb_array_length(x->'inventory')<>9 or jsonb_array_length(x->'missions')<>5 then raise exception 'Contract cardinality';end if;
 -- The earlier use of pause defeats new_habit, even when evaluated in a later historical week.
 insert into private.weekly_mission_choices(user_id,week_start,code) values(a,'2025-03-31','new_habit');
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (a,'pause','Old habit','health',1,15,1,s,'2025-03-31 01:00Z',gen_random_uuid()),
 (a,'move','Zero cap new category','health',1,0,1,s,'2025-03-31 02:00Z',gen_random_uuid());
 perform public.get_progression();
 if exists(select 1 from private.xp_awards where user_id=a and week_start='2025-03-31') then raise exception 'Old/zero habit counted as new';end if;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (a,'move','New habit','health',1,40,1,s,'2025-03-31 03:00Z',gen_random_uuid());
 perform public.get_progression();
 if not exists(select 1 from private.xp_awards where user_id=a and week_start='2025-03-31' and code='new_habit') then raise exception 'Historical new habit missing';end if;
 -- Net competitions still require a positive healthy action, after joining and inside [start,end).
 insert into private.competitions(id,title,description,starts_at,ends_at,metric,catalog_id,badge_label,badge_icon,status) values
 (ev,'Net mission','',old_start+interval '3 days',old_start+interval '4 days','net_minutes',null,'Net winner','trophy','completed'),
 (bad_ev,'Draft mission','',old_start,old_start+interval '7 days','health_minutes',null,'Draft badge','leaf','draft'),
 (cat_ev,'Category mission','',old_start,old_start+interval '7 days','category_minutes','sleep','Category badge','leaf','completed');
 insert into private.competition_members(event_id,user_id,joined_at) values(ev,b,old_start+interval '3 days 1 hour'),(ev,c,old_start),(cat_ev,c,old_start),(ev,a,old_start);
 select season_id into s from public.league_memberships where user_id=b order by season_id limit 1;
 insert into private.weekly_mission_choices(user_id,week_start,code) values(b,old_w,'competition_action');
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (b,'pause','Before joining','health',1,15,1,s,old_start+interval '3 days',gen_random_uuid()),
 (b,'pause','At end','health',1,15,1,s,old_start+interval '4 days',gen_random_uuid()),
 (b,'drink','Excess','excess',1,-30,1,s,old_start+interval '3 days 2 hours',gen_random_uuid()),
 (b,'pause','Zero','health',1,0,1,s,old_start+interval '3 days 3 hours',gen_random_uuid());
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.get_progression();
 if exists(select 1 from private.xp_awards where user_id=b) then raise exception 'Ineligible competition action awarded';end if;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (b,'pause','Eligible','health',1,15,1,s,old_start+interval '3 days 4 hours',gen_random_uuid());
 if (public.get_progression()->>'xp')::int<>50 then raise exception 'Eligible competition action missed';end if;
 select season_id into s from public.league_memberships where user_id=c order by season_id limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (c,'pause','Wrong category','health',1,15,1,s,old_start+interval '1 hour',gen_random_uuid());
 if (select progress from private.progression_missions(c,old_w) where code='competition_action')<>0 then raise exception 'Wrong category counted';end if;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (c,'sleep','Eligible category','health',1,10,1,s,old_start+interval '2 hours',gen_random_uuid());
 if (select progress from private.progression_missions(c,old_w) where code='competition_action')<>1 then raise exception 'Matching category missed';end if;
 select season_id into s from public.league_memberships where user_id=d order by season_id limit 1;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
 (d,'sleep','Nonmember','health',1,10,1,s,old_start+interval '2 hours',gen_random_uuid());
 if (select progress from private.progression_missions(d,old_w) where code='competition_action')<>0 then raise exception 'Nonmember action counted';end if;
 -- Choosing an upcoming published event does not require having joined yet.
 insert into private.competitions(title,description,starts_at,ends_at,metric,badge_label,badge_icon,status)
 values('Upcoming mission','',private.progression_week_end(w)-interval '1 microsecond',private.progression_week_end(w)+interval '1 day','health_minutes','Upcoming badge','leaf','published');
 perform set_config('request.jwt.claim.sub',d::text,true);
 perform public.choose_weekly_mission('competition_action');perform public.choose_weekly_mission('competition_action');
 if (select count(*) from private.weekly_mission_choices where user_id=d and week_start=w and code='competition_action')<>1 then raise exception 'Upcoming mission selection';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 -- Any competition badge unlocks laurel/arena; winner alone unlocks golden.
 insert into private.competition_badges(event_id,user_id,event_title,label,icon,kind,rank) values(ev,b,'Net mission','Net badge','medal','participant',4),(ev,a,'Net mission','Net winner','trophy','winner',1);
 perform public.equip_cosmetic('accessory','laurel');
 failed:=false;begin perform public.equip_cosmetic('background','golden');exception when others then failed:=true;end;if not failed then raise exception 'Nonwinner golden';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.equip_cosmetic('background','golden');
 -- Disconnect leagues to isolate friendship/event access; memberships are not immutable.
 delete from public.league_memberships where user_id in(b,c,d);
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 x:=public.get_player_looks(array[a,b,c,d,a]);
 if jsonb_array_length(x)<>3 then raise exception 'Look scope/deduplication';end if;
 if exists(select 1 from jsonb_array_elements(x) item where item ?| array['xp','missions','email','inventory'] or jsonb_array_length(item->'badges')>3) then raise exception 'Look private fields leaked';end if;
 insert into public.blocks(blocker,blocked) values(c,a);
 if jsonb_array_length(public.get_player_looks(array[c]))<>0 then raise exception 'Block look leak';end if;
 insert into private.player_access(user_id,suspended) values(b,true);
 if jsonb_array_length(public.get_player_looks(array[b]))<>0 then raise exception 'Suspension look leak';end if;
 failed:=false;begin perform public.get_player_looks(array_fill(a,array[61]));exception when others then failed:=true;end;if not failed then raise exception 'Look batch cap missing';end if;
 x:=public.export_my_data();
 if not(x ?& array['weekly_mission_choices','xp_awards','progression_badges','equipped_cosmetics','competition_badges','push_subscriptions']) then raise exception 'Export incomplete';end if;
 if exists(select 1 from jsonb_array_elements(x->'xp_awards') item where item->>'user_id'<>a::text) then raise exception 'Foreign XP exported';end if;
 foreach t in array array['weekly_mission_choices','xp_awards','progression_badges','equipped_cosmetics'] loop
 if has_table_privilege('authenticated','private.'||t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Private storage privilege %',t;end if;
 end loop;
 if has_function_privilege('authenticated','private.settle_progression(uuid)','EXECUTE') or has_function_privilege('anon','public.get_progression()','EXECUTE') or has_function_privilege('authenticated','private.export_my_data_before_progression()','EXECUTE') then raise exception 'Internal function privilege';end if;
 -- Exercise actual wrapper execution as authenticated, proving internal helpers remain callable through definer.
 execute 'set local role authenticated';x:=public.get_progression();execute format('set local role %I',role_name);
 perform set_config('request.jwt.claim.sub',b::text,true);
 failed:=false;begin perform public.get_progression();exception when others then failed:=true;end;if not failed then raise exception 'Suspended progression readable';end if;
 perform set_config('request.jwt.claim.sub','',true);
 failed:=false;begin perform public.get_progression();exception when others then failed:=true;end;if not failed then raise exception 'Anonymous progression readable';end if;
 raise notice 'Progression assertions passed; rollback follows.';
end $test$;
do $cancellation$
declare admin_id uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid;ev uuid;s uuid;w date:=private.progression_week_start(statement_timestamp());at_time timestamptz:=greatest(statement_timestamp()-interval '1 minute',w::timestamp at time zone 'Europe/Paris');
begin
 foreach u in array array[admin_id,a,b,c] loop
  insert into auth.users(id) values(u);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.create_profile('qa_'||substr(replace(u::text,'-',''),1,14),0);
 end loop;
 insert into private.player_access(user_id,is_admin) values(admin_id,true);
 insert into private.competitions(title,description,starts_at,ends_at,metric,badge_label,badge_icon,status)
 values('Cancellation XP','',at_time-interval '1 hour',clock_timestamp()+interval '1 day','health_minutes','Cancellation badge','leaf','published') returning id into ev;
 foreach u in array array[a,b,c] loop
  insert into private.competition_members(event_id,user_id,joined_at) values(ev,u,at_time-interval '2 hours');
  insert into private.weekly_mission_choices(user_id,week_start,code) values(u,w,'competition_action');
 end loop;
 foreach u in array array[a,b] loop
  select season_id into s from public.league_memberships where user_id=u order by season_id limit 1;
  insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
  values(u,'pause','Before cancel','health',1,15,1,s,at_time,gen_random_uuid());
 end loop;
 perform private.settle_progression(a);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.admin_set_competition_status(ev,'cancelled');
 perform private.settle_progression(b);perform private.settle_progression(b);
 if (select count(*) from private.xp_awards where user_id in(a,b) and code='competition_action')<>2 then raise exception 'Cancellation changed already-earned XP';end if;
 select season_id into s from public.league_memberships where user_id=c order by season_id limit 1;
 -- Inserted after cancellation but explicitly inside this DO's statement-time
 -- snapshot, so the assertion cannot pass merely because the action is future.
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,idempotency_key,created_at)
 values(c,'pause','After cancel','health',1,15,1,s,gen_random_uuid(),statement_timestamp());
 if (select progress from private.progression_missions(c,w) where code='healthy_days')<>1 then raise exception 'Cancellation test action was not counted';end if;
 perform private.settle_progression(c);
 if exists(select 1 from private.xp_awards where user_id=c) then raise exception 'Cancelled event awarded new XP';end if;
 if has_function_privilege('authenticated','private.admin_set_competition_status_before_progression(uuid,text)','EXECUTE') then raise exception 'Cancellation wrapper bypass';end if;
end $cancellation$;
rollback;
