-- ----------------------------------------------------------------------------
-- Blind test côté joueur (étape 4.14) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Le moteur reste celui des raids d'Otaku (quiz_sessions.kind = 'raid', la
-- régie lance chaque question). Décisions de Jarvis du 18/09 :
--   · barème des visuels : une bonne réponse vaut de 1 000 points (tout de
--     suite) à 500 points (au bout du chrono) ; XP = points ÷ 25, versés à la
--     réponse (au plus 40 XP par question) ; plus de jetons par réponse ;
--   · fin de manche (admin_quiz_end, UNE fois : quiz_sessions.recompenses_at) :
--     badge « Oreille d'or » au top 10, jetons de classement (podium 5, top 10
--     2, 10 bonnes réponses ou plus 1), missions au compteur « blind » (bonnes
--     réponses de la journée de jeu) ; le lot du podium se retire au stand ;
--   · PAS de bonus collectif quand le boss tombe (raid_bonus_xp n'est plus
--     versé) : le boss (une figure de la musique) reste un objectif commun,
--     ses PV se comptent dans les mêmes points ;
--   · téléphones sans temps réel : quiz_state est lu à la fermeture de chaque
--     question puis toutes les ~3 s en attendant la suivante. Il doit rester
--     léger : les totaux de la manche sont tenus dans quiz_scores (une ligne
--     par joueur) au lieu d'additionner toutes les réponses à chaque lecture.
--
--   quiz_state(code)          l'état du téléphone en UN appel : question,
--                             chrono du serveur, ma réponse, mes points, ma
--                             place et le trio de tête (chrono fini), le boss,
--                             et à la fin mon récapitulatif
--   quiz_answer(code, q, i)   une réponse, définitive (rejouer ne change rien)
--   admin_quiz_end(session)   clôture par la régie + récompenses
--   _raid_damage(session)     PV retirés au boss = somme des points
-- ----------------------------------------------------------------------------

create table public.quiz_scores (
  session_id  uuid not null references public.quiz_sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  points      integer not null default 0,
  bonnes      integer not null default 0,
  xp          integer not null default 0,      -- XP gagnés par les réponses
  derniere_at timestamptz not null default now(),   -- départage (le plus rapide devant)
  recap       jsonb,                           -- rempli par admin_quiz_end
  primary key (session_id, player_id)
);
create index quiz_scores_classement_idx on public.quiz_scores (session_id, points desc, derniere_at);
-- Aucune politique : lue seulement par les fonctions ci-dessous.
alter table public.quiz_scores enable row level security;

create or replace function public._raid_damage(p_session_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(points), 0)::int from public.quiz_scores where session_id = p_session_id;
$function$;

revoke all on function public._raid_damage(p_session_id uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
create or replace function public.quiz_answer(p_secret_code text, p_question_id uuid, p_answer_index integer)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player    public.players%rowtype;
  v_session   public.quiz_sessions%rowtype;
  v_q         public.quiz_questions%rowtype;
  v_elapsed   numeric;
  v_correct   boolean;
  v_points    int := 0;
  v_xp        int := 0;
  v_old_level int;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;
  if not public.pass_actif(v_player.id) then raise exception 'PASS_REQUIS'; end if;

  select * into v_session from public.quiz_sessions
  where status = 'en_cours' order by created_at desc limit 1;
  if v_session.id is null then raise exception 'QUIZ_INACTIF'; end if;

  -- La réponse doit viser LA question en cours (pas une ancienne)
  select * into v_q from public.quiz_questions
  where session_id = v_session.id and question_order = v_session.current_question;
  if v_q.id is null or v_q.id is distinct from p_question_id
     or v_session.question_started_at is null then
    raise exception 'QUESTION_FERMEE';
  end if;

  -- Chrono du serveur (+2 s de grâce pour le réseau du festival)
  v_elapsed := extract(epoch from (now() - v_session.question_started_at));
  if v_elapsed > v_q.duration_seconds + 2 then raise exception 'TROP_TARD'; end if;

  if p_answer_index is null or p_answer_index < 0
     or p_answer_index >= jsonb_array_length(v_q.choices) then
    raise exception 'REPONSE_INVALIDE';
  end if;

  -- Barème des visuels : 1 000 points tout de suite, 500 au bout du chrono
  -- (la grâce de 2 s compte comme la fin du chrono).
  v_correct := (p_answer_index = v_q.correct_index);
  if v_correct then
    v_points := 1000 - round(500 * least(1, v_elapsed / greatest(v_q.duration_seconds, 1)))::int;
    v_xp     := round(v_points / 25.0)::int;
  end if;

  -- Une seule réponse par joueur et par question (contrainte unique) : un
  -- second envoi (réseau qui renvoie) est refusé, rien n'est compté deux fois.
  insert into public.quiz_answers (question_id, player_id, answer_index, is_correct, response_ms, points)
  values (v_q.id, v_player.id, p_answer_index, v_correct, round(v_elapsed * 1000), v_points)
  on conflict (question_id, player_id) do nothing;
  if not found then raise exception 'DEJA_REPONDU'; end if;

  insert into public.quiz_scores (session_id, player_id, points, bonnes, xp, derniere_at)
  values (v_session.id, v_player.id, v_points, v_correct::int, v_xp, now())
  on conflict (session_id, player_id) do update set
    points      = quiz_scores.points + excluded.points,
    bonnes      = quiz_scores.bonnes + excluded.bonnes,
    xp          = quiz_scores.xp + excluded.xp,
    derniere_at = excluded.derniere_at;

  -- Récompense immédiate en base (le joueur ne la VOIT qu'au chrono fini)
  if v_xp > 0 then
    v_old_level := public.level_for_xp(v_player.xp);
    update public.players set
      xp    = xp + v_xp,
      level = public.level_for_xp(xp + v_xp),
      rank  = public.rank_for_level(public.level_for_xp(xp + v_xp))
    where id = v_player.id
    returning * into v_player;

    if v_player.level > v_old_level then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level, 'old_level', v_old_level));
    end if;
  end if;

  -- Surtout PAS de verdict dans la réponse : juste « verrouillée »
  return json_build_object('locked', true);
end;
$function$;

revoke all on function public.quiz_answer(p_secret_code text, p_question_id uuid, p_answer_index integer) from public, anon, authenticated;
grant execute on function public.quiz_answer(p_secret_code text, p_question_id uuid, p_answer_index integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
create or replace function public.quiz_state(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player  public.players%rowtype;
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_ma      public.quiz_answers%rowtype;
  v_moi     public.quiz_scores%rowtype;
  v_elapsed numeric;
  v_closed  boolean := false;      -- chrono fini : on peut tout montrer
  v_fini    boolean;
  v_points  int;
  v_bonnes  int;
  v_serie   int := 0;
  v_damage  int;
  v_nb      int;             -- participants
  v_total   int;
  r         record;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  -- La manche en cours en priorité, sinon la dernière jouée (récapitulatif),
  -- pendant 2 h : le lendemain, le téléphone revient à l'attente.
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
      -- On ne révèle jamais avant d'avoir cessé d'accepter les réponses (+2 s)
      v_closed  := v_elapsed > v_q.duration_seconds + 2 or v_fini;
    end if;
    select * into v_ma from public.quiz_answers
    where question_id = v_q.id and player_id = v_player.id;
  end if;

  -- Mes totaux. Pendant la question, ma réponse n'est pas encore comptée à
  -- l'écran (sinon les points trahiraient le verdict).
  select * into v_moi from public.quiz_scores
  where session_id = v_session.id and player_id = v_player.id;
  v_points := coalesce(v_moi.points, 0) - case when v_closed then 0 else coalesce(v_ma.points, 0) end;
  v_bonnes := coalesce(v_moi.bonnes, 0) - case when v_closed or not coalesce(v_ma.is_correct, false) then 0 else 1 end;

  -- Série de bonnes réponses, jusqu'à la dernière question fermée (≤ 20 lignes)
  for r in
    select a.is_correct
    from public.quiz_questions q
    left join public.quiz_answers a on a.question_id = q.id and a.player_id = v_player.id
    where q.session_id = v_session.id
      and q.question_order <= v_session.current_question - case when v_closed then 0 else 1 end
    order by q.question_order desc
  loop
    exit when not coalesce(r.is_correct, false);
    v_serie := v_serie + 1;
  end loop;

  -- Le boss : PV seulement chrono fini (une barre qui bouge pendant la
  -- question dirait, dans une petite salle, qui a juste)
  -- (participants et PV en UNE lecture de quiz_scores : c'est l'appel que tous
  -- les téléphones répètent entre deux questions)
  if v_closed or v_session.current_question = 0 then
    select count(*), coalesce(sum(points), 0)::int into v_nb, v_damage
    from public.quiz_scores where session_id = v_session.id;
    if v_session.kind <> 'raid' then v_damage := null; end if;
  end if;

  return json_build_object(
    'session', json_build_object(
      'id', v_session.id, 'title', v_session.title, 'status', v_session.status,
      'kind', v_session.kind,
      'current_question', v_session.current_question,
      'total_questions', v_total),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'boss_name', v_session.boss_name,
      'hp_max', v_session.boss_hp_max,
      'damage', v_damage,
      'hp_left', case when v_damage is null then null else greatest(0, v_session.boss_hp_max - v_damage) end,
      'defeated', case when v_damage is null then null else v_session.boss_hp_max > 0 and v_damage >= v_session.boss_hp_max end) end,

    -- La question : choix toujours, la bonne réponse SEULEMENT chrono fini.
    -- Pas d'extrait audio : il est joué sur l'écran géant.
    'question', case when v_q.id is null then null else json_build_object(
      'id', v_q.id,
      'categorie', v_q.categorie,
      'question', v_q.question,
      'choices', v_q.choices,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms', round(v_elapsed * 1000),
      'closed', v_closed,
      'correct_index', case when v_closed then v_q.correct_index end,
      'reponse',       case when v_closed then v_q.reponse end,
      'anecdote',      case when v_closed then v_q.anecdote end,
      'pochette_url',  case when v_closed then v_q.pochette_url end) end,

    -- Ma réponse : l'index tout de suite (pour griser les touches), le verdict
    -- et les points seulement chrono fini
    'my_answer', case when v_ma.id is null then null else json_build_object(
      'answer_index', v_ma.answer_index,
      'is_correct',   case when v_closed then v_ma.is_correct end,
      'points',       case when v_closed then v_ma.points end,
      'response_ms',  v_ma.response_ms) end,

    'moi', json_build_object(
      'points', v_points, 'bonnes', v_bonnes, 'serie', v_serie,
      'rang', case when v_closed and v_moi.player_id is not null then
        (select count(*) + 1 from public.quiz_scores
         where session_id = v_session.id and points > v_moi.points) end,
      'participants', case when v_closed then v_nb end),

    -- Le trio de tête (chrono fini, et podium à la fin)
    'tete', case when not v_closed then null else
      coalesce((select json_agg(row_to_json(t)) from (
        select p.pseudo, p.archetype, s.points
        from public.quiz_scores s
        join public.players p on p.id = s.player_id
        where s.session_id = v_session.id
        order by s.points desc, s.derniere_at asc
        limit 3) t), '[]'::json) end,

    -- Mon récapitulatif (quand la régie a clos la manche)
    'recap', case when v_fini then v_moi.recap end);
end;
$function$;

revoke all on function public.quiz_state(p_secret_code text) from public, anon, authenticated;
grant execute on function public.quiz_state(p_secret_code text) to anon, authenticated;

-- ----------------------------------------------------------------------------
create or replace function public.admin_quiz_end(p_session_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_session      public.quiz_sessions%rowtype;
  v_top          record;
  v_damage       int;
  v_defeated     boolean := false;
  v_participants int := 0;
  v_total        int;
  r              record;
  q              record;
  v_jetons       int;
  v_badge        text;
  v_xp_mission   int;
  v_prog         int;
  v_mission      json;
begin
  -- is_equipe() : un vendeur peut clore la manche (secours d'Otaku)
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  update public.quiz_sessions set status = 'terminee'
  where id = p_session_id
  returning * into v_session;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;
  select count(*) into v_total from public.quiz_questions where session_id = p_session_id;

  -- Les récompenses ne partent qu'une fois (deux clics de la régie, ou une
  -- manche close deux fois)
  update public.quiz_sessions set recompenses_at = now()
  where id = p_session_id and recompenses_at is null;
  if found then
    for r in
      select s.*, p.pseudo, rank() over (order by s.points desc) as rang
      from public.quiz_scores s
      join public.players p on p.id = s.player_id
      where s.session_id = p_session_id and p.status <> 'exclu'
    loop
      v_jetons := case when r.points <= 0 then 0
                       when r.rang <= 3 then 5
                       when r.rang <= 10 then 2
                       when r.bonnes >= 10 then 1
                       else 0 end;
      v_badge := case when r.rang <= 10 and r.points > 0
                      then public._award_badge(r.player_id, r.pseudo, 'Oreille d''or') end;

      -- Missions au compteur « blind » : bonnes réponses de la journée de jeu.
      -- (Pas d'événement par mission : 300 lignes d'un coup noieraient l'écran.)
      -- Seulement avec un ticket du jour valable : sinon la garde pass_garde
      -- refuserait l'XP et annulerait la clôture de TOUTE la manche (piège
      -- connu d'Otaku). Badge et jetons ne passent pas par cette garde.
      v_xp_mission := 0;
      v_mission := null;
      if r.bonnes > 0 and public.pass_actif(r.player_id) then
        for q in
          select * from public.quests where active and counter = 'blind' order by priorite desc, created_at
        loop
          v_prog := null;
          insert into public.quest_progress (player_id, quest_id, progress, jour)
          values (r.player_id, q.id, r.bonnes, public.jour_jeu())
          on conflict (player_id, quest_id, jour) do update
            set progress = quest_progress.progress + excluded.progress
            where quest_progress.completed_at is null
          returning progress into v_prog;
          continue when v_prog is null;

          if v_prog >= q.goal_count then
            update public.quest_progress set completed_at = now()
            where player_id = r.player_id and quest_id = q.id and jour = public.jour_jeu()
              and completed_at is null;
            if found then
              v_xp_mission := v_xp_mission + q.xp_reward;
              if q.badge_id is not null then
                perform public._award_badge(r.player_id, r.pseudo,
                  (select name from public.badges where id = q.badge_id));
              end if;
            end if;
          end if;
          if v_mission is null and (q.type <> 'secrete' or v_prog >= q.goal_count) then
            v_mission := json_build_object('titre', q.title, 'fait', least(v_prog, q.goal_count),
              'objectif', q.goal_count, 'terminee', v_prog >= q.goal_count, 'xp', q.xp_reward);
          end if;
        end loop;
      end if;

      if v_jetons > 0 or v_xp_mission > 0 then
        update public.players set
          xp     = xp + v_xp_mission,
          jetons = jetons + v_jetons + v_xp_mission / 10,
          level  = public.level_for_xp(xp + v_xp_mission),
          rank   = public.rank_for_level(public.level_for_xp(xp + v_xp_mission))
        where id = r.player_id;
      end if;

      update public.quiz_scores set recap = jsonb_build_object(
        'rang', r.rang, 'points', r.points, 'bonnes', r.bonnes, 'total_questions', v_total,
        'xp', r.xp + v_xp_mission, 'jetons', v_jetons + v_xp_mission / 10,
        'badge', v_badge, 'mission', v_mission)
      where session_id = p_session_id and player_id = r.player_id;
    end loop;
  end if;

  -- La meilleure oreille (le plus rapide départage)
  select p.id, p.pseudo, s.points into v_top
  from public.quiz_scores s
  join public.players p on p.id = s.player_id
  where s.session_id = p_session_id
  order by s.points desc, s.derniere_at asc
  limit 1;
  select count(*) into v_participants from public.quiz_scores where session_id = p_session_id;

  if v_session.kind = 'raid' then
    v_damage   := public._raid_damage(p_session_id);
    v_defeated := v_session.boss_hp_max > 0 and v_damage >= v_session.boss_hp_max;
    -- Le moment fort sur l'écran géant (pas de bonus collectif : décision du 18/09)
    insert into public.events (type, payload)
    values ('raid', jsonb_build_object(
      'message', case when v_defeated then
          'VICTOIRE ! Le public a conquis « ' || v_session.boss_name || ' » ! Bravo aux '
          || v_participants || ' joueurs du blind test !'
        else
          '« ' || v_session.boss_name || ' » résiste encore, il manquait '
          || (v_session.boss_hp_max - v_damage) || ' points… Revanche au prochain blind test !'
        end,
      'boss', v_session.boss_name, 'defeated', v_defeated,
      'damage', v_damage, 'hp_max', v_session.boss_hp_max,
      'bonus_xp', 0, 'participants', v_participants));
  end if;

  if v_top.id is not null then
    insert into public.events (type, player_id, payload)
    values ('quiz', v_top.id, jsonb_build_object(
      'message', v_top.pseudo || ' a la meilleure oreille du blind test avec '
        || v_top.points || ' points !',
      'quiz', v_session.title, 'points', v_top.points));
  end if;

  select * into v_session from public.quiz_sessions where id = p_session_id;
  return row_to_json(v_session);
end;
$function$;

revoke all on function public.admin_quiz_end(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_quiz_end(p_session_id uuid) to authenticated;
