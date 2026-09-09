-- OPTIONAL owner-run job, after migration 005 and enabling pg_cron.
-- Encouragement/preferences reads also catch up. No network or secrets here.
do $$begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Activer pg_cron avant ce script facultatif.';end if;
 if exists(select 1 from cron.job where jobname='flush-reaction-digests') then perform cron.unschedule('flush-reaction-digests');end if;
 perform cron.schedule('flush-reaction-digests','*/5 * * * *','select private.flush_reaction_digests()');
end$$;
