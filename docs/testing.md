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
