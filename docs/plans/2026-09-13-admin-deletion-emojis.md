# Administration et emojis composés

Choix confirmés : suppression définitive des comptes, compétitions et missions coopératives ; emojis composés avec Workers AI existant, utilisables dans les messages.

1. Ajouter une procédure de suppression contrôlée côté serveur/SQL, avec confirmation du nom, interdiction de supprimer son propre administrateur, nettoyage des dépendances et tests transactionnels. Aucun compte réel n'est supprimé pendant le développement.
2. Ajouter un catalogue d'emojis composés (recettes fermées, rendu React sûr), génération administrateur avec quotas et persistance, sélection dans la messagerie. Pas d'IA d'image ni de nouvelle clé.
3. Intégrer les commandes dans l'administration, documenter l'installation SQL et vérifier tests, lint et compilation.

Les modifications restent locales. L'utilisateur applique le SQL et publie lui-même.
