# Atelier IA administrateur

Dans Administration → Événements, choisir une ambiance puis « Générer 3 défis ». L’atelier propose des titres, textes d’ambiance et badges composés avec les icônes existantes. Ce ne sont pas des images générées : les symboles sont rendus localement pour rester nets et économiques.

« Modifier et préparer » ouvre le formulaire existant avec une compétition de sept jours, commençant le lendemain, sur les pauses, la marche ou les bonnes habitudes. Modifier les dates et le texte, enregistrer le brouillon, puis publier avec le bouton existant. Aucune publication automatique. Les catégories, scores et récompenses suivent les règles existantes ; l’IA ne peut pas leur attribuer de valeur.

## Mise en production

1. Exécuter une seule fois `supabase/update-ai-workshop.sql` après la migration 014. Ne pas exécuter le bundle et la migration 015 séparément.
2. Dans Vercel → viegame → Settings → Environment Variables, ajouter côté serveur :
   - `CLOUDFLARE_ACCOUNT_ID` : les 32 caractères de l’identifiant du compte Cloudflare.
   - `CLOUDFLARE_AI_TOKEN` : le jeton Workers AI du compte, avec uniquement les permissions nécessaires à Workers AI.
   Ne pas préfixer ces variables par `NEXT_PUBLIC_`. Ne pas placer de secret dans le dépôt ou dans Supabase Vault pour cette fonctionnalité.
3. La configuration serveur existante `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SECRET_KEY` reste utilisée. Pousser le code sur GitHub et redéployer après ajout des variables.
4. Ouvrir Administration → Événements. Générer un lot : la mention « Propositions IA » confirme une réponse Cloudflare validée et enregistrée. « Modèles préparés » signale un repli local : configuration absente, quota/provider indisponible ou texte refusé.

Le site et les routes restent sur Vercel ; aucun Worker à déployer. Utiliser l’offre Workers Free et le modèle fixe `@cf/meta/llama-3.1-8b-instruct-fast`. Dix lots/jour UTC au maximum pour l’ensemble des administrateurs, délai minimum de dix secondes entre réservations, 900 tokens de sortie maximum/appel, un seul essai fournisseur. Les appels d’autres applications utilisant le même compte Cloudflare consomment aussi son quota. Aucune activation d’une offre payante par le code.

## Données et reprises

Cloudflare reçoit uniquement une ambiance dans une liste fermée et les instructions fixes. Aucun compte joueur, message, email ou journal d’activité n’est envoyé. Le jeton demeure serveur. Les appels sont réservés aux administrateurs non suspendus et l’autorisation est revérifiée lors de l’enregistrement.

Les vingt derniers lots terminés sont consultables par les administrateurs depuis Supabase. Les générations sont conservées dans une table privée ; réutiliser une proposition ne relance pas l’IA. Les appels répétés avec le même identifiant réutilisent le résultat. Une requête interrompue avant enregistrement peut rester en cours et consomme son quota ; consulter l’historique avant de relancer. Le quota quotidien compte aussi les appels ayant échoué pour éviter les boucles.

Les réponses IA sont du texte validé, jamais du HTML/SVG exécuté. Les propositions sont relues par l’administrateur avant publication. En cas d’erreur fournisseur ou de sortie invalide, trois modèles préparés sont enregistrés à la place.

Références : [API REST Cloudflare](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), [tarification](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Diagnostic d’un repli

La nouvelle génération affiche maintenant la cause du repli : configuration, refus 401/403, limitation 429, requête refusée 400, ressource absente 404, erreur fournisseur, réseau/délai ou texte refusé. Le statut HTTP et le code numérique Cloudflare sont affichés lorsqu’ils sont disponibles. Les logs Vercel de `/api/admin/challenges` contiennent également `ai_challenge_fallback` avec uniquement l’identifiant de requête et ces codes, jamais le jeton ni la sortie brute.

Ce diagnostic accompagne la réponse du nouvel essai ; il n’est pas enregistré dans l’historique SQL. Après rechargement, retrouver le détail dans les logs Vercel. Les anciens lots ne permettent pas de reconstituer la cause, car elle n’était pas enregistrée. Aucun SQL supplémentaire n’est nécessaire pour cette amélioration. Les espaces en début/fin des variables Cloudflare sont désormais retirés avant validation.

## Format structuré des réponses

Le modèle `@cf/meta/llama-3.1-8b-instruct-fast`, explicitement listé dans la documentation du [mode JSON Cloudflare](https://developers.cloudflare.com/workers-ai/features/json-mode/), reçoit désormais un schéma : trois suggestions et quatre champs obligatoires par suggestion. Le parseur accepte l’objet structuré renvoyé par Cloudflare et sa version sérialisée, ainsi que les anciens tableaux. Les champs, longueurs et règles de contenu restent validés localement. Les mots « jeunes » et « engin » ne sont plus confondus avec « jeûne » et « gin ». Les anciens lots de secours restent inchangés ; tester une nouvelle génération après déploiement. Aucun SQL ni changement de variable nécessaire.
