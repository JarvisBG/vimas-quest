-- ----------------------------------------------------------------------------
-- Console d'administration (étape 6.1) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- console_accueil() : TOUT le tableau de bord de la console en un appel,
-- relu au signal du temps réel (au plus une fois toutes les 5 s) ou toutes
-- les 60 s. Otaku envoyait 7 requêtes (stats, événements, annonces,
-- classement, phase, bonus, identité), dont leaderboard_view (152 ms).
--   · acces    : qui est connecté (mon_acces) ;
--   · chiffres : joueurs, nouveaux et venus aujourd'hui, exclus, scans et XP
--                de la journée de jeu, journées ouvertes par ticket ;
--   · top      : tournoi du jour, 5 premiers (index players_classement_jour_idx) ;
--   · manche   : blind test en cours (titre, question n / N) ;
--   · fil      : 15 derniers faits utiles (index partiel events_console_idx :
--                ni les scans de scènes et de stands, ni les niveaux) ;
--   · bonus    : points offerts depuis 6 h — total, par personne, 12 derniers
--                (index partiel events_bonus_idx : ce panneau EST le garde-fou
--                des bonus sans plafond) ;
--   · annonces : en cours (48 h, pas finies), 3 dernières + nombre ;
--   · contenu  : ce qui est déjà saisi (QR, missions, lots, artistes,
--                concerts, lieux placés, manches) avant le festival.
-- Réservée au staff et au GM (pas aux vendeurs).
-- ----------------------------------------------------------------------------

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
      'exclus',         (select count(*) from public.players where status = 'exclu' and efface_le is null),
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
