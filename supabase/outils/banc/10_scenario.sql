-- ============================================================================
-- Banc d'essai LOCAL : un festival en accéléré sur 00_schema + 01_reference.
-- S'arrête à la première erreur (psql -v ON_ERROR_STOP=1).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- --- L'équipe : un Game Master et un vendeur --------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'gm@test.local'),
  ('00000000-0000-0000-0000-00000000a002', 'vendeur@test.local');
insert into public.staff (user_id, display_name, role) values
  ('00000000-0000-0000-0000-00000000a001', 'GM', 'gm'),
  ('00000000-0000-0000-0000-00000000a002', 'Awa', 'vendeur');

-- --- Côté console (GM connecté) --------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);

do $$
declare v json; v_q uuid; v_s uuid; t text;
begin
  assert (public.mon_acces()->>'gm')::boolean, 'mon_acces gm';
  foreach t in array array['scene','stand','foodtruck','service','dedicace','surprise'] loop
    perform public.console_qr_enregistrer(null, jsonb_build_object('nom', 'QR ' || t, 'type', t));
  end loop;
  v := public.console_qr_enregistrer(null, jsonb_build_object('nom', 'Relique du banc', 'type', 'relique',
                                                              'rarete', 'rare', 'actif', true));
  assert v->>'code' like 'DQ-%' and (select xp_reward = 150 from public.qr_codes where id = (v->>'id')::uuid),
         'relique : ' || v::text;
  for i in 2..5 loop
    perform public.console_qr_enregistrer(null, jsonb_build_object('nom', 'Stand ' || i, 'type', 'stand'));
  end loop;

  v := public.console_mission_enregistrer(null, jsonb_build_object('titre', 'Tournée des scènes',
         'consigne', 'Scanne une scène', 'compteur', 'scan_scene', 'objectif', 1, 'xp', 40));
  v := public.console_mission_enregistrer(null, jsonb_build_object('titre', 'Aide un bénévole',
         'consigne', 'Validée au stand', 'compteur', 'manuel', 'objectif', 1, 'xp', 60));
  v := public.console_mission_enregistrer(null, jsonb_build_object('titre', 'Cœur sur la main',
         'consigne', 'Donne un cœur', 'compteur', 'coeur', 'objectif', 1, 'xp', 20));

  v := public.admin_create_quiz_session('Blind test du vendredi', 'raid', 'Manu Dibango', null, 100, 50);
  v_s := (v->>'id')::uuid;
  perform public.admin_create_quiz_question(v_s, 'Qui chante « Soul Makossa » ?', '["Manu Dibango","Richard Bona","Petit Pays","Charlotte Dipanda"]'::jsonb, 0, 20);
  perform public.admin_create_quiz_question(v_s, 'Quel instrument ?', '["Saxophone","Kora"]'::jsonb, 0, 20);
  perform public.admin_create_prize('Casquette DOMAF', 'etoile', 10, 5);

  v := public.carnet_creer('Awa', 3);
  assert json_array_length(v->'tickets') = 3, 'carnet';
  perform public.carnet_attribuer((v->'carnet'->>'id')::uuid, 'vendeur@test.local');
  update public.billetterie_config set actif = true where id = 1;
  raise notice 'console GM : ok';
end $$;

-- Les codes de tickets sont lus par l'administrateur de la base (hors rôle).
reset role;
create temp table t_tickets as select code, rang from public.tickets order by rang;
grant select on t_tickets to anon, authenticated;
-- Un stand du plan relié à son QR : on pourra lui donner un cœur
insert into public.lieux (id, categorie, nom, qr_code_id)
select 'stand-banc', 'stand', 'Stand du banc', id from public.qr_codes where label = 'QR stand';

-- --- Côté joueur (téléphone, rôle anon) ------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  v json; v_code text; v_pid uuid; v_qr record; v_ticket text; v_q json;
begin
  -- Sans ticket : refusé (billetterie allumée)
  begin
    perform public.create_player('Sans ticket', 'soleil');
    raise exception 'create_player aurait dû exiger un ticket';
  exception when others then
    assert sqlerrm = 'TICKET_REQUIS', sqlerrm;
  end;

  select code into v_ticket from t_tickets where rang = 1;
  v := public.create_player('Kiki', 'soleil', v_ticket);
  v_code := v->>'secret_code';
  v_pid  := (v->'player'->>'id')::uuid;
  assert v_code ~ '^[A-Z]{2,6}-[0-9]{5}$', 'code secret ' || v_code;
  assert (public.login_with_code(lower(v_code))->>'pseudo') = 'Kiki', 'login';
  assert (public.pass_etat(v_code)->>'actif')::boolean, 'pass du jour';
  assert (public.ticket_verifier(v_ticket)->>'etat') = 'utilise', 'ticket utilisé';
  raise notice 'inscription : ok (%)', v_code;
end $$;

reset role;
create temp table t_joueur as
  select p.id, s.secret_code from public.players p join public.player_secrets s on s.player_id = p.id;
create temp table t_qr as select code, type from public.qr_codes;
grant select on t_joueur, t_qr to anon, authenticated;
set role anon;

do $$
declare v json; v_code text; r record; n int := 0; v_h json;
begin
  select secret_code into v_code from t_joueur;
  for r in select code, type from t_qr order by type, code loop
    v := public.scan_qr(v_code, r.code);
    n := n + 1;
  end loop;
  begin
    perform public.scan_qr(v_code, (select code from t_qr limit 1));
    raise exception 'double scan accepté';
  exception when others then assert sqlerrm = 'DEJA_SCANNE', sqlerrm; end;

  v_h := public.player_home(v_code);
  assert v_h->'tresor' is null, 'le trésor a disparu';
  -- Lève-tôt / Noctambule dépendent de l'heure où tourne le banc : pas comptés
  assert (select count(*) from json_array_elements(v_h->'badges') b where (b->>'owned')::boolean
            and b->>'name' not in ('Lève-tôt', 'Noctambule')) = 4,
         'badges système attendus : ' || (select string_agg(b->>'name', ', ') from json_array_elements(v_h->'badges') b where (b->>'owned')::boolean);
  assert (v_h->'player'->>'rank') in ('Fan', 'Spectateur', 'Groupie'), 'rang ' || (v_h->'player'->>'rank');
  assert (v_h->>'jour_label') is not null, 'jour_label';
  assert json_array_length(public.player_collection(v_code)->'reliques') = 1
     and public.player_collection(v_code)->'reliques'->0->>'nom' = 'Relique du banc', 'collection : relique trouvée';
  raise notice 'scans : % QR, XP = %, rang = %', n, v_h->'player'->>'xp', v_h->'player'->>'rank';

  -- Coups de cœur (+ mission de compteur coeur)
  v := public.coeur_liste(v_code);
  assert json_array_length(v->'stands') = 1 and (v->'stands'->0->>'vu')::boolean, 'stands cœur : ' || (v->>'stands');
  v := public.coeur_donner(v_code, 'stands', 'stand-banc');
  assert (v->>'gain')::int = 30, 'cœur + mission : ' || v::text;

  -- Fiche en un appel, téléphone compris (le détail : 210_collecte.sql)
  v := public.fiche_enregistrer(v_code, '{"tranche_age": "25-30", "sexe": "fille", "quartier": "bonamoussadi",
         "genre_prefere": "makossa", "situation": "salarie", "concerts_an": "3-5"}', '+237 6 99 12 34 56', true, false);
  assert (v->>'faits')::int = 6 and (v->>'tour_offert')::boolean, 'fiche : ' || v::text;
  begin
    perform public.fiche_enregistrer(v_code, '{"anime_prefere": "naruto"}');
    raise exception 'ancien champ accepté';
  exception when others then assert sqlerrm = 'CHAMP_INCONNU', sqlerrm; end;

  -- Roulette
  v := public.spin_roulette(v_code);
  assert v->'prize' is not null, 'roulette';

  -- Classement, écran géant
  assert (public.leaderboard_view((select id from t_joueur))->'me'->>'position')::int = 1, 'classement';
  assert json_array_length(public.live_board()->'players') = 1, 'live_board';
  perform public.live_stats();
  assert public.coeur_palmares('stands', 5)->0->>'nom' = 'Stand du banc', 'palmarès';
  perform public.profil_public_stats();
  raise notice 'parcours joueur : ok';
end $$;

-- Le téléphone ne peut RIEN faire côté console
do $$
begin
  begin
    perform public.admin_stats();
    raise exception 'anon a exécuté admin_stats';
  exception when insufficient_privilege then null; end;
  begin
    perform public._code_secret_tirage();
    raise exception 'anon a tiré un code secret';
  exception when insufficient_privilege then null; end;
  begin
    update public.players set xp = 99999;
    if found then raise exception 'anon a modifié l''XP'; end if;
  end;
  raise notice 'refus côté téléphone : ok';
end $$;

-- --- Blind test (moteur raid) ---------------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', false);  -- le vendeur anime

do $$
declare v_s uuid; v json; v_code text; v_q json;
begin
  -- quiz_sessions n'a pas de politique de lecture : on passe par la console.
  v_s := (public.admin_list_quiz_sessions()->0->>'id')::uuid;
  perform public.admin_quiz_start(v_s);
  perform public.admin_quiz_next(v_s);

  set local role anon;
  select secret_code into v_code from t_joueur;
  begin
    perform public.scan_qr(v_code, 'DQ-XXXXXX');
    raise exception 'scan accepté pendant le blind test';
  exception when others then assert sqlerrm = 'PHASE_RAID', sqlerrm; end;
  v_q := public.quiz_state(v_code);
  perform public.quiz_answer(v_code, ((v_q->'question')->>'id')::uuid, 0);
  -- PV cachés à l'écran tant que la question est ouverte (5.2)
  assert public.quiz_board()->'raid'->>'damage' is null, 'PV montrés pendant la question';
  set local role authenticated;

  perform public.admin_quiz_live(v_s);
  v := public.admin_quiz_end(v_s);
  assert (select payload->>'message' from public.events where type = 'raid' order by created_at desc limit 1)
         like 'VICTOIRE ! Le public a conquis « Manu Dibango »%', 'message de fin';
  assert (public.quiz_board()->'raid'->>'damage')::int > 0, 'dégâts';
  perform public.admin_set_phase('EXPLORATION');
  perform public.vendeur_award_bonus((select id from t_joueur), 20, 'Danse au stand');
  perform public.carnet_liste();
  raise notice 'blind test + vendeur : ok';
end $$;

-- --- Clôture, statistiques (GM) -----------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v_code text; v json; r record;
begin
  perform public.admin_set_phase('CLOTURE');
  assert (select count(*) from public.tournament_kings) = 1, 'roi du jour';

  for r in select unnest(array[
    'admin_stats','stats_parcours','console_joueurs','admin_journal_bonus',
    'profil_stats','billetterie_stats','console_badges','console_qr',
    'console_missions','admin_list_quiz_sessions','admin_recent_spins']) as f
  loop
    execute format('select public.%I()', r.f) into v;
    assert v is not null, r.f;
  end loop;
  assert json_array_length(public.console_joueurs()->'joueurs') = 1, 'liste joueurs';
  assert (public.stats_parcours()->'jours'->0->>'joueurs')::int = 1, 'stats parcours';
  raise notice 'clôture + statistiques : ok';
end $$;

-- --- Fonctions modifiées restantes -----------------------------------------
reset role;
-- 10 profils fictifs pour ouvrir les statistiques publiques (seuil = 10)
insert into public.players (pseudo, archetype)
  select 'Figurant ' || g, 'ondes' from generate_series(1, 10) g;
insert into public.player_profile (player_id, tranche_age, quartier, genre_prefere)
  select id, '19-24', 'akwa', 'bikutsi' from public.players where pseudo like 'Figurant %';
update public.tickets set jour = public.jour_jeu() - 1 where utilise_par is not null;
update public.billetterie_config set actif = true where id = 1;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json; v_code text; v_pid uuid; v_quete uuid;
begin
  select secret_code, id into v_code, v_pid from t_joueur;
  perform public.admin_set_phase('EXPLORATION');

  v := public.player_home(v_code);
  assert (v->'fiche'->>'faits')::int = 6 and (v->'fiche'->>'telephone')::boolean, 'fiche ' || (v->'fiche')::text;
  v := public.profil_public_stats();
  assert (v->>'pret')::boolean and v->'genre' is not null and v->'anime' is null, 'profil_public_stats ' || v::text;

  -- Ticket d'hier seulement : le vendeur est bloqué, le GM passe (dq.pass_bypass).
  -- (Le vendeur d'abord : le drapeau du GM dure jusqu'à la fin de la transaction.)
  begin
    perform public.vendeur_award_bonus(v_pid, 10, 'Sans ticket');
    raise exception 'le vendeur a récompensé un joueur sans ticket';
  exception when others then assert sqlerrm = 'PASS_REQUIS', sqlerrm; end;
  v := public.admin_award_bonus(v_pid, 15, 'Test');
  v := public.ticket_utiliser(v_code, (select code from t_tickets where rang = 2));
  assert (v->>'ok')::boolean, 'ticket_utiliser';

  select (q->>'id')::uuid into v_quete from json_array_elements(public.console_missions()->'missions') q
   where q->>'compteur' = 'manuel';
  v := public.admin_validate_quest(v_pid, v_quete);
  assert (v->>'xp')::int = 60, 'admin_validate_quest';
  perform public.admin_manual_quests(v_pid);

  begin
    perform public.console_badge_enregistrer((select (b->>'id')::uuid from json_array_elements(public.console_badges()->'badges') b
                                        where b->>'nom' = 'Première note'), '{"nom": "Autre nom", "icone": "onde"}');
    raise exception 'badge système renommé';
  exception when others then assert sqlerrm = 'BADGE_SYSTEME_NOM', sqlerrm; end;

  perform public.carnet_etat((public.carnet_liste()->'carnets'->0->>'id')::uuid);
  perform public.admin_duplicate_quiz_session((public.admin_list_quiz_sessions()->0->>'id')::uuid);
  assert public.jour_festival_label(date '2026-11-26') = 'jeudi'
     and public.jour_festival_label(date '2026-11-29') = 'dimanche', 'jours du festival';
  assert public.jour_de('2026-11-28 02:30:00+01') = date '2026-11-27', 'nuit du vendredi';
  assert public.jour_de('2026-11-28 06:30:00+01') = date '2026-11-28', 'samedi matin';
  reset role;
  assert (select count(distinct split_part(public._code_secret_tirage(), '-', 1))
            from generate_series(1, 60)) >= 20, 'le tirage des codes secrets n''est pas aléatoire';
  set local role authenticated;
  assert public.rank_for_level(public.level_for_xp(7200)) = 'Tête d''affiche', 'rang max';
  raise notice 'fonctions modifiées : ok';
end $$;

reset role;
-- 20_programme.sql compte les lieux : on retire le stand du banc
delete from public.lieux where id = 'stand-banc';
select 'SCÉNARIO COMPLET : OK — jour de jeu = ' || public.jour_jeu() || ', ' || public.jour_festival_label();
