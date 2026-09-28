-- ============================================================================
-- DOMAF Quest — CONTENU D'ESSAI (20/09/2026)
-- ----------------------------------------------------------------------------
-- De quoi essayer le jeu en vrai : un site, un programme, des QR, des missions,
-- des lots, des annonces et deux manches de blind test, aux couleurs de Douala.
--
--   ⚠ PROGRAMMATION FICTIVE. Les artistes sont de VRAIS artistes camerounais
--   en activité, mais AUCUN n'est engagé : les scènes, les horaires et les
--   séances de dédicaces sont inventés pour les essais. Ce contenu ne doit pas
--   être montré comme une annonce du festival. Aucune photo n'est posée
--   (droit à l'image, étape 7) : les fiches artistes affichent l'initiale.
--
-- Rejouable : le script efface d'abord SON contenu (par identifiant et par
-- code), puis le réinsère. Effacer un QR efface les scans qui s'y rapportent
-- (clé étrangère en cascade) : relancer ce script remet donc les essais à zéro.
-- Pour tout retirer sans rien remettre : effacer_contenu_essai.sql.
--
-- À coller dans l'éditeur SQL de Supabase (projet domaf-quest), après
-- 00_schema.sql, 01_reference.sql et les correctifs.
-- ============================================================================
begin;

-- ----------------------------------------------------------------------------
-- Remise à zéro du contenu d'essai
-- ----------------------------------------------------------------------------
delete from public.quiz_questions where session_id in
  (select id from public.quiz_sessions where title like 'DOMAF —%');
delete from public.quiz_sessions where title like 'DOMAF —%';
delete from public.dedicaces;
delete from public.creneaux;
delete from public.artistes where id in (
  'charlotte-dipanda','richard-bona','petit-pays','ben-decca','grace-decca','ndedi-eyango',
  'longue-longue','lady-ponce','coco-argentee','mani-bella','salatiel','locko','daphne',
  'blanche-bailly','mr-leo','magasco','tzy-panchak','reniss','x-maleya','dynastie-le-tigre',
  'ewube','mimie','wax-dey','numerica','stanley-enow','ko-c','jovi','maahlox-le-vibeur');
update public.lieux set qr_code_id = null;
delete from public.qr_codes where code like 'DQ-%';
delete from public.lieux where id in (
  'scene-wouri','scene-manguier','scene-bonamoussadi','scene-njangi',
  'stand-green-grass','stand-artisanat','stand-quest','stand-disquaire','stand-radio','stand-pagne',
  'food-ndole','food-soya','food-beignets','food-folere','food-poisson',
  'entree-principale','entree-nord','eau-centre','eau-nord','toilettes-est','toilettes-ouest',
  'secours-poste','abri-tribune','service-info','service-recharge');
delete from public.quests where title in (
  'Échauffement','Tour du propriétaire','Tournée des scènes','Gourmet du festival',
  'Le village en entier','Chasse aux reliques','Autographe','Oreille musicale',
  'Trois manches','Cœur du public','Ambassadeur DOMAF');
delete from public.roulette_prizes;
delete from public.announcements;

-- ----------------------------------------------------------------------------
-- Les lieux : Stade Annexe de Bonamoussadi (x / y en unités du fond du plan,
-- 1000 × 700, 1 unité ≈ 0,40 m). Une scène = un lieu + sa ligne dans scenes.
-- ----------------------------------------------------------------------------
insert into public.lieux (id, categorie, nom, description, horaires, x, y, pmr, ordre) values
  ('scene-wouri',        'scene', 'Scène Wouri',
   'La grande scène, face à la tribune. Têtes d''affiche tous les soirs.', '18 h – 00 h', 500, 240, true, 1),
  ('scene-bonamoussadi', 'scene', 'Scène Bonamoussadi',
   'La scène urbaine : rap, afrobeats, découvertes.', '17 h – 23 h', 650, 340, true, 2),
  ('scene-manguier',     'scene', 'Scène du Manguier',
   'Acoustique, à l''ombre des arbres. On s''assoit dans l''herbe.', '16 h – 20 h', 520, 545, false, 3),
  ('scene-njangi',       'scene', 'Chapiteau Njangi',
   'Le chapiteau de la nuit : DJ, makossa remixé, bikutsi jusqu''au bout.', '23 h – 03 h', 370, 520, false, 4),

  ('stand-green-grass', 'stand', 'Village Green Grass',
   'L''association qui organise le DOMAF depuis 2010 : expos, ateliers, rencontres.', '14 h – 22 h', 430, 300, true, 10),
  ('stand-quest',       'stand', 'Stand DOMAF Quest',
   'Le stand du jeu : on t''aide, on valide les missions, on retrouve ta carte.', '14 h – 23 h', 560, 400, true, 11),
  ('stand-disquaire',   'stand', 'Disquaire & librairie',
   'Vinyles makossa, cassettes retrouvées, livres sur la musique camerounaise.', '14 h – 21 h', 350, 300, false, 12),
  ('stand-radio',       'stand', 'Radio du festival',
   'Le direct du DOMAF : interviews des artistes entre deux concerts.', '15 h – 23 h', 620, 200, false, 13),
  ('stand-pagne',       'stand', 'Créateurs & pagne',
   'Stylistes de Douala : pagne, wax, pièces uniques.', '14 h – 21 h', 700, 430, false, 14),
  ('stand-artisanat',   'stand', 'Artisanat du Wouri',
   'Sculpture, vannerie, perles, instruments de musique.', '14 h – 21 h', 690, 250, false, 15),

  ('food-ndole',    'food', 'Chez Mama Ndolè',
   'Ndolè, miondo, plantain. La file va vite, n''aie pas peur.', '12 h – 23 h', 420, 180, true, 20),
  ('food-soya',     'food', 'Soya braisé du stade',
   'Brochettes de soya et poulet braisé, au charbon.', '16 h – 02 h', 460, 165, false, 21),
  ('food-beignets', 'food', 'Beignets-haricot-bouillie',
   'Le trio national, servi toute la journée.', '10 h – 20 h', 395, 210, false, 22),
  ('food-folere',   'food', 'Folère & gingembre',
   'Jus de folère, gingembre, citronnelle. Bien frais.', '12 h – 00 h', 330, 250, true, 23),
  ('food-poisson',  'food', 'Poisson braisé Bonamoussadi',
   'Maquereau braisé, bâton de manioc, piment à part.', '17 h – 01 h', 720, 520, false, 24),

  ('entree-principale', 'entree',    'Entrée principale',   'Côté boulevard. Contrôle des sacs.',          '13 h 30 – 01 h', 555, 640, true,  30),
  ('entree-nord',       'entree',    'Entrée Nord',         'Entrée secondaire, moins de monde.',          '14 h – 23 h',    500, 120, false, 31),
  ('eau-centre',        'eau',       'Point d''eau central', 'Eau potable gratuite. Remplis ta bouteille.', null,             545, 360, true,  40),
  ('eau-nord',          'eau',       'Point d''eau Nord',    'Eau potable gratuite.',                      null,             470, 200, true,  41),
  ('toilettes-est',     'toilettes', 'Toilettes Est',       null,                                          null,             700, 380, true,  50),
  ('toilettes-ouest',   'toilettes', 'Toilettes Ouest',     null,                                          null,             330, 420, false, 51),
  ('secours-poste',     'secours',   'Poste de secours',    'Croix-Rouge. Ouvert tant que le site est ouvert.', null,         590, 610, true,  60),
  ('abri-tribune',      'abri',      'Tribune couverte',    'Le point de repli quand la pluie arrive.',    null,             300, 430, true,  61),
  ('service-info',      'service',   'Point info & objets trouvés', 'Une question, un objet perdu : ici.', '13 h 30 – 01 h', 520, 600, true,  70),
  ('service-recharge',  'service',   'Recharge téléphone',  'Prises et batteries. 30 minutes par personne.', '14 h – 00 h',  610, 560, false, 71);

insert into public.scenes (id, couleur, ordre) values
  ('scene-wouri', 'sodium', 1), ('scene-bonamoussadi', 'rose', 2),
  ('scene-manguier', 'vert', 3), ('scene-njangi', 'nuit', 4);

-- ----------------------------------------------------------------------------
-- Les artistes — VRAIS artistes camerounais, PROGRAMMATION FICTIVE
-- ----------------------------------------------------------------------------
-- Le style doit rester une valeur de profil_options() (fiche fan) : afrobeats,
-- makossa, bikutsi, coupe-decale, rap, rnb-soul, gospel, reggae, rumba, jazz,
-- electro, zouk, autre. Les présentations restent volontairement courtes et
-- générales : pas de date ni de titre à vérifier. photo_url reste vide.
insert into public.artistes (id, nom, genre, bio, tete_affiche, actif) values
  ('charlotte-dipanda', 'Charlotte Dipanda', 'rnb-soul',
   'Une des grandes voix de l''afro-soul camerounaise, à l''aise en français comme dans les langues du pays.', true,  true),
  ('richard-bona',      'Richard Bona',      'jazz',
   'Bassiste et chanteur de renommée internationale, ambassadeur du jazz camerounais.', true,  true),
  ('petit-pays',        'Petit Pays',        'makossa',
   'Figure incontournable du makossa, connu pour son makossa-love et ses shows interminables.', true,  true),
  ('lady-ponce',        'Lady Ponce',        'bikutsi',
   'L''une des voix les plus populaires du bikutsi.', true,  true),
  ('salatiel',          'Salatiel',          'afrobeats',
   'Auteur, producteur et chanteur : l''un des artisans du son afropop camerounais d''aujourd''hui.', true,  true),
  ('blanche-bailly',    'Blanche Bailly',    'afrobeats',
   'Chanteuse d''afrobeats, parmi les artistes camerounaises les plus suivies.', false, true),
  ('locko',             'Locko',             'afrobeats',
   'Chanteur et guitariste, voix douce de l''afro-R&B camerounais.', false, true),
  ('daphne',            'Daphné',            'afrobeats',
   'Chanteuse d''afropop, révélée par le titre « Calée ».', false, true),
  ('mr-leo',            'Mr Leo',            'afrobeats',
   'Auteur-compositeur d''afropop, il passe du français à l''anglais et au pidgin.', false, true),
  ('magasco',           'Magasco',           'afrobeats',
   'Chanteur d''afropop venu de Bamenda.', false, true),
  ('tzy-panchak',       'Tzy Panchak',       'afrobeats',
   'Voix de l''afropop anglophone camerounaise.', false, true),
  ('reniss',            'Reniss',            'afrobeats',
   'Chanteuse à l''univers afro-folk, une des signatures les plus personnelles de la scène.', false, true),
  ('x-maleya',          'X-Maleya',          'afrobeats',
   'Trio d''afropop, l''un des groupes les plus connus du Cameroun.', false, true),
  ('dynastie-le-tigre', 'Dynastie Le Tigre', 'afrobeats',
   'Chanteur d''afropop à l''humour mordant.', false, true),
  ('mimie',             'Mimie',             'afrobeats',
   'Chanteuse d''afropop de la nouvelle génération.', false, true),
  ('wax-dey',           'Wax Dey',           'afrobeats',
   'Chanteur de la scène anglophone camerounaise.', false, true),
  ('numerica',          'Numerica',          'afrobeats',
   'Chanteur de la scène urbaine camerounaise.', false, true),
  ('ewube',             'Ewube',             'rnb-soul',
   'Voix soul de la scène camerounaise.', false, true),
  ('stanley-enow',      'Stanley Enow',      'rap',
   'Rappeur, l''un des noms qui ont porté le hip-hop camerounais au-delà des frontières.', false, true),
  ('jovi',              'Jovi',              'rap',
   'Rappeur et producteur, surnommé « Le Monstre ».', false, true),
  ('ko-c',              'Ko-C',              'rap',
   'Rappeur et chanteur, à cheval entre le rap et l''afropop.', false, true),
  ('maahlox-le-vibeur', 'Maahlox le Vibeur', 'rap',
   'Rappeur, figure du « vibe » camerounais.', false, true),
  ('ben-decca',         'Ben Decca',         'makossa',
   'Une des grandes voix du makossa.', false, true),
  ('grace-decca',       'Grace Decca',       'makossa',
   'Chanteuse de makossa.', false, true),
  ('ndedi-eyango',      'Ndedi Eyango',      'makossa',
   'Auteur-compositeur et interprète, figure du makossa.', false, true),
  ('longue-longue',     'Longuè Longuè',     'makossa',
   'Chanteur engagé, voix populaire du makossa moderne.', false, true),
  ('coco-argentee',     'Coco Argentée',     'bikutsi',
   'Chanteuse de bikutsi.', false, true),
  ('mani-bella',        'Mani Bella',        'bikutsi',
   'Chanteuse de bikutsi, connue pour « Pala Pala ».', false, true);

-- ----------------------------------------------------------------------------
-- Les concerts — 4 jours × 4 scènes, heures de Douala (UTC+1)
-- ----------------------------------------------------------------------------
-- Une journée de jeu va de 6 h à 6 h : un concert de 1 h du matin appartient
-- encore à la soirée qui l'a vu commencer. Deux concerts d'une même scène ne
-- se chevauchent jamais (contrainte creneaux_sans_chevauchement).
insert into public.creneaux (artiste_id, scene_id, debut, fin) values
  -- Jeudi 26 novembre — ouverture
  ('mimie',             'scene-manguier',     '2026-11-26 16:30+01', '2026-11-26 17:30+01'),
  ('ewube',             'scene-manguier',     '2026-11-26 18:00+01', '2026-11-26 19:15+01'),
  ('tzy-panchak',       'scene-bonamoussadi', '2026-11-26 17:30+01', '2026-11-26 18:45+01'),
  ('numerica',          'scene-bonamoussadi', '2026-11-26 19:15+01', '2026-11-26 20:30+01'),
  ('ko-c',              'scene-bonamoussadi', '2026-11-26 21:00+01', '2026-11-26 22:30+01'),
  ('grace-decca',       'scene-wouri',        '2026-11-26 19:00+01', '2026-11-26 20:15+01'),
  ('ndedi-eyango',      'scene-wouri',        '2026-11-26 20:45+01', '2026-11-26 22:00+01'),
  ('petit-pays',        'scene-wouri',        '2026-11-26 22:30+01', '2026-11-27 00:30+01'),
  ('maahlox-le-vibeur', 'scene-njangi',       '2026-11-26 23:30+01', '2026-11-27 01:00+01'),

  -- Vendredi 27 novembre
  ('wax-dey',           'scene-manguier',     '2026-11-27 16:30+01', '2026-11-27 17:30+01'),
  ('reniss',            'scene-manguier',     '2026-11-27 18:00+01', '2026-11-27 19:15+01'),
  ('magasco',           'scene-bonamoussadi', '2026-11-27 17:30+01', '2026-11-27 18:45+01'),
  ('stanley-enow',      'scene-bonamoussadi', '2026-11-27 19:15+01', '2026-11-27 20:45+01'),
  ('jovi',              'scene-bonamoussadi', '2026-11-27 21:15+01', '2026-11-27 22:45+01'),
  ('locko',             'scene-wouri',        '2026-11-27 19:00+01', '2026-11-27 20:15+01'),
  ('daphne',            'scene-wouri',        '2026-11-27 20:45+01', '2026-11-27 22:00+01'),
  ('charlotte-dipanda', 'scene-wouri',        '2026-11-27 22:30+01', '2026-11-28 00:15+01'),
  ('dynastie-le-tigre', 'scene-njangi',       '2026-11-27 23:30+01', '2026-11-28 01:00+01'),

  -- Samedi 28 novembre — la grosse soirée
  ('mimie',             'scene-manguier',     '2026-11-28 16:00+01', '2026-11-28 17:00+01'),
  ('x-maleya',          'scene-manguier',     '2026-11-28 17:30+01', '2026-11-28 18:45+01'),
  ('mr-leo',            'scene-bonamoussadi', '2026-11-28 17:30+01', '2026-11-28 18:45+01'),
  ('blanche-bailly',    'scene-bonamoussadi', '2026-11-28 19:15+01', '2026-11-28 20:45+01'),
  ('salatiel',          'scene-bonamoussadi', '2026-11-28 21:15+01', '2026-11-28 22:45+01'),
  ('coco-argentee',     'scene-wouri',        '2026-11-28 18:45+01', '2026-11-28 20:00+01'),
  ('mani-bella',        'scene-wouri',        '2026-11-28 20:30+01', '2026-11-28 21:45+01'),
  ('lady-ponce',        'scene-wouri',        '2026-11-28 22:15+01', '2026-11-29 00:15+01'),
  ('ko-c',              'scene-njangi',       '2026-11-28 23:30+01', '2026-11-29 01:30+01'),

  -- Dimanche 29 novembre — clôture
  ('ewube',             'scene-manguier',     '2026-11-29 16:00+01', '2026-11-29 17:00+01'),
  ('tzy-panchak',       'scene-manguier',     '2026-11-29 17:30+01', '2026-11-29 18:30+01'),
  ('numerica',          'scene-bonamoussadi', '2026-11-29 17:00+01', '2026-11-29 18:15+01'),
  ('magasco',           'scene-bonamoussadi', '2026-11-29 18:45+01', '2026-11-29 20:00+01'),
  ('locko',             'scene-bonamoussadi', '2026-11-29 20:30+01', '2026-11-29 21:45+01'),
  ('longue-longue',     'scene-wouri',        '2026-11-29 18:30+01', '2026-11-29 19:45+01'),
  ('ben-decca',         'scene-wouri',        '2026-11-29 20:15+01', '2026-11-29 21:45+01'),
  ('richard-bona',      'scene-wouri',        '2026-11-29 22:15+01', '2026-11-30 00:00+01'),
  ('blanche-bailly',    'scene-njangi',       '2026-11-29 23:00+01', '2026-11-30 00:30+01');

-- ----------------------------------------------------------------------------
-- Les séances de dédicaces (leur QR est relié plus bas)
-- ----------------------------------------------------------------------------
insert into public.dedicaces (artiste_id, lieu_id, debut, fin) values
  ('ben-decca',         'stand-disquaire',   '2026-11-26 17:00+01', '2026-11-26 18:00+01'),
  ('daphne',            'stand-radio',       '2026-11-27 16:00+01', '2026-11-27 17:00+01'),
  ('charlotte-dipanda', 'stand-green-grass', '2026-11-27 18:00+01', '2026-11-27 19:00+01'),
  ('blanche-bailly',    'stand-pagne',       '2026-11-28 16:30+01', '2026-11-28 17:30+01'),
  ('stanley-enow',      'stand-radio',       '2026-11-28 18:00+01', '2026-11-28 19:00+01'),
  ('lady-ponce',        'stand-green-grass', '2026-11-29 16:00+01', '2026-11-29 17:00+01');

-- ----------------------------------------------------------------------------
-- Les QR codes
-- ----------------------------------------------------------------------------
-- Le code imprimé est « DQ- » + 6 caractères de l'alphabet du jeu (ni I, ni O,
-- ni 0, ni 1 : on les confond à la lecture). L'XP suit le barème par défaut
-- (_xp_qr_defaut) : scène 30, stand 20, food 15, service 10, dédicace 100,
-- relique 75 / 150 / 300 selon la rareté, surprise 80.
-- ⚠ Les reliques sont livrées ACTIVES pour les essais. En vrai, on n'allume
-- une relique qu'une fois l'objet caché : son indice est public dès l'allumage.
insert into public.qr_codes (code, label, type, rarity, xp_reward, hint, active) values
  ('DQ-SC2WRU', 'Scène Wouri',                 'scene',     null,  30, null, true),
  ('DQ-SC2BNM', 'Scène Bonamoussadi',          'scene',     null,  30, null, true),
  ('DQ-SC2MNG', 'Scène du Manguier',           'scene',     null,  30, null, true),
  ('DQ-SC2NJG', 'Chapiteau Njangi',            'scene',     null,  30, null, true),

  ('DQ-ST2GRG', 'Village Green Grass',         'stand',     null,  20, null, true),
  ('DQ-ST2QST', 'Stand DOMAF Quest',           'stand',     null,  20, null, true),
  ('DQ-ST2DSQ', 'Disquaire & librairie',       'stand',     null,  20, null, true),
  ('DQ-ST2RAD', 'Radio du festival',           'stand',     null,  20, null, true),
  ('DQ-ST2PGN', 'Créateurs & pagne',           'stand',     null,  20, null, true),
  ('DQ-ST2ART', 'Artisanat du Wouri',          'stand',     null,  20, null, true),

  ('DQ-FD2NDL', 'Chez Mama Ndolè',             'foodtruck', null,  15, null, true),
  ('DQ-FD2SYA', 'Soya braisé du stade',        'foodtruck', null,  15, null, true),
  ('DQ-FD2BGN', 'Beignets-haricot-bouillie',   'foodtruck', null,  15, null, true),
  ('DQ-FD2FLR', 'Folère & gingembre',          'foodtruck', null,  15, null, true),
  ('DQ-FD2PSN', 'Poisson braisé Bonamoussadi', 'foodtruck', null,  15, null, true),

  ('DQ-SV2EAU', 'Point d''eau central',         'service',   null,  10, null, true),
  ('DQ-SV2PTS', 'Point info & objets trouvés', 'service',   null,  10, null, true),
  ('DQ-SV2RCH', 'Recharge téléphone',          'service',   null,  10, null, true),

  ('DQ-RL2BLF', 'Le balafon oublié',      'relique', 'commune',    75,
   'Là où l''on répare les instruments, cherche sous la table la plus bancale.', true),
  ('DQ-RL2BGN', 'La recette de mamie',    'relique', 'commune',    75,
   'Elle est punaisée près de celles qui font frire depuis le matin.', true),
  ('DQ-RL2VYN', 'Le 45 tours rayé',       'relique', 'rare',      150,
   'Entre deux bacs de vinyles, quelqu''un l''a glissé à l''envers.', true),
  ('DQ-RL2TAM', 'Le tam-tam du veilleur', 'relique', 'rare',      150,
   'Sous la tribune, à l''abri de la pluie, il attend la nuit.', true),
  ('DQ-RL2SAX', 'Le saxophone d''argent',  'relique', 'legendaire', 300,
   'Il ne sort que quand la grande scène s''allume. Regarde vers la régie.', true),

  ('DQ-DDBDCA', 'Dédicace — Ben Decca',         'dedicace', null, 100, null, true),
  ('DQ-DDDPHN', 'Dédicace — Daphné',            'dedicace', null, 100, null, true),
  ('DQ-DDCDPA', 'Dédicace — Charlotte Dipanda', 'dedicace', null, 100, null, true),
  ('DQ-DDBLNC', 'Dédicace — Blanche Bailly',    'dedicace', null, 100, null, true),
  ('DQ-DDSTAN', 'Dédicace — Stanley Enow',      'dedicace', null, 100, null, true),
  ('DQ-DDLPNC', 'Dédicace — Lady Ponce',        'dedicace', null, 100, null, true),

  ('DQ-SPRZ22', 'Surprise du Green Grass',     'surprise',  null,  80,
   'Distribué au hasard par l''équipe. Ne se colle nulle part.', true);

-- Un lieu = un QR (le lien se règle d'habitude dans l'écran « QR et reliques »)
update public.lieux l set qr_code_id = q.id from public.qr_codes q
 where (l.id, q.code) in (
   ('scene-wouri','DQ-SC2WRU'), ('scene-bonamoussadi','DQ-SC2BNM'),
   ('scene-manguier','DQ-SC2MNG'), ('scene-njangi','DQ-SC2NJG'),
   ('stand-green-grass','DQ-ST2GRG'), ('stand-quest','DQ-ST2QST'),
   ('stand-disquaire','DQ-ST2DSQ'), ('stand-radio','DQ-ST2RAD'),
   ('stand-pagne','DQ-ST2PGN'), ('stand-artisanat','DQ-ST2ART'),
   ('food-ndole','DQ-FD2NDL'), ('food-soya','DQ-FD2SYA'),
   ('food-beignets','DQ-FD2BGN'), ('food-folere','DQ-FD2FLR'),
   ('food-poisson','DQ-FD2PSN'), ('eau-centre','DQ-SV2EAU'),
   ('service-info','DQ-SV2PTS'), ('service-recharge','DQ-SV2RCH'));

-- Une séance de dédicaces = un QR (le scan fait entrer l'artiste dans la collection)
update public.dedicaces d set qr_code_id = q.id from public.qr_codes q, public.artistes a
 where a.id = d.artiste_id and q.type = 'dedicace'
   and q.label = 'Dédicace — ' || a.nom;

-- ----------------------------------------------------------------------------
-- Les missions
-- ----------------------------------------------------------------------------
-- counter : ce que la base sait compter toute seule (_compteurs_mission).
-- « manuel » = validée par l'équipe au stand, en scannant le QR du joueur.
-- categorie : exploration, musique, gourmand, social, defi.
insert into public.quests (title, description, counter, goal_count, xp_reward, categorie, priorite, requires_staff, badge_id) values
  ('Échauffement',        'Scanne ton premier QR du festival. N''importe lequel.',                    'scan_any',      1, 50,  'exploration', 1,  false,
   (select id from public.badges where name = 'Échauffement')),
  ('Tour du propriétaire','Scanne 10 QR différents : scènes, stands, food, services.',                'scan_any',     10, 200, 'exploration', 2,  false, null),
  ('Tournée des scènes',  'Scanne les 4 scènes du site. Pendant un concert, ça compte double pour ta collection.', 'scan_scene', 4, 300, 'musique', 3, false,
   (select id from public.badges where name = 'En tournée')),
  ('Gourmet du festival', 'Goûte et scanne 3 points de restauration.',                                'scan_foodtruck', 3, 250, 'gourmand',  4,  false,
   (select id from public.badges where name = 'Gourmet')),
  ('Le village en entier','Scanne 5 stands du village.',                                              'scan_stand',    5, 250, 'exploration', 5,  false, null),
  ('Chasse aux reliques', 'Retrouve 3 reliques cachées sur le site. Les indices sont dans ta collection.', 'scan_relique', 3, 400, 'defi',   6,  false, null),
  ('Autographe',          'Fais-toi dédicacer quelque chose et scanne le QR de la séance.',           'scan_dedicace', 1, 200, 'social',      7,  false, null),
  ('Oreille musicale',    'Participe à une manche du blind test.',                                    'blind',         1, 150, 'musique',     8,  false, null),
  ('Trois manches',       'Participe à 3 manches du blind test sur l''ensemble du festival.',          'blind',         3, 400, 'musique',     9,  false, null),
  ('Cœur du public',      'Donne 3 cœurs à des artistes ou à des stands que tu as vus.',              'coeur',         3, 150, 'social',      10, false, null),
  ('Ambassadeur DOMAF',   'Fais découvrir le jeu à quelqu''un et passe au Stand DOMAF Quest avec lui.', 'manuel',        1, 100, 'social',      11, true,  null);

-- ----------------------------------------------------------------------------
-- Les lots de la roue
-- ----------------------------------------------------------------------------
-- weight = chances relatives ; stock null = illimité ; court = le mot écrit
-- sur la case (12 caractères au plus).
insert into public.roulette_prizes (name, court, icon, kind, value, weight, stock, rarete, active, badge_id) values
  ('Sticker DOMAF Quest',        'Sticker',   'etoile',   'objet',  0,   20, 500,  'commun',     true, null),
  ('Bracelet du festival',       'Bracelet',  'cadeau',   'objet',  0,   14, 200,  'commun',     true, null),
  ('Bon pour une boisson',       'Boisson',   'goutte',   'objet',  0,   12, 150,  'commun',     true, null),
  ('Bon pour une brochette',     'Soya',      'couverts', 'objet',  0,   10, 120,  'commun',     true, null),
  ('100 XP',                     '100 XP',    'eclair',   'xp',     100, 15, null, 'commun',     true, null),
  ('2 jetons de roue',           '2 jetons',  'jeton',    'jetons', 2,   10, null, 'commun',     true, null),
  ('300 XP',                     '300 XP',    'eclair',   'xp',     300, 6,  null, 'rare',       true, null),
  ('Casquette DOMAF',            'Casquette', 'cadeau',   'objet',  0,   7,  60,   'rare',       true, null),
  ('T-shirt DOMAF 15 ans',       'T-shirt',   'cadeau',   'objet',  0,   4,  40,   'rare',       true, null),
  ('Pass backstage (1 concert)', 'Backstage', 'cadenas',  'objet',  0,   1,  4,    'legendaire', true,
   (select id from public.badges where name = 'Backstage')),
  ('Presque !',                  'Presque !', 'onde',     'rien',   0,   11, null, 'commun',     true, null);

-- ----------------------------------------------------------------------------
-- Les annonces (48 h de visibilité côté joueurs)
-- ----------------------------------------------------------------------------
insert into public.announcements (message, type, titre, categorie, lien, lien_libelle, fin) values
  ('Le site ouvre à 14 h chaque jour. Dernière entrée à 1 h du matin.',
   'info', 'Horaires du site', 'horaire', 'infos.html', 'Toutes les infos', null),
  ('Scanne le QR de ta scène pendant le concert : l''artiste entre dans ta collection et tu gagnes un cœur à donner.',
   'info', 'Astuce du jeu', 'jeu', 'collection.html', 'Voir ma collection', null),
  ('Averse annoncée en fin de soirée. En cas de pluie, rendez-vous sous la tribune couverte.',
   'alerte', 'Pluie possible ce soir', 'meteo', 'plan.html', 'Trouver les abris', null);

-- ----------------------------------------------------------------------------
-- Le blind test — deux manches préparées
-- ----------------------------------------------------------------------------
-- Les « boss » sont des figures du patrimoine musical camerounais (décision du
-- 17/09 : plus de personnages d'animés). Aucune image n'est posée : le droit à
-- l'image se règle à l'étape 7. PV du boss ≈ 600 points par joueur et par
-- question (ici : une salle d'une cinquantaine de joueurs).
insert into public.quiz_sessions (title, kind, status, boss_name, boss_hp_max, raid_bonus_xp) values
  ('DOMAF — Manche 1 : les racines',     'raid', 'preparee', 'Le Griot du Wouri',  240000, 0),
  ('DOMAF — Manche 2 : la scène d''aujourd''hui', 'raid', 'preparee', 'Le Boss de Bonamoussadi', 240000, 0);

insert into public.quiz_questions (session_id, question_order, question, choices, correct_index, duration_seconds, categorie, reponse, anecdote)
select s.id, q.ordre, q.question, q.choix::jsonb, q.bonne, q.duree, q.categorie, q.reponse, q.anecdote
from public.quiz_sessions s
join (values
  (1, 1, 'Avec quel instrument Manu Dibango a-t-il marqué « Soul Makossa » ?',
      '["Le saxophone","La trompette","Le balafon","La guitare basse"]', 0, 20, 'Instrument', 'Le saxophone',
      'Son saxophone a fait le tour du monde et a été repris jusque dans la pop américaine.'),
  (1, 2, 'Dans quelle ville est né le makossa ?',
      '["Douala","Yaoundé","Bafoussam","Garoua"]', 0, 20, 'Histoire', 'Douala',
      'Le makossa est né ici même, sur les bords du Wouri.'),
  (1, 3, 'Le bikutsi vient surtout de quelle partie du Cameroun ?',
      '["Le Centre et le Sud","L''Extrême-Nord","Le Littoral","L''Ouest"]', 0, 20, 'Histoire', 'Le Centre et le Sud',
      'C''est la musique des peuples beti, devenue une fierté nationale.'),
  (1, 4, 'Quel instrument traditionnel accompagne le bikutsi depuis toujours ?',
      '["Le balafon","La kora","Le djembé","Le ngoni"]', 0, 20, 'Instrument', 'Le balafon',
      'Les lames de bois frappées donnent au bikutsi sa pulsation reconnaissable.'),
  (1, 5, 'Richard Bona s''est fait connaître dans le monde avec quel instrument ?',
      '["La basse","Le piano","La batterie","Le saxophone"]', 0, 20, 'Instrument', 'La basse',
      'Il est l''un des bassistes les plus demandés de la scène jazz internationale.'),
  (1, 6, '« Soul Makossa » est sorti dans quelle décennie ?',
      '["Les années 1970","Les années 1960","Les années 1980","Les années 1990"]', 0, 20, 'Histoire', 'Les années 1970',
      'Un morceau de 1972 qui a ouvert la route à toute une génération.'),
  (1, 7, 'Anne-Marie Nzié est surnommée...',
      '["La voix d''or du Cameroun","La reine du coupé-décalé","La dame du jazz","La mère du rap"]', 0, 20, 'Figures', 'La voix d''or du Cameroun',
      'Sa voix a traversé plus d''un demi-siècle de musique camerounaise.'),
  (1, 8, 'Lapiro de Mbanga chantait surtout dans quelle langue ?',
      '["Le pidgin et le camfranglais","L''allemand","Le swahili","Le wolof"]', 0, 20, 'Figures', 'Le pidgin et le camfranglais',
      'Il chantait la langue de la rue pour être compris de tout le monde.'),

  (2, 1, 'Quel rappeur camerounais est surnommé « Le Monstre » ?',
      '["Jovi","Stanley Enow","Ko-C","Maahlox le Vibeur"]', 0, 20, 'Artiste', 'Jovi',
      'Le surnom lui colle à la peau depuis ses débuts.'),
  (2, 2, 'Quel artiste camerounais a participé à l''album « The Lion King: The Gift » de Beyoncé ?',
      '["Salatiel","Locko","Mr Leo","Magasco"]', 0, 20, 'Artiste', 'Salatiel',
      'Une collaboration qui a mis l''afropop camerounaise sous les projecteurs.'),
  (2, 3, 'Daphné s''est fait connaître avec quel titre ?',
      '["Calée","Pala Pala","Dilo","Sissia"]', 0, 20, 'Titre', '« Calée »',
      'Les trois autres titres existent aussi : à toi de retrouver qui les chante.'),
  (2, 4, '« Pala Pala » est un titre de...',
      '["Mani Bella","Lady Ponce","Coco Argentée","Blanche Bailly"]', 0, 20, 'Titre', 'Mani Bella',
      'Un refrain que tout le monde reprend, du Wouri à Yaoundé.'),
  (2, 5, 'Combien de membres compte le groupe X-Maleya ?',
      '["Trois","Deux","Quatre","Cinq"]', 0, 20, 'Artiste', 'Trois',
      'Un trio, l''un des groupes camerounais les plus connus.'),
  (2, 6, 'Que veut dire DOMAF ?',
      '["Douala Music''Art Festival","Douala Marché du Film","Douala Mode & Art Festival","Douala Manifestation Artistique"]', 0, 15, 'Festival', 'Douala Music''Art Festival',
      'Le festival fête cette année sa 15ᵉ édition.'),
  (2, 7, 'Qui organise le DOMAF depuis 2010 ?',
      '["L''association Green Grass","La mairie de Douala","Une radio privée","Un label de Yaoundé"]', 0, 15, 'Festival', 'L''association Green Grass',
      'Quinze ans de festival, portés par la même équipe.'),
  (2, 8, 'Quel est le thème de cette 15ᵉ édition ?',
      '["1 cerveau + 1 cerveau = 3 cerveaux","La musique avant tout","Douala debout","Quinze ans, quinze scènes"]', 0, 15, 'Festival', '« 1 cerveau + 1 cerveau = 3 cerveaux »',
      'Autrement dit : na so e dey. Ensemble, on va plus loin.')
) as q(manche, ordre, question, choix, bonne, duree, categorie, reponse, anecdote)
  on s.title = case q.manche when 1 then 'DOMAF — Manche 1 : les racines'
                             else 'DOMAF — Manche 2 : la scène d''aujourd''hui' end;

commit;

-- Ce que le script vient de poser (à lancer séparément pour vérifier) :
-- select 'lieux' t, count(*) from public.lieux
-- union all select 'scenes', count(*) from public.scenes
-- union all select 'artistes', count(*) from public.artistes
-- union all select 'concerts', count(*) from public.creneaux
-- union all select 'dedicaces', count(*) from public.dedicaces
-- union all select 'qr', count(*) from public.qr_codes
-- union all select 'missions', count(*) from public.quests
-- union all select 'lots', count(*) from public.roulette_prizes
-- union all select 'annonces', count(*) from public.announcements
-- union all select 'manches', count(*) from public.quiz_sessions
-- union all select 'questions', count(*) from public.quiz_questions;
