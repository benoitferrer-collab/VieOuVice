# Activer les Éclats et la boutique

1. Dans Supabase → SQL Editor, exécuter une seule fois le contenu de `supabase/update-eclats-shop.sql`, après les migrations 001 à 019. Ce fichier correspond à la migration 020 : ne pas exécuter les deux.
2. Pousser ensuite le code sur GitHub et laisser Vercel déployer.
3. Ouvrir Profil → Personnaliser mon avatar. Le portefeuille crédite automatiquement les XP historiques : 50 XP = 25 Éclats, sans retirer les XP.
4. Dans Boutique, choisir un objet, essayer son apparence, confirmer le prix puis l’équiper. Ma collection conserve les objets achetés et les récompenses historiques.

Aucune nouvelle variable d’environnement, clé API ou tâche périodique n’est nécessaire. Les Éclats n’ont aucune valeur monétaire et ne se transfèrent pas entre joueurs. Les prix sont fixés côté Supabase. Les doublons d’achat ne débitent pas une seconde fois.

Les accessoires et décors animés bougent sur les grands avatars. Les petites vignettes restent statiques. Le mode calme et la préférence système de réduction des animations désactivent les mouvements.

Après une coupure réseau pendant un achat, l’application consulte la collection pour retrouver le résultat. Si elle ne peut pas la consulter, elle demande d’actualiser le portefeuille avant un nouvel achat. Chaque ouverture du vestiaire relit également l’état serveur.

## Vérification après déploiement

Avec un compte ayant des XP, vérifier le solde initial, acheter une pièce abordable puis fermer et rouvrir le vestiaire : la possession et le solde doivent être conservés, les XP inchangés. Sans Éclats suffisants, le bouton affiche le montant manquant. Vérifier le rendu de l’objet équipé depuis le profil.
