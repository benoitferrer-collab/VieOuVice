# Guide du joueur intégré — 10 septembre 2026

- Menu Profil → Guide du joueur disponible sans condition en démo et avec compte. Démarrage rapide et 13 rubriques dépliables : objectif, connexion, compteurs, déclarations, communauté, ligue, duels, compétitions, missions, amis, dons, notifications et confidentialité.
- Contenu vérifié contre les composants et règles locales. La différence entre bilan net de pertes en ligue et solde net de gains en compétition est explicite. Aucun réglage serveur ni changement de score.
- Lint, typecheck et build de production réussis. Recette navigateur du build local : ouverture depuis Profil, rubrique compétitions dépliée, lecture à 320×780 sans débordement horizontal (320/320). Échap ferme le panneau et restitue le focus à son bouton de menu.
- Aucun push, déploiement ni changement Supabase. La publication de ce guide demande uniquement le déploiement du code via GitHub/Vercel.

---

# Rapport de vérification — compteurs, classements et catalogue, 10 septembre 2026

- **66 tests Node passent**, zéro échec, via `node --import tsx --test tests/*.test.ts`. `npm run lint`, `npm run typecheck` et `npm run build` réussissent. Parité exacte des bundles 007, 008 et du bundle commun, catalogue unique et mise à niveau de la démo couverts.
- SQL : application temporaire du bundle 007–008 et exécution intégrale de `supabase/tests/loss_scoring.sql` sur le projet lié, dans une transaction externe sans COMMIT. Retour CLI réussi et `rollback_confirmed: true`. Aucun changement permanent. Assertions sur plus de 100 actions, bonus/dons exclus, bilan négatif, saison close inchangée, saison ouverte compensée, ledger immuable, retries, confidentialité, rangs officiels avant masquage et droits des helpers.
- Revue SQL indépendante : aucun point bloquant ; comparaisons d’assertions rendues insensibles aux valeurs SQL NULL avant exécution.
- Recette du build local en démo : 20 minutes perdues, 105 récupérées, bilan de 85 récupérées ; années affichées avec arrondi ; Cléo première en brut, Sam premier en net. Recherche « salade », déclaration +20 confirmée dans le journal ; pertes toujours 20, récupération 125, bilan 105 récupérées. La mission de troisième bonne habitude s’est aussi accomplie.
- Résumé inspecté visuellement à 320×780 : cartes lisibles, aucune largeur débordante (document 320/320). Aucun compte de production utilisé dans le navigateur. Activation permanente de la migration et publication GitHub/Vercel restent à effectuer par l’utilisateur : [loss-scoring.md](loss-scoring.md).

---

# Rapport de vérification — clés d’accès, 9 septembre 2026

- Intégration native Supabase Auth : opt-in client expérimental, bouton de connexion, gestion depuis Profil (ajout, liste, retrait confirmé), mot de passe et récupération conservés. Aucun endpoint, stockage de credential ou JWT personnalisé. Aucun changement SQL, de variable d’environnement ou de dépendance.
- **57 tests Node passent**, zéro échec. Cinq tests passkeys couvrent capacités, session vérifiée, annulation/rejet, messages français sans données internes et propriétaire du compte. `npm run lint` et `npm run typecheck` passent sans avertissement ; build de production Next16.3.4 réussi après le dernier correctif.
- Revue indépendante ciblée des méthodes SDK, permissions et sessions. Correction de l’annulation d’un prompt lors d’un événement SIGNED_IN/SIGNED_OUT et nettoyage de l’abonnement. La réussite propre au SDK redirige normalement sans message d’annulation. Le signal du SDK ne garantit pas l’annulation d’une vérification réseau déjà partie : limite documentée, aucune atomicité multionglets revendiquée.
- Recette navigateur du build local : bouton passkey présent, champs de connexion avec autocomplete username/current-password, menu Profil → Mes clés d’accès accessible, démo clairement expliquée sans possibilité de créer de credential. Contrôle à320×780, document sans débordement horizontal (320/320), capture du panneau inspectée ; aucune erreur console pendant ce parcours. Serveur temporaire de recette arrêté.
- Non exécuté : activation Passkeys dans Supabase, création dans Apple Mots de passe, authentification biométrique et révocation réelles. Ces opérations doivent être testées avec l’appareil du joueur sur l’origine configurée. Aucun credential créé/utilisé, aucun réglage Supabase changé, aucun Git/push/déploiement.

Configuration exacte et recette : [passkeys.md](passkeys.md). Le support Supabase est encore expérimental. L’utilisateur a confirmé le démarrage de la mise à jour progression précédente ; cette confirmation ne vaut pas une recette détaillée de toutes les assertions SQL.

---

# Historique avant les clés d’accès

# Rapport de vérification — encouragements, missions et avatars, 9 septembre 2026

## Vérifié localement
- **52 tests Node passent**, zéro échec, via `node --import tsx --test tests/*.test.ts` (équivalent au runner npm ; cette invocation évite le socket IPC de la CLI tsx interdit dans le bac à sable). Couverture : réactions finales/reprises/retraits, Paris et changements d’heure, plafonds et attribution unique, choix de trois missions, nouvelle habitude à valeur positive, éligibilité de compétition, cosmétiques verrouillés et parité exacte du bundle005–006.
- `npm run lint`, `npm run typecheck` et `npm run build` passent. Next.js16.3.4 compile neuf pages. Le serveur de recette a été arrêté avant le build final.
- Recette navigateur sur le build de production local, en démo : choix d’une mission déjà accomplie →50XP ; mission compétition accomplie →100XP et niveau2 ; troisième choix → autres choix désactivés. Objet450XP impossible à équiper ; broche100XP équipée avec confirmation. Persistance des100XP constatée après rechargement et nouvelle entrée en démo.
- Sur l’historique de Sam : 👏0→1 ; remplacement par 💪 donne 👏0/💪1 ; retrait donne les trois compteurs à0. Identité, titre et badge visibles. Réglage de récapitulatif présent dans les préférences.
- Recette à320×780 : captures réactions, vestiaire et missions inspectées ; aucun débordement horizontal du document. Correction du manque d’espacement des filtres d’historique intégrée au build final. Aucun message d’erreur console pendant le parcours inspecté.
- Revue statique indépendante du SQL : correction de la conservation des XP mérités avant annulation d’une compétition. Enveloppe et grants relus. Le test d’annulation vérifie explicitement que l’action synthétique est admissible au calcul des bonnes actions, pour éviter un faux succès dû au filtre temporel.
- `supabase/update-progression-social.sql` contient exactement005puis006 dans une seule transaction. Tests SQL et job de récapitulatif livrés séparément.

## Limite avant production
Les migrations005–006 et leurs assertions PostgreSQL **n’ont pas été exécutées**. La CLI Supabase échoue sur la connexion distante IPv6 ; la tentative de liaison IPv4 échoue également. Aucune modification distante permanente, aucun commit ni push GitHub, aucun déploiement Vercel effectué.

La validation SQL sur un projet SaaS de test, les parcours authentifiés multicomptes, la concurrence et la réception réelle des récapitulatifs Web Push restent à effectuer. Les tests Node et la démo ne prouvent pas ces points. Suivre [progression-social.md](progression-social.md) : bundleSQL, tests rollback, job puis publication depuis GitHub. Aucune nouvelle variable Vercel.

---

# Historique avant les migrations005–006
Les rapports ci-dessous concernent les versions précédentes.

# Rapport de vérification — mise à jour amis/admin/compétitions, 9 septembre 2026

## Version prête à installer
- 41 tests Node passent, zéro échec. Les nouveaux cas couvrent scores/fenêtres/égalités, inscriptions démo, gel des résultats et badges, parité du bundle SQL, réponses différées après déconnexion/connexion B ou passage en démo, identité incohérente, onboarding et ancienne erreur réseau.
- `npm run typecheck`, `npm run lint` et `npm run build` passent. Build Next.js 16.3.4 : neuf pages générées, routes Auth/export/push compilées. Le premier essai avait rencontré deux fichiers générés `.next/dev/types` malformés pendant l’exécution simultanée de dev/build ; retrait de ces deux fichiers générés, arrêt du dev et build séquentiel réussi. Aucun contournement TypeScript ajouté.
- Migration 004 et `supabase/tests/admin_competitions.sql` exécutés ensemble dans une transaction distante temporaire via Supabase CLI. Assertions passées et `rollback_confirmed: true` après annulation. Les comptes synthétiques, droits, tables et modifications de test n’ont pas été conservés. Le test contrôle notamment les SELECT sous rôle authenticated, les RPC, la confidentialité, le dernier admin, les quotas, les inscriptions, les bornes de score et les récompenses figées. L’activation réelle de l’admin n’a pas été exécutée.
- Revue statique indépendante du SQL et de l’intégration. Correction d’une lacune de suspension sur SELECT direct, alignement strict des validations SQL/TypeScript, puis correction des réponses de l’ancienne session dans le hook de jeu. Le helper de session testé est celui utilisé par le hook ; les mutations et événements Realtime obsolètes sont également ignorés.
- Recette navigateur de la démo : inscription puis désinscription, classement à zéro avant le début, historique Sam partagé avec trois déclarations et filtre bonnes actions, historique Jo privé, préférences de partage séparées, badges de profil et absence d’administration en démo. Sur 320 × 780, compétition et réglages sans débordement horizontal : page 320 px, dialog client/scroll 318 px. Capture de compétition inspectée ; pas d’erreur ni avertissement console relevé pendant ce parcours.
- Après la dernière correction, recette du build de production local : entrée en démo, retour au formulaire de connexion, nouvelle entrée en démo, compétitions affichées. Serveur temporaire sur 3001 arrêté après recette ; aucun autre serveur arrêté.

## Installation et limites
Les fichiers sont locaux. Aucun commit, push GitHub, déploiement Vercel ou installation permanente de la migration 004 n’a été effectué. Le projet Vercel existant utilise GitHub ; suivre [admin-competitions.md](admin-competitions.md) pour appliquer le bundle SQL, activer la clôture périodique, puis publier depuis la branche GitHub de production. Aucune nouvelle variable Vercel n’est requise.

La recette admin/second joueur avec de vraies sessions HTTP, la concurrence multi-connexions et la réception des badges sur la version déployée restent à effectuer après installation. Les assertions SQL sous rôle authenticated ne constituent pas un test HTTP avec JWT réels. Pas de test lecteur d’écran pendant cette mise à jour.

---

# Historique des vérifications avant la migration 004
Les sections suivantes décrivent les étapes précédentes, et non l’état actuel de cette mise à jour.

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
