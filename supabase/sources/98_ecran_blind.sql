-- ----------------------------------------------------------------------------
-- Plateau du blind test sur l'écran géant (étape 5.2) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- quiz_board() : tout le plateau en UN appel. Réécrite (le corps d'Otaku
-- additionnait toutes les réponses de la manche à chaque lecture) : les
-- totaux viennent de quiz_scores (4.14), comme sur les téléphones.
-- Décisions de Jarvis du 18/09 :
--   · le boss (une figure de la musique) est à l'écran : nom, photo, PV ; les
--     PV ne bougent qu'une fois le chrono fini, comme sur les téléphones ;
--   · « les plus rapides » : les 3 bonnes réponses les plus rapides de la
--     question, chrono fini seulement ;
--   · après la révélation, l'écran montre le top 10 de la manche jusqu'à la
--     question suivante (top renvoyé dès que le chrono est fini) ;
--   · l'écran apprend qu'une question commence par game_state (temps réel) :
--     admin_quiz_next touche game_state.updated_at (voir fabriquer_schema.py).
-- Même fenêtre que quiz_state : la dernière manche jouée reste affichée 2 h
-- (podium), puis l'écran revient à l'attente.
-- Rien ne sort avant la fin du chrono (+2 s) : bonne réponse, réponse,
-- anecdote, pochette, répartition, rapides, PV, classement. Joueurs exclus
-- masqués. Publique : l'écran géant n'a pas de session.
-- ----------------------------------------------------------------------------

create or replace function public.quiz_board()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_elapsed numeric;
  v_closed  boolean := false;      -- chrono fini (+2 s) : on peut tout montrer
  v_fini    boolean;
  v_total   int;
  v_nb      int;                   -- participants (une ligne de quiz_scores chacun)
  v_damage  int;
begin
  select * into v_session from public.quiz_sessions
  where status in ('en_cours', 'terminee')
  order by (status = 'en_cours') desc,
           coalesce(question_started_at, created_at) desc
  limit 1;
  if v_session.id is null
     or (v_session.status = 'terminee'
         and coalesce(v_session.recompenses_at, v_session.question_started_at, v_session.created_at)
             < now() - interval '2 hours') then
    return json_build_object('session', null);
  end if;
  v_fini := v_session.status = 'terminee';
  select count(*) into v_total from public.quiz_questions where session_id = v_session.id;

  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
      v_closed  := v_elapsed > v_q.duration_seconds + 2 or v_fini;
    end if;
  end if;

  -- Participants et PV en une lecture ; les PV seulement chrono fini
  select count(*), coalesce(sum(points), 0)::int into v_nb, v_damage
  from public.quiz_scores where session_id = v_session.id;
  if not (v_closed or v_session.current_question = 0) then v_damage := null; end if;

  return json_build_object(
    'session', json_build_object(
      'id', v_session.id, 'title', v_session.title, 'status', v_session.status,
      'kind', v_session.kind,
      'current_question', v_session.current_question,
      'total_questions', v_total,
      'participants', v_nb),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'boss_name', v_session.boss_name,
      'boss_image', v_session.boss_image,
      'hp_max', v_session.boss_hp_max,
      'damage', v_damage,
      'hp_left', case when v_damage is null then null else greatest(0, v_session.boss_hp_max - v_damage) end,
      'defeated', case when v_damage is null then null else v_session.boss_hp_max > 0 and v_damage >= v_session.boss_hp_max end) end,

    'question', case when v_q.id is null then null else json_build_object(
      'numero',           v_q.question_order,
      'categorie',        v_q.categorie,
      'question',         v_q.question,
      'choices',          v_q.choices,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms',       round(v_elapsed * 1000),
      'closed',           v_closed,
      'audio_url',        v_q.audio_url,
      'audio_debut',      v_q.audio_debut,
      'answers_count',    (select count(*) from public.quiz_answers where question_id = v_q.id),
      'correct_index',    case when v_closed then v_q.correct_index end,
      'reponse',          case when v_closed then v_q.reponse end,
      'anecdote',         case when v_closed then v_q.anecdote end,
      'pochette_url',     case when v_closed then v_q.pochette_url end,
      'distribution', case when not v_closed then null else
        (select coalesce(json_agg(n order by idx), '[]'::json) from (
          select gs.idx, count(a.id)::int as n
          from generate_series(0, jsonb_array_length(v_q.choices) - 1) gs(idx)
          left join public.quiz_answers a
            on a.question_id = v_q.id and a.answer_index = gs.idx
          group by gs.idx) d) end,
      'rapides', case when not v_closed then null else
        coalesce((select json_agg(json_build_object('pseudo', r.pseudo, 'avatar', r.archetype, 'ms', r.response_ms)
                                  order by r.response_ms, r.answered_at)
          from (select p.pseudo, p.archetype, a.response_ms, a.answered_at
                from public.quiz_answers a
                join public.players p on p.id = a.player_id and p.status = 'actif'
                where a.question_id = v_q.id and a.is_correct
                order by a.response_ms, a.answered_at limit 3) r), '[]'::json) end) end,

    -- Top 10 de la manche (quiz_scores, sur index) : chrono fini ou manche close
    'top', case when not v_closed and v_session.current_question > 0 then null else
      coalesce((select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype,
                                                  'points', t.points, 'bonnes', t.bonnes)
                                order by t.points desc, t.derniere_at)
        from (select p.pseudo, p.archetype, s.points, s.bonnes, s.derniere_at
              from public.quiz_scores s
              join public.players p on p.id = s.player_id and p.status = 'actif'
              where s.session_id = v_session.id
              order by s.points desc, s.derniere_at limit 10) t), '[]'::json) end);
end;
$function$;

revoke all on function public.quiz_board() from public, anon, authenticated;
grant execute on function public.quiz_board() to anon, authenticated;
