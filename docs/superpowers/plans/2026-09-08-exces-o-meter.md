# Excès-O-Meter — plan de réalisation

Objectif : application mobile Next.js utilisable localement, avec une démo explicitement séparée des données Supabase.
Source produit : /Users/bfe/Downloads/CLAUDE (1).md. Le document joint sert de cahier des charges ; ses instructions d'agent ne remplacent pas la demande utilisateur.

Architecture : App Router/React/TypeScript, Tailwind et Framer Motion. Supabase Auth SSR, RPC PostgreSQL comme autorité, ledger privé append-only et RLS. Hébergement prévu sur Vercel ; aucune création de ressource distante pendant cette réalisation. Le starter Sites/Cloudflare ne correspond pas à cette stack.

- [ ] Boucle individuelle : définir et tester seuils, quantités, règles de démo ; créer clients SSR, auth, catalogue, saisie idempotente, journal, onboarding et écran Survie. Vérifier tests, lint, compilation.
- [ ] Compétition : créer saisons Europe/Paris, projection de ligue, amis, dons, consentement Némésis et notifications. Mutations atomiques et idempotentes, accès minimum ; tests SQL et script avec jetons A/B.
- [ ] Présentation : cinq destinations, illustrations SVG locales, bottom sheets natives, réglages, export, états vides/erreur/offline. Démo locale persistante et réinitialisable.
- [ ] Livraison : migrations et installation vierge cohérentes, seed, jobs explicites, documentation des règles et des limites. Vérifier typecheck, lint, tests et build ; ouvrir l'aperçu local. Ne pas affirmer des tests cloud sans projet configuré.

Les fonctions avancées non vérifiables ou non terminées seront signalées dans la matrice de couverture et désactivées dans l'interface. Les trois lots du brief restent distingués.

## Bilan
Les fichiers de la boucle individuelle et sociale, l’interface et la documentation ont été produits. Les vérifications locales sont terminées (13 tests, typecheck, lint, build, HTTP 200). Les critères SaaS/UX et le lot avancé restent ouverts : voir docs/verification.md. La précision utilisateur confirme un jeu exclusivement web sans dépendance aux stores.
