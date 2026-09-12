-- Admin-only suggestions; no automatic publication, no provider credentials.
begin;
create table private.ai_challenge_batches(
 id uuid primary key,actor_id uuid not null references public.users(id),theme text not null check(theme in('espace','jungle','pirates','zen','survivants')),
 created_at timestamptz not null default clock_timestamp(),source text check(source in('ai','fallback')),suggestions jsonb,
 check(suggestions is null or (jsonb_typeof(suggestions)='array' and jsonb_array_length(suggestions)=3))
);
create index ai_batches_time on private.ai_challenge_batches(created_at);
alter table private.ai_challenge_batches enable row level security;
revoke all on private.ai_challenge_batches from public,anon,authenticated,service_role;
create function public.reserve_ai_challenges(p_actor uuid,p_id uuid,p_theme text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row private.ai_challenge_batches;
begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.player_access where user_id=p_actor and is_admin and not suspended) then raise exception 'Administration requise.';end if;
 select * into row from private.ai_challenge_batches where id=p_id;
 if found then
  if row.actor_id<>p_actor or row.theme<>p_theme then raise exception 'Reprise différente.';end if;
  return jsonb_build_object('claimed',false,'batch',to_jsonb(row)-'actor_id');
 end if;
 if (select count(*) from private.ai_challenge_batches where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=10 then raise exception 'Les dix générations du jour sont utilisées. Réutilise les propositions enregistrées.';end if;
 if exists(select 1 from private.ai_challenge_batches where created_at>clock_timestamp()-interval '10 seconds') then raise exception 'Patiente quelques secondes avant une nouvelle génération.';end if;
 insert into private.ai_challenge_batches(id,actor_id,theme) values(p_id,p_actor,p_theme) returning * into row;
 return jsonb_build_object('claimed',true,'batch',to_jsonb(row)-'actor_id');
end$$;
create function public.finish_ai_challenges(p_actor uuid,p_id uuid,p_source text,p_suggestions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row private.ai_challenge_batches;
begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.player_access where user_id=p_actor and is_admin and not suspended) then raise exception 'Administration requise.';end if;
 select * into row from private.ai_challenge_batches where id=p_id and actor_id=p_actor for update;
 if not found then raise exception 'Génération indisponible.';end if;
 if row.suggestions is null then
  update private.ai_challenge_batches set source=p_source,suggestions=p_suggestions where id=p_id returning * into row;
 end if;
 return to_jsonb(row)-'actor_id';
end$$;
create function public.admin_ai_history() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_admin();
 return coalesce((select jsonb_agg(to_jsonb(b)-'actor_id' order by b.created_at desc) from (select * from private.ai_challenge_batches where suggestions is not null order by created_at desc limit 20)b),'[]');
end$$;
revoke all on function public.reserve_ai_challenges(uuid,uuid,text),public.finish_ai_challenges(uuid,uuid,text,jsonb),public.admin_ai_history() from public,anon,authenticated,service_role;
grant execute on function public.reserve_ai_challenges(uuid,uuid,text),public.finish_ai_challenges(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.admin_ai_history() to authenticated;
commit;
