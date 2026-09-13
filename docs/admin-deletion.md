# Suppressions et emojis composés

Appliquer dans cet ordre, une seule fois dans le SQL Editor Supabase :

1. `supabase/update-admin-deletion.sql` (après les mises à jour 001–015).
2. `supabase/update-emojis.sql`.
3. Pousser le code puis redéployer Vercel.

Aucune nouvelle variable : le serveur réutilise `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_AI_TOKEN`. Les clés secrètes restent exclusivement côté serveur.

## Administration

- **Joueurs** : « Supprimer définitivement », recopier le pseudo puis confirmer. Son propre compte administrateur est protégé ; les droits sont revérifiés au moment de la suppression.
- **Événements** : suppression d’une compétition, y compris terminée, avec confirmation du titre. Inscriptions, résultats et badges associés sont supprimés ; les actions et XP acquis restent aux joueurs.
- **Coopération** : mêmes contrôles pour les missions coopératives. La suppression retire la mission et son badge à toute l’équipe.
- **Emojis IA** : choisir une ambiance, composer, puis publier. Tous les joueurs retrouvent les emojis publiés dans Messages → conversation → Emojis composés. Sélectionner un emoji, puis Envoyer. « Retirer » enlève l’emoji du catalogue sans effacer les stickers déjà envoyés.

## Effacement d’un compte

Le serveur demande une autorisation SQL temporaire, puis appelle la suppression définitive Supabase Auth. Un trigger nettoie les données de jeu dans la transaction de suppression Auth : un échec annule l’ensemble. Le ticket expire après cinq minutes, et le pseudo et les droits administrateur sont revérifiés.

Sont retirés : profil, historique, messages entrants et sortants, réactions, notifications et file push, inscriptions, scores et récompenses du compte, ainsi que ses missions coopératives et leurs badges. Les catégories partagées et emojis publiés restent disponibles sans leur auteur. Les soldes et XP des autres joueurs restent inchangés. Un journal administratif conserve l’identifiant technique de la suppression, sans pseudo ni email. Les sauvegardes et journaux du fournisseur suivent sa rétention habituelle.

La suppression depuis le tableau de bord Supabase d’un compte possédant un profil de jeu nécessite désormais la confirmation dans l’administration du jeu ; cela évite une suppression qui contournerait ce contrôle. Les comptes Auth sans profil ne sont pas concernés. Les anciens JWT ne permettent pas de recréer le profil supprimé.

## IA et limites

La génération compose un petit dessin à partir de formes, couleurs, expressions et accessoires autorisés. Elle ne crée pas un nouveau caractère Unicode. Aucun code SVG provenant de l’IA n’est exécuté. Seule l’ambiance prédéfinie est envoyée au fournisseur, sans données de joueurs. Les compositions de secours sont indiquées « sans IA ».

Dix essais d’emojis maximum par jour UTC, partagés entre administrateurs, avec dix secondes entre essais. Ce compteur est distinct de celui des défis IA ; les appels restent soumis au quota Cloudflare du compte. Les échecs comptent aussi. Cent emojis publiés maximum. Stickers et textes partagent les mêmes limites de messagerie et contrôles d’amitié.

## Vérification

Les tests SQL `admin_deletion.sql` et `emojis.sql` sont destinés à une base locale isolée et annulent leurs comptes fictifs en fin de transaction. Ne pas les exécuter en production. Le test SQL de suppression émule la phase base de données de Supabase Auth ; aucun compte réel n’a été supprimé et aucun appel IA payant n’a été nécessaire aux tests.
