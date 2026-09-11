# Notifications déclenchées par les événements

Cette mise à jour concerne les messages, les déclarations partagées, les amitiés, les changements de duel, les encouragements et les notifications de compétition déjà produites par le jeu. Toute nouvelle entrée éligible dans la file push réveille le serveur, sans attendre la minute du cron.

## Installation sur la production existante

1. Pousser le code sur GitHub et attendre la fin du déploiement Vercel.
2. Dans Supabase → SQL Editor, exécuter **une seule fois** `supabase/update-instant-notifications.sql`, après les migrations 001 à 011. C’est le même contenu que la migration 012 ; ne pas exécuter les deux. Ne pas réexécuter `install.sql`.
3. Garder le cron `viegame-web-push` actif. Aucune nouvelle variable Vercel ni nouvelle paire VAPID n’est nécessaire.
4. Vérifier les deux entrées Vault déjà utilisées pour le cron : `viegame_push_dispatch_url` vaut `https://viegame.vercel.app/api/push/dispatch` ; `viegame_push_dispatch_token` correspond exactement à `WEB_PUSH_DISPATCH_SECRET` sur Vercel. Il ne s’agit pas de la clé secrète Supabase. L’extension `pg_net` doit être active. Si le cron utilise d’autres noms Vault, créer ces deux entrées via le dashboard.
5. Le POST serveur vers `/api/push/dispatch` doit continuer à passer les règles Vercel sans challenge de navigateur. L’authentification Bearer de cette route reste obligatoire.
6. Rouvrir le jeu sur chaque appareil après le déploiement pour charger le nouveau service worker, puis fermer et rouvrir le jeu une fois si l’ancienne version reste active. Les abonnements existants sont conservés.

La migration ne déclenche pas l’envoi de l’historique. Après activation, les événements et le cron continuent de traiter les entrées éligibles de la file, y compris les reprises en attente.

## Comportement

- Deux déclarations partagées d’un ami donnent deux alertes, même dans la même heure. Les changements de tête de duel utilisent également l’identifiant de la déclaration.
- Chaque premier encouragement d’un ami sur une déclaration est annoncé dès la réaction. Modifier, supprimer puis remettre cette réaction ne crée pas de nouvelles alertes. Les préférences et limites existantes restent appliquées.
- Une transaction émet au maximum un réveil HTTP. Le worker conserve ses lots bornés, ses baux et ses contrôles de consentement. S’il reste des entrées prêtes, il programme la suite sans attendre le cron. Les jobs en attente de reprise ou en heures silencieuses ne provoquent pas de boucle immédiate.
- Chaque livraison possède un tag stable : les nouvelles alertes ne se remplacent plus toutes ; une reprise du même job réutilise son tag. Le contenu affiché reste générique, sans détail privé sur l’écran verrouillé.
- Les heures silencieuses et les catégories désactivées restent respectées. Le cron gère les reprises et les événements liés à l’heure : débuts/fins de compétition et rappels restent détectés à sa cadence, puis envoyés dès leur création.
- L’envoi ne dépend plus volontairement d’une attente d’une minute. L’affichage exact d’une bannière dépend toujours du réseau et des réglages iOS/Android/navigateur ; aucune garantie à la seconde.

Le mécanisme utilise les requêtes asynchrones après validation de transaction documentées par [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).

## Test réel après déploiement

Avec deux comptes amis consentants, activer les alertes et le push sur l’appareil destinataire, hors heures silencieuses. Sur iPhone, ouvrir le jeu depuis l’icône de l’écran d’accueil. Fermer le jeu du destinataire, puis envoyer un nouveau message depuis l’autre compte. Tester ensuite deux déclarations partagées et un premier encouragement sur une autre déclaration. Ne pas ouvrir la cloche avant la réception : une alerte lue n’est plus envoyée.

Dans Supabase, cette requête montre les résultats HTTP récents sans afficher les secrets :

```sql
select created, status_code, timed_out, error_msg, content
from net._http_response
order by created desc limit 10;
```

Un HTTP 200 avec `sent > 0` confirme l’acceptation par un fournisseur push, pas l’affichage de la bannière. `processed: 0` peut simplement indiquer une file vide ou aucune entrée disponible. Le cron et les réveils événementiels utilisent la même route.

## Validation locale

Tests Node du service worker : deux événements gardent deux tags différents, une reprise garde le même tag, les données privées et URL externes restent refusées. Migration 012 et tests SQL validés sur PostgreSQL temporaire avec un **faux** `pg_net`, sans réseau ni compte réel. Le test `supabase/tests/instant_notifications.sql` est réservé à PostgreSQL local : ne pas l’exécuter sur Supabase, car il crée des schémas factices `net` et `vault`.
