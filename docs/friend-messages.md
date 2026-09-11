# Accueil guidé et messages entre amis

La base reste dans votre projet Supabase SaaS et Vercel héberge l’application. Les messages connectés sont persistés dans Supabase ; seuls les échanges du mode démo sont simulés en mémoire.

## Installation sur une base existante

1. Vérifier que les migrations 001 à 008 sont déjà installées. Ne pas relancer `install.sql`.
2. Dans un projet Supabase de test, exécuter une fois `supabase/update-friend-messages.sql` dans SQL Editor, puis `supabase/tests/friend_messages.sql`. Ce dernier crée des fixtures et termine par `ROLLBACK`, sans envoyer de notification réseau.
3. Après validation, ouvrir le SQL Editor du projet de production et exécuter **une seule fois** `supabase/update-friend-messages.sql`. C’est la migration 009, transactionnelle : elle ajoute la messagerie sans réinstaller la base. Ne pas exécuter à la fois le bundle et le fichier de migration. Une réexécution échoue sans supprimer de données.
4. Pousser les changements sur la branche GitHub reliée à Vercel. Le build ne lance aucune migration SQL.

Aucune nouvelle variable d’environnement, aucune nouvelle clé et aucun nouveau Cron. Les notifications de messages rejoignent la file Web Push existante ; l’envoi périodique déjà configuré doit continuer à fonctionner. La table privée ne doit pas être ajoutée à une publication Realtime. Les conversations s’actualisent toutes les dix secondes lorsque le jeu est visible.

## Parcours joueur

Un nouveau profil passe par trois étapes : pseudonyme et avatar, explication des compteurs fictifs, découverte d’une première mission. Le profil est enregistré à la fin. Les joueurs existants accèdent directement au jeu et retrouvent les explications dans Profil → Guide du joueur. Aucune mission n’est choisie automatiquement.

Dans Amis → Mes messages, choisir un ami dont l’invitation a été acceptée. Les messages sont du texte brut, limités à 2 000 caractères, 20 envois par minute et 200 par jour (heure de Paris). Ils ne rapportent ni minutes ni XP. Le bouton des anciens messages charge l’historique par pages de trente. Les compteurs de non-lus portent sur les messages entrants ; seules les pages consultées dans une fenêtre active sont marquées lues.

En cas d’erreur d’envoi, réessayer le même message conserve sa clé de reprise et évite un doublon. Cette reprise est gardée en mémoire lors de la fermeture/réouverture du panneau, jusqu’à la déconnexion ou au rechargement de la page. Après rechargement, consulter l’historique avant de renvoyer.

Le réglage « Notifications des messages » contrôle la cloche et les alertes téléphone de ces échanges. La permission du navigateur et l’abonnement Web Push restent nécessaires pour le téléphone. L’alerte est générique : elle ne contient pas le texte privé. Un message déjà lu n’est plus éligible à un nouvel envoi ; une alerte déjà livrée au système ne peut pas être retirée par cette lecture.

## Accès et conservation

Les RPC vérifient la session, l’amitié acceptée, les blocages et les suspensions côté serveur. Les clients ne peuvent pas lire ou écrire directement la table privée. Le rôle administrateur du jeu ne donne pas de fonction de lecture des conversations d’autrui.

Un blocage ou la fin de l’amitié coupe l’accès dans le jeu et empêche les nouveaux échanges. Les messages restent conservés et figurent dans l’export personnel des deux participants, y compris après blocage. Les gestionnaires de la base disposent de leurs accès techniques habituels. Il ne s’agit pas d’un service chiffré de bout en bout. Pas de pièces jointes, de groupes, de suppression ou de modification des messages dans cette version.

## Recette SaaS après installation

- Deux comptes de test acceptent leur amitié. A envoie un message à B ; B voit le non-lu, ouvre la conversation, puis répond. Vérifier la persistance après reconnexion.
- Un troisième compte et une invitation en attente ne doivent pas pouvoir accéder à cette conversation.
- Désactiver les notifications de messages chez B : les messages restent accessibles, mais aucune nouvelle alerte de message n’est créée. Réactiver ne rejoue pas les anciennes alertes.
- Avec un abonnement Web Push autorisé chez B, fermer le jeu, envoyer un message depuis A et attendre le prochain envoi périodique. Vérifier une alerte générique ouvrant Amis. Faire ce test avec des comptes et appareils dédiés.
- Bloquer A : les échanges deviennent indisponibles et les notifications encore en attente ne doivent plus être envoyées.

Validation locale : migrations 001–009 appliquées dans PostgreSQL 18 isolé avec un schéma Auth minimal de test ; assertions SQL de messagerie réussies et fixtures annulées. Cette vérification ne remplace pas la recette Supabase Auth/PostgREST et la réception Web Push sur appareil réel.

## Onglet Messages (migration 013)

La messagerie possède une page dans le menu du bas, avec le compteur de non-lus actualisé toutes les dix secondes lorsque le jeu est visible. Ouvrir la liste ne marque pas les messages comme lus ; les contrôles et brouillons de conversation sont conservés. Les boutons de déclaration sont masqués sur cette page pour laisser la place aux échanges.

Déployer le code puis exécuter une seule fois `supabase/update-message-destination.sql` après 012. Cette migration dirige les notifications push de messages vers Messages, sans modifier les messages ni les notifications enregistrées. Sans elle, la page fonctionne mais les push continuent d’ouvrir Amis. Aucune nouvelle variable serveur.

## Aperçus, liens directs et réactions (014)

Après le déploiement Vercel, exécuter une fois `supabase/update-messaging-improvements.sql` dans SQL Editor, après 013. Ne pas réexécuter les anciennes migrations. Aucune variable ou clé supplémentaire.

- La liste montre les 120 premiers caractères du dernier message et sa date. Les derniers échanges passent en tête ; aucun message n’est marqué lu depuis cette liste. Les aperçus sont limités aux amitiés encore autorisées.
- Les notifications dans le jeu et les nouveaux push ouvrent directement l’interlocuteur. Le push contient uniquement le lien avec un UUID d’interlocuteur, aucun nom ni extrait. La conversation exige toujours une session et les contrôles d’accès serveur ; le lien n’accorde aucun accès. Les push reçus avant cette mise à jour gardent leur ancien lien.
- Chaque participant peut réagir à un message par 👏, 💪, 😂 ou ❤️. Une réaction par participant, remplaçable ou retirable. Les mutations sont plafonnées à 20/minute et 200/jour ; une reprise identique ne consomme pas de quota. Aucune notification supplémentaire pour les réactions ; elles s’actualisent avec la conversation. Les données de réaction sont incluses dans les messages exportés.
- Rouvrir le jeu après déploiement pour mettre à jour le service worker, puis tester avec un nouveau message depuis un ami.

Tests : 86 tests Node, SQL local pour les aperçus, ordre, remplacement/retrait, quotas, refus des tiers et anciens amis ; lien push contrôlé après autorisation. Démo navigateur : message simulé, cœur ajouté, retour liste et aperçu en première position ; largeur 375 px sans débordement. Aucun message réel envoyé ni migration distante appliquée par l’agent.
