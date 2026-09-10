# Temps fictif perdu et double classement

Demande validée : afficher à la fois les pertes dues aux excès et le bilan net après bonnes habitudes ; les plus grands excès gagnent. Arbitrage annoncé : classement principal brut pour la ligue/duel, classement net secondaire consultable.

- Pertes brutes = somme des valeurs négatives des déclarations d’excès, rendues positives. Récupérations = somme des impacts positifs des bonnes habitudes. Bilan net = pertes brutes moins récupérations, signé et sans plancher. Un bilan négatif indique du temps fictif récupéré.
- Compteurs personnels depuis l’inscription, calculés côté SQL sur toutes les actions, jamais seulement les100lignes du journal. Exclure bonus initial, dons, XP, actions futures. Durées entières : minute, heure60min, jour24h, année conventionnelle365jours ; décomposition exacte et totalminutes lisible.
- Classements hebdomadaires bruts et nets décroissants, départage identifiant pour cohérence avec les promotions existantes. Le brut reste officiel pour promotions et Némésis. Le net ne provoque pas de promotion/duel distinct.
- Changement au moment de l’installation pour toutes les saisons non closes : événements compensatoires de score, sans changer le capitalvie ni modifier le ledger immuable. Saisons closes conservées. Les futurs mouvements d’excès donnent un league_delta positif, les bonnes habitudes zéro ; les minutes de vie conservent leur signe et les plafonds restent appliqués. Recalcul exact et sans doublon.
- Les compétitions spéciales conservent leur critère explicitement choisi (bonnes actions/net/catégorie) et leurs badges ; elles n’adoptent pas silencieusement les règles de ligue.
- Le wrapper get_game_state préserve ses champs et ajoute loss_scoring:true, life_stats, weekly_stats, et weekly_stats sur players/nemesis. Chaque stats={lost_minutes,recovered_minutes,net_lost_minutes}. Les nouvelles stats d’autres joueurs sont bornées à la ligue autorisée/duel, blocages et suspensions exclus. Aucun journal tiers ni totalpersonnel tiers renvoyé.
- Démo normalisée sans perdre actions, amis,cosmétiques ; compteurs propres calculés sur son historique et semaine Paris. Mode backend ancien conservé en attendant migration pour éviter mélange de scores.
- UI : compteur principal de pertes, récupération et bilan net ; deux onglets dans Ligue avec unités explicites ; duel en minutes perdues, texte/règles adaptés. Ton adulte et ludique, chiffres fictifs, sans injonction à multiplier les excès.
- Aucun Git/push, aucune modification distante permanente, aucun secret lu. Migration007 et bundle équivalent à exécuter manuellement. Pas de nouveau job ni variable.

## Extension du 10 septembre
Ajout de 18 catégories officielles, avec valeurs fixes dans les fourchettes fournies et plafonds de récupération, via migration 008. Barèmes explicitement fictifs ; les explications physiologiques ne sont pas importées. Les quatre catégories de cuite sont exclues du catalogue compétitif. Les IDs existants et leurs tarifs restent inchangés. Le mode démo met à jour son catalogue sauvegardé sans écraser les créations communautaires. Bundle manuel commun 007–008 : `supabase/update-loss-and-actions.sql`.
