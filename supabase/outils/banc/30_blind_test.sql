-- ============================================================================
-- Banc d'essai LOCAL : champs du blind test (étape 2.7).
-- Se joue APRÈS 20_programme.sql (GM, vendeur et billetterie éteinte).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

create temp table t_bt (session_id uuid, question_id uuid, code text);
grant all on t_bt to anon, authenticated;

-- --- Préparation par le GM ------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json; v_s uuid; v_q uuid;
begin
  v := public.admin_create_quiz_session('Blind test du samedi', 'raid', 'Manu Dibango', null, 100, 50);
  v_s := (v->>'id')::uuid;
  v := public.admin_create_quiz_question(v_s, 'Qui joue ce morceau ?',
         '["Nova Kassa","Ama Rise","Tanka","Bleu Cobalt"]'::jsonb, 0, 20);
  v_q := (v->>'id')::uuid;
  insert into t_bt (session_id, question_id) values (v_s, v_q);

  v := public.admin_blind_question(v_q, ' Artiste ', 'Nova Kassa, « Lumière du lac »',
         'Écrit en une nuit.', 'bt/2026-11-28/q01.mp3', 42, 'https://exemple.org/pochette.jpg');
  assert v->>'categorie' = 'Artiste' and (v->>'audio_debut')::int = 42, 'saisie : ' || v::text;

  begin
    perform public.admin_blind_question(v_q, null, null, null, 'javascript:alert(1)', 0, null);
    raise exception 'adresse dangereuse acceptée';
  exception when others then assert sqlerrm = 'ADRESSE_INVALIDE', sqlerrm; end;
  begin
    perform public.admin_blind_question(v_q, null, null, null, null, -1, null);
    raise exception 'début négatif accepté';
  exception when others then assert sqlerrm = 'DEBUT_INVALIDE', sqlerrm; end;
  begin
    perform public.admin_blind_question(gen_random_uuid(), null, null, null, null, 0, null);
    raise exception 'question inconnue acceptée';
  exception when others then assert sqlerrm = 'QUESTION_INCONNUE', sqlerrm; end;
  -- La saisie refusée n'a rien effacé
  assert (select q->>'audio_url' from json_array_elements(public.admin_list_quiz_questions(v_s)) q)
         = 'bt/2026-11-28/q01.mp3', 'liste console';

  -- La copie emporte les champs du blind test
  v := public.admin_duplicate_quiz_session(v_s);
  assert (select q->>'reponse' from json_array_elements(public.admin_list_quiz_questions((v->>'id')::uuid)) q)
         = 'Nova Kassa, « Lumière du lac »', 'copie de manche';
  perform public.admin_delete_quiz_session((v->>'id')::uuid);

  perform public.admin_quiz_start(v_s);
  perform public.admin_quiz_next(v_s);
  v := public.admin_quiz_live(v_s);
  assert v->'question'->>'reponse' is not null and v->'question'->>'audio_url' is not null, 'régie : ' || v::text;
end $$;

-- Un compte connecté qui n'est pas de l'équipe
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a0ff', false);
do $$
begin
  perform public.admin_blind_question((select question_id from t_bt), 'x', 'x', 'x', null, 0, null);
  raise exception 'intrus : saisie acceptée';
exception when others then assert sqlerrm = 'ACCES_REFUSE', sqlerrm;
end $$;
reset role;

-- --- Pendant la question : rien ne trahit la réponse -----------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare v json; q json; v_code text;
begin
  v := public.quiz_board();
  q := v->'question';
  assert q->>'categorie' = 'Artiste', 'écran : catégorie';
  assert q->>'audio_url' = 'bt/2026-11-28/q01.mp3' and (q->>'audio_debut')::int = 42, 'écran : extrait';
  assert q->>'reponse' is null and q->>'anecdote' is null and q->>'pochette_url' is null
     and q->>'correct_index' is null, 'écran : réponse trahie ' || q::text;
  assert v->'top' is null or json_typeof(v->'top') = 'null', 'écran : classement avant révélation';

  v_code := public.create_player('Oreille', 'soleil')->>'secret_code';
  update t_bt set code = v_code;
  v := public.quiz_state(v_code);
  q := v->'question';
  assert q->>'categorie' = 'Artiste', 'téléphone : catégorie';
  assert q->>'reponse' is null and q->>'pochette_url' is null and q->>'correct_index' is null,
         'téléphone : réponse trahie ' || q::text;
  assert not (q::jsonb ? 'audio_url'), 'téléphone : extrait envoyé';
  perform public.quiz_answer(v_code, (q->>'id')::uuid, 0);
end $$;
reset role;

-- Le chrono est fini
update public.quiz_sessions set question_started_at = now() - interval '30 seconds'
where id = (select session_id from t_bt);

set role anon;
do $$
declare v json; q json;
begin
  v := public.quiz_board();
  q := v->'question';
  assert (q->>'correct_index')::int = 0, 'écran : bonne réponse';
  assert q->>'reponse' = 'Nova Kassa, « Lumière du lac »' and q->>'anecdote' = 'Écrit en une nuit.'
     and q->>'pochette_url' = 'https://exemple.org/pochette.jpg', 'écran : révélation ' || q::text;
  assert json_array_length(v->'top') = 1 and v->'top'->0->>'pseudo' = 'Oreille', 'écran : classement ' || v::text;

  q := public.quiz_state((select code from t_bt))->'question';
  assert q->>'reponse' is not null and q->>'anecdote' is not null and q->>'pochette_url' is not null,
         'téléphone : révélation';
end $$;
reset role;

select 'BLIND TEST : OK';
