# Supprimer des propositions de l’atelier IA

Après les mises à jour 001 à 017, exécuter une fois `supabase/update-ai-proposal-deletion.sql` dans l’éditeur SQL Supabase. Ce fichier est identique à la migration 018. Son installation ne supprime aucune proposition.

Dans Admin → Événements → Atelier de défis, chaque proposition possède une suppression avec recopie exacte du titre. Le bouton sous le lot demande de recopier son libellé complet « Lot thème · identifiant ». Les compétitions déjà créées restent indépendantes et sont conservées.

Le texte supprimé est effacé de la ligne du lot. Les trois emplacements restent fixes : pauses, marche, bonnes habitudes. L’historique et les reprises de requêtes ne renvoient aucun texte effacé. Un lot entièrement supprimé disparaît de l’atelier ; reprendre son identifiant renvoie une erreur 409 sans nouvel appel IA.

La réservation et sa date restent enregistrées : supprimer un lot ne libère pas une génération dans le quota quotidien. L’audit conserve uniquement l’identifiant du lot, l’action et éventuellement le numéro d’emplacement, jamais le texte supprimé.

Vérification locale transactionnelle : `supabase/tests/ai_proposal_deletion.sql` teste les droits administrateur, la confirmation exacte, les index, l’effacement, les reprises et le quota. `tests/ai-proposal-deletion.test.ts` vérifie le refus HTTP des lots supprimés sans appel fournisseur et les catégories restantes.
