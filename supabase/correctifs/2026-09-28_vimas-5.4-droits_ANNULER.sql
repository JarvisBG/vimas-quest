-- ============================================================================
-- ANNULE le correctif 2026-09-28_vimas-5.4-droits.sql (en cas de besoin seulement)
-- ----------------------------------------------------------------------------
-- Remet is_equipe() (vendeur compris) dans les 17 fonctions de la roue et du
-- blind test, et recrée live_board() / leaderboard_view() telles qu'avant
-- (copiées de 00_schema.sql au 28/09/2026). Aucune donnée n'est touchée.
-- ============================================================================
begin;

do $$
declare
  v_ancien constant text := 'if not public.is_staff() then raise exception ''ACCES_REFUSE''; end if;';
  v_nouveau constant text := 'if not public.is_equipe() then raise exception ''ACCES_REFUSE''; end if;';
  v_nom text;
  v_def text;
  v_n integer;
begin
  foreach v_nom in array array[
    -- La roue
    'admin_create_prize', 'admin_update_prize', 'admin_delete_prize', 'admin_prize_affichage',
    'admin_set_roulette_cost', 'admin_recent_spins', 'admin_redeem',
    -- Le blind test : écriture (le pilotage reste ouvert au vendeur)
    'admin_create_quiz_session', 'admin_rename_quiz_session', 'admin_duplicate_quiz_session',
    'admin_delete_quiz_session', 'admin_update_raid_params',
    'admin_create_quiz_question', 'admin_update_quiz_question', 'admin_delete_quiz_question',
    'admin_move_quiz_question', 'admin_blind_question'
  ] loop
    select count(*) into v_n
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = v_nom;
    if v_n <> 1 then
      raise exception '% : % version(s) en base, 1 attendue', v_nom, v_n;
    end if;

    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = v_nom;

    v_n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
    if v_n <> 1 then
      raise exception '% : % ligne(s) de garde is_staff(), 1 attendue', v_nom, v_n;
    end if;

    execute replace(v_def, v_ancien, v_nouveau);
    raise notice '% : rouverte au vendeur', v_nom;
  end loop;
end $$;

create or replace function public.leaderboard_view(p_player_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me json := null;
begin
  if p_player_id is not null then
    select json_build_object(
      'position', (select count(*) + 1 from public.players x
                   where public._points_jour(x.xp_jour, x.jour) > public._points_jour(p.xp_jour, p.jour)),
      'points_jour', public._points_jour(p.xp_jour, p.jour),
      'player',   row_to_json(p))
    into v_me
    from public.players p where p.id = p_player_id;
  end if;

  return json_build_object(
    'jour', public.jour_jeu(),
    'jour_label', public.jour_festival_label(),
    'roi_veille', public.roi_veille(),
    'players', coalesce((select json_agg(row_to_json(t)) from (
      select id, pseudo, archetype, xp, level,
             public._points_jour(xp_jour, jour) as points_jour
      from public.players
      where status = 'actif'
      order by public._points_jour(xp_jour, jour) desc, created_at asc
      limit 50) t), '[]'::json),
    'me', v_me,
    'total', (select count(*) from public.players where status = 'actif'));
end;
$function$
;

create or replace function public.live_board()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'jour', public.jour_jeu(),
    'jour_label', public.jour_festival_label(),
    'roi_veille', public.roi_veille(),
    'players', coalesce((select json_agg(row_to_json(t)) from (
      select id, pseudo, archetype, xp, level,
             public._points_jour(xp_jour, jour) as points_jour
      from public.players
      where status = 'actif'
      order by public._points_jour(xp_jour, jour) desc, created_at asc limit 10) t), '[]'::json),

    'stats', json_build_object(
      'players_total', (select count(*) from public.players where status = 'actif'),
      'xp_total',      (select coalesce(sum(xp), 0) from public.players where status = 'actif'),
      'scans_total',   (select count(*) from public.scans)),

    'winners', coalesce((select json_agg(row_to_json(w)) from (
      select e.type, e.payload, e.created_at,
             (select json_build_object('pseudo', p.pseudo, 'archetype', p.archetype)
              from public.players p where p.id = e.player_id) as players
      from public.events e
      -- 'roulette' ← AJOUT DU 37. La roulette n'écrit un événement que
      -- pour un objet ou un badge (fichier 36) : le journal ne risque
      -- donc pas d'être noyé par les gains d'XP et de jetons.
      where e.type in ('badge','level_up','quete','bonus','roulette')
         or (e.type = 'scan' and coalesce(e.payload->>'qr_type','') <> 'stand')
      order by e.created_at desc limit 8) w), '[]'::json),

    'announcements', coalesce((select json_agg(row_to_json(a)) from (
      select message, type, created_at
      from public.announcements
      order by created_at desc limit 6) a), '[]'::json));
$function$
;

grant execute on function public.leaderboard_view(p_player_id uuid) to anon, authenticated;
grant execute on function public.live_board() to anon, authenticated;

commit;
