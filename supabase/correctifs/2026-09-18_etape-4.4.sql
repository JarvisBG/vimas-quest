-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.4) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Missions : colonne quests.categorie, player_home (copiée de 00_schema.sql)
-- renvoie categorie et completed_at, nouvelle fonction admin_quest_categorie
-- (sources/30_missions.sql). À appliquer après 2026-09-18_etape-4.3.sql.
-- Rejouable.
-- ============================================================================
begin;

alter table public.quests add column if not exists categorie text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quests_categorie') then
    alter table public.quests add constraint quests_categorie
      check (categorie in ('exploration', 'musique', 'gourmand', 'social', 'defi'));
  end if;
end $$;

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
                 where public._points_jour(x.xp_jour, x.jour)
                     > public._points_jour(v_player.xp_jour, v_player.jour)),

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

create or replace function public.admin_quest_categorie(p_id uuid, p_categorie text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cat text := nullif(lower(trim(coalesce(p_categorie, ''))), '');
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_cat is not null and v_cat not in ('exploration', 'musique', 'gourmand', 'social', 'defi') then
    raise exception 'CATEGORIE_INVALIDE';
  end if;
  update public.quests set categorie = v_cat where id = p_id;
  if not found then raise exception 'QUETE_INCONNUE'; end if;
  return json_build_object('id', p_id, 'categorie', v_cat);
end;
$function$;

revoke all on function public.admin_quest_categorie(p_id uuid, p_categorie text) from public, anon, authenticated;
grant execute on function public.admin_quest_categorie(p_id uuid, p_categorie text) to authenticated;

commit;
