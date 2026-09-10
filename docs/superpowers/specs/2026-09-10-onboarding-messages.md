# Accueil guidé et messages privés

Demande utilisateur : parcours avatar/compteurs/première mission et messages aux amis. Implémentation locale, aucun Git, push ou changement distant permanent.

## Parcours
Remplacer le formulaire initial par trois étapes : identité/avatar et déclaration adulte existante, explication des compteurs fictifs avec exemple, découverte des missions. Créer le profil uniquement à la confirmation finale. Retour possible sans perte de saisie ; aucun choix de mission automatique irréversible. La dernière étape indique où choisir sa première mission. Les profils existants gardent leur expérience.

## Messagerie
Texte brut uniquement, 1–2000 caractères, entre amis acceptés non bloqués et non suspendus. Historique privé des deux participants, consultable seulement tant que l’amitié est valide. Pas de pièces jointes, HTML, groupes, édition ou suppression dans cette version. 20 envois/minute et 200/jour Paris ; retries idempotents. Notification générique dans la cloche et Web Push, préférence messages distincte. Lire la conversation marque seulement les messages récupérés et les notifications correspondantes comme lus. Pagination stable par identifiant séquentiel décroissant, 30/page. Poll visible 10s, pas de Realtime table publique. Les notifications existantes rafraîchissent le jeu. Pas d’envoi automatique par l’agent.

Contrat RPC : get_message_inbox() -> {enabled:boolean, conversations:[{friend_id,unread_count,last_message_at}], unread_count:number}; set_message_notifications(p_enabled bool); get_friend_messages(p_friend uuid,p_before bigint default null) -> {messages:[{id:string,sender_id,recipient_id,body,created_at,read_at}],has_more:boolean}; send_friend_message(p_friend uuid,p_body text,p_key uuid) -> message; read_friend_messages(p_friend uuid,p_ids bigint[]). IDs JSON en chaînes. La liste des amis fournit les pseudos. send retourne l’existant pour retry identique, rejette le payload différent. get_message_inbox retourne tous amis acceptés ou seulement conversations, le frontend supporte les deux. Absence RPC avant migration : écran indisponible sans bloquer le jeu.

Sécurité : assert_user + verrou applicatif, RLS table privée, RPC invoker publiques et definer privées search_path vide, pas de lecture via API table. Vérification autorisations à lecture/envoi/push ; pas d’aperçu du texte dans notifications. Aucune promesse de chiffrement bout en bout.
