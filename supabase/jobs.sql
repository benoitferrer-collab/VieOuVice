-- À activer explicitement dans un projet de développement/test puis de production.
-- Supabase Dashboard > Integrations > Cron : activer pg_cron.
-- Ne pas exécuter depuis une preview. Fonctions non appelables par les joueurs.
select cron.schedule('exces-close-seasons','*/5 * * * *',$job$select private.ensure_season();$job$)
where not exists(select 1 from cron.job where jobname='exces-close-seasons');
-- Postgres Changes : données personnelles/projection seulement, jamais actions/ledger.
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='leaderboard_entries') then alter publication supabase_realtime add table public.leaderboard_entries;end if;
end$$;
