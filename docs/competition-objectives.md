# Objectif des événements (022)

Dans Supabase → SQL Editor, exécuter une seule fois `supabase/update-competition-objectives.sql` après les mises à jour précédentes. Ensuite pousser le code pour le déploiement Vercel. Aucune nouvelle variable.

Administration → Événements → Nouvel événement → Objectif du classement :

- **Top bonnes actions** : somme des minutes positives. Le plus grand total gagne.
- **Top petits écarts** : somme des minutes perdues, affichée comme un score positif. Le plus grand total gagne. Les bonnes actions ne compensent pas ce score.
- **Meilleur bilan net** : gains moins pertes, du plus grand au plus petit.
- **Catégorie saine** : minutes positives d’une seule catégorie.

Il s’agit de minutes fictives du jeu, pas du nombre de déclarations. Seules les actions effectuées après l’inscription et pendant la fenêtre de l’événement comptent. La fin de la fenêtre est exclue. Les égalités et badges suivent les règles existantes. Le critère est choisi au stade brouillon ; les résultats déjà terminés restent figés.

Les contrôles des fiches joueurs ont été corrigés : les champs textuels occupent la largeur disponible, les interrupteurs gardent une largeur fixe. Les permissions et confirmations de suppression restent inchangées.

Vérification : 127 tests Node, migration et tests PostgreSQL locaux (base 001–004, seed et 022), suite historique admin_competitions, recette visuelle avec faux joueur sur ordinateur et mobile 390px. Aucun changement de compte ou d’événement réel.
