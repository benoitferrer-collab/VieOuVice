-- After 012; routes push to the new Messages tab without changing stored notices.
begin;
alter function private.authorize_push_job(uuid,uuid) rename to authorize_push_job_before_message_tab;
create function private.authorize_push_job(p_job_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare delivery jsonb;
begin
 delivery:=private.authorize_push_job_before_message_tab(p_job_id,p_lease_token);
 if delivery is not null and exists(
  select 1 from private.push_outbox q join public.notifications n on n.id=q.notification_id
  where q.id=p_job_id and n.kind='friend_message'
 ) then return delivery||jsonb_build_object('target_tab','messages');end if;
 return delivery;
end$$;
revoke all on function private.authorize_push_job_before_message_tab(uuid,uuid),private.authorize_push_job(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.authorize_push_job(uuid,uuid) to service_role;
commit;
