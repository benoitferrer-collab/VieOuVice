-- Messages privés entre amis. Appliquer une fois après 001–008.
begin;
select pg_advisory_xact_lock(738291);
alter table public.user_settings add column notify_messages boolean not null default true;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check(kind in('system','friend_action','friend_accepted','duel_started','duel_lead','duel_finished','reaction_digest','friend_message'));
create table private.friend_messages (
 id bigint generated always as identity primary key,
 sender_id uuid not null references public.users(id),
 recipient_id uuid not null references public.users(id),
 body text not null check(char_length(body) between 1 and 2000 and body=btrim(body)),
 idempotency_key uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz,
 check(sender_id<>recipient_id), unique(sender_id,idempotency_key)
);
create index messages_pair on private.friend_messages(least(sender_id,recipient_id),greatest(sender_id,recipient_id),id desc);
create index messages_sender_time on private.friend_messages(sender_id,created_at);
create index messages_unread on private.friend_messages(recipient_id,sender_id,id) where read_at is null;
alter table private.friend_messages enable row level security;
revoke all on private.friend_messages from public,anon,authenticated,service_role;
revoke all on sequence private.friend_messages_id_seq from public,anon,authenticated,service_role;

create function private.message_pair_allowed(p_user uuid,p_friend uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(p_user<>p_friend and not private.is_blocked(p_user,p_friend)
 and not exists(select 1 from private.player_access where user_id in(p_user,p_friend) and suspended)
 and exists(select 1 from public.friendships where status='accepted' and least(requester,recipient)=least(p_user,p_friend) and greatest(requester,recipient)=greatest(p_user,p_friend)),false)
$$;
create function private.message_json(m private.friend_messages) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',m.id::text,'sender_id',m.sender_id,'recipient_id',m.recipient_id,'body',m.body,'created_at',m.created_at,'read_at',m.read_at)
$$;
create function private.get_message_inbox() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();items jsonb;enabled boolean;begin
 select notify_messages into enabled from public.user_settings where user_id=u;
 if not found then raise exception 'Profil requis.';end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by last_message_at desc nulls last,friend_id),'[]') into items from (
 select case when f.requester=u then f.recipient else f.requester end friend_id,
 (select count(*) from private.friend_messages m where m.recipient_id=u and m.sender_id=case when f.requester=u then f.recipient else f.requester end and m.read_at is null) unread_count,
 (select max(m.created_at) from private.friend_messages m where least(m.sender_id,m.recipient_id)=least(f.requester,f.recipient) and greatest(m.sender_id,m.recipient_id)=greatest(f.requester,f.recipient)) last_message_at
 from public.friendships f where (f.requester=u or f.recipient=u) and private.message_pair_allowed(u,case when f.requester=u then f.recipient else f.requester end)
 )c;
 return jsonb_build_object('enabled',enabled,'conversations',items,'unread_count',(select coalesce(sum((i->>'unread_count')::bigint),0) from jsonb_array_elements(items)i));
end$$;
create function private.get_friend_messages(p_friend uuid,p_before bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();items jsonb;more boolean;begin
 if not private.message_pair_allowed(u,p_friend) then raise exception 'Conversation indisponible. Amitié acceptée requise.';end if;
 if p_before is not null and p_before<=0 then raise exception 'Page invalide.';end if;
 select coalesce(jsonb_agg(private.message_json(m::private.friend_messages) order by m.id desc),'[]') into items from (
 select * from private.friend_messages where least(sender_id,recipient_id)=least(u,p_friend) and greatest(sender_id,recipient_id)=greatest(u,p_friend) and (p_before is null or id<p_before) order by id desc limit 30)m;
 select count(*)>30 into more from (select id from private.friend_messages where least(sender_id,recipient_id)=least(u,p_friend) and greatest(sender_id,recipient_id)=greatest(u,p_friend) and (p_before is null or id<p_before) order by id desc limit 31)q;
 return jsonb_build_object('messages',items,'has_more',more);
end$$;
create function private.send_friend_message(p_friend uuid,p_body text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();m private.friend_messages;t timestamptz:=clock_timestamp();begin
 if not private.message_pair_allowed(u,p_friend) then raise exception 'Conversation indisponible. Amitié acceptée requise.';end if;
 if p_key is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'Message requis : 1 à 2 000 caractères.';end if;
 select * into m from private.friend_messages where sender_id=u and idempotency_key=p_key;
 if found then
  if m.recipient_id is distinct from p_friend or m.body is distinct from btrim(p_body) then raise exception 'Reprise différente du message initial.';end if;
  return private.message_json(m);
 end if;
 if (select count(*) from private.friend_messages where sender_id=u and created_at>t-interval '1 minute')>=20 then raise exception 'Patiente une minute avant de renvoyer un message.';end if;
 if (select count(*) from private.friend_messages where sender_id=u and created_at>=private.day_start(t))>=200 then raise exception 'Limite de 200 messages par jour atteinte.';end if;
 insert into private.friend_messages(sender_id,recipient_id,body,idempotency_key,created_at) values(u,p_friend,btrim(p_body),p_key,t) returning * into m;
 insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key)
 select p_friend,'Tu as reçu un message privé. Ouvre tes conversations dans Amis.','friend_message',u,'amis','friend_message:'||m.id
 from public.user_settings where user_id=p_friend and notify_messages;
 return private.message_json(m);
end$$;
create function private.read_friend_messages(p_friend uuid,p_ids bigint[]) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 if not private.message_pair_allowed(u,p_friend) then raise exception 'Conversation indisponible.';end if;
 if p_ids is null or cardinality(p_ids)>30 then raise exception 'Maximum 30 messages par lecture.';end if;
 update private.friend_messages set read_at=clock_timestamp() where id=any(p_ids) and sender_id=p_friend and recipient_id=u and read_at is null;
 update public.notifications set read_at=clock_timestamp() where user_id=u and actor_id=p_friend and kind='friend_message' and read_at is null
 and event_key in(select 'friend_message:'||id from private.friend_messages where id=any(p_ids) and sender_id=p_friend and recipient_id=u);
end$$;
create function private.set_message_notifications(p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 if p_enabled is null then raise exception 'Réglage requis.';end if;
 update public.user_settings set notify_messages=p_enabled where user_id=u;
 if not found then raise exception 'Profil requis.';end if;
 if not p_enabled then update public.notifications set read_at=clock_timestamp() where user_id=u and kind='friend_message' and read_at is null;end if;
end$$;

alter function private.push_notification_eligible(uuid) rename to push_notification_eligible_before_messages;
create function private.push_notification_eligible(p_notification uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when n.kind='friend_message' then
 n.read_at is null and n.created_at>now()-interval '24 hours' and s.notify_messages
 and private.message_pair_allowed(n.user_id,n.actor_id)
 and exists(select 1 from private.friend_messages m where n.event_key='friend_message:'||m.id and m.sender_id=n.actor_id and m.recipient_id=n.user_id and m.read_at is null)
 else private.push_notification_eligible_before_messages(n.id) end from public.notifications n join public.user_settings s on s.user_id=n.user_id where n.id=p_notification),false)
$$;
create or replace function private.enqueue_notification_push() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if new.kind in('friend_action','friend_accepted','duel_started','duel_lead','duel_finished','reaction_digest','friend_message') and private.push_notification_eligible(new.id) then
 insert into private.push_outbox(notification_id,subscription_id) select new.id,s.id from private.push_subscriptions s where s.user_id=new.user_id on conflict do nothing;
 end if;return new;
end$$;
create function private.cleanup_message_visibility() returns trigger
language plpgsql security definer set search_path='' as $$begin
 delete from public.notifications where kind='friend_message' and not private.message_pair_allowed(user_id,actor_id);return null;
end$$;
create trigger messages_friendship_cleanup after insert or update or delete on public.friendships for each statement execute function private.cleanup_message_visibility();
create trigger messages_block_cleanup after insert or update or delete on public.blocks for each statement execute function private.cleanup_message_visibility();
create trigger messages_suspension_cleanup after insert or update or delete on private.player_access for each statement execute function private.cleanup_message_visibility();

alter function private.export_my_data() rename to export_my_data_before_messages;
create function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 return private.export_my_data_before_messages()||jsonb_build_object('private_messages',coalesce((select jsonb_agg(private.message_json(m) order by id) from private.friend_messages m where sender_id=u or recipient_id=u),'[]'));
end$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
create function public.get_message_inbox() returns jsonb language sql security invoker set search_path='' as $$select private.get_message_inbox()$$;
create function public.get_friend_messages(p_friend uuid,p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$select private.get_friend_messages(p_friend,p_before)$$;
create function public.send_friend_message(p_friend uuid,p_body text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.send_friend_message(p_friend,p_body,p_key)$$;
create function public.read_friend_messages(p_friend uuid,p_ids bigint[]) returns void language sql security invoker set search_path='' as $$select private.read_friend_messages(p_friend,p_ids)$$;
create function public.set_message_notifications(p_enabled boolean) returns void language sql security invoker set search_path='' as $$select private.set_message_notifications(p_enabled)$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname=any(array['message_pair_allowed','message_json','get_message_inbox','get_friend_messages','send_friend_message','read_friend_messages','set_message_notifications','push_notification_eligible','push_notification_eligible_before_messages','enqueue_notification_push','cleanup_message_visibility','export_my_data','export_my_data_before_messages']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('get_message_inbox','get_friend_messages','send_friend_message','read_friend_messages','set_message_notifications','export_my_data') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end$$;
commit;
