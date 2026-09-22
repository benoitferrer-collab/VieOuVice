# Accueil et personnages — mise en œuvre

Design approuvé par le choix utilisateur : actions prioritaires en premier, personnages illustrés expressifs et prochain accessoire avec aperçu. Mise en œuvre locale sans push, sans SQL et sans données fictives mélangées aux comptes réels.

- [x] Fonctions pures de sélection : tours et invitations valides, messages d’amis acceptés, mission choisie non terminée, prochain accessoire présent dans l’inventaire et non possédé. Tests de priorité, expiration, accès et conditions XP/Éclats/badge.
- [x] Accueil : composant dédié avec récupération des duels via le hook sécurisé existant, chargement/erreur explicites, liens directs et ouverture de la section missions.
- [x] Progression : aperçu local du prochain accessoire et ouverture du vestiaire sur cet objet, sans achat/équipement implicite.
- [x] Illustration vectorielle des quatre personnages : nouvelles silhouettes, visages, expressions et pose de victoire ; garder les ancrages d’accessoires, les animations clavier/tactiles et les préférences de mouvement.
- [x] Validation : suite Node, lint/build, recette démo mobile et revue de la compatibilité des accessoires. Aucune modification distante.
