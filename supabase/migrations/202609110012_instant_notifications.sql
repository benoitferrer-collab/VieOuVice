-- Apply after 011. No historical alerts are sent during installation.
begin;
create or replace function private.notify_action_social() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_event text;v_name text;n public.nemesis_pairs;v_after integer;v_other integer;v_rival uuid;v_league_delta integer;
begin
 perform pg_advisory_xact_lock(738291);
 v_league_delta:=case when new.kind='excess' then greatest(-new.minutes_impact,0) else 0 end;
 v_event:=new.id::text;
 if exists(select 1 from public.user_settings where user_id=new.user_id and share_activity) then
  select nickname into v_name from public.users where id=new.user_id;
  insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key)
  select r.recipient,v_name||' a déclaré « '||new.label||' » ('||case when new.minutes_impact>0 then '+' else '' end||new.minutes_impact||' min de vie).',
   'friend_action',new.user_id,'amis','friend_action:'||r.recipient||':'||new.user_id||':'||v_event
  from (select case when f.requester=new.user_id then f.recipient else f.requester end as recipient
   from public.friendships f where f.status='accepted' and (f.requester=new.user_id or f.recipient=new.user_id)) r
  join public.user_settings pref on pref.user_id=r.recipient and pref.notify_friends
  where r.recipient<>new.user_id and not private.is_blocked(new.user_id,r.recipient)
  on conflict(event_key) do nothing;
 end if;
 -- PostgreSQL exécute les AFTER ROW triggers par nom : z_ suit action_to_ledger.
 -- La projection inclut donc déjà cet impact. Aucun détail d'action n'est révélé
 -- aux adversaires ; seul un changement du classement est annoncé.
 for n in select * from public.nemesis_pairs where season_id=new.season_id and (user_a=new.user_id or user_b=new.user_id) loop
  v_rival:=case when n.user_a=new.user_id then n.user_b else n.user_a end;
  select weekly_score into v_after from public.leaderboard_entries where user_id=new.user_id and season_id=new.season_id;
  select weekly_score into v_other from public.leaderboard_entries where user_id=v_rival and season_id=new.season_id;
  if sign(v_after-v_other) is distinct from sign(v_after-v_league_delta-v_other) then
   perform private.emit_duel_notifications(new.season_id,n.user_a,n.user_b,'duel_lead',v_event);
  end if;
 end loop;
 return new;
end$$;
revoke all on function private.notify_action_social() from public,anon,authenticated,service_role;


-- Keep the existing privacy/membership model; one alert per first reaction pair.
-- processed_at is a permanent tombstone, including when preferences are off.
create or replace function private.flush_reaction_digests(p_recipient uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r record; notice_id uuid; v_now timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(738291);
 perform private.refresh_reaction_digests();
 for r in select ar.*,a.user_id recipient from private.action_reactions ar join public.actions a on a.id=ar.action_id
 where ar.processed_at is null and (p_recipient is null or a.user_id=p_recipient)
 loop
  update private.action_reactions set processed_at=v_now where action_id=r.action_id and actor_id=r.actor_id;
  if r.first_reacted_at<v_now-interval '24 hours' or r.reaction is null then continue;end if;
  if not private.reaction_allowed(r.actor_id,r.action_id,v_now) or not exists(
   select 1 from public.user_settings where user_id=r.recipient and notify_reactions and notify_friends
  ) then continue;end if;
  notice_id:=gen_random_uuid();
  insert into private.reaction_digest_members(notification_id,action_id,actor_id) values(notice_id,r.action_id,r.actor_id);
  insert into public.notifications(id,user_id,message,kind,actor_id,target_tab,event_key)
  values(notice_id,r.recipient,'Tu as reçu un encouragement sur une déclaration.','reaction_digest',null,'survie',
   'reaction_instant:'||r.action_id||':'||r.actor_id);
 end loop;
 delete from private.reaction_mutations where created_at<least(private.day_start(v_now),v_now-interval '1 minute');
end$$;
create or replace function private.set_action_reaction(p_action_id uuid,p_reaction text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();v_now timestamptz:=clock_timestamp();previous text;begin
 perform pg_advisory_xact_lock(738291);
 if p_reaction is not null and p_reaction not in('clap','strength','laugh') then raise exception 'Encouragement invalide.';end if;
 if not private.reaction_allowed(u,p_action_id,v_now) then raise exception 'Déclaration indisponible pour les encouragements.';end if;
 select reaction into previous from private.action_reactions where actor_id=u and action_id=p_action_id;
 if previous is not distinct from p_reaction then return private.encouragement_value(u,p_action_id,v_now);end if;
 if (select count(*) from private.reaction_mutations where actor_id=u and created_at>=private.day_start(v_now))>=100 then raise exception 'Limite de 100 encouragements par jour atteinte.';end if;
 if (select count(*) from private.reaction_mutations where actor_id=u and created_at>v_now-interval '1 minute')>=20 then raise exception 'Trop d’encouragements. Patiente une minute.';end if;
 insert into private.reaction_mutations(actor_id,created_at) values(u,v_now);
 insert into private.action_reactions(action_id,actor_id,reaction,first_reacted_at,updated_at) values(p_action_id,u,p_reaction,v_now,v_now)
 on conflict(action_id,actor_id) do update set reaction=excluded.reaction,updated_at=excluded.updated_at;
 perform private.flush_reaction_digests((select user_id from public.actions where id=p_action_id));
 return private.encouragement_value(u,p_action_id,v_now);
end$$;

-- pg_net queues HTTP until commit. Vault values stay server-side. Missing
-- extensions/configuration must never prevent a player from saving an action.
create function private.request_push_dispatch() returns boolean
language plpgsql security definer set search_path='' as $$
declare dispatch_url text; dispatch_token text;
begin
 if current_setting('viegame.push_requested',true)='1' then return false;end if;
 if not exists(select 1 from private.push_outbox q join public.notifications n on n.id=q.notification_id
  where q.status='pending' and q.available_at<=clock_timestamp() and q.attempts<5
  and n.created_at>clock_timestamp()-interval '24 hours'
  and not private.notification_quiet_at(n.user_id,clock_timestamp())) then return false;end if;
 if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then return false;end if;
 select decrypted_secret into dispatch_url from vault.decrypted_secrets where name='viegame_push_dispatch_url';
 select decrypted_secret into dispatch_token from vault.decrypted_secrets where name='viegame_push_dispatch_token';
 if dispatch_url is distinct from 'https://viegame.vercel.app/api/push/dispatch' or length(coalesce(dispatch_token,''))<32 then return false;end if;
 perform net.http_post(url:=dispatch_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||dispatch_token),body:='{}'::jsonb,timeout_milliseconds:=60000);
 perform set_config('viegame.push_requested','1',true);
 return true;
exception when others then
 -- Do not expose Vault values through an exception/log. Cron remains the fallback.
 return false;
end$$;
create function private.wake_push_outbox() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform private.request_push_dispatch();return null;
end$$;
create trigger wake_push_outbox after insert on private.push_outbox for each statement execute function private.wake_push_outbox();
create function public.request_push_dispatch() returns boolean language sql security invoker set search_path='' as $$select private.request_push_dispatch()$$;
revoke all on function private.request_push_dispatch(),public.request_push_dispatch(),private.wake_push_outbox() from public,anon,authenticated,service_role;
grant execute on function private.request_push_dispatch(),public.request_push_dispatch() to service_role;
revoke all on function private.flush_reaction_digests(uuid),private.set_action_reaction(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.set_action_reaction(uuid,text) to authenticated;
commit;
