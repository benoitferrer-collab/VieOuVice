# Historique des amis, administration et compétitions

## Mise en production de viegame

Le projet Vercel est déjà relié à GitHub. La mise à jour se publie en poussant les nouveaux fichiers sur la branche de production configurée dans Vercel. Les variables Supabase et Web Push existantes restent utilisables : **aucune nouvelle variable d’environnement n’est nécessaire** pour cette fonctionnalité.

1. Dans le projet Supabase `vgbmyjodwdxrvycnpsho`, ouvrir **SQL Editor → New query**, coller tout le contenu de [`supabase/update-admin-competitions.sql`](../supabase/update-admin-competitions.sql), puis exécuter **une seule fois**. Ce script nécessite les migrations 001, 002 et 003 déjà installées. Il installe la migration 004 et active `bfe@nomios.fr` comme administrateur. L’email, l’UUID vérifié et l’existence du profil doivent tous correspondre ; une erreur annule la transaction complète. Ne pas rejouer `install.sql` ni appliquer séparément 004 ou `bootstrap-admin.sql` après ce bundle.
2. Pour attribuer les badges même si personne n’ouvre le jeu, exécuter [`supabase/events-jobs.sql`](../supabase/events-jobs.sql) dans une nouvelle requête. `pg_cron` doit être activé ; il l’est normalement déjà pour l’envoi périodique Web Push de ce projet. Le job `close-due-competitions` clôture les compétitions toutes les cinq minutes. Sans ce job, l’ouverture du hub ou d’une compétition rattrape les clôtures.
3. Pousser les fichiers du projet sur la branche GitHub suivie en **Production** par Vercel, puis attendre le statut **Ready** dans **viegame → Deployments**. Le déploiement doit correspondre au nouveau commit. Un simple **Redeploy** de l’ancien commit ne contient pas les nouveaux fichiers. Les `.env*`, `node_modules/` et `.next/` restent exclus ; leurs exclusions sont déjà dans `.gitignore`.
4. Ouvrir [viegame](https://viegame.vercel.app/), actualiser et se connecter avec `bfe@nomios.fr`. Dans **Profil → Administration**, créer un brouillon avec un début futur, puis le publier. Il devient visible dans **Survie → Compétitions** et un autre joueur peut s’inscrire avant le début.

Le SQL est additif et le frontend précédent reste utilisable après son installation. Pour revenir au frontend précédent, utiliser le retour arrière Vercel ; conserver la migration et les données de compétition. Aucun effacement de tables n’est nécessaire.

Sur un autre projet, appliquer la migration 004 seule et adapter explicitement le bootstrap à l’identité voulue. Le bundle personnalisé de viegame ne convient pas à une autre base.

## Utilisation

- **Amis** : ouvrir un ami accepté pour lire ses déclarations sur sept jours glissants, par pages de 50. Filtres toutes/bonnes actions/petits écarts. Le nombre affiché est celui des déclarations chargées.
- **Profil → Préférences et confidentialité → Ma semaine avec mes amis** : activer le partage des sept derniers jours. Désactivé par défaut, ce choix est indépendant des alertes d’activité. Un blocage, une amitié retirée ou un retrait du partage interdit les prochaines lectures ; les données déjà vues ne peuvent pas être retirées de la mémoire d’un destinataire.
- **Administration** : gérer les brouillons, publier/annuler les événements, rechercher les joueurs, suspendre/réactiver les comptes, attribuer/retirer le rôle admin et activer/désactiver les actions du catalogue avec un motif. L’audit conserve les changements. Le dernier administrateur actif est protégé et un admin ne peut pas se suspendre lui-même.
- **Compétitions** : titre, description, dates, critère de score et badge personnalisables. Le formulaire affiche l’heure locale du navigateur et transmet les instants avec leur fuseau. Durée maximale : 90 jours. Les règles sont figées à la publication ; l’inscription et la désinscription ferment au début. Une inscription rend le pseudonyme, l’avatar et le score visibles aux joueurs connectés dans ce classement.
- **Badges** : un badge par compétition et joueur ayant au moins une action éligible. Rang 1 : gagnant ; rang 2/3 : podium ; autres rangs : participation. Les égalités partagent le rang. Les résultats et badges sont figés à la clôture et les badges apparaissent dans le profil. Une compétition annulée ne distribue rien.

Les critères disponibles sont les minutes positives, le bilan net des gains et pertes, ou les gains d’une catégorie saine. Seules les déclarations enregistrées pendant l’événement, début inclus et fin exclue, comptent. Dons, bonus initiaux et anciennes déclarations n’entrent pas dans le score ; les plafonds du jeu restent applicables.

Le rôle admin concerne la gestion du jeu. Il ne révèle aucun mot de passe ni clé Supabase et ne permet pas de réécrire le journal des actions. Les contrôles sont exécutés dans la base à chaque opération ; masquer un bouton ne constitue pas l’autorisation.

## Vérification après déploiement

Avec l’admin et un second compte : publier un événement futur, s’y inscrire depuis le second compte, constater le classement, vérifier le partage d’historique désactivé puis activé, et tester son retrait. Après la fin d’un événement court, vérifier le résultat et le badge d’un participant ayant déclaré une action éligible. L’administration doit être absente d’un compte ordinaire et les appels admin directs doivent être refusés. Les contrôles déjà exécutés sont recensés dans [verification.md](verification.md).

Référence du déploiement automatique : [Vercel — Git deployments](https://vercel.com/docs/deployments/git).
