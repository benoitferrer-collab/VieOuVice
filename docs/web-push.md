# Notifications Web Push

Les notifications dans le jeu fonctionnent indépendamment du push. Le push reste volontaire : le bouton demande la permission du navigateur et associe uniquement ce navigateur au compte connecté. La démo n’inscrit aucun abonnement. Aucun nom, action, montant ou score ne sort dans le payload : « Du nouveau dans ta partie », puis un lien vers un onglet du jeu.

## Déployer

1. Exécuter une seule fois **`supabase/update-community-notifications.sql`** dans SQL Editor après la base initiale (équivalent aux migrations **002 puis 003**, ne pas faire les deux). La migration 003 ajoute les abonnements privés, une file durable et les RPC. Ne pas réexécuter une installation initiale sur une base existante.
2. Déployer l’application Next.js sur une origine HTTPS avec routes serveur Node. Le navigateur doit pouvoir charger `/sw.js` à la racine. Le service worker ne met aucune page ni API en cache.
3. Renseigner ces variables sur le serveur de déploiement, puis reconstruire/redéployer :

| Variable | Usage |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet existant |
| `SUPABASE_SECRET_KEY` | Clé secrète Supabase serveur, jamais une clé publique |
| `WEB_PUSH_DISPATCH_SECRET` | Secret distinct d’au moins 32 caractères pour le scheduler |
| `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | Clé VAPID publique, base64url sans padding |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Clé VAPID privée correspondante, serveur seulement |
| `WEB_PUSH_SUBJECT` | Contact VAPID, par exemple une URI `mailto:` valide |

La paire VAPID et le secret de dispatch doivent être créés et conservés par l’exploitant dans son gestionnaire de secrets. Aucune clé n’est fournie ni générée par cette modification. Ne pas reprendre une ancienne clé secrète partagée dans un message ; la renouveler dans Supabase. La clé publique Supabase existante reste nécessaire au navigateur pour son accès authentifié normal.

`GET /api/push/config` renvoie seulement `configured` et la clé VAPID **publique**, avec `Cache-Control: no-store`. Sans configuration serveur complète, le bouton d’activation indique que le déploiement reste nécessaire. Cet indicateur vérifie la présence et le format des variables ; la migration et le scheduler doivent aussi être installés. Changer la paire VAPID exige de désactiver/réactiver les abonnements des navigateurs.

4. Programmer un POST périodique (par exemple chaque minute) vers `/api/push/dispatch`, en-tête `Authorization: Bearer <secret de dispatch>`. Ne jamais placer le jeton dans l’URL. Le corps est ignoré : aucune cible ni contenu n’est sélectionnable par l’appelant. Le fichier `supabase/push-jobs.sql` fournit un modèle **commenté** pg_cron/pg_net + Vault. Un ordonnanceur externe compatible POST avec en-têtes convient également. Il faut activer les extensions et créer les entrées Vault via le dashboard avant d’exécuter ce modèle.
5. Vérifier manuellement après déploiement, avec deux comptes de test : consentement, événement ami partagé/duel, fermeture de l’application, réception générique et ouverture du bon onglet. Vérifier aussi refus navigateur, désactivation, déconnexion et changement de compte. Les tests automatisés locaux n’envoient aucun push.

Sur iPhone, installer le jeu sur l’écran d’accueil et l’ouvrir depuis cette icône avant la demande de permission. Les restrictions système, le mode économie d’énergie ou les réglages du navigateur peuvent empêcher la réception même après acceptation.

## Garanties et limites

- Les endpoints sont privés et uniques ; aucun compte ne peut reprendre silencieusement l’endpoint d’un autre. Les RPC utilisateur appliquent `auth.uid()` et ne donnent qu’un statut booléen pour l’endpoint du compte. Dix navigateurs maximum par compte ; clés et longueur d’URL contrôlées.
- Seuls les endpoints HTTPS officiels FCM (`fcm.googleapis.com`), Mozilla (`push.services.mozilla.com` et ses sous-domaines) et Apple (`web.push.apple.com`) sont acceptés. Identifiants URL, ports explicites, fragments et serveurs arbitraires sont refusés. Le worker revérifie l’URL avant envoi. Les fournisseurs non listés restent indisponibles.
- L’insertion d’une notification sociale crée la file dans la même transaction. La contrainte notification/abonnement déduplique. Les anciens événements ne sont pas rejoués lorsqu’un nouvel abonnement est créé.
- Seul `service_role` peut louer, autoriser et terminer un job via les RPC d’administration. Chaque job dispose d’un jeton de lease aléatoire et d’un bail de 60 secondes ; dix jobs maximum et une boucle de 20 secondes maximum par invocation, chaque envoi limité à cinq secondes. Les accès Supabase ont également un timeout.
- Le contrôle juste avant l’envoi revérifie blocages, préférences du destinataire, partage de l’auteur pour une activité, amitié acceptée ou paire de duel de la saison concernée et consentement PvP des deux joueurs. Les alertes déjà lues et les événements périmés après 24 heures sont annulés. Une alerte lue reste inéligible après désactivation/réactivation des préférences. Un retrait de consentement intervenant après le dernier contrôle ne peut rappeler un message déjà accepté par le fournisseur ; durée de vie fournisseur : cinq minutes.
- Les réponses 404/410 suppriment l’abonnement et ses jobs. Les erreurs réseau, 408, 429 et 5xx sont réessayées avec délais bornés (60, 120, 240, 480 secondes), cinq tentatives maximum. Les autres erreurs sont terminales. La file est purgée après sept jours ; elle ne stocke aucun payload privé.
- La livraison est au moins une fois : un arrêt entre acceptation fournisseur et accusé durable peut produire un doublon. Le tag unique côté navigateur regroupe l’affichage. Aucun système Web Push ne garantit une réception immédiate ou une livraison exactement une fois.
- L’export personnel inclut les dates et identifiants de ses propres abonnements, sans clés cryptographiques. Le service worker n’accepte que quatre onglets du jeu sur la même origine et ignore tout titre reçu.

Le composant expose `WebPushSettings({ demo, userId? })` et `cleanupWebPushBeforeSignOut()`. Attendre le cleanup **avant** `auth.signOut()` : les deux retraits (serveur puis navigateur) sont tentés indépendamment ; un seul succès garantit l’arrêt des futurs envois de ce navigateur. Si les deux échouent, la déconnexion affiche l’erreur et peut être réessayée. Un endpoint inconnu du compte courant est invalidé dans le navigateur avant toute nouvelle inscription. Pour un ordinateur partagé, se déconnecter explicitement avant de laisser la place : fermer l’onglet seul laisse les notifications volontaires actives.

## Vérifications sans envoi

Exécuter `node --import tsx --test tests/push*.test.ts`, puis les contrôles globaux du projet. Les tests vérifient les endpoints, le bearer, le payload, les retries et les URL du service worker. Les migrations doivent être validées dans un environnement PostgreSQL de test ou dans le projet Supabase par l’exploitant ; aucune migration distante ni notification réelle n’est exécutée par ces tests.

Le test transactionnel `supabase/tests/web_push.sql` vérifie notamment la mise en file puis la révocation d’une alerte lue après désactivation/réactivation des préférences. Il ne contacte aucun fournisseur et reste à exécuter dans le projet Supabase de test.
