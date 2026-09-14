# Identité automatique des saisons

La migration `202609140019_season_identity.sql` et le bundle `supabase/update-season-identity.sql` sont identiques. Appliquer une seule fois après les migrations précédentes. Aucun nouveau cron SQL : le worker applicatif est appelé par le dispatch existant.

## Contrat SQL du worker

`public.claim_season_identity()` est réservé au rôle de service. Sous le verrou transactionnel global `738291`, il appelle `private.ensure_season(clock_timestamp())`, puis réserve uniquement la saison en cours. Le rattrapage des saisons reste celui du jeu ; aucune identité des saisons intermédiaires n’est générée.

La réponse est `null` si aucun travail n’est disponible, sinon `{season_id, starts_at, lease_token, generate}`. La première réservation donne `generate: true` et un bail de 90 secondes. Le worker peut alors effectuer une seule tentative Cloudflare. Les appels concurrents pendant ce bail obtiennent `null`. À expiration, une nouvelle réservation remplace le jeton et impose `generate: false` : utiliser le résultat de secours préparé, sans nouvel appel IA. Une interruption avant le premier appel consomme aussi cette unique possibilité.

`public.finish_season_identity(p_season_id uuid, p_lease_token uuid, p_identity jsonb, p_source text)` retourne `true` après enregistrement. Il retourne `false` pour un jeton périmé, un bail expiré, une identité déjà terminée ou une saison qui n’est plus courante. Une recette invalide ou une source interdite déclenche une erreur atomique. Le worker doit terminer avant expiration. Une réservation de reprise n’accepte que `fallback` ; la première accepte `ai` ou `fallback`. Une identité terminée ne peut pas être remplacée par ces RPC.

## Données et validation

La table privée `season_identities` référence uniquement `seasons`, sans compte utilisateur, message ou autre donnée personnelle. Les colonnes de bail ne sont pas exposées aux joueurs ni à l’administration. RLS activée, aucun accès direct aux rôles clients ou de service. Les validateurs et l’ancien wrapper de jeu ne reçoivent aucun droit d’exécution client.

La recette contient exactement `season_name` et `divisions`. Les cinq divisions, dans l’ordre des divisions 1 à 5, contiennent exactement `name`, `icon`, `color`, `shape`.

- Noms : 3 à 60 caractères, lettres latines avec accents français, espaces, apostrophes et tirets ; pas d’espaces externes. Les cinq noms de division doivent être distincts sans tenir compte de la casse.
- Icônes : `star`, `flame`, `leaf`, `moon`, `crown`.
- Couleurs : `gold`, `mint`, `violet`, `coral`, `sky`.
- Formes : `shield`, `circle`, `hexagon`.
- Source : `ai` ou `fallback`.

Les chiffres, contrôles, balises, ponctuations d’URL, clés supplémentaires et valeurs de recette hors liste sont rejetés. Un filtre lexical limité exclut aussi quelques racines médicales et URL ; il ne constitue pas une analyse sémantique exhaustive. Le worker doit appliquer les mêmes limites avant publication.

## Lecture et compatibilité

`get_game_state()` ajoute `season_identity: {season_name, league_name, emblem: {icon, color, shape}, source}` pour la division du membre dans la saison courante. Sans identité terminée, la valeur vaut `null`. Le champ historique `league_name`, les scores, rangs et dates restent produits par les fonctions précédentes.

`public.admin_season_identity()` exige `private.assert_admin()`. Il retourne `{season_id, starts_at, status, identity, source}`, ou `null` sans saison courante. Les statuts sont `pending`, `generating`, `awaiting_fallback`, `ready`. Cette lecture ne déclenche ni génération ni rattrapage. Aucun jeton de bail n’est retourné.

## Vérification locale

`supabase/tests/season_identity.sql` crée des fixtures synthétiques dans une transaction annulée. Exécuté avec succès sur PostgreSQL local après les migrations 001–019 : droits, réservation unique, rejet des recettes invalides, jetons incorrects/périmés, récupération sans deuxième génération, immutabilité, lecture joueur et administration. Aucun déploiement distant effectué.

## Mise en production

1. Après les mises à jour précédentes, exécuter `supabase/update-ai-proposal-deletion.sql`, puis `supabase/update-season-identity.sql` dans le SQL Editor Supabase.
2. Pousser le code et redéployer Vercel. Réutiliser les variables Cloudflare et Supabase existantes ; aucun nouveau secret ni cron n’est nécessaire.
3. L’appel périodique existant à `/api/push/dispatch` envoie d’abord les notifications, puis traite l’identité si son budget de temps le permet. Un passage très occupé reporte ce travail au suivant. L’identité courante est générée au premier passage après déploiement, puis une fois par nouvelle saison.
4. Admin → Événements → Identité de la saison affiche l’état, le nom et les cinq emblèmes. « Actualiser l’état » ne consomme pas d’IA. La page Ligue affiche le nom correspondant à la division et conserve le numéro de division.

La génération utilise Workers AI `@cf/meta/llama-3.1-8b-instruct-fast`, un JSON structuré, 650 tokens maximum et un délai de douze secondes. Seule une ambiance prédéfinie est envoyée, sans noms de joueurs ni historique. Les erreurs, limites et réponses rejetées donnent immédiatement un thème préparé ; une interruption complète est récupérée après expiration du bail. Il n’y a pas de génération par joueur ou par ouverture de page. La disponibilité effective et la consommation restent celles du compte Cloudflare.
