-- ============================================================================
-- Correctif du 17/09/2026 (étape 2.7) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Blind test : catégorie, réponse, anecdote, extrait audio et pochette sur
-- quiz_questions ; quiz_state, quiz_board, admin_quiz_live,
-- admin_list_quiz_questions et admin_duplicate_quiz_session complétées
-- (copiées de 00_schema.sql) ; nouvelle fonction admin_blind_question.
-- À appliquer UNE fois, après 2026-09-17_etape-2.6.sql.
-- ============================================================================
begin;

alter table public.quiz_questions
  add categorie text,
  add reponse text,
  add anecdote text,
  add audio_url text,
  add audio_debut integer default 0 not null,
  add pochette_url text,
  add constraint quiz_questions_audio_debut check (audio_debut between 0 and 3600),
  add constraint quiz_questions_audio_url check (audio_url ~ '^(https://|[A-Za-z0-9_][A-Za-z0-9_./-]*$)'),
  add constraint quiz_questions_pochette_url check (pochette_url ~ '^(https://|[A-Za-z0-9_][A-Za-z0-9_./-]*$)');

create or replace function public.quiz_state(p_secret_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player  public.players%rowtype;
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_elapsed numeric;      -- secondes écoulées depuis le lancement
  v_closed  boolean := false;
  v_damage  int;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  -- La session en cours en priorité, sinon la dernière JOUÉE (podium).
  select * into v_session from public.quiz_sessions
  where status in ('en_cours', 'terminee')
  -- ⬇️ LA SEULE LIGNE MODIFIÉE (2026-08-13). `created_at` seul faisait
  -- gagner un raid dupliqué sur un quiz qui venait de se terminer.
  order by (status = 'en_cours') desc,
           coalesce(question_started_at, created_at) desc
  limit 1;
  if v_session.id is null then
    return json_build_object('session', null);
  end if;

  -- La question en cours (0 = salle d'attente, personne n'a encore joué)
  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
      -- Le « + 2 » du fichier 55 : on ne révèle jamais avant d'avoir
      -- cessé d'accepter les réponses.
      v_closed  := v_elapsed > v_q.duration_seconds + 2;
    end if;
  end if;

  if v_session.kind = 'raid' then
    v_damage := public._raid_damage(v_session.id);
  end if;

  return json_build_object(
    'session', json_build_object(
      'id', v_session.id, 'title', v_session.title, 'status', v_session.status,
      'kind', v_session.kind,
      'current_question', v_session.current_question,
      'total_questions', (select count(*) from public.quiz_questions
                          where session_id = v_session.id)),

    -- Le boss (raid uniquement) : la barre de vie de tout le monde
    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'boss_name', v_session.boss_name,
      'boss_image', v_session.boss_image,
      'hp_max', v_session.boss_hp_max,
      'damage', v_damage,
      'hp_left', greatest(0, v_session.boss_hp_max - v_damage),
      'defeated', v_damage >= v_session.boss_hp_max,
      'bonus_xp', v_session.raid_bonus_xp) end,

    -- La question : choix toujours, la bonne réponse SEULEMENT chrono fini
    'question', case when v_q.id is null then null else json_build_object(
      'id', v_q.id,
      'categorie', v_q.categorie,
      'reponse',      case when v_closed then v_q.reponse else null end,
      'anecdote',     case when v_closed then v_q.anecdote else null end,
      'pochette_url', case when v_closed then v_q.pochette_url else null end,
      'question', v_q.question,
      'choices', v_q.choices,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms', round(v_elapsed * 1000),
      'closed', v_closed,
      'correct_index', case when v_closed then v_q.correct_index else null end) end,

    -- Ma réponse : l'index tout de suite (pour griser le bouton),
    -- le verdict et les points seulement quand le chrono est fini
    'my_answer', (select case when a.id is null then null else json_build_object(
        'answer_index', a.answer_index,
        'is_correct',   case when v_closed then a.is_correct else null end,
        'points',       case when v_closed then a.points else null end) end
      from public.quiz_answers a
      where a.question_id = v_q.id and a.player_id = v_player.id),

    -- Mon score cumulé sur cette session (= mes dégâts, en raid)
    'my_score', coalesce((select sum(a.points)
      from public.quiz_answers a
      join public.quiz_questions q on q.id = a.question_id
      where q.session_id = v_session.id and a.player_id = v_player.id), 0),

    -- Le podium (uniquement quand la session est terminée)
    'podium', case when v_session.status <> 'terminee' then null else
      coalesce((select json_agg(row_to_json(t)) from (
        select p.pseudo, p.archetype, sum(a.points)::int as points
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        join public.players p on p.id = a.player_id
        where q.session_id = v_session.id
        group by p.id, p.pseudo, p.archetype
        order by sum(a.points) desc, max(a.answered_at) asc
        limit 3) t), '[]'::json) end);
end;
$function$
;

create or replace function public.quiz_board()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_elapsed numeric;
  v_closed  boolean := false;
  v_damage  int;
begin
  select * into v_session from public.quiz_sessions
  where status in ('en_cours', 'terminee')
  -- ⬇️ LA SEULE LIGNE MODIFIÉE (2026-08-13).
  order by (status = 'en_cours') desc,
           coalesce(question_started_at, created_at) desc
  limit 1;
  if v_session.id is null then return json_build_object('session', null); end if;

  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
      v_closed  := v_elapsed > v_q.duration_seconds + 2;
    end if;
  end if;

  if v_session.kind = 'raid' then
    v_damage := public._raid_damage(v_session.id);
  end if;

  return json_build_object(
    'session', json_build_object(
      'id', v_session.id, 'title', v_session.title, 'status', v_session.status,
      'kind', v_session.kind,
      'current_question', v_session.current_question,
      'total_questions', (select count(*) from public.quiz_questions
                          where session_id = v_session.id)),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'boss_name', v_session.boss_name,
      'boss_image', v_session.boss_image,
      'hp_max', v_session.boss_hp_max,
      'damage', v_damage,
      'hp_left', greatest(0, v_session.boss_hp_max - v_damage),
      'defeated', v_damage >= v_session.boss_hp_max,
      'bonus_xp', v_session.raid_bonus_xp,
      'participants', (select count(distinct a.player_id)
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        where q.session_id = v_session.id)) end,

    'question', case when v_q.id is null then null else json_build_object(
      'categorie',   v_q.categorie,
      'audio_url',   v_q.audio_url,
      'audio_debut', v_q.audio_debut,
      'reponse',      case when v_closed then v_q.reponse else null end,
      'anecdote',     case when v_closed then v_q.anecdote else null end,
      'pochette_url', case when v_closed then v_q.pochette_url else null end,
      'question', v_q.question,
      'choices', v_q.choices,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms', round(v_elapsed * 1000),
      'closed', v_closed,
      'correct_index', case when v_closed then v_q.correct_index else null end,
      'answers_count', (select count(*) from public.quiz_answers
                        where question_id = v_q.id),
      -- Répartition par choix : seulement quand le chrono est fini
      'distribution', case when not v_closed then null else
        (select coalesce(json_agg(n order by idx), '[]'::json) from (
          select gs.idx, count(a.id)::int as n
          from generate_series(0, jsonb_array_length(v_q.choices) - 1) gs(idx)
          left join public.quiz_answers a
            on a.question_id = v_q.id and a.answer_index = gs.idx
          group by gs.idx) d) end) end,

    'top', case when not v_closed and v_session.status <> 'terminee' then null else
      coalesce((select json_agg(row_to_json(t)) from (
        select p.pseudo, p.archetype, sum(a.points)::int as points
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        join public.players p on p.id = a.player_id
        where q.session_id = v_session.id
        group by p.id, p.pseudo, p.archetype
        order by sum(a.points) desc, max(a.answered_at) asc
        limit 10) t), '[]'::json) end,

    'podium', case when v_session.status <> 'terminee' then null else
      coalesce((select json_agg(row_to_json(t)) from (
        select p.pseudo, p.archetype, sum(a.points)::int as points
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        join public.players p on p.id = a.player_id
        where q.session_id = v_session.id
        group by p.id, p.pseudo, p.archetype
        order by sum(a.points) desc, max(a.answered_at) asc
        limit 5) t), '[]'::json) end);
end;
$function$
;

create or replace function public.admin_quiz_live(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_elapsed numeric;
  v_damage  int;
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_session from public.quiz_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;

  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
    end if;
  end if;

  if v_session.kind = 'raid' then
    v_damage := public._raid_damage(v_session.id);
  end if;

  return json_build_object(
    'session', row_to_json(v_session),
    'total_questions', (select count(*) from public.quiz_questions
                        where session_id = v_session.id),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'damage', v_damage,
      'hp_left', greatest(0, v_session.boss_hp_max - v_damage),
      'defeated', v_damage >= v_session.boss_hp_max) end,

    'question', case when v_q.id is null then null else json_build_object(
      'id', v_q.id, 'question', v_q.question, 'choices', v_q.choices,
      'categorie', v_q.categorie, 'reponse', v_q.reponse, 'anecdote', v_q.anecdote,
      'audio_url', v_q.audio_url, 'audio_debut', v_q.audio_debut,
      'pochette_url', v_q.pochette_url,
      'correct_index', v_q.correct_index,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms', round(v_elapsed * 1000),
      'answers_count', (select count(*) from public.quiz_answers
                        where question_id = v_q.id),
      'correct_count', (select count(*) from public.quiz_answers
                        where question_id = v_q.id and is_correct),
      'distribution', (select coalesce(json_agg(n order by idx), '[]'::json) from (
        select gs.idx, count(a.id)::int as n
        from generate_series(0, jsonb_array_length(v_q.choices) - 1) gs(idx)
        left join public.quiz_answers a
          on a.question_id = v_q.id and a.answer_index = gs.idx
        group by gs.idx) d)) end,

    'top', coalesce((select json_agg(row_to_json(t)) from (
      select p.pseudo, sum(a.points)::int as points
      from public.quiz_answers a
      join public.quiz_questions q on q.id = a.question_id
      join public.players p on p.id = a.player_id
      where q.session_id = v_session.id
      group by p.id, p.pseudo
      order by sum(a.points) desc, max(a.answered_at) asc
      limit 5) t), '[]'::json));
end;
$function$
;

create or replace function public.admin_list_quiz_questions(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((select json_agg(row_to_json(q) order by q.question_order) from (
    select qq.id, qq.question_order, qq.question, qq.choices,
           qq.correct_index, qq.duration_seconds,
           qq.categorie, qq.reponse, qq.anecdote,
           qq.audio_url, qq.audio_debut, qq.pochette_url,
      (select count(*) from public.quiz_answers where question_id = qq.id) as answers
    from public.quiz_questions qq
    where qq.session_id = p_session_id
  ) q), '[]'::json);
end;
$function$
;

create or replace function public.admin_duplicate_quiz_session(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_src public.quiz_sessions%rowtype;
  v_new public.quiz_sessions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_src from public.quiz_sessions where id = p_session_id;
  if v_src.id is null then raise exception 'QUIZ_INCONNU'; end if;

  -- La copie : neuve, en préparation, jamais lancée. On ne copie
  -- QUE le contenu (titre, boss) — pas le statut, ni les réponses.
  insert into public.quiz_sessions
    (title, kind, boss_name, boss_image, boss_hp_max, raid_bonus_xp)
  values
    (v_src.title || ' (copie)', v_src.kind,
     v_src.boss_name, v_src.boss_image, v_src.boss_hp_max, v_src.raid_bonus_xp)
  returning * into v_new;

  -- Les questions recopiées à l'identique (énoncé, choix, bonne
  -- réponse, ordre, durée), reliées à la nouvelle session.
  insert into public.quiz_questions
    (session_id, question, choices, correct_index, question_order, duration_seconds,
     categorie, reponse, anecdote, audio_url, audio_debut, pochette_url)
  select v_new.id, question, choices, correct_index, question_order, duration_seconds,
     categorie, reponse, anecdote, audio_url, audio_debut, pochette_url
  from public.quiz_questions
  where session_id = v_src.id;

  return row_to_json(v_new);
end;
$function$
;

-- ----------------------------------------------------------------------------
-- Blind test (étape 2.7) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Les colonnes (categorie, reponse, anecdote, audio_url, audio_debut,
-- pochette_url) sont ajoutées à quiz_questions par le générateur, qui complète
-- aussi quiz_state, quiz_board, admin_quiz_live, admin_list_quiz_questions et
-- admin_duplicate_quiz_session. Les fonctions Otaku de création et de
-- modification d'une question ne changent pas : ce qui est propre au blind
-- test se règle ici, question par question.
--
-- ⚠️ audio_url est lisible par tous PENDANT la question (l'écran géant est une
--    page publique) : le nom du fichier ne doit rien dire de la réponse
--    (ex. « bt/2026-11-27/q07.mp3 », jamais « nova-kassa-lumiere.mp3 »).
-- ----------------------------------------------------------------------------

create or replace function public.admin_blind_question(
  p_id uuid,
  p_categorie text,
  p_reponse text,
  p_anecdote text,
  p_audio_url text,
  p_audio_debut integer,
  p_pochette_url text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_q public.quiz_questions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(p_audio_debut, 0) not between 0 and 3600 then raise exception 'DEBUT_INVALIDE'; end if;
  if length(p_categorie) > 40 or length(p_reponse) > 160 or length(p_anecdote) > 400 then
    raise exception 'TEXTE_TROP_LONG';
  end if;

  begin
    update public.quiz_questions set
      categorie    = nullif(trim(p_categorie), ''),
      reponse      = nullif(trim(p_reponse), ''),
      anecdote     = nullif(trim(p_anecdote), ''),
      audio_url    = nullif(trim(p_audio_url), ''),
      audio_debut  = coalesce(p_audio_debut, 0),
      pochette_url = nullif(trim(p_pochette_url), '')
    where id = p_id
    returning * into v_q;
  exception when check_violation then
    raise exception 'ADRESSE_INVALIDE';
  end;
  if v_q.id is null then raise exception 'QUESTION_INCONNUE'; end if;
  return row_to_json(v_q);
end;
$function$;

revoke all on function public.admin_blind_question(p_id uuid, p_categorie text, p_reponse text, p_anecdote text, p_audio_url text, p_audio_debut integer, p_pochette_url text) from public, anon, authenticated;
grant execute on function public.admin_blind_question(p_id uuid, p_categorie text, p_reponse text, p_anecdote text, p_audio_url text, p_audio_debut integer, p_pochette_url text) to authenticated;

commit;
