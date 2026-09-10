# Catalogue supplémentaire

18 catégories avec des valeurs fixes de gameplay : ces minutes ne prédisent pas la durée de vie réelle. Les mécanismes physiologiques du tableau fourni ne sont pas repris.

| Action | Minutes fictives / unité | Maximum par déclaration | Plafond de récupération / jour |
| --- | ---: | ---: | ---: |
| Cocktail léger / dilué (cocktail) | -25 | 5 | — |
| Cocktail fort / sucré (cocktail) | -45 | 5 | — |
| Shot d’alcool fort (shot) | -30 | 5 | — |
| Légumes frais / salade composée (portion) | +20 | 3 | 60 |
| Fruits rouges ou noix (portion) | +25 | 2 | 50 |
| Repas végétalisé riche en fibres (repas) | +40 | 2 | 80 |
| Marche rapide de 30 minutes (marche de 30 min) | +90 | 2 | 180 |
| Sieste courte de 15 à 25 minutes (sieste) | +30 | 1 | 30 |
| Nuit réparatrice de 7 à 8 heures (nuit) | +90 | 1 | 90 |
| Déconnexion / repos calme (pause de 30 min) | +20 | 3 | 60 |
| Vacances / vraie coupure (journée) | +180 | 1 | 180 |
| Verre de vin ou bière standard (verre) | -20 | 5 | — |
| Cocktail sucré (mojito, margarita) (cocktail) | -35 | 5 | — |
| Repas lourd (fast-food, friture) (repas) | -45 | 3 | — |
| Charcuterie / viande ultra-transformée (portion) | -30 | 3 | — |
| Journée de stress intense (journée) | -180 | 1 | — |
| Nuit blanche ou sommeil inférieur à 5 h (nuit) | -150 | 1 | — |
| Cigarette (cigarette) | -12 | 20 | — |

Choisir une seule catégorie pour une même consommation ou activité : les anciennes catégories restent disponibles pour préserver les habitudes et les historiques. Les quatre catégories de cuite sont exclues afin de ne pas récompenser les intoxications dangereuses.

Installation existante jusqu’à 006 : appliquer `supabase/update-loss-and-actions.sql` une fois dans le SQL Editor Supabase, puis publier le code. Si 007 a déjà été appliquée, utiliser seulement `supabase/update-actions-catalog.sql`. Ne pas appliquer les deux bundles.
