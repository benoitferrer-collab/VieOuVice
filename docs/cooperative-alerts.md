# Défis coopératifs, récapitulatif et notifications

La base reste dans le projet Supabase SaaS actuel, l’application sur Vercel. Aucune nouvelle clé ni variable d’environnement. Le worker Web Push existant produit désormais les alertes programmées avant de vider sa file. Il doit donc rester appelé périodiquement pour les appareils dont le jeu est fermé.

## Installation sur la base existante

Les migrations 001–009 doivent déjà être installées. Tester d’abord sur un projet de test, puis dans le SQL Editor du projet voulu :

1. Exécuter **une seule fois** `supabase/update-cooperative.sql` (010).
2. Exécuter **une seule fois** `supabase/update-notification-preferences.sql` (011).
3. Pousser les fichiers sur la branche GitHub reliée à Vercel.

Ne pas relancer `install.sql` ni les anciennes migrations. Les bundles ci-dessus sont identiques aux migrations correspondantes ; ne pas exécuter les deux versions du même script. Ils sont transactionnels et ne suppriment pas les données existantes. Aucun SQL ne s’exécute lors du build Vercel. Aucun nouveau Cron n’est requis ; l’envoi périodique Web Push déjà configuré est réutilisé.

## Fonctionnement des défis

Survie → Défis coopératifs → Créer. Choisir un modèle et inviter un à quatre amis acceptés. Ils retrouvent l’invitation sur leur accueil et doivent accepter. L’équipe comprend au maximum cinq personnes ; elle partage le total et chacun voit sa propre contribution, sans consulter les déclarations privées des autres.

| Défi | Cible collective | Catégories éligibles | Plafond par personne/jour Paris |
| --- | --- | --- | --- |
| Sport | 180 minutes | Activité sportive · 15 minutes (`sport-15`, quantité × 15) | 60 minutes |
| Marche | 200 minutes | Prendre l’air (`walk`, × 20), Marche rapide (`brisk-walk`, × 30) | 60 minutes |
| Pauses | 10 pauses | Une vraie pause (`pause`) | 1 pause |

Durée : sept jours de 24 heures depuis la création. Seules les bonnes actions à impact positif enregistrées après l’acceptation et avant la fin comptent. Les plafonds normaux de minutes fictives restent applicables. Les catégories de sport historiques sans durée connue, comme « Bouger un peu », ne sont pas converties arbitrairement en minutes.

L’objectif atteint avec au moins deux contributeurs attribue une fois le badge permanent « Ensemble, on avance » aux membres ayant contribué. Aucun bonus de minutes ni XP. Le résultat réussi est figé et les badges apparaissent avec l’identité du joueur. Quitter un défi actif retire sa contribution et empêche de le rejoindre à nouveau. Les blocages, suspensions et pertes d’amitié avec le créateur invalident les participations concernées. Une réussite déjà attribuée n’est pas retirée.

Un joueur peut créer au plus un défi actif ; cette limite reste en place jusqu’à sa fin même s’il quitte l’équipe. Chaque ami peut recevoir au plus dix invitations en attente sur des défis actifs. Les erreurs de création peuvent être réessayées dans le même panneau avec la même clé ; après fermeture, consulter l’accueil avant de recommencer. Pas de chat de groupe ou de notifications individuelles d’invitation dans cette version : les invitations sont sur l’accueil et les rappels facultatifs concernent les participations acceptées.

## Récapitulatif personnel

Le journal propose « Mes consommations déclarées », sur sept ou trente jours glissants, calculé depuis tout l’historique dans Supabase (pas seulement les cent lignes affichées). Il affiche les quantités par catégorie, sans objectif, rappel à consommer ou récompense.

Nouvelles catégories : bière, cocktail au gin, activité sportive de quinze minutes. Les anciens « verres » et « vin ou bière » conservent leur catégorie : ils ne permettent pas de déduire leur contenu. Déclarer une consommation dans une seule catégorie pour éviter les doubles comptes. Tous les coefficients restent fictifs et ne constituent pas une estimation médicale.

## Préférences de notifications

Profil → Préférences et confidentialité → Mes notifications. Six catégories : messages, amis, duels, encouragements, compétitions et rappels. Enregistrer les modifications. Le réglage des messages reste partagé avec celui de la messagerie ; les alertes de réactions nécessitent aussi celles des amis.

Les compétitions rejointes produisent une alerte de début et de résultat (rattrapage des dernières 24 heures). Les rappels sont désactivés par défaut ; une fois activés, ils sont limités à un par jour local et par fenêtre de 24 heures pour des défis/compétitions rejoints encore actifs. Ces alertes ouvrent Survie. Aucune notification réseau n’a été envoyée pendant la réalisation.

Les heures silencieuses utilisent un fuseau IANA, par exemple Europe/Paris. La plage peut traverser minuit et suit les changements d’heure. La cloche continue de fonctionner ; la file téléphone est différée sans consommer les tentatives d’envoi. Le consentement, la lecture, les blocages et le silence sont revérifiés juste avant la livraison. Une alerte remise au fournisseur du téléphone avant le silence peut encore arriver pendant celui-ci. Les éléments de plus de 24 heures expirent au lieu de partir en retard. L’envoi reprend à un prochain passage du worker, pas exactement à la minute de fin.

Désactiver une catégorie marque ses notifications en attente comme lues pour empêcher leur réapparition après réactivation. Cette action ne marque pas les messages privés eux-mêmes comme lus. L’autorisation du navigateur et un abonnement Web Push actif restent nécessaires.

## Vérifications

- Build Webpack, lint et TypeScript réussis ; 79 tests Node passent.
- Installation complète 001–011 dans PostgreSQL 18 local isolé avec Auth minimal simulé. Tests SQL défis, préférences, messagerie et révocation Web Push réussis ; fixtures annulées. Test de compatibilité des réactions ajouté (horodatages antérieurs à la transaction) ; l’ancien test global des encouragements garde sa limite déjà documentée dans `verification.md`.
- Démo navigateur : création d’un défi sportif avec ami fictif, déclaration de quinze minutes → progression 15/180 ; bière fictive → quantité 1 dans le récapitulatif, périodes 7/30 jours ; enregistrement des horaires silencieux ; rendu 375 px sans débordement horizontal, aucune erreur console relevée.
- Les données de défis en démo sont limitées à la session ; aucune invitation réelle. Les préférences de démo sont un aperçu et ne modifient pas le compte.

Après déploiement, tester avec deux comptes dédiés : invitation/acceptation, exclusion des actions avant acceptation, progression et badge, refus/quitter/blocage ; messages pendant/après les heures silencieuses ; consentement et réception effective sur téléphone. Ces parcours Supabase Auth/PostgREST et la livraison réelle restent à vérifier sur le SaaS.
