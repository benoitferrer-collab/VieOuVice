-- Synthetic data only, run on a local database with competitions + migration 022.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid; e uuid;
  excess_id uuid; health_id uuid; season uuid; bad text; good text;
  payload jsonb; saved jsonb; request_id uuid:=gen_random_uuid(); failed boolean;
  anchor timestamptz:=clock_timestamp();
begin
  insert into auth.users(id) values(a),(b);
  foreach u in array array[a,b] loop
    perform set_config('request.jwt.claim.sub',u::text,true);
    perform public.create_profile('qa_'||substr(replace(u::text,'-',''),1,14),0);
  end loop;
  payload:=jsonb_build_object('id',null,'title','Top petits écarts','description','Test fictif',
    'starts_at',anchor+interval '1 day','ends_at',anchor+interval '2 days',
    'metric','excess_minutes','catalog_id',null,'badge_label','Badge test','badge_icon','trophy');
  failed:=false;
  begin perform public.admin_save_competition(payload,request_id); exception when others then failed:=true; end;
  if not failed then raise exception 'Non-admin created an event'; end if;
  insert into private.player_access(user_id,is_admin,suspended) values(a,true,false);
  perform set_config('request.jwt.claim.sub',a::text,true);
  saved:=public.admin_save_competition(payload,request_id);
  excess_id:=(saved->>'id')::uuid;
  if public.admin_save_competition(payload,request_id)<>saved then raise exception 'Retry changed draft'; end if;
  saved:=public.admin_save_competition(payload||jsonb_build_object('title','Top bonnes actions','metric','health_minutes'),gen_random_uuid());
  health_id:=(saved->>'id')::uuid;
  select id into bad from public.action_catalog where kind='excess' and active limit 1;
  select id into good from public.action_catalog where kind='health' and active limit 1;
  select season_id into season from public.league_memberships where user_id=a limit 1;
  foreach e in array array[excess_id,health_id] loop
    update private.competitions set starts_at=anchor-interval '2 days',ends_at=anchor-interval '1 day',status='published' where id=e;
    insert into private.competition_members(event_id,user_id,joined_at) values(e,a,anchor-interval '2 days'),(e,b,anchor-interval '2 days');
  end loop;
  insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
  (a,bad,'Loss A','excess',1,-50,1,season,anchor-interval '2 days',gen_random_uuid()),
  (a,good,'Recovery A','health',1,10,1,season,anchor-interval '36 hours',gen_random_uuid()),
  (b,bad,'Loss B','excess',1,-20,1,season,anchor-interval '36 hours',gen_random_uuid()),
  (b,good,'Recovery B','health',1,100,1,season,anchor-interval '36 hours',gen_random_uuid()),
  (b,bad,'End excluded','excess',1,-999,1,season,anchor-interval '1 day',gen_random_uuid()),
  (b,bad,'Before join excluded','excess',1,-999,1,season,anchor-interval '3 days',gen_random_uuid());
  if not exists(select 1 from private.competition_standings(excess_id) where user_id=a and rank=1 and score=50 and action_count=1) then raise exception 'Excess ranking incorrect'; end if;
  if not exists(select 1 from private.competition_standings(excess_id) where user_id=b and rank=2 and score=20) then raise exception 'Excess time boundaries incorrect'; end if;
  if not exists(select 1 from private.competition_standings(health_id) where user_id=b and rank=1 and score=100) then raise exception 'Health ranking regressed'; end if;
  perform private.close_due_competitions();
  if not exists(select 1 from private.competition_badges where event_id=excess_id and user_id=a and kind='winner') then raise exception 'Wrong winner badge'; end if;
  insert into public.actions(user_id,catalog_id,label,kind,quantity,minutes_impact,tariff_version,season_id,created_at,idempotency_key) values
  (b,bad,'Late insertion','excess',1,-999,1,season,anchor-interval '36 hours',gen_random_uuid());
  if not exists(select 1 from private.competition_standings(excess_id) where user_id=b and score=20 and rank=2) then raise exception 'Frozen result changed'; end if;
end $$;
rollback;
