# Encouragements, missions et avatars

## Ce qui est ajouté
- Dans Amis, réagir aux déclarations partagées des sept derniers jours avec 👏, 💪 ou 😂. Une seule réaction par personne et déclaration ; recliquer la retire. Le journal personnel affiche les compteurs reçus.
- Dans Survie, choisir jusqu’à trois missions parmi cinq. Les bonnes actions déjà déclarées cette semaine comptent. Chaque réussite rapporte 50 XP, avec un plafond de 150 XP par semaine. Le choix est définitif jusqu’au lundi suivant, à minuit heure de Paris. Les semaines suivent les changements d’heure.
- Dans Profil → Personnaliser mon avatar, essayer puis équiper accessoires, titres et décors. Les XP et badges de compétition débloquent les pièces. Le premier trio de missions accomplies donne un badge permanent. Les apparences et jusqu’à trois badges sont visibles dans les amis et classements autorisés.

Les XP sont distincts des minutes de vie et du classement de ligue. Aucune réaction ne rapporte de XP. Une récompense déjà attribuée reste acquise ; les XP mérités pour une compétition sont comptabilisés avant son annulation.

## Installation sur le projet existant
Les migrations 001 à 004 doivent déjà être installées. La mise à jour est additive et ne doit être exécutée qu’une fois. Aucun secret supplémentaire et aucune nouvelle variable Vercel ne sont nécessaires.

1. Valider d’abord sur un projet Supabase de test contenant les migrations 001–004 et le catalogue. Dans SQL Editor, exécuter **supabase/update-progression-social.sql** : il regroupe exactement 005 puis 006 dans une seule transaction. Ne pas appliquer les deux migrations séparément en plus du bundle.
2. Sur ce projet de test, exécuter **supabase/tests/encouragements.sql**, puis **supabase/tests/progression.sql**. Chaque fichier crée des données synthétiques dans une transaction annulée par ROLLBACK. Ils vérifient les permissions, la confidentialité, les quotas, les récompenses et les annulations. Ne pas supprimer les transactions des fichiers de test.
3. Après validation, appliquer le même bundle une fois dans SQL Editor du projet de production.
4. Pour recevoir les récapitulatifs lorsque personne n’ouvre le jeu, vérifier que Cron est activé dans Supabase, puis exécuter **supabase/reaction-jobs.sql**. Ce script crée ou remplace le job `flush-reaction-digests`, toutes les cinq minutes. Il ne remplace pas l’envoi Web Push déjà configuré : ce dernier expédie les notifications mises en file.
5. Pousser les fichiers de l’application sur la branche GitHub déjà reliée à Vercel. Attendre le déploiement, puis actualiser le jeu. L’agent n’a effectué aucun push ni déploiement.

Le bundle ne réinstalle ni le jeu initial ni le compte administrateur. Les anciennes variables Supabase et Web Push restent utilisées. En absence des nouvelles RPC, l’application masque les nouveaux écrans plutôt que d’empêcher le reste du jeu de fonctionner.

## Encouragements et consentement
Avec la migration 012, chaque premier encouragement est notifié dès la réaction, sans attendre la fin de l’heure. Remplacer, retirer puis remettre un emoji ne crée pas une nouvelle alerte pour la même paire personne/déclaration. Voir [la mise à jour des notifications](instant-notifications.md). Avant 012, les réactions restent regroupées par heure.

Le destinataire peut désactiver les récapitulatifs dans ses préférences. Le réglage général des notifications d’amis reste également nécessaire. Pour le navigateur fermé, son autorisation et l’abonnement Web Push restent requis. Le partage du journal, l’amitié, les blocages et les suspensions sont revérifiés lors de la préparation et de l’expédition. Les notifications non lues devenues inéligibles sont nettoyées. Une alerte déjà remise par le navigateur ne peut pas être rappelée.

## Recette après installation
Avec deux comptes de test amis et le partage d’historique activé : réagir, changer d’emoji et retirer ; vérifier le compteur depuis le compte auteur. Tester aussi un journal privé et un blocage. Avec deux appareils autorisés aux notifications, fermer le jeu puis ajouter un premier encouragement sur une nouvelle déclaration : avec 012, vérifier la réception d’une alerte générique sans attendre la fin de l’heure.

Choisir une mission déjà accomplie, vérifier 50 XP, actualiser et vérifier que les XP ne doublent pas. Choisir trois missions, vérifier l’impossibilité d’une quatrième. Essayer un objet verrouillé, équiper un objet acquis, puis contrôler son affichage depuis le compte ami. Tester une compétition avec une bonne action éligible avant annulation et vérifier la conservation des XP.

## État de validation
Le frontend, la démo et les tests Node sont vérifiés localement ; voir **docs/verification.md**. Les nouveaux scripts SQL ont été relus mais n’ont pas pu être exécutés pendant cette reprise : la CLI Supabase échoue sur la connexion IPv6. Aucune migration distante permanente n’a été appliquée. La validation SQL sur un projet de test et la réception Web Push réelle restent nécessaires avant la production.
