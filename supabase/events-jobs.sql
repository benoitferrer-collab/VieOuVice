-- OPTIONAL: execute manually as database owner after enabling pg_cron in Supabase.
-- No JWT or network required. Page reads also close overdue competitions.
-- Idempotent installation by a stable job name.
do $$begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Activer pg_cron avant ce script facultatif.';end if;
 if exists(select 1 from cron.job where jobname='close-due-competitions') then perform cron.unschedule('close-due-competitions');end if;
 perform cron.schedule('close-due-competitions','*/5 * * * *','select private.close_due_competitions()');
end$$;
