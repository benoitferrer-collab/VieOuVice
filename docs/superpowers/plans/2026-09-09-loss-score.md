# Temps perdu et double classement — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development, tâche par tâche. Aucun Git/worktree : racine Git hors projet.

**Goal:** Compteurs personnels complets et classements hebdomadaires brut/net, avec victoire officielle aux plus grandes pertes brutes.
**Architecture:** Migration007 additive, scorecompensé dans ledger et wrapper get_game_state ; types optionnels rétrocompatibles, règlespures et normalisationdémo ; composants dédiés de durée et résumé.
**Tech Stack:** Next16.3.4, TypeScript, Supabase/PostgreSQL.
**Spec:** docs/superpowers/specs/2026-09-09-loss-score-design.md

## Contraintes
Aucun Git/push ni écriture distante permanente. Aucun secret. Supabase natif. Préserver les autres modifications, le capitalvie, les plafonds, XP, événements spéciaux et saisons déjà closes. Durées fictives, année365jours.

## Tâche1 — SQL, propriétaire workerloss_sql
- [x] Écrire assertions supabase/tests/loss_scoring.sql : plusde100actions, bonus/dons exclus, brut/net, signe négatif, choixligue/duel, réconciliationledger, ancienne saisonpréservée, nouveauxdeltas, retries et permissions.
- [x] Créer supabase/migrations/202609090007_loss_scoring.sql, wrapper stats, compensation saisonsouvertes, actionledger et notificationduellead adaptés. Recherchecontrats privés001–006. Aucun autre fichierworker.

## Tâche2 — Root métier/démo/UI
- [x] Tests avant fonctions : agrégations, formatannées, rangsdeuxvues et scorebrut aprèsaction/répétition. Fichiers lib/life-time.ts, tests/life-time.test.ts, typeslib/game.ts.
- [x] Intégrer normalisationdémo et impacts officiels, summary components/life-time-summary.tsx, leaderboard.tsx et game.tsx. Ancienbackendresteidentique sansloss_scoring.

## Tâche3 — Vérifier et livrer
- [x] RevueSQL/contrats, bundle update-loss-scoring.sql et testparité. TestsNode/lint/typecheck/build, recettenavigateur etmobile. SQLrollback siaccèsdisponible, nepasannoncerSQLtestésaufexécution.
- [x] GuideSQL/GitHubVercel, règles etrapportvérification ; aucunevariable/jobnouveau.

## Extension et validation — 10 septembre
- [x] 18 nouvelles catégories, migration 008, mise à niveau du catalogue démo et parité des bundles.
- [x] 66 tests Node, lint, typecheck, build de production réussis.
- [x] Assertions SQL 007 exécutées après application temporaire de 007–008 ; rollback confirmé. Revue SQL indépendante effectuée.
- [x] Navigateur local : conversion années, gagnants différents brut/net, recherche salade et déclaration +20 ; pertes inchangées, récupération augmentée ; résumé inspecté à 320×780 sans débordement.
- [x] Documentation de mise en production livrée, aucun push ni migration permanente.
