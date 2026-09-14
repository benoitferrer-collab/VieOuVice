-- Synthetic local fixtures; always rollback. Requires migrations 001–019.
begin;
create function pg_temp.identity_must_fail(command text) returns void language plpgsql as $$declare failed boolean:=false;begin
 begin execute command;exception when others then failed:=true;end;
 if not failed then raise exception 'Expected failure: %',command;end if;
end$$;
do $test$
declare c jsonb;r jsonb;p jsonb;u uuid:=gen_random_uuid();s uuid;t uuid;baseline jsonb;owner_name text:=current_user;
begin
 p:='{"season_name":"La Saison des Aurores","divisions":[{"name":"Les Étincelles","icon":"star","color":"gold","shape":"shield"},{"name":"Les Flammes","icon":"flame","color":"coral","shape":"circle"},{"name":"Les Feuilles","icon":"leaf","color":"mint","shape":"hexagon"},{"name":"Les Lunes","icon":"moon","color":"violet","shape":"circle"},{"name":"Les Couronnes","icon":"crown","color":"sky","shape":"shield"}]}';
 if has_function_privilege('authenticated','public.claim_season_identity()','execute') or has_function_privilege('anon','public.finish_season_identity(uuid,uuid,jsonb,text)','execute') or has_function_privilege('authenticated','private.get_game_state_before_season_identity()','execute') or has_function_privilege('service_role','private.valid_season_identity(jsonb)','execute') or has_table_privilege('service_role','private.season_identities','select') then raise exception 'Unsafe identity ACL';end if;
 if not has_function_privilege('service_role','public.claim_season_identity()','execute') then raise exception 'Missing service access';end if;
 insert into auth.users(id) values(u);perform set_config('request.jwt.claim.sub',u::text,true);perform public.create_profile('sid_'||substr(replace(u::text,'-',''),1,14),0);
 baseline:=public.get_game_state();
 perform pg_temp.identity_must_fail('select public.admin_season_identity()');
 execute 'set local role service_role';c:=public.claim_season_identity();execute format('set local role %I',owner_name);
 if c is null or not (c->>'generate')::boolean then raise exception 'First claim missing';end if;
 s:=(c->>'season_id')::uuid;t:=(c->>'lease_token')::uuid;
 if public.claim_season_identity() is not null then raise exception 'Duplicate claim';end if;
 if public.finish_season_identity(s,gen_random_uuid(),p,'ai') then raise exception 'Wrong token accepted';end if;
 perform pg_temp.identity_must_fail(format('select public.finish_season_identity(%L,%L,%L,''ai'')',s,t,(p||'{"html":"<script/>"}')::text));
 perform pg_temp.identity_must_fail(format('select public.finish_season_identity(%L,%L,%L,''ai'')',s,t,jsonb_set(p,'{divisions,0,icon}','"script"')::text));
 perform pg_temp.identity_must_fail(format('select public.finish_season_identity(%L,%L,%L,''ai'')',s,t,jsonb_set(p,'{season_name}','"https://evil.test"')::text));
 update private.season_identities set lease_until=clock_timestamp()-interval '1 second' where season_id=s;
 if public.finish_season_identity(s,t,p,'ai') then raise exception 'Expired finish accepted';end if;
 r:=public.claim_season_identity();if (r->>'generate')::boolean or r->>'lease_token'=t::text then raise exception 'Expiry granted second AI attempt';end if;
 if public.finish_season_identity(s,t,p,'ai') then raise exception 'Old token accepted';end if;
 t:=(r->>'lease_token')::uuid;
 perform pg_temp.identity_must_fail(format('select public.finish_season_identity(%L,%L,%L,''ai'')',s,t,p::text));
 -- A still-leased worker cannot finish after the season boundary.
 update public.seasons set ends_at=clock_timestamp()-interval '1 second' where id=s;
 if public.finish_season_identity(s,t,p,'fallback') then raise exception 'Ended season accepted';end if;
 update public.seasons set ends_at=(baseline->>'season_end')::timestamptz where id=s;
 if not public.finish_season_identity(s,t,p,'fallback') then raise exception 'Fallback not saved';end if;
 if public.finish_season_identity(s,t,p,'fallback') or public.claim_season_identity() is not null then raise exception 'Completed identity mutable';end if;
 execute 'set local role authenticated';r:=public.get_game_state();execute format('set local role %I',owner_name);
 if r->'season_identity'->>'season_name' is distinct from p->>'season_name' or r->'season_identity'->>'league_name' is distinct from 'Les Étincelles' or r->>'league_name' is distinct from baseline->>'league_name' or r->>'weekly_score' is distinct from baseline->>'weekly_score' or r->>'season_end' is distinct from baseline->>'season_end' then raise exception 'Presentation/scoring regression';end if;
 insert into private.player_access(user_id,is_admin,suspended) values(u,true,false);
 execute 'set local role authenticated';r:=public.admin_season_identity();execute format('set local role %I',owner_name);
 if r->>'status' is distinct from 'ready' or r ? 'lease_token' or r->'identity' is distinct from p then raise exception 'Admin status incorrect';end if;
 raise notice 'Season identity: ACL, claim, invalid recipe, expired lease, fallback-only recovery, CAS immutability and state passed';
end $test$;
rollback;
