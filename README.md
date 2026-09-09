# Excès-O-Meter

Jeu **web** en français, accessible depuis un navigateur sur ordinateur et téléphone. Aucun App Store, Google Play, application native ou compte Google/Apple. Interface sombre, compteur de minutes fictives et cinq destinations : Survie, Ligue, Némésis, Amis et Profil.

## Essayer tout de suite
```sh
npm install
npm run dev
```
Ouvrir http://127.0.0.1:3000. Sans configuration Supabase, le jeu ouvre un **mode Démo explicitement identifié** : essais sauvegardés uniquement dans le navigateur, faux joueurs identifiés, réinitialisation depuis Profil. Aucune inscription requise.

## Jeu connecté
Copier `.env.example` vers `.env.local`, renseigner le projet SaaS Supabase et suivre [l’installation](docs/deployment.md) : SQL initial, seed, Auth email et jobs/publications. Redémarrer Next.js après modification des variables.

Fonctions codées : inscription/connexion/reset email, onboarding pseudo/avatar, catalogue officiel et communautaire personnalisable, déclarations bornées/idempotentes, ledger append-only avec triggers, journal privé, plafonds, ligues/saisons et classement, Némésis consentants, invitations/blocages, dons atomiques, notifications d’amis/duels persistantes et Realtime, Web Push volontaire avec file serveur, préférences et export authentifié. Historique partagé des amis sur sept jours, administration du jeu et compétitions avec inscriptions, classements et badges sont ajoutés par la migration 004.

Les paris, traquenards, roulette, trophées avancés, signalement et suppression self-service du compte restent à réaliser. L’interface les annonce comme non disponibles plutôt que de simuler une opération réelle. Les contrôles exécutés et les parcours authentifiés restant à vérifier après installation sont détaillés dans [le rapport de vérification](docs/verification.md).

## Mettre à jour une base déjà installée
Exécuter une seule fois [`supabase/update-community-notifications.sql`](supabase/update-community-notifications.sql) dans SQL Editor. Ce fichier applique les migrations 002 et 003 dans une transaction. Ne pas réexécuter `install.sql` ni appliquer les mêmes migrations séparément. Le catalogue partagé et les réglages sociaux deviennent disponibles après actualisation du jeu.

Les alertes lorsque le jeu est fermé nécessitent ensuite un hébergement HTTPS, les secrets serveur/VAPID et un envoi périodique : [guide Web Push](docs/web-push.md). L’utilisateur a confirmé leur configuration sur viegame.

Pour la nouvelle mise à jour amis/admin/événements sur viegame, suivre [le guide de mise en production](docs/admin-competitions.md) : bundle SQL `supabase/update-admin-competitions.sql`, clôture périodique facultative, puis déploiement Vercel depuis GitHub. Aucune nouvelle variable Vercel n’est requise.

## Vérifier
```sh
npm test
npm run typecheck
npm run lint
npm run build
```
Les tests distants nécessitent un projet SaaS de test : [instructions](docs/testing.md). Aucune base locale et aucun Docker.

## Structure
- `app/` : pages Next.js, Auth SSR/callback, export et métadonnées web.
- `components/` : interface, avatars SVG, formulaires et dialogs accessibles natifs.
- `lib/` : contrats, règles de simulation, validation, clients Supabase.
- `supabase/` : installation vierge, migration initiale identique, catalogue et jobs.
- `scripts/` : tests avec JWT de comptes dédiés.
- `docs/` : [règles](docs/game-rules.md), [sécurité](docs/security.md), [déploiement](docs/deployment.md), [tests](docs/testing.md).

Stack : Next.js App Router, React, TypeScript strict, Tailwind CSS, Framer Motion, Supabase. Hébergement Vercel prévu ; serveur Node compatible possible. Le jeu conserve ses fonctions principales sans notifications système.
# VieOuVice

## Mise à jour encouragements et progression
Les migrations 005–006 ajoutent les réactions entre amis, leurs récapitulatifs, les missions hebdomadaires (150 XP maximum) et le vestiaire d’avatar. Le [guide progression](docs/progression-social.md) détaille le bundle SQL, le job de récapitulatif et la publication GitHub/Vercel. Les scripts SQL restent à valider sur un projet de test avant production.
