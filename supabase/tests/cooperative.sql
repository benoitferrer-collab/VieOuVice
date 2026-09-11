-- Owner fixtures, synthetic accounts only; rollback always.
begin;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid;owner_role text:=current_user;k uuid:=gen_random_uuid();cid uuid;x jsonb;failed boolean;
begin
 insert into auth.users(id) values(a),(b),(c);
 foreach u in array array[a,b,c] loop
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 perform public.create_profile('coop_'||substr(replace(u::text,'-',''),1,13),0);execute format('set local role %I',owner_role);end loop;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 cid:=public.create_cooperative_challenge('sport',array[b],k);
 if cid is distinct from public.create_cooperative_challenge('sport',array[b],k) then raise exception 'Retry is not idempotent';end if;
 failed:=false;begin perform public.create_cooperative_challenge('walk',array[b],k);exception when others then failed:=true;end;if not failed then raise exception 'Changed retry accepted';end if;
 failed:=false;begin perform public.create_cooperative_challenge('sport',array[c],gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Nonfriend accepted';end if;
 perform public.record_action('sport-15',4,gen_random_uuid());perform public.record_action('sport-15',4,gen_random_uuid());
 x:=public.get_cooperative_hub()->'challenges'->0;
 if (x->>'my_progress')::int is distinct from 60 or (x->>'progress')::int is distinct from 60 then raise exception 'Daily cap';end if;
 failed:=false;begin execute 'select * from private.cooperative_members';exception when others then failed:=true;end;if not failed then raise exception 'Raw table readable';end if;
 execute format('set local role %I',owner_role);
 perform set_config('request.jwt.claim.sub',c::text,true);execute 'set local role authenticated';
 if jsonb_array_length(public.get_cooperative_hub()->'challenges') is distinct from 0 then raise exception 'Third party read';end if;
 execute format('set local role %I',owner_role);
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 perform public.record_action('sport-15',1,gen_random_uuid());
 perform public.respond_cooperative_challenge(cid,true);perform public.respond_cooperative_challenge(cid,true);
 x:=public.get_cooperative_hub()->'challenges'->0;
 if (x->>'my_progress')::int is distinct from 0 then raise exception 'Preconsent actions counted';end if;
 perform public.record_action('beer',1,gen_random_uuid());perform public.record_action('gin-cocktail',1,gen_random_uuid());
 if (public.get_cooperative_hub()->'challenges'->0->>'my_progress')::int is distinct from 0 then raise exception 'Alcohol eligible';end if;
 perform public.record_action('sport-15',4,gen_random_uuid());
 if (public.get_cooperative_hub()->'challenges'->0->>'my_progress')::int is distinct from 60 then raise exception 'Postaccept cap uses preaccept actions';end if;
 if jsonb_array_length(public.get_consumption_summary(7)->'items') is distinct from 2 then raise exception 'Consumption summary';end if;
 execute format('set local role %I',owner_role);
 -- Lower target in owner fixture to exercise settlement and immutable result.
 update private.cooperative_challenges set target=120 where id=cid;
 execute 'set local role authenticated';x:=public.get_cooperative_hub()->'challenges'->0;
 if x->>'status' is distinct from 'completed' or x->'badge' is distinct from 'true'::jsonb then raise exception 'Completion/badge';end if;
 perform public.leave_cooperative_challenge(cid);
 if public.get_cooperative_hub()->'challenges'->0 is distinct from x then raise exception 'Successful snapshot changed';end if;
 if jsonb_array_length(public.export_my_data()->'cooperative_badges') is distinct from 1 then raise exception 'Badge export';end if;
 execute format('set local role %I',owner_role);
 if (select count(*) from private.cooperative_badges where challenge_id=cid) is distinct from 2::bigint then raise exception 'Two contributors badge';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';cid:=public.create_cooperative_challenge('walk',array[b],gen_random_uuid());execute format('set local role %I',owner_role);
 insert into public.blocks(blocker,blocked) values(b,a);
 execute 'set local role authenticated';x:=public.get_cooperative_hub();execute format('set local role %I',owner_role);
 if exists(select 1 from private.cooperative_members where challenge_id=cid and status in('accepted','invited')) then raise exception 'Blocked membership retained';end if;
 if has_function_privilege('anon','public.get_cooperative_hub()','EXECUTE') or has_function_privilege('authenticated','private.refresh_cooperative_challenges()','EXECUTE') then raise exception 'Helper ACL';end if;
 raise notice 'Cooperative assertions passed';
end $test$;
rollback;
