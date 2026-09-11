# Alertes événementielles — réalisation approuvée par « go »

Périmètre : réveiller le worker à chaque nouvelle file éligible, enlever les regroupements horaires et distinguer les bannières. Préserver les choix de notification, les limites, le contenu générique et le cron de secours. Aucun push GitHub, déploiement, secret lu ou envoi réel par l’agent.

- [x] Régression service worker : tags distincts, réutilisation sur reprise ; test observé en échec avant correction.
- [x] Migration additive 012 : activité/duel par événement, premiers encouragements immédiats, réveil pg_net après commit et continuation réservée au serveur.
- [x] Tests SQL locaux avec faux HTTP : regroupement par transaction, activités distinctes, réactions immédiates et idempotentes, heures silencieuses, file vide, configuration invalide et panne sans perte de déclaration.
- [x] Guide joueur, réglages et instructions de déploiement mis à jour.
- [x] Tests Node, lint, TypeScript et build Webpack validés. Préférences et révocation push SQL vérifiées.

Limite explicite : les alertes de calendrier dépendent encore de la cadence du cron pour leur création ; l’OS contrôle la bannière. Aucun essai réel sur téléphone ni validation de la configuration Vault distante.
