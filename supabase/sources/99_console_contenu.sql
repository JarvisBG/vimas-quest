-- ----------------------------------------------------------------------------
-- Console : contenu du jeu (étape 6.3) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Trois écrans, chacun lu en UN appel (listes des menus déroulants comprises) :
--   console_missions() · console_badges() · console_qr()
-- et un enregistrement par formulaire (création ou modification, tous les
-- champs d'un coup) :
--   console_mission_enregistrer · console_badge_enregistrer · console_qr_enregistrer
-- Remplacent les admin_* d'Otaku (retirées par le générateur) :
--   · les listes comptaient scans et missions faites SANS index (un parcours
--     de toute la table par ligne affichée) ;
--   · catégorie et priorité d'une mission, rareté / forme / secret / lien d'un
--     badge se réglaient à part, ou pas du tout ;
--   · n'importe quel compteur était accepté (faute de frappe = mission morte) ;
--   · supprimer un QR effaçait ses scans (collections, passeports,
--     statistiques), supprimer une mission effaçait l'avancée des joueurs.
--     Décision du 19/09 : refusé dès qu'un joueur l'a scanné / terminée ;
--     on désactive à la place (console_activer).
-- Un QR se relie ici à son lieu (scène, stand, food, service…) ou à sa séance
-- de dédicaces (décision du 19/09) : c'est ce lien qui fait reconnaître le
-- concert au scan d'une scène et le stand dans la collection.
-- Réservées au staff et au GM (pas aux vendeurs).
-- ----------------------------------------------------------------------------

-- Historique d'un QR (50 derniers scans), « déjà scanné ? » avant une
-- suppression, clé étrangère : sans cet index, chacun relisait toute la table
-- (≈ 1 million de lignes en fin de festival).
create index if not exists scans_qr_idx on public.scans (qr_code_id, scanned_at);

-- Nombre de scans par QR et par journée, tenu par un déclencheur : recompter
-- 1,28 million de scans à chaque ouverture de l'écran QR coûtait ~0,5 s au
-- banc (19 ms avec les totaux). Aucune politique : lu seulement par les fonctions de la console.
create table if not exists public.qr_scans_jour (
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  jour       date not null,
  n          integer not null default 0 constraint qr_scans_jour_n check (n >= 0),
  primary key (qr_code_id, jour)
);
alter table public.qr_scans_jour enable row level security;

create or replace function public._qr_scans_compter()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.qr_scans_jour (qr_code_id, jour, n) values (new.qr_code_id, new.day, 1)
    on conflict (qr_code_id, jour) do update set n = qr_scans_jour.n + 1;
  else
    update public.qr_scans_jour set n = n - 1 where qr_code_id = old.qr_code_id and jour = old.day;
  end if;
  return null;
end;
$function$;

revoke all on function public._qr_scans_compter() from public, anon, authenticated;
drop trigger if exists scans_compter on public.scans;
create trigger scans_compter after insert or delete on public.scans
  for each row execute function public._qr_scans_compter();
-- Base déjà en service : les scans existants
insert into public.qr_scans_jour (qr_code_id, jour, n)
select qr_code_id, day, count(*) from public.scans group by qr_code_id, day
on conflict (qr_code_id, jour) do update set n = excluded.n;
-- Missions terminées par mission et par journée, tenu par un déclencheur :
-- recompter 283 000 missions faites coûtait 65 à 105 ms au banc (11 ms avec les totaux).
create table if not exists public.missions_faites_jour (
  quest_id uuid not null references public.quests(id) on delete cascade,
  jour     date not null,
  n        integer not null default 0 constraint missions_faites_jour_n check (n >= 0),
  primary key (quest_id, jour)
);
alter table public.missions_faites_jour enable row level security;

create or replace function public._missions_faites_compter()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- +1 quand une avancée devient terminée (ou naît terminée : validation au stand)
  if tg_op in ('INSERT', 'UPDATE') and new.completed_at is not null
     and (tg_op = 'INSERT' or old.completed_at is null) then
    insert into public.missions_faites_jour (quest_id, jour, n) values (new.quest_id, new.jour, 1)
    on conflict (quest_id, jour) do update set n = missions_faites_jour.n + 1;
  end if;
  -- -1 quand une avancée terminée disparaît ou redevient en cours
  if tg_op in ('DELETE', 'UPDATE') and old.completed_at is not null
     and (tg_op = 'DELETE' or new.completed_at is null) then
    update public.missions_faites_jour set n = n - 1 where quest_id = old.quest_id and jour = old.jour;
  end if;
  return null;
end;
$function$;

revoke all on function public._missions_faites_compter() from public, anon, authenticated;
drop trigger if exists quest_progress_compter on public.quest_progress;
create trigger quest_progress_compter after insert or update of completed_at or delete on public.quest_progress
  for each row execute function public._missions_faites_compter();
insert into public.missions_faites_jour (quest_id, jour, n)
select quest_id, jour, count(*) from public.quest_progress where completed_at is not null group by quest_id, jour
on conflict (quest_id, jour) do update set n = excluded.n;

-- Les compteurs qu'une mission peut suivre. scan_<type> : scans d'un type de
-- QR ; qr : seulement les QR reliés à la mission ; manuel : validée au stand ;
-- blind : manche du blind test (admin_quiz_end) ; coeur : coups de cœur.
create or replace function public._compteurs_mission()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array['scan_any', 'scan_scene', 'scan_stand', 'scan_foodtruck', 'scan_service',
               'scan_relique', 'scan_dedicace', 'scan_surprise', 'qr', 'manuel', 'blind', 'coeur'];
$function$;

-- Barème des QR (XP par défaut quand le champ est laissé vide)
create or replace function public._xp_qr_defaut(p_type text, p_rarete text)
 returns integer
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when p_type = 'scene'     then 30
    when p_type = 'stand'     then 20
    when p_type = 'foodtruck' then 15
    when p_type = 'service'   then 10
    when p_type = 'dedicace'  then 100
    when p_type = 'surprise'  then 80
    when p_type = 'relique' and p_rarete = 'commune'    then 75
    when p_type = 'relique' and p_rarete = 'rare'       then 150
    when p_type = 'relique' and p_rarete = 'legendaire' then 300
    else 20 end;
$function$;

-- Un entier lu dans le JSON d'un formulaire (null si absent ou pas un nombre)
create or replace function public._json_entier(p jsonb, p_cle text)
 returns integer
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when trim(coalesce(p ->> p_cle, '')) ~ '^-?[0-9]{1,7}$'
              then trim(p ->> p_cle)::integer end;
$function$;

-- Un identifiant (uuid) lu dans le JSON d'un formulaire ('' = aucun)
create or replace function public._json_uuid(p jsonb, p_cle text)
 returns uuid
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when trim(coalesce(p ->> p_cle, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then trim(p ->> p_cle)::uuid end;
$function$;

-- ===========================================================================
-- Missions
-- ===========================================================================
create or replace function public.console_missions()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour date := public.jour_jeu();   -- UNE fois
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  return json_build_object(
    'jour', v_jour,
    'missions', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'titre', q.title, 'consigne', q.description, 'type', q.type,
        'categorie', q.categorie, 'compteur', q.counter, 'objectif', q.goal_count,
        'xp', q.xp_reward, 'badge_id', q.badge_id, 'badge', b.name, 'priorite', q.priorite,
        'active', q.active, 'faites_jour', coalesce(f.jour, 0), 'faites', coalesce(f.total, 0),
        'qr', coalesce(l.n, 0))
        order by q.active desc, q.priorite desc, q.created_at)
      from public.quests q
      left join public.badges b on b.id = q.badge_id
      left join (select quest_id, sum(n) as total, sum(n) filter (where jour = v_jour) as jour
                   from public.missions_faites_jour group by quest_id) f on f.quest_id = q.id
      left join (select quest_id, count(*) as n
                   from public.qr_codes
                  where quest_id is not null
                  group by quest_id) l on l.quest_id = q.id
    ), '[]'::json),
    'badges', coalesce((
      select json_agg(json_build_object('id', id, 'nom', name, 'icone', icon) order by name)
      from public.badges
    ), '[]'::json)
  );
end;
$function$;

create or replace function public.console_mission_enregistrer(p_id uuid, p_mission jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_titre    text := nullif(trim(coalesce(p_mission ->> 'titre', '')), '');
  v_consigne text := nullif(trim(coalesce(p_mission ->> 'consigne', '')), '');
  v_type     text := coalesce(nullif(trim(coalesce(p_mission ->> 'type', '')), ''), 'standard');
  v_cat      text := nullif(lower(trim(coalesce(p_mission ->> 'categorie', ''))), '');
  v_compteur text := coalesce(nullif(trim(coalesce(p_mission ->> 'compteur', '')), ''), 'manuel');
  v_objectif integer := public._json_entier(p_mission, 'objectif');
  v_xp       integer := public._json_entier(p_mission, 'xp');
  v_priorite integer := coalesce(public._json_entier(p_mission, 'priorite'), 0);
  v_badge    uuid := public._json_uuid(p_mission, 'badge_id');
  v_active   boolean := coalesce((p_mission ->> 'active')::boolean, true);
  v_id       uuid;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_titre is null or char_length(v_titre) > 80 then raise exception 'TITRE_MANQUANT'; end if;
  if char_length(coalesce(v_consigne, '')) > 400 then raise exception 'CONSIGNE_TROP_LONGUE'; end if;
  if v_type not in ('standard', 'boss', 'collection', 'secrete') then raise exception 'TYPE_INVALIDE'; end if;
  if v_cat is not null and v_cat not in ('exploration', 'musique', 'gourmand', 'social', 'defi') then
    raise exception 'CATEGORIE_INVALIDE';
  end if;
  if not (v_compteur = any (public._compteurs_mission())) then raise exception 'COMPTEUR_INVALIDE'; end if;
  -- Validée au stand : d'un coup (admin_validate_quest), l'objectif ne sert pas
  if v_compteur = 'manuel' then v_objectif := 1; end if;
  if v_objectif is null or v_objectif not between 1 and 1000 then raise exception 'OBJECTIF_INVALIDE'; end if;
  if v_xp is null or v_xp not between 0 and 5000 then raise exception 'XP_INVALIDE'; end if;
  if v_priorite not between -9 and 9 then raise exception 'PRIORITE_INVALIDE'; end if;
  if nullif(trim(coalesce(p_mission ->> 'badge_id', '')), '') is not null
     and (v_badge is null or not exists (select 1 from public.badges where id = v_badge)) then
    raise exception 'BADGE_INCONNU';
  end if;

  if p_id is null then
    insert into public.quests (title, description, type, categorie, counter, goal_count, xp_reward,
                               badge_id, priorite, active, requires_staff)
    values (v_titre, v_consigne, v_type, v_cat, v_compteur, v_objectif, v_xp,
            v_badge, v_priorite, v_active, v_compteur = 'manuel')
    returning id into v_id;
  else
    update public.quests
       set title = v_titre, description = v_consigne, type = v_type, categorie = v_cat,
           counter = v_compteur, goal_count = v_objectif, xp_reward = v_xp, badge_id = v_badge,
           priorite = v_priorite, active = v_active, requires_staff = (v_compteur = 'manuel')
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'QUETE_INCONNUE'; end if;
  end if;
  return json_build_object('id', v_id);
end;
$function$;

create or replace function public.console_mission_supprimer(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  -- Terminée par quelqu'un : la supprimer effacerait sa trace (passeport,
  -- statistiques). On la désactive à la place.
  if exists (select 1 from public.missions_faites_jour where quest_id = p_id and n > 0) then
    raise exception 'MISSION_DEJA_FAITE';
  end if;
  delete from public.quests where id = p_id;   -- avancées en cours : supprimées ; QR reliés : déliés
  if not found then raise exception 'QUETE_INCONNUE'; end if;
end;
$function$;

-- Allumer / éteindre une mission ou un QR (interrupteur de la liste)
create or replace function public.console_activer(p_quoi text, p_id uuid, p_actif boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_actif is null then raise exception 'ETAT_INVALIDE'; end if;
  if p_quoi = 'mission' then
    update public.quests set active = p_actif where id = p_id;
    if not found then raise exception 'QUETE_INCONNUE'; end if;
  elsif p_quoi = 'qr' then
    update public.qr_codes set active = p_actif where id = p_id;
    if not found then raise exception 'QR_INCONNU'; end if;
  else
    raise exception 'QUOI_INVALIDE';
  end if;
  return json_build_object('id', p_id, 'actif', p_actif);
end;
$function$;

-- ===========================================================================
-- Badges
-- ===========================================================================
create or replace function public.console_badges()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  return json_build_object(
    'joueurs', (select count(*) from public.players where efface_le is null),
    'badges', coalesce((
      select json_agg(json_build_object(
        'id', b.id, 'nom', b.name, 'icone', b.icon, 'description', b.description,
        'rarete', b.rarete, 'forme', b.forme, 'secret', b.secret, 'lien', b.lien,
        'systeme', public._is_system_badge(b.name),
        'gagnes', coalesce(g.n, 0),
        'missions', (select count(*) from public.quests q where q.badge_id = b.id),
        'qr', (select count(*) from public.qr_codes c where c.badge_id = b.id),
        'lots', (select count(*) from public.roulette_prizes r where r.badge_id = b.id))
        order by b.created_at, b.name)
      from public.badges b
      left join (select badge_id, count(*) as n from public.player_badges group by badge_id) g
        on g.badge_id = b.id
    ), '[]'::json)
  );
end;
$function$;

create or replace function public.console_badge_enregistrer(p_id uuid, p_badge jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_nom    text := nullif(trim(coalesce(p_badge ->> 'nom', '')), '');
  v_icone  text := coalesce(nullif(lower(trim(coalesce(p_badge ->> 'icone', ''))), ''), 'etoile');
  v_desc   text := nullif(trim(coalesce(p_badge ->> 'description', '')), '');
  v_rarete text := coalesce(nullif(trim(coalesce(p_badge ->> 'rarete', '')), ''), 'commun');
  v_forme  text := coalesce(nullif(trim(coalesce(p_badge ->> 'forme', '')), ''), 'rond');
  v_secret boolean := coalesce((p_badge ->> 'secret')::boolean, false);
  v_lien   text := nullif(trim(coalesce(p_badge ->> 'lien', '')), '');
  v_avant  public.badges%rowtype;
  v_id     uuid;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_nom is null or char_length(v_nom) > 40 then raise exception 'NOM_BADGE_MANQUANT'; end if;
  if v_icone !~ '^[a-z0-9]{1,20}$' then raise exception 'ICONE_INVALIDE'; end if;
  if char_length(coalesce(v_desc, '')) > 200 then raise exception 'DESCRIPTION_TROP_LONGUE'; end if;
  if v_rarete not in ('commun', 'rare', 'epique', 'legendaire') then raise exception 'RARETE_INVALIDE'; end if;
  if v_forme not in ('rond', 'etoile', 'hexa', 'ecusson') then raise exception 'FORME_INVALIDE'; end if;
  if v_lien is not null and v_lien !~ '^[a-z0-9-]+[.]html(#[A-Za-z0-9_-]+)?$' then raise exception 'LIEN_INVALIDE'; end if;

  if p_id is null then
    if public._is_system_badge(v_nom) then raise exception 'BADGE_NOM_PRIS'; end if;
    insert into public.badges (name, icon, description, rarete, forme, secret, lien)
    values (v_nom, v_icone, v_desc, v_rarete, v_forme, v_secret, v_lien)
    returning id into v_id;
  else
    select * into v_avant from public.badges where id = p_id for update;
    if v_avant.id is null then raise exception 'BADGE_INCONNU'; end if;
    -- Donné par son nom dans une fonction : renommé, il ne serait plus donné
    if public._is_system_badge(v_avant.name) and v_nom <> v_avant.name then
      raise exception 'BADGE_SYSTEME_NOM';
    end if;
    if not public._is_system_badge(v_avant.name) and public._is_system_badge(v_nom) then
      raise exception 'BADGE_NOM_PRIS';
    end if;
    update public.badges
       set name = v_nom, icon = v_icone, description = v_desc, rarete = v_rarete,
           forme = v_forme, secret = v_secret, lien = v_lien
     where id = p_id
    returning id into v_id;
  end if;
  return json_build_object('id', v_id);
exception when unique_violation then
  raise exception 'BADGE_NOM_PRIS';
end;
$function$;

create or replace function public.console_badge_supprimer(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_badge public.badges%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_badge from public.badges where id = p_id;
  if v_badge.id is null then raise exception 'BADGE_INCONNU'; end if;
  if public._is_system_badge(v_badge.name) then raise exception 'BADGE_SYSTEME_SUPPRESSION'; end if;
  if exists (select 1 from public.player_badges where badge_id = p_id) then
    raise exception 'BADGE_DEJA_GAGNE';
  end if;
  if exists (select 1 from public.quests where badge_id = p_id)
     or exists (select 1 from public.qr_codes where badge_id = p_id)
     or exists (select 1 from public.roulette_prizes where badge_id = p_id) then
    raise exception 'BADGE_UTILISE';
  end if;
  delete from public.badges where id = p_id;
end;
$function$;

-- ===========================================================================
-- QR codes
-- ===========================================================================
create or replace function public.console_qr()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour date := public.jour_jeu();   -- UNE fois
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  return json_build_object(
    'jour', v_jour,
    'qr', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'code', q.code, 'nom', q.label, 'type', q.type, 'rarete', q.rarity,
        'xp', q.xp_reward, 'indice', q.hint, 'badge_id', q.badge_id, 'badge', b.name,
        'mission_id', q.quest_id, 'mission', m.title, 'mission_active', m.active,
        'actif', q.active,
        'scans', coalesce(s.total, 0), 'scans_jour', coalesce(s.jour, 0),
        'lieu', (select json_build_object('id', l.id, 'nom', l.nom, 'categorie', l.categorie)
                   from public.lieux l where l.qr_code_id = q.id order by l.id limit 1),
        'dedicace', (select json_build_object('id', d.id, 'artiste', a.nom, 'debut', d.debut)
                       from public.dedicaces d join public.artistes a on a.id = d.artiste_id
                      where d.qr_code_id = q.id order by d.debut limit 1))
        order by q.created_at desc)
      from public.qr_codes q
      left join public.badges b on b.id = q.badge_id
      left join public.quests m on m.id = q.quest_id
      left join (select qr_code_id, sum(n) as total, sum(n) filter (where jour = v_jour) as jour
                   from public.qr_scans_jour group by qr_code_id) s on s.qr_code_id = q.id
    ), '[]'::json),
    'missions', coalesce((
      select json_agg(json_build_object('id', id, 'titre', title, 'active', active, 'compteur', counter)
                      order by active desc, title)
      from public.quests
    ), '[]'::json),
    'badges', coalesce((
      select json_agg(json_build_object('id', id, 'nom', name) order by name) from public.badges
    ), '[]'::json),
    'lieux', coalesce((
      select json_agg(json_build_object('id', id, 'nom', nom, 'categorie', categorie, 'qr_id', qr_code_id)
                      order by categorie, ordre, nom)
      from public.lieux
    ), '[]'::json),
    'dedicaces', coalesce((
      select json_agg(json_build_object('id', d.id, 'artiste', a.nom, 'debut', d.debut, 'qr_id', d.qr_code_id)
                      order by d.debut)
      from public.dedicaces d join public.artistes a on a.id = d.artiste_id
    ), '[]'::json),
    'bareme', json_build_object(
      'scene', public._xp_qr_defaut('scene', null), 'stand', public._xp_qr_defaut('stand', null),
      'foodtruck', public._xp_qr_defaut('foodtruck', null), 'service', public._xp_qr_defaut('service', null),
      'dedicace', public._xp_qr_defaut('dedicace', null), 'surprise', public._xp_qr_defaut('surprise', null),
      'commune', public._xp_qr_defaut('relique', 'commune'), 'rare', public._xp_qr_defaut('relique', 'rare'),
      'legendaire', public._xp_qr_defaut('relique', 'legendaire'))
  );
end;
$function$;

-- Le lieu qu'un type de QR peut désigner (scene → scène, stand → stand,
-- foodtruck → food, service → point pratique). Relique, surprise : aucun.
create or replace function public._qr_lieu_compatible(p_type text, p_categorie text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case p_type
    when 'scene'     then p_categorie = 'scene'
    when 'stand'     then p_categorie = 'stand'
    when 'foodtruck' then p_categorie = 'food'
    when 'service'   then p_categorie in ('service', 'eau', 'toilettes', 'secours', 'abri', 'entree')
    else false end;
$function$;

create or replace function public.console_qr_enregistrer(p_id uuid, p_qr jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_nom      text := nullif(trim(coalesce(p_qr ->> 'nom', '')), '');
  v_type     text := nullif(trim(coalesce(p_qr ->> 'type', '')), '');
  v_rarete   text := nullif(trim(coalesce(p_qr ->> 'rarete', '')), '');
  v_xp       integer := public._json_entier(p_qr, 'xp');
  v_indice   text := nullif(trim(coalesce(p_qr ->> 'indice', '')), '');
  v_badge    uuid := public._json_uuid(p_qr, 'badge_id');
  v_mission  uuid := public._json_uuid(p_qr, 'mission_id');
  v_lieu     text := nullif(trim(coalesce(p_qr ->> 'lieu_id', '')), '');
  v_dedicace uuid := public._json_uuid(p_qr, 'dedicace_id');
  v_actif    boolean := (p_qr ->> 'actif')::boolean;
  v_avant    public.qr_codes%rowtype;
  v_l        public.lieux%rowtype;
  v_d        public.dedicaces%rowtype;
  v_id       uuid;
  v_code     text;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_nom is null or char_length(v_nom) > 80 then raise exception 'LABEL_MANQUANT'; end if;
  if char_length(coalesce(v_indice, '')) > 200 then raise exception 'INDICE_TROP_LONG'; end if;

  -- Le type et la rareté ne changent plus une fois le QR créé (Otaku) : le
  -- barème et la collection du joueur en dépendent.
  if p_id is not null then
    select * into v_avant from public.qr_codes where id = p_id for update;
    if v_avant.id is null then raise exception 'QR_INCONNU'; end if;
    v_type := v_avant.type;
    v_rarete := v_avant.rarity;
  end if;
  if v_type is null or v_type not in ('scene','stand','foodtruck','service','relique','dedicace','surprise') then
    raise exception 'TYPE_INVALIDE';
  end if;
  if v_type = 'relique' then
    if coalesce(v_rarete, '') not in ('commune', 'rare', 'legendaire') then raise exception 'RARETE_MANQUANTE'; end if;
  else
    v_rarete := null;
  end if;
  v_xp := coalesce(v_xp, public._xp_qr_defaut(v_type, v_rarete));
  if v_xp not between 0 and 1000 then raise exception 'XP_INVALIDE'; end if;

  if nullif(trim(coalesce(p_qr ->> 'badge_id', '')), '') is not null
     and (v_badge is null or not exists (select 1 from public.badges where id = v_badge)) then
    raise exception 'BADGE_INCONNU';
  end if;
  if nullif(trim(coalesce(p_qr ->> 'mission_id', '')), '') is not null
     and (v_mission is null or not exists (select 1 from public.quests where id = v_mission)) then
    raise exception 'QUETE_INCONNUE';
  end if;

  if v_lieu is not null then
    select * into v_l from public.lieux where id = v_lieu for update;
    if v_l.id is null then raise exception 'LIEU_INCONNU'; end if;
    if not public._qr_lieu_compatible(v_type, v_l.categorie) then raise exception 'LIEU_INCOMPATIBLE'; end if;
    if v_l.qr_code_id is not null and v_l.qr_code_id is distinct from p_id then
      raise exception 'LIEU_DEJA_RELIE';
    end if;
  end if;
  if nullif(trim(coalesce(p_qr ->> 'dedicace_id', '')), '') is not null then
    if v_type <> 'dedicace' then raise exception 'DEDICACE_INCOMPATIBLE'; end if;
    select * into v_d from public.dedicaces where id = v_dedicace for update;
    if v_d.id is null then raise exception 'DEDICACE_INCONNUE'; end if;
    if v_d.qr_code_id is not null and v_d.qr_code_id is distinct from p_id then
      raise exception 'DEDICACE_DEJA_RELIEE';
    end if;
  end if;

  if p_id is null then
    v_code := public._gen_qr_code();
    insert into public.qr_codes (code, label, type, rarity, xp_reward, hint, badge_id, quest_id, active)
    -- Une relique naît éteinte : son indice est public dès qu'elle est active
    values (v_code, v_nom, v_type, v_rarete, v_xp, v_indice, v_badge, v_mission,
            coalesce(v_actif, v_type <> 'relique'))
    returning id into v_id;
  else
    update public.qr_codes
       set label = v_nom, xp_reward = v_xp, hint = v_indice, badge_id = v_badge, quest_id = v_mission,
           active = coalesce(v_actif, active)
     where id = p_id
    returning id, code into v_id, v_code;
  end if;

  -- Un seul lieu et une seule séance par QR (celui du formulaire)
  update public.lieux set qr_code_id = null
   where qr_code_id = v_id and id is distinct from v_lieu;
  if v_lieu is not null then
    update public.lieux set qr_code_id = v_id where id = v_lieu and qr_code_id is distinct from v_id;
  end if;
  update public.dedicaces set qr_code_id = null
   where qr_code_id = v_id and id is distinct from v_dedicace;
  if v_dedicace is not null then
    update public.dedicaces set qr_code_id = v_id where id = v_dedicace and qr_code_id is distinct from v_id;
  end if;

  return json_build_object('id', v_id, 'code', v_code);
end;
$function$;

create or replace function public.console_qr_supprimer(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  -- Scanné par quelqu'un : le supprimer effacerait ses scans (collection,
  -- passeport, statistiques). On le désactive à la place.
  if exists (select 1 from public.scans where qr_code_id = p_id) then raise exception 'QR_DEJA_SCANNE'; end if;
  delete from public.qr_codes where id = p_id;   -- lieu, dédicace : déliés (on delete set null)
  if not found then raise exception 'QR_INCONNU'; end if;
end;
$function$;

-- Historique d'un QR : totaux + 50 derniers scans (index scans_qr_idx)
create or replace function public.console_qr_scans(p_id uuid)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour date := public.jour_jeu();
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if not exists (select 1 from public.qr_codes where id = p_id) then raise exception 'QR_INCONNU'; end if;
  return json_build_object(
    'total', coalesce((select sum(n) from public.qr_scans_jour where qr_code_id = p_id), 0),
    'jour', coalesce((select n from public.qr_scans_jour where qr_code_id = p_id and jour = v_jour), 0),
    'derniers', coalesce((
      select json_agg(json_build_object('pseudo', t.pseudo, 'joueur_id', t.player_id, 'at', t.scanned_at,
                                        'artiste', t.artiste) order by t.scanned_at desc)
      from (
        select p.pseudo, s.player_id, s.scanned_at, a.nom as artiste
          from public.scans s
          join public.players p on p.id = s.player_id
          left join public.creneaux c on c.id = s.creneau_id
          left join public.artistes a on a.id = c.artiste_id
         where s.qr_code_id = p_id
         order by s.scanned_at desc
         limit 50
      ) t
    ), '[]'::json)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Droits : comptes connectés seulement, chaque fonction vérifie le rôle
-- ---------------------------------------------------------------------------
revoke all on function public._compteurs_mission() from public, anon, authenticated;
revoke all on function public._xp_qr_defaut(p_type text, p_rarete text) from public, anon, authenticated;
revoke all on function public._json_entier(p jsonb, p_cle text) from public, anon, authenticated;
revoke all on function public._json_uuid(p jsonb, p_cle text) from public, anon, authenticated;
revoke all on function public._qr_lieu_compatible(p_type text, p_categorie text) from public, anon, authenticated;
revoke all on function public.console_missions() from public, anon, authenticated;
grant execute on function public.console_missions() to authenticated;
revoke all on function public.console_mission_enregistrer(p_id uuid, p_mission jsonb) from public, anon, authenticated;
grant execute on function public.console_mission_enregistrer(p_id uuid, p_mission jsonb) to authenticated;
revoke all on function public.console_mission_supprimer(p_id uuid) from public, anon, authenticated;
grant execute on function public.console_mission_supprimer(p_id uuid) to authenticated;
revoke all on function public.console_activer(p_quoi text, p_id uuid, p_actif boolean) from public, anon, authenticated;
grant execute on function public.console_activer(p_quoi text, p_id uuid, p_actif boolean) to authenticated;
revoke all on function public.console_badges() from public, anon, authenticated;
grant execute on function public.console_badges() to authenticated;
revoke all on function public.console_badge_enregistrer(p_id uuid, p_badge jsonb) from public, anon, authenticated;
grant execute on function public.console_badge_enregistrer(p_id uuid, p_badge jsonb) to authenticated;
revoke all on function public.console_badge_supprimer(p_id uuid) from public, anon, authenticated;
grant execute on function public.console_badge_supprimer(p_id uuid) to authenticated;
revoke all on function public.console_qr() from public, anon, authenticated;
grant execute on function public.console_qr() to authenticated;
revoke all on function public.console_qr_enregistrer(p_id uuid, p_qr jsonb) from public, anon, authenticated;
grant execute on function public.console_qr_enregistrer(p_id uuid, p_qr jsonb) to authenticated;
revoke all on function public.console_qr_supprimer(p_id uuid) from public, anon, authenticated;
grant execute on function public.console_qr_supprimer(p_id uuid) to authenticated;
revoke all on function public.console_qr_scans(p_id uuid) from public, anon, authenticated;
grant execute on function public.console_qr_scans(p_id uuid) to authenticated;
