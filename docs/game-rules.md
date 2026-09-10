# Règles d’Excès-O-Meter

Le produit est un jeu WEB dans le navigateur. Aucune application native, aucun store ni compte Google/Apple requis. L’installation en raccourci est facultative.

## Arbitrages de conception proposés
Les règles ci-dessous reprennent les arbitrages proposés dans le document de cadrage, sans les présenter comme des exigences originales déjà validées ni des connaissances scientifiques.

- Unité affichée : « minutes de vie » gagnées ou perdues, fictives. Ce libellé remplace « minutes de jeu » à la demande de l’utilisateur le 8 septembre 2026. Aucune estimation d’espérance de vie, de calories ou de risque médical. Les actions saines n’annulent aucun effet réel d’un excès.
- Public adulte, aucun argent, paiement, lot ni valeur réelle.
- Solde signé ; statut Zombie à zéro ou moins ; saisie et gains sains toujours possibles. Une réanimation ne dépend pas obligatoirement d’un don.
- Bonus initial unique : 500 minutes, sans points hebdomadaires.
- Zombie ≤ 0 ; Funambule 1–250 ; Survivant 251–1999 ; Divinité ≥ 2000.
- Score de ligue et duel : total positif des pertes dues aux excès de la semaine, le plus élevé gagne. Les bonnes habitudes ne réduisent pas ce score officiel. Une seconde vue compare le bilan net (pertes moins récupérations). Le solde global est préservé à la clôture, le score de la nouvelle saison commence à zéro.
- Semaine : lundi 00:00 Europe/Paris → lundi suivant, borne finale exclue. Les jours de plafonds utilisent Paris aussi. Les saisons sont calculées avec des bornes calendaires locales, pas 168 heures fixes.
- Ligues de 30 maximum, 5 divisions. `floor(effectif / 6)` promotions et relégations, donc aucune sous 6 membres. Bornes de division respectées. Tri score décroissant puis UUID PostgreSQL croissant.
- Némésis facultatif : consentement désactivé par défaut. Appariement réciproque au changement de saison, même ligue, score précédent proche, évitement des répétitions lorsque possible et des blocages.
- Dons : amitié acceptée, compte donneur de 24 h, 1–100 minutes par don, 200 par jour ; garder au moins 1 minute. Aucun point de ligue.
- Déclarations manuelles immédiates uniquement : l’application limite la falsification technique, pas les fausses déclarations humaines. Maximum 10/minute et 100/jour. Gains plafonnés par catégorie.

## Catalogue initial
| Catégorie | Quantité autorisée | Coefficient fictif | Plafond gain quotidien |
|---|---:|---:|---:|
| Prendre l’air | 1–3 | +25 | 75 |
| Une bonne nuit | 1–12 | +10 | 80 |
| Bouger un peu | 1–2 | +40 | 80 |
| Une vraie pause | 1–3 | +15 | 45 |
| Un verre de trop | 1–10 | −30 | sans gain |
| Craquage gourmand | 1–5 | −20 | sans gain |
| Scroll sans fin | 1–8 | −15 | sans gain |
| Nuit écourtée | 1 | −50 | sans gain |

Ces quantités et coefficients sont des valeurs d’équilibrage du jeu, jamais des recommandations de comportement.

## Version livrée et extension
Premier souffle est un trophée cosmétique ajouté à la première déclaration, sans gain. Les six trophées avancés, les paris, les traquenards, la Tentation et la roulette du lundi du brief ne sont pas encore implémentés ; aucun bouton actif ne les simule en mode connecté. Les deux trophées avancés visibles au profil sont verrouillés. Le mode Démo contient des joueurs fictifs et un score initial illustratif ; il est indépendant des données réelles.

## Actions communautaires
Les joueurs connectés peuvent publier jusqu’à cinq écarts ou bonnes actions par jour (Europe/Paris) : nom, unité, valeur de 1 à 120 minutes de vie fictives et quantité maximale de 1 à 10. Les autres joueurs peuvent les rechercher et les utiliser. Les créations sont immuables ; une nouvelle valeur demande une nouvelle variante. Les bonnes actions communautaires sont limitées à 120 minutes par catégorie et 150 minutes au total par jour. Les barèmes officiels gardent leurs propres plafonds. Ces valeurs sont choisies pour le jeu et ne représentent pas une estimation médicale.

Le partage d’activité aux amis est désactivé par défaut. Les amis acceptés peuvent recevoir une alerte après activation, au maximum une par auteur et destinataire par heure. Les duels notifient leur début, le changement de meneur (borné par heure) et leur fin. La réception amis/duels et le consentement navigateur sont réglables séparément.

## Historique partagé et compétitions
Un consentement distinct permet aux amis acceptés de consulter toutes les déclarations des sept derniers jours glissants. Il est désactivé par défaut ; blocage ou retrait du partage coupe les lectures suivantes.

Les administrateurs créent des compétitions de 90 jours maximum. Inscription avant le début, règles figées à la publication. Score : minutes positives, bilan net ou gains d’une catégorie saine, calculé uniquement sur les actions de la période (fin exclue). Les dons et bonus de départ sont exclus, les plafonds habituels s’appliquent. Les égalités partagent le rang ; le classement final est figé. Un badge permanent par compétition récompense les participants ayant au moins une action éligible : gagnant, podium ou participation. Aucun badge pour un événement annulé. [Utilisation et installation](admin-competitions.md).

## Missions et apparences
Chaque semaine du lundi au lundi, heure de Paris, choisir trois missions parmi cinq : pauses sur trois jours, bonnes habitudes sur trois jours, trois catégories saines, nouvelle bonne habitude, action saine éligible dans une compétition rejointe. Les actions positives de la semaine comptent même avant le choix. Une mission vaut 50 XP, maximum 150 XP par semaine ; aucun effet sur les minutes de vie ou la ligue. Un niveau tous les 100 XP. Les choix et récompenses attribuées sont conservés. Le premier trio donne un badge. Accessoires, titres et décors sont équipables selon XP ou badges de compétition ; détails dans [progression-social.md](progression-social.md).

Les encouragements sont limités à une réaction par ami et déclaration partagée des sept derniers jours. Ils ne rapportent pas de XP. Les changements réels sont limités à 20 par minute et 100 par jour de Paris ; les reprises identiques ne consomment pas de quota.

## Temps perdu et catalogue étendu
Les compteurs personnels agrègent tout le journal, hors bonus, dons et XP. Affichage en minutes, heures ou années fictives de 365 jours. Voir [loss-scoring.md](loss-scoring.md) et les 18 [catégories supplémentaires](catalog-actions.md). Les anciens barèmes et saisons clôturées restent conservés.
