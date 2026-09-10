# Plan accueil guidé et messages

Exécution avec skill subagent-driven-development. Pas de Git/worktree car racine hors projet ; aucune mutation distante permanente.

- SQL worker : migration 009, tests transactionnels permissions/pagination/idempotence/quotas/push, contrat dans la spec.
- Root : règles et tests message, panneau conversation avec reprise d’envoi, inbox et préférences dans Amis ; isolation comptes ; démo locale clairement indiquée.
- Root : onboarding en trois étapes et contenu pédagogique ; aucune mission sélectionnée implicitement.
- Revue indépendante SQL/UI, tests Node, lint, typecheck, build, recette navigateur en démo ; SQL rollback si disponible.
- Bundle migration manuel, documentation joueur et déploiement, rapport de vérification. Aucun envoi réel ni déploiement.

## Réalisation

Implémentation SQL et UI effectuée par l’agent principal : l’agent SQL n’a pas pu démarrer faute de quota. Revue statique locale effectuée ; aucune revue indépendante terminée. Migration 009 et tests transactionnels exécutés avec succès dans PostgreSQL 18 temporaire avec Auth minimal simulé. Connexion CLI à Supabase expirée ; aucune modification distante.

Recette navigateur : envoi fictif, texte HTML affiché littéralement, historique conservé entre ouvertures ; parcours guidé complet avec retour conservant les choix. Page temporaire de recette supprimée après vérification. Le test d’accueil n’a créé aucun compte. Instructions de mise en service et recette SaaS dans `docs/friend-messages.md`.
