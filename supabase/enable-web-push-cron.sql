-- Projet cible : life / vgbmyjodwdxrvycnpsho.
-- Après migrations 002/003 et configuration des variables Vercel Production.
-- Les deux secrets Vault sont configurés séparément : aucune clé dans ce script.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $check$
declare endpoint text; token text;
begin
 if to_regprocedure('public.claim_push_job()') is null then
  raise exception 'Appliquer la migration Web Push 003 avant activation.';
 end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='viegame_push_dispatch_url';
 select decrypted_secret into token from vault.decrypted_secrets where name='viegame_push_dispatch_token';
 if endpoint is distinct from 'https://viegame.vercel.app/api/push/dispatch' then
  raise exception 'Configurer viegame_push_dispatch_url dans Vault avec le point d’envoi Vercel.';
 end if;
 if token is null or length(token)<32 then
  raise exception 'Configurer viegame_push_dispatch_token dans Vault avec WEB_PUSH_DISPATCH_SECRET.';
 end if;
end $check$;
-- Le même nom met à jour la tâche existante, sans créer un second déclencheur.
select cron.schedule('viegame-web-push', '* * * * *', $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='viegame_push_dispatch_url'),
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='viegame_push_dispatch_token')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
 );
$job$);
commit;

-- Vérification sans afficher de clé ni de contenu utilisateur :
select jobname,schedule,active from cron.job where jobname='viegame-web-push';
-- Désactivation réversible : select cron.unschedule('viegame-web-push');
