-- ============================================================================
-- Banc d'essai LOCAL : le plateau du blind test sur l'écran géant (étape 5.2)
-- — quiz_board réécrite (quiz_scores, rapides, boss, exclus masqués), signal
-- game_state de admin_quiz_next, fenêtre de 2 h après la manche.
-- Se joue APRÈS 160_mur.sql (les 2 000 « Charge_ » de 150_blind_joueur.sql).
-- NE JAMAIS exécuter ce fichier sur Supabase.
-- ============================================================================
\set QUIET on
\pset tuples_only on

create temp table t_eb (session_id uuid, maj timestamptz);
grant all on t_eb to anon, authenticated;

-- Aucune manche récente : l'écran attend
update public.quiz_sessions set recompenses_at = now() - interval '3 hours' where status = 'terminee';
set role anon;
do $$ begin
  assert json_typeof(public.quiz_board()->'session') = 'null',
    'manche d''il y a 3 h encore affichée : ' || public.quiz_board()::text;
end $$;
reset role;

-- --- La régie : une manche de 15 questions, les 14 premières déjà jouées ------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$
declare v json; v_s uuid; i int;
begin
  v := public.admin_create_quiz_session('Plateau', 'raid', 'Francis Bebey', 'assets/photos/boss-bebey.webp', 20000000, 0);
  v_s := (v->>'id')::uuid;
  for i in 1..15 loop
    perform public.admin_create_quiz_question(v_s, 'Question ' || i, '["A", "B", "C", "D"]'::jsonb, 1, 20);
  end loop;
  insert into t_eb (session_id) values (v_s);
  perform public.admin_quiz_start(v_s);
  for i in 1..14 loop perform public.admin_quiz_next(v_s); end loop;
end $$;
reset role;

-- Avant la 1re question (current_question = 0 impossible ici : déjà 14) :
-- 2 000 joueurs ont répondu aux 14 premières (insertion directe)
insert into public.quiz_answers (question_id, player_id, answer_index, is_correct, response_ms, points)
select q.id, p.id, (random() < .6)::int, null, 5000, 0
from public.quiz_questions q, public.players p
where q.session_id = (select session_id from t_eb) and q.question_order <= 14 and p.pseudo like 'Charge\_%';
update public.quiz_answers set is_correct = (answer_index = 1),
  points = case when answer_index = 1 then 500 + floor(random() * 500)::int else 0 end
where question_id in (select id from public.quiz_questions where session_id = (select session_id from t_eb));
insert into public.quiz_scores (session_id, player_id, points, bonnes, xp, derniere_at)
select q.session_id, a.player_id, sum(a.points), count(*) filter (where a.is_correct), sum(round(a.points / 25.0)), max(a.answered_at)
from public.quiz_answers a join public.quiz_questions q on q.id = a.question_id
where q.session_id = (select session_id from t_eb)
group by q.session_id, a.player_id;
-- Un tricheur, en tête de la manche (exclu après sa réponse à la question 15)
update public.quiz_scores set points = 99999999
where session_id = (select session_id from t_eb) and player_id = (select id from public.players where pseudo = 'Charge_2000');
analyze public.quiz_scores; analyze public.quiz_answers;

-- --- Question 15 : admin_quiz_next prévient l'écran (game_state) -----------
update t_eb set maj = (select updated_at from public.game_state where id = 1);
select pg_sleep(0.01);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
select public.admin_quiz_next((select session_id from t_eb)) is not null;
reset role;
do $$ begin
  assert (select updated_at from public.game_state where id = 1) > (select maj from t_eb), 'game_state non touché : pas de signal';
end $$;

set role anon;
do $$
declare v json; q json; q15 uuid;
begin
  v := public.quiz_board();
  q := v->'question';
  assert (v->'session'->>'current_question')::int = 15 and (v->'session'->>'total_questions')::int = 15, 'session : ' || (v->'session')::text;
  assert (v->'session'->>'participants')::int = 2000, 'participants : ' || (v->'session')::text;
  assert (q->>'numero')::int = 15 and not (q->>'closed')::boolean, 'question ouverte : ' || q::text;
  -- Rien ne trahit la réponse ni le classement pendant la question
  assert q->>'correct_index' is null and q->>'reponse' is null and q->>'distribution' is null
     and q->>'rapides' is null, 'réponse trahie : ' || q::text;
  assert v->>'top' is null, 'classement pendant la question';
  assert v->'raid'->>'damage' is null and v->'raid'->>'hp_left' is null, 'PV pendant la question : ' || (v->'raid')::text;
  assert v->'raid'->>'boss_name' = 'Francis Bebey' and v->'raid'->>'boss_image' = 'assets/photos/boss-bebey.webp', 'boss : ' || (v->'raid')::text;

  -- Quatre réponses dans l'ordre : le tricheur (le plus rapide), B juste, C faux, D juste
  q15 := (public.quiz_state('CHARGE-02000')->'question'->>'id')::uuid;
  perform public.quiz_answer('CHARGE-02000', q15, 1);
  perform public.quiz_answer('CHARGE-00002', q15, 1);
  perform public.quiz_answer('CHARGE-00003', q15, 0);
  perform public.quiz_answer('CHARGE-00004', q15, 1);
  assert (public.quiz_board()->'question'->>'answers_count')::int = 4, 'réponses reçues';
end $$;
reset role;

-- Le GM exclut le tricheur, puis le chrono se termine
-- (les 4 réponses sont parties dans la même transaction : même heure ; on fixe
-- les temps de réponse pour tester l'ordre des plus rapides)
update public.quiz_answers a set response_ms = v.ms
from (values ('Charge_2000', 300), ('Charge_2', 1500), ('Charge_3', 1800), ('Charge_4', 2100)) v(pseudo, ms)
join public.players p on p.pseudo = v.pseudo
where a.player_id = p.id and a.question_id = (select id from public.quiz_questions
  where session_id = (select session_id from t_eb) and question_order = 15);
update public.players set status = 'exclu' where pseudo = 'Charge_2000';
update public.quiz_sessions set question_started_at = now() - interval '30 seconds' where id = (select session_id from t_eb);
set role anon;
do $$
declare v json; q json;
begin
  v := public.quiz_board();
  q := v->'question';
  assert (q->>'closed')::boolean and (q->>'correct_index')::int = 1, 'révélation : ' || q::text;
  assert (q->'distribution'->>0)::int = 1 and (q->'distribution'->>1)::int = 3, 'répartition : ' || (q->>'distribution');
  -- Les plus rapides : l'exclu écarté, B avant D
  assert json_array_length(q->'rapides') = 2 and q->'rapides'->0->>'pseudo' = 'Charge_2' and q->'rapides'->1->>'pseudo' = 'Charge_4'
     and (q->'rapides'->0->>'ms')::int <= (q->'rapides'->1->>'ms')::int, 'rapides : ' || (q->>'rapides');
  -- Top 10 sur quiz_scores, sans l'exclu, trié
  assert json_array_length(v->'top') = 10, 'top 10';
  assert not exists (select 1 from json_array_elements(v->'top') t where t->>'pseudo' = 'Charge_2000'), 'exclu dans le top';
  assert (v->'top'->0->>'points')::int >= (v->'top'->9->>'points')::int, 'top trié';
  assert (v->'raid'->>'damage')::int > 0 and (v->'raid'->>'hp_left')::int < 20000000, 'PV : ' || (v->'raid')::text;
end $$;

-- Coût : question ouverte / chrono fini
do $$
declare t0 timestamptz; i int; v json; ms_o numeric; ms_f numeric;
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.quiz_board(); end loop;
  ms_f := extract(epoch from clock_timestamp() - t0) * 1000 / 200;
  raise notice 'COÛT : quiz_board chrono fini % ms (2 000 joueurs, 15 questions, 28 000 réponses) ; % octets', round(ms_f, 2), length(v::text);
end $$;
reset role;
update public.quiz_sessions set question_started_at = now() where id = (select session_id from t_eb);
set role anon;
do $$
declare t0 timestamptz; i int; v json;
begin
  t0 := clock_timestamp();
  for i in 1..200 loop v := public.quiz_board(); end loop;
  raise notice 'COÛT : quiz_board question ouverte % ms ; % octets',
    round(extract(epoch from clock_timestamp() - t0) * 1000 / 200, 2), length(v::text);
end $$;
reset role;

-- --- Fin de manche : le podium reste à l'écran, puis l'attente après 2 h -----
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
select public.admin_quiz_end((select session_id from t_eb)) is not null;
select public.admin_set_phase('EXPLORATION') is not null;
reset role;
set role anon;
do $$
declare v json;
begin
  v := public.quiz_board();
  assert v->'session'->>'status' = 'terminee' and json_array_length(v->'top') = 10, 'podium : ' || v::text;
  assert (v->'raid'->>'damage')::int > 0, 'PV à la fin';
end $$;
reset role;
update public.quiz_sessions set recompenses_at = now() - interval '3 hours' where id = (select session_id from t_eb);
update public.players set status = 'actif' where pseudo = 'Charge_2000';
set role anon;
do $$ begin
  assert json_typeof(public.quiz_board()->'session') = 'null', 'podium de plus de 2 h encore affiché';
end $$;
reset role;

select 'ÉCRAN BLIND TEST : OK';
