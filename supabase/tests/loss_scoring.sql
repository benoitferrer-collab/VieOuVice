-- Owner-only assertions after migrations 001-007 + seed; all fixtures roll back.
-- No network credentials required. Run with psql ON_ERROR_STOP against a disposable DB.
begin;
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 d uuid:=gen_random_uuid(); empty_user uuid:=gen_random_uuid(); u uuid;
 s uuid; old_s uuid:=gen_random_uuid(); overdue_s uuid:=gen_random_uuid(); other_l uuid:=gen_random_uuid();
 at_time timestamptz; x jsonb; y jsonb; retry_key uuid:=gen_random_uuid();
 owner_role text:=current_user; failed boolean; before_balance integer; old_score integer;
 ledger_before jsonb; balance_before jsonb; count_before bigint; entry record;
begin
 insert into auth.users(id) values(a),(b),(c),(d),(empty_user);
 foreach u in array array[a,b,c,d] loop
  perform set_config('request.jwt.claim.sub',u::text,true);
  execute 'set local role authenticated';
  perform public.create_profile('loss_'||substr(replace(u::text,'-',''),1,14),0);
  execute format('set local role %I',owner_role);
 end loop;
 s:=private.ensure_season();
 -- Keep synthetic players together independently of existing league capacity.
 update public.league_memberships set league_id=(select league_id from public.league_memberships where user_id=a and season_id=s) where user_id in(b,c,d) and season_id=s;
 update public.leaderboard_entries set league_id=(select league_id from public.league_memberships where user_id=a and season_id=s) where user_id in(b,c,d) and season_id=s;
 select greatest(starts_at,statement_timestamp()-interval '1 minute') into at_time from public.seasons where id=s;
 -- Explicit timestamps no later than the test statement, including Monday boundaries.
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 select a,'drink','Aggregate fixture','excess',1,-2,1,s,at_time,gen_random_uuid() from generate_series(1,150);
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'walk','Recovery fixture','health',1,400,1,s,at_time,gen_random_uuid()),
       (a,'walk','Capped zero fixture','health',1,0,1,s,at_time,gen_random_uuid()),
       (b,'drink','Rival fixture','excess',1,-350,1,s,at_time,gen_random_uuid());
 -- A closed season is historical and must never be rebased.
 insert into public.seasons(id,starts_at,ends_at,closed_at)
 values(old_s,'1900-01-01 00:00Z','1900-01-08 00:00Z','1900-01-08 00:00Z');
 perform private.assign_league(a,old_s,1);
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'drink','Historical fixture','excess',1,-10,1,old_s,'1900-01-02 00:00Z',gen_random_uuid());
 insert into public.seasons(id,starts_at,ends_at)
 values(overdue_s,'1901-01-01 00:00Z','1901-01-08 00:00Z');
 perform private.assign_league(a,overdue_s,1);
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'drink','Overdue open fixture','excess',1,-7,1,overdue_s,'1901-01-02 00:00Z',gen_random_uuid());
 -- Reconstruct old signed projections using additional immutable fixture events.
 insert into private.life_ledger(user_id,life_delta,league_delta,reason,source_id,season_id,event_key)
 values(a,0,-14,'test_legacy_projection',a,overdue_s,'loss-test-overdue:'||a),
       (a,0,-200,'test_legacy_projection',a,s,'loss-test-legacy:'||a),
       (b,0,-700,'test_legacy_projection',b,s,'loss-test-legacy:'||b),
       (a,0,-20,'test_legacy_projection',a,old_s,'loss-test-closed:'||a);
 select weekly_score into old_score from public.leaderboard_entries where user_id=a and season_id=old_s;
 select jsonb_agg(to_jsonb(l) order by id) into ledger_before from private.life_ledger l where user_id in(a,b,c,d);
 select jsonb_agg(jsonb_build_array(id,life_balance) order by id) into balance_before from public.users where id in(a,b,c,d);
 perform private.rebase_loss_scores();
 if (select weekly_score from public.leaderboard_entries where user_id=a and season_id=s) is distinct from 300
 or (select weekly_score from public.leaderboard_entries where user_id=b and season_id=s) is distinct from 350 then raise exception 'Open season gross rebase';end if;
 if (select weekly_score from public.leaderboard_entries where user_id=a and season_id=overdue_s) is distinct from 7 then raise exception 'Overdue open season missed';end if;
 if (select weekly_score from public.leaderboard_entries where user_id=a and season_id=old_s) is distinct from old_score
 or exists(select 1 from private.life_ledger where season_id=old_s and reason='loss_scoring_rebase') then raise exception 'Closed season changed';end if;
 if balance_before is distinct from (select jsonb_agg(jsonb_build_array(id,life_balance) order by id) from public.users where id in(a,b,c,d)) then raise exception 'Rebase changed life';end if;
 if exists(select 1 from jsonb_array_elements(ledger_before) item where not exists(select 1 from private.life_ledger l where to_jsonb(l)=item)) then raise exception 'Historical ledger mutated';end if;
 select count(*) into count_before from private.life_ledger;
 perform private.rebase_loss_scores();
 if (select count(*) from private.life_ledger) is distinct from count_before then raise exception 'Rebase retry duplicated events';end if;
 -- Simulate a life donation through the canonical immutable ledger, excluding it from stats.
 insert into private.life_ledger(user_id,life_delta,reason,source_id,event_key)
 values(a,50,'transfer_in',a,'loss-test-donation:'||a);
 perform set_config('request.jwt.claim.sub',a::text,true);
 execute 'set local role authenticated';x:=public.get_game_state();execute format('set local role %I',owner_role);
 if x->'life_stats' is distinct from '{"lost_minutes":317,"recovered_minutes":400,"net_lost_minutes":-83}'::jsonb
 or x->'weekly_stats' is distinct from '{"lost_minutes":300,"recovered_minutes":400,"net_lost_minutes":-100}'::jsonb then raise exception 'Complete signed aggregates, welcome/donation exclusion';end if;
 if jsonb_array_length(x->'actions') is distinct from 100 or (x->>'weekly_score')::int is distinct from 300 or x->'loss_scoring' is distinct from 'true'::jsonb then raise exception 'Journal limit or gross contract';end if;
 if not(x ?& array['community_enabled','social_settings','catalog','friends','trophies','notifications','season_end','balance']) then raise exception 'Legacy fields lost';end if;
 if (select jsonb_agg(p->>'id' order by ordinal) from jsonb_array_elements(x->'players') with ordinality items(p,ordinal) where p->>'id' in(a::text,b::text)) is distinct from jsonb_build_array(b,a) then raise exception 'Gross league ordering';end if;
 if private.loss_stats(a,s,at_time-interval '1 microsecond') is distinct from '{"lost_minutes":0,"recovered_minutes":0,"net_lost_minutes":0}'::jsonb then raise exception 'As-of cutoff ignored';end if;
 failed:=false;begin update private.life_ledger set league_delta=0 where user_id=a;exception when others then failed:=true;end;
 if not failed then raise exception 'Ledger became mutable';end if;
 -- Hiding a higher-scoring player must not change official promotion positions.
 y:=x;
 insert into public.blocks(blocker,blocked) values(a,b);
 execute 'set local role authenticated';x:=public.get_game_state();execute format('set local role %I',owner_role);
 if x->'official_rank' is distinct from y->'official_rank' or x->'league_size' is distinct from y->'league_size'
 or (x->>'official_rank')::bigint<2 then raise exception 'Hidden leader changed official ranking';end if;
 if exists(select 1 from jsonb_array_elements(x->'players') p where p->>'id'=b::text) then raise exception 'Hidden leader exposed';end if;
 if (select p->'official_rank' from jsonb_array_elements(x->'players') p where p->>'id'=a::text) is distinct from x->'official_rank' then raise exception 'Player official rank disagrees';end if;
 delete from public.blocks where blocker=a and blocked=b;
 -- Isolate a rival outside the league: only the explicit duel may expose its weekly stats.
 insert into public.leagues(id,season_id,division) values(other_l,s,1);
 update public.league_memberships set league_id=other_l where user_id=b and season_id=s;
 update public.leaderboard_entries set league_id=other_l where user_id=b and season_id=s;
 delete from public.nemesis_pairs where season_id=s and (user_a in(a,b) or user_b in(a,b));
 insert into public.nemesis_pairs(season_id,user_a,user_b) values(s,least(a,b),greatest(a,b));
 insert into public.blocks(blocker,blocked) values(c,a);
 insert into private.player_access(user_id,suspended) values(d,true);
 execute 'set local role authenticated';x:=public.get_game_state();execute format('set local role %I',owner_role);
 if x->'nemesis'->>'id' is distinct from b::text or x->'nemesis'->'weekly_stats'->>'lost_minutes' is distinct from '350' then raise exception 'Authorized outside-league rival missing';end if;
 if exists(select 1 from jsonb_array_elements(x->'players') p where p->>'id' in(b::text,c::text,d::text)
 or p ?| array['life_stats','actions','balance'] or not(p ? 'weekly_stats')) then raise exception 'League privacy violation';end if;
 if x->'nemesis' ?| array['life_stats','actions','balance'] then raise exception 'Rival personal totals exposed';end if;
 -- Healthy recovery cannot change the official duel lead; an excess crossing can.
 update public.user_settings set pvp=true where user_id in(a,b);
 select count(*) into count_before from public.notifications where user_id in(a,b) and kind='duel_lead';
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'walk','Duel recovery','health',1,100,1,s,at_time,gen_random_uuid());
 if (select count(*) from public.notifications where user_id in(a,b) and kind='duel_lead') is distinct from count_before then raise exception 'Recovery sent duel lead';end if;
 insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key)
 values(a,'drink','Duel excess crossing','excess',1,-60,1,s,at_time,gen_random_uuid());
 if (select count(*) from public.notifications where user_id in(a,b) and kind='duel_lead') is distinct from count_before+2 then raise exception 'Gross duel crossing missed';end if;
 insert into public.blocks(blocker,blocked) values(a,b);
 execute 'set local role authenticated';x:=public.get_game_state();execute format('set local role %I',owner_role);
 if x->'nemesis' is distinct from 'null'::jsonb then raise exception 'Blocked duel exposed';end if;
 delete from public.blocks where blocker=a and blocked=b;
 insert into private.player_access(user_id,suspended) values(b,true);
 execute 'set local role authenticated';x:=public.get_game_state();execute format('set local role %I',owner_role);
 if x->'nemesis' is distinct from 'null'::jsonb then raise exception 'Suspended duel exposed';end if;
 -- Fresh user avoids the daily fixture action cap; retry uses the real RPC under its real role.
 perform set_config('request.jwt.claim.sub',c::text,true);
 select life_balance into before_balance from public.users where id=c;
 execute 'set local role authenticated';
 x:=public.record_action('drink',1,retry_key);y:=public.record_action('drink',1,retry_key);
 execute format('set local role %I',owner_role);
 if x is distinct from y or (select count(*) from public.actions where user_id=c and idempotency_key=retry_key) is distinct from 1 then raise exception 'Action retry changed';end if;
 if not exists(select 1 from private.life_ledger where source_id=(x->>'id')::uuid and life_delta=(x->>'minutes_impact')::int and league_delta=greatest(-(x->>'minutes_impact')::int,0)) then raise exception 'Excess ledger signs';end if;
 if (select life_balance from public.users where id=c) is distinct from before_balance+(x->>'minutes_impact')::int then raise exception 'Excess life changed';end if;
 execute 'set local role authenticated';x:=public.record_action('walk',1,gen_random_uuid());execute format('set local role %I',owner_role);
 if not exists(select 1 from private.life_ledger where source_id=(x->>'id')::uuid and league_delta=0 and life_delta=(x->>'minutes_impact')::int) then raise exception 'Health added league points';end if;
 for entry in select e.* from public.leaderboard_entries e where user_id in(a,b,c,d) loop
  if entry.weekly_score is distinct from (select coalesce(sum(league_delta),0) from private.life_ledger where user_id=entry.user_id and season_id=entry.season_id) then raise exception 'League projection differs from ledger';end if;
 end loop;
 if exists(select 1 from public.users p where id in(a,b,c,d) and life_balance is distinct from (select sum(life_delta) from private.life_ledger where user_id=p.id)) then raise exception 'Life projection differs from ledger';end if;
 if has_function_privilege('authenticated','private.loss_stats(uuid,uuid,timestamp with time zone)','EXECUTE')
 or has_function_privilege('authenticated','private.rebase_loss_scores()','EXECUTE')
 or has_function_privilege('authenticated','private.get_game_state_before_loss_scoring()','EXECUTE')
 or has_function_privilege('anon','public.get_game_state()','EXECUTE') then raise exception 'Private helper ACL';end if;
 perform set_config('request.jwt.claim.sub',empty_user::text,true);
 execute 'set local role authenticated';x:=public.get_game_state();execute format('set local role %I',owner_role);
 if x is not null then raise exception 'Missing profile must return SQL null';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 execute 'set local role authenticated';
 failed:=false;begin perform public.get_game_state();exception when others then failed:=true;end;
 execute format('set local role %I',owner_role);
 if not failed then raise exception 'Suspended account readable';end if;
 perform set_config('request.jwt.claim.sub','',true);
 execute 'set local role authenticated';
 failed:=false;begin perform public.get_game_state();exception when others then failed:=true;end;
 execute format('set local role %I',owner_role);
 if not failed then raise exception 'Unauthenticated account readable';end if;
 raise notice 'Loss scoring assertions passed; rollback follows.';
end $test$;
rollback;
