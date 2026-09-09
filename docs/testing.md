# Vérifications

## Local
`npm test` : seuils signés, jauge bornée, promotions ligues incomplètes, dates Paris/DST, payload strict Zod, retry de démo et plafonds journaliers, identité init/migration.
`npm run typecheck` : TypeScript strict.
`npm run lint` : ESLint Next.js et hooks React.
`npm run build` : compilation de production.

Ces tests ne démarrent aucune base locale, Docker ni migration cloud.

## Supabase SaaS de test
Installer SQL/seed sur un projet dédié. Créer et confirmer deux comptes de test. Créer `.env.test` (ignoré par git) :
```
TEST_SUPABASE_URL=https://test-project.supabase.co
TEST_SUPABASE_PUBLIC_KEY=sb_publishable_...
TEST_A_EMAIL=...
TEST_A_PASSWORD=...
TEST_B_EMAIL=...
TEST_B_PASSWORD=...
CONFIRM_DISPOSABLE_TEST_PROJECT=yes
```
Exécuter `npm run test:remote`. Le script utilise leurs jetons réels, crée un profil si nécessaire et une déclaration de pause idempotente. Il ne supprime/réinitialise rien et n’utilise pas de service_role. Exécuter ensuite `supabase/tests/invariants.sql` dans SQL Editor pour vérifier les sommes et les grants. Les contrôles propriétaire ne prouvent pas seuls la RLS.

## Recette complémentaire requise
- Deux joueurs de ligues distinctes : aucun événement Postgres Changes du classement adverse ; JWT anonyme rejeté.
- 31 inscriptions simultanées : aucune ligue à plus de 30, une appartenance par joueur/saison.
- Dons A→B simultanés au-delà du solde ; total conservé, aucun mouvement partiel. Comptes de test de plus de 24 h nécessaires.
- Clôture de saison en retard, double cron et déclaration à la frontière : chaque action dans une seule saison. Vérifier semaines de changement d’heure et divisions limites.
- Blocage et retrait de consentement : suppression du duel en cours et interdiction des dons/invitations suivants.
- Navigateurs aux largeurs 320/375/400/1280 : pas de débordement horizontal, focus visible, dialog Escape/focus restitué, zoom 200 %, VoiceOver/NVDA, préférence de réduction du mouvement.
- Couper le réseau pendant la déclaration, rétablir puis réessayer la même intention : aucun double débit/crédit. Vérifier la consultation durable après reconnexion.
- Auth confirmation, reset, lien expiré, déconnexion et export privé.

Le fichier de rapport `docs/verification.md` distingue précisément ce qui a été exécuté.

## Catalogue partagé et notifications
Après la mise à jour 002/003, exécuter `supabase/tests/community_notifications.sql` puis `supabase/tests/web_push.sql` dans SQL Editor sur le projet de test. Ces scripts annulent leurs fixtures en fin de transaction. Ils couvrent quotas/idempotence, plafond global communautaire, confidentialité, lecture individuelle, événements de duel, privilèges et révocation de push ; ils ne remplacent pas les contrôles HTTP/RLS avec deux sessions réelles.

Dans deux navigateurs connectés : créer puis réutiliser une action de l’autre joueur, vérifier la liste Realtime, accepter l’amitié, activer le partage et déclarer une action. Vérifier alerte, badge et lecture ; désactiver le partage puis bloquer pour contrôler l’absence d’alerte. Vérifier les trois événements de duel avec des comptes consentants. Pour les alertes app fermée, suivre la recette HTTPS de `web-push.md`.

## Amis, administration et compétitions
Après migration 004, `supabase/tests/admin_competitions.sql` crée des fixtures synthétiques dans une transaction terminée par `ROLLBACK`. Il couvre accès admin, garde du dernier admin, suspension RPC et SELECT sous rôle authenticated, historique sept jours et consentement/amitié/blocage, pagination, payloads/dates, inscriptions, égalités, fenêtres de score, export privé, badges uniques et résultats figés. Exécuter sur un projet de test. La validation réalisée sur viegame a enveloppé **la migration elle-même et les assertions** dans une transaction annulée ; elle n’a pas installé la fonctionnalité en production.

Les tests Node `tests/events.test.ts` couvrent les critères de score et limites temporelles, égalités, validation, inscriptions démo et gel des résultats. `tests/install.test.ts` contrôle que le bundle admin reprend exactement la migration 004 puis le bootstrap, dans une seule transaction.

La recette authentifiée après installation, avec un compte ordinaire et l’admin, est décrite dans [admin-competitions.md](admin-competitions.md). Les assertions SQL exécutées sous le rôle authenticated ne remplacent pas le parcours HTTP avec de vrais JWT ni une vérification de concurrence multi-connexions.

## Régressions progression/social (005–006)
Après 001–004 et seed sur un projet SaaS de test, appliquer `supabase/update-progression-social.sql`, puis exécuter les fichiers rollback-only `supabase/tests/encouragements.sql` et `supabase/tests/progression.sql` dans SQL Editor. Le second comprend un scénario où une compétition est annulée avant que tous les participants aient chargé leurs XP. Contrôler ensuite les parcours à deux sessions et le Web Push selon [progression-social.md](progression-social.md). Les tests Node couvrent la démo, Paris/DST, les récompenses idempotentes, les limites, les catégories de compétition et la fidélité du bundle SQL ; ils ne remplacent pas les assertions PostgreSQL.
