# Cooperative and alerts implementation plan

> Use superpowers:subagent-driven-development for independent tasks, root integration and review.

Goal: deliver cooperative healthy challenges, descriptive consumption counts and quieter notifications in existing Supabase SaaS game.
Architecture: isolated private SQL/RPC modules and scoped client components; existing game declarations are source of truth.
Spec: ../specs/2026-09-10-cooperative-alerts.md
Constraints: no Git/push/deploy, no old migration edits, no real notifications, Next docs before code.

- [x] Task1 SQL010: test permissions, invitations, cap/day, post-acceptance windows, idempotent create/award, blocked pairs; implement migration, exact manual bundle and tests. Contract defined in spec. Verify in local PostgreSQL.
- [x] Task2 SQL011 and alert UI: test overnight/DST quiet hours and independent categories; implement server eligibility/defer plus UI and safe auth; tests and manual SQL. Preserve old push wrappers and grants. Integrate into settings via root.
- [x] Task3 root client coop + descriptive journal: test daily aggregation and ambiguous old drinks; types/rules/demo/hook/components, integrate home/profile and journal. Fail closed across accounts. No alcohol targets.
- [x] Task4 root integration/review: run SQL test suites, Node lint/typecheck/build, CUA synthetic demo; document exact migration order and remaining SaaS checks. No publishing.

Ruling: seven-day invited teams 2–5, preset bounded healthy targets, aggregate shared consent, no team chat — matches accepted cooperative proposal without introducing permanent groups.

Implementation complete locally, 11 September. Workers interrupted by quota after partial SQL; root completed UI, push worker, tests and fixes. Root review caught SQL alias ambiguity, reaction constraint compatibility, opt-out replay and SQL test evaluation order; fixed and verified on fresh local DB001–011. 79 Node tests, lint/typecheck/build pass; browser demo verified. No independent final review available; no remote mutations. See docs/cooperative-alerts.md and docs/verification.md.
