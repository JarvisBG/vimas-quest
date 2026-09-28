-- ============================================================================
-- Banc d'essai LOCAL : contenu du jeu dans la console (étape 6.3) —
-- missions, badges, QR (lecture en un appel, enregistrement, suppression
-- refusée après usage, lien QR ↔ lieu / dédicace), badges automatiques
-- Lève-tôt, Noctambule, Marathonien, Podium ; droits et coût.
-- Se joue APRÈS 190_joueurs.sql (7 000 joueurs).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

update public.game_state set phase = 'EXPLORATION' where id = 1;
update public.billetterie_config set actif = false where id = 1;

-- Décor : une scène, un stand, un point d'eau, un artiste et sa dédicace
insert into public.lieux (id, categorie, nom) values
  ('scene-b63', 'scene', 'Scène du banc 6.3'),
  ('stand-b63', 'stand', 'Stand du banc 6.3'),
  ('eau-b63', 'eau', 'Fontaine du banc 6.3');
insert into public.scenes (id) values ('scene-b63');
insert into public.artistes (id, nom) values ('artiste-b63', 'Artiste du banc');
insert into public.dedicaces (id, artiste_id, lieu_id, debut, fin) values
  ('00000000-0000-0000-0000-0000000d6301', 'artiste-b63', 'stand-b63', now() - interval '1 hour', now() + interval '1 hour');
-- Un concert en cours sur la scène (pour Noctambule)
insert into public.creneaux (artiste_id, scene_id, debut, fin)
  values ('artiste-b63', 'scene-b63', now() - interval '30 minutes', now() + interval '30 minutes');

-- --- Droits -----------------------------------------------------------------
set role anon;
do $$
declare f text;
begin
  foreach f in array array['console_missions()', 'console_badges()', 'console_qr()',
                           'console_qr_supprimer(gen_random_uuid())', 'console_activer(''qr'', gen_random_uuid(), true)'] loop
    begin
      execute 'select public.' || f;
      raise exception 'anonyme accepté : %', f;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

set role authenticated;
do $$
declare f text; qui text;
begin
  -- a002 = vendeur, a0ff = compte connecté hors équipe
  foreach qui in array array['00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000a0ff'] loop
    perform set_config('request.jwt.claim.sub', qui, true);
    foreach f in array array['console_missions()', 'console_badges()', 'console_qr()',
                             'console_qr_scans(gen_random_uuid())',
                             'console_mission_enregistrer(null, ''{"titre": "x", "xp": 1, "objectif": 1}'')',
                             'console_badge_enregistrer(null, ''{"nom": "x"}'')',
                             'console_qr_enregistrer(null, ''{"nom": "x", "type": "stand"}'')',
                             'console_mission_supprimer(gen_random_uuid())', 'console_badge_supprimer(gen_random_uuid())',
                             'console_qr_supprimer(gen_random_uuid())', 'console_activer(''qr'', gen_random_uuid(), true)'] loop
      begin
        execute 'select public.' || f;
        raise exception 'accepté pour % : %', qui, f;
      exception when raise_exception then assert sqlerrm = 'ACCES_REFUSE', qui || ' ' || f || ' : ' || sqlerrm;
      end;
    end loop;
  end loop;
end $$;

-- --- Missions (Léa, staff non GM : le contenu est ouvert au staff) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a003', false);
do $$
declare v json; v_id uuid; v_m json;
begin
  begin perform public.console_mission_enregistrer(null, '{"titre": "Faute", "compteur": "scan_scenes", "objectif": 1, "xp": 10}');
    raise exception 'compteur inventé accepté';
  exception when raise_exception then assert sqlerrm = 'COMPTEUR_INVALIDE', sqlerrm; end;
  begin perform public.console_mission_enregistrer(null, '{"titre": "", "objectif": 1, "xp": 10}');
    raise exception 'titre vide accepté';
  exception when raise_exception then assert sqlerrm = 'TITRE_MANQUANT', sqlerrm; end;
  begin perform public.console_mission_enregistrer(null, '{"titre": "XP", "compteur": "scan_any", "objectif": 1, "xp": 9000}');
    raise exception 'XP hors borne acceptée';
  exception when raise_exception then assert sqlerrm = 'XP_INVALIDE', sqlerrm; end;
  begin perform public.console_mission_enregistrer(null, '{"titre": "Obj", "compteur": "scan_any", "objectif": "deux", "xp": 10}');
    raise exception 'objectif illisible accepté';
  exception when raise_exception then assert sqlerrm = 'OBJECTIF_INVALIDE', sqlerrm; end;
  begin perform public.console_mission_enregistrer(null, '{"titre": "Badge", "compteur": "scan_any", "objectif": 1, "xp": 10, "badge_id": "pas-un-uuid"}');
    raise exception 'badge illisible accepté';
  exception when raise_exception then assert sqlerrm = 'BADGE_INCONNU', sqlerrm; end;

  -- Mission staff : l'objectif est forcé à 1 ; tous les champs en un appel
  v := public.console_mission_enregistrer(null, jsonb_build_object(
         'titre', ' Danse au stand ', 'consigne', 'Une danse devant le stand DOMAF', 'type', 'standard',
         'categorie', 'social', 'compteur', 'manuel', 'objectif', 5, 'xp', 50, 'priorite', 3,
         'badge_id', (select id from public.badges where name = 'Backstage')));
  v_id := (v->>'id')::uuid;
  assert (select title = 'Danse au stand' and goal_count = 1 and requires_staff and categorie = 'social'
                 and priorite = 3 and badge_id is not null and active
            from public.quests where id = v_id), 'mission staff enregistrée';
  select m into v_m from json_array_elements(public.console_missions()->'missions') m where (m->>'id')::uuid = v_id;
  assert v_m->>'badge' = 'Backstage' and v_m->>'consigne' like 'Une danse%' and (v_m->>'faites')::int = 0, 'liste : ' || v_m::text;

  -- Éteinte puis rallumée
  perform public.console_activer('mission', v_id, false);
  assert not (select active from public.quests where id = v_id), 'mission éteinte';
  perform public.console_activer('mission', v_id, true);
  begin perform public.console_activer('lot', v_id, true); raise exception 'quoi inventé accepté';
  exception when raise_exception then assert sqlerrm = 'QUOI_INVALIDE', sqlerrm; end;

  -- Jamais terminée : supprimable
  v := public.console_mission_enregistrer(null, '{"titre": "Brouillon", "compteur": "scan_any", "objectif": 3, "xp": 10}');
  perform public.console_mission_supprimer((v->>'id')::uuid);
  assert not exists (select 1 from public.quests where id = (v->>'id')::uuid), 'brouillon supprimé';
  begin perform public.console_mission_supprimer((v->>'id')::uuid); raise exception 'suppression fantôme';
  exception when raise_exception then assert sqlerrm = 'QUETE_INCONNUE', sqlerrm; end;
end $$;

-- Terminée par quelqu'un : la suppression est refusée
reset role;
insert into public.quest_progress (player_id, quest_id, progress, completed_at, jour)
select (select id from public.players where efface_le is null order by created_at limit 1),
       id, 1, now(), public.jour_jeu()
  from public.quests where title = 'Danse au stand';
set role authenticated;
do $$
begin
  perform public.console_mission_supprimer((select id from public.quests where title = 'Danse au stand'));
  raise exception 'mission faite supprimée';
exception when raise_exception then assert sqlerrm = 'MISSION_DEJA_FAITE', sqlerrm;
end $$;

-- --- Badges -----------------------------------------------------------------
do $$
declare v json; v_id uuid; n text;
begin
  -- Tous les badges donnés par leur nom sont protégés
  foreach n in array array['Première note', 'Curieux', 'Fouineur', 'Autographe', 'Jury', 'Oreille d''or',
                           'Lève-tôt', 'Noctambule', 'Marathonien', 'Podium'] loop
    begin
      perform public.console_badge_enregistrer((select id from public.badges where name = n), jsonb_build_object('nom', n || ' bis'));
      raise exception 'badge système renommé : %', n;
    exception when raise_exception then assert sqlerrm = 'BADGE_SYSTEME_NOM', n || ' : ' || sqlerrm; end;
    begin
      perform public.console_badge_supprimer((select id from public.badges where name = n));
      raise exception 'badge système supprimé : %', n;
    exception when raise_exception then assert sqlerrm = 'BADGE_SYSTEME_SUPPRESSION', n || ' : ' || sqlerrm; end;
  end loop;
  -- …mais leur habillage se règle
  perform public.console_badge_enregistrer((select id from public.badges where name = 'Podium'),
    '{"nom": "Podium", "icone": "trophee", "description": "Top 3 d''une journée.", "rarete": "legendaire", "forme": "etoile"}');
  assert (select description = 'Top 3 d''une journée.' from public.badges where name = 'Podium'), 'habillage Podium';

  begin perform public.console_badge_enregistrer(null, '{"nom": "Icône", "icone": "fa-medal"}'); raise exception 'icône Font Awesome acceptée';
  exception when raise_exception then assert sqlerrm = 'ICONE_INVALIDE', sqlerrm; end;
  begin perform public.console_badge_enregistrer(null, '{"nom": "Jury"}'); raise exception 'nom pris accepté';
  exception when raise_exception then assert sqlerrm = 'BADGE_NOM_PRIS', sqlerrm; end;
  begin perform public.console_badge_enregistrer(null, '{"nom": "Rareté", "rarete": "mythique"}'); raise exception 'rareté inventée';
  exception when raise_exception then assert sqlerrm = 'RARETE_INVALIDE', sqlerrm; end;

  v := public.console_badge_enregistrer(null, '{"nom": "Tampon du banc", "icone": "tente", "rarete": "rare", "secret": true}');
  v_id := (v->>'id')::uuid;
  assert (select icon = 'tente' and rarete = 'rare' and secret and forme = 'rond' from public.badges where id = v_id), 'badge créé';
  -- Renommer un badge libre vers un nom système : refusé
  begin perform public.console_badge_enregistrer(v_id, '{"nom": "Podium"}'); raise exception 'nom système pris';
  exception when raise_exception then assert sqlerrm = 'BADGE_NOM_PRIS', sqlerrm; end;

  -- Utilisé par un lot de la roue : non supprimable (la contrainte du lot casserait)
  v := public.admin_create_prize('Badge surprise', 'cadeau', 1, null, false, 'badge', 0, v_id);
  begin perform public.console_badge_supprimer(v_id); raise exception 'badge d''un lot supprimé';
  exception when raise_exception then assert sqlerrm = 'BADGE_UTILISE', sqlerrm; end;
  perform public.admin_delete_prize((v->>'id')::uuid);
  perform public.console_badge_supprimer(v_id);

  -- Déjà gagné : non supprimable
  v := public.console_badge_enregistrer(null, '{"nom": "Gagné au banc"}');
  perform public.admin_award_badge((select id from public.players where efface_le is null order by created_at limit 1),
                                   (v->>'id')::uuid);
  begin perform public.console_badge_supprimer((v->>'id')::uuid); raise exception 'badge gagné supprimé';
  exception when raise_exception then assert sqlerrm = 'BADGE_DEJA_GAGNE', sqlerrm; end;

  v := public.console_badges();
  assert (select (b->>'gagnes')::int = 1 and (b->>'systeme')::boolean = false
            from json_array_elements(v->'badges') b where b->>'nom' = 'Gagné au banc'), 'console_badges gagnés';
  assert (select (b->>'systeme')::boolean from json_array_elements(v->'badges') b where b->>'nom' = 'Jury'), 'Jury système';
end $$;

-- --- QR ---------------------------------------------------------------------
do $$
declare v json; v_rel uuid; v_scene uuid; v_stand uuid; v_ded uuid; v_eau uuid; v_row json;
begin
  -- Une relique naît éteinte (son indice serait public tout de suite)
  v := public.console_qr_enregistrer(null, '{"nom": "Le vinyle perdu", "type": "relique", "rarete": "legendaire", "indice": "Sous la régie"}');
  v_rel := (v->>'id')::uuid;
  assert (select not active and xp_reward = 300 and hint = 'Sous la régie' and rarity = 'legendaire'
            from public.qr_codes where id = v_rel), 'relique éteinte, barème 300';
  begin perform public.console_qr_enregistrer(null, '{"nom": "Sans rareté", "type": "relique"}'); raise exception 'relique sans rareté';
  exception when raise_exception then assert sqlerrm = 'RARETE_MANQUANTE', sqlerrm; end;
  begin perform public.console_qr_enregistrer(null, '{"nom": "Boss", "type": "boss"}'); raise exception 'type Otaku accepté';
  exception when raise_exception then assert sqlerrm = 'TYPE_INVALIDE', sqlerrm; end;

  -- Scène reliée à son lieu ; XP libre
  v := public.console_qr_enregistrer(null, '{"nom": "QR scène 6.3", "type": "scene", "xp": 45, "lieu_id": "scene-b63"}');
  v_scene := (v->>'id')::uuid;
  assert (select qr_code_id from public.lieux where id = 'scene-b63') = v_scene, 'scène reliée';
  assert (select xp_reward from public.qr_codes where id = v_scene) = 45, 'xp libre';
  -- Un lieu, un seul QR
  begin perform public.console_qr_enregistrer(null, '{"nom": "Doublon", "type": "scene", "lieu_id": "scene-b63"}');
    raise exception 'lieu relié deux fois';
  exception when raise_exception then assert sqlerrm = 'LIEU_DEJA_RELIE', sqlerrm; end;
  assert (select count(*) from public.qr_codes where label = 'Doublon') = 0, 'rien créé après le refus';
  -- Le type désigne la catégorie du lieu
  begin perform public.console_qr_enregistrer(null, '{"nom": "Mauvais lieu", "type": "stand", "lieu_id": "scene-b63"}');
    raise exception 'lieu incompatible accepté';
  exception when raise_exception then assert sqlerrm = 'LIEU_INCOMPATIBLE', sqlerrm; end;
  v := public.console_qr_enregistrer(null, '{"nom": "Fontaine", "type": "service", "lieu_id": "eau-b63"}');
  v_eau := (v->>'id')::uuid;
  assert (select qr_code_id from public.lieux where id = 'eau-b63') = v_eau, 'service ↔ point d''eau';

  -- Stand : relié, puis déplacé sur un autre lieu → l'ancien est libéré
  v := public.console_qr_enregistrer(null, '{"nom": "Stand du banc", "type": "stand", "lieu_id": "stand-b63"}');
  v_stand := (v->>'id')::uuid;
  perform public.console_qr_enregistrer(v_stand, '{"nom": "Stand du banc (sans lieu)", "type": "scene", "rarete": "rare"}');
  assert (select qr_code_id from public.lieux where id = 'stand-b63') is null, 'stand délié';
  -- …le type et la rareté n'ont pas bougé
  assert (select type = 'stand' and rarity is null and label = 'Stand du banc (sans lieu)'
            from public.qr_codes where id = v_stand), 'type figé';
  perform public.console_qr_enregistrer(v_stand, '{"nom": "Stand du banc", "lieu_id": "stand-b63"}');

  -- Dédicace reliée à sa séance
  v := public.console_qr_enregistrer(null, '{"nom": "Dédicace", "type": "dedicace", "dedicace_id": "00000000-0000-0000-0000-0000000d6301"}');
  v_ded := (v->>'id')::uuid;
  assert (select qr_code_id from public.dedicaces where id = '00000000-0000-0000-0000-0000000d6301') = v_ded, 'dédicace reliée';
  begin perform public.console_qr_enregistrer(v_stand, '{"nom": "Stand", "dedicace_id": "00000000-0000-0000-0000-0000000d6301"}');
    raise exception 'dédicace sur un stand';
  exception when raise_exception then assert sqlerrm = 'DEDICACE_INCOMPATIBLE', sqlerrm; end;

  -- La liste montre les liens
  v := public.console_qr();
  select q into v_row from json_array_elements(v->'qr') q where (q->>'id')::uuid = v_scene;
  assert v_row->'lieu'->>'id' = 'scene-b63' and (v_row->>'scans')::int = 0, 'liste scène : ' || v_row::text;
  select q into v_row from json_array_elements(v->'qr') q where (q->>'id')::uuid = v_ded;
  assert v_row->'dedicace'->>'artiste' = 'Artiste du banc', 'liste dédicace : ' || v_row::text;
  assert (select (l->>'qr_id')::uuid from json_array_elements(v->'lieux') l where l->>'id' = 'stand-b63') = v_stand, 'lieux';
  assert (v->'bareme'->>'legendaire')::int = 300 and (v->'bareme'->>'scene')::int = 30, 'barème';

  -- Jamais scanné : supprimable (et son lieu est libéré)
  perform public.console_qr_supprimer(v_eau);
  assert (select qr_code_id from public.lieux where id = 'eau-b63') is null, 'lieu libéré';
end $$;
reset role;

-- --- Badges automatiques (6.3) -----------------------------------------------
-- Un joueur neuf qui a joué les trois journées précédentes
set role anon;
select set_config('request.jwt.claim.sub', '', false);
create temp table t_b63 as select public.create_player('Marathon', 'soleil') as v;
reset role;
grant select on t_b63 to anon, authenticated;
insert into public.scans (player_id, qr_code_id, day, scanned_at)
select (t.v->'player'->>'id')::uuid, (select id from public.qr_codes where label = 'Stand du banc'),
       public.jour_jeu() - g, now() - make_interval(days => g)
  from t_b63 t, generate_series(1, 3) g;
-- Le téléphone ne lit pas qr_codes : le code « imprimé » est noté ici
select set_config('banc.scene', (select code from public.qr_codes where label = 'QR scène 6.3'), false) is not null;

set role anon;
do $$
declare
  v json; v_code text := (select t.v->>'secret_code' from t_b63 t);
  v_pid uuid := (select (t.v->'player'->>'id')::uuid from t_b63 t);
  v_heure int := extract(hour from now() at time zone 'Africa/Douala')::int;
  a boolean;
begin
  -- 4e journée : Marathonien ; Lève-tôt seulement entre 6 h et 17 h (Douala)
  v := public.scan_qr(v_code, current_setting('banc.scene'));
  assert exists (select 1 from public.player_badges pb join public.badges b on b.id = pb.badge_id
                 where pb.player_id = v_pid and b.name = 'Marathonien'), 'Marathonien : ' || v::text;
  a := exists (select 1 from public.player_badges pb join public.badges b on b.id = pb.badge_id
               where pb.player_id = v_pid and b.name = 'Lève-tôt');
  assert a = (v_heure between 6 and 16), 'Lève-tôt à ' || v_heure || ' h : ' || a;
  -- Scène pendant un concert : Noctambule seulement entre minuit et 6 h
  a := exists (select 1 from public.player_badges pb join public.badges b on b.id = pb.badge_id
               where pb.player_id = v_pid and b.name = 'Noctambule');
  assert a = (v_heure < 6), 'Noctambule à ' || v_heure || ' h : ' || a;
  raise notice 'badges automatiques à % h (Douala) : Marathonien oui, Lève-tôt %, Noctambule %',
    v_heure, v_heure between 6 and 16, v_heure < 6;

  -- Scanné : suppression refusée, historique lisible
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a003', true);
  begin perform public.console_qr_supprimer((select id from public.qr_codes where label = 'QR scène 6.3'));
    raise exception 'QR scanné supprimé';
  exception when raise_exception then assert sqlerrm = 'QR_DEJA_SCANNE', sqlerrm; end;
  v := public.console_qr_scans((select id from public.qr_codes where label = 'QR scène 6.3'));
  assert (v->>'total')::int = 1 and (v->>'jour')::int = 1 and v->'derniers'->0->>'pseudo' = 'Marathon'
     and v->'derniers'->0->>'artiste' = 'Artiste du banc', 'historique : ' || v::text;
end $$;
reset role;

-- Podium : les trois premiers de la journée à la clôture (les clôtures des
-- bancs précédents en ont déjà donné : on repart de zéro)
delete from public.player_badges where badge_id = (select id from public.badges where name = 'Podium');
delete from public.events where type = 'badge' and payload->>'badge' = 'Podium';
update public.players set xp_jour = 0 where jour = public.jour_jeu();
update public.players p set xp_jour = x.pts, jour = public.jour_jeu()
  from (values ('Figurant 1', 900), ('Figurant 2', 800), ('Figurant 3', 700), ('Figurant 4', 600)) x(pseudo, pts)
 where p.pseudo = x.pseudo;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
begin
  perform public.admin_set_phase('CLOTURE');
  perform public.admin_set_phase('CLOTURE');   -- rejouée : pas de doublon
  assert (select array_agg(p.pseudo order by p.pseudo) from public.player_badges pb
            join public.badges b on b.id = pb.badge_id join public.players p on p.id = pb.player_id
           where b.name = 'Podium') = array['Figurant 1', 'Figurant 2', 'Figurant 3'], 'Podium';
  assert (select count(*) from public.events where type = 'badge' and payload->>'badge' = 'Podium') = 3, 'Podium une fois';
  perform public.admin_set_phase('EXPLORATION');
end $$;
reset role;

-- --- Coût : 300 QR, ~1 million de scans sur 4 journées, 50 missions --------
insert into public.qr_codes (code, label, type, xp_reward)
select 'DQ-C' || lpad(g::text, 5, '0'), 'QR de charge ' || g,
       (array['scene','stand','foodtruck','service','surprise'])[1 + g % 5], 20
  from generate_series(1, 300) g;
insert into public.quests (title, counter, goal_count, xp_reward)
select 'Mission de charge ' || g, 'scan_any', 1, 10 from generate_series(1, 50) g;
-- 7 000 joueurs × 36 QR × 4 journées
insert into public.scans (player_id, qr_code_id, day, scanned_at)
select p.id, q.id, public.jour_jeu() - d, now() - make_interval(days => d, mins => (random() * 600)::int)
  from (select id, row_number() over (order by id) as r from public.players) p
  join (select id, row_number() over (order by code) as r from public.qr_codes where code like 'DQ-C%') q
    on (q.r + p.r) % 300 < 36
 cross join generate_series(0, 3) d
on conflict do nothing;
-- 7 000 joueurs × 10 missions × 4 journées terminées
insert into public.quest_progress (player_id, quest_id, progress, completed_at, jour)
select p.id, q.id, 1, now(), public.jour_jeu() - d
  from public.players p
  join (select id, row_number() over (order by title) as r from public.quests where title like 'Mission de charge%') q
    on q.r <= 10
 cross join generate_series(0, 3) d
on conflict do nothing;
-- Les totaux tenus par les déclencheurs = les vrais comptes
do $$ begin
  assert (select sum(n) from public.qr_scans_jour) = (select count(*) from public.scans), 'totaux des scans';
  assert (select sum(n) from public.missions_faites_jour)
       = (select count(*) from public.quest_progress where completed_at is not null), 'totaux des missions';
  assert not exists (select 1 from public.qr_scans_jour t
                      where t.n <> (select count(*) from public.scans s where s.qr_code_id = t.qr_code_id and s.day = t.jour)),
         'totaux des scans par QR et par journée';
end $$;
vacuum analyze public.scans;
vacuum analyze public.quest_progress;
vacuum analyze public.player_badges;
-- Chargement en masse : totaux nettoyés avant la mesure (en service, les
-- scans arrivent un par un et l'autovacuum suit).
vacuum analyze public.qr_scans_jour;
vacuum analyze public.missions_faites_jour;
-- Mesure dans une connexion neuve, comme un appel de la console. Dans la
-- session qui venait de charger 1,16 million de scans, console_qr a mesuré
-- 1,5 s une fois (machine encore occupée par le chargement) ; 19 ms en
-- session neuve, 19 ms aussi après 100 000 scans insérés dans la même session.
\c banc_domaf
\set QUIET on
\pset tuples_only on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a003', false);
do $$
declare t0 timestamptz; i int; v json; v_ms numeric;
        v_qr uuid := (select id from public.qr_codes where code = 'DQ-C00001');
        -- Comptés AVANT la mesure : un count(*) sur scans (1,16 million de lignes,
        -- politique RLS à vérifier ligne à ligne) coûte plusieurs secondes et
        -- s'ajoutait au temps de la fonction, évalué plus tôt dans le même raise.
        v_n_qr bigint := (select count(*) from public.qr_codes);
        v_n_scans bigint := (select count(*) from public.scans);
        v_n_quetes bigint := (select count(*) from public.quests);
        v_n_faites bigint := (select count(*) from public.quest_progress where completed_at is not null);
begin
  t0 := clock_timestamp();
  for i in 1..10 loop v := public.console_qr(); end loop;
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000 / 10, 1);
  raise notice 'COÛT sur % QR, % scans : console_qr % ms (% octets)', v_n_qr, v_n_scans, v_ms, length(v::text);
  t0 := clock_timestamp();
  for i in 1..10 loop v := public.console_missions(); end loop;
  v_ms := round(extract(epoch from clock_timestamp() - t0) * 1000 / 10, 1);
  raise notice 'COÛT sur % missions, % terminées : console_missions % ms (% octets)', v_n_quetes, v_n_faites, v_ms, length(v::text);
  t0 := clock_timestamp();
  for i in 1..10 loop v := public.console_badges(); end loop;
  raise notice 'COÛT : console_badges % ms (% octets)', round(extract(epoch from clock_timestamp() - t0) * 1000 / 10, 1), length(v::text);
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.console_qr_scans(v_qr); end loop;
  raise notice 'COÛT : console_qr_scans % ms (% scans sur ce QR)', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2), v->>'total';
end $$;
reset role;

select 'CONTENU : OK';
