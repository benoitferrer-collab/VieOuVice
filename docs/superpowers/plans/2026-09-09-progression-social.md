# Progression et encouragements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Livrer réactions groupées, missions hebdomadaires et cosmétiques équipables.
**Architecture:** RPC Supabase privées avec wrappers publics, migrations005/006 additives, hub progression isolé et simulation démo, composants dédiés réutilisant Reaper.
**Tech Stack:** Next16.3.4, React19, TypeScript, PostgreSQL Supabase.
**Spec:** docs/superpowers/specs/2026-09-09-progression-social-design.md

## Global Constraints
Aucun Git/commit/push/worktree ni modification cloud permanente. Aucun secret lu. Pas de Docker. Contrats lib/progression/types.ts root. Protéger les modifications des autres. Le script de workspace SDD n’est pas exécuté : racine Git hors projet ; ce plan sert de registre local.

## Task1 — Réactions SQL
Propriétaire : migrations/202609090005_encouragements.sql, tests/encouragements.sql dans supabase, supabase/reaction-jobs.sql. Consomme schéma001–004 ; produit les RPC exactes types.ts. Tests préalables : auto/nonami/partagefalse/blocage/suspension refusés, retries/remplacements/retrait, paginationlecture50, quotas, digest dédupliqué et révocationpush, export privé. Implémenter tables privées, fonctions/grants, nouvelles contraintes notifications, raccord WebPush et job. Aucune modification005 par autre worker.
- [x] Assertions SQL écrites puis migration implémentée, revue statique. Exécution distante non réalisée.

## Task2 — Progression SQL
Propriétaire : supabase/migrations/202609090006_progression.sql, supabase/tests/progression.sql. Consomme005 colonne notify_reactions et schéma004 ; produitget_progression, choose_weekly_mission, equip_cosmetic, get_player_looks. Tester frontières Paris/DST, troischoix, sélection répétée,50XP/150cap, antériorité nouvellehabitude, participation effective, récompense unique, équipement verrouillé, visibilité et export. Tables privées/compteurs calculés dans definer/search_pathvide, verrou738291.
- [x] Assertions écrites puis migration, revue statique. Exécution distante non réalisée.

## Task3 — Composants présentation
Propriétaire : components/progression/{missions,wardrobe,reactions,player-identity}.tsx et progression.css, components/avatar.tsx. Consomme types.ts et metadata.ts fournis root ; composants reçoivent data/rpc/changed. Missions choisissables avec progressions ; vestiaire aperçu et équipement ; barresréactions accessibles envoient étatfinal ; identité affiche accessoires/badges/titre. Avatar extendcosmeticsprop optionnel, ne casse anciens appels. UI française,320px, busy/erreurs/retry sans perdre choix.
- [x] Composants puis typecheck/lint, revue et recette mobile.

## Task4 — Root : contrats, simulation, intégration
Fichiers lib/progression/{types,metadata,rules,demo,use-progression}.ts, tests/progression.test.ts et encouragements.test.ts, game.tsx/friend-activity.tsx/action-list.tsx/leaderboard.tsx/competitions.tsx/notifications.ts. Tests métier avant implémentation, puis simulation/hookcompte, intégration missionsSurvie/vestiaireProfil/réactionsAmis+Journal/identités publiques. Réglage digest ajouté aux préférences. Exemple d’assertion : assert.equal(levelForXp(150),2) ; assert.throws quatrièmechoix ; deux retrieséquips/réactions sans duplication. Garder l’export démo honnête et resetglobal.
- [x] Contrats et tests, règles et simulation, hook et intégration.

## Task5 — Root/revue finale et livraison
Révision indépendante ciblée SQL et contrats, correction défauts. Regrouper005puis006sansmodifiercorpsdansupdate-progression-social.sql, testparité. Jobdigest séparé. Exécuter tests/lint/typecheck/build (aucun dev simultané au build), SQL rollback si accès déjàconfiguré, recette UI etmobile, mettreàjourdocs. Déploiement utilisateur GitHub/Vercel seulement.
- [x] Vérifications locales réalisées (52 tests, lint, typecheck, build, recette démo), limites documentées et scripts livrés.
- [ ] Validation PostgreSQL distante et recette authentifiée avant production : bloquées par accès CLI IPv6 ; installation manuelle selon le guide.

## Registre / prévol
|Interface|Producteur|Consommateur|Décision|
|types.ts|Root|Tous|Autorité des signatures, aucun worker ne modifie|
|005 notify_reactions/export|Réactions SQL|006 progression|006 s’installe après005 ; exports enveloppés dans cet ordre|
|Reaper cosmetic props|UI|Rootintégration|Propsoptionnelles, anciensappelscompatibles|
|UI data/rpc|Root hooks|UI|Pas d’accès Supabase direct dans les composants|
|005/006/tests|SQLworkers|Rootbundle|Fichiers distincts ; ne pas modifier anciennesmigrations|
Ruling: la sélection explicite par l’utilisateur valide les trois améliorations proposées ; les détails réversibles sont arbitrés dans la spec pour avancer sans reconfirmation. Toute installation permanente reste manuelle.

## Revue finale
La fermeture/annulation d’un événement règle d’abord les XP déjà mérités des participants, avant d’appeler la transition004 existante. Droits et signature relus indépendamment. Correctif de parité démo : une ancienne déclaration à valeur nulle ne consomme pas une nouvelle habitude. Aucun Git ni déploiement.
