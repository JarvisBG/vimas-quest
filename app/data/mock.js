/* ==========================================================================
   Vimas Quest — données simulées
   Chaque clé correspond à une future route d'API (GET /api/<clé>).
   Les pages n'accèdent JAMAIS directement à MOCK : elles passent par
   App.data.get('<clé>') (voir assets/js/app.js).
   ========================================================================== */
window.MOCK = {
  festival: {
    nom: "VIMAS FEST",
    jeu: "Vimas Quest",
    edition: 1,
    slogan: "Le VIMAS FEST se joue",
    lieu: "Majestic Cinéma",
    dates: "26 et 27 décembre 2026",
    ouverture: "2026-12-26T10:00:00+01:00",
    contactPartenaires: null   // adresse réelle à fournir (étape 7)
  },

  jours: [
    { id: "sam", court: "Sam. 26", long: "Samedi 26 décembre",   date: "2026-12-26" },
    { id: "dim", court: "Dim. 27", long: "Dimanche 27 décembre", date: "2026-12-27" }
  ],

  scenes: [
    { id: "soleil",  nom: "Grande Scène",   couleur: "sodium" },
    { id: "kiosque", nom: "Le Podium Mode", couleur: "bleu" }
  ],

  /* duree en minutes ; bio courte pour la fiche artiste.
     photo : serigraphie deux encres fabriquee par outils/photos.py (3 a 4 Ko).
     Seuls 3 artistes sur 12 en ont une : c'est l'etat normal avant le festival,
     et ca permet de voir aussi la pochette de secours (App.photo).
     Les images demo-artiste-*.webp sont SYNTHETIQUES, pas des photos reelles.
     En base : artistes.photo_url. */
  artistes: [
    { id: "a3",  nom: "Mboa Brass Band",   genre: "Fanfare",   scene: "kiosque",   jour: "sam", debut: "11:00", duree: 60,
      bio: "Onze musiciens qui ouvrent le festival en déambulant entre les stands, sans partition, et finissent toujours au milieu du public." },
    { id: "a2",  nom: "Roots Mbeng",       genre: "Reggae",    scene: "soleil",    jour: "sam", debut: "14:00", duree: 60,
      bio: "Reggae roots chanté en français, en anglais et en langues locales : des basses lourdes et des messages qui font lever les poings." },
    { id: "a5",  nom: "Défilé Wax & Roots", genre: "Mode",     scene: "kiosque",   jour: "sam", debut: "16:00", duree: 45,
      bio: "Les créateurs des stands défilent sur le podium : wax, streetwear et silhouettes inspirées des Caraïbes." },
    { id: "a6",  nom: "Lady Soca",         genre: "Soca",      scene: "soleil",    jour: "sam", debut: "17:30", duree: 60,
      bio: "L'énergie du carnaval de Trinidad en plein Yaoundé : drapeaux, sifflets et chorégraphies reprises par toute la salle." },
    { id: "a4",  nom: "Selecta Yard",      genre: "Dancehall", scene: "kiosque",   jour: "sam", debut: "19:00", duree: 90,
      bio: "Sound system dancehall : dubplates, riddims jamaïcains et afro, pour danser jusqu'à la fermeture." },
    { id: "a1",  nom: "Nova Kassa",        genre: "Afro-pop",  scene: "soleil",    jour: "sam", debut: "20:30", duree: 90, tete: true,
      photo: "assets/photos/demo-artiste-1.webp",
      bio: "Voix solaire et refrains qui restent en tête : Nova Kassa clôture le samedi avec son deuxième album, porté par une section de cuivres." },
    { id: "a12", nom: "Ilé Sound System",  genre: "Dub",       scene: "soleil",    jour: "dim", debut: "12:00", duree: 60,
      bio: "Un mur d'enceintes, des basses profondes et un MC qui fait chanter tout le Majestic dès midi." },
    { id: "a10", nom: "Battle Kompa & Coupé-décalé", genre: "Danse", scene: "kiosque", jour: "dim", debut: "15:00", duree: 60,
      bio: "Duels de danseurs en un contre un, jugés par le public : kompa, coupé-décalé, dancehall et bikutsi." },
    { id: "a8",  nom: "Sœur Vinyle",       genre: "Reggae",    scene: "kiosque",   jour: "dim", debut: "16:30", duree: 90,
      bio: "Uniquement des vinyles : du ska des années 60 au reggae de la semaine, en passant par le dub." },
    { id: "a7",  nom: "Ama Rise",          genre: "Zouk",      scene: "soleil",    jour: "dim", debut: "17:00", duree: 60, tete: true,
      photo: "assets/photos/demo-artiste-2.webp",
      bio: "La révélation zouk de l'année, chantée en trois langues, accompagnée d'un chœur de huit voix." },
    { id: "a11", nom: "Kalé & les Ondes",  genre: "Makossa",   scene: "soleil",    jour: "dim", debut: "18:30", duree: 60,
      bio: "La makossa revisitée avec une kora, des synthés et beaucoup d'énergie." },
    { id: "a9",  nom: "Tanka",             genre: "Rap",       scene: "soleil",    jour: "dim", debut: "20:30", duree: 90, tete: true,
      photo: "assets/photos/demo-artiste-3.webp",
      bio: "Le rappeur clôture le VIMAS FEST avec un show pensé pour l'occasion et quelques invités surprises." }
  ],

  /* Séances de dédicaces (programme, fiches artistes, mission m4) */
  dedicaces: [
    { artiste: "a1", jour: "sam", debut: "18:30", fin: "19:15", lieu: "Tente dédicaces, près du Podium Mode", lieuId: "dedicaces" },
    { artiste: "a7", jour: "dim", debut: "15:30", fin: "16:15", lieu: "Tente dédicaces, près du Podium Mode", lieuId: "dedicaces" },
    { artiste: "a9", jour: "dim", debut: "18:30", fin: "19:15", lieu: "Tente dédicaces, près du Podium Mode", lieuId: "dedicaces" }
  ],

  programmeConfig: { ouverture: "10:00", fermeture: "22:30", pixelsParMinute: 2 },

  /* Temps de marche : calculé depuis les positions des lieux (App.minutesMarche). */
  rappelsParDefaut: { actif: true, avance: 15 },

  /* ---------- Infos pratiques (page 17) ---------- */
  infos: {
    adresse: "Majestic Cinéma, Université de Yaoundé I (Ngoa-Ekellé)",
    horaires: [
      { jour: "sam", portes: "10:00", fin: "22:00" },
      { jour: "dim", portes: "10:00", fin: "22:00" }
    ],
    acces: [
      { icone: "billet", titre: "Navettes gratuites", texte: "Départ toutes les 20 minutes depuis la gare routière centrale, de 9h à 22h30. Montre ton ticket au chauffeur." },
      { icone: "lieu", titre: "Taxis et motos-taxis", texte: "Zone de dépose et de reprise balisée devant l'entrée principale. Ne traverse pas le boulevard hors des passages." },
      { icone: "plan", titre: "Parking", texte: "Parking gardé à 400 m, fléché depuis le rond-point. Places limitées : privilégie les navettes." },
      { icone: "eclair", titre: "Vélos et trottinettes", texte: "Stationnement gratuit et surveillé près de l'entrée nord." }
    ],
    accessibilite: [
      "Plateformes surélevées devant la Grande Scène et le Podium Mode",
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
      email: "bonjour@vimasquest.example",
      delai: "Réponse par e-mail sous 48 h"
    },
    faq: [
      { id: "code-perdu", q: "J'ai perdu mon code secret, comment récupérer ma partie ?", r: "Passe au stand Vimas Quest avec ton pseudo : l'équipe retrouve ton code. Tant que tu joues sur le même téléphone, tu n'as besoin de rien." },
      { id: "qr-illisible", q: "Un QR du site ne se scanne pas.", r: "Essaie avec la lampe du scanner, puis utilise « Saisir un code » : chaque QR a un code court imprimé en dessous (par exemple SOL-4821)." },
      { id: "rescanner", q: "Puis-je scanner le même QR plusieurs fois ?", r: "Chaque QR rapporte des XP une fois par jour. Le lendemain, il redevient actif." },
      { id: "reseau", q: "Le réseau ne passe pas, je perds mes points ?", r: "Non. Tes réponses au blind test sont renvoyées automatiquement, et ta partie est enregistrée dès que le réseau revient." },
      { id: "batterie", q: "Mon téléphone n'a plus de batterie.", r: "Une borne de recharge gratuite t'attend au Stand Vimas Quest (10h à 21h30). Ta partie est sauvegardée : rien n'est perdu." },
      { id: "lots", q: "Jusqu'à quand puis-je retirer mes lots ?", r: "Jusqu'au dimanche 21h30 au Stand Vimas Quest, avec ton bon de retrait et ton billet. Les lots non retirés ne sont pas envoyés par la poste." },
      { id: "mineurs", q: "Les mineurs peuvent-ils jouer ?", r: "Oui, à partir de 12 ans, accompagnés d'un adulte sur le site. Les lots avec de l'alcool ne sont jamais remis aux mineurs." },
      { id: "sortie", q: "Puis-je sortir et revenir ?", r: "Oui, ton bracelet permet de sortir et de revenir autant de fois que tu veux jusqu'à 20h." },
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
        { valeur: "ngoa-ekelle-obili", libelle: "Ngoa-Ekellé / Obili" }, { valeur: "melen-mini-ferme", libelle: "Melen / Mini Ferme" },
        { valeur: "biyem-assi", libelle: "Biyem-Assi" }, { valeur: "mendong-simbock", libelle: "Mendong / Simbock" },
        { valeur: "etoug-ebe", libelle: "Etoug-Ébé" }, { valeur: "mvog-mbi", libelle: "Mvog-Mbi" },
        { valeur: "mvog-ada", libelle: "Mvog-Ada" }, { valeur: "essos", libelle: "Essos" },
        { valeur: "mimboman", libelle: "Mimboman" }, { valeur: "ekounou", libelle: "Ekounou" },
        { valeur: "odza-nkoabang", libelle: "Odza / Nkoabang" }, { valeur: "nsam-efoulan", libelle: "Nsam / Efoulan" },
        { valeur: "bastos", libelle: "Bastos" }, { valeur: "etoudi-olembe", libelle: "Etoudi / Olembé" },
        { valeur: "emana", libelle: "Emana" }, { valeur: "tsinga-nlongkak", libelle: "Tsinga / Nlongkak" },
        { valeur: "mokolo-madagascar", libelle: "Mokolo / Madagascar" }, { valeur: "nkolbisson", libelle: "Nkolbisson" },
        { valeur: "mvan-ahala", libelle: "Mvan / Ahala" }, { valeur: "centre-ville", libelle: "Centre-ville" },
        { valeur: "autre-yaounde", libelle: "Un autre quartier de Yaoundé" }, { valeur: "autre-ville", libelle: "Une autre ville" }] },
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
  coffreConfig: { xpParReponse: 10, soirDebut: "18:00" },

  /* Banque du coffre : copie de supabase/01_reference.sql (micro_questions),
     fabriquée par le même script (supabase/outils/banque_questions.py). Garder les deux identiques. */
  banqueQuestions: [
    {"id": 1, "code": "S1", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu es venu comment aujourd'hui ?", "options": [{"valeur": "a-pied", "libelle": "À pied"}, {"valeur": "moto-taxi", "libelle": "Moto-taxi"}, {"valeur": "taxi", "libelle": "Taxi"}, {"valeur": "voiture-personnelle", "libelle": "Voiture personnelle"}, {"valeur": "bus", "libelle": "Bus"}]},
    {"id": 2, "code": "S2", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu as connu le VIMAS FEST comment ?", "options": [{"valeur": "un-ami-m-en-a-parle", "libelle": "Un ami m'en a parlé"}, {"valeur": "facebook-ou-instagram", "libelle": "Facebook ou Instagram"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "radio-ou-tele", "libelle": "Radio ou télé"}, {"valeur": "une-affiche", "libelle": "Une affiche"}, {"valeur": "autrement", "libelle": "Autrement", "bas": true}]},
    {"id": 3, "code": "S3", "theme": "venue", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "Tu es venu surtout pour…", "options": [{"valeur": "les-concerts", "libelle": "Les concerts"}, {"valeur": "la-mode-et-les-stands", "libelle": "La mode et les stands"}, {"valeur": "la-danse", "libelle": "La danse"}, {"valeur": "accompagner-quelqu-un", "libelle": "Accompagner quelqu'un"}, {"valeur": "tout-le-festival", "libelle": "Tout le festival", "bas": true}]},
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
    {"id": 29, "code": "S31", "theme": "profil", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu vis à Yaoundé depuis…", "options": [{"valeur": "toujours", "libelle": "Toujours"}, {"valeur": "plus-de-5-ans", "libelle": "Plus de 5 ans"}, {"valeur": "moins-de-5-ans", "libelle": "Moins de 5 ans"}, {"valeur": "je-n-y-vis-pas", "libelle": "Je n'y vis pas"}]},
    {"id": 30, "code": "S32", "theme": "profil", "moment": "toujours", "chaqueJour": false, "ordreFixe": false, "type": "choix", "question": "À la maison, tu parles surtout…", "options": [{"valeur": "francais", "libelle": "Français"}, {"valeur": "anglais", "libelle": "Anglais"}, {"valeur": "pidgin", "libelle": "Pidgin"}, {"valeur": "une-langue-locale", "libelle": "Une langue locale"}]},
    {"id": 31, "code": "S33", "theme": "profil", "moment": "toujours", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu as des enfants ?", "options": [{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non", "libelle": "Non"}]},
    {"id": 32, "code": "N1", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "Ta journée, tu la notes comment ?", "options": [{"valeur": "decevante", "libelle": "Décevante"}, {"valeur": "moyenne", "libelle": "Moyenne"}, {"valeur": "bien", "libelle": "Bien"}, {"valeur": "tres-bien", "libelle": "Très bien"}, {"valeur": "inoubliable", "libelle": "Inoubliable"}]},
    {"id": 33, "code": "N2", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "artiste", "question": "Ton concert préféré aujourd'hui ?"},
    {"id": 34, "code": "N3", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": false, "type": "choix", "question": "Ce qui t'a le plus plu aujourd'hui ?", "options": [{"valeur": "la-musique", "libelle": "La musique"}, {"valeur": "l-ambiance", "libelle": "L'ambiance"}, {"valeur": "le-jeu-vimas-quest", "libelle": "Le jeu Vimas Quest"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "l-organisation", "libelle": "L'organisation"}, {"valeur": "les-rencontres", "libelle": "Les rencontres"}]},
    {"id": 35, "code": "N4", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "L'attente à l'entrée ?", "options": [{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]},
    {"id": 36, "code": "N5", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "L'attente au bar ?", "options": [{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]},
    {"id": 37, "code": "N6", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "L'attente aux food-trucks ?", "options": [{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]},
    {"id": 38, "code": "N7", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "Les toilettes ?", "options": [{"valeur": "propres-et-rapides", "libelle": "Propres et rapides"}, {"valeur": "correctes", "libelle": "Correctes"}, {"valeur": "a-revoir", "libelle": "À revoir"}]},
    {"id": 39, "code": "N8", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": true, "type": "choix", "question": "Combien as-tu dépensé aujourd'hui, sans le billet ?", "options": [{"valeur": "rien-du-tout", "libelle": "Rien du tout"}, {"valeur": "moins-de-2-000-fcfa", "libelle": "Moins de 2 000 FCFA"}, {"valeur": "2-000-a-5-000-fcfa", "libelle": "2 000 à 5 000 FCFA"}, {"valeur": "5-000-a-10-000-fcfa", "libelle": "5 000 à 10 000 FCFA"}, {"valeur": "plus-de-10-000-fcfa", "libelle": "Plus de 10 000 FCFA"}]},
    {"id": 40, "code": "N9", "theme": "soir", "moment": "soir", "chaqueJour": true, "ordreFixe": false, "type": "choix", "question": "Ce qu'on doit améliorer en priorité ?", "options": [{"valeur": "plus-de-stands", "libelle": "Plus de stands"}, {"valeur": "moins-d-attente", "libelle": "Moins d'attente"}, {"valeur": "plus-d-activites", "libelle": "Plus d'activités"}, {"valeur": "plus-de-place", "libelle": "Plus de place"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "rien-c-etait-bien", "libelle": "Rien, c'était bien", "bas": true}]},
    {"id": 41, "code": "N10", "theme": "soir", "moment": "soir", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Conseillerais-tu Vimas Quest à un ami ? (0 = pas du tout, 10 = carrément)", "options": [{"valeur": "0", "libelle": "0"}, {"valeur": "1", "libelle": "1"}, {"valeur": "2", "libelle": "2"}, {"valeur": "3", "libelle": "3"}, {"valeur": "4", "libelle": "4"}, {"valeur": "5", "libelle": "5"}, {"valeur": "6", "libelle": "6"}, {"valeur": "7", "libelle": "7"}, {"valeur": "8", "libelle": "8"}, {"valeur": "9", "libelle": "9"}, {"valeur": "10", "libelle": "10"}]},
    {"id": 42, "code": "N11", "theme": "soir", "moment": "soir", "chaqueJour": false, "ordreFixe": true, "type": "choix", "question": "Tu reviendras au VIMAS FEST l'an prochain ?", "options": [{"valeur": "oui-sur", "libelle": "Oui, sûr"}, {"valeur": "peut-etre", "libelle": "Peut-être"}, {"valeur": "non", "libelle": "Non"}]}
  ],


  /* ---------- Plan (page 7) ----------
     Coordonnées dans le dessin (1000 × 700, nord en haut). 1 unité = 0,20 m. */
  planConfig: {
    metresParUnite: 0.2,     // = App.planFond.metresParUnite (outils/plan/fond_plan.py)
    metresParMinute: 60,     // marche dans la foule
    telephoneSecurite: "0800000000",   // FICTIF : à remplacer par le numéro réel de la sécurité du festival
    libelleTelephone: "Sécurité du festival (numéro de démo)",
    // Emprise du plan (Majestic Cinéma, Université de Yaoundé I), pour placer le joueur grâce au GPS
    // = App.planFond.geo : si le fond est régénéré, recopier ici
    geo: { nord: 3.859844, sud: 3.858578, ouest: 11.495707, est: 11.497508 }
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
  /* Lieux de DÉMO placés sur le vrai fond (Majestic Cinéma, assets/js/plan-fond.js,
     1 unité = 0,20 m). Enceinte du Majestic : x 300 → 700, y 77 → 623 (écran et bâtiments
     à l'ouest, parking à l'est) ; l'axe principal du campus longe l'enceinte au sud-ouest.
     1re édition : tout tient dans l'enceinte (2 scènes, quelques stands). Les vrais
     emplacements viendront de Vimas Production (table lieux, colonnes x / y). */
  lieux: [
    { id: "soleil",  cat: "scene", nom: "Grande Scène",   x: 437, y: 252, pmr: true, desc: "Devant l'écran du Majestic : concerts et écran géant. Plateforme PMR à droite de la régie." },
    { id: "kiosque", cat: "scene", nom: "Le Podium Mode", x: 584, y: 413, pmr: true, desc: "Podium des défilés, des battles de danse et des sets dancehall, sur le parking du Majestic." },

    { id: "st-radio",     cat: "stand", nom: "Radio Écho",        x: 654, y: 322, desc: "Studio en direct et interviews d'artistes." },
    { id: "st-kora",      cat: "stand", nom: "Maison Kora",       x: 528, y: 518, desc: "Créateurs de mode et artisans." },
    { id: "st-brasserie", cat: "stand", nom: "Buvette du Majestic", x: 640, y: 497, desc: "Le bar du festival." },
    { id: "st-quest",     cat: "stand", nom: "Stand Vimas Quest", x: 605, y: 574, horaires: "10h à 21h30", desc: "Accueil du jeu, retrait des lots, recharge de téléphone, objets trouvés. Juste après l'entrée." },

    { id: "st-yassa",  cat: "food", nom: "Chez Yassa", x: 507, y: 161, desc: "Grillades et plats locaux, au nord de l'enceinte." },
    { id: "st-braise", cat: "food", nom: "Le Braisé",  x: 563, y: 119, desc: "Soya et braisés, au nord de l'enceinte." },

    { id: "eau-1", cat: "eau", nom: "Point d'eau Grande Scène", x: 381, y: 203, desc: "Eau potable gratuite, derrière la Grande Scène." },
    { id: "eau-2", cat: "eau", nom: "Point d'eau Podium",       x: 654, y: 420, desc: "Eau potable gratuite." },

    { id: "wc-1", cat: "toilettes", nom: "Toilettes Nord",     x: 612, y: 196, pmr: true },
    { id: "wc-2", cat: "toilettes", nom: "Toilettes Majestic", x: 381, y: 406, pmr: true },

    { id: "secours-1", cat: "secours", nom: "Poste de secours", x: 507, y: 343, horaires: "Ouvert en continu", desc: "Secouristes et point d'écoute, entre la Grande Scène et le Podium. Signalé par un drapeau rouge." },
    { id: "abri-2",    cat: "abri",    nom: "Hall du Majestic", x: 385, y: 308, desc: "Le hall du Majestic sert d'abri en cas d'averse." },
    { id: "dedicaces", cat: "service", nom: "Tente dédicaces",  x: 654, y: 371, desc: "Séances de dédicaces des artistes, près du Podium Mode. Voir le programme." },

    { id: "entree-principale", cat: "entree", nom: "Entrée", x: 682, y: 665, desc: "Sur l'axe principal du campus. Contrôle des tickets et bracelets." }
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
    { id: "lot-pass",      nom: "Pass 2 jours, 2e édition",   rarete: "legendaire", stock: 0,   icone: "billet" }
  ],

  blindTest: {
    horaire: "17:00", lieu: "Écran géant, Grande Scène", questions: 15,
    lienJeu: "https://vimasquest.example/blind",
    durees: { intro: 4, question: 20, revelation: 9, classement: 10, fin: 90 }, // secondes
    classementToutesLes: 5
  },

  /* Questions du blind test (page 30). Les extraits sont synthétisés en démo :
     motif = notes MIDI, onde = timbre, tempo = BPM. En production : fichiers audio sous licence.
     La bonne réponse ne doit jamais être envoyée aux téléphones avant la révélation. */
  blindQuestions: [
    { categorie: "Artiste",    question: "Qui joue ce morceau ?",                         choix: ["Nova Kassa", "Ama Rise", "Tanka", "Lady Soca"],                                 bonne: 0, reponse: "Nova Kassa, « Lumière du lac »",           anecdote: "Écrit en une nuit sur la rive du lac.",                motif: [64, 67, 69, 67, 64, 62, 60, 62], onde: "triangle", tempo: 112 },
    { categorie: "Instrument", question: "Quel instrument ouvre ce morceau ?",            choix: ["Balafon", "Kora", "Saxophone", "Guitare électrique"],                         bonne: 1, reponse: "Kalé & les Ondes, « Rive gauche »",        anecdote: "La kora compte ici 21 cordes.",                         motif: [69, 72, 76, 72, 69, 67, 69, 64], onde: "sine",     tempo: 96 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                    choix: ["Makossa", "Dub", "Zouk", "Soca"],                                             bonne: 1, reponse: "Ilé Sound System, « Basse fréquence »",    anecdote: "Enregistré avec un seul micro.",                        motif: [45, 45, 52, 45, 48, 45, 43, 45], onde: "square",   tempo: 74 },
    { categorie: "Année",      question: "En quelle année est sorti ce titre ?",         choix: ["2009", "2014", "2019", "2023"],                                               bonne: 2, reponse: "Roots Mbeng, « Jah au marché »",           anecdote: "Leur premier disque, pressé à 300 exemplaires.",       motif: [62, 65, 69, 72, 71, 67, 64, 62], onde: "sine",     tempo: 88 },
    { categorie: "Artiste",    question: "Quel groupe de l'affiche joue ici ?",          choix: ["Roots Mbeng", "Lady Soca", "Mboa Brass Band", "Selecta Yard"],                bonne: 2, reponse: "Mboa Brass Band, « Grand défilé »",        anecdote: "Onze musiciens, zéro partition.",                       motif: [60, 64, 67, 72, 67, 64, 65, 67], onde: "sawtooth", tempo: 126 },
    { categorie: "Instrument", question: "Quel instrument tient la mélodie ?",           choix: ["Trompette", "Violon", "Flûte", "Synthétiseur"],                               bonne: 3, reponse: "Selecta Yard, « Riddim maison »",          anecdote: "Le riddim a été composé sur un synthé fait maison.",   motif: [72, 74, 76, 79, 76, 74, 72, 67], onde: "square",   tempo: 128 },
    { categorie: "Horaire",    question: "À quelle heure joue cette artiste samedi ?",   choix: ["14h00", "16h00", "17h30", "20h30"],                                        bonne: 2, reponse: "Lady Soca, « Carnaval »",                  anecdote: "Rendez-vous samedi à 17h30 sur la Grande Scène.",   motif: [57, 60, 64, 63, 60, 57, 55, 57], onde: "sawtooth", tempo: 100 },
    { categorie: "Tempo",      question: "Ce morceau est plutôt…",                       choix: ["Très lent", "Modéré", "Rapide", "Très rapide"],                               bonne: 2, reponse: "Tanka, « Pas de côté »",                   anecdote: "140 battements par minute.",                            motif: [67, 67, 70, 67, 65, 63, 65, 67], onde: "triangle", tempo: 140 },
    { categorie: "Artiste",    question: "Qui joue ce morceau ?",                         choix: ["Sœur Vinyle", "Selecta Yard", "Roots Mbeng", "Kalé & les Ondes"],             bonne: 2, reponse: "Roots Mbeng, « Rue des Palmiers »",        anecdote: "Chanté en trois langues sur le même refrain.",          motif: [64, 68, 71, 76, 75, 71, 68, 64], onde: "triangle", tempo: 118 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                    choix: ["Zouk", "Reggae", "Fanfare", "Dancehall"],                                     bonne: 0, reponse: "Ama Rise, « Encore une fois »",            anecdote: "Un chœur de huit voix sur le refrain.",                 motif: [60, 63, 67, 70, 68, 67, 63, 60], onde: "sine",     tempo: 80 },
    { categorie: "Instrument", question: "Quelle percussion entend-on ?",                choix: ["Batterie", "Cajón", "Djembé", "Tambour d'eau"],                               bonne: 2, reponse: "Kalé & les Ondes, « Pluie »",              anecdote: "Le djembé vient d'un atelier de Bafoussam.",            motif: [48, 48, 55, 48, 51, 48, 46, 48], onde: "square",   tempo: 104 },
    { categorie: "Année",      question: "En quelle année est sorti ce titre ?",         choix: ["1998", "2004", "2011", "2021"],                                               bonne: 1, reponse: "Sœur Vinyle, « Ska du samedi »",           anecdote: "Un 45 tours retrouvé chez un disquaire de Mokolo.",     motif: [62, 66, 69, 74, 73, 69, 66, 62], onde: "sawtooth", tempo: 122 },
    { categorie: "Artiste",    question: "Quel groupe de l'affiche joue ici ?",          choix: ["Tanka", "Roots Mbeng", "Selecta Yard", "Kalé & les Ondes"],                   bonne: 3, reponse: "Kalé & les Ondes, « Coupure de courant »", anecdote: "Joué pour la première fois en 2023.",                   motif: [59, 62, 66, 71, 69, 66, 64, 62], onde: "sawtooth", tempo: 132 },
    { categorie: "Style",      question: "De quel style s'agit-il ?",                    choix: ["Soca", "Dub", "Afro-pop", "Kompa"],                                           bonne: 0, reponse: "Lady Soca, « Drapeaux »",                  anecdote: "Écrit pour le carnaval de Port of Spain.",              motif: [65, 69, 72, 75, 74, 72, 69, 65], onde: "sine",     tempo: 116 },
    { categorie: "Finale",     question: "Qui clôture le festival dimanche ?",           choix: ["Tanka", "Nova Kassa", "Ama Rise", "Roots Mbeng"],                              bonne: 0, reponse: "Tanka, « Dernier tour »",                  anecdote: "Rendez-vous dimanche à 20h30, Grande Scène.",           motif: [67, 71, 74, 79, 78, 74, 71, 67], onde: "triangle", tempo: 124 }
  ],

  quizDemo: {
    question: "Quel instrument ouvre ce morceau\u00A0?",
    choix: ["Balafon", "Kora", "Saxophone", "Guitare électrique"],
    bonne: 1
  },

  /* Partenaires du festival : section de l'accueil masquée tant que la liste est vide
     (décision du 18/09 : les noms de démo étaient inventés). { nom, role } */
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
    "Des QR codes cachés entre les stands",
    "Blind test géant à 17h sur la Grande Scène",
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

  pseudosPris: ["basseprofonde", "nova", "dj", "groupie", "vimasquest", "vimas", "vimasfest", "admin", "staff"],

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
    { id: "m1",  titre: "Tournée des scènes",    categorie: "musique",     action: "scanner",    objectif: 2,  xp: 150, jetons: 3,
      texte: "Assiste à un concert sur chacune des 2 scènes et scanne leur QR." },
    { id: "m2",  titre: "La relique",            categorie: "exploration", action: "scanner",    objectif: 1,  xp: 200, jetons: 5, lieu: "soleil",
      texte: "Une relique est cachée près de la Grande Scène. À toi de la trouver." },
    { id: "m3",  titre: "Gourmet du festival",   categorie: "gourmand",    action: "scanner",    objectif: 2,  xp: 80,  jetons: 2,
      texte: "Scanne le QR des 2 food-trucks du festival." },
    { id: "m4",  titre: "Chasseur de dédicaces", categorie: "musique",     action: "staff",      objectif: 1,  xp: 250, jetons: 5, lieu: "kiosque",
      texte: "Passe à la séance de dédicaces et fais valider ta mission par l'équipe sur place." },
    { id: "m5",  titre: "Première note",         categorie: "exploration", action: "scanner",    objectif: 1,  xp: 30,  jetons: 1, lieu: "soleil",
      texte: "Scanne le QR de la Grande Scène." },
    { id: "m6",  titre: "Défi éclair : le Podium", categorie: "defi",      action: "scanner",    objectif: 1,  xp: 120, jetons: 4, lieu: "kiosque",
      texte: "Scanne le QR du Podium Mode avant 18h.", jour: "sam", finHeure: "18:00" },
    { id: "m7",  titre: "Oreille absolue",       categorie: "musique",     action: "blind-test", objectif: 10, xp: 300, jetons: 8, rangMin: "Groupie",
      texte: "Donne 10 bonnes réponses au blind test géant." },
    { id: "m8",  titre: "Jury du festival",      categorie: "social",      action: "votes",      objectif: 3,  xp: 60,  jetons: 2,
      texte: "Vote pour 3 stands dans les Coups de cœur." },
    { id: "m9",  titre: "Échauffement",          categorie: "defi",        action: "staff",      objectif: 1,  xp: 100, jetons: 2, lieu: "kiosque",
      texte: "Danse devant le Podium Mode et fais valider par un bénévole en gilet jaune." },
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
  roiVeille: { pseudo: "Kora_77", points: 1240, jour: "samedi" },

  /* Progression simulée d'un joueur. Futur : GET /api/joueurs/moi/carte */
  etatsJoueur: {
    confirme: {
      classement: { general: 412, jour: 87, total: 18400 },
      jour: { scans: 7, xp: 320 },
      favoris: ["a1", "a6", "a7", "a12", "a11", "a9"],
      progression: { m1: 1, m3: 1, m2: 0, m4: 0, m5: 1, m9: 1, m8: 1, m10: 0 },
      terminees: { m5: { heure: "11:02" }, m9: { heure: "15:15", par: "Awa, équipe Vimas Quest" } },
      collection: {
        badges: {
          "b-premiere-note": { jour: "2026-12-26", heure: "11:02" },
          "b-leve-tot":      { jour: "2026-12-26", heure: "10:40" },
          "b-noctambule":    { jour: "2026-12-26", heure: "20:48" },
          "b-curieux":       { jour: "2026-12-26", heure: "16:15" },
          "b-echauffement":  { jour: "2026-12-26", heure: "15:15" },
          "b-oreille-or":    { jour: "2026-12-26", heure: "17:20" }
        },
        artistes: {
          a3: { jour: "2026-12-26", heure: "11:10" },
          a2: { jour: "2026-12-26", heure: "14:30" },
          a5: { jour: "2026-12-26", heure: "16:12" },
          a1: { jour: "2026-12-26", heure: "18:40", dedicace: true },
          a4: { jour: "2026-12-26", heure: "19:48" }
        },
        stands: {
          "st-kora":      { jour: "2026-12-26", heure: "14:12" },
          "st-radio":     { jour: "2026-12-26", heure: "12:20" },
          "st-brasserie": { jour: "2026-12-26", heure: "13:45" },
          "st-braise":    { jour: "2026-12-26", heure: "13:48" },
          "st-quest":     { jour: "2026-12-26", heure: "10:40" }
        },
        reliques: {
          "QR-REL-02": { jour: "2026-12-26", heure: "15:05" }
        }
      },
      activite: [
        { heure: "14:12", type: "scan",    texte: "Stand Maison Kora",                    xp: 20 },
        { heure: "13:48", type: "mission", texte: "Gourmet du festival, 1 sur 2",         xp: 20 },
        { heure: "12:40", type: "scan",    texte: "Grande Scène",                         xp: 30 },
        { heure: "12:05", type: "scan",    texte: "Stand Radio Écho",                     xp: 20 }
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
    { id: "n1", niveau: "important", type: "meteo", jour: "sam", heure: "15:55", fin: "18:00",
      titre: "Averse possible vers 18h", texte: "En cas de pluie, le hall du Majestic sert d'abri. Suis les consignes des bénévoles.",
      lien: { href: "plan.html?lieu=abri-2", libelle: "Voir l'abri" }, lu: false },
    { id: "n5", niveau: "important", type: "jeu", jour: "sam", heure: "16:00", fin: "17:00",
      titre: "Blind test géant à 17h", texte: "Rendez-vous devant l'écran de la Grande Scène : 15 questions, des jetons pour le top 10.",
      lien: { href: "blind-test.html", libelle: "Préparer mon téléphone" }, lu: false },
    { id: "n4", niveau: "important", type: "horaire", jour: "sam", heure: "16:10", fin: "19:15",
      titre: "Dédicaces de Nova Kassa à 18h30", texte: "La séance a lieu à la tente dédicaces, près du Podium Mode. Arrive 15 minutes avant.",
      lien: { href: "plan.html?lieu=dedicaces", libelle: "Y aller" }, lu: true },
    { id: "n2", niveau: "info", type: "surprise", jour: "sam", heure: "15:30", fin: "17:05",
      titre: "Défilé prolongé sur le Podium", texte: "Les créateurs des stands refont un passage de 15 minutes à 16h45.",
      lien: { href: "plan.html?lieu=kiosque", libelle: "Voir le Podium Mode" }, lu: false },
    { id: "n3", niveau: "info", type: "pratique", jour: "sam", heure: "11:10",
      titre: "Nouveau point d'eau", texte: "Un point d'eau gratuit est ouvert derrière la Grande Scène.",
      lien: { href: "plan.html?lieu=eau-1", libelle: "Voir sur le plan" }, lu: true },
    { id: "n6", niveau: "info", type: "pratique", jour: "sam", heure: "10:30", fin: "22:30",
      titre: "Navette supplémentaire à 22h30", texte: "Une dernière navette part vers la gare routière à 22h30, les deux soirs.", lu: true },
    { id: "n7", niveau: "important", type: "surprise", jour: "sam", heure: "13:00", fin: "20:00",
      titre: "La relique n°7 est de retour", texte: "Cherche du côté de la Grande Scène…", lu: true }
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
      horaires: "Samedi et dimanche de 10h à 21h30",
      limite: { jour: "dim", heure: "21:30" }
    }
  },
  /* Bons déjà obtenus par le joueur de démo */
  bonsDeBase: {
    j1: [
      { code: "BON-7Q2K-41", lot: "lot-boisson",   statut: "retire",    creeLe: { jour: "2026-12-26", heure: "15:02" }, retireLe: { jour: "2026-12-26", heure: "15:10" }, par: "Awa" },
      { code: "BON-3M8D-17", lot: "lot-casquette", statut: "a-retirer", creeLe: { jour: "2026-12-26", heure: "14:40" } }
    ]
  },

  /* ---------- Collection (page 9) ----------
     forme : rond | etoile | hexa | ecusson ; secret : nom caché tant que non obtenu ;
     pctJoueurs : part des joueurs qui possèdent le badge (calculée par le serveur) */
  badges: [
    { id: "b-premiere-note", nom: "Première note",  texte: "Scanner ton premier QR de scène.",                 rarete: "commun",     forme: "rond",    icone: "onde",     pctJoueurs: 91, lien: "scanner.html" },
    { id: "b-leve-tot",      nom: "Lève-tôt",       texte: "Scanner un QR avant midi.",                         rarete: "commun",     forme: "hexa",    icone: "horloge",  pctJoueurs: 44, lien: "scanner.html" },
    { id: "b-curieux",       nom: "Curieux",        texte: "Scanner 3 stands différents.",                     rarete: "commun",     forme: "rond",    icone: "plan",     pctJoueurs: 38, lien: "plan.html" },
    { id: "b-echauffement",  nom: "Échauffement",   texte: "Réussir la mission Échauffement.",                 rarete: "commun",     forme: "hexa",    icone: "eclair",   pctJoueurs: 27, lien: "missions.html#m9" },
    { id: "b-gourmet",       nom: "Gourmet",        texte: "Terminer la mission Gourmet du festival.",         rarete: "rare",       forme: "rond",    icone: "couverts", pctJoueurs: 22, lien: "missions.html#m3" },
    { id: "b-tournee",       nom: "En tournée",     texte: "Terminer la mission Tournée des scènes.",          rarete: "rare",       forme: "etoile",  icone: "micro",    pctJoueurs: 19, lien: "missions.html#m1" },
    { id: "b-noctambule",    nom: "Jusqu'au bout",  texte: "Scanner une scène pendant un concert après 20h.", rarete: "rare",     forme: "ecusson", icone: "etoile",   pctJoueurs: 17, lien: "programme.html" },
    { id: "b-jury",          nom: "Jury",           texte: "Voter pour 3 stands dans les Coups de cœur.",      rarete: "commun",     forme: "ecusson", icone: "coeur",    pctJoueurs: 31, lien: "coups-de-coeur.html" },
    { id: "b-fouineur",      nom: "Fouineur",       texte: "Trouver une relique.",                            rarete: "epique",     forme: "etoile",  icone: "cible",    pctJoueurs: 9,  lien: "collection.html" },
    { id: "b-autographe",    nom: "Autographe",     texte: "Rencontrer un artiste en séance de dédicaces.",    rarete: "epique",     forme: "ecusson", icone: "etoile",   pctJoueurs: 7,  lien: "missions.html#m4" },
    { id: "b-oreille-or",    nom: "Oreille d'or",   texte: "Finir dans le top 10 d'une manche du blind test.", rarete: "epique",     forme: "etoile",  icone: "micro",    pctJoueurs: 5,  lien: "blind-test.html" },
    { id: "b-marathon",      nom: "Marathonien",    texte: "Scanner au moins un QR les deux jours.",       rarete: "rare",       forme: "hexa",    icone: "calendrier", pctJoueurs: 12, lien: "scanner.html" },
    { id: "b-podium",        nom: "Podium",         texte: "Finir une journée dans le top 3 du classement.",   rarete: "legendaire", forme: "etoile",  icone: "trophee",  pctJoueurs: 1,  lien: "classement.html" },
    { id: "b-secret-1",      nom: "Sous le soleil", texte: "Être là au bon moment, au bon endroit.",         rarete: "legendaire", forme: "rond",    icone: "etoile",   pctJoueurs: 2,  secret: true },
    { id: "b-secret-2",      nom: "Backstage",      texte: "Quelqu'un en coulisses détient la clé.",           rarete: "epique",     forme: "ecusson", icone: "cadenas",  pctJoueurs: 3,  secret: true }
  ],

  raretes: {
    commun:     { nom: "Commun" },
    rare:       { nom: "Rare" },
    epique:     { nom: "Épique" },
    legendaire: { nom: "Légendaire" }
  },

  stands: [
    { id: "st-kora",      nom: "Maison Kora",        type: "stand",     qr: "QR-KORA",      zone: "Près du Podium" },
    { id: "st-radio",     nom: "Radio Écho",         type: "stand",     qr: "QR-RADIO",     zone: "Près du Podium" },
    { id: "st-brasserie", nom: "Buvette du Majestic", type: "stand",     qr: "QR-BRASS",     zone: "Le bar" },
    { id: "st-quest",     nom: "Stand Vimas Quest",  type: "stand",     qr: "QR-RSN",       zone: "Entrée" },
    { id: "st-yassa",     nom: "Chez Yassa",         type: "foodtruck", qr: "QR-FT-YASSA",  zone: "Nord de l'enceinte" },
    { id: "st-braise",    nom: "Le Braisé",          type: "foodtruck", qr: "QR-FT-BRAISE", zone: "Nord de l'enceinte" }
  ],

  /* ---------- Coups de cœur (page 13) ----------
     Règles : 3 cœurs par catégorie pour tout le festival, modifiables jusqu'à la clôture.
     Un artiste est votable dès que son concert a commencé ; un stand, une fois scanné. */
  votesConfig: {
    coeurs: 3,
    cloture: { jour: "dim", heure: "20:00" },
    resultats: "Dimanche à 20h15 sur l'écran géant de la Grande Scène"
  },
  /* Totaux simulés des autres festivaliers (futur : GET /api/votes/tendances) */
  votesTendances: {
    artistes: { a1: 2140, a2: 980, a3: 1260, a4: 1710, a5: 1490, a6: 620, a7: 1980, a8: 540, a9: 0, a10: 0, a11: 0, a12: 0 },
    stands: { "st-kora": 860, "st-radio": 410, "st-brasserie": 1120, "st-quest": 690, "st-yassa": 1340, "st-braise": 980 }
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
     Contenu d'un QR imprimé : https://vimasquest.example/q/<code>
     Le code court (sous le QR) permet la saisie manuelle.
     Futur : POST /api/scans { code } — la liste complète ne sera jamais envoyée au téléphone. */
  qrcodes: [
    { code: "QR-SOLEIL",   court: "SOL-4821", type: "scene",     nom: "Grande Scène",          xp: 30,  jetons: 1, lieu: "soleil",    missions: ["m5", "m1"] },
    { code: "QR-PODIUM",   court: "POD-3307", type: "scene",     nom: "Le Podium Mode",        xp: 30,  jetons: 1, lieu: "kiosque",   missions: ["m1", "m6"] },
    { code: "QR-RADIO",    court: "RAD-5510", type: "stand",     nom: "Stand Radio Écho",      xp: 20,  jetons: 1 },
    { code: "QR-FT-BRAISE", court: "BRA-7781", type: "foodtruck", nom: "Food-truck Le Braisé",  xp: 15,  jetons: 0, missions: ["m3"] },
    { code: "QR-EAU-1",    court: "EAU-1001", type: "service",   nom: "Point d'eau Grande Scène", xp: 10,  jetons: 0, missions: ["m10"] },
    { code: "QR-KORA",     court: "KOR-1150", type: "stand",     nom: "Stand Maison Kora",     xp: 20,  jetons: 1 },
    { code: "QR-FT-YASSA", court: "YAS-6624", type: "foodtruck", nom: "Food-truck Chez Yassa", xp: 15,  jetons: 0, missions: ["m3"] },
    { code: "QR-CACHE-07", court: "CAC-0707", type: "relique",   nom: "Le vinyle d'or",        xp: 150, jetons: 5, missions: ["m2"],
      rarete: "rare", indice: "Là où la musique se mixe, à l'abri des regards.",
      badge: { id: "b-fouineur", nom: "Fouineur", texte: "Trouver une relique" } },
    { code: "QR-REL-02",   court: "REL-0202", type: "relique",   nom: "La baguette du chef",   xp: 75,  jetons: 2,
      rarete: "commune", indice: "Elle attend près de ceux qui nourrissent le festival." },
    { code: "QR-REL-03",   court: "REL-0303", type: "relique",   nom: "La première bobine",    xp: 300, jetons: 8,
      rarete: "legendaire", indice: "Le Majestic l'a projetée avant toi, tout en haut des marches." },
    { code: "QR-DEDI-AMA", court: "AMA-2026", type: "dedicace",  nom: "Dédicace d'Ama Rise",   xp: 100, jetons: 2, artiste: "a7",
      badge: { id: "b-autographe", nom: "Autographe", texte: "Rencontrer un artiste" } },
    { code: "QR-FEU",      court: "FEU-2345", type: "surprise",  nom: "Parade de clôture",     xp: 80,  jetons: 3, actifDes: "21:45" }
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
  bonusBienvenue: { xp: 0, jetons: 0, rang: "Spectateur", premiereMission: "Scanne le QR de la Grande Scène" }
};
