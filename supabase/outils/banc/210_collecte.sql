-- ============================================================================
-- Banc d'essai LOCAL : collecte de données (étape 6.3 bis) — fiche en un appel
-- (fiche_enregistrer, téléphone, majeurs seulement, consentements), coffre du
-- scan (l'XP attend la réponse, un seul coffre, rejouable), ordre des questions
-- (fiche, soir, banque), statistiques, recherche par numéro dans la console ;
-- coût sur la base du banc.
-- Se joue APRÈS 200_contenu.sql (7 000 joueurs). Rallume le coffre, éteint
-- par lancer.sh pour les scénarios précédents.
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

-- Rejouable sur la même base
delete from public.players where pseudo like 'Collecte%';
update public.game_state set phase = 'EXPLORATION' where id = 1;
update public.billetterie_config set actif = false where id = 1;
update public.micro_config set actif = true where id = 1;
-- Missions éteintes : l'XP d'un scan = celle du QR (les montants se comparent)
update public.quests set active = false;
-- Le soir se décide ici, pas à l'heure où tourne le banc (base jetable)
create or replace function public._collecte_soir() returns boolean language sql stable
  set search_path to 'public' as $$ select coalesce(current_setting('banc.soir', true), 'false')::boolean $$;
select set_config('banc.soir', 'false', false);

insert into public.qr_codes (code, label, type, xp_reward)
select 'DQ-CL' || g, 'Stand collecte ' || g, 'stand', 50 from generate_series(1, 80) g
where not exists (select 1 from public.qr_codes where code = 'DQ-CL' || g);

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v json; h json; c json; v_code text; v_code3 text; v_code4 text;
  v_xp int; v_jet int; n int := 0; v_cle text; v_val text; i int;
begin
  v := public.create_player('Collecte_1', 'soleil');  v_code := v->>'secret_code';
  perform set_config('banc.code', v_code, false);

  -- Carte neuve : fiche vide, pas de coffre
  h := public.player_home(v_code);
  assert (h->'fiche'->>'faits')::int = 0 and (h->'fiche'->>'total')::int = 6
     and json_array_length(h->'fiche'->'manquants') = 6
     and not (h->'fiche'->>'telephone')::boolean and not (h->'fiche'->>'majeur')::boolean
     and json_typeof(h->'coffre') = 'null', 'carte neuve : ' || (h->'fiche')::text;

  -- Fiche en partie (le reste « passé ») : 20 XP par réponse
  v := public.fiche_enregistrer(v_code, '{"tranche_age": "16-18", "sexe": "garcon", "quartier": ""}');
  assert (v->>'faits')::int = 2 and (v->>'xp_gagne')::int = 40 and (v->>'jetons_gagnes')::int = 4
     and not (v->>'tour_offert')::boolean, 'fiche partielle : ' || v::text;
  -- Refus : rien n'est écrit
  begin perform public.fiche_enregistrer(v_code, '{"situation": "salarie", "concerts_an": "100"}'); raise exception 'valeur inventée acceptée';
  exception when others then assert sqlerrm = 'VALEUR_INVALIDE', sqlerrm; end;
  begin perform public.fiche_enregistrer(v_code, '{"pseudo": "x"}'); raise exception 'champ inconnu accepté';
  exception when others then assert sqlerrm = 'CHAMP_INCONNU', sqlerrm; end;
  begin perform public.fiche_enregistrer(v_code, '[1]'); raise exception 'tableau accepté';
  exception when others then assert sqlerrm = 'FICHE_INVALIDE', sqlerrm; end;
  begin perform public.fiche_enregistrer(v_code, '{}', '699123456', true, true); raise exception 'numéro d''un mineur accepté';
  exception when others then assert sqlerrm = 'RESERVE_MAJEURS', sqlerrm; end;
  assert (public.player_home(v_code)->'fiche'->>'faits')::int = 2, 'le refus n''a rien écrit';
  -- Un champ déjà rempli n'est ni réécrit ni repayé
  v := public.fiche_enregistrer(v_code, '{"sexe": "fille"}');
  assert (v->>'xp_gagne')::int = 0, 'champ rempli repayé : ' || v::text;

  -- Scan : l'XP part dans le coffre, la question = premier champ vide
  v_xp := (public.player_home(v_code)->'player'->>'xp')::int;
  v := public.scan_qr(v_code, 'DQ-CL1');
  assert v->'coffre'->'question'->>'cle' = 'profil:quartier' and (v->'coffre'->>'xp')::int = 50
     and (v->'coffre'->>'jetons')::int = 5 and (v->'coffre'->>'xp_reponse')::int = 20
     and (v->'coffre'->'question'->>'ordre_fixe')::boolean
     and json_array_length(v->'coffre'->'question'->'options') = 22, 'coffre : ' || (v->'coffre')::text;
  assert (v->>'xp_gagne')::int = 50, 'le scan annonce toujours son XP';
  assert (v->'player'->>'xp')::int = v_xp, 'XP versée avant la réponse';
  -- Second scan sans répondre : même coffre, même question, XP cumulée
  v := public.scan_qr(v_code, 'DQ-CL2');
  assert v->'coffre'->'question'->>'cle' = 'profil:quartier' and (v->'coffre'->>'xp')::int = 100
     and (v->'coffre'->>'scans')::int = 2, 'coffre cumulé : ' || (v->'coffre')::text;
  h := public.player_home(v_code);
  assert (h->'coffre'->>'xp')::int = 100 and (h->'player'->>'xp')::int = v_xp, 'coffre sur la carte';

  -- Ouverture
  v := public.coffre_ouvrir(v_code, 'profil:sexe', 'garcon');
  assert (v->>'perimee')::boolean and v->'coffre'->'question'->>'cle' = 'profil:quartier', 'question périmée : ' || v::text;
  begin perform public.coffre_ouvrir(v_code, 'profil:quartier', 'paris'); raise exception 'quartier inventé accepté';
  exception when others then assert sqlerrm = 'VALEUR_INVALIDE', sqlerrm; end;
  v := public.coffre_ouvrir(v_code, 'profil:quartier', 'Akwa', 2500);
  assert (v->>'ouvert')::boolean and (v->>'xp_gagne')::int = 120 and (v->>'jetons_gagnes')::int = 12
     and (v->'player'->>'xp')::int = v_xp + 120, 'ouverture : ' || v::text;
  -- Réseau coupé, second envoi : rien de plus
  v := public.coffre_ouvrir(v_code, 'profil:quartier', 'akwa');
  assert (v->>'deja')::boolean and (v->'player'->>'xp')::int = v_xp + 120, 'second envoi : ' || v::text;
  assert json_typeof(public.player_home(v_code)->'coffre') = 'null', 'coffre vidé';

  -- La fiche remplie pendant qu'un coffre attend : il reçoit une question neuve
  v := public.scan_qr(v_code, 'DQ-CL3');
  assert v->'coffre'->'question'->>'cle' = 'profil:genre_prefere', 'genre : ' || (v->'coffre')::text;
  v := public.fiche_enregistrer(v_code, '{"genre_prefere": "makossa", "situation": "eleve", "concerts_an": "aucun"}');
  assert (v->>'faits')::int = 6 and (v->>'bonus_fiche')::int = 50 and (v->>'xp_gagne')::int = 110, 'fiche complète : ' || v::text;
  h := public.player_home(v_code);
  assert h->'coffre'->'question'->>'cle' = 'micro:1' and (h->'coffre'->>'xp')::int = 50
     and json_array_length(h->'fiche'->'manquants') = 0, 'question neuve : ' || (h->'coffre')::text;
  -- Le bonus de fiche n'est versé qu'une fois
  v := public.coffre_ouvrir(v_code, 'micro:1', 'moto-taxi', 400);     -- réponse « rapide »
  assert (v->>'xp_gagne')::int = 60 and (v->>'bonus_fiche')::int = 0, 'banque : ' || v::text;

  -- Toute la banque de jour, dans l'ordre, puis plus de question : XP tout de suite
  i := 4;
  loop
    v := public.scan_qr(v_code, 'DQ-CL' || i);
    i := i + 1;
    exit when json_typeof(v->'coffre') = 'null';
    v_cle := v->'coffre'->'question'->>'cle';
    assert v_cle like 'micro:%', 'hors banque : ' || v_cle;
    assert (select moment from public.micro_questions where id = substr(v_cle, 7)::int) = 'toujours', 'question du soir le jour : ' || v_cle;
    v_val := v->'coffre'->'question'->'options'->0->>'valeur';
    c := public.coffre_ouvrir(v_code, v_cle, v_val, 3000);
    assert (c->>'ouvert')::boolean, 'ouverture ' || v_cle;
    n := n + 1;
  end loop;
  assert n = (select count(*) - 1 from public.micro_questions where moment = 'toujours' and active), 'questions de jour : ' || n;
  v_xp := (v->'player'->>'xp')::int;
  assert (v->>'xp_gagne')::int = 50 and v_xp = (public.player_home(v_code)->'player'->>'xp')::int, 'XP directe';

  -- Le soir : les questions du soir d'abord, reposées chaque jour ; N10 et N11 une fois
  perform set_config('banc.soir', 'true', false);
  set local role postgres;           -- réponse de la veille, écrite à la main
  insert into public.micro_votes (player_id, question_id, valeur, jour)
  select p.id, q.id, 'bien', public.jour_jeu() - 1
  from public.players p, public.micro_questions q where p.pseudo = 'Collecte_1' and q.code = 'N1';
  set local role anon;
  v := public.scan_qr(v_code, 'DQ-CL' || i);  i := i + 1;
  v_cle := v->'coffre'->'question'->>'cle';
  assert (select code from public.micro_questions where id = substr(v_cle, 7)::int) = 'N1', 'soir : ' || v_cle;
  perform public.coffre_ouvrir(v_code, v_cle, 'inoubliable');
  n := 0;
  loop
    v := public.scan_qr(v_code, 'DQ-CL' || i);
    i := i + 1;
    exit when json_typeof(v->'coffre') = 'null';
    v_cle := v->'coffre'->'question'->>'cle';
    v_val := v->'coffre'->'question'->'options'->0->>'valeur';
    perform public.coffre_ouvrir(v_code, v_cle, v_val);
    n := n + 1;
  end loop;
  -- 10 questions du soir restantes, moins N2 (moins de 2 artistes du jour au banc ?)
  assert n between 9 and 10, 'soir : ' || n;
  set local role postgres;           -- micro_votes : lecture staff seulement
  assert (select count(*) from public.micro_votes v join public.players p on p.id = v.player_id
          join public.micro_questions q on q.id = v.question_id
          where p.pseudo = 'Collecte_1' and q.code = 'N1') = 2, 'N1 reposée chaque jour';
  set local role anon;
  perform set_config('banc.soir', 'false', false);

  -- Téléphone : majeur, deux consentements, un bonus par numéro
  v := public.create_player('Collecte_3', 'soleil');  v_code3 := v->>'secret_code';
  v := public.create_player('Collecte_4', 'soleil');  v_code4 := v->>'secret_code';
  perform set_config('banc.code3', v_code3, false);
  begin perform public.fiche_enregistrer(v_code3, '{}', '699000001'); raise exception 'numéro sans âge accepté';
  exception when others then assert sqlerrm = 'RESERVE_MAJEURS', sqlerrm; end;
  begin perform public.fiche_enregistrer(v_code3, '{"tranche_age": "25-30"}', '12345'); raise exception 'numéro faux accepté';
  exception when others then assert sqlerrm = 'NUMERO_INVALIDE', sqlerrm; end;
  begin perform public.fiche_enregistrer(v_code3, '{"tranche_age": "25-30"}', '+33 6 99 00 00 01'); raise exception 'numéro étranger accepté';
  exception when others then assert sqlerrm = 'NUMERO_INVALIDE', sqlerrm; end;
  v := public.fiche_enregistrer(v_code3, '{"tranche_age": "25-30"}', '+237 6 99 00 00 01', true, false);
  assert (v->>'tour_offert')::boolean and (v->>'jetons_gagnes')::int = 2 + (select roulette_cost from public.game_state where id = 1)
     and (v->>'telephone')::boolean, 'téléphone : ' || v::text;
  assert (public.player_home(v_code3)->'fiche'->>'telephone')::boolean and (public.player_home(v_code3)->'fiche'->>'majeur')::boolean, 'carte : téléphone';
  -- Même numéro sur une autre carte : enregistré, sans bonus
  v := public.fiche_enregistrer(v_code4, '{"tranche_age": "41+"}', '699000001', false, true);
  assert not (v->>'tour_offert')::boolean, 'numéro déjà servi : ' || v::text;
  -- Changer d'avis : le numéro et les cases se mettent à jour, sans nouveau bonus
  v := public.fiche_enregistrer(v_code3, '{}', '677000002', false, false);
  assert not (v->>'tour_offert')::boolean, 'second numéro : ' || v::text;
  raise notice 'fiche, coffre, banque (jour et soir), téléphone : ok';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- Ce que la base garde
do $$
begin
  assert (select consent::text || partenaires::text || telephone from public.player_contact k
          join public.players p on p.id = k.player_id where p.pseudo = 'Collecte_3') = 'falsefalse677000002', 'contact Collecte_3';
  assert (select consent::text || partenaires::text from public.player_contact k
          join public.players p on p.id = k.player_id where p.pseudo = 'Collecte_4') = 'falsetrue', 'contact Collecte_4';
  assert (select duree_ms from public.micro_votes v join public.micro_questions q on q.id = v.question_id
          join public.players p on p.id = v.player_id where p.pseudo = 'Collecte_1' and q.code = 'S1') = 400, 'durée gardée';
  assert not exists (select 1 from public.events where payload::text like '%699000001%' or payload::text like '%moto-taxi%'),
    'ni numéro ni réponse dans le journal';
  -- Aucune lecture directe pour le public
  assert not has_table_privilege('anon', 'public.coffres', 'select')
      or not exists (select 1 from pg_policies where tablename = 'coffres'), 'coffres lisibles';
end $$;

-- Console : statistiques, recherche par numéro, fin du numéro sur la fiche
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);   -- le GM
do $$
declare v json; v_id uuid; t0 timestamptz;
begin
  v := public.profil_stats();
  -- + le joueur de 10_scenario.sql (DOMAF oui, partenaires non)
  assert (v->'contacts'->>'total')::int = 3 and (v->'contacts'->>'domaf')::int = 1
     and (v->'contacts'->>'partenaires')::int = 1, 'contacts : ' || (v->'contacts')::text;
  assert json_array_length(v->'questions') = 42, 'questions : ' || json_array_length(v->'questions');
  assert (select (q->>'rapides')::int from json_array_elements(v->'questions') q where q->>'code' = 'S1') = 1, 'réponse rapide comptée';
  assert (select count(*) from json_array_elements(v->'fiche'->'quartier') q where q->>'valeur' = 'akwa') = 1, 'fiche : ' || (v->'fiche'->'quartier')::text;
  assert (v->>'fiches_completes')::int >= 1, 'fiches complètes';

  v := public.console_joueurs('6 99 00 00 01');
  assert json_array_length(v->'joueurs') = 1 and v->'joueurs'->0->>'pseudo' = 'Collecte_4', 'recherche par numéro : ' || v::text;
  v := public.console_joueurs('+237677000002');
  assert v->'joueurs'->0->>'pseudo' = 'Collecte_3', 'recherche +237';
  select id into v_id from public.players where pseudo = 'Collecte_3';
  v := public.console_joueur(v_id);
  assert v->'telephone'->>'fin' = '0002' and v::text not like '%677000002%', 'fiche console : ' || (v->'telephone')::text;

  t0 := clock_timestamp();
  for i in 1..100 loop v := public.profil_stats(); end loop;
  raise notice 'COÛT : profil_stats % ms (% octets)', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2), length(v::text);
  t0 := clock_timestamp();
  for i in 1..100 loop v := public.console_joueurs('699000001'); end loop;
  raise notice 'COÛT : console_joueurs(numéro) % ms', round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2);
end $$;
reset role;

-- Droits : un joueur ne lit ni les coffres ni les numéros
set role anon;
do $$
begin
  begin perform 1 from public.coffres; raise exception 'coffres lus par anon';
  exception when insufficient_privilege then null; when others then
    assert not exists (select 1 from public.coffres), 'coffres visibles'; end;
  begin perform 1 from public.player_contact limit 1;
    assert not exists (select 1 from public.player_contact), 'numéros visibles';
  exception when insufficient_privilege then null; end;
  begin perform public.profil_stats(); raise exception 'statistiques ouvertes';
  exception when others then assert sqlerrm in ('ACCES_REFUSE') or sqlerrm like 'permission denied%', sqlerrm; end;
end $$;
reset role;

-- Coût (connexion neuve) : scan avec coffre, ouverture, carte
\c
set role anon;
do $$
declare v json; h json; t0 timestamptz; t_scan numeric := 0; t_ouv numeric := 0; v_code text; i int;
begin
  v := public.create_player('Collecte_cout', 'soleil');  v_code := v->>'secret_code';
  for i in 1..30 loop
    t0 := clock_timestamp();
    v := public.scan_qr(v_code, 'DQ-CL' || i);
    t_scan := t_scan + extract(epoch from clock_timestamp() - t0);
    if json_typeof(v->'coffre') <> 'null' then
      t0 := clock_timestamp();
      perform public.coffre_ouvrir(v_code, v->'coffre'->'question'->>'cle', v->'coffre'->'question'->'options'->0->>'valeur', 2000);
      t_ouv := t_ouv + extract(epoch from clock_timestamp() - t0);
    end if;
  end loop;
  t0 := clock_timestamp();
  for i in 1..100 loop h := public.player_home(v_code); end loop;
  raise notice 'COÛT : scan_qr avec coffre % ms, coffre_ouvrir % ms, player_home % ms (% octets)',
    round(t_scan * 1000 / 30, 2), round(t_ouv * 1000 / 30, 2),
    round(extract(epoch from clock_timestamp() - t0) * 1000 / 100, 2), length(h::text);
end $$;
reset role;
