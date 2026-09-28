-- ============================================================================
-- Banc d'essai LOCAL : blind test côté joueur (étape 4.14) — quiz_state,
-- quiz_answer (barème des visuels), admin_quiz_end (récompenses une fois).
-- Se joue APRÈS 140_regles.sql (GM de 20_programme.sql, billetterie éteinte).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

create temp table t_bj (session_id uuid, a text, b text, c text, quete uuid, q1 uuid);
grant all on t_bj to anon, authenticated;

-- Une mission au compteur « blind » : 2 bonnes réponses dans la journée
insert into public.quests (title, description, type, goal_count, xp_reward, counter, requires_staff, categorie)
values ('Oreille absolue', 'Bonnes réponses au blind test', 'standard', 2, 100, 'blind', false, 'musique');
insert into t_bj (quete) select id from public.quests where counter = 'blind';

-- --- La régie prépare une manche de 3 questions -----------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json; v_s uuid; i int;
begin
  v := public.admin_create_quiz_session('Blind test du dimanche', 'raid', 'Manu Dibango', null, 5000, 50);
  v_s := (v->>'id')::uuid;
  for i in 1..3 loop
    perform public.admin_create_quiz_question(v_s, 'Question ' || i, '["A", "B", "C", "D"]'::jsonb, 0, 20);
  end loop;
  update t_bj set session_id = v_s;
  perform public.admin_quiz_start(v_s);
  perform public.admin_quiz_next(v_s);
end $$;
reset role;
update t_bj set q1 = (select id from public.quiz_questions where session_id = t_bj.session_id and question_order = 1);

-- --- Question 1 --------------------------------------------------------------
set role anon;
do $$
declare v json; q json; va text; vb text; vc text;
begin
  va := public.create_player('Oreille_A', 'soleil')->>'secret_code';
  vb := public.create_player('Oreille_B', 'soleil')->>'secret_code';
  vc := public.create_player('Oreille_C', 'soleil')->>'secret_code';
  update t_bj set a = va, b = vb, c = vc;

  v := public.quiz_state(va);
  q := v->'question';
  assert (v->'session'->>'total_questions')::int = 3 and (v->'session'->>'current_question')::int = 1, 'session : ' || v::text;
  assert not (q->>'closed')::boolean and q->>'correct_index' is null and q->>'reponse' is null, 'question ouverte : ' || q::text;
  assert not (q::jsonb ? 'audio_url'), 'extrait envoyé au téléphone';
  assert v->'raid'->>'damage' is null and v->'raid'->>'boss_name' = 'Manu Dibango', 'boss pendant la question : ' || (v->'raid')::text;

  perform public.quiz_answer(va, (q->>'id')::uuid, 0);        -- juste, tout de suite
  perform public.quiz_answer(vb, (q->>'id')::uuid, 2);        -- faux
  begin perform public.quiz_answer(va, (q->>'id')::uuid, 1); raise exception 'second envoi accepté';
  exception when others then assert sqlerrm = 'DEJA_REPONDU', sqlerrm; end;

  -- Pendant la question : rien ne trahit le verdict
  v := public.quiz_state(va);
  assert (v->'my_answer'->>'answer_index')::int = 0 and v->'my_answer'->>'is_correct' is null
     and v->'my_answer'->>'points' is null, 'verdict trahi : ' || (v->'my_answer')::text;
  assert (v->'moi'->>'points')::int = 0 and (v->'moi'->>'bonnes')::int = 0 and v->'moi'->>'rang' is null
     and json_typeof(v->'tete') = 'null', 'points trahis : ' || (v->'moi')::text;
end $$;
reset role;

-- C répond juste à mi-chrono : 1 000 − 500 × 10/20 = 750 points
update public.quiz_sessions set question_started_at = now() - interval '10 seconds'
where id = (select session_id from t_bj);
set role anon;
do $$
declare q json;
begin
  q := public.quiz_state((select c from t_bj))->'question';
  perform public.quiz_answer((select c from t_bj), (q->>'id')::uuid, 0);
end $$;
reset role;

do $$
begin
  assert (select points from public.quiz_answers a join public.players p on p.id = a.player_id where p.pseudo = 'Oreille_C')
         between 745 and 755, 'barème à mi-chrono';
  assert (select points from public.quiz_answers a join public.players p on p.id = a.player_id where p.pseudo = 'Oreille_A')
         >= 990, 'barème immédiat';
  -- XP = points ÷ 25, versés tout de suite ; plus de jetons par réponse
  assert (select xp from public.players where pseudo = 'Oreille_A') = 40
     and (select jetons from public.players where pseudo = 'Oreille_A') = (select jetons from public.players where pseudo = 'Oreille_B'),
    'XP / jetons : ' || (select row(xp, jetons)::text from public.players where pseudo = 'Oreille_A');
end $$;

-- Chrono fini
update public.quiz_sessions set question_started_at = now() - interval '30 seconds'
where id = (select session_id from t_bj);
set role anon;
do $$
declare v json; q json;
begin
  v := public.quiz_state((select a from t_bj));
  q := v->'question';
  assert (q->>'closed')::boolean and (q->>'correct_index')::int = 0, 'révélation : ' || q::text;
  assert (v->'my_answer'->>'is_correct')::boolean and (v->'my_answer'->>'points')::int >= 990, 'mon verdict';
  assert (v->'moi'->>'rang')::int = 1 and (v->'moi'->>'participants')::int = 3
     and (v->'moi'->>'bonnes')::int = 1 and (v->'moi'->>'serie')::int = 1, 'moi : ' || (v->'moi')::text;
  assert json_array_length(v->'tete') = 3 and v->'tete'->0->>'pseudo' = 'Oreille_A'
     and v->'tete'->1->>'pseudo' = 'Oreille_C', 'tête : ' || (v->'tete')::text;
  assert (v->'raid'->>'damage')::int between 1740 and 1760 and not (v->'raid'->>'defeated')::boolean, 'boss : ' || (v->'raid')::text;

  v := public.quiz_state((select b from t_bj));
  assert (v->'moi'->>'rang')::int = 3 and (v->'moi'->>'serie')::int = 0
     and not (v->'my_answer'->>'is_correct')::boolean, 'B : ' || v::text;

  begin perform public.quiz_answer((select b from t_bj), (q->>'id')::uuid, 0); raise exception 'réponse tardive acceptée';
  exception when others then assert sqlerrm in ('TROP_TARD', 'DEJA_REPONDU'), sqlerrm; end;
end $$;
reset role;

-- --- Question 2 : la série ne compte pas la question ouverte ------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
select public.admin_quiz_next((select session_id from t_bj)) is not null;
reset role;
set role anon;
do $$
declare v json; q json;
begin
  q := public.quiz_state((select a from t_bj))->'question';
  perform public.quiz_answer((select a from t_bj), (q->>'id')::uuid, 0);
  v := public.quiz_state((select a from t_bj));
  assert (v->'moi'->>'serie')::int = 1 and (v->'moi'->>'bonnes')::int = 1 and (v->'moi'->>'points')::int < 1100,
    'question 2 ouverte : ' || (v->'moi')::text;
  -- Ancienne question, ou identifiant vide (accepté par Otaku comme « la question en cours »)
  begin perform public.quiz_answer((select c from t_bj), (select q1 from t_bj), 0);
    raise exception 'ancienne question acceptée';
  exception when others then assert sqlerrm = 'QUESTION_FERMEE', sqlerrm; end;
  begin perform public.quiz_answer((select c from t_bj), null, 0);
    raise exception 'question vide acceptée';
  exception when others then assert sqlerrm = 'QUESTION_FERMEE', sqlerrm; end;
end $$;
reset role;

-- --- Fin de manche : récompenses, une seule fois -------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare j0 int; x0 int; j1 int; x1 int;
begin
  select jetons, xp into j0, x0 from public.players where pseudo = 'Oreille_A';
  perform public.admin_quiz_end((select session_id from t_bj));
  select jetons, xp into j1, x1 from public.players where pseudo = 'Oreille_A';
  -- A : 1re → 5 jetons ; mission « Oreille absolue » (2 bonnes) → +100 XP, +10 jetons
  assert j1 - j0 = 15 and x1 - x0 = 100, 'A récompensé : +' || (j1 - j0) || ' jetons, +' || (x1 - x0) || ' XP';
  assert exists (select 1 from public.player_badges pb join public.badges b on b.id = pb.badge_id
                 join public.players p on p.id = pb.player_id where p.pseudo = 'Oreille_A' and b.name = 'Oreille d''or'),
    'badge Oreille d''or';
  -- B n'a aucun point : ni badge, ni jetons
  assert not exists (select 1 from public.player_badges pb join public.badges b on b.id = pb.badge_id
                 join public.players p on p.id = pb.player_id where p.pseudo = 'Oreille_B' and b.name = 'Oreille d''or'),
    'badge donné à 0 point';
  assert (select completed_at is not null from public.quest_progress qp join public.players p on p.id = qp.player_id
          where p.pseudo = 'Oreille_A' and qp.quest_id = (select quete from t_bj)), 'mission terminée';
  assert (select progress from public.quest_progress qp join public.players p on p.id = qp.player_id
          where p.pseudo = 'Oreille_C' and qp.quest_id = (select quete from t_bj)) = 1, 'mission de C';

  -- Deuxième clic de la régie : rien ne repart
  perform public.admin_quiz_end((select session_id from t_bj));
  assert (select jetons from public.players where pseudo = 'Oreille_A') = j1, 'récompenses versées deux fois';
  assert (select count(*) from public.events where type = 'raid'
          and payload->>'message' like '« Manu Dibango » résiste encore%') = 2
     and (select (payload->>'bonus_xp')::int from public.events where type = 'raid' order by created_at desc limit 1) = 0,
    'événement de fin';
  perform public.admin_set_phase('EXPLORATION');
end $$;
reset role;

set role anon;
do $$
declare v json;
begin
  v := public.quiz_state((select a from t_bj));
  assert v->'session'->>'status' = 'terminee' and (v->'question'->>'closed')::boolean, 'fin : ' || (v->'session')::text;
  assert (v->'recap'->>'rang')::int = 1 and (v->'recap'->>'bonnes')::int = 2 and (v->'recap'->>'total_questions')::int = 3
     and (v->'recap'->>'jetons')::int = 15 and v->'recap'->>'badge' = 'Oreille d''or'
     and (v->'recap'->'mission'->>'terminee')::boolean and (v->'recap'->>'xp')::int between 175 and 181,
    'récapitulatif : ' || (v->'recap')::text;
  v := public.quiz_state((select b from t_bj));
  assert (v->'recap'->>'jetons')::int = 0 and v->'recap'->>'badge' is null and json_typeof(v->'recap'->'mission') = 'null',
    'récapitulatif de B : ' || (v->'recap')::text;
end $$;
reset role;

-- Le lendemain (plus de 2 h après) : retour à l'attente
update public.quiz_sessions set recompenses_at = now() - interval '3 hours', question_started_at = now() - interval '3 hours',
  created_at = now() - interval '3 hours'
where status = 'terminee';
set role anon;
do $$ begin
  assert json_typeof(public.quiz_state((select a from t_bj))->'session') = 'null', 'manche d''hier encore affichée';
end $$;
reset role;

-- --- Coût : une manche de 15 questions à 2 000 joueurs ------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json; v_s uuid; i int;
begin
  v := public.admin_create_quiz_session('Grosse manche', 'raid', 'Manu Dibango', null, 20000000, 0);
  v_s := (v->>'id')::uuid;
  for i in 1..15 loop
    perform public.admin_create_quiz_question(v_s, 'Question ' || i, '["A", "B", "C", "D"]'::jsonb, 1, 20);
  end loop;
  update t_bj set session_id = v_s;
  perform public.admin_quiz_start(v_s);
  for i in 1..14 loop perform public.admin_quiz_next(v_s); end loop;
end $$;
reset role;

-- 2 000 joueurs ont répondu aux 14 premières questions (insertion directe : le
-- coût mesuré est celui des LECTURES pendant la 15e)
insert into public.players (pseudo, archetype)
select 'Charge_' || g, 'soleil' from generate_series(1, 2000) g;
insert into public.player_secrets (player_id, secret_code)
select id, 'CHARGE-' || lpad(substr(pseudo, 8), 5, '0') from public.players where pseudo like 'Charge\_%';
insert into public.quiz_answers (question_id, player_id, answer_index, is_correct, response_ms, points)
select q.id, p.id, (random() < .6)::int, null, 5000, 0
from public.quiz_questions q, public.players p
where q.session_id = (select session_id from t_bj) and q.question_order <= 14 and p.pseudo like 'Charge\_%';
update public.quiz_answers set is_correct = (answer_index = 1), points = case when answer_index = 1 then 500 + floor(random() * 500)::int else 0 end
where question_id in (select id from public.quiz_questions where session_id = (select session_id from t_bj));
insert into public.quiz_scores (session_id, player_id, points, bonnes, xp, derniere_at)
select q.session_id, a.player_id, sum(a.points), count(*) filter (where a.is_correct), sum(round(a.points / 25.0)), max(a.answered_at)
from public.quiz_answers a join public.quiz_questions q on q.id = a.question_id
where q.session_id = (select session_id from t_bj)
group by q.session_id, a.player_id;
analyze public.quiz_scores; analyze public.quiz_answers;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
select public.admin_quiz_next((select session_id from t_bj)) is not null;
reset role;

set role anon;
do $$
declare v json; t0 timestamptz; i int; q uuid; n int := 0;
begin
  -- Question ouverte : 200 réponses
  q := (public.quiz_state('CHARGE-00001')->'question'->>'id')::uuid;
  t0 := clock_timestamp();
  for i in 1..200 loop perform public.quiz_answer('CHARGE-' || lpad(i::text, 5, '0'), q, 1); end loop;
  raise notice 'COÛT : quiz_answer % ms', round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2);

  t0 := clock_timestamp();
  for i in 1..200 loop v := public.quiz_state('CHARGE-' || lpad((i * 7)::text, 5, '0')); end loop;
  raise notice 'COÛT : quiz_state question ouverte % ms', round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2);
end $$;
reset role;

update public.quiz_sessions set question_started_at = now() - interval '30 seconds'
where id = (select session_id from t_bj);
set role anon;
do $$
declare v json; t0 timestamptz; i int;
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.quiz_state('CHARGE-' || lpad((i * 7)::text, 5, '0')); end loop;
  raise notice 'COÛT : quiz_state chrono fini % ms (2 000 joueurs, 15 questions) ; % octets',
    round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2), length(v::text);
  assert (v->'moi'->>'participants')::int = 2000 and (v->'moi'->>'rang')::int >= 1, 'place : ' || (v->'moi')::text;
end $$;
reset role;

-- Billetterie allumée : aucun des 2 000 joueurs n'a de ticket du jour. La
-- clôture doit passer quand même (sans avancer leurs missions).
update public.billetterie_config set actif = true where id = 1;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare t0 timestamptz;
begin
  t0 := clock_timestamp();
  perform public.admin_quiz_end((select session_id from t_bj));
  raise notice 'COÛT : admin_quiz_end % ms (2 000 joueurs)', round(extract(epoch from clock_timestamp() - t0) * 1000);
  perform public.admin_set_phase('EXPLORATION');
end $$;
reset role;
update public.billetterie_config set actif = false where id = 1;
do $$ begin
  assert (select count(*) from public.quiz_scores where session_id = (select session_id from t_bj) and recap is not null) = 2000, 'récapitulatifs';
  assert (select count(*) from public.quiz_scores where session_id = (select session_id from t_bj) and recap->'mission' <> 'null'::jsonb) = 0,
    'mission avancée sans ticket';
  assert (select count(*) from public.quiz_scores where session_id = (select session_id from t_bj) and (recap->>'jetons')::int > 0) > 0,
    'jetons de classement sans ticket';
end $$;

select 'BLIND TEST JOUEUR : OK';
