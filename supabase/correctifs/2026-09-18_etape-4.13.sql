-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.13) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- regles_jeu() : barème des XP par type de QR (actifs, nombres seulement) et
-- règles de la roue, pour la page Infos. Publique. Copiée de 00_schema.sql.
-- À appliquer après 2026-09-18_etape-4.12.sql. Rejouable.
-- ============================================================================
begin;

create or replace function public.regles_jeu()
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select json_build_object(
    'bareme', coalesce((
      select json_agg(json_build_object('type', b.type, 'min', b.min, 'max', b.max) order by b.max desc, b.type)
      from (
        select q.type, min(q.xp_reward) as min, max(q.xp_reward) as max
        from public.qr_codes q
        where q.active
        group by q.type
      ) b), '[]'::json),
    'roue', (select json_build_object('cout', g.roulette_cost, 'max_jour', g.roulette_max_jour)
             from public.game_state g where g.id = 1)
  );
$function$;

revoke all on function public.regles_jeu() from public, anon, authenticated;
grant execute on function public.regles_jeu() to anon, authenticated;

commit;
