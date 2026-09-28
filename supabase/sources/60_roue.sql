-- ----------------------------------------------------------------------------
-- La roue (étape 4.8) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Le tirage reste spin_roulette (Otaku), complétée par le générateur : plafond
-- de tirages par journée de jeu (game_state.roulette_max_jour, 0 = aucun),
-- identifiant du lot gagné dans la réponse. admin_redeem note qui a remis le
-- lot (roulette_spins.redeemed_by).
--
--   roulette_joueur(code)          tout ce que la page Roue affiche, en UN appel :
--                                  coût, plafond, tirages du jour, lots de la roue
--                                  (stock à jour), bons de retrait du joueur
--   admin_prize_affichage(id, rarete, court)
--                                  couleur de la case et libellé court d'un lot
--   admin_set_roulette_plafond(n)  tirages par joueur et par journée de jeu
--
-- Les bons ne sont lisibles que par leur titulaire (le code secret prouve qui
-- demande) : roulette_spins reste fermée en lecture aux joueurs.
-- ----------------------------------------------------------------------------

-- Tirages d'un joueur depuis 6 h, et ses bons du plus récent au plus ancien.
create index if not exists roulette_spins_joueur_idx on public.roulette_spins (player_id, created_at desc);

-- Début de la journée de jeu en cours (6 h, heure de Douala), en instant.
-- À comparer à created_at : une borne calculée une fois, jamais jour_de()
-- ligne par ligne (fonction jamais dépliée par Postgres, voir PERFORMANCE.md).
create or replace function public._debut_jour_jeu()
 returns timestamptz
 language sql
 stable
 set search_path to 'public'
as $function$
  select (public.jour_jeu() + time '06:00') at time zone 'Africa/Douala';
$function$;

revoke all on function public._debut_jour_jeu() from public, anon, authenticated;

create or replace function public.roulette_joueur(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- Appelée au chargement de la page Roue, jamais en boucle. Après un tirage, la
-- page se met à jour avec la réponse de spin_roulette, sans relire.
declare
  v_player public.players%rowtype;
  v_cout   integer;
  v_max    integer;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select coalesce(roulette_cost, 30), coalesce(roulette_max_jour, 0) into v_cout, v_max
  from public.game_state where id = 1;

  return json_build_object(
    'jetons', v_player.jetons,
    'cout', v_cout,
    'max_jour', v_max,
    'tirages_jour', (select count(*) from public.roulette_spins
                     where player_id = v_player.id and created_at >= public._debut_jour_jeu()),
    'pass_actif', public.pass_actif(v_player.id),
    -- Même ordre que le tirage (created_at) : c'est l'ordre des cases.
    'lots', coalesce((
      select json_agg(json_build_object(
               'id', pr.id, 'nom', pr.name, 'court', pr.court, 'icone', pr.icon,
               'genre', pr.kind, 'valeur', pr.value, 'rarete', pr.rarete,
               'poids', pr.weight, 'stock', pr.stock) order by pr.created_at)
      from public.roulette_prizes pr
      where pr.active and pr.weight > 0), '[]'::json),
    -- Les objets à retirer au stand (les seuls à avoir un code), 50 au plus
    'bons', coalesce((
      select json_agg(b order by b.cree_le desc) from (
        select s.redeem_code as code, s.prize_id as lot, pr.name as nom, pr.icon as icone,
               pr.rarete, s.created_at as cree_le, s.redeemed_at as retire_le,
               st.display_name as par
        from public.roulette_spins s
        left join public.roulette_prizes pr on pr.id = s.prize_id
        left join public.staff st on st.user_id = s.redeemed_by
        where s.player_id = v_player.id and s.redeem_code is not null
        order by s.created_at desc
        limit 50
      ) b), '[]'::json)
  );
end;
$function$;

revoke all on function public.roulette_joueur(p_secret_code text) from public, anon, authenticated;
grant execute on function public.roulette_joueur(p_secret_code text) to anon, authenticated;

create or replace function public.admin_prize_affichage(p_id uuid, p_rarete text, p_court text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rarete text := coalesce(nullif(lower(trim(coalesce(p_rarete, ''))), ''), 'commun');
  v_court  text := nullif(trim(coalesce(p_court, '')), '');
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if v_rarete not in ('commun', 'rare', 'epique', 'legendaire') then raise exception 'RARETE_INVALIDE'; end if;
  if char_length(v_court) > 12 then raise exception 'LIBELLE_TROP_LONG'; end if;
  update public.roulette_prizes set rarete = v_rarete, court = v_court where id = p_id;
  if not found then raise exception 'LOT_INCONNU'; end if;
  return json_build_object('id', p_id, 'rarete', v_rarete, 'court', v_court);
end;
$function$;

revoke all on function public.admin_prize_affichage(p_id uuid, p_rarete text, p_court text) from public, anon, authenticated;
grant execute on function public.admin_prize_affichage(p_id uuid, p_rarete text, p_court text) to authenticated;

create or replace function public.admin_set_roulette_plafond(p_max integer)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_max is null or p_max < 0 or p_max > 1000 then raise exception 'VALEUR_INVALIDE'; end if;
  update public.game_state set roulette_max_jour = p_max where id = 1;
  return json_build_object('roulette_max_jour', p_max);
end;
$function$;

revoke all on function public.admin_set_roulette_plafond(p_max integer) from public, anon, authenticated;
grant execute on function public.admin_set_roulette_plafond(p_max integer) to authenticated;
