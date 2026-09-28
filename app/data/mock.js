/* ==========================================================================
   Vimas Quest — données simulées
   Chaque clé correspond à une future route d'API (GET /api/<clé>).
   Les pages n'accèdent JAMAIS directement à MOCK : elles passent par
   App.data.get('<clé>') (voir assets/js/app.js).
   ========================================================================== */
window.MOCK = {
  festival: {
    nom: "DOMAF",
    jeu: "Vimas Quest",
    edition: 15,
    slogan: "Le DOMAF se joue",
    lieu: "Stade Annexe de Bonamoussadi",
    dates: "26 au 29 novembre 2026",
    ouverture: "2026-11-26T14:00:00+01:00",
    contactPartenaires: null   // adresse réelle à fournir (étape 7)
  },

  jours: [
    { id: "jeu", court: "Jeu. 26", long: "Jeudi 26 novembre",    date: "2026-11-26" },
    { id: "ven", court: "Ven. 27", long: "Vendredi 27 novembre", date: "2026-11-27" },
    { id: "sam", court: "Sam. 28", long: "Samedi 28 novembre",   date: "2026-11-28" },
    { id: "dim", court: "Dim. 29", long: "Dimanche 29 novembre", date: "2026-11-29" }
  ],

  scenes: [
    { id: "soleil",    nom: "Scène Soleil",   couleur: "sodium" },
    { id: "clairiere", nom: "La Clairière",   couleur: "vert" },
    { id: "dock",      nom: "Le Dock",        couleur: "rose" },
    { id: "kiosque",   nom: "Le Kiosque",     couleur: "bleu" },
    { id: "chapiteau", nom: "Chapiteau Nuit", couleur: "nuit" }
  ],

  /* duree en minutes ; bio courte pour la fiche artiste.
     photo : serigraphie deux encres fabriquee par outils/photos.py (3 a 4 Ko).
     Seuls 3 artistes sur 12 en ont une : c'est l'etat normal avant le festival,
     et ca permet de voir aussi la pochette de secours (App.photo).
     Les images demo-artiste-*.webp sont SYNTHETIQUES, pas des photos reelles.
     En base : artistes.photo_url. */
  artistes: [
    { id: "a1",  nom: "Nova Kassa",        genre: "Afro-pop",   scene: "soleil",    jour: "ven", debut: "22:30", duree: 90, tete: true,
      photo: "assets/photos/demo-artiste-1.webp",
      bio: "Voix solaire et refrains qui restent en tête : Nova Kassa ouvre le festival avec son deuxième album, porté par une section de cuivres." },
    { id: "a2",  nom: "Les Lampadaires",   genre: "Rock",       scene: "dock",      jour: "ven", debut: "20:15", duree: 60,
      bio: "Quatre amis, deux guitares et beaucoup de volume. Le groupe fête ses 20 ans de scène." },
    { id: "a3",  nom: "Mboa Brass Band",   genre: "Fanfare",    scene: "kiosque",   jour: "ven", debut: "18:00", duree: 60,
      bio: "Onze musiciens qui déambulent, jouent sans partition et finissent toujours au milieu du public." },
    { id: "a4",  nom: "Pixel Griot",       genre: "Électro",    scene: "chapiteau", jour: "ven", debut: "00:30", duree: 90,
      bio: "Des machines faites maison et des samples de griots : un set pour danser jusqu'à la fermeture." },
    { id: "a5",  nom: "Ilé Sound System",  genre: "Dub",        scene: "clairiere", jour: "sam", debut: "19:00", duree: 60,
      bio: "Un mur d'enceintes, des basses profondes et un MC qui fait chanter toute La Clairière." },
    { id: "a6",  nom: "Dune Électrique",   genre: "Psyché",     scene: "dock",      jour: "sam", debut: "21:00", duree: 60,
      bio: "Rock psychédélique aux longues montées hypnotiques, projections comprises." },
    { id: "a7",  nom: "Ama Rise",          genre: "Soul",       scene: "soleil",    jour: "sam", debut: "23:00", duree: 90, tete: true,
      photo: "assets/photos/demo-artiste-2.webp",
      bio: "La révélation soul de l'année, chantée en trois langues, accompagnée d'un chœur de huit voix." },
    { id: "a8",  nom: "Sœur Vinyle",       genre: "DJ set",     scene: "chapiteau", jour: "sam", debut: "01:00", duree: 90,
      bio: "Uniquement des vinyles, des pépites des années 70 aux sorties de la semaine." },
    { id: "a9",  nom: "Tanka",             genre: "Rap",        scene: "soleil",    jour: "dim", debut: "21:45", duree: 90, tete: true,
      photo: "assets/photos/demo-artiste-3.webp",
      bio: "Le rappeur clôture le festival avec un show pensé pour le DOMAF et quelques invités surprises." },
    { id: "a10", nom: "Orchestre Minuit",  genre: "Jazz",       scene: "kiosque",   jour: "dim", debut: "18:30", duree: 60,
      bio: "Big band de jazz qui improvise sur des standards africains et caribéens." },
    { id: "a11", nom: "Kalé & les Ondes",  genre: "Makossa nouvelle vague", scene: "clairiere", jour: "dim", debut: "20:00", duree: 60,
      bio: "La makossa revisitée avec une kora, des synthés et beaucoup d'énergie." },
    { id: "a12", nom: "Bleu Cobalt",       genre: "Indie",      scene: "dock",      jour: "dim", debut: "19:15", duree: 60,
      bio: "Pop indé mélancolique et lumineuse, premier concert du groupe en Afrique centrale." }
  ],

  /* Séances de dédicaces (programme, fiches artistes, mission m4) */
  dedicaces: [
    { artiste: "a7", jour: "sam", debut: "19:30", fin: "20:15", lieu: "Tente dédicaces, esplanade est", lieuId: "dedicaces" },
    { artiste: "a1", jour: "ven", debut: "20:00", fin: "20:45", lieu: "Tente dédicaces, esplanade est", lieuId: "dedicaces" },
    { artiste: "a9", jour: "dim", debut: "19:00", fin: "19:45", lieu: "Tente dédicaces, esplanade est", lieuId: "dedicaces" }
  ],

  programmeConfig: { ouverture: "17:00", fermeture: "02:30", pixelsParMinute: 2 },

  /* Temps de marche : calculé depuis les positions des lieux (App.minutesMarche). */
  rappelsParDefaut: { actif: true, avance: 15 },

  /* ---------- Infos pratiques (page 17) ---------- */
  infos: {
    adresse: "Stade Annexe de Bonamoussadi, entrée principale côté boulevard",
    horaires: [
      { jour: "jeu", portes: "14:00", fin: "00:00" },
      { jour: "ven", portes: "16:00", fin: "03:00" },
      { jour: "sam", portes: "15:00", fin: "03:00" },
      { jour: "dim", portes: "15:00", fin: "00:00" }
    ],
    acces: [
      { icone: "billet", titre: "Navettes gratuites", texte: "Départ toutes les 20 minutes depuis la gare routière centrale, de 15h à 3h30. Montre ton billet au chauffeur." },
      { icone: "lieu", titre: "Taxis et motos-taxis", texte: "Zone de dépose et de reprise balisée devant l'entrée principale. Ne traverse pas le boulevard hors des passages." },
      { icone: "plan", titre: "Parking", texte: "Parking gardé à 400 m, fléché depuis le rond-point. Places limitées : privilégie les navettes." },
      { icone: "eclair", titre: "Vélos et trottinettes", texte: "Stationnement gratuit et surveillé près de l'entrée nord." }
    ],
    accessibilite: [
      "Plateformes surélevées devant la Scène Soleil, La Clairière, Le Dock et Le Kiosque",
      "Toilettes adaptées dans chaque bloc sanitaire",
      "Prêt de fauteuils et de sièges-cannes au Point info",
      "Boucle magnétique à la Scène Soleil, gilets vibrants sur réservation",
      "Accompagnateur gratuit sur présentation de la carte d'invalidité"
    ],
    interdits: [
      "Bouteilles en verre et canettes", "Objets tranchants ou contondants", "Feux d'artifice, fumigènes, pointeurs laser",
      "Drones", "Parapluies à pointe (les modèles pliants sont acceptés)", "Animaux, sauf chiens d'assistance",
      "Alcool apporté de l'extérieur", "Enceintes portables"
    ],
    refuge: "Point Refuge",
    contact: {
      email: "bonjour@domafquest.example",
      delai: "Réponse par e-mail sous 48 h"
    },
    faq: [
      { id: "code-perdu", q: "J'ai perdu mon code secret, comment récupérer ma partie ?", r: "Passe au stand Vimas Quest avec ton pseudo : l'équipe retrouve ton code. Tant que tu joues sur le même téléphone, tu n'as besoin de rien." },
      { id: "qr-illisible", q: "Un QR du site ne se scanne pas.", r: "Essaie avec la lampe du scanner, puis utilise « Saisir un code » : chaque QR a un code court imprimé en dessous (par exemple SOL-4821)." },
      { id: "rescanner", q: "Puis-je scanner le même QR plusieurs fois ?", r: "Chaque QR rapporte des XP une fois par jour. Le lendemain, il redevient actif." },
      { id: "reseau", q: "Le réseau ne passe pas, je perds mes points ?", r: "Non. Tes réponses au blind test sont renvoyées automatiquement, et le Wi-Fi gratuit Telco+ est disponible près des scènes." },
      { id: "batterie", q: "Mon téléphone n'a plus de batterie.", r: "Des bornes de recharge gratuites sont à la Consigne (16h à 3h) et au Salon Telco+. Ta partie est sauvegardée : rien n'est perdu." },
      { id: "lots", q: "Jusqu'à quand puis-je retirer mes lots ?", r: "Jusqu'au dimanche 23h au Stand Vimas Quest, avec ton bon de retrait et ton billet. Les lots non retirés ne sont pas envoyés par la poste." },
      { id: "mineurs", q: "Les mineurs peuvent-ils jouer ?", r: "Oui, à partir de 12 ans, accompagnés d'un adulte sur le site. Les lots avec de l'alcool ne sont jamais remis aux mineurs." },
      { id: "sortie", q: "Puis-je sortir et revenir ?", r: "Oui, ton bracelet permet de sortir et de revenir autant de fois que tu veux jusqu'à 1h du matin." },
      { id: "pseudo", q: "Mon pseudo est-il visible par tout le monde ?", r: "Oui, dans les classements et sur l'écran géant. Il ne contient jamais ton nom : choisis un pseudo qui ne permet pas de t'identifier." },
      { id: "donnees", q: "Comment supprimer mes données de jeu ?", r: "Passe au Stand Vimas Quest avec ton code secret : l'équipe efface ta partie (points, badges, collection, votes). Pour simplement quitter ta partie sur ce téléphone, utilise « Déconnecter ce téléphone » en bas de cette page." }
    ]
  },

  /* ---------- Collecte (étape 6.3 bis) ----------
     Fiche fan : les VALEURS doivent rester celles de profil_options() en base
     (supabase/sources/92_collecte.sql). ordreFixe : jamais mélangé ; bas : reste
     en bas quand l'ordre est mélangé. Le téléphone n'est proposé qu'aux tranches
     « majeures » (19-24 et au-delà). */
  fiche: {
    xpParReponse: 20,
    bonusComplet: 50,
    champs: [
      { id: "tranche_age", titre: "Tu as quel âge ?", ordreFixe: true, options: [
        { valeur: "13-15", libelle: "13 - 15 ans" }, { valeur: "16-18", libelle: "16 - 18 ans" },
        { valeur: "19-24", libelle: "19 - 24 ans" }, { valeur: "25-30", libelle: "25 - 30 ans" },
        { valeur: "31-40", libelle: "31 - 40 ans" }, { valeur: "41+", libelle: "41 ans et plus" }] },
      { id: "sexe", titre: "Tu es…", options: [
        { valeur: "garcon", libelle: "Un homme" }, { valeur: "fille", libelle: "Une femme" }] },
      { id: "quartier", titre: "Tu habites où ?", ordreFixe: true, options: [
        { valeur: "ndokotti", libelle: "Ndokotti" }, { valeur: "bassa", libelle: "Bassa" },
        { valeur: "logbaba", libelle: "Logbaba" }, { valeur: "village-ndogpassi", libelle: "Village / Ndogpassi" },
        { valeur: "pk-8-14", libelle: "PK 8 à PK 14" }, { valeur: "pk-15-plus", libelle: "PK 15 et au-delà" },
        { valeur: "nyalla", libelle: "Nyalla" }, { valeur: "yassa-japoma", libelle: "Yassa / Japoma" },
        { valeur: "bepanda", libelle: "Bépanda" }, { valeur: "makepe", libelle: "Makepè" },
        { valeur: "bonamoussadi", libelle: "Bonamoussadi" }, { valeur: "kotto-palmiers", libelle: "Kotto / Cité des Palmiers" },
        { valeur: "akwa", libelle: "Akwa" }, { valeur: "deido", libelle: "Deïdo" },
        { valeur: "new-bell", libelle: "New Bell" }, { valeur: "bali", libelle: "Bali" },
        { valeur: "bonanjo", libelle: "Bonanjo" }, { valeur: "bonapriso", libelle: "Bonapriso" },
        { valeur: "bonaberi", libelle: "Bonabéri" }, { valeur: "bonendale-sodiko", libelle: "Bonendale / Sodiko" },
        { valeur: "autre-douala", libelle: "Un autre quartier de Douala" }, { valeur: "autre-ville", libelle: "Une autre ville" }] },
      { id: "genre_prefere", titre: "Ta musique, c'est surtout…", options: [
        { valeur: "afrobeats", libelle: "Afrobeats / Afro-pop" }, { valeur: "makossa", libelle: "Makossa" },
        { valeur: "bikutsi", libelle: "Bikutsi" }, { valeur: "coupe-decale", libelle: "Coupé-décalé" },
        { valeur: "rap", libelle: "Rap / Hip-hop" }, { valeur: "rnb-soul", libelle: "R&B / Soul" },
        { valeur: "gospel", libelle: "Gospel" }, { valeur: "reggae", libelle: "Reggae / Dancehall" },
        { valeur: "rumba", libelle: "Rumba / Ndombolo" }, { valeur: "jazz", libelle: "Jazz" },
        { valeur: "electro", libelle: "Électro" }, { valeur: "zouk", libelle: "Zouk / Kompa" },
        { valeur: "autre", libelle: "Un autre", bas: true }] },
      { id: "situation", titre: "Dans la vie, tu es…", options: [
        { valeur: "eleve", libelle: "Élève" }, { valeur: "etudiant", libelle: "Étudiant" },
        { valeur: "salarie", libelle: "Salarié" }, { valeur: "independant", libelle: "À mon compte / commerçant" },
        { valeur: "recherche", libelle: "En recherche d'emploi" }, { valeur: "autre", libelle: "Autre", bas: true }] },
      { id: "concerts_an", titre: "Tu vas à combien de concerts par an ?", ordreFixe: true, options: [
        { valeur: "aucun", libelle: "Aucun, c'est mon premier" }, { valeur: "1-2", libelle: "1 ou 2" },
        { valeur: "3-5", libelle: "3 à 5" }, { valeur: "plus-5", libelle: "Plus de 5" }] }
    ],
    majeurs: ["19-24", "25-30", "31-40", "41+"],
    tourOffert: 30          /* jetons du numéro (= un tour de roue) : réglé en base (contact_config) */
  },

  /* Coffre du scan : l'XP d'un scan attend la réponse à une question.
     Démo seulement : en mode serveur, la question vient de scan_qr. */
  coffreConfig: { xpParReponse: 10, soirDebut: "20:00" },

  /* Banque du coffre : copie de supabase/01_reference.sql (micro_questions),
     fabriquée par le même script (supabase/outils/banque_questions.py). Garder les deux identiques. */
  banqueQuestions: [
    {"id": 1, "code": "S1", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu es venu comment aujourd'hui ?", "options": [{"valeur": "a-pied", "libelle": "À pied"}, {"valeur": "moto-taxi", "libelle": "Moto-taxi"}, {"valeur": "taxi", "libelle": "Taxi"}, {"valeur": "voiture-personnelle", "libelle": "Voiture personnelle"}, {"valeur": "bus", "libelle": "Bus"}]},
    {"id": 2, "code": "S2", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu as connu le DOMAF comment ?", "options": [{"valeur": "un-ami-m-en-a-parle", "libelle": "Un ami m'en a parlé"}, {"valeur": "facebook-ou-instagram", "libelle": "Facebook ou Instagram"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "radio-ou-tele", "libelle": "Radio ou télé"}, {"valeur": "une-affiche", "libelle": "Une affiche"}, {"valeur": "autrement", "libelle": "Autrement", "bas": true}]},
    {"id": 3, "code": "S3", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "C'est ton combientième DOMAF ?", "options": [{"valeur": "mon-tout-premier", "libelle": "Mon tout premier"}, {"valeur": "le-2e-ou-le-3e", "libelle": "Le 2e ou le 3e"}, {"valeur": "je-viens-presque-chaque-", "libelle": "Je viens presque chaque année"}]},
    {"id": 4, "code": "S4", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu es venu avec qui ?", "options": [{"valeur": "seul", "libelle": "Seul"}, {"valeur": "avec-des-amis", "libelle": "Avec des amis"}, {"valeur": "en-couple", "libelle": "En couple"}, {"valeur": "en-famille", "libelle": "En famille"}, {"valeur": "avec-des-collegues", "libelle": "Avec des collègues"}]},
    {"id": 5, "code": "S6", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu écoutes ta musique surtout où ?", "options": [{"valeur": "sur-une-appli-de-streami", "libelle": "Sur une appli de streaming"}, {"valeur": "sur-youtube", "libelle": "Sur YouTube"}, {"valeur": "sur-tiktok", "libelle": "Sur TikTok"}, {"valeur": "a-la-radio", "libelle": "À la radio"}, {"valeur": "en-concert-surtout", "libelle": "En concert, surtout"}]},
    {"id": 6, "code": "S7", "theme": "ecoute", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Ton appli de musique principale ?", "options": [{"valeur": "boomplay", "libelle": "Boomplay"}, {"valeur": "audiomack", "libelle": "Audiomack"}, {"valeur": "spotify", "libelle": "Spotify"}, {"valeur": "youtube-music", "libelle": "YouTube Music"}, {"valeur": "apple-music", "libelle": "Apple Music"}, {"valeur": "deezer", "libelle": "Deezer"}, {"valeur": "aucune", "libelle": "Aucune", "bas": true}]},
    {"id": 7, "code": "S8", "theme": "ecoute", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu paies un abonnement musique ?", "options": [{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non-la-version-gratuite-", "libelle": "Non, la version gratuite me suffit"}, {"valeur": "non-je-n-utilise-pas-d-a", "libelle": "Non, je n'utilise pas d'appli"}]},
    {"id": 8, "code": "S9", "theme": "ecoute", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu écoutes de la musique combien de temps par jour ?", "options": [{"valeur": "moins-d-1-h", "libelle": "Moins d'1 h"}, {"valeur": "1-a-3-h", "libelle": "1 à 3 h"}, {"valeur": "3-a-5-h", "libelle": "3 à 5 h"}, {"valeur": "plus-de-5-h", "libelle": "Plus de 5 h"}]},
    {"id": 9, "code": "S10", "theme": "ecoute", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu écoutes surtout…", "options": [{"valeur": "des-artistes-camerounais", "libelle": "Des artistes camerounais"}, {"valeur": "des-artistes-africains", "libelle": "Des artistes africains"}, {"valeur": "des-artistes-internation", "libelle": "Des artistes internationaux"}, {"valeur": "un-peu-de-tout", "libelle": "Un peu de tout", "bas": true}]},
    {"id": 10, "code": "S11", "theme": "ecoute", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "La radio, tu l'écoutes ?", "options": [{"valeur": "tous-les-jours", "libelle": "Tous les jours"}, {"valeur": "de-temps-en-temps", "libelle": "De temps en temps"}, {"valeur": "jamais", "libelle": "Jamais"}]},
    {"id": 11, "code": "S12", "theme": "ecoute", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu écoutes la musique sur quoi ?", "options": [{"valeur": "le-telephone", "libelle": "Le téléphone"}, {"valeur": "des-ecouteurs-bluetooth", "libelle": "Des écouteurs Bluetooth"}, {"valeur": "une-enceinte", "libelle": "Une enceinte"}, {"valeur": "la-tele", "libelle": "La télé"}, {"valeur": "en-voiture", "libelle": "En voiture"}]},
    {"id": 12, "code": "S13", "theme": "gouts", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Ton 2e genre préféré ?", "options": [{"valeur": "afrobeats-afro-pop", "libelle": "Afrobeats / Afro-pop"}, {"valeur": "makossa", "libelle": "Makossa"}, {"valeur": "bikutsi", "libelle": "Bikutsi"}, {"valeur": "coupe-decale", "libelle": "Coupé-décalé"}, {"valeur": "rap-hip-hop", "libelle": "Rap / Hip-hop"}, {"valeur": "r-b-soul", "libelle": "R&B / Soul"}, {"valeur": "gospel", "libelle": "Gospel"}, {"valeur": "reggae-dancehall", "libelle": "Reggae / Dancehall"}, {"valeur": "rumba-ndombolo", "libelle": "Rumba / Ndombolo"}, {"valeur": "jazz", "libelle": "Jazz"}, {"valeur": "electro", "libelle": "Électro"}, {"valeur": "zouk-kompa", "libelle": "Zouk / Kompa"}, {"valeur": "un-autre", "libelle": "Un autre", "bas": true}]},
    {"id": 13, "code": "S14", "theme": "gouts", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu découvres les nouveaux artistes surtout par…", "options": [{"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "instagram", "libelle": "Instagram"}, {"valeur": "youtube", "libelle": "YouTube"}, {"valeur": "la-radio", "libelle": "La radio"}, {"valeur": "les-amis", "libelle": "Les amis"}, {"valeur": "les-concerts", "libelle": "Les concerts"}]},
    {"id": 14, "code": "S15", "theme": "gouts", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu as déjà acheté un morceau ou un album ?", "options": [{"valeur": "oui-en-ligne", "libelle": "Oui, en ligne"}, {"valeur": "oui-un-cd", "libelle": "Oui, un CD"}, {"valeur": "jamais", "libelle": "Jamais"}]},
    {"id": 15, "code": "S16", "theme": "gouts", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu suis des artistes sur les réseaux ?", "options": [{"valeur": "oui-beaucoup", "libelle": "Oui, beaucoup"}, {"valeur": "quelques-uns", "libelle": "Quelques-uns"}, {"valeur": "non", "libelle": "Non"}]},
    {"id": 16, "code": "S17", "theme": "gouts", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu préfères…", "options": [{"valeur": "les-grandes-stars", "libelle": "Les grandes stars"}, {"valeur": "les-nouveaux-talents", "libelle": "Les nouveaux talents"}, {"valeur": "les-deux", "libelle": "Les deux"}]},
    {"id": 17, "code": "S18", "theme": "gouts", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu fais toi-même de la musique ou de la danse ?", "options": [{"valeur": "oui-c-est-mon-metier", "libelle": "Oui, c'est mon métier"}, {"valeur": "oui-pour-le-plaisir", "libelle": "Oui, pour le plaisir"}, {"valeur": "non", "libelle": "Non"}]},
    {"id": 18, "code": "S19", "theme": "sorties", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu sors (maquis, boîte, concert) combien de fois par mois ?", "options": [{"valeur": "jamais", "libelle": "Jamais"}, {"valeur": "1-a-2-fois", "libelle": "1 à 2 fois"}, {"valeur": "3-a-5-fois", "libelle": "3 à 5 fois"}, {"valeur": "plus-de-5-fois", "libelle": "Plus de 5 fois"}]},
    {"id": 19, "code": "S20", "theme": "sorties", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Ton budget sorties par mois ?", "options": [{"valeur": "moins-de-10-000-fcfa", "libelle": "Moins de 10 000 FCFA"}, {"valeur": "10-000-a-25-000-fcfa", "libelle": "10 000 à 25 000 FCFA"}, {"valeur": "25-000-a-50-000-fcfa", "libelle": "25 000 à 50 000 FCFA"}, {"valeur": "plus-de-50-000-fcfa", "libelle": "Plus de 50 000 FCFA"}]},
    {"id": 20, "code": "S21", "theme": "sorties", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tes billets de concert, tu les achètes…", "options": [{"valeur": "en-ligne", "libelle": "En ligne"}, {"valeur": "sur-place", "libelle": "Sur place"}, {"valeur": "chez-un-revendeur", "libelle": "Chez un revendeur"}, {"valeur": "on-me-les-offre", "libelle": "On me les offre"}]},
    {"id": 21, "code": "S22", "theme": "sorties", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu paies surtout avec…", "options": [{"valeur": "mtn-mobile-money", "libelle": "MTN Mobile Money"}, {"valeur": "orange-money", "libelle": "Orange Money"}, {"valeur": "especes", "libelle": "Espèces"}, {"valeur": "carte-bancaire", "libelle": "Carte bancaire"}]},
    {"id": 22, "code": "S23", "theme": "sorties", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Un concert à 5 000 FCFA, c'est…", "options": [{"valeur": "pas-cher", "libelle": "Pas cher"}, {"valeur": "correct", "libelle": "Correct"}, {"valeur": "trop-cher", "libelle": "Trop cher"}]},
    {"id": 23, "code": "S24", "theme": "partenaires", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Ton opérateur mobile principal ?", "options": [{"valeur": "mtn", "libelle": "MTN"}, {"valeur": "orange", "libelle": "Orange"}, {"valeur": "camtel-blue", "libelle": "Camtel / Blue"}, {"valeur": "nexttel", "libelle": "Nexttel"}]},
    {"id": 24, "code": "S25", "theme": "partenaires", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Ton forfait internet, tu l'achètes…", "options": [{"valeur": "chaque-jour", "libelle": "Chaque jour"}, {"valeur": "chaque-semaine", "libelle": "Chaque semaine"}, {"valeur": "chaque-mois", "libelle": "Chaque mois"}]},
    {"id": 25, "code": "S26", "theme": "partenaires", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Ton téléphone, c'est…", "options": [{"valeur": "un-android", "libelle": "Un Android"}, {"valeur": "un-iphone", "libelle": "Un iPhone"}, {"valeur": "un-telephone-simple", "libelle": "Un téléphone simple"}]},
    {"id": 26, "code": "S27", "theme": "partenaires", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Le réseau social que tu ouvres le plus ?", "options": [{"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "facebook", "libelle": "Facebook"}, {"valeur": "instagram", "libelle": "Instagram"}, {"valeur": "snapchat", "libelle": "Snapchat"}, {"valeur": "x", "libelle": "X"}]},
    {"id": 27, "code": "S28", "theme": "partenaires", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Au festival, tu bois plutôt…", "options": [{"valeur": "de-la-biere", "libelle": "De la bière"}, {"valeur": "du-soda", "libelle": "Du soda"}, {"valeur": "du-jus", "libelle": "Du jus"}, {"valeur": "de-l-eau", "libelle": "De l'eau"}, {"valeur": "un-energisant", "libelle": "Un énergisant"}, {"valeur": "rien", "libelle": "Rien", "bas": true}]},
    {"id": 28, "code": "S30", "theme": "partenaires", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu manges quoi au festival ?", "options": [{"valeur": "grillades-soya", "libelle": "Grillades / soya"}, {"valeur": "plats-locaux", "libelle": "Plats locaux"}, {"valeur": "fast-food", "libelle": "Fast-food"}, {"valeur": "rien-je-mange-avant", "libelle": "Rien, je mange avant", "bas": true}]},
    {"id": 29, "code": "S31", "theme": "profil", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu vis à Douala depuis…", "options": [{"valeur": "toujours", "libelle": "Toujours"}, {"valeur": "plus-de-5-ans", "libelle": "Plus de 5 ans"}, {"valeur": "moins-de-5-ans", "libelle": "Moins de 5 ans"}, {"valeur": "je-n-y-vis-pas", "libelle": "Je n'y vis pas"}]},
    {"id": 30, "code": "S32", "theme": "profil", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "À la maison, tu parles surtout…", "options": [{"valeur": "francais", "libelle": "Français"}, {"valeur": "anglais", "libelle": "Anglais"}, {"valeur": "pidgin", "libelle": "Pidgin"}, {"valeur": "une-langue-locale", "libelle": "Une langue locale"}]},
    {"id": 31, "code": "S33", "theme": "profil", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu as des enfants ?", "options": [{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non", "libelle": "Non"}]},
    {"id": 32, "code": "N1", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "Ta journée, tu la notes comment ?", "options": [{"valeur": "decevante", "libelle": "Décevante"}, {"valeur": "moyenne", "libelle": "Moyenne"}, {"valeur": "bien", "libelle": "Bien"}, {"valeur": "tres-bien", "libelle": "Très bien"}, {"valeur": "inoubliable", "libelle": "Inoubliable"}]},
    {"id": 33, "code": "N2", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "artiste", "question": "Ton concert préféré aujourd'hui ?"},
    {"id": 34, "code": "N3", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": false, "type": "choix", "question": "Ce qui t'a le plus plu aujourd'hui ?", "options": [{"valeur": "la-musique", "libelle": "La musique"}, {"valeur": "l-ambiance", "libelle": "L'ambiance"}, {"valeur": "le-jeu-domaf-quest", "libelle": "Le jeu Vimas Quest"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "l-organisation", "libelle": "L'organisation"}, {"valeur": "les-rencontres", "libelle": "Les rencontres"}]},
    {"id": 35, "code": "N4", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "L'attente à l'entrée ?", "options": [{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]},
    {"id": 36, "code": "N5", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "L'attente au bar ?", "options": [{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]},
    {"id": 37, "code": "N6", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "L'attente aux food-trucks ?", "options": [{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]},
    {"id": 38, "code": "N7", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "Les toilettes ?", "options": [{"valeur": "propres-et-rapides", "libelle": "Propres et rapides"}, {"valeur": "correctes", "libelle": "Correctes"}, {"valeur": "a-revoir", "libelle": "À revoir"}]},
    {"id": 39, "code": "N8", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "Combien as-tu dépensé aujourd'hui, sans le billet ?", "options": [{"valeur": "rien-du-tout", "libelle": "Rien du tout"}, {"valeur": "moins-de-2-000-fcfa", "libelle": "Moins de 2 000 FCFA"}, {"valeur": "2-000-a-5-000-fcfa", "libelle": "2 000 à 5 000 FCFA"}, {"valeur": "5-000-a-10-000-fcfa", "libelle": "5 000 à 10 000 FCFA"}, {"valeur": "plus-de-10-000-fcfa", "libelle": "Plus de 10 000 FCFA"}]},
    {"id": 40, "code": "N9", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": false, "type": "choix", "question": "Ce qu'on doit améliorer en priorité ?", "options": [{"valeur": "plus-de-stands", "libelle": "Plus de stands"}, {"valeur": "moins-d-attente", "libelle": "Moins d'attente"}, {"valeur": "plus-d-activites", "libelle": "Plus d'activités"}, {"valeur": "plus-de-place", "libelle": "Plus de place"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "rien-c-etait-bien", "libelle": "Rien, c'était bien", "bas": true}]},
    {"id": 41, "code": "N10", "theme": "soir", "moment": "soir", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Conseillerais-tu Vimas Quest à un ami ? (0 = pas du tout, 10 = carrément)", "options": [{"valeur": "0", "libelle": "0"}, {"valeur": "1", "libelle": "1"}, {"valeur": "2", "libelle": "2"}, {"valeur": "3", "libelle": "3"}, {"valeur": "4", "libelle": "4"}, {"valeur": "5", "libelle": "5"}, {"valeur": "6", "libelle": "6"}, {"valeur": "7", "libelle": "7"}, {"valeur": "8", "libelle": "8"}, {"valeur": "9", "libelle": "9"}, {"valeur": "10", "libelle": "10"}]},
    {"id": 42, "code": "N11", "theme": "soir", "moment": "soir", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu reviendras au DOMAF l'an prochain ?", "options": [{"valeur": "oui-sur", "libelle": "Oui, sûr"}, {"valeur": "peut-etre", "libelle": "Peut-être"}, {"valeur": "non", "libelle": "Non"}]}
  ],


  /* ---------- Plan (page 7) ----------
     Coordonnées dans le dessin (1000 × 700, nord en haut). 1 unité = 0,40 m. */
  planConfig: {
    metresParUnite: 0.4,     // = App.planFond.metresParUnite (outils/plan/fond_plan.py)
    metresParMinute: 60,     // marche dans la foule
    telephoneSecurite: "0800000000",   // FICTIF : à remplacer par le numéro réel de la sécurité du festival
    libelleTelephone: "Sécurité du festival (numéro de démo)",
    // Emprise du plan (Stade de Bonamoussadi), pour placer le joueur grâce au GPS
    // = App.planFond.geo : si le fond est régénéré, recopier ici
    geo: { nord: 4.095845, sud: 4.093315, ouest: 9.7378, est: 9.7414 }
  },
  categoriesLieux: {
    scene:     { nom: "Scènes",        icone: "micro",    couleur: "nuit" },
    stand:     { nom: "Stands",        icone: "billet",   couleur: "sodium" },
    food:      { nom: "Food-trucks",   icone: "couverts", couleur: "vert" },
    eau:       { nom: "Points d'eau",  icone: "goutte",   couleur: "bleu" },
    toilettes: { nom: "Toilettes",     icone: "wc",       couleur: "nuit" },
    secours:   { nom: "Secours",       icone: "croix",    couleur: "rouge" },
    abri:      { nom: "Abris",         icone: "tente",    couleur: "papier" },
    service:   { nom: "Services",      icone: "info",     couleur: "papier" },
    entree:    { nom: "Entrées",       icone: "entree",   couleur: "papier" }
  },
  /* Lieux de DÉMO placés sur le vrai fond (Stade de Bonamoussadi, assets/js/plan-fond.js,
     1 unité = 0,40 m). Enceinte : x 341 → 662, y 120 → 576 ; terrain : x 405 → 601,
     y 220 → 494 ; tribune couverte à l'ouest (x 353 → 400). Les vrais emplacements
     viendront de l'organisation (table lieux, colonnes x / y). */
  lieux: [
    { id: "soleil",          cat: "scene", nom: "Scène Soleil",   x: 503, y: 245, pmr: true, desc: "Grande scène au nord du terrain, face à la pelouse. Plateforme PMR à droite de la régie." },
    { id: "clairiere",       cat: "scene", nom: "La Clairière",   x: 525, y: 540, pmr: true, desc: "Scène en plein air au sud du terrain." },
    { id: "dock",            cat: "scene", nom: "Le Dock",        x: 632, y: 330, pmr: true, desc: "Scène sur l'esplanade est, le long des écoles." },
    { id: "kiosque",         cat: "scene", nom: "Le Kiosque",     x: 450, y: 395, pmr: true, desc: "Petite scène sur la pelouse, concerts acoustiques et fanfares." },
    { id: "chapiteau",       cat: "scene", nom: "Chapiteau Nuit", x: 385, y: 530, pmr: false, desc: "Chapiteau des sets de nuit, coin sud-ouest. Accès PMR par l'arrière, demande à un bénévole." },

    { id: "st-radio",        cat: "stand", nom: "Radio Écho",        x: 632, y: 200, desc: "Studio en direct et interviews d'artistes." },
    { id: "st-telco",        cat: "stand", nom: "Salon Telco+",      x: 632, y: 155, desc: "Wi-Fi du festival et bornes de recharge." },
    { id: "st-kora",         cat: "stand", nom: "Maison Kora",       x: 632, y: 420, desc: "Artisans luthiers, essais d'instruments." },
    { id: "st-brasserie",    cat: "stand", nom: "Brasserie du Port", x: 560, y: 425, desc: "Bar central, sur la pelouse." },
    { id: "st-fraicheur",    cat: "stand", nom: "Fraîcheur Lab",     x: 632, y: 265, desc: "Brumisateurs et gourdes à remplir." },
    { id: "st-quest",    cat: "stand", nom: "Stand Vimas Quest",   x: 615, y: 550, horaires: "16h à 23h", desc: "Accueil du jeu, retrait des lots, aide aux joueurs." },

    { id: "st-yassa",        cat: "food", nom: "Chez Yassa",       x: 372, y: 150, desc: "Village food, coin nord-ouest." },
    { id: "st-braise",       cat: "food", nom: "Le Braisé",        x: 418, y: 178, desc: "Village food." },
    { id: "st-sucre",        cat: "food", nom: "Sucre & Sel",      x: 372, y: 205, desc: "Village food, desserts." },
    { id: "st-plantain",     cat: "food", nom: "Plantain Express", x: 462, y: 150, desc: "Village food." },

    { id: "eau-1", cat: "eau", nom: "Point d'eau Nord",    x: 560, y: 160, desc: "Eau potable gratuite, derrière la Scène Soleil." },
    { id: "eau-2", cat: "eau", nom: "Point d'eau Sud",     x: 575, y: 515, desc: "Eau potable gratuite." },
    { id: "eau-3", cat: "eau", nom: "Point d'eau Est",     x: 645, y: 475, desc: "Eau potable gratuite." },
    { id: "eau-4", cat: "eau", nom: "Point d'eau Village", x: 470, y: 205, desc: "Eau potable gratuite." },

    { id: "wc-1", cat: "toilettes", nom: "Toilettes Nord",    x: 600, y: 140, pmr: true },
    { id: "wc-2", cat: "toilettes", nom: "Toilettes Tribune", x: 376, y: 478, pmr: true },
    { id: "wc-3", cat: "toilettes", nom: "Toilettes Est",     x: 650, y: 378, pmr: true },
    { id: "wc-4", cat: "toilettes", nom: "Toilettes Sud",     x: 478, y: 562, pmr: true },

    { id: "secours-1", cat: "secours", nom: "Poste de secours principal", x: 565, y: 562, horaires: "Ouvert en continu", desc: "Médecins, infirmiers, point d'écoute. Signalé par un grand drapeau rouge." },
    { id: "secours-2", cat: "secours", nom: "Point secours Soleil",       x: 545, y: 205, horaires: "Pendant les concerts", desc: "Équipe de secouristes près de la grande scène." },

    { id: "abri-1", cat: "abri", nom: "Tribune nord", x: 377, y: 300, desc: "La tribune couverte sert d'abri en cas d'orage." },
    { id: "abri-2", cat: "abri", nom: "Tribune sud",  x: 377, y: 420, desc: "La tribune couverte sert d'abri en cas d'orage." },

    { id: "dedicaces",    cat: "service", nom: "Tente dédicaces",       x: 600, y: 470, desc: "Séances de dédicaces des artistes, voir le programme." },
    { id: "consigne",     cat: "service", nom: "Consigne et recharge",  x: 652, y: 520, horaires: "16h à 3h", desc: "Casiers et recharge de téléphone." },
    { id: "info",         cat: "service", nom: "Point info",            x: 430, y: 562, desc: "Objets trouvés, informations, accessibilité." },

    { id: "entree-principale", cat: "entree", nom: "Entrée principale", x: 655, y: 572, desc: "Contrôle des billets et bracelets." },
    { id: "entree-nord",       cat: "entree", nom: "Entrée nord",       x: 503, y: 124, desc: "Sortie de secours et accès livraisons." }
  ],


  etapes: [
    { titre: "Crée ta carte",         texte: "Un pseudo, une pochette, et tu reçois un code secret. Pas de mot de passe à retenir.", gain: "Carte créée" },
    { titre: "Chasse les QR du site",   texte: "Scènes, stands, food-trucks, dédicaces et quelques recoins bien cachés.",                  gain: "Des XP à chaque QR" },
    { titre: "Remplis tes missions",    texte: "Trois concerts sur trois scènes, un QR près de la grande scène, un vote pour ton stand préféré…", gain: "Jetons et badges" },
    { titre: "Fais tourner la roue",    texte: "Dépense tes jetons et retire ton lot au Stand Vimas Quest.",       gain: "Lots réels" }
  ],

  /* Seuils = ceux de la base (rank_for_level(level_for_xp(xp)) : niveaux 3, 6,
     10 et 14). Les visuels disaient 500 / 1 500 / 3 500 / 7 000 : alignés le
     18/09/2026, sinon la carte et l'écran géant donnaient deux rangs différents. */
  rangs: [
    { nom: "Spectateur",     xp: 0 },
    { nom: "Fan",            xp: 550 },
    { nom: "Groupie",        xp: 1750 },
    { nom: "Backstage",      xp: 4050 },
    { nom: "Tête d'affiche", xp: 7150 }
  ],

  lots: [
    { id: "lot-casquette", nom: "Casquette officielle",       rarete: "commun",     stock: 300, icone: "etoile" },
    { id: "lot-boisson",   nom: "Boisson offerte au bar",     rarete: "commun",     stock: 600, icone: "couverts" },
    { id: "lot-vinyle",    nom: "Vinyle dédicacé",            rarete: "rare",       stock: 40,  icone: "onde" },
    { id: "lot-fosse",     nom: "Place en fosse avant-scène", rarete: "epique",     stock: 12,  icone: "micro" },
    { id: "lot-pass",      nom: "Pass 4 jours 2027",          rarete: "legendaire", stock: 0,   icone: "billet" }
  ],

  blindTest: {
    horaire: "21:30", lieu: "Écran géant, Scène Soleil", questions: 15,
    lienJeu: "https://domafquest.example/blind",
    durees: { intro: 4, question: 20, revelation: 9, classement: 10, fin: 90 }, // secondes
    classementToutesLes: 5
  },

  /* Questions du blind test (page 30). Les extraits sont synthétisés en démo :
     motif = notes MIDI, onde = timbre, tempo = BPM. En production : fichiers audio sous licence.
     La bonne réponse ne doit jamais être envoyée aux téléphones avant la révélation. */
  blindQuestions: [
    { categorie: "Artiste",    question: "Qui joue ce morceau ?",                        choix: ["Nova Kassa", "Ama Rise", "Tanka", "Bleu Cobalt"],                          bonne: 0, reponse: "Nova Kassa, « Lumière du lac »",      anecdote: "Écrit en une nuit sur la rive du lac.",            motif: [64, 67, 69, 67, 64, 62, 60, 62], onde: "triangle", tempo: 112 },
    { categorie: "Instrument", question: "Quel instrument ouvre ce morceau ?",           choix: ["Balafon", "Kora", "Saxophone", "Guitare électrique"],                     bonne: 1, reponse: "Kalé & les Ondes, « Rive gauche »",   anecdote: "La kora compte ici 21 cordes.",                     motif: [69, 72, 76, 72, 69, 67, 69, 64], onde: "sine",     tempo: 96 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                   choix: ["Makossa", "Dub", "Jazz", "Rock"],                                         bonne: 1, reponse: "Ilé Sound System, « Basse fréquence »", anecdote: "Enregistré avec un seul micro.",                  motif: [45, 45, 52, 45, 48, 45, 43, 45], onde: "square",   tempo: 74 },
    { categorie: "Année",      question: "En quelle année est sorti ce titre ?",        choix: ["2009", "2014", "2019", "2023"],                                           bonne: 2, reponse: "Orchestre Minuit, « Minuit pile »",   anecdote: "Leur premier disque, pressé à 300 exemplaires.",   motif: [62, 65, 69, 72, 71, 67, 64, 62], onde: "sine",     tempo: 88 },
    { categorie: "Artiste",    question: "Quel groupe de l'affiche joue ici ?",         choix: ["Les Lampadaires", "Dune Électrique", "Mboa Brass Band", "Pixel Griot"],   bonne: 2, reponse: "Mboa Brass Band, « Grand défilé »",   anecdote: "Onze musiciens, zéro partition.",                   motif: [60, 64, 67, 72, 67, 64, 65, 67], onde: "sawtooth", tempo: 126 },
    { categorie: "Instrument", question: "Quel instrument tient la mélodie ?",          choix: ["Trompette", "Violon", "Flûte", "Synthétiseur"],                           bonne: 3, reponse: "Pixel Griot, « Code source »",        anecdote: "Le synthé a été construit par l'artiste.",          motif: [72, 74, 76, 79, 76, 74, 72, 67], onde: "square",   tempo: 128 },
    { categorie: "Scène",      question: "Sur quelle scène joue ce groupe ce soir ?",   choix: ["Le Dock", "La Clairière", "Le Kiosque", "Chapiteau Nuit"],                bonne: 0, reponse: "Dune Électrique, « Mirage »",         anecdote: "Ils ouvrent le Dock à 21h.",                        motif: [57, 60, 64, 63, 60, 57, 55, 57], onde: "sawtooth", tempo: 100 },
    { categorie: "Tempo",      question: "Ce morceau est plutôt…",                      choix: ["Très lent", "Modéré", "Rapide", "Très rapide"],                           bonne: 2, reponse: "Tanka, « Pas de côté »",              anecdote: "140 battements par minute.",                        motif: [67, 67, 70, 67, 65, 63, 65, 67], onde: "triangle", tempo: 140 },
    { categorie: "Artiste",    question: "Qui joue ce morceau ?",                        choix: ["Sœur Vinyle", "Bleu Cobalt", "Ama Rise", "Nova Kassa"],                   bonne: 1, reponse: "Bleu Cobalt, « Néon »",               anecdote: "Premier concert du groupe en Afrique centrale.",   motif: [64, 68, 71, 76, 75, 71, 68, 64], onde: "triangle", tempo: 118 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                   choix: ["Soul", "Rock", "Fanfare", "Électro"],                                     bonne: 0, reponse: "Ama Rise, « Encore une fois »",       anecdote: "Chanté en trois langues.",                          motif: [60, 63, 67, 70, 68, 67, 63, 60], onde: "sine",     tempo: 80 },
    { categorie: "Instrument", question: "Quelle percussion entend-on ?",               choix: ["Batterie", "Cajón", "Djembé", "Tambour d'eau"],                           bonne: 2, reponse: "Kalé & les Ondes, « Pluie »",         anecdote: "Le djembé vient d'un atelier de Bafoussam.",        motif: [48, 48, 55, 48, 51, 48, 46, 48], onde: "square",   tempo: 104 },
    { categorie: "Année",      question: "En quelle année est sorti ce titre ?",        choix: ["1998", "2004", "2011", "2021"],                                           bonne: 1, reponse: "Les Lampadaires, « Rue des Palmiers »", anecdote: "Réédité pour les 20 ans du groupe.",               motif: [62, 66, 69, 74, 73, 69, 66, 62], onde: "sawtooth", tempo: 122 },
    { categorie: "Artiste",    question: "Quel groupe de l'affiche joue ici ?",         choix: ["Tanka", "Les Lampadaires", "Pixel Griot", "Kalé & les Ondes"],            bonne: 1, reponse: "Les Lampadaires, « Coupure de courant »", anecdote: "Joué pour la première fois à Vimas Quest 2023.",  motif: [59, 62, 66, 71, 69, 66, 64, 62], onde: "sawtooth", tempo: 132 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                   choix: ["Psyché", "Dub", "Afro-pop", "Jazz"],                                      bonne: 3, reponse: "Orchestre Minuit, « Swing du port »", anecdote: "Improvisé à 80 % sur scène.",                      motif: [65, 69, 72, 75, 74, 72, 69, 65], onde: "sine",     tempo: 116 },
    { categorie: "Finale",     question: "Qui clôture le festival dimanche ?",          choix: ["Tanka", "Nova Kassa", "Orchestre Minuit", "Ama Rise"],                    bonne: 0, reponse: "Tanka, « Dernier tour »",             anecdote: "Rendez-vous dimanche à 21h45, Scène Soleil.",      motif: [67, 71, 74, 79, 78, 74, 71, 67], onde: "triangle", tempo: 124 }
  ],

  quizDemo: {
    question: "Quel instrument ouvre ce morceau\u00A0?",
    choix: ["Balafon", "Kora", "Saxophone", "Guitare électrique"],
    bonne: 1
  },

  /* Partenaires du festival : section de l'accueil masquée tant que la liste est vide
     (décision du 18/09 : les noms de démo étaient inventés). { nom, role } */
  partenaires: [],

  bandeau: [
    "Blind test chaque soir à 21h30",
    "Des QR codes cachés sur tout le site",
    "Classement en direct sur l'écran géant",
    "Votes ouverts pour ton stand préféré",
    "Lots à retirer au stand Vimas Quest"
  ],

  /* ---------- Inscription (page 2) ---------- */
  /* Futur : POST /api/billets/verifier — le serveur ne renverra jamais la liste complète */
  /* ---------- Inscription (page 2) ----------
     Il n'y a PAS de billet du festival dans le jeu : le joueur crée sa carte
     avec un pseudo et reçoit un code secret. Les tickets ci-dessous sont les
     tickets papier de la billetterie vendeur, et ils ne servent que si le GM
     a activé la billetterie (billetterieDemo.actif). */
  billetterieDemo: { actif: false, prix: 500, message: "Ticket en vente auprès de l'équipe en gilet jaune." },

  tickets: [
    { code: "DQ-7K4P-2QX9", etat: "libre" },
    { code: "DQ-M3D8-VA51", etat: "libre" },
    { code: "DQ-DEMO-2026", etat: "utilise" },
    { code: "DQ-BLOC-0000", etat: "annule" }
  ],

  /* Le code secret suit le tirage de la base : un mot de musique + 5 chiffres */
  joueurs: [
    { id: "j1", pseudo: "BasseProfonde", avatar: "ondes", code: "KORA-40912", xp: 1240, jetons: 18, rang: "Fan" }
  ],

  pseudosPris: ["basseprofonde", "nova", "dj", "groupie", "domafquest", "domaf", "admin", "staff"],

  motsPseudo: {
    debut: ["Basse", "Echo", "Riff", "Kora", "Tempo", "Larsen", "Vinyle", "Sono", "Groove", "Balafon"],
    fin: ["Nomade", "Solaire", "Rebelle", "Minuit", "Fauve", "Cosmique", "Tonique", "Libre", "Sauvage", "Lunaire"]
  },

  /* Styles musicaux : les VALEURS doivent rester celles de profil_options() en base
     (fonction SQL profil_options → genre_prefere). Le libellé, lui, est libre. */
  genres: [
    { valeur: "afrobeats",    libelle: "Afrobeats" },
    { valeur: "makossa",      libelle: "Makossa" },
    { valeur: "bikutsi",      libelle: "Bikutsi" },
    { valeur: "coupe-decale", libelle: "Coupé-décalé" },
    { valeur: "rap",          libelle: "Rap / Hip-hop" },
    { valeur: "rnb-soul",     libelle: "R&B / Soul" },
    { valeur: "gospel",       libelle: "Gospel" },
    { valeur: "reggae",       libelle: "Reggae / Dancehall" },
    { valeur: "rumba",        libelle: "Rumba / Ndombolo" },
    { valeur: "jazz",         libelle: "Jazz" },
    { valeur: "electro",      libelle: "Électro" },
    { valeur: "zouk",         libelle: "Zouk / Kompa" },
    { valeur: "autre",        libelle: "Un autre" }
  ],

  /* Avatars = pochettes de disque générées en CSS (aucune image) */
  avatars: [
    { id: "soleil",  nom: "Soleil",  motif: "soleil",  fond: "sodium", encre: "nuit" },
    { id: "ondes",   nom: "Ondes",   motif: "ondes",   fond: "bleu",   encre: "sodium" },
    { id: "vinyle",  nom: "Vinyle",  motif: "vinyle",  fond: "rose",   encre: "nuit" },
    { id: "rayures", nom: "Rayures", motif: "rayures", fond: "papier", encre: "bleu" },
    { id: "damier",  nom: "Damier",  motif: "damier",  fond: "vert",   encre: "nuit" },
    { id: "demi",    nom: "Éclipse", motif: "demi",    fond: "nuit",   encre: "rose" },
    { id: "points",  nom: "Points",  motif: "points",  fond: "sodium", encre: "bleu" },
    { id: "grille",  nom: "Grille",  motif: "grille",  fond: "nuit",   encre: "vert" }
  ],

  /* ---------- Tableau de bord (page 3) ---------- */
  /* action : ce que le joueur doit faire (scanner | staff | blind-test | votes)
     categorie : exploration | musique | gourmand | social | defi
     rangMin : rang requis ; finHeure + jour : mission éclair limitée dans le temps */
  missions: [
    { id: "m1",  titre: "Tournée des scènes",    categorie: "musique",     action: "scanner",    objectif: 3,  xp: 150, jetons: 3,
      texte: "Assiste à 3 concerts sur 3 scènes différentes et scanne le QR de chaque scène." },
    { id: "m2",  titre: "La relique",            categorie: "exploration", action: "scanner",    objectif: 1,  xp: 200, jetons: 5, lieu: "soleil",
      texte: "Une relique est cachée près de la Scène Soleil. À toi de la trouver." },
    { id: "m3",  titre: "Gourmet du festival",   categorie: "gourmand",    action: "scanner",    objectif: 4,  xp: 80,  jetons: 2,
      texte: "Scanne le QR de 4 food-trucks différents." },
    { id: "m4",  titre: "Chasseur de dédicaces", categorie: "musique",     action: "staff",      objectif: 1,  xp: 250, jetons: 5, lieu: "kiosque",
      texte: "Passe à la séance de dédicaces et fais valider ta mission par l'équipe sur place." },
    { id: "m5",  titre: "Première note",         categorie: "exploration", action: "scanner",    objectif: 1,  xp: 30,  jetons: 1, lieu: "soleil",
      texte: "Scanne le QR de la Scène Soleil." },
    { id: "m6",  titre: "Défi éclair : le Dock", categorie: "defi",        action: "scanner",    objectif: 1,  xp: 120, jetons: 4, lieu: "dock",
      texte: "Scanne le QR du Dock avant 21h.", jour: "sam", finHeure: "21:00" },
    { id: "m7",  titre: "Oreille absolue",       categorie: "musique",     action: "blind-test", objectif: 10, xp: 300, jetons: 8, rangMin: "Groupie",
      texte: "Donne 10 bonnes réponses au blind test géant." },
    { id: "m8",  titre: "Jury du festival",      categorie: "social",      action: "votes",      objectif: 3,  xp: 60,  jetons: 2,
      texte: "Vote pour 3 stands dans les Coups de cœur." },
    { id: "m9",  titre: "Échauffement",          categorie: "defi",        action: "staff",      objectif: 1,  xp: 100, jetons: 2, lieu: "soleil",
      texte: "Danse devant la Scène Soleil et fais valider par un bénévole en gilet jaune." },
    { id: "m10", titre: "Bien hydraté",          categorie: "exploration", action: "scanner",    objectif: 2,  xp: 40,  jetons: 1,
      texte: "Scanne le QR de 2 points d'eau différents." }
  ],

  categoriesMissions: {
    exploration: { nom: "Exploration", icone: "plan" },
    musique:     { nom: "Musique",     icone: "onde" },
    gourmand:    { nom: "Gourmand",    icone: "couverts" },
    social:      { nom: "Social",      icone: "coeur" },
    defi:        { nom: "Défi",        icone: "eclair" }
  },

  /* Tournoi du jour : meilleur score de la veille (en base : roi_veille(),
     table tournament_kings). Affiché à partir du 2e jour. */
  roiVeille: { pseudo: "Kora_77", points: 1240, jour: "vendredi" },

  /* Progression simulée d'un joueur. Futur : GET /api/joueurs/moi/carte */
  etatsJoueur: {
    confirme: {
      classement: { general: 412, jour: 87, total: 18400 },
      jour: { scans: 7, xp: 320 },
      favoris: ["a1", "a6", "a7", "a12", "a11", "a9"],
      progression: { m1: 2, m3: 1, m2: 0, m4: 0, m5: 1, m9: 1, m8: 1, m10: 0 },
      terminees: { m5: { heure: "17:02" }, m9: { heure: "18:15", par: "Awa, équipe Vimas Quest" } },
      collection: {
        badges: {
          "b-premiere-note": { jour: "2026-11-27", heure: "17:02" },
          "b-leve-tot":      { jour: "2026-11-27", heure: "16:40" },
          "b-noctambule":    { jour: "2026-11-28", heure: "00:48" },
          "b-curieux":       { jour: "2026-11-27", heure: "21:15" },
          "b-echauffement":  { jour: "2026-11-28", heure: "18:15" },
          "b-oreille-or":    { jour: "2026-11-28", heure: "19:05" }
        },
        artistes: {
          a3: { jour: "2026-11-27", heure: "18:10" },
          a2: { jour: "2026-11-27", heure: "20:30" },
          a4: { jour: "2026-11-28", heure: "00:48" },
          a5: { jour: "2026-11-28", heure: "19:12", dedicace: true }
        },
        stands: {
          "st-kora":      { jour: "2026-11-28", heure: "20:12" },
          "st-radio":     { jour: "2026-11-27", heure: "17:20" },
          "st-brasserie": { jour: "2026-11-27", heure: "19:45" },
          "st-braise":    { jour: "2026-11-28", heure: "19:48" },
          "st-quest": { jour: "2026-11-27", heure: "16:40" }
        },
        reliques: {
          "QR-REL-02": { jour: "2026-11-27", heure: "22:05" }
        }
      },
      activite: [
        { heure: "20:12", type: "scan",    texte: "Stand Maison Kora",                    xp: 20 },
        { heure: "19:48", type: "mission", texte: "Gourmet du festival, 1 sur 4",         xp: 20 },
        { heure: "19:05", type: "badge",   texte: "Badge Oreille d'or débloqué",          xp: 50 },
        { heure: "18:40", type: "scan",    texte: "Scène La Clairière",                   xp: 30 }
      ]
    },
    debutant: {
      classement: { general: 18310, jour: 9120, total: 18400 },
      jour: { scans: 0, xp: 50 },
      favoris: [],
      progression: { m5: 0, m1: 0 },
      terminees: {},
      collection: { badges: {}, artistes: {}, stands: {}, reliques: {} },
      activite: [
        { heure: null, type: "inscription", texte: "Profil créé", xp: 50 }
      ]
    }
  },

  /* Annonces (page 15). niveau : urgent | important | info ; type : meteo | horaire | surprise | securite | jeu | pratique
     jour + heure = publication ; fin = fin de validité (même jour, ou le lendemain si avant 8h). */
  annonces: [
    { id: "n1", niveau: "urgent", type: "meteo", jour: "sam", heure: "19:55", fin: "23:59",
      titre: "Risque d'orage vers 23h", texte: "Abris ouverts près de La Clairière et du Dock. Suis les consignes des bénévoles.",
      lien: { href: "plan.html?lieu=abri-1", libelle: "Voir les abris" }, lu: false },
    { id: "n5", niveau: "important", type: "jeu", jour: "sam", heure: "20:00", fin: "21:00",
      titre: "Défi éclair : le Dock", texte: "Scanne le QR du Dock avant 21h pour gagner 120 XP et 4 jetons.",
      lien: { href: "missions.html#m6", libelle: "Voir le défi" }, lu: false },
    { id: "n4", niveau: "important", type: "horaire", jour: "sam", heure: "19:45",
      titre: "Dédicaces d'Ama Rise prolongées", texte: "La séance continue jusqu'à 20h30 à la tente dédicaces, près du Kiosque.",
      lien: { href: "plan.html?lieu=dedicaces", libelle: "Y aller" }, lu: true },
    { id: "n2", niveau: "info", type: "surprise", jour: "sam", heure: "19:30", fin: "22:35",
      titre: "Session surprise au Kiosque", texte: "Mboa Brass Band rejoue 20 minutes à 22h15.",
      lien: { href: "plan.html?lieu=kiosque", libelle: "Voir le Kiosque" }, lu: false },
    { id: "n3", niveau: "info", type: "pratique", jour: "sam", heure: "17:10",
      titre: "Nouveau point d'eau", texte: "Un point d'eau gratuit est ouvert derrière la Scène Soleil.",
      lien: { href: "plan.html?lieu=eau-1", libelle: "Voir sur le plan" }, lu: true },
    { id: "n6", niveau: "info", type: "pratique", jour: "ven", heure: "23:40", fin: "03:30",
      titre: "Navette supplémentaire à 3h30", texte: "Une dernière navette part vers la gare routière à 3h30.", lu: true },
    { id: "n7", niveau: "important", type: "surprise", jour: "ven", heure: "18:00", fin: "23:00",
      titre: "La relique n°7 est de retour", texte: "Cherche du côté de la Scène Soleil…", lu: true }
  ],

  typesAnnonces: {
    meteo:    { nom: "Météo",       icone: "tente" },
    horaire:  { nom: "Horaires",    icone: "horloge" },
    surprise: { nom: "Surprise",    icone: "etoile" },
    securite: { nom: "Sécurité",    icone: "croix" },
    jeu:      { nom: "Jeu",         icone: "cible" },
    pratique: { nom: "Pratique",    icone: "info" }
  },

  /* Roue (page 11). poids = probabilité relative ; le serveur tire, la roue ne fait qu'animer.
     Un lot en rupture de stock n'est jamais tiré : sa part est redistribuée. */
  roue: {
    coutTirage: 5,
    maxParJour: 10,          // par journée de jeu (6 h → 6 h) ; 0 = sans plafond
    segments: [
      { id: "s1", type: "lot",    lot: "lot-casquette", court: "Casquette", poids: 22 },
      { id: "s2", type: "xp",     valeur: 50,           court: "+50 XP",    poids: 24 },
      { id: "s3", type: "lot",    lot: "lot-boisson",   court: "Boisson",   poids: 24 },
      { id: "s4", type: "jetons", valeur: 3,            court: "+3 jetons", poids: 14 },
      { id: "s5", type: "lot",    lot: "lot-vinyle",    court: "Vinyle",    poids: 7 },
      { id: "s6", type: "xp",     valeur: 100,          court: "+100 XP",   poids: 7 },
      { id: "s7", type: "lot",    lot: "lot-fosse",     court: "Fosse",     poids: 1.5 },
      { id: "s8", type: "lot",    lot: "lot-pass",      court: "Pass 2027", poids: 0.5 }
    ],
    retrait: {
      lieu: "Stand Vimas Quest, entrée principale",
      horaires: "Tous les jours de 16h à 23h",
      limite: { jour: "dim", heure: "23:00" }
    }
  },
  /* Bons déjà obtenus par le joueur de démo */
  bonsDeBase: {
    j1: [
      { code: "BON-7Q2K-41", lot: "lot-boisson",   statut: "retire",    creeLe: { jour: "2026-11-27", heure: "20:02" }, retireLe: { jour: "2026-11-27", heure: "20:10" }, par: "Awa" },
      { code: "BON-3M8D-17", lot: "lot-casquette", statut: "a-retirer", creeLe: { jour: "2026-11-28", heure: "19:40" } }
    ]
  },

  /* ---------- Collection (page 9) ----------
     forme : rond | etoile | hexa | ecusson ; secret : nom caché tant que non obtenu ;
     pctJoueurs : part des joueurs qui possèdent le badge (calculée par le serveur) */
  badges: [
    { id: "b-premiere-note", nom: "Première note",  texte: "Scanner ton premier QR de scène.",                 rarete: "commun",     forme: "rond",    icone: "onde",     pctJoueurs: 91, lien: "scanner.html" },
    { id: "b-leve-tot",      nom: "Lève-tôt",       texte: "Scanner un QR avant 17h.",                         rarete: "commun",     forme: "hexa",    icone: "horloge",  pctJoueurs: 44, lien: "scanner.html" },
    { id: "b-curieux",       nom: "Curieux",        texte: "Scanner 5 stands différents.",                     rarete: "commun",     forme: "rond",    icone: "plan",     pctJoueurs: 38, lien: "plan.html" },
    { id: "b-echauffement",  nom: "Échauffement",   texte: "Réussir la mission Échauffement.",                 rarete: "commun",     forme: "hexa",    icone: "eclair",   pctJoueurs: 27, lien: "missions.html#m9" },
    { id: "b-gourmet",       nom: "Gourmet",        texte: "Terminer la mission Gourmet du festival.",         rarete: "rare",       forme: "rond",    icone: "couverts", pctJoueurs: 22, lien: "missions.html#m3" },
    { id: "b-tournee",       nom: "En tournée",     texte: "Terminer la mission Tournée des scènes.",          rarete: "rare",       forme: "etoile",  icone: "micro",    pctJoueurs: 19, lien: "missions.html#m1" },
    { id: "b-noctambule",    nom: "Noctambule",     texte: "Scanner une scène pendant un concert après minuit.", rarete: "rare",     forme: "ecusson", icone: "etoile",   pctJoueurs: 17, lien: "programme.html" },
    { id: "b-jury",          nom: "Jury",           texte: "Voter pour 3 stands dans les Coups de cœur.",      rarete: "commun",     forme: "ecusson", icone: "coeur",    pctJoueurs: 31, lien: "coups-de-coeur.html" },
    { id: "b-fouineur",      nom: "Fouineur",       texte: "Trouver une relique.",                            rarete: "epique",     forme: "etoile",  icone: "cible",    pctJoueurs: 9,  lien: "collection.html" },
    { id: "b-autographe",    nom: "Autographe",     texte: "Rencontrer un artiste en séance de dédicaces.",    rarete: "epique",     forme: "ecusson", icone: "etoile",   pctJoueurs: 7,  lien: "missions.html#m4" },
    { id: "b-oreille-or",    nom: "Oreille d'or",   texte: "Finir dans le top 10 d'une manche du blind test.", rarete: "epique",     forme: "etoile",  icone: "micro",    pctJoueurs: 5,  lien: "blind-test.html" },
    { id: "b-marathon",      nom: "Marathonien",    texte: "Scanner au moins un QR chacun des 4 jours.",       rarete: "rare",       forme: "hexa",    icone: "calendrier", pctJoueurs: 12, lien: "scanner.html" },
    { id: "b-podium",        nom: "Podium",         texte: "Finir une journée dans le top 3 du classement.",   rarete: "legendaire", forme: "etoile",  icone: "trophee",  pctJoueurs: 1,  lien: "classement.html" },
    { id: "b-secret-1",      nom: "Sous les étoiles", texte: "Être là au bon moment, au bon endroit.",         rarete: "legendaire", forme: "rond",    icone: "etoile",   pctJoueurs: 2,  secret: true },
    { id: "b-secret-2",      nom: "Backstage",      texte: "Quelqu'un en coulisses détient la clé.",           rarete: "epique",     forme: "ecusson", icone: "cadenas",  pctJoueurs: 3,  secret: true }
  ],

  raretes: {
    commun:     { nom: "Commun" },
    rare:       { nom: "Rare" },
    epique:     { nom: "Épique" },
    legendaire: { nom: "Légendaire" }
  },

  stands: [
    { id: "st-kora",      nom: "Maison Kora",        type: "stand",     qr: "QR-KORA",     zone: "Allée des artisans" },
    { id: "st-radio",     nom: "Radio Écho",         type: "stand",     qr: "QR-RADIO",    zone: "Près de la Scène Soleil" },
    { id: "st-brasserie", nom: "Brasserie du Port",  type: "stand",     qr: "QR-BRASS",    zone: "Bar central" },
    { id: "st-telco",     nom: "Salon Telco+",       type: "stand",     qr: "QR-TELCO",    zone: "Entrée nord" },
    { id: "st-fraicheur", nom: "Fraîcheur Lab",      type: "stand",     qr: "QR-FRAICH",   zone: "Derrière Le Dock" },
    { id: "st-quest", nom: "Stand Vimas Quest",    type: "stand",     qr: "QR-RSN",      zone: "Entrée principale" },
    { id: "st-yassa",     nom: "Chez Yassa",         type: "foodtruck", qr: "QR-FT-YASSA", zone: "Village food" },
    { id: "st-braise",    nom: "Le Braisé",          type: "foodtruck", qr: "QR-FT-BRAISE", zone: "Village food" },
    { id: "st-sucre",     nom: "Sucre & Sel",        type: "foodtruck", qr: "QR-FT-SUCRE", zone: "Village food" },
    { id: "st-plantain",  nom: "Plantain Express",   type: "foodtruck", qr: "QR-FT-PLANT", zone: "Près de La Clairière" }
  ],

  /* ---------- Coups de cœur (page 13) ----------
     Règles : 3 cœurs par catégorie pour tout le festival, modifiables jusqu'à la clôture.
     Un artiste est votable dès que son concert a commencé ; un stand, une fois scanné. */
  votesConfig: {
    coeurs: 3,
    cloture: { jour: "dim", heure: "20:00" },
    resultats: "Dimanche à 22h sur l'écran géant de la Scène Soleil"
  },
  /* Totaux simulés des autres festivaliers (futur : GET /api/votes/tendances) */
  votesTendances: {
    artistes: { a1: 2140, a2: 980, a3: 1260, a4: 1710, a5: 1490, a6: 620, a7: 1980, a8: 540, a9: 0, a10: 0, a11: 0, a12: 0 },
    stands: { "st-kora": 860, "st-radio": 410, "st-brasserie": 1120, "st-telco": 300, "st-fraicheur": 520, "st-quest": 690,
              "st-yassa": 1340, "st-braise": 980, "st-sucre": 760, "st-plantain": 450 }
  },
  votesDeBase: { j1: { artistes: ["a5"], stands: ["st-kora"] } },

  /* ---------- Classement (page 10) ----------
     Le serveur calculera le vrai classement ; ici, une courbe XP ↔ rang simule 18 400 joueurs. */
  classementConfig: {
    general: { total: 18400, xpPremier: 8200, pente: 0.3137 },
    jour:    { total: 9120,  xpPremier: 1400, pente: 0.33 },
    tailleTop: 10,
    voisins: 2
  },

  /* Annuaire des codes amis connus (futur : POST /api/amis { code }) */
  joueursConnus: [
    { code: "KALE-4417",  pseudo: "Kalé_Sound",    avatar: "soleil",  xp: 1510, xpJour: 410 },
    { code: "MINA-2208",  pseudo: "MinaRiff",      avatar: "damier",  xp: 980,  xpJour: 290 },
    { code: "TOTO-0931",  pseudo: "TotoTempo",     avatar: "rayures", xp: 2140, xpJour: 150 },
    { code: "SARA-7703",  pseudo: "SaraLarsen",    avatar: "demi",    xp: 610,  xpJour: 380 },
    { code: "JOJO-5566",  pseudo: "JojoGroove",    avatar: "points",  xp: 1330, xpJour: 60 },
    { code: "BASS-1240",  pseudo: "BasseProfonde", avatar: "ondes",   xp: 1240, xpJour: 320, joueur: "j1" }
  ],
  amisDeBase: { j1: ["KALE-4417", "MINA-2208", "TOTO-0931"] },

  /* ---------- Scanner (page 4) ----------
     Contenu d'un QR imprimé : https://domafquest.example/q/<code>
     Le code court (sous le QR) permet la saisie manuelle.
     Futur : POST /api/scans { code } — la liste complète ne sera jamais envoyée au téléphone. */
  qrcodes: [
    { code: "QR-SOLEIL",   court: "SOL-4821", type: "scene",     nom: "Scène Soleil",          xp: 30,  jetons: 1, lieu: "soleil",    missions: ["m5", "m1"] },
    { code: "QR-DOCK",     court: "DCK-3307", type: "scene",     nom: "Le Dock",               xp: 30,  jetons: 1, lieu: "dock",      missions: ["m1", "m6"] },
    { code: "QR-RADIO",    court: "RAD-5510", type: "stand",     nom: "Stand Radio Écho",      xp: 20,  jetons: 1 },
    { code: "QR-FT-BRAISE", court: "BRA-7781", type: "foodtruck", nom: "Food-truck Le Braisé",  xp: 15,  jetons: 0, missions: ["m3"] },
    { code: "QR-EAU-1",    court: "EAU-1001", type: "service",   nom: "Point d'eau Soleil",    xp: 10,  jetons: 0, missions: ["m10"] },
    { code: "QR-KORA",     court: "KOR-1150", type: "stand",     nom: "Stand Maison Kora",     xp: 20,  jetons: 1 },
    { code: "QR-FT-YASSA", court: "YAS-6624", type: "foodtruck", nom: "Food-truck Chez Yassa", xp: 15,  jetons: 0, missions: ["m3"] },
    { code: "QR-CACHE-07", court: "CAC-0707", type: "relique",   nom: "Le vinyle d'or",        xp: 150, jetons: 5, missions: ["m2"],
      rarete: "rare", indice: "Là où la musique se mixe, à l'abri des regards.",
      badge: { id: "b-fouineur", nom: "Fouineur", texte: "Trouver une relique" } },
    { code: "QR-REL-02",   court: "REL-0202", type: "relique",   nom: "La baguette du chef",   xp: 75,  jetons: 2,
      rarete: "commune", indice: "Elle attend près de ceux qui nourrissent le festival." },
    { code: "QR-REL-03",   court: "REL-0303", type: "relique",   nom: "Le micro de 2010",      xp: 300, jetons: 8,
      rarete: "legendaire", indice: "Quinze ans de festival la regardent depuis la plus haute marche." },
    { code: "QR-DEDI-AMA", court: "AMA-2026", type: "dedicace",  nom: "Dédicace d'Ama Rise",   xp: 100, jetons: 2, artiste: "a7",
      badge: { id: "b-autographe", nom: "Autographe", texte: "Rencontrer un artiste" } },
    { code: "QR-FEU",      court: "FEU-2345", type: "surprise",  nom: "Feu d'artifice",        xp: 80,  jetons: 3, actifDes: "23:45" }
  ],

  typesQR: {
    scene:     { nom: "Scène",          couleur: "sodium" },
    stand:     { nom: "Stand",          couleur: "bleu" },
    foodtruck: { nom: "Food-truck",     couleur: "vert" },
    relique:   { nom: "Relique",        couleur: "rose" },
    dedicace:  { nom: "Dédicace",       couleur: "rose" },
    surprise:  { nom: "Événement",      couleur: "nuit" },
    service:   { nom: "Service",        couleur: "papier" }
  },

  /* create_player ne donne ni XP ni jetons de départ : le joueur commence à zéro,
     comme sur Otaku. Seule la première mission est affichée pour le lancer. */
  bonusBienvenue: { xp: 0, jetons: 0, rang: "Spectateur", premiereMission: "Scanne le QR de la Scène Soleil" }
};
