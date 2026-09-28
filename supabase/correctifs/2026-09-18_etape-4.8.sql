-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.8) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- La roue : rareté et libellé court des lots, plafond de tirages par journée
-- de jeu (game_state.roulette_max_jour, 10 par défaut), qui a remis un lot
-- (roulette_spins.redeemed_by), roulette_joueur (page Roue en un appel).
-- spin_roulette, admin_redeem, admin_create_prize, admin_update_prize : copiées
-- de 00_schema.sql. À appliquer après 2026-09-18_etape-4.7.sql. Rejouable.
-- ============================================================================
begin;

alter table public.roulette_prizes alter column icon set default 'cadeau';
alter table public.roulette_prizes add column if not exists rarete text default 'commun' not null;
alter table public.roulette_prizes add column if not exists court text;
alter table public.roulette_prizes drop constraint if exists roulette_prizes_rarete;
alter table public.roulette_prizes add constraint roulette_prizes_rarete check (rarete in ('commun', 'rare', 'epique', 'legendaire'));
alter table public.roulette_prizes drop constraint if exists roulette_prizes_court;
alter table public.roulette_prizes add constraint roulette_prizes_court check (char_length(court) between 1 and 12);
update public.roulette_prizes set icon = 'cadeau' where icon like 'fa-%';
alter table public.roulette_spins add column if not exists redeemed_by uuid;
alter table public.game_state add column if not exists roulette_max_jour integer default 10 not null;
alter table public.game_state drop constraint if exists game_state_roulette_max_jour;
alter table public.game_state add constraint game_state_roulette_max_jour check (roulette_max_jour >= 0);

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

create or replace function public.spin_roulette(p_secret_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player  public.players%rowtype;
  v_cost    integer := 30;
  v_total   integer;
  v_pick    integer;
  v_acc     integer := 0;
  v_prize   public.roulette_prizes%rowtype;
  v_redeem  text := null;
  v_updated integer;
  v_kind    text;
  v_gain_xp integer := 0;
  v_gain_je integer := 0;
  v_badge   public.badges%rowtype;
  v_deja    boolean := false;
  v_old_lvl integer;
  v_max     integer;
  v_tirages integer;
  r         record;
begin
  -- Qui joue ?
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  -- Mur payant (§15.4). C'est aussi ce qui rend légitime l'écriture
  -- d'XP plus bas : sans pass actif, on ne serait jamais arrivé ici.
  if not public.pass_actif(v_player.id) then raise exception 'PASS_REQUIS'; end if;

  -- Coût configurable par l'admin
  select coalesce(roulette_cost, 30), coalesce(roulette_max_jour, 0) into v_cost, v_max
  from public.game_state where id = 1;

  -- Débit ATOMIQUE : la condition "jetons >= coût" est DANS le update.
  update public.players set jetons = jetons - v_cost
  where id = v_player.id and jetons >= v_cost
  returning * into v_player;
  if v_player.id is null then raise exception 'JETONS_INSUFFISANTS'; end if;

  select count(*) into v_tirages from public.roulette_spins
  where player_id = v_player.id and created_at >= public._debut_jour_jeu();
  if v_max > 0 and v_tirages >= v_max then raise exception 'PLAFOND_JOUR'; end if;

  -- Tirage pondéré parmi les lots actifs encore en stock
  select coalesce(sum(weight), 0) into v_total
  from public.roulette_prizes where active and (stock is null or stock > 0);

  if v_total = 0 then
    insert into public.roulette_spins (player_id, prize_id, cost) values (v_player.id, null, v_cost);
    return json_build_object('prize', null, 'jetons_restants', v_player.jetons, 'cost', v_cost);
  end if;

  v_pick := floor(random() * v_total);
  for r in
    select * from public.roulette_prizes
    where active and (stock is null or stock > 0) order by created_at
  loop
    v_acc := v_acc + r.weight;
    if v_pick < v_acc then v_prize := r; exit; end if;
  end loop;

  -- Stock limité : décrément CONDITIONNEL. Si un tirage simultané a
  -- raflé la dernière unité, v_updated = 0 → "rien", jamais un lot
  -- fantôme. (Un lot en XP ou en jetons se laisse en stock vide :
  -- il n'y a rien à épuiser.)
  if v_prize.stock is not null then
    update public.roulette_prizes set stock = stock - 1
    where id = v_prize.id and stock > 0;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      insert into public.roulette_spins (player_id, prize_id, cost) values (v_player.id, null, v_cost);
      return json_build_object('prize', null, 'jetons_restants', v_player.jetons, 'cost', v_cost);
    end if;
  end if;

  -- Le genre du lot. Le `ilike 'rien%'` reste en filet : si un lot est
  -- créé à la main en base sans passer par la console, un nom qui
  -- commence par "rien" vaut toujours case vide.
  v_kind := coalesce(v_prize.kind, 'objet');
  if v_prize.name ilike 'rien%' then v_kind := 'rien'; end if;

  -- ---------- La case vide : rien à verser, rien à retirer ----------
  if v_kind = 'rien' then
    insert into public.roulette_spins (player_id, prize_id, cost) values (v_player.id, v_prize.id, v_cost);
    return json_build_object(
      'prize', json_build_object('id', v_prize.id, 'name', v_prize.name, 'icon', v_prize.icon,
                                 'kind', 'rien', 'value', 0, 'redeem', null),
      'jetons_restants', v_player.jetons, 'cost', v_cost);
  end if;

  -- ---------- Les gains qui ne coûtent rien ----------
  if v_kind = 'xp'     then v_gain_xp := greatest(0, coalesce(v_prize.value, 0)); end if;
  if v_kind = 'jetons' then v_gain_je := greatest(0, coalesce(v_prize.value, 0)); end if;

  if v_kind = 'badge' then
    -- Le badge d'abord. `on conflict do nothing` : un badge ne se gagne
    -- qu'une fois (clé primaire player_id+badge_id), et retomber dessus
    -- ne doit pas faire échouer le tour.
    insert into public.player_badges (player_id, badge_id)
    values (v_player.id, v_prize.badge_id)
    on conflict do nothing;
    get diagnostics v_updated = row_count;
    v_deja := (v_updated = 0);
    select * into v_badge from public.badges where id = v_prize.badge_id;
    -- Le bonus d'XP tombe dans tous les cas : c'est lui qui garantit
    -- qu'un joueur déjà titulaire du badge ne repart pas bredouille.
    v_gain_xp := greatest(0, coalesce(v_prize.value, 0));
  end if;

  -- Versement. L'XP recalcule niveau ET rang, exactement comme un scan
  -- (03_scan.sql) — sinon un joueur pourrait dépasser un palier sans
  -- que son rang bouge. En revanche, PAS de jetons automatiques au
  -- dixième de l'XP : ici les jetons sont une dépense qu'on ne
  -- rembourse pas en douce.
  if v_gain_xp > 0 or v_gain_je > 0 then
    v_old_lvl := public.level_for_xp(v_player.xp);
    update public.players
    set xp     = xp + v_gain_xp,
        jetons = jetons + v_gain_je,
        level  = public.level_for_xp(xp + v_gain_xp),
        rank   = public.rank_for_level(public.level_for_xp(xp + v_gain_xp))
    where id = v_player.id
    returning * into v_player;

    if v_player.level > v_old_lvl then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level));
    end if;
  end if;

  -- ---------- L'objet physique : le seul à donner un bon ----------
  if v_kind = 'objet' then
    v_redeem := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  end if;

  insert into public.roulette_spins (player_id, prize_id, cost, redeem_code)
  values (v_player.id, v_prize.id, v_cost, v_redeem);

  -- Écran géant : on n'y annonce que le remarquable. Un objet et un
  -- badge, oui. Les XP et les jetons, non : ils vont tomber toutes les
  -- trente secondes et noieraient le mur sous la roulette.
  if v_kind in ('objet','badge') then
    insert into public.events (type, player_id, payload)
    values ('roulette', v_player.id, jsonb_build_object(
      'message', v_player.pseudo || ' a gagné « ' || v_prize.name || ' » à la roulette',
      'prize', v_prize.name, 'icon', v_prize.icon,
      -- 'kind' ← AJOUT DU 37. C'est lui qui dit à l'écran géant s'il
      -- doit sortir la grande carte et la fanfare (objet, à retirer au
      -- stand) ou se contenter du journal et d'un son bref (badge).
      'kind', v_kind));
  end if;

  return json_build_object(
    'prize', json_build_object(
      'id',     v_prize.id,
      'name',   v_prize.name,
      'icon',   v_prize.icon,
      'kind',   v_kind,
      'value',  greatest(v_gain_xp, v_gain_je),
      'xp',     v_gain_xp,
      'jetons', v_gain_je,
      'badge',  case when v_badge.id is null then null
                     else json_build_object('name', v_badge.name, 'icon', v_badge.icon) end,
      'deja',   v_deja,
      'redeem', v_redeem),
    'jetons_restants', v_player.jetons,
    'xp', v_player.xp, 'level', v_player.level, 'rank', v_player.rank,
    'cost', v_cost);
end;
$function$
;

create or replace function public.admin_redeem(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_spin public.roulette_spins%rowtype; v_prize public.roulette_prizes%rowtype; v_player public.players%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_spin from public.roulette_spins where redeem_code = upper(trim(p_code));
  if v_spin.id is null then raise exception 'BON_INCONNU'; end if;
  if v_spin.redeemed_at is not null then raise exception 'DEJA_RETIRE'; end if;

  update public.roulette_spins set redeemed_at = now(), redeemed_by = auth.uid() where id = v_spin.id;
  select * into v_prize from public.roulette_prizes where id = v_spin.prize_id;
  select * into v_player from public.players where id = v_spin.player_id;
  return json_build_object('prize', v_prize.name, 'player', v_player.pseudo);
end;
$function$
;

create or replace function public.admin_create_prize(p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean DEFAULT true, p_kind text DEFAULT 'objet'::text, p_value integer DEFAULT 0, p_badge_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p public.roulette_prizes%rowtype; v_kind text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if p_name is null or char_length(trim(p_name)) = 0 then raise exception 'NOM_MANQUANT'; end if;
  v_kind := coalesce(nullif(trim(coalesce(p_kind,'')),''), 'objet');
  if v_kind not in ('objet','xp','jetons','badge','rien') then raise exception 'GENRE_INCONNU'; end if;
  if v_kind = 'badge' and p_badge_id is null then raise exception 'BADGE_MANQUANT'; end if;

  insert into public.roulette_prizes (name, icon, weight, stock, active, kind, value, badge_id)
  values (trim(p_name), coalesce(nullif(trim(coalesce(p_icon,'')),''),'cadeau'),
          greatest(0, coalesce(p_weight,10)), p_stock, coalesce(p_active,true),
          v_kind, greatest(0, coalesce(p_value,0)),
          case when v_kind = 'badge' then p_badge_id else null end)
  returning * into v_p;
  return row_to_json(v_p);
end;
$function$
;

create or replace function public.admin_update_prize(p_id uuid, p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean, p_kind text DEFAULT 'objet'::text, p_value integer DEFAULT 0, p_badge_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p public.roulette_prizes%rowtype; v_kind text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  v_kind := coalesce(nullif(trim(coalesce(p_kind,'')),''), 'objet');
  if v_kind not in ('objet','xp','jetons','badge','rien') then raise exception 'GENRE_INCONNU'; end if;
  if v_kind = 'badge' and p_badge_id is null then raise exception 'BADGE_MANQUANT'; end if;

  update public.roulette_prizes set
    name = trim(p_name), icon = coalesce(nullif(trim(coalesce(p_icon,'')),''),'cadeau'),
    weight = greatest(0, coalesce(p_weight,10)), stock = p_stock, active = coalesce(p_active,true),
    kind = v_kind, value = greatest(0, coalesce(p_value,0)),
    badge_id = case when v_kind = 'badge' then p_badge_id else null end
  where id = p_id returning * into v_p;
  if v_p.id is null then raise exception 'LOT_INCONNU'; end if;
  return row_to_json(v_p);
end;
$function$
;

commit;
