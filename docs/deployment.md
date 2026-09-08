# Héberger le jeu web

Le jeu est une application Next.js pour navigateur. Aucun SDK iOS/Android et aucune publication en store. L’URL peut utiliser votre propre domaine. Vercel est la cible initiale ; `npm run build` puis `npm start` permettent aussi un hébergement Node compatible. Supabase reste le backend SaaS prévu par le brief.

1. Créer un projet Supabase **de développement**, séparé de la production. Aucun Docker requis.
2. Dans SQL Editor, exécuter `supabase/install.sql` (tables, catalogue et Realtime, en une transaction). L’alternative détaillée reste `supabase/init.sql`, puis `supabase/seed.sql` et les publications de `supabase/jobs.sql`. Le script initial est atomique et cible un projet vierge : sa réexécution échoue sans suppression. Pour une installation par migrations, appliquer `202609080001_initial.sql` à la place de `init.sql`, jamais les deux. Seed peut être rejoué sans changer les barèmes existants.
Appliquer ensuite `supabase/update-community-notifications.sql` une seule fois pour les nouvelles fonctions. Pour une base déjà installée, appliquer uniquement cette mise à jour (équivalent aux migrations 002 puis 003).

3. Dans Auth, activer email/mot de passe et la confirmation email. Configurer le service email nécessaire au volume attendu. Autoriser exactement `http://127.0.0.1:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback?next=/auth?recovery=1` et les équivalents HTTPS du domaine retenu. Site URL : l’origine du jeu. Ne pas mettre un wildcard universel en production.
4. Les emails peuvent utiliser le flux PKCE standard ou le template `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (et `type=recovery` pour réinitialisation) afin de fonctionner depuis un autre navigateur. Ce chemin vérifie l’OTP ; aucune redirection arbitraire n’est acceptée.
5. Copier `.env.example` vers `.env.local` et remplacer URL et clé publishable. `NEXT_PUBLIC_SUPABASE_ANON_KEY` est accepté en fallback legacy. Aucune clé secrète côté client. Sans variable, l’accueil ouvre uniquement la démo. Une configuration partielle produit un message explicite.
6. Activer Cron dans Supabase Integrations puis exécuter `supabase/jobs.sql` après vérification du projet. Il ajoute les publications de notifications et de score, et programme la clôture toutes les cinq minutes. En complément, les RPC rattrapent les saisons en retard.
7. Exécuter les contrôles de `docs/testing.md` avec un projet SaaS de test et deux comptes dédiés, puis vérifier les scénarios de concurrence et Realtime avant ouverture réelle.
8. Pour Vercel : importer le dépôt, framework Next.js, build `npm run build`, variables publiques correspondant à l’environnement. Les previews pointent exclusivement sur le projet de test/développement. Aucune migration automatique pendant le build. Aucun job de production dans une preview.

## Notifications
Les notifications persistantes d’amis/duels et Realtime sont câblées. Les activités ne sont partagées qu’après activation volontaire dans les réglages. Le Web Push est implémenté avec consentement du navigateur, service worker et file serveur ; son activation nécessite le déploiement/configuration détaillé dans [web-push.md](web-push.md). Le jeu fonctionne sans push.

## Mise à jour amis, admin et compétitions
Pour le projet viegame déjà installé, suivre [admin-competitions.md](admin-competitions.md) : exécuter une fois `supabase/update-admin-competitions.sql` (004 + activation vérifiée de `bfe@nomios.fr`), puis éventuellement `supabase/events-jobs.sql`, et pousser les fichiers sur la branche GitHub de production de Vercel. Aucune nouvelle variable serveur ou publique n’est ajoutée. Ne pas réexécuter les anciennes installations.

## Avant ouverture publique
Finaliser les mécanismes avancés demandés, la suppression/export complet des relations de jeu, la politique de conservation, les tests SQL multi-utilisateurs et la recette navigateur décrits dans les documents. Rien n’a été déployé ou migré à distance durant cette réalisation.

## Documentation officielle consultée
- Next.js : https://nextjs.org/docs/app/getting-started/installation
- Supabase SSR : https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase RLS : https://supabase.com/docs/guides/database/postgres/row-level-security

## Configuration locale — 8 septembre 2026
URL et clé publique configurées dans `.env.local`, fichier ignoré par Git. La clé secrète reçue n’a pas été enregistrée ni utilisée. Installation `install.sql` effectuée par l’utilisateur. Vérification publique après installation : Auth répond HTTP 200, email activé ; catalogue, profils, journal et RPC `get_game_state` sont présents et refusent les accès anonymes (HTTP 401, PostgreSQL 42501). Aucune mutation distante n’a été exécutée par l’agent. Restent la vérification des URL Auth, l’activation de Cron (étape 6) et les tests avec des comptes authentifiés.
