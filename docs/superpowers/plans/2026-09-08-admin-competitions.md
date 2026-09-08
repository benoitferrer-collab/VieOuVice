# Amis, administration et compétitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ajouter les historiques partagés des amis et les compétitions administrées avec badges.
**Architecture:** RPC Supabase à autorisation serveur, migration additive 004, hub séparé compatible V1, composants React dédiés et simulation locale explicite.
**Tech Stack:** Next.js 16.3.4 / React 19 / Supabase PostgreSQL / TypeScript / Zod.
**Spec:** docs/superpowers/specs/2026-09-08-admin-competitions-design.md

## Global Constraints
Aucun Git/commit/push/worktree (dépôt parent hors projet), pas de Docker/base locale, pas de mutation cloud par les workers, aucun secret lu. Contrats partagés lib/events/types.ts. Préserver les modifications des autres.

## Task 1 — SQL et contrôle d’accès (worker SQL)
- [ ] Écrire supabase/tests/admin_competitions.sql : utilisateur ordinaire rejeté par admin RPC, historique inaccessible sans consentement/amitié ou après blocage, pagination stable, idempotence d’inscription/création, rejet dates/règles après publication, égalités et badges uniques, suspension et dernier admin protégés.
- [ ] Implémenter supabase/migrations/202609080004_admin_competitions.sql selon les RPC de la spec. L’ancien get_game_state reste intact ; sérialisation avec verrou de jeu existant pour mutation/clôture.
- [ ] Fournir supabase/events-jobs.sql et bootstrap admin séparé, ciblé email/UUID vérifiés de la spec.
- [ ] Relire grants/RLS, lecture publique des classements, rétroactivité et audit. Rapporter précisément les contrôles non exécutés.

## Task 2 — Interfaces événements et admin (worker UI)
- [ ] Créer components/competitions.tsx : accueil, détail avec classement paginé, inscription avant début avec info visibilité, résultats.
- [ ] Créer components/admin-panel.tsx : gestion brouillons/publication/annulation, joueurs/rôles/suspension, catalogue actif/inactif et motifs ; erreurs et chargements inline. Formulaire Zod `competitionDraftSchema` fourni par root.
- [ ] Styles dédiés components/events.css importés par les composants. Pas de modification game.tsx/globals.css/use-game.ts ni types.
- [ ] Typecheck ciblé et revue UX. API commune : rpc(name,payload) et changed() fournis par root ; Props exactes dans lib/events/types.ts.

## Task 3 — Contrats, simulation et intégration (root)
- [ ] Écrire tests/events.test.ts puis lib/events/rules.ts + validation.ts pour fenêtres de compétition, score, égalités et validation ; faire passer les tests.
- [ ] Hook use-social-hub.ts indépendant (migration manquante gérée sans masquer les autres erreurs) ; simulation locale et actualisation des événements à partir des actions démo.
- [ ] Historique ami dans components/friend-activity.tsx avec consentement séparé dans les préférences ; boutons sur les amis acceptés.
- [ ] Intégrer accueil, admin et badges dans game.tsx ; reset/reconnexion ne réutilisent pas l’historique d’un autre compte.

## Task 4 — Vérification/livraison (root et reviewer)
- [ ] Revue SQL + intégration indépendante ; corriger les défauts significatifs.
- [ ] Tests, typecheck, lint, build et navigateur ; absence de validation cloud clairement annoncée.
- [ ] Fichier d’upgrade exact, docs migration/admin, compte cible activable par utilisateur. Aucun déploiement ni envoi GitHub.
