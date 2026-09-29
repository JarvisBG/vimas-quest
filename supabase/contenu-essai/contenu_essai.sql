-- ============================================================================
-- Vimas Quest — CONTENU D'ESSAI (29/09/2026)
-- ----------------------------------------------------------------------------
-- De quoi essayer le jeu en vrai, calqué sur la démo (app/data/mock.js) :
-- le Majestic Cinéma (1re édition, tout dans l'enceinte), 2 scènes, un line-up
-- FICTIF (aucun vrai artiste), des QR, des missions, des lots, des annonces et
-- deux manches de blind test.
--
-- ⚠ PROGRAMMATION INVENTÉE : noms d'artistes, horaires, stands et lots sont
-- fictifs, pour la démonstration à Vimas Production. Le site en ligne lit cette
-- base : la page affiche « Maquette de démonstration · contenu fictif ».
--
-- Rejouable : le script efface d'abord tout le contenu du festival (lieux,
-- scènes, artistes, concerts, QR, missions, lots, annonces, manches « VIMAS — »)
-- avant de le remettre. Effacer un QR efface ses scans, effacer une mission
-- l'avancée des joueurs : les joueurs eux-mêmes restent.
--
-- À coller dans l'éditeur SQL de Supabase (projet domaf-quest), APRÈS
-- correctifs/2026-09-29_vimas-8-base.sql.
-- ============================================================================
begin;

-- ----------------------------------------------------------------------------
-- Remise à zéro du contenu du festival
-- ----------------------------------------------------------------------------
delete from public.quiz_questions where session_id in
  (select id from public.quiz_sessions where title like 'VIMAS —%');
delete from public.quiz_sessions where title like 'VIMAS —%';
delete from public.dedicaces;
delete from public.creneaux;
delete from public.artistes;
update public.lieux set qr_code_id = null;
delete from public.qr_codes;
delete from public.scenes;
delete from public.lieux;
delete from public.quests;
delete from public.roulette_prizes;
delete from public.announcements;

-- ----------------------------------------------------------------------------
-- Les lieux : Majestic Cinéma, Université de Yaoundé I (x / y en unités du fond
-- du plan, 1000 × 700, 1 unité = 0,20 m ; enceinte x 300 → 700, y 77 → 623).
-- Mêmes positions que la démo. Une scène = un lieu + sa ligne dans scenes.
-- ----------------------------------------------------------------------------
insert into public.lieux (id, categorie, nom, description, horaires, x, y, pmr, ordre) values
  ('grande-scene', 'scene', 'Grande Scène',
   'Devant l''écran du Majestic : concerts et écran géant. Plateforme PMR à droite de la régie.', '11 h – 22 h', 437, 252, true, 1),
  ('podium-mode',  'scene', 'Le Podium Mode',
   'Sur le parking du Majestic : défilés, battles de danse, fanfare et sets dancehall.', '11 h – 22 h', 584, 413, true, 2),

  ('stand-radio',     'stand', 'Radio Écho',        'Studio en direct et interviews d''artistes entre deux concerts.', '10 h – 21 h', 654, 322, false, 10),
  ('stand-kora',      'stand', 'Maison Kora',       'Créateurs de mode et artisans : wax, streetwear, pièces uniques.', '10 h – 21 h', 528, 518, false, 11),
  ('stand-bar',       'stand', 'Buvette du Majestic', 'Le bar du festival.',                                            '10 h – 22 h', 640, 497, true,  12),
  ('stand-quest',     'stand', 'Stand Vimas Quest',
   'Le stand du jeu : aide, missions validées, lots à retirer, recharge de téléphone, objets trouvés.', '10 h – 21 h 30', 605, 574, true, 13),

  ('food-yassa',  'food', 'Chez Yassa', 'Grillades et plats locaux, au nord de l''enceinte.', '10 h – 22 h', 507, 161, true,  20),
  ('food-braise', 'food', 'Le Braisé',  'Soya et braisés, au nord de l''enceinte.',          '12 h – 22 h', 563, 119, false, 21),

  ('entree-principale', 'entree',    'Entrée',                  'Sur l''axe principal du campus. Contrôle des tickets et bracelets.', '10 h – 22 h', 682, 665, true, 30),
  ('eau-scene',         'eau',       'Point d''eau Grande Scène', 'Eau potable gratuite, derrière la Grande Scène.',  null, 381, 203, true, 40),
  ('eau-podium',        'eau',       'Point d''eau Podium',     'Eau potable gratuite.',                           null, 654, 420, true, 41),
  ('toilettes-nord',    'toilettes', 'Toilettes Nord',          null,                                              null, 612, 196, true, 50),
  ('toilettes-majestic','toilettes', 'Toilettes Majestic',      null,                                              null, 381, 406, true, 51),
  ('secours-poste',     'secours',   'Poste de secours',        'Secouristes et point d''écoute, entre la Grande Scène et le Podium.', 'Ouvert en continu', 507, 343, true, 60),
  ('abri-hall',         'abri',      'Hall du Majestic',        'Le hall du Majestic sert d''abri en cas d''averse.', null, 385, 308, true, 61),
  ('service-dedicaces', 'service',   'Tente dédicaces',         'Séances de dédicaces des artistes, près du Podium Mode.', null, 654, 371, true, 70);

insert into public.scenes (id, couleur, ordre) values
  ('grande-scene', 'sodium', 1), ('podium-mode', 'bleu', 2);

-- ----------------------------------------------------------------------------
-- Les artistes — TOUS FICTIFS (repris de la démo)
-- ----------------------------------------------------------------------------
-- Le style doit rester une valeur de profil_options() (fiche fan) : afrobeats,
-- makossa, bikutsi, coupe-decale, rap, rnb-soul, gospel, reggae, rumba, jazz,
-- electro, zouk, autre. photo_url reste vide (les fiches affichent l'initiale).
insert into public.artistes (id, nom, genre, bio, tete_affiche, actif) values
  ('mboa-brass-band', 'Mboa Brass Band', 'jazz',
   'Onze musiciens qui ouvrent le festival en déambulant entre les stands, sans partition.', false, true),
  ('roots-mbeng',     'Roots Mbeng',     'reggae',
   'Reggae roots chanté en français, en anglais et en langues locales.', false, true),
  ('defile-wax-roots','Défilé Wax & Roots', null,
   'Les créateurs des stands défilent : wax, streetwear et silhouettes inspirées des Caraïbes.', false, true),
  ('lady-soca',       'Lady Soca',       'zouk',
   'L''énergie du carnaval de Trinidad en plein Yaoundé : drapeaux, sifflets et chorégraphies.', false, true),
  ('selecta-yard',    'Selecta Yard',    'reggae',
   'Sound system dancehall : dubplates et riddims jamaïcains et afro.', false, true),
  ('nova-kassa',      'Nova Kassa',      'afrobeats',
   'Voix solaire et refrains qui restent en tête : clôture du samedi.', true, true),
  ('ile-sound-system','Ilé Sound System','reggae',
   'Un mur d''enceintes, des basses profondes et un MC qui fait chanter tout le Majestic.', false, true),
  ('battle-kompa',    'Battle Kompa & Coupé-décalé', 'coupe-decale',
   'Duels de danseurs en un contre un, jugés par le public.', false, true),
  ('soeur-vinyle',    'Sœur Vinyle',     'reggae',
   'Uniquement des vinyles : du ska des années 60 au reggae de la semaine.', false, true),
  ('ama-rise',        'Ama Rise',        'zouk',
   'La révélation zouk de l''année, chantée en trois langues, avec un chœur de huit voix.', true, true),
  ('kale-les-ondes',  'Kalé & les Ondes','makossa',
   'La makossa revisitée avec une kora, des synthés et beaucoup d''énergie.', false, true),
  ('tanka',           'Tanka',           'rap',
   'Le rappeur clôture le VIMAS FEST avec un show pensé pour l''occasion.', true, true);

-- ----------------------------------------------------------------------------
-- Les concerts — samedi 26 et dimanche 27 décembre, heure du Cameroun (UTC+1)
-- ----------------------------------------------------------------------------
-- Deux concerts d'une même scène ne se chevauchent jamais
-- (contrainte creneaux_sans_chevauchement).
insert into public.creneaux (artiste_id, scene_id, debut, fin) values
  -- Samedi 26 décembre
  ('mboa-brass-band',  'podium-mode',  '2026-12-26 11:00+01', '2026-12-26 12:00+01'),
  ('roots-mbeng',      'grande-scene', '2026-12-26 14:00+01', '2026-12-26 15:00+01'),
  ('defile-wax-roots', 'podium-mode',  '2026-12-26 16:00+01', '2026-12-26 16:45+01'),
  ('lady-soca',        'grande-scene', '2026-12-26 17:30+01', '2026-12-26 18:30+01'),
  ('selecta-yard',     'podium-mode',  '2026-12-26 19:00+01', '2026-12-26 20:30+01'),
  ('nova-kassa',       'grande-scene', '2026-12-26 20:30+01', '2026-12-26 22:00+01'),

  -- Dimanche 27 décembre
  ('ile-sound-system', 'grande-scene', '2026-12-27 12:00+01', '2026-12-27 13:00+01'),
  ('battle-kompa',     'podium-mode',  '2026-12-27 15:00+01', '2026-12-27 16:00+01'),
  ('soeur-vinyle',     'podium-mode',  '2026-12-27 16:30+01', '2026-12-27 18:00+01'),
  ('ama-rise',         'grande-scene', '2026-12-27 17:00+01', '2026-12-27 18:00+01'),
  ('kale-les-ondes',   'grande-scene', '2026-12-27 18:30+01', '2026-12-27 19:30+01'),
  ('tanka',            'grande-scene', '2026-12-27 20:30+01', '2026-12-27 22:00+01');

-- ----------------------------------------------------------------------------
-- Les séances de dédicaces (leur QR est relié plus bas)
-- ----------------------------------------------------------------------------
insert into public.dedicaces (artiste_id, lieu_id, debut, fin) values
  ('nova-kassa', 'service-dedicaces', '2026-12-26 18:30+01', '2026-12-26 19:15+01'),
  ('ama-rise',   'service-dedicaces', '2026-12-27 15:30+01', '2026-12-27 16:15+01'),
  ('tanka',      'service-dedicaces', '2026-12-27 18:30+01', '2026-12-27 19:15+01');

-- ----------------------------------------------------------------------------
-- Les QR codes
-- ----------------------------------------------------------------------------
-- Le code imprimé est « DQ- » + 6 caractères de l'alphabet du jeu (ni I, ni O,
-- ni 0, ni 1). XP du barème par défaut : scène 30, stand 20, food 15, service
-- 10, dédicace 100, relique 75 / 150 / 300 selon la rareté, surprise 80.
-- ⚠ Les reliques sont livrées ACTIVES pour les essais. En vrai, on n'allume
-- une relique qu'une fois l'objet caché : son indice est public dès l'allumage.
insert into public.qr_codes (code, label, type, rarity, xp_reward, hint, active) values
  ('DQ-VSCGRD', 'Grande Scène',         'scene',     null,  30, null, true),
  ('DQ-VSCPDM', 'Le Podium Mode',       'scene',     null,  30, null, true),

  ('DQ-VSTRAD', 'Radio Écho',           'stand',     null,  20, null, true),
  ('DQ-VSTKRA', 'Maison Kora',          'stand',     null,  20, null, true),
  ('DQ-VSTBAR', 'Buvette du Majestic',  'stand',     null,  20, null, true),
  ('DQ-VSTQST', 'Stand Vimas Quest',    'stand',     null,  20, null, true),

  ('DQ-VFDYAS', 'Chez Yassa',           'foodtruck', null,  15, null, true),
  ('DQ-VFDBRZ', 'Le Braisé',            'foodtruck', null,  15, null, true),

  ('DQ-VSVEAU', 'Point d''eau Grande Scène', 'service', null, 10, null, true),

  ('DQ-VRLWAX', 'Le coupon de wax',     'relique', 'commune',    75,
   'Près de ceux qui habillent le festival, sous une pile de tissus.', true),
  ('DQ-VRLVYN', 'Le 45 tours perdu',    'relique', 'rare',      150,
   'Là où le son se mixe, derrière les platines du Podium.', true),
  ('DQ-VRLBBN', 'La première bobine',   'relique', 'legendaire', 300,
   'Le Majestic l''a projetée avant toi, tout en haut des marches.', true),

  ('DQ-VDDNVK', 'Dédicace — Nova Kassa', 'dedicace', null, 100, null, true),
  ('DQ-VDDAMA', 'Dédicace — Ama Rise',   'dedicace', null, 100, null, true),
  ('DQ-VDDTNK', 'Dédicace — Tanka',      'dedicace', null, 100, null, true),

  ('DQ-VSPPRD', 'Parade de clôture',    'surprise',  null,  80,
   'Distribué par l''équipe pendant la parade du dimanche. Ne se colle nulle part.', true);

-- Un lieu = un QR (le lien se règle d'habitude dans l'écran « QR et reliques »)
update public.lieux l set qr_code_id = q.id from public.qr_codes q
 where (l.id, q.code) in (
   ('grande-scene','DQ-VSCGRD'), ('podium-mode','DQ-VSCPDM'),
   ('stand-radio','DQ-VSTRAD'), ('stand-kora','DQ-VSTKRA'),
   ('stand-bar','DQ-VSTBAR'), ('stand-quest','DQ-VSTQST'),
   ('food-yassa','DQ-VFDYAS'), ('food-braise','DQ-VFDBRZ'),
   ('eau-scene','DQ-VSVEAU'));

-- Une séance de dédicaces = un QR (le scan fait entrer l'artiste dans la collection)
update public.dedicaces d set qr_code_id = q.id from public.qr_codes q, public.artistes a
 where a.id = d.artiste_id and q.type = 'dedicace'
   and q.label = 'Dédicace — ' || a.nom;

-- ----------------------------------------------------------------------------
-- Les missions
-- ----------------------------------------------------------------------------
-- counter : ce que la base sait compter toute seule (_compteurs_mission).
-- « manuel » = validée par l'équipe au stand.
insert into public.quests (title, description, counter, goal_count, xp_reward, categorie, priorite, requires_staff, badge_id) values
  ('Échauffement',        'Scanne ton premier QR du festival. N''importe lequel.',                  'scan_any',       1, 50,  'exploration', 1,  false,
   (select id from public.badges where name = 'Échauffement')),
  ('Tour du propriétaire','Scanne 8 QR différents : scènes, stands, food, services.',              'scan_any',       8, 200, 'exploration', 2,  false, null),
  ('Tournée des scènes',  'Scanne les 2 scènes. Pendant un concert, l''artiste entre dans ta collection.', 'scan_scene', 2, 150, 'musique', 3, false,
   (select id from public.badges where name = 'En tournée')),
  ('Gourmet du festival', 'Goûte et scanne les 2 food-trucks du festival.',                         'scan_foodtruck', 2, 150, 'gourmand',    4,  false,
   (select id from public.badges where name = 'Gourmet')),
  ('Le village en entier','Scanne 3 stands.',                                                       'scan_stand',     3, 150, 'exploration', 5,  false, null),
  ('Chasse aux reliques', 'Retrouve 2 reliques cachées dans l''enceinte. Les indices sont dans ta collection.', 'scan_relique', 2, 300, 'defi', 6, false, null),
  ('Autographe',          'Fais-toi dédicacer quelque chose et scanne le QR de la séance.',         'scan_dedicace',  1, 200, 'social',      7,  false, null),
  ('Oreille musicale',    'Participe à une manche du blind test.',                                  'blind',          1, 150, 'musique',     8,  false, null),
  ('Deux manches',        'Participe aux 2 manches du blind test, samedi et dimanche.',             'blind',          2, 300, 'musique',     9,  false, null),
  ('Cœur du public',      'Donne 3 cœurs à des artistes ou à des stands que tu as vus.',            'coeur',          3, 150, 'social',      10, false, null),
  ('Ambassadeur Vimas',   'Fais découvrir le jeu à quelqu''un et passe au Stand Vimas Quest avec lui.', 'manuel',     1, 100, 'social',      11, true,  null);

-- ----------------------------------------------------------------------------
-- Les lots de la roue (fictifs, à négocier avec Vimas Production)
-- ----------------------------------------------------------------------------
-- weight = chances relatives ; stock null = illimité ; court = le mot écrit
-- sur la case (12 caractères au plus).
insert into public.roulette_prizes (name, court, icon, kind, value, weight, stock, rarete, active, badge_id) values
  ('Sticker Vimas Quest',          'Sticker',   'etoile',   'objet',  0,   20, 300,  'commun',     true, null),
  ('Bracelet du VIMAS FEST',       'Bracelet',  'cadeau',   'objet',  0,   14, 150,  'commun',     true, null),
  ('Bon pour une boisson',         'Boisson',   'goutte',   'objet',  0,   12, 100,  'commun',     true, null),
  ('Bon pour une brochette',       'Soya',      'couverts', 'objet',  0,   10, 80,   'commun',     true, null),
  ('100 XP',                       '100 XP',    'eclair',   'xp',     100, 15, null, 'commun',     true, null),
  ('2 jetons de roue',             '2 jetons',  'jeton',    'jetons', 2,   10, null, 'commun',     true, null),
  ('300 XP',                       '300 XP',    'eclair',   'xp',     300, 6,  null, 'rare',       true, null),
  ('Casquette Vimas',              'Casquette', 'cadeau',   'objet',  0,   7,  40,   'rare',       true, null),
  ('T-shirt VIMAS FEST 1re édition','T-shirt',  'cadeau',   'objet',  0,   4,  30,   'rare',       true, null),
  ('Pass backstage (1 concert)',   'Backstage', 'cadenas',  'objet',  0,   1,  2,    'legendaire', true,
   (select id from public.badges where name = 'Backstage')),
  ('Presque !',                    'Presque !', 'onde',     'rien',   0,   11, null, 'commun',     true, null);

-- ----------------------------------------------------------------------------
-- Les annonces (48 h de visibilité côté joueurs)
-- ----------------------------------------------------------------------------
insert into public.announcements (message, type, titre, categorie, lien, lien_libelle, fin) values
  ('Le Majestic ouvre à 10 h samedi et dimanche, fermeture à 22 h.',
   'info', 'Horaires du site', 'horaire', 'infos.html', 'Toutes les infos', null),
  ('Scanne le QR de ta scène pendant le concert : l''artiste entre dans ta collection et tu gagnes un cœur à donner.',
   'info', 'Astuce du jeu', 'jeu', 'collection.html', 'Voir ma collection', null),
  ('Averse possible en fin d''après-midi. En cas de pluie, le hall du Majestic sert d''abri.',
   'alerte', 'Pluie possible', 'meteo', 'plan.html', 'Trouver l''abri', null);

-- ----------------------------------------------------------------------------
-- Le blind test — deux manches préparées (boss FICTIFS, aucune image)
-- ----------------------------------------------------------------------------
-- PV du boss ≈ 600 points par joueur et par question (une cinquantaine de joueurs).
insert into public.quiz_sessions (title, kind, status, boss_name, boss_hp_max, raid_bonus_xp) values
  ('VIMAS — Manche 1 : les musiques du week-end', 'raid', 'preparee', 'Le Selecta masqué',     240000, 0),
  ('VIMAS — Manche 2 : le VIMAS FEST',            'raid', 'preparee', 'Le Gardien du Majestic', 240000, 0);

insert into public.quiz_questions (session_id, question_order, question, choices, correct_index, duration_seconds, categorie, reponse, anecdote)
select s.id, q.ordre, q.question, q.choix::jsonb, q.bonne, q.duree, q.categorie, q.reponse, q.anecdote
from public.quiz_sessions s
join (values
  (1, 1, 'Le reggae est né dans quel pays ?',
      '["La Jamaïque","Haïti","Cuba","Trinité-et-Tobago"]', 0, 20, 'Origines', 'La Jamaïque',
      'Né à la fin des années 1960, il a fait le tour du monde.'),
  (1, 2, 'La soca vient de quelle île ?',
      '["La Jamaïque","Trinité-et-Tobago","La Guadeloupe","Cuba"]', 1, 20, 'Origines', 'Trinité-et-Tobago',
      'C''est la musique du carnaval de Trinidad.'),
  (1, 3, 'Le kompa est la musique de quel pays ?',
      '["La Martinique","La Jamaïque","Haïti","Le Cameroun"]', 2, 20, 'Origines', 'Haïti',
      'Un rythme de danse à deux, joué dans toute la Caraïbe.'),
  (1, 4, 'Le zouk est né dans quelles îles ?',
      '["Cuba et Porto Rico","La Réunion et Maurice","Les Bahamas","La Guadeloupe et la Martinique"]', 3, 20, 'Origines', 'La Guadeloupe et la Martinique',
      'Né aux Antilles françaises au début des années 1980.'),
  (1, 5, 'Le makossa est né dans quelle ville ?',
      '["Douala","Yaoundé","Bafoussam","Garoua"]', 0, 20, 'Cameroun', 'Douala',
      'Sur les bords du Wouri, avant de conquérir tout le pays.'),
  (1, 6, 'Le bikutsi vient surtout de quelle partie du Cameroun ?',
      '["L''Extrême-Nord","Le Centre et le Sud","Le Littoral","L''Ouest"]', 1, 20, 'Cameroun', 'Le Centre et le Sud',
      'C''est la musique des peuples beti : on est chez lui à Yaoundé.'),
  (1, 7, 'Quel instrument traditionnel accompagne le bikutsi ?',
      '["La kora","Le djembé","Le balafon","Le ngoni"]', 2, 20, 'Instrument', 'Le balafon',
      'Les lames de bois frappées donnent au bikutsi sa pulsation.'),
  (1, 8, 'Le dancehall descend de quelle musique ?',
      '["Le jazz","La rumba","Le rock","Le reggae"]', 3, 20, 'Origines', 'Le reggae',
      'Des riddims plus rapides, un MC qui « toaste » par-dessus.'),

  (2, 1, 'Où se joue le VIMAS FEST ?',
      '["Au Majestic Cinéma de l''Université de Yaoundé I","Au Palais des Sports","Au stade Ahmadou-Ahidjo","Au boulevard du 20-Mai"]', 0, 20, 'Festival', 'Au Majestic Cinéma',
      'Un cinéma en plein air, sur le campus de Ngoa-Ekellé.'),
  (2, 2, 'C''est la combientième édition du VIMAS FEST ?',
      '["La 2e","La 1re","La 5e","La 10e"]', 1, 15, 'Festival', 'La 1re',
      'Une première : tu y étais.'),
  (2, 3, 'Qui clôture le samedi sur la Grande Scène ?',
      '["Tanka","Ama Rise","Nova Kassa","Roots Mbeng"]', 2, 20, 'Programme', 'Nova Kassa',
      'Rendez-vous samedi à 20 h 30, devant l''écran.'),
  (2, 4, 'Où passe le défilé Wax & Roots ?',
      '["Sur la Grande Scène","Dans le hall du Majestic","À la tente dédicaces","Sur le Podium Mode"]', 3, 20, 'Programme', 'Sur le Podium Mode',
      'Samedi à 16 h, sur le parking du Majestic.'),
  (2, 5, 'Quelle artiste chante du zouk dimanche ?',
      '["Ama Rise","Lady Soca","Sœur Vinyle","Nova Kassa"]', 0, 20, 'Programme', 'Ama Rise',
      'Un chœur de huit voix l''accompagne.'),
  (2, 6, 'Qui clôture le festival dimanche ?',
      '["Kalé & les Ondes","Tanka","Selecta Yard","Mboa Brass Band"]', 1, 20, 'Programme', 'Tanka',
      'Dimanche à 20 h 30, Grande Scène.'),
  (2, 7, 'Que faut-il pour retirer un lot gagné à la roue ?',
      '["Rien, il arrive par la poste","Un mot de passe","Son bon, au Stand Vimas Quest","Une photo du lot"]', 2, 15, 'Le jeu', 'Son bon, au Stand Vimas Quest',
      'Jusqu''au dimanche 21 h 30.'),
  (2, 8, 'Comment s''appelle le jeu du festival ?',
      '["Majestic Quest","Fest Hunt","Vimas Go","Vimas Quest"]', 3, 15, 'Le jeu', 'Vimas Quest',
      'Tu es en train d''y jouer.')
) as q(manche, ordre, question, choix, bonne, duree, categorie, reponse, anecdote)
  on s.title = case q.manche when 1 then 'VIMAS — Manche 1 : les musiques du week-end'
                             else 'VIMAS — Manche 2 : le VIMAS FEST' end;

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
