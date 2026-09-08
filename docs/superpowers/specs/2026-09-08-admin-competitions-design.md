# Amis, administration et compétitions

Demande : historique sept jours des amis, compte administrateur bfe@nomios.fr, événements inscrivables sur l’accueil et badges de compétition. L’utilisateur a identifié son compte existant. Aucun envoi GitHub. Développement local et migration additive reviewable ; ne jamais déplacer le dépôt parent (racine Git hors projet). Pas de Docker ni base PostgreSQL locale. Pas de clés privées dans le navigateur. La préférence de manipulation manuelle des réglages de déploiement est conservée : livrer les fichiers et instructions de mise à jour.

## Produit
- Amis : ouvrir un ami accepté pour consulter toutes ses actions partagées des 7 dernières journées glissantes. Nom, quantité, minutes de vie, date. Pagination 50, filtres dans la page chargée ; ne pas prétendre à un total semaine si partiel. Nouveau consentement `share_history` par défaut faux, distinct de `share_activity`. Le blocage ou retrait du partage coupe immédiatement les lectures futures. Aucun accès aux autres utilisateurs ou aux clés/idempotency_key de leurs actions.
- Admin : rôle privé en base, vérifié à chaque RPC. Gestion des événements, recherche des joueurs, suspension/réactivation, attribution/retrait du rôle administrateur et modération du catalogue par activation/désactivation. Pas de modification destructive du journal ni de mots de passe visibles. Empêcher suspension de soi et retrait du dernier admin. Journal d’audit privé.
- Événements : titre, description, début/fin, barème et badge. Brouillon → publié → terminé ou annulé. Règles verrouillées après publication. Inscription/désinscription seulement avant le début ; pas d’inscription rétroactive. Accueil montre événements publiés et résultats récents. L’inscription rend le pseudo, avatar et score visibles au classement de la compétition.
- Barèmes : `health_minutes` (minutes positives), `net_minutes` (gains moins pertes), `category_minutes` (gains d’une catégorie saine choisie). Seulement les déclarations serveur entre début inclus et fin exclue ; pas de dons, bonus admin, actions antérieures. Plafonds existants conservés. Les égalités partagent le rang.
- Badges permanents liés à l’événement : gagnant au rang 1, podium aux rangs 2/3, participation sinon, à condition d’au moins une action éligible. Un badge maximal par événement/joueur. Clôture idempotente et classement final figé ; événement annulé sans récompense. Badge visible sur le profil.
- Démo : données explicitement fictives, historique partagé démonstratif, inscriptions et scores simulés ; aucun droit administrateur réel.

## Architecture et contrats
Migration 004 seule, anciennes migrations immuables. Fonctions privées definer avec search_path vide, wrappers publics invoker et GRANT énumérés. Aucun accès direct client aux rôles/audits. `private.assert_user` refuse un joueur suspendu pour toutes les opérations du jeu (lecture get_game_state comprise) ; l’onboarding reste fonctionnel.

Contrats TypeScript dans `lib/events/types.ts` (autorité des noms). RPC :
- `get_social_hub()` → SocialHub.
- `get_friend_activity(p_friend_id uuid,p_before timestamptz default null,p_before_id uuid default null,p_limit int default 50)` → FriendActivityPage ; autorisation à chaque page.
- `update_history_sharing(p_enabled boolean)` → void.
- `get_competition(p_event_id uuid,p_offset int default 0)` → CompetitionDetail avec leaderboard pages50.
- `join_competition(p_event_id uuid)` / `leave_competition(p_event_id uuid)` → void, idempotents.
- `admin_get_dashboard(p_search text default '',p_offset int default 0)` → AdminDashboard.
- `admin_save_competition(p_event jsonb,p_request_id uuid)` → CompetitionSummary. Payload CompetitionDraft ; idempotence exact payload.
- `admin_set_competition_status(p_event_id uuid,p_status text)` → void (`published`/`cancelled`).
- `admin_update_user(p_user_id uuid,p_is_admin boolean,p_suspended boolean,p_reason text)` → void.
- `admin_set_catalog_active(p_catalog_id text,p_active boolean,p_reason text)` → void.
- `private.close_due_competitions()` appelée au chargement et via Cron optionnel, sans JWT ; finalise seulement les événements échus.

Pas de modification get_game_state nécessaire : le hub se charge séparément, migration absente = nouvelles fonctions indisponibles ; autre erreur visible. Les protections de suspension couvrent aussi l’admissibilité push.

Compte cible vérifié existant : c1de65cb-9086-430f-8828-dbea316c6452 / bfe@nomios.fr. Fournir un script d’activation admin séparé avec double vérification email/UUID/profil ; aucun autre utilisateur promu implicitement.

## Validation
Tests comportementaux TypeScript des dates/scoring/inscriptions, assertions SQL d’accès, partage, pagination, quotas existants, idempotence, publication, égalités, clôture/badges et derniers admins. Lint, typecheck, build, parcours navigateur démo. Revue indépendante. SQL de validation transactionnel fourni ; aucun test avec des comptes réels sans autorisation. Déploiement et changements permanents de base à effectuer par l’utilisateur à partir des fichiers livrés.
