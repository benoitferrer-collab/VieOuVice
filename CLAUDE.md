# Contexte du projet
Application web Next.js/React/TypeScript, Supabase SaaS. Pas d’iOS/Android ni de distribution en store. Lire README et docs/game-rules.md avant une modification.

Préserver les données réelles et le ledger ; mutations de score exclusivement par RPC et triggers. Ne pas confondre fixtures de démo et données Supabase. Ne pas exécuter de migrations distantes sans autorisation. Ne pas exposer de clé secrète. Rester honnête sur les scénarios cloud non testés.

Contrôles : npm test, npm run typecheck, npm run lint, npm run build. L’installation SQL initiale et la migration 202609080001_initial.sql restent identiques. Les évolutions futures d’une base installée nécessitent une nouvelle migration non destructive.
