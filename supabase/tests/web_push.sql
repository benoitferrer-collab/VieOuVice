-- Après install + migrations 002/003, dans un projet Supabase de TEST.
-- Exécution SQL Editor propriétaire ; aucun appel réseau, fixtures annulées.
-- Non exécuté par l’agent. Cette émulation JWT ne remplace pas les tests HTTP RLS.
begin;
do $test$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 notice_id uuid; job_id uuid; token uuid:=gen_random_uuid();
begin
 insert into auth.users(id) values(a),(b);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.create_profile('qa_'||substr(replace(a::text,'-',''),1,14),0);
 perform public.update_notification_settings(true,true,true);
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 perform public.create_profile('qa_'||substr(replace(b::text,'-',''),1,14),1);
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted');
 perform public.register_push_subscription('https://fcm.googleapis.com/qa-'||b,repeat('A',87),repeat('B',22));
 insert into public.notifications(user_id,message,kind,actor_id,target_tab,event_key)
 values(b,'Événement de test','friend_action',a,'amis','qa:'||gen_random_uuid()) returning id into notice_id;
 if not private.push_notification_eligible(notice_id) then raise exception 'Événement autorisé non éligible';end if;
 select id into job_id from private.push_outbox where notification_id=notice_id;
 if job_id is null then raise exception 'Événement non mis en file';end if;
 -- Louer uniquement notre fixture sans toucher aux autres jobs du projet.
 update private.push_outbox set status='leased',attempts=1,lease_token=token,lease_until=clock_timestamp()+interval '60 seconds' where id=job_id;
 if private.authorize_push_job(job_id,token) is null then raise exception 'Job autorisé rejeté';end if;
 perform public.read_notification(notice_id);
 perform public.update_notification_settings(false,false,true);
 perform public.update_notification_settings(false,true,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.update_notification_settings(false,true,true);
 perform public.update_notification_settings(true,true,true);
 if not exists(select 1 from public.notifications where id=notice_id and read_at is not null) then raise exception 'Historique lu supprimé';end if;
 if private.push_notification_eligible(notice_id) then raise exception 'Alerte lue réactivée après retrait de consentement';end if;
 if private.authorize_push_job(job_id,token) is not null then raise exception 'Job révoqué autorisé';end if;
 if (select status from private.push_outbox where id=job_id)<>'cancelled' then raise exception 'Job révoqué non annulé';end if;
 if has_function_privilege('authenticated','public.claim_push_job()','EXECUTE') or has_function_privilege('anon','public.authorize_push_job(uuid,uuid)','EXECUTE') then raise exception 'Worker exposé au navigateur';end if;
 if not has_function_privilege('service_role','public.claim_push_job()','EXECUTE') then raise exception 'Worker inaccessible au serveur';end if;
 raise notice 'Révocation push : OK (fixtures annulées)';
end $test$;
rollback;
