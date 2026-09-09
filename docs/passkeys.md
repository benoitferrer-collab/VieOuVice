# Connexion avec une clé d’accès

Le jeu utilise les passkeys natives de Supabase Auth et du navigateur. Sur un appareil Apple compatible, le joueur peut conserver sa clé dans Mots de passe et confirmer avec Face ID, Touch ID ou son code. Les autres gestionnaires et clés de sécurité compatibles sont également acceptés. Le jeu ne reçoit aucune donnée biométrique.

## Ce que le joueur voit
1. Se connecter une première fois avec son email et son mot de passe, puis ouvrir **Profil → Mes clés d’accès**.
2. Cliquer **Ajouter une clé d’accès** et suivre la fenêtre du navigateur. Le joueur choisit où conserver sa clé ; le jeu ne force pas Apple.
3. Lors des prochaines connexions, cliquer **Se connecter avec une clé d’accès**. Le gestionnaire propose le compte : aucun email à saisir dans ce parcours.
4. Le même écran de profil liste les clés enregistrées et permet d’en retirer une après confirmation. Le retrait côté jeu ne supprime pas automatiquement la copie dans le gestionnaire.

Le mot de passe et sa récupération par email restent disponibles. La démo explique la fonction sans créer de vraie clé. Il faut un compte existant confirmé ; la création initiale du compte reste par email.

## Configuration de viegame sur Supabase
Dans le projet Supabase utilisé par le jeu : **Authentication → Passkeys**. Activer **Enable Passkey authentication**, puis renseigner :

| Champ | Valeur |
| --- | --- |
| Relying Party Display Name | `VieGame` |
| Relying Party ID | `viegame.vercel.app` |
| Relying Party Origins | `https://viegame.vercel.app` |

Enregistrer. Ne pas mettre `https://`, de slash ou de port dans le RP ID. L’origine, elle, comprend `https://`.

**Aucune migration SQL, aucune nouvelle variable Vercel et aucune nouvelle clé API.** L’activation côté client est incluse dans cette mise à jour et utilise les versions déjà installées. Pousser ensuite les fichiers de l’application sur la branche GitHub reliée à Vercel, puis attendre le déploiement.

Les clés sont liées au RP ID : le conserver stable. Si un domaine personnalisé est prévu prochainement, le choisir avant d’inscrire les premières clés ; changer de RP ID obligera les joueurs à en créer de nouvelles. Les domaines de preview Vercel et localhost ne sont pas couverts par `viegame.vercel.app`. Tester l’enrôlement sur l’origine configurée, ou sur un projet Supabase de test avec son propre RP ID et son origine exacte.

## Recette réelle à faire après activation
Avec ton propre compte confirmé, sur Safari ou un navigateur compatible : créer une clé, vérifier qu’elle apparaît dans le profil, se déconnecter puis revenir avec cette clé. Vérifier que la partie et le profil sont les mêmes. Tester également l’annulation de la fenêtre native puis la connexion habituelle par mot de passe.

Créer éventuellement une seconde clé avant de tester un retrait. Une clé retirée doit être refusée, tandis que l’autre clé et le mot de passe fonctionnent encore. La gestion nécessite une session authentifiée ; le serveur Supabase vérifie l’appartenance des clés et les signatures WebAuthn.

## État et limites
Supabase classe actuellement cette API comme **expérimentale**. Le jeu l’active explicitement et conserve les versions exactes de ses dépendances. En cas d’option non activée, d’appareil incompatible, de mauvaise origine ou d’annulation, un message français propose la connexion habituelle.

Les tests locaux couvrent la validation du résultat de connexion, les erreurs, l’annulation et l’identité du propriétaire. Ils ne remplacent pas la cérémonie cryptographique réelle. La création de clé, la connexion biométrique et le retrait sur Supabase restent à vérifier manuellement après activation ; aucun credential Apple n’a été créé ou utilisé par l’agent. Aucun réglage Supabase n’a été modifié et aucun code n’a été poussé automatiquement. Les demandes natives actives sont annulées en cas de changement de session ; le SDK peut toutefois terminer une vérification réseau déjà engagée. Aucune garantie d’atomicité entre connexions simultanées de plusieurs onglets n’est revendiquée.

Référence officielle : [Passkey authentication — Supabase](https://supabase.com/docs/guides/auth/passkeys). API disponible dans la version installée `@supabase/supabase-js@2.116.0`.
