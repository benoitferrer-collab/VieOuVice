# Identités de saisons et gestion des propositions IA

Choix utilisateur : génération automatique à chaque saison, avec Workers AI existant. Supprimer les propositions de l'atelier individuellement ou par lot, sans toucher aux compétitions déjà créées.

1. Atelier : conserver les identifiants/index de propositions et un masque de suppression ; retirer le contenu supprimé sans réinitialiser le quota quotidien ou permettre une reprise de génération. RPC admin avec confirmation et audit, UI de suppression individuelle et de lot. Tests SQL.
2. Identité : une recette JSON fermée par saison (nom, cinq noms de division, cinq emblèmes composés à partir d'icônes/couleurs connues). Génération serveur sans données personnelles, un essai par saison avec lease empêchant les doublons, secours local si échec. Le cron push existant appelle un worker séparé après l'envoi des alertes ; aucune génération dans le rendu client ou dans la transaction de saison. Appels Cloudflare bornés, pas de modification des points/règles/dates.
3. SQL : table privée d'identités, claim/finish service_role, jeu expose seulement l'identité publiée de sa saison/division. La saison courante est la seule cible du worker. En cas d'interruption, la lease expirée se termine sur un thème préparé sans second appel fournisseur.
4. Interface ligue + aperçu admin, guide et installation manuelle SQL. Tests unitaires, SQL local transactionnel, lint et build. Aucune publication GitHub/Vercel ou mutation distante.
