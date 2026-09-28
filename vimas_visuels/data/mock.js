/* ==========================================================================
   Vimas Fest — données simulées
   Chaque clé correspond à une future route d'API (GET /api/<clé>).
   Les pages n'accèdent JAMAIS directement à MOCK : elles passent par
   App.data.get('<clé>') (voir assets/js/app.js).
   ========================================================================== */
window.MOCK = {
  festival: {
    nom: "Vimas Fest",
    edition: 1,
    slogan: "Le festival qui se joue",
    lieu: "Majestic Cinéma, Université de Yaoundé 1",
    dates: "26 et 27 décembre 2026",
    ouverture: "2026-12-26T15:00:00+01:00",
    contactPartenaires: "partenaires@vimas-festival.example"
  },

  jours: [
    { id: "sam", court: "Sam. 26", long: "Samedi 26 décembre",   date: "2026-12-26" },
    { id: "dim", court: "Dim. 27", long: "Dimanche 27 décembre", date: "2026-12-27" }
  ],

  scenes: [
    { id: "soleil",    nom: "Grande Scène",      couleur: "sodium" },
    { id: "clairiere", nom: "Le Yard Reggae",    couleur: "vert" },
    { id: "dock",      nom: "La Salle Majestic", couleur: "rose" },
    { id: "kiosque",   nom: "Le Podium Mode",    couleur: "bleu" },
    { id: "chapiteau", nom: "Sound System Nuit", couleur: "nuit" }
  ],

  /* duree en minutes ; bio courte pour la fiche artiste */
  artistes: [
    { id: "a1",  nom: "Nova Kassa",        genre: "Afro-pop",  scene: "soleil",    jour: "sam", debut: "22:30", duree: 90, tete: true,
      bio: "Voix solaire et refrains qui restent en tête : Nova Kassa ouvre le Vimas Fest avec son deuxième album, porté par une section de cuivres." },
    { id: "a2",  nom: "Roots Mbeng",       genre: "Reggae",    scene: "clairiere", jour: "sam", debut: "19:00", duree: 60,
      bio: "Reggae roots chanté en français, en anglais et en langues locales : des basses lourdes et des messages qui font lever les poings." },
    { id: "a3",  nom: "Mboa Brass Band",   genre: "Fanfare",   scene: "kiosque",   jour: "sam", debut: "17:00", duree: 60,
      bio: "Onze musiciens qui déambulent entre les stands, jouent sans partition et finissent toujours au milieu du public." },
    { id: "a4",  nom: "Selecta Yard",      genre: "Dancehall", scene: "chapiteau", jour: "sam", debut: "00:30", duree: 90,
      bio: "Sound system dancehall : dubplates, riddims jamaïcains et afro, pour danser jusqu'à la fermeture." },
    { id: "a5",  nom: "Défilé Wax & Roots", genre: "Mode",     scene: "kiosque",   jour: "sam", debut: "20:00", duree: 45,
      bio: "Les créateurs des stands défilent sur le podium : wax, streetwear et silhouettes inspirées des Caraïbes." },
    { id: "a6",  nom: "Lady Soca",         genre: "Soca",      scene: "dock",      jour: "sam", debut: "21:00", duree: 60,
      bio: "L'énergie du carnaval de Trinidad en plein Yaoundé : drapeaux, sifflets et chorégraphies reprises par toute la salle." },
    { id: "a7",  nom: "Ama Rise",          genre: "Zouk",      scene: "dock",      jour: "dim", debut: "19:15", duree: 60, tete: true,
      bio: "La révélation zouk de l'année, chantée en trois langues, accompagnée d'un chœur de huit voix." },
    { id: "a8",  nom: "Sœur Vinyle",       genre: "Reggae",    scene: "chapiteau", jour: "dim", debut: "22:00", duree: 90,
      bio: "Uniquement des vinyles : du ska des années 60 au reggae de la semaine, en passant par le dub." },
    { id: "a9",  nom: "Tanka",             genre: "Rap",       scene: "soleil",    jour: "dim", debut: "21:45", duree: 90, tete: true,
      bio: "Le rappeur clôture le festival avec un show pensé pour Vimas Fest et quelques invités surprises." },
    { id: "a10", nom: "Battle Kompa & Coupé-décalé", genre: "Danse", scene: "kiosque", jour: "dim", debut: "18:00", duree: 60,
      bio: "Duels de danseurs en un contre un, jugés par le public : kompa, coupé-décalé, dancehall et bikutsi." },
    { id: "a11", nom: "Kalé & les Ondes",  genre: "Makossa",   scene: "clairiere", jour: "dim", debut: "20:00", duree: 60,
      bio: "La makossa revisitée avec une kora, des synthés et beaucoup d'énergie." },
    { id: "a12", nom: "Ilé Sound System",  genre: "Dub",       scene: "clairiere", jour: "dim", debut: "17:30", duree: 60,
      bio: "Un mur d'enceintes, des basses profondes et un MC qui fait chanter tout le Yard." }
  ],

  /* Séances de dédicaces (programme, fiches artistes, mission m4) */
  dedicaces: [
    { artiste: "a1", jour: "sam", debut: "19:30", fin: "20:15", lieu: "Tente dédicaces, près du Podium Mode" },
    { artiste: "a7", jour: "dim", debut: "17:30", fin: "18:15", lieu: "Tente dédicaces, près du Podium Mode" },
    { artiste: "a9", jour: "dim", debut: "19:00", fin: "19:45", lieu: "Tente dédicaces, près du Podium Mode" }
  ],

  programmeConfig: { ouverture: "16:30", fermeture: "02:30", pixelsParMinute: 2 },

  /* Temps de marche entre scènes, en minutes (page 6). Symétrique. */
  marcheEntreScenes: {
    soleil:    { clairiere: 6, dock: 9, kiosque: 5, chapiteau: 11 },
    clairiere: { dock: 5, kiosque: 7, chapiteau: 8 },
    dock:      { kiosque: 10, chapiteau: 4 },
    kiosque:   { chapiteau: 12 }
  },
  rappelsParDefaut: { actif: true, avance: 15 },

  /* ---------- Infos pratiques (page 17) ---------- */
  infos: {
    adresse: "Majestic Cinéma, Université de Yaoundé 1, entrée principale côté campus",
    horaires: [
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
      "Plateformes surélevées devant la Grande Scène, Le Yard Reggae, La Salle Majestic et Le Podium Mode",
      "Toilettes adaptées dans chaque bloc sanitaire",
      "Prêt de fauteuils et de sièges-cannes au Point info",
      "Boucle magnétique à la Grande Scène, gilets vibrants sur réservation",
      "Accompagnateur gratuit sur présentation de la carte d'invalidité"
    ],
    interdits: [
      "Bouteilles en verre et canettes", "Objets tranchants ou contondants", "Feux d'artifice, fumigènes, pointeurs laser",
      "Drones", "Parapluies à pointe (les modèles pliants sont acceptés)", "Animaux, sauf chiens d'assistance",
      "Alcool apporté de l'extérieur", "Enceintes portables"
    ],
    refuge: "Point Refuge",
    contact: {
      email: "bonjour@vimas-festival.example",
      delai: "Réponse sous 48 h, et en direct au Point info pendant le festival",
      sujets: ["Le jeu Vimas Fest", "Un lot ou un bon de retrait", "Mon billet", "Accessibilité", "Objet perdu", "Autre"]
    },
    faq: [
      { id: "billet-perdu", q: "J'ai perdu mon billet, comment récupérer ma partie ?", r: "Passe au Point info avec une pièce d'identité : l'équipe réémet ton billet. Ta partie est liée au billet, tu la retrouves en scannant le nouveau." },
      { id: "qr-illisible", q: "Un QR du site ne se scanne pas.", r: "Essaie avec la lampe du scanner, puis utilise « Saisir un code » : chaque QR a un code court imprimé en dessous (par exemple SOL-4821)." },
      { id: "rescanner", q: "Puis-je scanner le même QR plusieurs fois ?", r: "Chaque QR rapporte des XP une fois par jour. Le lendemain, il redevient actif." },
      { id: "reseau", q: "Le réseau ne passe pas, je perds mes points ?", r: "Non. Tes réponses au blind test sont renvoyées automatiquement, et le Wi-Fi gratuit Telco+ est disponible près des scènes." },
      { id: "batterie", q: "Mon téléphone n'a plus de batterie.", r: "Des bornes de recharge gratuites sont à la Consigne (16h à 3h) et au Salon Telco+. Ta partie est sauvegardée : rien n'est perdu." },
      { id: "lots", q: "Jusqu'à quand puis-je retirer mes lots ?", r: "Jusqu'au dimanche 23h au Stand Vimas Fest, avec ton bon de retrait et ton billet. Les lots non retirés ne sont pas envoyés par la poste." },
      { id: "mineurs", q: "Les mineurs peuvent-ils jouer ?", r: "Oui, à partir de 12 ans, accompagnés d'un adulte sur le site. Les lots avec de l'alcool ne sont jamais remis aux mineurs." },
      { id: "sortie", q: "Puis-je sortir et revenir ?", r: "Oui, ton bracelet permet de sortir et de revenir autant de fois que tu veux jusqu'à 1h du matin." },
      { id: "pseudo", q: "Mon pseudo est-il visible par tout le monde ?", r: "Oui, dans les classements et sur l'écran géant. Il ne contient jamais ton nom : choisis un pseudo qui ne permet pas de t'identifier." },
      { id: "donnees", q: "Comment supprimer mes données de jeu ?", r: "En bas de cette page, section Contact : « Supprimer ma partie ». Tes points, badges et lots non retirés sont alors effacés." }
    ]
  },

  /* ---------- Sondage du soir (page 16) ----------
     Ouvert de 22h à 6h. Les réponses sont enregistrées sans le pseudo (statistiques anonymes). */
  sondageConfig: {
    ouverture: "22:00",
    fermeture: "06:00",
    recompense: { xp: 40, jetons: 2 },
    questions: [
      { id: "note",     type: "echelle", obligatoire: true,  titre: "Ta journée, tu la notes comment ?",
        libelles: ["Décevante", "Moyenne", "Bien", "Très bien", "Inoubliable"] },
      { id: "concert",  type: "artiste", obligatoire: false, titre: "Ton concert préféré aujourd'hui ?" },
      { id: "plus",     type: "multi",   obligatoire: true,  titre: "Qu'est-ce qui t'a le plus plu ?", max: 3,
        choix: ["La musique", "L'ambiance", "Le jeu Vimas Fest", "La nourriture", "L'organisation", "Les rencontres", "Le site"] },
      { id: "attente",  type: "attente", obligatoire: false, titre: "Et l'attente, c'était comment ?",
        points: ["Entrée", "Bar", "Food-trucks", "Toilettes", "Points d'eau"],
        niveaux: ["Rapide", "Correct", "Trop long"] },
      { id: "jeu",      type: "nps",     obligatoire: true,  titre: "Conseillerais-tu le jeu Vimas Fest à un ami ?",
        bornes: ["Pas du tout", "Carrément"] },
      { id: "mot",      type: "texte",   obligatoire: false, titre: "Un mot pour l'équipe ?", max: 280,
        aide: "Idée, remerciement, problème rencontré… Pas d'informations personnelles, s'il te plaît." }
    ]
  },

  /* ---------- Plan (page 7) ----------
     Coordonnées dans le dessin (1000 × 700). 1 unité = 2 m. */
  planConfig: {
    metresParUnite: 2,
    metresParMinute: 75,
    telephoneSecurite: "0800000000",   // FICTIF : à remplacer par le numéro réel de la sécurité du festival
    libelleTelephone: "Sécurité du festival (numéro de démo)",
    // Emprise approximative du site, pour placer le joueur grâce au GPS
    geo: { nord: 3.8740, sud: 3.8650, ouest: 11.4980, est: 11.5110 }
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
  lieux: [
    { id: "soleil",          cat: "scene", nom: "Grande Scène",   x: 620, y: 150, pmr: true, desc: "Grande scène et écran géant. Plateforme PMR à droite de la régie." },
    { id: "clairiere",       cat: "scene", nom: "Le Yard Reggae",   x: 330, y: 300, pmr: true, desc: "Scène reggae en plein air, sous les arbres du campus." },
    { id: "dock",            cat: "scene", nom: "La Salle Majestic",        x: 860, y: 360, pmr: true, desc: "La salle de cinéma transformée en scène couverte." },
    { id: "kiosque",         cat: "scene", nom: "Le Podium Mode",     x: 530, y: 370, pmr: true, desc: "Podium des défilés de mode et des battles de danse." },
    { id: "chapiteau",       cat: "scene", nom: "Sound System Nuit", x: 840, y: 580, pmr: false, desc: "Sound system des sets de nuit. Accès PMR par l'entrée arrière, demande à un bénévole." },

    { id: "st-radio",        cat: "stand", nom: "Radio Écho",        x: 770, y: 110, desc: "Studio en direct et interviews d'artistes." },
    { id: "st-telco",        cat: "stand", nom: "Salon Telco+",      x: 690, y: 40,  desc: "Wi-Fi du festival et bornes de recharge." },
    { id: "st-kora",         cat: "stand", nom: "Maison Kora",       x: 690, y: 460, desc: "Artisans luthiers, essais d'instruments." },
    { id: "st-brasserie",    cat: "stand", nom: "Brasserie du Port", x: 580, y: 480, desc: "Bar central." },
    { id: "st-fraicheur",    cat: "stand", nom: "Fraîcheur Lab",     x: 950, y: 290, desc: "Brumisateurs et gourdes à remplir." },
    { id: "st-vimas",    cat: "stand", nom: "Stand Vimas Fest",   x: 600, y: 640, horaires: "16h à 23h", desc: "Accueil du jeu, retrait des lots, aide aux joueurs." },

    { id: "st-yassa",        cat: "food", nom: "Chez Yassa",       x: 300, y: 520, desc: "Village food." },
    { id: "st-braise",       cat: "food", nom: "Le Braisé",        x: 370, y: 520, desc: "Village food." },
    { id: "st-sucre",        cat: "food", nom: "Sucre & Sel",      x: 335, y: 580, desc: "Village food, desserts." },
    { id: "st-plantain",     cat: "food", nom: "Plantain Express", x: 430, y: 290, desc: "Près de Le Yard Reggae." },

    { id: "eau-1", cat: "eau", nom: "Point d'eau Grande Scène",    x: 560, y: 80,  desc: "Eau potable gratuite, derrière la Grande Scène." },
    { id: "eau-2", cat: "eau", nom: "Point d'eau Yard Reggae", x: 420, y: 230, desc: "Eau potable gratuite." },
    { id: "eau-3", cat: "eau", nom: "Point d'eà la Salle Majestic",      x: 770, y: 540, desc: "Eau potable gratuite." },
    { id: "eau-4", cat: "eau", nom: "Point d'eau Village",   x: 460, y: 590, desc: "Eau potable gratuite." },

    { id: "wc-1", cat: "toilettes", nom: "Toilettes Grande Scène",   x: 720, y: 240, pmr: true },
    { id: "wc-2", cat: "toilettes", nom: "Toilettes Yard Reggae", x: 270, y: 430, pmr: true },
    { id: "wc-3", cat: "toilettes", nom: "Toilettes Majestic",     x: 950, y: 470, pmr: true },
    { id: "wc-4", cat: "toilettes", nom: "Toilettes Entrée",   x: 430, y: 650, pmr: true },

    { id: "secours-1", cat: "secours", nom: "Poste de secours principal", x: 540, y: 570, horaires: "Ouvert en continu", desc: "Médecins, infirmiers, point d'écoute. Signalé par un grand drapeau rouge." },
    { id: "secours-2", cat: "secours", nom: "Point secours Grande Scène",       x: 790, y: 220, horaires: "Pendant les concerts", desc: "Équipe de secouristes près de la grande scène." },

    { id: "abri-1", cat: "abri", nom: "Abri Yard Reggae", x: 380, y: 200, desc: "Abri couvert en cas d'orage." },
    { id: "abri-2", cat: "abri", nom: "Abri Majestic",      x: 910, y: 420, desc: "Le hall du Majestic sert d'abri en cas d'orage." },

    { id: "dedicaces",    cat: "service", nom: "Tente dédicaces",       x: 450, y: 420, desc: "Séances de dédicaces des artistes, voir le programme." },
    { id: "consigne",     cat: "service", nom: "Consigne et recharge",  x: 690, y: 640, horaires: "16h à 3h", desc: "Casiers et recharge de téléphone." },
    { id: "info",         cat: "service", nom: "Point info",            x: 500, y: 650, desc: "Objets trouvés, informations, accessibilité." },

    { id: "entree-principale", cat: "entree", nom: "Entrée principale", x: 560, y: 690, desc: "Contrôle des billets et bracelets." },
    { id: "entree-nord",       cat: "entree", nom: "Entrée nord",       x: 620, y: 12,  desc: "Sortie de secours et accès livraisons." }
  ],

  /* Objectifs de la 1re édition, affichés sur la vitrine */
  bilan: { annee: 2026, joueurs: 5000, scans: 60000, qrCaches: 60, lotsRemis: 300 },

  etapes: [
    { titre: "Scanne ton billet",       texte: "Le QR de ton billet ou de ton bracelet crée ton profil. Pas de mot de passe à retenir.", gain: "Profil créé" },
    { titre: "Chasse les QR du site",   texte: "Scènes, stands, food-trucks, dédicaces et quelques recoins bien cachés.",                  gain: "+10 à +150 XP" },
    { titre: "Remplis tes missions",    texte: "Trois concerts sur trois scènes, un QR près de la grande scène, un vote pour ton stand préféré…", gain: "Jetons et badges" },
    { titre: "Fais tourner la roue",    texte: "Dépense tes jetons et retire ton lot au stand Vimas Fest, juste à côté de l'entrée.",       gain: "Lots réels" }
  ],

  rangs: [
    { nom: "Spectateur",     xp: 0 },
    { nom: "Fan",            xp: 500 },
    { nom: "Groupie",        xp: 1500 },
    { nom: "Backstage",      xp: 3500 },
    { nom: "Tête d'affiche", xp: 7000 }
  ],

  lots: [
    { id: "lot-casquette", nom: "Casquette officielle",       rarete: "commun",     stock: 300, icone: "etoile" },
    { id: "lot-boisson",   nom: "Boisson offerte au bar",     rarete: "commun",     stock: 600, icone: "couverts" },
    { id: "lot-vinyle",    nom: "Vinyle dédicacé",            rarete: "rare",       stock: 40,  icone: "onde" },
    { id: "lot-fosse",     nom: "Place en fosse avant-scène", rarete: "epique",     stock: 12,  icone: "micro" },
    { id: "lot-pass",      nom: "Pass 2e édition",          rarete: "legendaire", stock: 0,   icone: "billet" }
  ],

  blindTest: {
    horaire: "21:30", lieu: "Écran géant, Grande Scène", questions: 15,
    lienJeu: "https://vimas-festival.example/blind",
    durees: { intro: 4, question: 20, revelation: 9, classement: 10, fin: 90 }, // secondes
    classementToutesLes: 5
  },

  /* Questions du blind test (page 30). Les extraits sont synthétisés en démo :
     motif = notes MIDI, onde = timbre, tempo = BPM. En production : fichiers audio sous licence.
     La bonne réponse ne doit jamais être envoyée aux téléphones avant la révélation. */
  blindQuestions: [
    { categorie: "Artiste",    question: "Qui joue ce morceau ?",                        choix: ["Nova Kassa", "Ama Rise", "Tanka", "Doudou Kompa"],                          bonne: 0, reponse: "Nova Kassa, « Lumière du lac »",      anecdote: "Écrit en une nuit sur la rive du lac.",            motif: [64, 67, 69, 67, 64, 62, 60, 62], onde: "triangle", tempo: 112 },
    { categorie: "Instrument", question: "Quel instrument ouvre ce morceau ?",           choix: ["Balafon", "Kora", "Saxophone", "Guitare électrique"],                     bonne: 1, reponse: "Kalé & les Ondes, « Rive gauche »",   anecdote: "La kora compte ici 21 cordes.",                     motif: [69, 72, 76, 72, 69, 67, 69, 64], onde: "sine",     tempo: 96 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                   choix: ["Makossa", "Dub", "Jazz", "Reggae"],                                         bonne: 1, reponse: "Ilé Sound System, « Basse fréquence »", anecdote: "Enregistré avec un seul micro.",                  motif: [45, 45, 52, 45, 48, 45, 43, 45], onde: "square",   tempo: 74 },
    { categorie: "Année",      question: "En quelle année est sorti ce titre ?",        choix: ["2009", "2014", "2019", "2023"],                                           bonne: 2, reponse: "Orchestre Minuit, « Minuit pile »",   anecdote: "Leur premier disque, pressé à 300 exemplaires.",   motif: [62, 65, 69, 72, 71, 67, 64, 62], onde: "sine",     tempo: 88 },
    { categorie: "Artiste",    question: "Quel groupe de l'affiche joue ici ?",         choix: ["Roots Mbeng", "Lady Soca", "Mboa Brass Band", "Selecta Yard"],   bonne: 2, reponse: "Mboa Brass Band, « Grand défilé »",   anecdote: "Onze musiciens, zéro partition.",                   motif: [60, 64, 67, 72, 67, 64, 65, 67], onde: "sawtooth", tempo: 126 },
    { categorie: "Instrument", question: "Quel instrument tient la mélodie ?",          choix: ["Trompette", "Violon", "Flûte", "Synthétiseur"],                           bonne: 3, reponse: "Selecta Yard, « Code source »",        anecdote: "Le synthé a été construit par l'artiste.",          motif: [72, 74, 76, 79, 76, 74, 72, 67], onde: "square",   tempo: 128 },
    { categorie: "Scène",      question: "Sur quelle scène joue ce groupe ce soir ?",   choix: ["La Salle Majestic", "Le Yard Reggae", "Le Podium Mode", "Sound System Nuit"],                bonne: 0, reponse: "Lady Soca, « Mirage »",         anecdote: "Ils ouvrent le Majestic à 21h.",                        motif: [57, 60, 64, 63, 60, 57, 55, 57], onde: "sawtooth", tempo: 100 },
    { categorie: "Tempo",      question: "Ce morceau est plutôt…",                      choix: ["Très lent", "Modéré", "Rapide", "Très rapide"],                           bonne: 2, reponse: "Tanka, « Pas de côté »",              anecdote: "140 battements par minute.",                        motif: [67, 67, 70, 67, 65, 63, 65, 67], onde: "triangle", tempo: 140 },
    { categorie: "Artiste",    question: "Qui joue ce morceau ?",                        choix: ["Sœur Vinyle", "Doudou Kompa", "Ama Rise", "Nova Kassa"],                   bonne: 1, reponse: "Doudou Kompa, « Néon »",               anecdote: "Premier concert du groupe en Afrique centrale.",   motif: [64, 68, 71, 76, 75, 71, 68, 64], onde: "triangle", tempo: 118 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                   choix: ["Soul", "Reggae", "Fanfare", "Dancehall"],                                     bonne: 0, reponse: "Ama Rise, « Encore une fois »",       anecdote: "Chanté en trois langues.",                          motif: [60, 63, 67, 70, 68, 67, 63, 60], onde: "sine",     tempo: 80 },
    { categorie: "Instrument", question: "Quelle percussion entend-on ?",               choix: ["Batterie", "Cajón", "Djembé", "Tambour d'eau"],                           bonne: 2, reponse: "Kalé & les Ondes, « Pluie »",         anecdote: "Le djembé vient d'un atelier de Bafoussam.",        motif: [48, 48, 55, 48, 51, 48, 46, 48], onde: "square",   tempo: 104 },
    { categorie: "Année",      question: "En quelle année est sorti ce titre ?",        choix: ["1998", "2004", "2011", "2021"],                                           bonne: 1, reponse: "Roots Mbeng, « Rue des Palmiers »", anecdote: "Réédité pour les 20 ans du groupe.",               motif: [62, 66, 69, 74, 73, 69, 66, 62], onde: "sawtooth", tempo: 122 },
    { categorie: "Artiste",    question: "Quel groupe de l'affiche joue ici ?",         choix: ["Tanka", "Roots Mbeng", "Selecta Yard", "Kalé & les Ondes"],            bonne: 1, reponse: "Roots Mbeng, « Coupure de courant »", anecdote: "Joué pour la première fois à Vimas Fest 2023.",  motif: [59, 62, 66, 71, 69, 66, 64, 62], onde: "sawtooth", tempo: 132 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                   choix: ["Soca", "Dub", "Afro-pop", "Jazz"],                                      bonne: 3, reponse: "Orchestre Minuit, « Swing du port »", anecdote: "Improvisé à 80 % sur scène.",                      motif: [65, 69, 72, 75, 74, 72, 69, 65], onde: "sine",     tempo: 116 },
    { categorie: "Finale",     question: "Qui clôture le festival dimanche ?",          choix: ["Tanka", "Nova Kassa", "Orchestre Minuit", "Ama Rise"],                    bonne: 0, reponse: "Tanka, « Dernier tour »",             anecdote: "Rendez-vous dimanche à 21h45, Grande Scène.",      motif: [67, 71, 74, 79, 78, 74, 71, 67], onde: "triangle", tempo: 124 }
  ],

  quizDemo: {
    question: "Quel instrument ouvre ce morceau\u00A0?",
    choix: ["Balafon", "Kora", "Saxophone", "Guitare électrique"],
    bonne: 1
  },

  partenaires: [
    { nom: "Canal 2 International", role: "Télévision officielle" },
    { nom: "Sweet FM",              role: "Radio officielle" },
    { nom: "AMZ Groupe",            role: "Partenaire officiel" },
    { nom: "Majestic Cinéma",       role: "Lieu d'accueil" },
    { nom: "Vimas Production",      role: "Organisateur" },
    { nom: "Ton stand ici",         role: "Appel aux stands ouvert" }
  ],

  bandeau: [
    "Reggae, dancehall, zouk et soca tout le week-end",
    "Défilé mode et battle de danse sur le Podium",
    "60 QR codes cachés entre les stands",
    "Vote pour ton stand préféré",
    "Lots à retirer au stand Vimas Fest"
  ],

  /* ---------- Inscription (page 2) ---------- */
  /* Futur : POST /api/billets/verifier — le serveur ne renverra jamais la liste complète */
  billets: [
    { code: "VMS-7K4P-2QX9", type: "Pass 2 jours",    statut: "valide" },
    { code: "VMS-M3D8-VA51", type: "Billet samedi",   statut: "valide" },
    { code: "VMS-DEMO-2026", type: "Pass 2 jours",    statut: "valide", joueur: "j1" },
    { code: "VMS-BLOC-0000", type: "Billet dimanche", statut: "bloque" }
  ],

  joueurs: [
    { id: "j1", pseudo: "BasseProfonde", avatar: "ondes", genres: ["Reggae", "Dancehall"], xp: 1240, jetons: 18, rang: "Fan" }
  ],

  pseudosPris: ["basseprofonde", "nova", "dj", "groupie", "vimas", "admin", "staff"],

  motsPseudo: {
    debut: ["Basse", "Echo", "Riff", "Kora", "Tempo", "Larsen", "Vinyle", "Sono", "Groove", "Balafon"],
    fin: ["Nomade", "Solaire", "Rebelle", "Minuit", "Fauve", "Cosmique", "Tonique", "Libre", "Sauvage", "Lunaire"]
  },

  genres: ["Reggae", "Dancehall", "Zouk", "Soca", "Kompa", "Afro-pop", "Makossa", "Rap", "Dub", "Mode", "Danse"],

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
    { id: "m2",  titre: "Le QR caché",           categorie: "exploration", action: "scanner",    objectif: 1,  xp: 200, jetons: 5, lieu: "soleil",
      texte: "Un QR est caché près de la Grande Scène. À toi de le trouver.",
      indice: "Regarde du côté où passent les techniciens, à hauteur de genou.", coutIndice: 1 },
    { id: "m3",  titre: "Gourmet du festival",   categorie: "gourmand",    action: "scanner",    objectif: 4,  xp: 80,  jetons: 2,
      texte: "Scanne le QR de 4 food-trucks différents." },
    { id: "m4",  titre: "Chasseur de dédicaces", categorie: "musique",     action: "staff",      objectif: 1,  xp: 250, jetons: 5, lieu: "kiosque",
      texte: "Passe à la séance de dédicaces et fais valider ta mission par l'équipe sur place." },
    { id: "m5",  titre: "Première note",         categorie: "exploration", action: "scanner",    objectif: 1,  xp: 30,  jetons: 1, lieu: "soleil",
      texte: "Scanne le QR de la Grande Scène." },
    { id: "m6",  titre: "Défi éclair : le Majestic", categorie: "defi",        action: "scanner",    objectif: 1,  xp: 120, jetons: 4, lieu: "dock",
      texte: "Scanne le QR de la Salle Majestic avant 21h.", jour: "sam", finHeure: "21:00" },
    { id: "m7",  titre: "Oreille absolue",       categorie: "musique",     action: "blind-test", objectif: 10, xp: 300, jetons: 8, rangMin: "Groupie",
      texte: "Donne 10 bonnes réponses au blind test géant." },
    { id: "m8",  titre: "Jury du festival",      categorie: "social",      action: "votes",      objectif: 3,  xp: 60,  jetons: 2,
      texte: "Vote pour 3 stands dans les Coups de cœur." },
    { id: "m9",  titre: "Échauffement",          categorie: "defi",        action: "staff",      objectif: 1,  xp: 100, jetons: 2, lieu: "soleil",
      texte: "Danse devant la Grande Scène et fais valider par un bénévole en gilet jaune." },
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

  /* Progression simulée d'un joueur. Futur : GET /api/joueurs/moi/carte */
  etatsJoueur: {
    confirme: {
      classement: { general: 412, jour: 87, total: 18400 },
      jour: { scans: 7, xp: 320 },
      favoris: ["a1", "a6", "a7", "a12", "a11", "a9"],
      progression: { m1: 2, m3: 1, m2: 0, m4: 0, m5: 1, m9: 1, m8: 1, m10: 0 },
      terminees: { m5: { heure: "17:02" }, m9: { heure: "18:15", par: "Awa, équipe Vimas Fest" } },
      collection: {
        badges: {
          "b-premiere-note": { jour: "2026-12-26", heure: "17:02" },
          "b-leve-tot":      { jour: "2026-12-26", heure: "16:40" },
          "b-noctambule":    { jour: "2026-12-26", heure: "00:48" },
          "b-curieux":       { jour: "2026-12-26", heure: "21:15" },
          "b-echauffement":  { jour: "2026-12-26", heure: "18:15" },
          "b-oreille-or":    { jour: "2026-12-26", heure: "19:05" }
        },
        artistes: {
          a3: { jour: "2026-12-26", heure: "18:10" },
          a2: { jour: "2026-12-26", heure: "20:30" },
          a4: { jour: "2026-12-26", heure: "00:48" },
          a5: { jour: "2026-12-26", heure: "19:12", dedicace: true }
        },
        stands: {
          "st-kora":      { jour: "2026-12-26", heure: "20:12" },
          "st-radio":     { jour: "2026-12-26", heure: "17:20" },
          "st-brasserie": { jour: "2026-12-26", heure: "19:45" },
          "st-braise":    { jour: "2026-12-26", heure: "19:48" },
          "st-vimas": { jour: "2026-12-26", heure: "16:40" }
        }
      },
      indices: [],
      activite: [
        { heure: "20:12", type: "scan",    texte: "Stand Maison Kora",                    xp: 20 },
        { heure: "19:48", type: "mission", texte: "Gourmet du festival, 1 sur 4",         xp: 20 },
        { heure: "19:05", type: "badge",   texte: "Badge Oreille d'or débloqué",          xp: 50 },
        { heure: "18:40", type: "scan",    texte: "Scène Le Yard Reggae",                   xp: 30 }
      ]
    },
    debutant: {
      classement: { general: 18310, jour: 9120, total: 18400 },
      jour: { scans: 0, xp: 50 },
      favoris: [],
      progression: { m5: 0, m1: 0 },
      terminees: {},
      indices: [],
      collection: { badges: {}, artistes: {}, stands: {} },
      activite: [
        { heure: null, type: "inscription", texte: "Profil créé", xp: 50 }
      ]
    }
  },

  /* Annonces (page 15). niveau : urgent | important | info ; type : meteo | horaire | surprise | securite | jeu | pratique
     jour + heure = publication ; fin = fin de validité (même jour, ou le lendemain si avant 8h). */
  annonces: [
    { id: "n1", niveau: "urgent", type: "meteo", jour: "sam", heure: "19:55", fin: "23:59",
      titre: "Risque d'orage vers 23h", texte: "Abris ouverts près de Le Yard Reggae et de la Salle Majestic. Suis les consignes des bénévoles.",
      lien: { href: "plan.html?lieu=abri-1", libelle: "Voir les abris" }, lu: false },
    { id: "n5", niveau: "important", type: "jeu", jour: "sam", heure: "20:00", fin: "21:00",
      titre: "Défi éclair : le Majestic", texte: "Scanne le QR de la Salle Majestic avant 21h pour gagner 120 XP et 4 jetons.",
      lien: { href: "missions.html#m6", libelle: "Voir le défi" }, lu: false },
    { id: "n4", niveau: "important", type: "horaire", jour: "sam", heure: "19:45",
      titre: "Dédicaces d'Ama Rise prolongées", texte: "La séance continue jusqu'à 20h30 à la tente dédicaces, près du Podium Mode.",
      lien: { href: "plan.html?lieu=dedicaces", libelle: "Y aller" }, lu: true },
    { id: "n2", niveau: "info", type: "surprise", jour: "sam", heure: "19:30", fin: "22:35",
      titre: "Session surprise au Podium Mode", texte: "Mboa Brass Band rejoue 20 minutes à 22h15.",
      lien: { href: "plan.html?lieu=kiosque", libelle: "Voir le Podium Mode" }, lu: false },
    { id: "n3", niveau: "info", type: "pratique", jour: "sam", heure: "17:10",
      titre: "Nouveau point d'eau", texte: "Un point d'eau gratuit est ouvert derrière la Grande Scène.",
      lien: { href: "plan.html?lieu=eau-1", libelle: "Voir sur le plan" }, lu: true },
    { id: "n6", niveau: "info", type: "pratique", jour: "sam", heure: "23:40", fin: "03:30",
      titre: "Navette supplémentaire à 3h30", texte: "Une dernière navette part vers la gare routière à 3h30.", lu: true },
    { id: "n7", niveau: "important", type: "surprise", jour: "sam", heure: "18:00", fin: "23:00",
      titre: "Le QR caché n°7 est réactivé", texte: "Cherche du côté de la Grande Scène…", lu: true }
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
    delaiEntreTirages: 20,   // secondes
    maxParJour: 10,
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
      lieu: "Stand Vimas Fest, entrée principale",
      horaires: "Tous les jours de 16h à 23h",
      limite: { jour: "dim", heure: "23:00" }
    }
  },
  /* Bons déjà obtenus par le joueur de démo */
  bonsDeBase: {
    j1: [
      { code: "BON-7Q2K-41", lot: "lot-boisson",   statut: "retire",    creeLe: { jour: "2026-12-26", heure: "20:02" }, retireLe: { jour: "2026-12-26", heure: "20:10" }, par: "Awa" },
      { code: "BON-3M8D-17", lot: "lot-casquette", statut: "a-retirer", creeLe: { jour: "2026-12-26", heure: "19:40" } }
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
    { id: "b-fouineur",      nom: "Fouineur",       texte: "Trouver un QR caché.",                             rarete: "epique",     forme: "etoile",  icone: "cible",    pctJoueurs: 9,  lien: "missions.html#m2" },
    { id: "b-autographe",    nom: "Autographe",     texte: "Rencontrer un artiste en séance de dédicaces.",    rarete: "epique",     forme: "ecusson", icone: "etoile",   pctJoueurs: 7,  lien: "missions.html#m4" },
    { id: "b-oreille-or",    nom: "Oreille d'or",   texte: "Finir dans le top 10 d'une manche du blind test.", rarete: "epique",     forme: "etoile",  icone: "micro",    pctJoueurs: 5,  lien: "blind-test.html" },
    { id: "b-marathon",      nom: "Marathonien",    texte: "Scanner au moins un QR chacun des 2 jours.",       rarete: "rare",       forme: "hexa",    icone: "calendrier", pctJoueurs: 12, lien: "scanner.html" },
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
    { id: "st-radio",     nom: "Radio Écho",         type: "stand",     qr: "QR-RADIO",    zone: "Près de la Grande Scène" },
    { id: "st-brasserie", nom: "Brasserie du Port",  type: "stand",     qr: "QR-BRASS",    zone: "Bar central" },
    { id: "st-telco",     nom: "Salon Telco+",       type: "stand",     qr: "QR-TELCO",    zone: "Entrée nord" },
    { id: "st-fraicheur", nom: "Fraîcheur Lab",      type: "stand",     qr: "QR-FRAICH",   zone: "Derrière La Salle Majestic" },
    { id: "st-vimas", nom: "Stand Vimas Fest",    type: "stand",     qr: "QR-VMS",      zone: "Entrée principale" },
    { id: "st-yassa",     nom: "Chez Yassa",         type: "foodtruck", qr: "QR-FT-YASSA", zone: "Village food" },
    { id: "st-braise",    nom: "Le Braisé",          type: "foodtruck", qr: "QR-FT-BRAISE", zone: "Village food" },
    { id: "st-sucre",     nom: "Sucre & Sel",        type: "foodtruck", qr: "QR-FT-SUCRE", zone: "Village food" },
    { id: "st-plantain",  nom: "Plantain Express",   type: "foodtruck", qr: "QR-FT-PLANT", zone: "Près de Le Yard Reggae" }
  ],

  /* ---------- Coups de cœur (page 13) ----------
     Règles : 3 cœurs par catégorie pour tout le festival, modifiables jusqu'à la clôture.
     Un artiste est votable dès que son concert a commencé ; un stand, une fois scanné. */
  votesConfig: {
    coeurs: 3,
    cloture: { jour: "dim", heure: "20:00" },
    resultats: "Dimanche à 22h sur l'écran géant de la Grande Scène"
  },
  /* Totaux simulés des autres festivaliers (futur : GET /api/votes/tendances) */
  votesTendances: {
    artistes: { a1: 2140, a2: 980, a3: 1260, a4: 1710, a5: 1490, a6: 620, a7: 1980, a8: 540, a9: 0, a10: 0, a11: 0, a12: 0 },
    stands: { "st-kora": 860, "st-radio": 410, "st-brasserie": 1120, "st-telco": 300, "st-fraicheur": 520, "st-vimas": 690,
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
     Contenu d'un QR imprimé : https://vimas-festival.example/q/<code>
     Le code court (sous le QR) permet la saisie manuelle.
     Futur : POST /api/scans { code } — la liste complète ne sera jamais envoyée au téléphone. */
  qrcodes: [
    { code: "QR-SOLEIL",   court: "SOL-4821", type: "scene",     nom: "Grande Scène",          xp: 30,  jetons: 1, lieu: "soleil",    missions: ["m5", "m1"] },
    { code: "QR-DOCK",     court: "DCK-3307", type: "scene",     nom: "La Salle Majestic",               xp: 30,  jetons: 1, lieu: "dock",      missions: ["m1", "m6"] },
    { code: "QR-RADIO",    court: "RAD-5510", type: "stand",     nom: "Stand Radio Écho",      xp: 20,  jetons: 1 },
    { code: "QR-FT-BRAISE", court: "BRA-7781", type: "foodtruck", nom: "Food-truck Le Braisé",  xp: 15,  jetons: 0, missions: ["m3"] },
    { code: "QR-EAU-1",    court: "EAU-1001", type: "service",   nom: "Point d'eau Grande Scène",    xp: 10,  jetons: 0, missions: ["m10"] },
    { code: "QR-KORA",     court: "KOR-1150", type: "stand",     nom: "Stand Maison Kora",     xp: 20,  jetons: 1 },
    { code: "QR-FT-YASSA", court: "YAS-6624", type: "foodtruck", nom: "Food-truck Chez Yassa", xp: 15,  jetons: 0, missions: ["m3"] },
    { code: "QR-CACHE-07", court: "CAC-0707", type: "cache",     nom: "QR caché n°7",          xp: 150, jetons: 5, missions: ["m2"],
      badge: { id: "b-fouineur", nom: "Fouineur", texte: "Trouver un QR caché" } },
    { code: "QR-DEDI-AMA", court: "AMA-2026", type: "dedicace",  nom: "Dédicace d'Ama Rise",   xp: 100, jetons: 2, artiste: "a7",
      badge: { id: "b-autographe", nom: "Autographe", texte: "Rencontrer un artiste" } },
    { code: "QR-FEU",      court: "FEU-2345", type: "surprise",  nom: "Feu d'artifice",        xp: 80,  jetons: 3, actifDes: "23:45" }
  ],

  typesQR: {
    scene:     { nom: "Scène",          couleur: "sodium" },
    stand:     { nom: "Stand",          couleur: "bleu" },
    foodtruck: { nom: "Food-truck",     couleur: "vert" },
    cache:     { nom: "QR caché",       couleur: "rose" },
    dedicace:  { nom: "Dédicace",       couleur: "rose" },
    surprise:  { nom: "Événement",      couleur: "nuit" },
    service:   { nom: "Service",        couleur: "papier" }
  },

  bonusBienvenue: { xp: 50, jetons: 5, rang: "Spectateur", premiereMission: "Scanne le QR de la Grande Scène" }
};
