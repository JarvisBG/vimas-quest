-- ============================================================================
-- Correctif du 28/09/2026 (Vimas, étape 5.4) — relecture des droits
-- ----------------------------------------------------------------------------
-- Décision de Jarvis (28/09) : un compte VENDEUR ne peut plus rien ÉCRIRE dans
-- la roue ni dans le blind test. Il garde, comme dans Otaku :
--   · ses outils : admin_manual_quests, admin_validate_quest, vendeur_award_bonus ;
--   · le PILOTAGE de secours du blind test (Game Master injoignable) :
--     admin_list_quiz_sessions, admin_list_quiz_questions, admin_quiz_live,
--     admin_quiz_start, admin_quiz_next, admin_quiz_end, admin_set_phase.
-- Tout le reste passe de is_equipe() (gm, staff, vendeur) à is_staff() (gm, staff).
--
-- Seule la ligne de garde change : chaque fonction est relue dans la base
-- (pg_get_functiondef) et réécrite avec
--     if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
-- « create or replace » garde les droits d'exécution (grant) existants.
-- S'arrête si une fonction manque, existe en plusieurs versions, ou n'a pas
-- EXACTEMENT une ligne de garde is_equipe() (déjà appliqué, ou corps modifié).
--
-- Retire aussi live_board() et leaderboard_view() : plus appelées depuis
-- l'étape 5.1 DOMAF (mur_direct) — ni par Vimas, ni par l'archive DOMAF.
--
-- Sauvegarde SQL AVANT (supabase/ROUTINE.md) : la base est partagée avec DOMAF.
-- ============================================================================
begin;

do $$
declare
  v_ancien constant text := 'if not public.is_equipe() then raise exception ''ACCES_REFUSE''; end if;';
  v_nouveau constant text := 'if not public.is_staff() then raise exception ''ACCES_REFUSE''; end if;';
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
      raise exception '% : % ligne(s) de garde is_equipe(), 1 attendue', v_nom, v_n;
    end if;

    execute replace(v_def, v_ancien, v_nouveau);
    raise notice '% : réservée au GM et au staff', v_nom;
  end loop;
end $$;

drop function if exists public.live_board();
drop function if exists public.leaderboard_view(uuid);

commit;

-- ----------------------------------------------------------------------------
-- Vérification (à coller après) : aucune ligne pour les fonctions de la liste,
-- et il ne doit rester QUE les 10 fonctions du vendeur (outils + pilotage).
-- ----------------------------------------------------------------------------
-- select p.proname
-- from pg_proc p join pg_namespace s on s.oid = p.pronamespace
-- where s.nspname = 'public' and p.prokind = 'f' and p.proname <> 'is_equipe'
--   and pg_get_functiondef(p.oid) like '%is_equipe()%'
-- order by 1;
