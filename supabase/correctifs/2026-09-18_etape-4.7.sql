-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.7) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Classement des téléphones : index, classement_joueur, classement_chercher,
-- classement_amis (sources/50_classement.sql) ; player_home (copiée de
-- 00_schema.sql) calcule la position du jour sans recalculer le jour de jeu
-- pour chaque joueur (87 ms → 33 ms au banc sur 5 000 joueurs, même résultat).
-- À appliquer après 2026-09-18_etape-4.6.sql. Rejouable.
-- ============================================================================
begin;

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

create or replace function public.player_home(p_secret_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players%rowtype;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  return json_build_object(
    'player', row_to_json(v_player),

    'phase', (select phase from public.game_state where id = 1),

    'jour', public.jour_jeu(),
    'jour_label', public.jour_festival_label(),
    'roi_veille', public.roi_veille(),
    'points_jour', public._points_jour(v_player.xp_jour, v_player.jour),
    'nouveau_jour', (v_player.jour <> public.jour_jeu()),

    'pass_actif', public.pass_actif(v_player.id),
    'pass_prix', (select prix_journee from public.billetterie_config where id = 1),

    'position', (select count(*) + 1 from public.players x
                 where x.jour = (select public.jour_jeu())
                   and x.xp_jour > public._points_jour(v_player.xp_jour, v_player.jour)),

    -- ⬇️ CLÉ DU FICHIER 84 — les coups de cœur remontent avec le reste.
    'coeurs', json_build_object(
      'donnes', (select count(*) from public.coups_de_coeur
                  where player_id = v_player.id),
      'max',    coalesce((select max_coeurs from public.coeur_config where id = 1), 3),
      'actif',  coalesce((select actif      from public.coeur_config where id = 1), true)
    ),

    'badges', coalesce((
      select json_agg(json_build_object(
        'id', b.id, 'name', b.name, 'icon', b.icon, 'description', b.description,
        'owned', (pb.player_id is not null)) order by b.created_at)
      from public.badges b
      left join public.player_badges pb
        on pb.badge_id = b.id and pb.player_id = v_player.id
    ), '[]'::json),

    'quests', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'title', q.title, 'description', q.description,
        'type', q.type, 'counter', q.counter, 'goal_count', q.goal_count,
        'xp_reward', q.xp_reward, 'requires_staff', q.requires_staff,
        'categorie', q.categorie, 'completed_at', qp.completed_at,
        'progress', coalesce(qp.progress, 0),
        'completed', (qp.completed_at is not null))
        -- ⬇️ LE TRI PAR JOUEUR DU FICHIER 76 — ne pas le perdre.
        order by q.priorite desc, md5(v_player.id::text || q.id::text))
      from public.quests q
      left join public.quest_progress qp
        on qp.quest_id = q.id and qp.player_id = v_player.id and qp.jour = public.jour_jeu()
      where q.active = true
    ), '[]'::json),

    'classement_general', (select count(*) + 1 from public.players x
                           where x.xp > v_player.xp),
    'scans_jour', (select count(*) from public.scans
                   where player_id = v_player.id and day = public.jour_jeu()),
    'roulette_cost', (select roulette_cost from public.game_state where id = 1),

    'annonce', (select json_build_object('id', a.id, 'message', a.message,
                                         'type', a.type, 'created_at', a.created_at)
                from public.announcements a
                where a.type in ('alerte', 'danger')
                  and a.created_at > now() - interval '3 hours'
                order by a.created_at desc limit 1),

    'prochain_concert', (
      select json_build_object(
        'creneau_id', c.id, 'debut', c.debut, 'fin', c.fin,
        'favori', (f.player_id is not null),
        'artiste', json_build_object('id', a.id, 'nom', a.nom, 'genre', a.genre,
                                     'photo_url', a.photo_url),
        'scene', json_build_object('id', s.id, 'nom', l.nom, 'couleur', s.couleur))
      from public.creneaux c
      join public.artistes a on a.id = c.artiste_id and a.actif
      join public.scenes s on s.id = c.scene_id
      join public.lieux l on l.id = s.id and l.actif
      left join public.favoris_programme f
        on f.creneau_id = c.id and f.player_id = v_player.id
      where c.fin > now()
      order by (f.player_id is null), c.debut
      limit 1),

    'events', coalesce((
      select json_agg(row_to_json(e)) from (
        select type, payload, created_at from public.events
        where player_id = v_player.id
        order by created_at desc limit 5
      ) e
    ), '[]'::json)
  );
end;
$function$
;

commit;
