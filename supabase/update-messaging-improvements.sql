-- Apply once after 013. Private previews, bounded reactions and conversation links.
begin;
create table private.message_reactions(
 message_id bigint not null references private.friend_messages(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 reaction text not null check(reaction in('clap','strength','laugh','heart')),
 primary key(message_id,user_id)
);
create table private.message_reaction_mutations(user_id uuid not null references public.users(id) on delete cascade,created_at timestamptz not null default clock_timestamp());
create index message_reaction_quota on private.message_reaction_mutations(user_id,created_at);
alter table private.message_reactions enable row level security;
alter table private.message_reaction_mutations enable row level security;
revoke all on private.message_reactions,private.message_reaction_mutations from public,anon,authenticated,service_role;
create or replace function private.message_json(m private.friend_messages) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',m.id::text,'sender_id',m.sender_id,'recipient_id',m.recipient_id,'body',m.body,'created_at',m.created_at,'read_at',m.read_at,
 'reactions',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'reaction',r.reaction) order by r.user_id) from private.message_reactions r where r.message_id=m.id),'[]'::jsonb))
$$;
alter function private.get_message_inbox() rename to get_message_inbox_before_previews;
create function private.get_message_inbox() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();base jsonb;items jsonb;
begin
 base:=private.get_message_inbox_before_previews();
 select coalesce(jsonb_agg(c.value||jsonb_build_object('last_message',(
  select jsonb_build_object('body',left(m.body,120),'sender_id',m.sender_id,'created_at',m.created_at)
  from private.friend_messages m
  where least(m.sender_id,m.recipient_id)=least(u,(c.value->>'friend_id')::uuid)
  and greatest(m.sender_id,m.recipient_id)=greatest(u,(c.value->>'friend_id')::uuid)
  order by m.id desc limit 1
 )) order by c.ordinality),'[]') into items from jsonb_array_elements(base->'conversations') with ordinality c;
 return base||jsonb_build_object('conversations',items);
end$$;
create function private.set_message_reaction(p_message_id bigint,p_reaction text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();m private.friend_messages;previous text;t timestamptz:=clock_timestamp();peer uuid;
begin
 select * into m from private.friend_messages where id=p_message_id;
 if not found or u not in(m.sender_id,m.recipient_id) then raise exception 'Message indisponible.';end if;
 peer:=case when u=m.sender_id then m.recipient_id else m.sender_id end;
 if not private.message_pair_allowed(u,peer) then raise exception 'Conversation indisponible.';end if;
 if p_reaction is not null and p_reaction not in('clap','strength','laugh','heart') then raise exception 'Réaction invalide.';end if;
 select reaction into previous from private.message_reactions where message_id=m.id and user_id=u;
 if previous is not distinct from p_reaction then return private.message_json(m);end if;
 delete from private.message_reaction_mutations where created_at<least(private.day_start(t),t-interval '1 minute');
 if (select count(*) from private.message_reaction_mutations where user_id=u and created_at>t-interval '1 minute')>=20 or
 (select count(*) from private.message_reaction_mutations where user_id=u and created_at>=private.day_start(t))>=200 then raise exception 'Trop de réactions. Réessaie plus tard.';end if;
 insert into private.message_reaction_mutations(user_id,created_at) values(u,t);
 if p_reaction is null then delete from private.message_reactions where message_id=m.id and user_id=u;
 else insert into private.message_reactions(message_id,user_id,reaction) values(m.id,u,p_reaction) on conflict(message_id,user_id) do update set reaction=excluded.reaction;end if;
 return private.message_json(m);
end$$;
create function public.set_message_reaction(p_message_id bigint,p_reaction text) returns jsonb language sql security invoker set search_path='' as $$select private.set_message_reaction(p_message_id,p_reaction)$$;
alter function private.authorize_push_job(uuid,uuid) rename to authorize_push_job_before_conversation_link;
create function private.authorize_push_job(p_job_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare delivery jsonb;actor uuid;
begin
 delivery:=private.authorize_push_job_before_conversation_link(p_job_id,p_lease_token);
 if delivery is null then return null;end if;
 select n.actor_id into actor from private.push_outbox q join public.notifications n on n.id=q.notification_id where q.id=p_job_id and n.kind='friend_message';
 if actor is not null then delivery:=delivery||jsonb_build_object('friend_id',actor);end if;
 return delivery;
end$$;
revoke all on function private.get_message_inbox_before_previews(),private.get_message_inbox(),private.set_message_reaction(bigint,text),public.set_message_reaction(bigint,text),private.authorize_push_job_before_conversation_link(uuid,uuid),private.authorize_push_job(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.get_message_inbox(),private.set_message_reaction(bigint,text),public.set_message_reaction(bigint,text) to authenticated;
grant execute on function private.authorize_push_job(uuid,uuid) to service_role;
commit;
