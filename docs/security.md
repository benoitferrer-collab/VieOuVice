# Sécurité et confidentialité

## Autorité et accès
Supabase Auth porte l’identité. Le navigateur utilise uniquement la clé publique et son jeton utilisateur. Les clients SSR sont distincts ; le proxy rafraîchit le jeton avec `getClaims()`, les chemins sensibles vérifient `getUser()`. Les redirections de callback sont limitées à `/` et `/auth?recovery=1`.

Toutes les tables exposées ont RLS. `anon` ne lit pas le jeu. Aucun INSERT/UPDATE/DELETE de gameplay n’est accordé au client. Le profil propre est lisible, pas modifiable arbitrairement. La projection sociale contient pseudo, avatar et score, sans détail des actions. La policy `own_league` utilise un helper privé sans récursion. Les wrappers RPC invoker appellent des helpers definer privés avec `search_path=''` et identité explicite ; leurs grants sont vérifiés dans les tests SQL. N’ajoutez jamais `private` aux schémas exposés dans Supabase API.

Chaque action écrit le ledger par trigger ; le ledger est le seul auteur du cache de solde. Actions et ledger sont immuables. Un don inscrit les deux côtés dans une transaction. Un verrou transactionnel global sérialise les opérations concurrentes et la clôture pour la V1 : simple et sûr à petite échelle, mais limite de débit assumée. Les comptes d’un don sont aussi verrouillés dans l’ordre UUID. Les intentions sont uniques par utilisateur et clé, avec vérification du payload.

La saison et l’horodatage d’une déclaration utilisent le même instant serveur capturé après acquisition du verrou. Un job retardé crée les saisons manquantes dans l’ordre. Le calcul ne dépend pas du navigateur.

## Données et conservation
Les journaux détaillés sont privés. Les notifications Realtime sont génériques, et les abonnements sont nettoyés à la déconnexion. Le filtre client n’est jamais considéré comme une autorisation. L’export authentifié n’inclut que les actions/ledger/préférences de l’utilisateur et les relations auxquelles il participe.

La V1 ne purge aucun journal automatiquement et ne livre pas encore de suppression de compte self-service ni de signalement. Les FK de gameplay sont RESTRICT pour empêcher une destruction comptable accidentelle. Seules les préférences privées sont CASCADE. Avant ouverture publique, implémenter une procédure transactionnelle d’effacement/anonymisation avec traitement des contreparties sociales, puis supprimer l’identité via l’API Auth administrateur. Ne pas supprimer brutalement `auth.users` ni désactiver les triggers depuis le navigateur.

La durée de conservation, les textes de confidentialité et la procédure de suppression doivent être définis avant ouverture publique. Ce document n’atteste aucune conformité juridique. Aucune donnée réelle n’a été envoyée pendant la réalisation.

## Limites de vérification
Les migrations SQL sont fournies, pas exécutées sur une instance distante. Les invariants de RLS, Realtime, transactions et concurrence doivent être testés avec les JWT de plusieurs comptes SaaS. Un build frontend réussi ne prouve pas ces propriétés. Voir `docs/testing.md`.

## Progression et encouragements (005–006)
Tables privées sous RLS, accès direct révoqué, mutations via RPC authentifiées et fonctions definer à search_path vide. Les droits d’amitié, consentement, blocage et suspension sont revérifiés côté SQL. Les lectures groupées sont bornées à 50 déclarations ou 60 apparences. Les apparences publiques ne contiennent ni email, ni inventaire, ni choix de mission, ni total de XP. Les XP sont un registre immutable de 50 par mission, avec trois choix maximum sous verrou transactionnel ; l’équipement est contrôlé côté serveur. Le même verrou global que le jeu protège les mutations de réaction et les récompenses. Les tests SQL sous rôle authenticated sont fournis mais non exécutés durant cette reprise ; les tests HTTP multicomptes et concurrence restent nécessaires.

## Passkeys natives Supabase
La vérification des défis, signatures, origine et RP ID est confiée à Supabase Auth et au navigateur via le SDK installé. Le jeu ne stocke ni clé privée ni biométrie, et ne forge pas de JWT. La connexion utilise la session SSR habituelle. La gestion requiert un utilisateur vérifié correspondant au compte affiché ; changement de session et démontage annulent la cérémonie et invalident les réponses différées. Les retraits passent par le contrôle de propriétaire de Supabase et une confirmation dans le profil. Aucun accès admin ou secret serveur supplémentaire. L’API Supabase reste expérimentale : versions figées, mot de passe et récupération conservés ; recette cryptographique réelle requise après activation.
