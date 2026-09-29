-- ============================================================================
-- Vimas Quest — 01_reference.sql
-- ----------------------------------------------------------------------------
-- Données de départ, à coller APRÈS 00_schema.sql dans un projet neuf.
-- Rejouable sans risque : chaque insertion ignore ce qui existe déjà.
--
-- Contenu : les réglages (une ligne par table de configuration), le catalogue
-- des badges DOMAF et la banque de questions du coffre (après chaque scan).
-- PAS de contenu de festival ici (QR, missions, lots, blind tests) : il arrive
-- à l'étape 7, quand le programme et les stands seront connus.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Réglages
-- ----------------------------------------------------------------------------
insert into public.game_state (id, phase, roulette_cost)
values (1, 'EXPLORATION', 30)
on conflict (id) do nothing;

-- Billetterie : COUPÉE au départ, pour que les essais ne demandent pas de
-- ticket. À rallumer depuis la console avant l'ouverture, une fois le prix
-- de la journée fixé avec les organisateurs (500 FCFA = valeur d'Otaku).
insert into public.billetterie_config (id, prix_journee, actif, message)
values (1, 500, false,
        'Le jeu Vimas Quest se joue avec un ticket. Demande-le à un membre de l''équipe, il en a sur lui.')
on conflict (id) do nothing;

insert into public.coeur_config   (id) values (1) on conflict (id) do nothing;
insert into public.contact_config (id) values (1) on conflict (id) do nothing;
insert into public.micro_config   (id) values (1) on conflict (id) do nothing;
insert into public.profil_config  (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Badges (catalogue des visuels DOMAF)
-- ----------------------------------------------------------------------------
-- `icon` = nom d'icône du sprite des pages DOMAF (assets/js/app.js), et non
-- plus une classe Font Awesome : la console d'administration sera adaptée à
-- l'étape 6.
-- Badges « système », attribués AUTOMATIQUEMENT et protégés par
-- _is_system_badge (ni renommables, ni supprimables) : Première note,
-- Curieux, Fouineur, Autographe, Lève-tôt, Jusqu'au bout, Marathonien
-- (scan_qr), Jury (coeur_donner), Oreille d'or (admin_quiz_end), Podium
-- (clôture de la journée, admin_set_phase). Les autres se gagnent par une
-- mission ou un QR liés, ou sont remis par l'équipe (console, étape 6.3).
-- rarete / forme / secret / lien : ce que la page Collection affiche (étape 4.5).
insert into public.badges (name, icon, description, rarete, forme, secret, lien) values
  ('Première note',    'onde',       'Scanner ton tout premier QR.',                         'commun',     'rond',    false, 'scanner.html'),
  ('Curieux',          'plan',       'Scanner 3 stands différents.',                         'commun',     'rond',    false, 'plan.html'),
  ('Fouineur',         'cible',      'Trouver une relique.',                                 'epique',     'etoile',  false, 'collection.html'),
  ('Autographe',       'etoile',     'Rencontrer un artiste en séance de dédicaces.',        'epique',     'ecusson', false, 'programme.html'),
  ('Lève-tôt',         'horloge',    'Scanner un QR avant midi.',                            'commun',     'hexa',    false, 'scanner.html'),
  ('Échauffement',     'eclair',     'Réussir la mission Échauffement.',                     'commun',     'hexa',    false, 'missions.html'),
  ('Gourmet',          'couverts',   'Terminer la mission Gourmet du festival.',             'rare',       'rond',    false, 'missions.html'),
  ('En tournée',       'micro',      'Terminer la mission Tournée des scènes.',              'rare',       'etoile',  false, 'missions.html'),
  ('Jusqu''au bout',   'etoile',     'Scanner une scène pendant un concert après 20h.',      'rare',       'ecusson', false, 'programme.html'),
  ('Jury',             'coeur',      'Voter pour 3 stands dans les Coups de cœur.',          'commun',     'ecusson', false, 'coups-de-coeur.html'),
  ('Oreille d''or',    'micro',      'Finir dans le top 10 d''une manche du blind test.',    'epique',     'etoile',  false, 'blind-test.html'),
  ('Marathonien',      'calendrier', 'Scanner au moins un QR les deux jours.',               'rare',       'hexa',    false, 'scanner.html'),
  ('Podium',           'trophee',    'Finir une journée dans le top 3 du classement.',       'legendaire', 'etoile',  false, 'classement.html'),
  ('Sous le soleil',   'etoile',     'Être là au bon moment, au bon endroit.',               'legendaire', 'rond',    true,  null),
  ('Backstage',        'cadenas',    'Quelqu''un en coulisses détient la clé.',              'epique',     'ecusson', true,  null)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Banque de questions du coffre (étape 6.3 bis, QUESTIONS-VIMAS.md)
-- ----------------------------------------------------------------------------
-- Posées une par une après un scan réussi : l'XP du scan attend la réponse.
-- Réponses en listes fermées : le joueur ne tape rien. Les valeurs ne
-- doivent plus changer une fois le festival commencé (les réponses y renvoient).
-- moment = soir : après micro_config.soir_debut (18 h, festival de jour) ; chaque_jour : reposée
-- chaque journée de jeu ; ordre_fixe : échelles, jamais mélangées ; « bas » :
-- reste en bas quand l'ordre est mélangé. N2 : les artistes du jour.
-- Fabriqué par supabase/outils/banque_questions.py (même source que mock.js).
insert into public.micro_questions (id, ordre, code, theme, moment, chaque_jour, ordre_fixe, type, question, options) values
 (1, 1, 'S1', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu comment aujourd''hui ?',
  '[{"valeur": "a-pied", "libelle": "À pied"}, {"valeur": "moto-taxi", "libelle": "Moto-taxi"}, {"valeur": "taxi", "libelle": "Taxi"}, {"valeur": "voiture-personnelle", "libelle": "Voiture personnelle"}, {"valeur": "bus", "libelle": "Bus"}]'::jsonb),
 (2, 2, 'S2', 'venue', 'toujours', false, false, 'choix',
  'Tu as connu le VIMAS FEST comment ?',
  '[{"valeur": "un-ami-m-en-a-parle", "libelle": "Un ami m''en a parlé"}, {"valeur": "facebook-ou-instagram", "libelle": "Facebook ou Instagram"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "radio-ou-tele", "libelle": "Radio ou télé"}, {"valeur": "une-affiche", "libelle": "Une affiche"}, {"valeur": "autrement", "libelle": "Autrement", "bas": true}]'::jsonb),
 (3, 3, 'S3', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu surtout pour…',
  '[{"valeur": "les-concerts", "libelle": "Les concerts"}, {"valeur": "la-mode-et-les-stands", "libelle": "La mode et les stands"}, {"valeur": "la-danse", "libelle": "La danse"}, {"valeur": "accompagner-quelqu-un", "libelle": "Accompagner quelqu''un"}, {"valeur": "tout-le-festival", "libelle": "Tout le festival", "bas": true}]'::jsonb),
 (4, 4, 'S4', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu avec qui ?',
  '[{"valeur": "seul", "libelle": "Seul"}, {"valeur": "avec-des-amis", "libelle": "Avec des amis"}, {"valeur": "en-couple", "libelle": "En couple"}, {"valeur": "en-famille", "libelle": "En famille"}, {"valeur": "avec-des-collegues", "libelle": "Avec des collègues"}]'::jsonb),
 (5, 5, 'S6', 'venue', 'toujours', false, false, 'choix',
  'Tu écoutes ta musique surtout où ?',
  '[{"valeur": "sur-une-appli-de-streami", "libelle": "Sur une appli de streaming"}, {"valeur": "sur-youtube", "libelle": "Sur YouTube"}, {"valeur": "sur-tiktok", "libelle": "Sur TikTok"}, {"valeur": "a-la-radio", "libelle": "À la radio"}, {"valeur": "en-concert-surtout", "libelle": "En concert, surtout"}]'::jsonb),
 (6, 6, 'S7', 'ecoute', 'toujours', false, false, 'choix',
  'Ton appli de musique principale ?',
  '[{"valeur": "boomplay", "libelle": "Boomplay"}, {"valeur": "audiomack", "libelle": "Audiomack"}, {"valeur": "spotify", "libelle": "Spotify"}, {"valeur": "youtube-music", "libelle": "YouTube Music"}, {"valeur": "apple-music", "libelle": "Apple Music"}, {"valeur": "deezer", "libelle": "Deezer"}, {"valeur": "aucune", "libelle": "Aucune", "bas": true}]'::jsonb),
 (7, 7, 'S8', 'ecoute', 'toujours', false, true, 'choix',
  'Tu paies un abonnement musique ?',
  '[{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non-la-version-gratuite-", "libelle": "Non, la version gratuite me suffit"}, {"valeur": "non-je-n-utilise-pas-d-a", "libelle": "Non, je n''utilise pas d''appli"}]'::jsonb),
 (8, 8, 'S9', 'ecoute', 'toujours', false, true, 'choix',
  'Tu écoutes de la musique combien de temps par jour ?',
  '[{"valeur": "moins-d-1-h", "libelle": "Moins d''1 h"}, {"valeur": "1-a-3-h", "libelle": "1 à 3 h"}, {"valeur": "3-a-5-h", "libelle": "3 à 5 h"}, {"valeur": "plus-de-5-h", "libelle": "Plus de 5 h"}]'::jsonb),
 (9, 9, 'S10', 'ecoute', 'toujours', false, false, 'choix',
  'Tu écoutes surtout…',
  '[{"valeur": "des-artistes-camerounais", "libelle": "Des artistes camerounais"}, {"valeur": "des-artistes-africains", "libelle": "Des artistes africains"}, {"valeur": "des-artistes-internation", "libelle": "Des artistes internationaux"}, {"valeur": "un-peu-de-tout", "libelle": "Un peu de tout", "bas": true}]'::jsonb),
 (10, 10, 'S11', 'ecoute', 'toujours', false, true, 'choix',
  'La radio, tu l''écoutes ?',
  '[{"valeur": "tous-les-jours", "libelle": "Tous les jours"}, {"valeur": "de-temps-en-temps", "libelle": "De temps en temps"}, {"valeur": "jamais", "libelle": "Jamais"}]'::jsonb),
 (11, 11, 'S12', 'ecoute', 'toujours', false, false, 'choix',
  'Tu écoutes la musique sur quoi ?',
  '[{"valeur": "le-telephone", "libelle": "Le téléphone"}, {"valeur": "des-ecouteurs-bluetooth", "libelle": "Des écouteurs Bluetooth"}, {"valeur": "une-enceinte", "libelle": "Une enceinte"}, {"valeur": "la-tele", "libelle": "La télé"}, {"valeur": "en-voiture", "libelle": "En voiture"}]'::jsonb),
 (12, 12, 'S13', 'gouts', 'toujours', false, false, 'choix',
  'Ton 2e genre préféré ?',
  '[{"valeur": "afrobeats-afro-pop", "libelle": "Afrobeats / Afro-pop"}, {"valeur": "makossa", "libelle": "Makossa"}, {"valeur": "bikutsi", "libelle": "Bikutsi"}, {"valeur": "coupe-decale", "libelle": "Coupé-décalé"}, {"valeur": "rap-hip-hop", "libelle": "Rap / Hip-hop"}, {"valeur": "r-b-soul", "libelle": "R&B / Soul"}, {"valeur": "gospel", "libelle": "Gospel"}, {"valeur": "reggae-dancehall", "libelle": "Reggae / Dancehall"}, {"valeur": "rumba-ndombolo", "libelle": "Rumba / Ndombolo"}, {"valeur": "jazz", "libelle": "Jazz"}, {"valeur": "electro", "libelle": "Électro"}, {"valeur": "zouk-kompa", "libelle": "Zouk / Kompa"}, {"valeur": "un-autre", "libelle": "Un autre", "bas": true}]'::jsonb),
 (13, 13, 'S14', 'gouts', 'toujours', false, false, 'choix',
  'Tu découvres les nouveaux artistes surtout par…',
  '[{"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "instagram", "libelle": "Instagram"}, {"valeur": "youtube", "libelle": "YouTube"}, {"valeur": "la-radio", "libelle": "La radio"}, {"valeur": "les-amis", "libelle": "Les amis"}, {"valeur": "les-concerts", "libelle": "Les concerts"}]'::jsonb),
 (14, 14, 'S15', 'gouts', 'toujours', false, true, 'choix',
  'Tu as déjà acheté un morceau ou un album ?',
  '[{"valeur": "oui-en-ligne", "libelle": "Oui, en ligne"}, {"valeur": "oui-un-cd", "libelle": "Oui, un CD"}, {"valeur": "jamais", "libelle": "Jamais"}]'::jsonb),
 (15, 15, 'S16', 'gouts', 'toujours', false, true, 'choix',
  'Tu suis des artistes sur les réseaux ?',
  '[{"valeur": "oui-beaucoup", "libelle": "Oui, beaucoup"}, {"valeur": "quelques-uns", "libelle": "Quelques-uns"}, {"valeur": "non", "libelle": "Non"}]'::jsonb),
 (16, 16, 'S17', 'gouts', 'toujours', false, true, 'choix',
  'Tu préfères…',
  '[{"valeur": "les-grandes-stars", "libelle": "Les grandes stars"}, {"valeur": "les-nouveaux-talents", "libelle": "Les nouveaux talents"}, {"valeur": "les-deux", "libelle": "Les deux"}]'::jsonb),
 (17, 17, 'S18', 'gouts', 'toujours', false, true, 'choix',
  'Tu fais toi-même de la musique ou de la danse ?',
  '[{"valeur": "oui-c-est-mon-metier", "libelle": "Oui, c''est mon métier"}, {"valeur": "oui-pour-le-plaisir", "libelle": "Oui, pour le plaisir"}, {"valeur": "non", "libelle": "Non"}]'::jsonb),
 (18, 18, 'S19', 'sorties', 'toujours', false, true, 'choix',
  'Tu sors (maquis, boîte, concert) combien de fois par mois ?',
  '[{"valeur": "jamais", "libelle": "Jamais"}, {"valeur": "1-a-2-fois", "libelle": "1 à 2 fois"}, {"valeur": "3-a-5-fois", "libelle": "3 à 5 fois"}, {"valeur": "plus-de-5-fois", "libelle": "Plus de 5 fois"}]'::jsonb),
 (19, 19, 'S20', 'sorties', 'toujours', false, true, 'choix',
  'Ton budget sorties par mois ?',
  '[{"valeur": "moins-de-10-000-fcfa", "libelle": "Moins de 10 000 FCFA"}, {"valeur": "10-000-a-25-000-fcfa", "libelle": "10 000 à 25 000 FCFA"}, {"valeur": "25-000-a-50-000-fcfa", "libelle": "25 000 à 50 000 FCFA"}, {"valeur": "plus-de-50-000-fcfa", "libelle": "Plus de 50 000 FCFA"}]'::jsonb),
 (20, 20, 'S21', 'sorties', 'toujours', false, false, 'choix',
  'Tes billets de concert, tu les achètes…',
  '[{"valeur": "en-ligne", "libelle": "En ligne"}, {"valeur": "sur-place", "libelle": "Sur place"}, {"valeur": "chez-un-revendeur", "libelle": "Chez un revendeur"}, {"valeur": "on-me-les-offre", "libelle": "On me les offre"}]'::jsonb),
 (21, 21, 'S22', 'sorties', 'toujours', false, false, 'choix',
  'Tu paies surtout avec…',
  '[{"valeur": "mtn-mobile-money", "libelle": "MTN Mobile Money"}, {"valeur": "orange-money", "libelle": "Orange Money"}, {"valeur": "especes", "libelle": "Espèces"}, {"valeur": "carte-bancaire", "libelle": "Carte bancaire"}]'::jsonb),
 (22, 22, 'S23', 'sorties', 'toujours', false, true, 'choix',
  'Un concert à 5 000 FCFA, c''est…',
  '[{"valeur": "pas-cher", "libelle": "Pas cher"}, {"valeur": "correct", "libelle": "Correct"}, {"valeur": "trop-cher", "libelle": "Trop cher"}]'::jsonb),
 (23, 23, 'S24', 'partenaires', 'toujours', false, false, 'choix',
  'Ton opérateur mobile principal ?',
  '[{"valeur": "mtn", "libelle": "MTN"}, {"valeur": "orange", "libelle": "Orange"}, {"valeur": "camtel-blue", "libelle": "Camtel / Blue"}, {"valeur": "nexttel", "libelle": "Nexttel"}]'::jsonb),
 (24, 24, 'S25', 'partenaires', 'toujours', false, true, 'choix',
  'Ton forfait internet, tu l''achètes…',
  '[{"valeur": "chaque-jour", "libelle": "Chaque jour"}, {"valeur": "chaque-semaine", "libelle": "Chaque semaine"}, {"valeur": "chaque-mois", "libelle": "Chaque mois"}]'::jsonb),
 (25, 25, 'S26', 'partenaires', 'toujours', false, false, 'choix',
  'Ton téléphone, c''est…',
  '[{"valeur": "un-android", "libelle": "Un Android"}, {"valeur": "un-iphone", "libelle": "Un iPhone"}, {"valeur": "un-telephone-simple", "libelle": "Un téléphone simple"}]'::jsonb),
 (26, 26, 'S27', 'partenaires', 'toujours', false, false, 'choix',
  'Le réseau social que tu ouvres le plus ?',
  '[{"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "facebook", "libelle": "Facebook"}, {"valeur": "instagram", "libelle": "Instagram"}, {"valeur": "snapchat", "libelle": "Snapchat"}, {"valeur": "x", "libelle": "X"}]'::jsonb),
 (27, 27, 'S28', 'partenaires', 'toujours', false, false, 'choix',
  'Au festival, tu bois plutôt…',
  '[{"valeur": "de-la-biere", "libelle": "De la bière"}, {"valeur": "du-soda", "libelle": "Du soda"}, {"valeur": "du-jus", "libelle": "Du jus"}, {"valeur": "de-l-eau", "libelle": "De l''eau"}, {"valeur": "un-energisant", "libelle": "Un énergisant"}, {"valeur": "rien", "libelle": "Rien", "bas": true}]'::jsonb),
 (28, 28, 'S30', 'partenaires', 'toujours', false, false, 'choix',
  'Tu manges quoi au festival ?',
  '[{"valeur": "grillades-soya", "libelle": "Grillades / soya"}, {"valeur": "plats-locaux", "libelle": "Plats locaux"}, {"valeur": "fast-food", "libelle": "Fast-food"}, {"valeur": "rien-je-mange-avant", "libelle": "Rien, je mange avant", "bas": true}]'::jsonb),
 (29, 29, 'S31', 'profil', 'toujours', false, true, 'choix',
  'Tu vis à Yaoundé depuis…',
  '[{"valeur": "toujours", "libelle": "Toujours"}, {"valeur": "plus-de-5-ans", "libelle": "Plus de 5 ans"}, {"valeur": "moins-de-5-ans", "libelle": "Moins de 5 ans"}, {"valeur": "je-n-y-vis-pas", "libelle": "Je n''y vis pas"}]'::jsonb),
 (30, 30, 'S32', 'profil', 'toujours', false, false, 'choix',
  'À la maison, tu parles surtout…',
  '[{"valeur": "francais", "libelle": "Français"}, {"valeur": "anglais", "libelle": "Anglais"}, {"valeur": "pidgin", "libelle": "Pidgin"}, {"valeur": "une-langue-locale", "libelle": "Une langue locale"}]'::jsonb),
 (31, 31, 'S33', 'profil', 'toujours', false, true, 'choix',
  'Tu as des enfants ?',
  '[{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non", "libelle": "Non"}]'::jsonb),
 (32, 32, 'N1', 'soir', 'soir', true, true, 'choix',
  'Ta journée, tu la notes comment ?',
  '[{"valeur": "decevante", "libelle": "Décevante"}, {"valeur": "moyenne", "libelle": "Moyenne"}, {"valeur": "bien", "libelle": "Bien"}, {"valeur": "tres-bien", "libelle": "Très bien"}, {"valeur": "inoubliable", "libelle": "Inoubliable"}]'::jsonb),
 (33, 33, 'N2', 'soir', 'soir', true, true, 'artiste',
  'Ton concert préféré aujourd''hui ?',
  '[]'::jsonb),
 (34, 34, 'N3', 'soir', 'soir', true, false, 'choix',
  'Ce qui t''a le plus plu aujourd''hui ?',
  '[{"valeur": "la-musique", "libelle": "La musique"}, {"valeur": "l-ambiance", "libelle": "L''ambiance"}, {"valeur": "le-jeu-vimas-quest", "libelle": "Le jeu Vimas Quest"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "l-organisation", "libelle": "L''organisation"}, {"valeur": "les-rencontres", "libelle": "Les rencontres"}]'::jsonb),
 (35, 35, 'N4', 'soir', 'soir', true, true, 'choix',
  'L''attente à l''entrée ?',
  '[{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]'::jsonb),
 (36, 36, 'N5', 'soir', 'soir', true, true, 'choix',
  'L''attente au bar ?',
  '[{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]'::jsonb),
 (37, 37, 'N6', 'soir', 'soir', true, true, 'choix',
  'L''attente aux food-trucks ?',
  '[{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]'::jsonb),
 (38, 38, 'N7', 'soir', 'soir', true, true, 'choix',
  'Les toilettes ?',
  '[{"valeur": "propres-et-rapides", "libelle": "Propres et rapides"}, {"valeur": "correctes", "libelle": "Correctes"}, {"valeur": "a-revoir", "libelle": "À revoir"}]'::jsonb),
 (39, 39, 'N8', 'soir', 'soir', true, true, 'choix',
  'Combien as-tu dépensé aujourd''hui, sans le billet ?',
  '[{"valeur": "rien-du-tout", "libelle": "Rien du tout"}, {"valeur": "moins-de-2-000-fcfa", "libelle": "Moins de 2 000 FCFA"}, {"valeur": "2-000-a-5-000-fcfa", "libelle": "2 000 à 5 000 FCFA"}, {"valeur": "5-000-a-10-000-fcfa", "libelle": "5 000 à 10 000 FCFA"}, {"valeur": "plus-de-10-000-fcfa", "libelle": "Plus de 10 000 FCFA"}]'::jsonb),
 (40, 40, 'N9', 'soir', 'soir', true, false, 'choix',
  'Ce qu''on doit améliorer en priorité ?',
  '[{"valeur": "plus-de-stands", "libelle": "Plus de stands"}, {"valeur": "moins-d-attente", "libelle": "Moins d''attente"}, {"valeur": "plus-d-activites", "libelle": "Plus d''activités"}, {"valeur": "plus-de-place", "libelle": "Plus de place"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "rien-c-etait-bien", "libelle": "Rien, c''était bien", "bas": true}]'::jsonb),
 (41, 41, 'N10', 'soir', 'soir', false, true, 'choix',
  'Conseillerais-tu Vimas Quest à un ami ? (0 = pas du tout, 10 = carrément)',
  '[{"valeur": "0", "libelle": "0"}, {"valeur": "1", "libelle": "1"}, {"valeur": "2", "libelle": "2"}, {"valeur": "3", "libelle": "3"}, {"valeur": "4", "libelle": "4"}, {"valeur": "5", "libelle": "5"}, {"valeur": "6", "libelle": "6"}, {"valeur": "7", "libelle": "7"}, {"valeur": "8", "libelle": "8"}, {"valeur": "9", "libelle": "9"}, {"valeur": "10", "libelle": "10"}]'::jsonb),
 (42, 42, 'N11', 'soir', 'soir', false, true, 'choix',
  'Tu reviendras au VIMAS FEST l''an prochain ?',
  '[{"valeur": "oui-sur", "libelle": "Oui, sûr"}, {"valeur": "peut-etre", "libelle": "Peut-être"}, {"valeur": "non", "libelle": "Non"}]'::jsonb)
on conflict (id) do nothing;

commit;
