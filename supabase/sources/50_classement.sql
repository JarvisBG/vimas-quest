-- ----------------------------------------------------------------------------
-- Classement des téléphones (étape 4.7) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- leaderboard_view (Otaku) ne classe que sur les points du jour et reste celle
-- de l'écran géant. Les téléphones utilisent ces trois fonctions :
--
--   classement_joueur(code, periode)   top 10, mes 2 voisins de chaque côté,
--                                      ma place, l'écart avec celui qui me précède
--   classement_chercher(code, texte, periode)
--                                      10 pseudos au plus contenant le texte
--                                      (3 lettres minimum, sur validation)
--   classement_amis(code, pseudos[], periode)
--                                      les amis du joueur, gardés SUR SON
--                                      TÉLÉPHONE (pas de table, 30 au plus)
--
-- periode : 'general' = XP total ; 'jour' = XP gagnés depuis 6 h (xp_jour du
-- jour de jeu ; seuls ceux qui ont joué aujourd'hui sont classés, plus le
-- joueur qui demande). Seuls les joueurs actifs comptent. Ex æquo : même place
-- (rank()), départagés à l'affichage par la date d'inscription.
--
-- Coût (banc, 5 000 joueurs, 80_classement.sql) : classement_joueur ne lit que
-- des index ; la recherche et les amis (à la demande) font UN passage trié
-- (_classement).
-- Rien de secret n'est renvoyé : pseudo, avatar, XP, place (déjà publics sur
-- l'écran géant). Le code secret sert seulement à savoir qui demande.
-- ----------------------------------------------------------------------------

-- Index du classement : top, place et voisins se lisent dans l'ordre.
create index if not exists players_classement_general_idx on public.players (xp desc, created_at) where status = 'actif';
create index if not exists players_classement_jour_idx on public.players (jour, xp_jour desc, created_at) where status = 'actif';
create index if not exists players_pseudo_lower_idx on public.players (lower(pseudo));

-- Tous les joueurs classés pour une période, avec leur place.
-- Interne : lue seulement par les fonctions ci-dessous (SECURITY DEFINER).
-- p_jour = public.jour_jeu(), calculé UNE fois par l'appelant : appelée ligne
-- par ligne, la conversion de fuseau coûte 27 ms sur 5 000 joueurs.
create or replace function public._classement(p_periode text, p_moi uuid, p_jour date)
 returns table (id uuid, pseudo text, archetype text, xp integer, score integer,
                place integer, rn integer, created_at timestamptz)
 language sql
 stable
 set search_path to 'public'
as $function$
  with base as (
    select p.id, p.pseudo, p.archetype, p.xp, p.created_at,
           case when p_periode = 'jour'
                then case when p.jour = p_jour then p.xp_jour else 0 end
                else p.xp end as score
    from public.players p
    where p.status = 'actif'
      and (p_periode <> 'jour' or (p.jour = p_jour and p.xp_jour > 0) or p.id = p_moi)
  )
  select b.id, b.pseudo, b.archetype, b.xp, b.score,
         (rank() over (order by b.score desc))::int,
         (row_number() over (order by b.score desc, b.created_at))::int,
         b.created_at
  from base b;
$function$;

revoke all on function public._classement(text, uuid, date) from public, anon, authenticated;

create or replace function public.classement_joueur(p_secret_code text, p_periode text default 'general')
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- Appelée chaque minute par chaque téléphone ouvert sur le Classement : tout
-- passe par les index players_classement_* (jamais de relecture de la table).
-- Score = xp (général) ou xp_jour des joueurs dont jour = aujourd'hui (jour).
-- Les deux branches ont la même forme ; une seule colonne change.
declare
  v_player  public.players%rowtype;
  v_periode text := case when p_periode = 'jour' then 'jour' else 'general' end;
  v_jour    date := public.jour_jeu();
  v_score   integer;
  v_place   integer;
  v_total   integer;
  v_top     json;
  v_haut    json;
  v_bas     json;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status <> 'actif' then raise exception 'JOUEUR_EXCLU'; end if;

  if v_periode = 'jour' then
    v_score := case when v_player.jour = v_jour then v_player.xp_jour else 0 end;
    select 1 + count(*) into v_place from public.players
      where status = 'actif' and jour = v_jour and xp_jour > v_score;
    select count(*) into v_total from public.players
      where status = 'actif' and jour = v_jour and xp_jour > 0;
    v_total := greatest(v_total + (case when v_score = 0 then 1 else 0 end), v_place);

    select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype, 'xp', t.xp,
             'score', t.s, 'place', t.place, 'moi', t.id = v_player.id) order by t.s desc, t.created_at)
      into v_top
    from (select x.*, (rank() over (order by x.s desc))::int as place
          from (select id, pseudo, archetype, xp, xp_jour as s, created_at from public.players
                where status = 'actif' and jour = v_jour and xp_jour > 0
                order by xp_jour desc, created_at limit 10) x) t;

    if v_place > 10 then
      select json_agg(json_build_object('pseudo', h.pseudo, 'avatar', h.archetype, 'xp', h.xp, 'score', h.s,
               'place', 1 + (select count(*) from public.players y
                             where y.status = 'actif' and y.jour = v_jour and y.xp_jour > h.s),
               'moi', false) order by h.s desc, h.created_at)
        into v_haut
      from (select id, pseudo, archetype, xp, xp_jour as s, created_at from public.players
            where status = 'actif' and jour = v_jour and xp_jour > v_score
            order by xp_jour asc, created_at desc limit 2) h;
      select json_agg(json_build_object('pseudo', b.pseudo, 'avatar', b.archetype, 'xp', b.xp, 'score', b.s,
               'place', 1 + (select count(*) from public.players y
                             where y.status = 'actif' and y.jour = v_jour and y.xp_jour > b.s),
               'moi', false) order by b.s desc, b.created_at)
        into v_bas
      from (select id, pseudo, archetype, xp, xp_jour as s, created_at from public.players
            where status = 'actif' and jour = v_jour and xp_jour <= v_score and xp_jour > 0
              and id <> v_player.id
            order by xp_jour desc, created_at limit 2) b;
    end if;
  else
    v_score := v_player.xp;
    select 1 + count(*) into v_place from public.players where status = 'actif' and xp > v_score;
    select count(*) into v_total from public.players where status = 'actif';

    select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype, 'xp', t.xp,
             'score', t.xp, 'place', t.place, 'moi', t.id = v_player.id) order by t.xp desc, t.created_at)
      into v_top
    from (select x.*, (rank() over (order by x.xp desc))::int as place
          from (select id, pseudo, archetype, xp, created_at from public.players
                where status = 'actif'
                order by xp desc, created_at limit 10) x) t;

    if v_place > 10 then
      select json_agg(json_build_object('pseudo', h.pseudo, 'avatar', h.archetype, 'xp', h.xp, 'score', h.xp,
               'place', 1 + (select count(*) from public.players y where y.status = 'actif' and y.xp > h.xp),
               'moi', false) order by h.xp desc, h.created_at)
        into v_haut
      from (select id, pseudo, archetype, xp, created_at from public.players
            where status = 'actif' and xp > v_score
            order by xp asc, created_at desc limit 2) h;
      select json_agg(json_build_object('pseudo', b.pseudo, 'avatar', b.archetype, 'xp', b.xp, 'score', b.xp,
               'place', 1 + (select count(*) from public.players y where y.status = 'actif' and y.xp > b.xp),
               'moi', false) order by b.xp desc, b.created_at)
        into v_bas
      from (select id, pseudo, archetype, xp, created_at from public.players
            where status = 'actif' and xp <= v_score and id <> v_player.id
            order by xp desc, created_at limit 2) b;
    end if;
  end if;

  -- Celui qui me précède : le plus bas de ceux qui sont au-dessus (hors top 10),
  -- ou celui juste avant moi dans le top.
  return json_build_object(
    'periode', v_periode,
    'total', v_total,
    'moi', json_build_object('place', v_place, 'score', v_score,
      'devant', (select json_build_object('pseudo', e->>'pseudo', 'ecart', (e->>'score')::int - v_score + 1)
                 from json_array_elements(coalesce(v_haut, v_top, '[]'::json)) e
                 where (e->>'score')::int > v_score
                 order by (e->>'score')::int asc limit 1)),
    'top', coalesce(v_top, '[]'::json),
    -- Mes voisins, seulement si je suis hors du top 10
    'autour', case when v_place <= 10 then '[]'::json else
      (select json_agg(z.e order by z.n, z.k) from (
         select e, 1 as n, k from json_array_elements(coalesce(v_haut, '[]'::json)) with ordinality as a(e, k)
         union all
         select json_build_object('pseudo', v_player.pseudo, 'avatar', v_player.archetype,
                  'xp', v_player.xp, 'score', v_score, 'place', v_place, 'moi', true), 2, 1
         union all
         select e, 3, k from json_array_elements(coalesce(v_bas, '[]'::json)) with ordinality as b(e, k)) z) end
  );
end;
$function$;

create or replace function public.classement_chercher(p_secret_code text, p_texte text, p_periode text default 'general')
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_moi     uuid;
  v_periode text := case when p_periode = 'jour' then 'jour' else 'general' end;
  v_texte   text := lower(trim(coalesce(p_texte, '')));
  v_motif   text;
begin
  select s.player_id into v_moi from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_moi is null then raise exception 'SESSION_INVALIDE'; end if;
  if length(v_texte) < 3 then raise exception 'RECHERCHE_TROP_COURTE'; end if;
  -- % et _ sont des caractères comme les autres dans un pseudo
  v_motif := '%' || replace(replace(replace(v_texte, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return coalesce((
    select json_agg(json_build_object(
      'pseudo', r.pseudo, 'avatar', r.archetype, 'xp', r.xp, 'score', r.score, 'place', r.place)
      order by r.exact desc, r.rn)
    from (select c.*, lower(c.pseudo) = v_texte as exact
          from public._classement(v_periode, v_moi, public.jour_jeu()) c
          where c.id <> v_moi and lower(c.pseudo) like v_motif
          order by lower(c.pseudo) = v_texte desc, c.rn
          limit 10) r
  ), '[]'::json);
end;
$function$;

create or replace function public.classement_amis(p_secret_code text, p_pseudos text[], p_periode text default 'general')
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_moi     uuid;
  v_periode text := case when p_periode = 'jour' then 'jour' else 'general' end;
begin
  select s.player_id into v_moi from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_moi is null then raise exception 'SESSION_INVALIDE'; end if;
  if coalesce(array_length(p_pseudos, 1), 0) > 30 then raise exception 'TROP_D_AMIS'; end if;

  -- Un ami qui n'a pas joué aujourd'hui apparaît quand même (score 0, sans place du jour).
  -- Les amis introuvables (joueur exclu, pseudo inconnu) sont simplement absents.
  return coalesce((
    select json_agg(json_build_object(
      'pseudo', p.pseudo, 'avatar', p.archetype, 'xp', p.xp,
      'score', coalesce(c.score, 0), 'place', c.place, 'moi', p.id = v_moi)
      order by coalesce(c.score, 0) desc, p.pseudo)
    from public.players p
    left join public._classement(v_periode, v_moi, public.jour_jeu()) c on c.id = p.id
    where p.status = 'actif'
      and (p.id = v_moi or lower(p.pseudo) in (select lower(trim(x)) from unnest(p_pseudos) as x))
  ), '[]'::json);
end;
$function$;

grant execute on function public.classement_joueur(p_secret_code text, p_periode text) to anon, authenticated;
grant execute on function public.classement_chercher(p_secret_code text, p_texte text, p_periode text) to anon, authenticated;
grant execute on function public.classement_amis(p_secret_code text, p_pseudos text[], p_periode text) to anon, authenticated;
