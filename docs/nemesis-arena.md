# Mettre en ligne l’arène Némésis

## Installation

1. Appliquer toutes les migrations précédentes jusqu’à 020 (Éclats et boutique).
2. Dans Supabase → SQL Editor, exécuter une seule fois `supabase/update-nemesis-arena.sql` (migration 021). Ne pas exécuter aussi le fichier identique du dossier migrations.
3. Pousser le code sur GitHub et laisser Vercel déployer.

Aucune nouvelle variable, clé ou tâche périodique n’est nécessaire. L’arène utilise les abonnements Web Push, la file d’envoi immédiat et le traitement périodique déjà configurés pour le jeu.

## Parcours des joueurs

Dans Némésis, inviter un ami ayant accepté l’amitié. L’invité accepte puis joue en premier. Chaque joueur dispose de 24 heures pour son action. La notification ouvre directement le combat concerné, où un bref résumé montre la dernière action. L’énergie se recharge avec l’attaque rapide ou la protection. La spéciale dépend du personnage choisi au début du duel ; l’apparence et les minutes de vie ne modifient pas les statistiques du combat.

La rivalité hebdomadaire précédente reste disponible dans un panneau secondaire. La nouvelle arène n’exige pas d’attendre une saison.

Les victoires éligibles rapportent 10 Éclats, jusqu’à 30 par jour (Europe/Paris). Il faut au moins trois actions de chaque joueur. Pas de récompense pour un abandon, un délai dépassé, une annulation ou une égalité. Les achats de skins restent cosmétiques.

## Vérification après déploiement

Avec deux comptes amis : envoyer une invitation, accepter depuis le second compte, jouer une attaque puis ouvrir la notification sur le premier téléphone. Vérifier que le duel s’ouvre, que l’action apparaît et que seul le joueur attendu peut agir. Vérifier ensuite l’alternance, l’historique et la revanche. Dans les préférences, Duels doit être activé et l’heure actuelle hors des horaires silencieux pour recevoir immédiatement la bannière téléphone.

Les notifications déjà arrivées sur un appareil ne peuvent pas être retirées. À l’ouverture, Supabase vérifie de nouveau l’accès au combat. La validation locale n’envoie aucune notification réelle ; un test sur deux appareils reste nécessaire après déploiement pour vérifier leur livraison par Apple/Google/Mozilla.
