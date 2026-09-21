-- 022: explicit excess ranking; existing event metrics and frozen results remain unchanged.
begin;
alter table private.competitions drop constraint competitions_metric_check;
alter table private.competitions add constraint competitions_metric_check
 check(metric in ('health_minutes','excess_minutes','net_minutes','category_minutes'));
create or replace function private.competition_standings(p_event_id uuid) returns table(user_id uuid,nickname text,avatar smallint,score bigint,rank bigint,action_count bigint) language sql stable security definer set search_path='' as $$
 select r.user_id,r.nickname,r.avatar,r.score,r.rank,r.action_count from private.competition_results r join private.competitions e on e.id=r.event_id where e.id=p_event_id and e.status='completed'
 union all
 select x.user_id,x.nickname,x.avatar,x.score,rank() over(order by x.score desc),x.action_count from (
 select m.user_id,u.nickname,u.avatar,coalesce(sum(case when e.metric='excess_minutes' then -a.minutes_impact::bigint else a.minutes_impact::bigint end),0)::bigint score,count(a.id) action_count
 from private.competitions e join private.competition_members m on m.event_id=e.id join public.users u on u.id=m.user_id
 left join public.actions a on a.user_id=m.user_id and a.created_at>=e.starts_at and a.created_at<e.ends_at and a.created_at>=m.joined_at
 and (e.metric='net_minutes' or (e.metric='excess_minutes' and a.kind='excess' and a.minutes_impact<0) or (a.kind='health' and a.minutes_impact>0 and (e.metric='health_minutes' or a.catalog_id=e.catalog_id)))
 where e.id=p_event_id and e.status<>'completed' group by m.user_id,u.nickname,u.avatar)x
$$;

revoke all on function private.competition_standings(uuid) from public,anon,authenticated;
commit;
