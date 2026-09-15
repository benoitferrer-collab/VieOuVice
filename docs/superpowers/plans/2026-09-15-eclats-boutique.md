# Éclats et boutique — Implementation Plan

> Execute with superpowers:subagent-driven-development. No git operations: the user owns pushes and deployment.

**Goal:** Deliver the approved XP → Éclats → boutique → animated avatar flow.
**Architecture:** Private Supabase ledger and possessions, authenticated atomic RPCs, existing progression inventory extended, shared SVG cosmetics.
**Tech Stack:** Next 16, React, TypeScript, PostgreSQL/Supabase.
**Spec:** ../specs/2026-09-15-eclats-boutique-design.md

## Global constraints
50 XP = 25 Éclats; preserve XP and old unlocks. Nine approved items, prices 25–150. Historical credits once. No production actions. Local SQL migration and standalone bundle; no new variables. Calm/reduced motion respected.

## Task 1 — SQL economy (delegated)
- [x] Write failing SQL tests for historical credit, duplicate credit/purchase, insufficient balance, unauthorized equip, export/purge.
- [x] Create migration 020 and identical update-eclats-shop.sql.
- [x] get_progression returns additional wallet `{balance:number,earned:number,spent:number}` and inventory shop rows `{id,slot,unlocked,price}`; old rows remain.
- [x] buy_cosmetic(p_item_id text) returns updated wallet; server catalog controls price, per-player serialization, unique ownership. Existing equip_cosmetic accepts purchased rows.
- [x] Test local PostgreSQL including concurrent purchases and account deletion.

## Task 2 — Catalogue and demo (root)
- [x] Add tests to tests/shop.test.ts asserting credits, buy twice charges once, insufficient funds, preserved XP and equipment restrictions.
- [x] Add price optional to CosmeticDefinition and wallet optional to ProgressionState (backward-compatible older database).
- [x] Extend metadata with nine approved IDs, demo purchased ID list and server-equivalent purchase behavior.

## Task 3 — UI and animation (root)
- [x] Extend wardrobe with Boutique/Ma collection, wallet and buy confirmation; after uncertain result reload before retry, do not report success without evidence.
- [x] Add isolated SVG shop-background/accessory components and large-avatar-only CSS motion; disable in calm and reduced-motion.
- [x] Show wallet in profile, update guide.
- [x] Verify mobile/desktop purchase/equip visually through CUA.

## Task 4 — Review and delivery
- [x] Independent review for transaction integrity and client integration.
- [x] Run Node tests, lint, webpack production build; document deployment order.

## Execution record
Preflight: tasks 1 and 2 share only the wallet/inventory/RPC contract above; task 3 consumes task 2 metadata. Existing equipped slots remain unchanged. SQL and TS files have separate ownership. Work is in the user’s existing project; no git/worktree operations, consistent with standing instructions.

Completed: SQL worker delivered atomic ledger, possessions, export and purge integration. Independent review found stale receipt/recovery issues; corrected with a dialogue-owned snapshot, authoritative recovery errors, and refresh before every new opening. All final checks recorded in docs/verification.md. No git or production changes.
