-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.10) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Annonces : titre, catégorie, lien (page du site), fin de validité ;
-- admin_publier_annonce, admin_fermer_annonce ; index sur la date.
-- player_home (l'alerte de la carte suit la fin de validité et donne le
-- titre) : copiée de 00_schema.sql. À appliquer après 2026-09-18_etape-4.9.sql.
-- Rejouable.
-- ============================================================================
begin;

alter table public.announcements add column if not exists titre text;
alter table public.announcements add column if not exists categorie text default 'pratique' not null;
alter table public.announcements add column if not exists lien text;
alter table public.announcements add column if not exists lien_libelle text;
alter table public.announcements add column if not exists fin timestamp with time zone;
alter table public.announcements drop constraint if exists announcements_titre;
alter table public.announcements add constraint announcements_titre check (char_length(titre) between 1 and 80);
alter table public.announcements drop constraint if exists announcements_categorie;
alter table public.announcements add constraint announcements_categorie check (categorie in ('meteo', 'horaire', 'surprise', 'securite', 'jeu', 'pratique'));
alter table public.announcements drop constraint if exists announcements_lien;
alter table public.announcements add constraint announcements_lien check (lien ~ '^[a-z0-9-]+[.]html([?#][A-Za-z0-9_=&#.-]*)?$');
alter table public.announcements drop constraint if exists announcements_lien_libelle;
alter table public.announcements add constraint announcements_lien_libelle check (lien_libelle is null or (lien is not null and char_length(lien_libelle) between 1 and 40));
alter table public.announcements drop constraint if exists announcements_fin;
alter table public.announcements add constraint announcements_fin check (fin is null or fin >= created_at);

-- ----------------------------------------------------------------------------
-- Annonces (étape 4.10) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- announcements gagne titre, catégorie, lien (page du site) et fin de validité
-- (générateur). Le niveau reste `type` : danger = urgent (épinglée en tête),
-- alerte = important, info / succes = info.
--
-- Les téléphones lisent la table directement (lecture publique d'Otaku, aussi
-- pour les visiteurs sans carte) : les 48 dernières heures, 30 au plus.
-- « Lue » reste sur le téléphone.
--
--   admin_publier_annonce(...)   la console (étape 6) : tous les champs
--   admin_fermer_annonce(id)     fin de validité tout de suite (l'annonce passe
--                                dans « Anciennes » au lieu de disparaître)
-- admin_create_announcement (Otaku : message + type) reste utilisable.
-- ----------------------------------------------------------------------------

-- Les téléphones ne lisent que les annonces récentes
create index if not exists announcements_recentes_idx on public.announcements (created_at desc);

create or replace function public.admin_publier_annonce(
  p_titre text, p_message text, p_type text default 'info', p_categorie text default 'pratique',
  p_lien text default null, p_lien_libelle text default null, p_fin timestamptz default null)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_row public.announcements%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'MESSAGE_VIDE'; end if;
  if p_type not in ('info', 'alerte', 'succes', 'danger') then raise exception 'TYPE_INVALIDE'; end if;
  if p_fin is not null and p_fin <= now() then raise exception 'FIN_PASSEE'; end if;
  -- Titre, catégorie, lien : vérifiés par les contraintes de la table
  insert into public.announcements (titre, message, type, categorie, lien, lien_libelle, fin)
  values (nullif(trim(p_titre), ''), trim(p_message), p_type, coalesce(p_categorie, 'pratique'),
          nullif(trim(p_lien), ''), nullif(trim(p_lien_libelle), ''), p_fin)
  returning * into v_row;
  return row_to_json(v_row);
end;
$function$;

revoke all on function public.admin_publier_annonce(p_titre text, p_message text, p_type text, p_categorie text, p_lien text, p_lien_libelle text, p_fin timestamptz) from public, anon, authenticated;
grant execute on function public.admin_publier_annonce(p_titre text, p_message text, p_type text, p_categorie text, p_lien text, p_lien_libelle text, p_fin timestamptz) to authenticated;

create or replace function public.admin_fermer_annonce(p_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_row public.announcements%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  update public.announcements set fin = now()
  where id = p_id and (fin is null or fin > now())
  returning * into v_row;
  if v_row.id is null then raise exception 'ANNONCE_INCONNUE'; end if;
  return row_to_json(v_row);
end;
$function$;

revoke all on function public.admin_fermer_annonce(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_fermer_annonce(p_id uuid) to authenticated;

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
                                         'type', a.type, 'created_at', a.created_at,
                                         'titre', a.titre, 'lien', a.lien, 'lien_libelle', a.lien_libelle)
                from public.announcements a
                where a.type in ('alerte', 'danger')
                  and a.created_at > now() - interval '3 hours'
                  and (a.fin is null or a.fin > now())
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
