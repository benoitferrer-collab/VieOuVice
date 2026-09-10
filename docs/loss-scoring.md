# Temps perdu, bilan net et nouveau catalogue

## Mise en production de cette mise à jour

Le projet viegame avait les migrations 001–006 au moment de la vérification du 10 septembre 2026 ; 007 était absente.

1. Dans le SQL Editor de ton projet Supabase, copier tout `supabase/update-loss-and-actions.sql` et l’exécuter **une seule fois**. Il contient 007 et 008 dans une transaction. Ne pas réexécuter `install.sql` ni appliquer en plus les bundles individuels.
2. Pousser les fichiers de l’application sur ta branche GitHub reliée à Vercel, comme pour les mises à jour précédentes.
3. Après le déploiement, recharger le jeu avec ton compte : les trois compteurs doivent apparaître, la Ligue doit proposer « Excès cumulés » et « Bilan net », et la recherche « salade » doit proposer +20 minutes fictives.

Aucune nouvelle variable Vercel ni tâche périodique. Le build ne migre jamais la base. Si 007 a déjà été appliquée séparément, exécuter uniquement `supabase/update-actions-catalog.sql` pour ajouter 008.

## Calculs

- **Excès cumulés** : toutes les minutes négatives déclarées comme excès, présentées en valeur positive. Ce total classe la ligue et les duels, du plus élevé au plus faible.
- **Bonnes habitudes** : toutes les minutes positives confirmées par le serveur, après plafonds.
- **Bilan net** : pertes moins récupérations. Si le résultat est négatif, l’interface indique le temps récupéré au total. La seconde vue de ligue compare ce bilan entre les joueurs visibles.
- Les compteurs personnels couvrent tout l’historique, même au-delà des 100 dernières déclarations du journal. Les classements couvrent la semaine de Paris.
- Bonus, dons et XP sont exclus de ces compteurs. Le capital du jeu conserve leur prise en compte. Une année de conversion vaut 365 jours ; heures et années affichées seules sont arrondies.

Les saisons ouvertes sont recalculées par des écritures de compensation, sans modifier l’historique ni le capital. Les saisons déjà clôturées restent figées. Les promotions et relégations utilisent les excès cumulés et conservent le rang officiel même lorsque des joueurs sont masqués. Les compétitions spéciales conservent la métrique choisie par leur administrateur.

## Catalogue

18 nouvelles catégories officielles avec tarifs fixes et plafonds : voir [catalog-actions.md](catalog-actions.md). Les coefficients historiques restent inchangés. Une même consommation ou activité doit être déclarée dans une seule catégorie. Les quatre catégories de cuite du tableau fourni ne sont pas intégrées au catalogue compétitif.

Tous ces compteurs sont fictifs et ne constituent pas une estimation de durée de vie réelle.
