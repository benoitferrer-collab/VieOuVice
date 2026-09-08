# Rapport de vérification — 8 septembre 2026

## Exécuté
- `npm install --no-audit --no-fund` : dépendances installées, versions exactes et lockfile conservés. Accès réseau autorisé après échec DNS dans le bac à sable.
- `npm test` : **26 tests passent**, zéro échec. Seuils signés, plafonds, dates Paris/DST, validation, idempotence de démo, brouillons d’actions/dons, vérification du payload lors d’une reprise et parité migration/install, bundle de mise à jour, catalogue communautaire et plafond global, filtrage, notices, sécurité des endpoints/payloads push et retries.
- `npm run typecheck` : succès, TypeScript strict.
- `npm run lint` : succès, zéro erreur et zéro avertissement au dernier passage.
- `npm run build` : succès Next.js 16.3.4, neuf pages générées, routes Auth/export/push et proxy compilés. Le build nécessite l’autorisation d’ouvrir les processus/ports internes de Turbopack dans cet environnement.
- `npm run dev` : serveur local lancé sur http://127.0.0.1:3000 et conservé pour l’aperçu.
- `curl -I http://127.0.0.1:3000` après les derniers changements : HTTP **200 OK**.
- Revue statique indépendante du SQL et du hook : contrôle strict du payload retrouvé après une erreur RPC ; compteur d’invitations privé non contournable par suppression des amitiés. Publication Realtime explicitement configurée dans `supabase/jobs.sql`.

## Non exécuté
Aucune migration ni commande SQL distante, aucun compte Supabase réel, aucun test JWT multi-utilisateurs, aucun test SQL de concurrence/Realtime ou d’Auth par email. Les parcours navigateur locaux décrits ci-dessous ont été exécutés. Aucun contrôle lecteur d’écran ou mesure de contraste n’a été exécuté. Ne pas déduire ces validations du build frontend.

## État de couverture
| Domaine | État |
|---|---|
| Interface web et démo | Codées ; build/TypeScript/lint/unitaires passent |
| Auth/onboarding connecté | Codés ; confirmation email et backend à tester sur SaaS |
| Catalogue, actions, ledger, RLS | SQL fourni ; exécution et invariants réels à valider |
| Amis, blocages, dons, ligues, saisons, Némésis | Codés ; tests SaaS requis |
| Notifications dans le jeu / Realtime | Codées ; activation explicite et test SaaS requis |
| Export personnel | Route/RPC codées ; test authentifié SaaS requis |
| Paris, traquenards, roulette, effets, Tentation | Non implémentés ; fonctionnalités inactives et signalées |
| Trophées | Premier souffle uniquement ; trophées avancés non implémentés |
| Catalogue communautaire | UI/démo testées ; migrations et tests SQL fournis, à exécuter sur SaaS |
| Web Push/outbox | Implémentés ; tests locaux passent, configuration serveur et livraison réelle non validées |
| Signalement, suppression self-service | Non implémentés |
| Déploiement | Aucun ; guide Supabase/Vercel fourni |

Cette livraison constitue une première version jouable locale, pas la totalité des trois lots du brief ni un jeu prêt à l’ouverture publique.

## Après installation Supabase par l’utilisateur
Contrôles publics en lecture seule effectués : Auth HTTP 200, inscription email activée. `action_catalog`, `users`, `actions` et RPC `get_game_state` répondent HTTP 401 / PostgreSQL 42501 (accès anonyme refusé), au lieu du 404 avant installation. Cela confirme la présence des objets et le refus anonyme, pas le fonctionnement des transactions ni la séparation entre deux utilisateurs connectés. Aucun compte créé, aucun email envoyé, aucune clé secrète utilisée. Configuration Auth/URL et Cron non vérifiées avec les droits publics.

## Mise à jour catalogue communautaire et notifications
- 26 tests Node passent, TypeScript/lint/build passent après intégration. Revue statique indépendante du SQL et worker : correction d’une réactivation possible d’un push déjà lu après retrait/rétablissement du consentement. Régression SQL ajoutée dans `supabase/tests/web_push.sql`, non exécutée.
- Chromium isolé, sans compte réel : entrée dans la démo, création « Pause lecture test », unité « quinze minutes », valeur +35, quantité max 3 ; création sélectionnée dans le filtre Communauté ; déclaration ×2 confirmée à +70, solde 845 → 915 et journal mis à jour. Fermeture du dialog via Échap et accès aux préférences.
- À 320 × 780, panneau de réglages sans débordement horizontal : page 320 px, dialog client/scroll 318 px. Capture inspectée dans `output/playwright/notification-settings-320.png`. Partage désactivé au départ et activation de la case vérifiée en démo ; Web Push explicitement inactif en démo. Pas d’erreur console JavaScript durant ce parcours (seulement DevTools/HMR).
- HTTP local : `/api/push/config` répond 200, `Cache-Control: no-store`, `configured:false`, `publicKey:null` ; POST `/api/push/dispatch` sans autorisation répond 401. Aucun push envoyé.
- `supabase/update-community-notifications.sql` regroupe 002 + 003 en une transaction, sans modifier l’installation originale déjà appliquée. Tests SQL communauté/push fournis pour un projet SaaS de test. Ces nouvelles migrations, Realtime entre comptes, consentement système et réception app fermée restent à valider après configuration/déploiement.
- Aucun envoi sur GitHub, aucune publication ni modification distante effectués pendant cette reprise.
