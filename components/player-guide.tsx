"use client";
import { BookOpen, ChevronDown } from "lucide-react";
import { Sheet } from "./sheet";

const chapters = [
  {
    title: "Les défis coopératifs entre amis",
    paragraphs: [
      "Dans Survie, ouvre Défis coopératifs puis Créer. Choisis trois heures de sport, 200 minutes de marche ou dix pauses, et invite un à quatre amis acceptés. Le défi dure sept jours à partir de sa création. Chaque ami retrouve l’invitation sur son accueil et choisit de participer.",
      "En acceptant, tu contribues à un total visible par l’équipe, sans partager le détail de ton journal. Seules les bonnes actions à impact positif enregistrées après ton acceptation et avant la fin comptent. Sport : catégorie Activité sportive · 15 minutes ; marche : Prendre l’air ou Marche rapide de 30 minutes ; pauses : Une vraie pause. Maximum 60 minutes de sport ou de marche, ou une pause par personne et par jour de Paris.",
      "L’objectif atteint avec au moins deux contributeurs donne le badge Ensemble, on avance aux membres ayant contribué. Il ne rapporte pas de minutes ou d’XP. Le résultat réussi est figé. Tu peux quitter un défi actif, mais pas le rejoindre ensuite ; ta contribution est retirée. Les blocages et suspensions coupent les participations concernées. Un seul défi créé en cours par joueur.",
    ],
  },
  {
    title: "Le récapitulatif de tes consommations",
    paragraphs: [
      "Ton journal contient Mes consommations déclarées : choisis les sept ou trente derniers jours pour voir les quantités enregistrées par catégorie. Pour un compte connecté, le récapitulatif utilise tout l’historique de cette période, même au-delà des cent lignes affichées dans le journal.",
      "Bière et Cocktail au gin sont des catégories distinctes. Les anciens verres non précisés et vin ou bière restent séparés. Choisis une seule catégorie par consommation, sans double déclaration. Ce récapitulatif personnel ne comporte aucun objectif de consommation, badge ou rappel à boire.",
    ],
  },
  {
    title: "Choisir ses alertes et ses heures tranquilles",
    paragraphs: [
      "Dans Profil → Préférences et confidentialité → Mes notifications, règle séparément messages, amis, duels, encouragements, compétitions et rappels. Enregistre tes choix. Les rappels sont désactivés au départ ; si tu les actives, le jeu en prévoit au maximum un par jour pour les défis ou compétitions rejoints encore en cours.",
      "Active Horaires silencieux, choisis le début, la fin et ton fuseau horaire. La cloche continue de recevoir les informations, mais les alertes téléphone en attente sont différées jusqu’à un passage de l’envoi périodique après le silence. Les changements d’heure suivent le fuseau sélectionné. Les alertes lues ou expirées ne sont pas réenvoyées.",
      "L’autorisation du navigateur est toujours nécessaire pour le téléphone. Une alerte déjà remise au service du téléphone peut arriver après le début du silence. Les réglages de messages dans la messagerie et dans les préférences contrôlent la même option.",
    ],
  },
  {
    title: "Pourquoi ce jeu existe",
    paragraphs: [
      "Excès-O-Meter transforme les petits écarts et les bonnes habitudes du quotidien en un journal ludique à partager entre amis. L’idée : regarder ses habitudes avec humour, comparer des scores et participer à des défis, sans jugement.",
      "Les minutes de vie sont une unité fictive du jeu. Elles ne prédisent ni ta durée de vie ni ton état de santé. Une bonne habitude ne compense pas les effets réels d’un excès. Le classement raconte ce que tu déclares ; il ne constitue jamais un objectif de consommation ou une invitation à prendre des risques.",
      "Le jeu s’adresse aux adultes. Les points, XP, accessoires et badges n’ont aucune valeur monétaire. Tu peux jouer tranquillement, sans duel et sans partager ton journal.",
    ],
  },
  {
    title: "Commencer et retrouver sa partie",
    paragraphs: [
      "Le jeu fonctionne sur le Web : ouvre son adresse dans ton navigateur, sur ordinateur ou téléphone. Aucun téléchargement depuis un store n’est nécessaire.",
      "Pour découvrir les écrans, choisis « Explorer la démo sans compte ». Ses joueurs et résultats sont fictifs et enregistrés dans ce navigateur ; cette simulation est indépendante de ta vraie partie.",
      "Pour jouer avec tes amis, crée un compte par email, confirme ton adresse si demandé, puis suis les trois étapes de bienvenue : ton pseudonyme et ton avatar, les compteurs fictifs, puis la découverte de ta première mission. Ton profil est créé à la dernière confirmation ; aucune mission n’est choisie automatiquement. Reviens avec le même compte pour retrouver ta partie sur un autre appareil. Une connexion Internet est nécessaire pour enregistrer tes vraies déclarations.",
      "Tu disposes de cinq onglets : Survie pour ton tableau de bord, Ligue pour les classements, Némésis pour le duel, Amis pour ton cercle, et Profil pour ton journal, ton avatar et tes préférences.",
    ],
  },
  {
    title: "Comprendre les compteurs",
    paragraphs: [
      "Excès cumulés : toutes les minutes fictives perdues à cause de tes écarts depuis ton inscription. Le total est affiché comme une durée positive. Bonnes habitudes : toutes les minutes récupérées grâce aux actions positives, après application des plafonds.",
      "Bilan net = pertes − récupérations. Exemple : 120 minutes perdues et 45 récupérées donnent 75 minutes perdues au bilan. Avec 150 récupérées, le bilan indique au contraire 30 minutes récupérées au total.",
      "Le sélecteur « Afficher en » permet de choisir une durée détaillée, des minutes, des heures ou des années. Une année de jeu vaut 365 jours ; les conversions en heures et années peuvent être arrondies.",
      "Le capital du jeu est un autre compteur : 500 minutes au départ, plus les bonnes actions et les dons reçus, moins les écarts et les dons envoyés. Bonus, dons et XP ne modifient pas tes totaux de pertes et de récupération.",
      "Ton statut dépend du capital : Zombie à 0 ou moins, Funambule de 1 à 250, Survivant de 251 à 1 999, Divinité à partir de 2 000. Un capital négatif ne bloque pas la partie : tu peux toujours déclarer des actions.",
    ],
  },
  {
    title: "Déclarer un écart ou une bonne habitude",
    paragraphs: [
      "Appuie sur « Petit écart » ou « Bonne habitude », recherche une action, sélectionne-la et renseigne sa quantité. Lis bien l’unité : une portion, un verre, une nuit ou une séance ne représentent pas la même chose. Confirme, puis attends le message d’enregistrement.",
      "La valeur dépend du barème affiché et de la quantité. Par exemple, une portion de légumes rapporte 20 minutes fictives, avec un plafond de 60 par jour pour cette catégorie. Une fois un plafond atteint, une nouvelle déclaration peut rapporter moins, voire zéro.",
      "Déclare une seule catégorie pour une même consommation ou activité, même si plusieurs intitulés conviennent. Enregistre ce qui s’est réellement passé, sans inventer ni multiplier les déclarations pour gagner des places.",
      "Les déclarations sont datées au moment de leur enregistrement : il n’y a pas de saisie rétroactive. Les limites sont de 10 déclarations par minute et 100 par jour. Les plafonds quotidiens suivent l’heure de Paris.",
      "Si la connexion est interrompue, utilise le parcours de reprise proposé et vérifie ton journal avant de recommencer. Une déclaration confirmée est conservée ; le jeu ne propose pas de modification directe de son montant.",
    ],
  },
  {
    title: "Créer une action pour la communauté",
    paragraphs: [
      "Dans le panneau de déclaration, choisis « Créer une bonne action » ou « Créer un petit écart ». Donne un nom compréhensible, une unité précise, une valeur fictive et une quantité maximale. La catégorie devient utilisable par les autres joueurs.",
      "La valeur autorisée va de 1 à 120 minutes par unité et la quantité maximale de 1 à 10. Tu peux créer jusqu’à cinq catégories par jour. Le signe est déterminé par le type choisi : positif pour une bonne action, négatif pour un écart.",
      "Les bonnes actions communautaires sont plafonnées à 120 minutes par catégorie et 150 minutes au total par jour. Les catégories officielles ont leurs propres plafonds. Une catégorie publiée n’est pas directement modifiable : une autre valeur nécessite une nouvelle variante.",
      "Utilise les filtres « Toutes », « Officielles » et « Communauté » pour retrouver une action. Évite les doublons, les informations personnelles et les intitulés qui présentent un barème comme une vérité médicale. L’administration peut désactiver une catégorie inadaptée.",
    ],
  },
  {
    title: "La ligue et ses deux classements",
    paragraphs: [
      "Une saison dure du lundi à 00:00 au lundi suivant, heure de Paris. La ligue regroupe jusqu’à 30 joueurs. À chaque nouvelle saison, le score hebdomadaire repart de zéro ; ton capital, ton historique et tes compteurs cumulés restent conservés.",
      "« Excès cumulés » est le classement officiel : le plus grand total de minutes fictives perdues dans la semaine occupe la première place. Ce n’est pas le nombre de déclarations qui compte, mais leur valeur cumulée. Les bonnes habitudes ne diminuent pas ce score.",
      "« Bilan net » compare les pertes moins les récupérations de la semaine, du bilan le plus perdu au plus récupéré. C’est une autre lecture entre joueurs visibles ; elle ne décide pas des promotions ou relégations.",
      "Il existe cinq divisions. À la clôture, une part des premiers monte et une part des derniers descend, dans les limites des divisions : une place pour six membres, arrondie à l’entier inférieur. Par exemple, 30 membres donnent cinq montées et cinq descentes ; moins de six membres n’en donnent aucune.",
      "Les égalités du classement officiel sont départagées de façon stable par le jeu. Si certains joueurs sont masqués, les rangs officiels restent inchangés : des numéros peuvent manquer dans la liste.",
    ],
  },
  {
    title: "Némésis : le duel de la semaine",
    paragraphs: [
      "Le duel est facultatif et désactivé au départ. Pour participer, ouvre Profil → Préférences et confidentialité, puis active « Participer aux duels ». L’appariement se fait à la prochaine saison, selon les joueurs disponibles ; activer l’option ne crée pas immédiatement un adversaire.",
      "L’onglet Némésis affiche ton adversaire, vos scores et l’écart qui vous sépare. Le duel utilise les pertes brutes de la semaine, comme le classement officiel de ligue. Les récupérations et les dons ne changent pas ce score.",
      "Tu peux recevoir des notifications au début du duel, lors d’un changement de meneur et à son résultat. Leur réception se règle séparément de la participation aux duels.",
    ],
  },
  {
    title: "Les compétitions spéciales et leurs badges",
    paragraphs: [
      "Les compétitions sont des événements créés par l’administration et affichés dans Survie. Ouvre une fiche pour lire sa description, ses dates, le type de score et le badge associé. Chaque événement possède ses propres règles : il ne suit pas forcément celles de la ligue.",
      "Appuie sur « Rejoindre la compétition » avant son début. Tu peux la quitter tant que les inscriptions restent ouvertes. Dès le début, l’inscription est verrouillée. En participant, tu rends ton pseudonyme, ton avatar et ton score visibles dans ce classement.",
      "Trois types de scores existent : les minutes positives de toutes les bonnes actions ; les minutes positives d’une catégorie précise ; ou le « Solde net de minutes ». Pour ce dernier, le calcul est gains − pertes et le plus grand solde gagne. Attention : son sens est donc différent du bilan net de pertes affiché dans la ligue.",
      "Seules les déclarations enregistrées pendant la période de l’événement et correspondant à sa règle comptent. Les actions antérieures, les bonus, les dons et les XP ne rapportent aucun point à la compétition. Les plafonds habituels continuent de s’appliquer.",
      "Le classement affiche ta progression et celle des participants. Les ex æquo partagent le même rang. Après clôture, les résultats sont figés. Un participant ayant au moins une action éligible reçoit un badge permanent selon son résultat : gagnant, podium ou participation. S’inscrire sans action éligible ne suffit pas. Un événement annulé ne distribue pas de badge.",
    ],
  },
  {
    title: "Missions, XP et évolution de l’avatar",
    paragraphs: [
      "Dans Survie, choisis jusqu’à trois missions parmi cinq pour la semaine. Les objectifs proposent notamment des pauses sur trois jours différents, des bonnes habitudes sur trois jours, trois catégories saines, une nouvelle bonne habitude ou une bonne action éligible dans une compétition rejointe.",
      "Les choix sont définitifs pour la semaine. Les bonnes actions positives déjà déclarées depuis le lundi peuvent compter, même si tu choisis la mission ensuite. Une déclaration qui rapporte zéro minute ne fait pas progresser ces objectifs.",
      "Chaque mission accomplie rapporte 50 XP, jusqu’à 150 XP par semaine. Un niveau correspond à 100 XP. Les XP ne modifient ni tes minutes ni ton classement. Accomplir ton premier trio de missions débloque un badge permanent.",
      "Ouvre Profil → Personnaliser mon avatar pour découvrir les accessoires, titres et décors. Les conditions affichées indiquent les XP ou badges nécessaires. Essaie une apparence débloquée puis équipe-la. Tes éléments équipés et tes badges peuvent apparaître auprès de tes amis et dans les classements.",
    ],
  },
  {
    title: "Amis, historique partagé et encouragements",
    paragraphs: [
      "Dans Amis, envoie une invitation avec le pseudonyme exact de la personne. Elle doit l’accepter pour rejoindre ton cercle. Les amis de la démo sont uniquement des personnages fictifs.",
      "Pour montrer ton journal récent, active « Partager mes sept derniers jours » dans Profil → Préférences et confidentialité. Tes amis acceptés pourront voir les noms, quantités, dates et minutes de toutes tes déclarations des sept derniers jours glissants. Ce partage est désactivé au départ et peut être arrêté à tout moment.",
      "Pour consulter un ami, ouvre sa semaine depuis l’onglet Amis. L’historique reste inaccessible s’il ne le partage pas. Une amitié ne donne pas automatiquement accès à ses déclarations.",
      "Réagis à une déclaration partagée avec 👏, 💪 ou 😂. Tu disposes d’une seule réaction par déclaration : choisir un autre emoji la remplace ; recliquer le même la retire. Les réactions n’ajoutent ni minutes ni XP.",
      "Le réglage « Partager mes déclarations avec mes amis » concerne les alertes d’activité et est distinct du partage de l’historique. Tu peux choisir séparément ce que tes amis voient dans leur fil de notifications et dans ta semaine.",
    ],
  },
  {
    title: "Envoyer un message privé à un ami",
    paragraphs: [
      "Ouvre Amis → Mes messages, puis choisis une personne de ton cercle. Seuls les amis ayant accepté ton invitation peuvent échanger. Écris ton texte et appuie sur Envoyer ; attends sa confirmation. La conversation s’actualise toutes les dix secondes lorsque le jeu est visible.",
      "Les messages sont limités à 2 000 caractères, 20 envois par minute et 200 par jour (heure de Paris). Ils ne rapportent ni minutes ni XP. Cette version accepte uniquement le texte, sans pièces jointes. Les messages envoyés ne sont pas directement modifiables ou supprimables.",
      "Le nombre de non-lus apparaît dans Mes messages et auprès de chaque ami. Les anciens échanges se consultent avec Voir les messages précédents. Les messages récupérés dans une conversation active sont marqués comme lus ; ouvrir seulement la liste des conversations ne les marque pas comme lus.",
      "En cas d’envoi non confirmé, utilise Réessayer cet envoi. La même reprise reste disponible en rouvrant la conversation pendant cette session, tant que tu ne recharges pas la page et ne te déconnectes pas. Après une fermeture complète, vérifie l’historique avant de renvoyer un texte.",
      "Le réglage Notifications des messages, dans la messagerie, contrôle les alertes dans la cloche et leur envoi au téléphone. Pour le téléphone, l’autorisation du navigateur reste nécessaire. Seule une alerte générique est affichée hors du jeu, jamais le contenu du message.",
      "Un blocage, une suspension ou la fin de l’amitié coupe l’accès à la conversation dans le jeu. Les échanges restent conservés dans les données du compte et leur export. La messagerie ne propose pas de chiffrement de bout en bout : évite d’y envoyer des mots de passe ou des informations sensibles.",
    ],
  },
  {
    title: "Donner des minutes à un ami",
    paragraphs: [
      "Les dons permettent de transférer une partie de ton capital fictif à un ami ayant accepté ton invitation. Ton compte doit avoir au moins 24 heures. Tu peux donner de 1 à 100 minutes par don, dans une limite de 200 minutes par jour, en conservant au moins une minute de capital.",
      "Le don diminue ton capital et augmente celui de ton ami. Il ne change ni les compteurs de pertes et de récupération, ni les scores de ligue, de duel ou de compétition. Il ne s’agit jamais d’un transfert d’argent.",
    ],
  },
  {
    title: "Recevoir les notifications, même hors du jeu",
    paragraphs: [
      "La cloche affiche tes notifications dans l’application. Dans Profil → Préférences et confidentialité, tu peux régler « Activité de mes amis », « Événements de duel » et « Récapitulatif des encouragements ».",
      "Les alertes d’activité dépendent du partage choisi par tes amis et sont limitées à une alerte par ami et par heure. Les encouragements sont regroupés dans un récapitulatif horaire : chaque réaction ne déclenche pas une notification immédiate. Pour ces récapitulatifs, active aussi « Activité de mes amis ».",
      "Pour recevoir une alerte lorsque l’onglet du jeu est fermé, active les notifications du navigateur depuis les préférences et accepte sa demande d’autorisation. Cette autorisation est propre à l’appareil et au navigateur utilisés.",
      "La réception dépend des capacités du navigateur, des réglages du système et de la connexion. Un navigateur totalement arrêté ou un appareil en mode silencieux peut retarder ou empêcher les alertes. Certaines plateformes demandent l’installation du site en raccourci pour activer cette fonction ; suis le message affiché dans le jeu.",
      "Si rien n’arrive, vérifie les réglages du jeu, l’autorisation du site dans le navigateur, les notifications du système et le mode Ne pas déranger. Tu peux toujours consulter la cloche en revenant dans l’application.",
    ],
  },
  {
    title: "Confidentialité, connexion et confort",
    paragraphs: [
      "Profil → Mon journal affiche tes 100 dernières déclarations. Les compteurs cumulés portent sur tout l’historique. « Exporter mes données » permet de télécharger tes données, dont l’historique complet des déclarations.",
      "Dans les préférences, « Moins d’animations » rend l’interface plus calme et « Humour atténué » affiche des messages plus sobres. Tu peux également bloquer un pseudonyme : cela retire l’amitié et le duel en cours et coupe les interactions futures. Une notification déjà reçue sur un appareil ne peut pas être rappelée.",
      "Si la fonction est disponible, Profil → Mes clés d’accès permet d’ajouter une clé avec ton gestionnaire habituel, par exemple Apple Mots de passe. Suis les indications du navigateur. Lors d’une prochaine connexion, utilise « Se connecter avec une clé d’accès ». L’email et le mot de passe restent une solution de connexion ; « Mot de passe oublié ? » permet d’en demander la récupération.",
      "Une clé d’accès dépend du site et d’un appareil ou gestionnaire compatible. Si l’option n’est pas disponible, utilise la connexion habituelle. Les fonctions liées à un vrai compte, comme les invitations, les dons ou les clés d’accès, ne sont pas actives dans la démo.",
    ],
  },
];

export function PlayerGuide({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Guide du joueur" onClose={onClose}>
      <div className="player-guide">
        <div className="player-guide-intro">
          <BookOpen size={28} aria-hidden="true" />
          <h3>La Faucheuse attendra. Le mode d’emploi, lui, est ici.</h3>
          <p>
            Du premier petit écart au badge de compétition : ouvre la rubrique
            qui t’intéresse.
          </p>
        </div>
        <aside className="player-guide-start" aria-label="Démarrage rapide">
          <h3>Ta première partie en quatre étapes</h3>
          <ol>
            <li>Crée ton compte et choisis ton avatar.</li>
            <li>
              Déclare une action déjà réalisée, puis consulte tes compteurs.
            </li>
            <li>Choisis tes missions de la semaine dans Survie.</li>
            <li>Invite tes amis et découvre les prochaines compétitions.</li>
          </ol>
        </aside>
        {chapters.map((chapter, index) => (
          <details key={chapter.title} className="player-guide-chapter">
            <summary>
              <span className="player-guide-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{chapter.title}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div className="player-guide-body">
              {chapter.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        ))}
        <p className="fine-print">
          Guide de la version actuelle. Les disponibilités et les règles propres
          à chaque compétition sont précisées dans le jeu. On joue avec les
          minutes, pas avec la santé.
        </p>
      </div>
    </Sheet>
  );
}
