-- ----------------------------------------------------------------------------
-- Règles du jeu affichées sur la page Infos (étape 4.13) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- regles_jeu() : le barème des XP par type de QR (min et max des QR actifs) et
-- les règles de la roue (coût d'un tour, plafond par journée de jeu).
-- Publique (visiteurs compris) : aucun code, aucun libellé, aucun indice de QR
-- ne sort — seulement des nombres par type. Suit les réglages du GM sans
-- retoucher le site.
-- ----------------------------------------------------------------------------
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
