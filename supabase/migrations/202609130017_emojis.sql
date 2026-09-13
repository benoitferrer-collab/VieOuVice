-- Apply after 016. Recipes contain only fixed enums; provider output is never code.
begin;
create function private.valid_emoji_recipe(r jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(r)='object' and r ?& array['face','color','expression','accessory'] and (r-'face'-'color'-'expression'-'accessory')='{}'::jsonb
 and r->>'face' in('round','cat','bear') and r->>'color' in('gold','rose','mint','sky') and r->>'expression' in('smile','laugh','wink','love') and r->>'accessory' in('none','crown','party','star'),false)
$$;
create table private.emoji_generations(
 id uuid primary key,actor_id uuid references public.users(id) on delete set null,
 theme text not null check(theme in('joie','courage','fête','calme')),created_at timestamptz not null default clock_timestamp(),
 source text check(source in('ai','fallback')),recipe jsonb check(recipe is null or private.valid_emoji_recipe(recipe)),
 check((source is null)=(recipe is null))
);
create index emoji_generations_time on private.emoji_generations(created_at);
create table private.emoji_catalog(
 id uuid primary key references private.emoji_generations(id),creator_id uuid references public.users(id) on delete set null,
 label text not null check(label in('joie','courage','fête','calme')),recipe jsonb not null check(private.valid_emoji_recipe(recipe)),
 source text not null check(source in('ai','fallback')),active boolean not null default true,created_at timestamptz not null default clock_timestamp()
);
alter table private.emoji_generations enable row level security;
alter table private.emoji_catalog enable row level security;
revoke all on private.emoji_generations,private.emoji_catalog from public,anon,authenticated,service_role;
create function public.reserve_ai_emoji(p_actor uuid,p_id uuid,p_theme text) returns jsonb language plpgsql security definer set search_path='' as $$
declare row private.emoji_generations;
begin
 perform pg_advisory_xact_lock(738291);
 perform pg_advisory_xact_lock(738292);
 if not exists(select 1 from private.player_access where user_id=p_actor and is_admin and not suspended) then raise exception 'Administration requise.';end if;
 select * into row from private.emoji_generations where id=p_id;
 if found then
  if row.actor_id is distinct from p_actor or row.theme is distinct from p_theme then raise exception 'Reprise différente.';end if;
  return jsonb_build_object('claimed',false,'batch',to_jsonb(row)-'actor_id');
 end if;
 if (select count(*) from private.emoji_generations where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=10 then raise exception 'Les dix générations d’emojis du jour sont utilisées.';end if;
 if exists(select 1 from private.emoji_generations where created_at>clock_timestamp()-interval '10 seconds') then raise exception 'Patiente quelques secondes.';end if;
 insert into private.emoji_generations(id,actor_id,theme) values(p_id,p_actor,p_theme) returning * into row;
 return jsonb_build_object('claimed',true,'batch',to_jsonb(row)-'actor_id');
end$$;
create function public.finish_ai_emoji(p_actor uuid,p_id uuid,p_source text,p_recipe jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row private.emoji_generations;
begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.player_access where user_id=p_actor and is_admin and not suspended) then raise exception 'Administration requise.';end if;
 select * into row from private.emoji_generations where id=p_id and actor_id=p_actor for update;
 if not found then raise exception 'Génération indisponible.';end if;
 if row.recipe is null then
  if p_source is null or p_recipe is null then raise exception 'Composition requise.';end if;
  update private.emoji_generations set source=p_source,recipe=p_recipe where id=p_id returning * into row;
 end if;
 return to_jsonb(row)-'actor_id';
end$$;
create function public.admin_emoji_history() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.assert_admin();return coalesce((select jsonb_agg(to_jsonb(g)-'actor_id' order by created_at desc) from (select * from private.emoji_generations order by created_at desc limit 30)g),'[]');end$$;
create function public.get_emoji_catalog() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.assert_user();return coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'recipe',recipe,'source',source) order by created_at desc) from private.emoji_catalog where active),'[]');end$$;
create function public.admin_publish_emoji(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_admin();perform pg_advisory_xact_lock(738292);
 if (select count(*) from private.emoji_catalog where active and id<>p_id)>=100 then raise exception 'Catalogue limité à 100 emojis. Retire un emoji avant de publier.';end if;
 insert into private.emoji_catalog(id,creator_id,label,recipe,source) select id,actor_id,theme,recipe,source from private.emoji_generations where id=p_id and recipe is not null on conflict(id) do update set active=true;
 if not found then raise exception 'Composition indisponible.';end if;
end$$;
create function public.admin_archive_emoji(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.assert_admin();update private.emoji_catalog set active=false where id=p_id;end$$;
alter table private.friend_messages add column emoji_id uuid,add column emoji_snapshot jsonb;
alter table private.friend_messages add constraint message_emoji_snapshot check((emoji_id is null and emoji_snapshot is null) or (emoji_id is not null and emoji_snapshot is not null and private.valid_emoji_recipe(emoji_snapshot)));
-- No catalogue FK: sent snapshots remain valid independently of catalogue retirement.
create or replace function private.message_json(m private.friend_messages) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',m.id::text,'sender_id',m.sender_id,'recipient_id',m.recipient_id,'body',m.body,'created_at',m.created_at,'read_at',m.read_at,'emoji_id',m.emoji_id,'emoji_snapshot',m.emoji_snapshot,
 'reactions',coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'reaction',r.reaction) order by r.user_id) from private.message_reactions r where r.message_id=m.id),'[]'::jsonb))
$$;
-- Both text and stickers serialize on the same sender, sharing quota and keys.
alter function private.send_friend_message(uuid,text,uuid) rename to send_friend_message_before_emojis;
create function private.send_friend_message(p_friend uuid,p_body text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,917));
 if exists(select 1 from private.friend_messages where sender_id=u and idempotency_key=p_key and emoji_id is not null) then raise exception 'Reprise différente du message initial.';end if;
 return private.send_friend_message_before_emojis(p_friend,p_body,p_key);
end$$;
create function public.send_friend_emoji(p_friend uuid,p_emoji uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();e private.emoji_catalog;m private.friend_messages;sent jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text,917));
 if not private.message_pair_allowed(u,p_friend) then raise exception 'Conversation indisponible. Amitié acceptée requise.';end if;
 if p_key is null or p_emoji is null then raise exception 'Emoji et clé requis.';end if;
 select * into m from private.friend_messages where sender_id=u and idempotency_key=p_key;
 if found then
  if m.recipient_id is distinct from p_friend or m.emoji_id is distinct from p_emoji then raise exception 'Reprise différente du message initial.';end if;
  return private.message_json(m);
 end if;
 select * into e from private.emoji_catalog where id=p_emoji and active;
 if not found then raise exception 'Emoji indisponible. Actualise le catalogue.';end if;
 sent:=private.send_friend_message_before_emojis(p_friend,'Emoji : '||e.label,p_key);
 update private.friend_messages set emoji_id=e.id,emoji_snapshot=e.recipe where id=(sent->>'id')::bigint returning * into m;
 return private.message_json(m);
end$$;
revoke all on function private.valid_emoji_recipe(jsonb),public.reserve_ai_emoji(uuid,uuid,text),public.finish_ai_emoji(uuid,uuid,text,jsonb),public.admin_emoji_history(),public.get_emoji_catalog(),public.admin_publish_emoji(uuid),public.admin_archive_emoji(uuid),public.send_friend_emoji(uuid,uuid,uuid),private.send_friend_message_before_emojis(uuid,text,uuid),private.send_friend_message(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.reserve_ai_emoji(uuid,uuid,text),public.finish_ai_emoji(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.admin_emoji_history(),public.get_emoji_catalog(),public.admin_publish_emoji(uuid),public.admin_archive_emoji(uuid),public.send_friend_emoji(uuid,uuid,uuid),private.send_friend_message(uuid,text,uuid) to authenticated;
commit;
