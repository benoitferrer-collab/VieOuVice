-- Apply once after 001–017. Retain original indexes and quota reservations.
begin;
select pg_advisory_xact_lock(738291);
alter table private.ai_challenge_batches add column deleted_at timestamptz;
-- Existing three-slot array check also accepts null tombstones inside the array.
create or replace function public.reserve_ai_challenges(p_actor uuid,p_id uuid,p_theme text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row private.ai_challenge_batches;
begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.player_access where user_id=p_actor and is_admin and not suspended) then raise exception 'Administration requise.';end if;
 select * into row from private.ai_challenge_batches where id=p_id;
 if found then
  if row.actor_id<>p_actor or row.theme<>p_theme then raise exception 'Reprise différente.';end if;
  return jsonb_build_object('claimed',false,'deleted',row.deleted_at is not null,'batch',to_jsonb(row)-'actor_id');
 end if;
 if (select count(*) from private.ai_challenge_batches where created_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=10 then raise exception 'Les dix générations du jour sont utilisées. Réutilise les propositions enregistrées.';end if;
 if exists(select 1 from private.ai_challenge_batches where created_at>clock_timestamp()-interval '10 seconds') then raise exception 'Patiente quelques secondes avant une nouvelle génération.';end if;
 insert into private.ai_challenge_batches(id,actor_id,theme) values(p_id,p_actor,p_theme) returning * into row;
 return jsonb_build_object('claimed',true,'batch',to_jsonb(row)-'actor_id');
end$$;
create or replace function public.finish_ai_challenges(p_actor uuid,p_id uuid,p_source text,p_suggestions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row private.ai_challenge_batches;
begin
 perform pg_advisory_xact_lock(738291);
 if not exists(select 1 from private.player_access where user_id=p_actor and is_admin and not suspended) then raise exception 'Administration requise.';end if;
 select * into row from private.ai_challenge_batches where id=p_id and actor_id=p_actor for update;
 if not found then raise exception 'Génération indisponible.';end if;
 if row.suggestions is null and row.deleted_at is null then
  update private.ai_challenge_batches set source=p_source,suggestions=p_suggestions where id=p_id returning * into row;
 end if;
 return to_jsonb(row)-'actor_id';
end$$;
create or replace function public.admin_ai_history() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_admin();
 return coalesce((select jsonb_agg(to_jsonb(b)-'actor_id' order by b.created_at desc) from (select * from private.ai_challenge_batches where suggestions is not null and deleted_at is null order by created_at desc limit 20)b),'[]');
end$$;

create function public.admin_delete_ai_proposal(p_batch_id uuid,p_index integer,p_confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; row private.ai_challenge_batches; expected text;
begin
 perform pg_advisory_xact_lock(738291);
 actor:=private.assert_admin();
 if p_batch_id is null or (p_index is not null and (p_index<0 or p_index>2)) then raise exception 'Proposition invalide.';end if;
 select * into row from private.ai_challenge_batches where id=p_batch_id for update;
 if not found or row.suggestions is null or row.deleted_at is not null then raise exception 'Lot indisponible.';end if;
 if p_index is null then expected:='Lot '||row.theme||' · '||row.id::text;
 else expected:=row.suggestions->p_index->>'title';end if;
 if expected is null or p_confirmation is distinct from expected then raise exception 'Confirmation incorrecte ou proposition indisponible.';end if;
 if p_index is null then row.suggestions:='[null,null,null]'::jsonb;
 else row.suggestions:=jsonb_set(row.suggestions,array[p_index::text],'null'::jsonb);end if;
 update private.ai_challenge_batches set suggestions=row.suggestions,
  deleted_at=case when row.suggestions='[null,null,null]'::jsonb then clock_timestamp() else null end where id=p_batch_id;
 insert into private.admin_audit(actor_id,action,target_id,reason)
 values(actor,case when p_index is null then 'delete_ai_batch' else 'delete_ai_proposal' end,p_batch_id::text,
  case when p_index is null then 'Suppression du lot confirmée' else 'Suppression confirmée, emplacement '||p_index::text end);
 return public.admin_ai_history();
end$$;
revoke all on function public.admin_delete_ai_proposal(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_delete_ai_proposal(uuid,integer,text) to authenticated;
commit;
