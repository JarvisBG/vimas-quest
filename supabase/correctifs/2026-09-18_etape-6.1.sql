-- ============================================================================
-- Correctif du 18/09/2026 (étape 6.1) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Console d'administration : console_accueil() (tout le tableau de bord en un
-- appel) et ses deux index partiels du journal ; admin_set_phase('CLOTURE')
-- prend le roi du jour sur l'index du classement du jour.
-- Copié de sources/99_console.sql et de 00_schema.sql. À appliquer après
-- 2026-09-18_etape-5.2.sql. Rejouable.
-- ============================================================================
begin;

create index if not exists events_console_idx on public.events (created_at desc)
  where type not in ('scan', 'level_up')
     or (type = 'scan' and payload->>'qr_type' = 'relique');
create index if not exists events_bonus_idx on public.events (created_at desc)
  where type = 'bonus';

create or replace function public.console_accueil()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour  date := public.jour_jeu();          -- UNE fois (voir _classement)
  v_debut timestamptz := public._debut_jour_jeu();
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  return json_build_object(
    'acces',      public.mon_acces(),
    'jour',       v_jour,
    'jour_label', public.jour_festival_label(v_jour),
    'phase',      (select g.phase from public.game_state g where g.id = 1),
    'roi_veille', public.roi_veille(),

    'chiffres', json_build_object(
      'joueurs',        (select count(*) from public.players where status = 'actif'),
      'exclus',         (select count(*) from public.players where status = 'exclu'),
      'nouveaux_jour',  (select count(*) from public.players where created_at >= v_debut),
      'joueurs_jour',   (select count(*) from public.players
                         where status = 'actif' and jour = v_jour and xp_jour > 0),
      'xp_jour',        (select coalesce(sum(xp_jour), 0) from public.players
                         where status = 'actif' and jour = v_jour),
      'scans_jour',     (select count(*) from public.scans where day = v_jour),
      'tickets_jour',   (select count(*) from public.tickets where jour = v_jour and utilise_par is not null),
      'billetterie',    (select b.actif from public.billetterie_config b where b.id = 1)
    ),

    'top', coalesce((
      select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype,
                                        'points', t.xp_jour, 'xp', t.xp) order by t.xp_jour desc, t.created_at)
      from (select pseudo, archetype, xp, xp_jour, created_at from public.players
            where status = 'actif' and jour = v_jour and xp_jour > 0
            order by xp_jour desc, created_at limit 5) t), '[]'::json),

    'manche', (
      select json_build_object('id', s.id, 'titre', s.title, 'boss', s.boss_name,
                               'question', s.current_question,
                               'questions', (select count(*) from public.quiz_questions q where q.session_id = s.id))
      from public.quiz_sessions s where s.status = 'en_cours'
      order by s.created_at desc limit 1),

    'fil', coalesce((
      select json_agg(json_build_object('id', e.id, 'type', e.type, 'at', e.created_at,
                                        'message', e.payload->>'message', 'pseudo', p.pseudo)
                      order by e.created_at desc)
      from (select id, type, payload, player_id, created_at from public.events
            where type not in ('scan', 'level_up')
               or (type = 'scan' and payload->>'qr_type' = 'relique')
            order by created_at desc limit 15) e
      left join public.players p on p.id = e.player_id), '[]'::json),

    'bonus', (
      with b as (
        select e.created_at, coalesce(e.payload->>'par', 'Game Master') as par,
               coalesce((e.payload->>'xp')::int, 0) as xp, e.payload->>'reason' as motif, p.pseudo
        from public.events e
        left join public.players p on p.id = e.player_id
        where e.type = 'bonus' and e.created_at >= v_debut
      )
      select json_build_object(
        'total', coalesce((select sum(xp) from b), 0),
        'gestes', (select count(*) from b),
        'par', coalesce((select json_agg(json_build_object('par', par, 'xp', xp, 'gestes', n) order by xp desc)
                         from (select par, sum(xp)::int as xp, count(*)::int as n from b group by par) x), '[]'::json),
        'derniers', coalesce((select json_agg(json_build_object('at', created_at, 'par', par, 'joueur', pseudo,
                                                                'xp', xp, 'motif', motif) order by created_at desc)
                              from (select * from b order by created_at desc limit 12) d), '[]'::json))),

    'annonces', json_build_object(
      'en_cours', (select count(*) from public.announcements
                   where created_at >= now() - interval '48 hours' and (fin is null or fin > now())),
      'dernieres', coalesce((
        select json_agg(json_build_object('id', a.id, 'titre', a.titre, 'message', a.message,
                                          'type', a.type, 'created_at', a.created_at) order by a.created_at desc)
        from (select id, titre, message, type, created_at from public.announcements
              where created_at >= now() - interval '48 hours' and (fin is null or fin > now())
              order by created_at desc limit 3) a), '[]'::json)),

    'contenu', json_build_object(
      'qr',         (select count(*) from public.qr_codes),
      'qr_actifs',  (select count(*) from public.qr_codes where active),
      'missions',   (select count(*) from public.quests where active),
      'lots',       (select count(*) from public.roulette_prizes where active),
      'artistes',   (select count(*) from public.artistes),
      'concerts',   (select count(*) from public.creneaux),
      'lieux',      (select count(*) from public.lieux),
      'lieux_places', (select count(*) from public.lieux where x is not null and y is not null),
      'manches',    (select count(*) from public.quiz_sessions where status <> 'terminee')
    )
  );
end;
$function$;

revoke all on function public.console_accueil() from public, anon, authenticated;
grant execute on function public.console_accueil() to authenticated;

create or replace function public.admin_set_phase(p_phase text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state public.game_state%rowtype;
  v_roi   record;
  v_jour  date := public.jour_jeu();   -- UNE fois (voir _classement)
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if p_phase not in ('EXPLORATION','QUIZ','RAID','CLOTURE') then
    raise exception 'PHASE_INVALIDE';
  end if;

  if p_phase = 'CLOTURE' then
    select p.pseudo, p.xp_jour as points
      into v_roi
      from public.players p
      where p.status = 'actif' and p.jour = v_jour and p.xp_jour > 0
      order by p.xp_jour desc, p.created_at asc
      limit 1;
    if v_roi.points is not null and v_roi.points > 0 then
      insert into public.tournament_kings (jour, pseudo, points)
      values (v_jour, v_roi.pseudo, v_roi.points)
      on conflict (jour) do update
        set pseudo = excluded.pseudo, points = excluded.points, decided_at = now();
    end if;
  end if;

  update public.game_state
     set phase = p_phase, updated_at = now()
   where id = 1
  returning * into v_state;

  -- Trace pour l'écran géant et le journal
  insert into public.events (type, payload)
  values ('phase', jsonb_build_object(
    'message', case p_phase
      when 'EXPLORATION' then 'Retour à l''exploration libre — toutes les quêtes sont ouvertes !'
      when 'QUIZ'        then 'Le grand quiz commence — tous sur vos téléphones !'
      when 'RAID'        then 'BLIND TEST — les missions sont en pause, tout le monde joue ensemble !'
      else                    'Le jeu est terminé — place au podium !'
    end,
    'phase', p_phase));

  return row_to_json(v_state);
end;
$function$
;

revoke all on function public.admin_set_phase(p_phase text) from public, anon, authenticated;
grant execute on function public.admin_set_phase(p_phase text) to authenticated;

commit;
