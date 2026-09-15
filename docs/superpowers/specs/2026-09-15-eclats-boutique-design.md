# Éclats, boutique et avatars animés

Proposition de première version — 15 septembre 2026.

## Objectif

Donner une utilité sociale et visuelle à la progression : accomplir ses missions, gagner des Éclats, choisir une apparence et la montrer aux autres joueurs. Les duels et les équipes viendront dans une version suivante.

## Économie

- Chaque tranche de 50 XP acquis rapporte 25 Éclats. Les XP ne sont jamais dépensés et le niveau reste inchangé lors d’un achat.
- Le plafond actuel de trois missions à 50 XP par semaine produit donc au plus 75 nouveaux Éclats hebdomadaires.
- Les XP historiques donnent les mêmes Éclats, crédités une seule fois. Exemple : 300 XP existants donnent 150 Éclats.
- Pas de bonus pour multiplier les déclarations d’excès : les crédits suivent uniquement les XP des missions existantes.
- Monnaie gratuite, personnelle, non transférable, sans achat en argent réel ni conversion monétaire.
- Le solde ne peut pas devenir négatif. Les prix sont fixes et tous les achats sont définitifs, avec aperçu et confirmation explicite du prix.

## Boutique et collection

Étendre le vestiaire existant avec deux vues : Boutique et Ma collection. Afficher le solde d’Éclats près du niveau et dans le vestiaire, avec une explication courte de leur provenance.

Conserver les neuf récompenses actuelles et leurs conditions XP/badges. Ajouter un catalogue distinct de neuf objets achetables :

| Objet | Emplacement | Prix |
| --- | --- | ---: |
| Voyageur cosmique | Titre | 25 |
| Esprit de la forêt | Titre | 25 |
| Étoile du quartier | Titre | 50 |
| Étoile complice | Accessoire | 50 |
| Couronne lunaire | Accessoire | 75 |
| Satellites lumineux | Accessoire animé | 100 |
| Brume astrale | Décor | 50 |
| Jardin des lucioles | Décor animé | 100 |
| Portail cosmique | Décor animé | 150 |

L’essayage est gratuit. L’achat ajoute l’objet à la collection ; le joueur peut ensuite l’équiper. Un objet possédé affiche « Acquis » et ne peut pas être facturé une seconde fois. Un solde insuffisant indique le nombre d’Éclats manquants. Les filtres accessoires/titres/décors existants limitent le défilement.

Cette première version habille les quatre avatars actuels avec des accessoires et décors combinables. Elle ne remplace pas leur silhouette par des personnages supplémentaires.

## Animation et visibilité

Animer doucement le grand avatar dans le vestiaire et le profil : flottement et effets propres aux objets animés. Utiliser les SVG et CSS de l’application, sans service IA ni vidéo à charger.

Les apparences équipées passent par le rendu partagé des identités afin d’être visibles dans les listes de joueurs et les écrans sociaux qui affichent leurs cosmétiques. Garder les petites vignettes statiques pour préserver la fluidité. Le mode calme du jeu et la préférence système de réduction des animations désactivent les mouvements.

Les objets n’accordent aucun avantage de classement ou de combat.

## Architecture et intégrité

Supabase reste la source de vérité. Une migration 020 ajoute un catalogue de prix, un journal des crédits/dépenses et les possessions, dans le schéma privé avec accès direct interdit aux clients.

Une procédure authentifiée synchronise les paliers XP manquants avec une contrainte d’unicité par joueur et palier. Elle est utilisée lors de la lecture du portefeuille et avant les achats. Les XP historiques ne nécessitent pas une opération manuelle par joueur.

Un achat prend uniquement l’identifiant d’objet. La procédure vérifie le compte actif, lit le prix serveur, verrouille les opérations du joueur, synchronise les crédits puis inscrit ensemble la dépense et la possession dans une transaction. Un deuxième appel pour le même objet retourne la possession existante sans débit. Aucun montant ou identifiant de bénéficiaire fourni par le navigateur n’est accepté.

Étendre les fonctions d’inventaire et d’équipement existantes pour reconnaître les objets achetés, tout en conservant les conditions des objets historiques. Étendre les types TypeScript, le mode démo et le composant d’avatar partagé.

Le journal et les possessions sont inclus dans l’export personnel. Leur suppression est compatible avec la suppression définitive administrative et son contexte de purge ; aucun changement n’est autorisé dans le journal en dehors de cette purge.

## Erreurs et compatibilité

Après un résultat réseau incertain, recharger portefeuille et collection avant de proposer de réessayer. Une nouvelle tentative d’achat ne peut pas doubler la dépense. Afficher une erreur locale sans présenter un achat comme réussi si son résultat reste inconnu.

Appliquer la migration avant de déployer le code. Fournir un fichier SQL autonome et les instructions. Aucune nouvelle variable Vercel ni clé API n’est nécessaire. Les modifications restent locales jusqu’au push effectué par le propriétaire.

## Vérification

- SQL : crédits historiques et nouveaux paliers, répétition sans doublon, compte suspendu/non authentifié, solde insuffisant, achat répété, équipement non possédé, conservation des XP et anciens objets, export et suppression du compte.
- Vérifier les achats concurrents pour le même joueur : aucun double achat ni dépassement du solde.
- Tests applicatifs : prix/identifiants cohérents, transitions acheter/possédé/équiper, mode démo, erreurs et reprise réseau.
- Vérification visuelle sur mobile et ordinateur : aperçu, filtres, achat, équipement, réduction des animations, absence de débordement horizontal.
- Lint, tests et compilation de production.

## Choix de conception

Une monnaie distincte permet d’acheter sans perdre ses niveaux. Dépenser directement les XP ferait reculer la progression ; remplacer toutes les récompenses historiques par des achats retirerait des acquis. La boutique complète donc le système existant.
