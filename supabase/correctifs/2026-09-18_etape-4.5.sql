-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.5) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Collection : badges, artistes vus, stands, reliques.
--   · type de QR « cache » → « relique » (nom d'Otaku, gardé : décision du 18/09) ;
--   · badges : rarete, forme, secret, lien (+ valeurs du catalogue DOMAF) ;
--   · scans.creneau_id : un QR de scène se scanne une fois par CONCERT ;
--   · scan_qr et admin_create_qr (copiées de 00_schema.sql) ;
--   · player_collection réécrite, admin_badge_affichage (sources/40_collection.sql).
-- À appliquer après 2026-09-18_etape-4.4.sql. Rejouable.
-- ============================================================================
begin;

-- --- Reliques ------------------------------------------------------------------
alter table public.qr_codes drop constraint if exists qr_codes_type_check;
update public.qr_codes set type = 'relique' where type = 'cache';
alter table public.qr_codes add constraint qr_codes_type_check CHECK ((type = ANY (ARRAY['scene'::text, 'stand'::text, 'foodtruck'::text, 'service'::text, 'relique'::text, 'dedicace'::text, 'surprise'::text])));
update public.quests set counter = 'scan_relique' where counter = 'scan_cache';

-- --- Badges --------------------------------------------------------------------
alter table public.badges add column if not exists rarete text default 'commun' not null;
alter table public.badges add column if not exists forme text default 'rond' not null;
alter table public.badges add column if not exists secret boolean default false not null;
alter table public.badges add column if not exists lien text;
alter table public.badges drop constraint if exists badges_rarete;
alter table public.badges drop constraint if exists badges_forme;
alter table public.badges drop constraint if exists badges_lien;
alter table public.badges add constraint badges_rarete check (rarete in ('commun', 'rare', 'epique', 'legendaire'));
alter table public.badges add constraint badges_forme check (forme in ('rond', 'etoile', 'hexa', 'ecusson'));
alter table public.badges add constraint badges_lien check (lien ~ '^[a-z0-9-]+[.]html(#[A-Za-z0-9_-]+)?$');

update public.badges b
set description = v.description, rarete = v.rarete, forme = v.forme, secret = v.secret, lien = v.lien
from (values
  ('Première note',    'onde',       'Scanner ton tout premier QR.',                         'commun',     'rond',    false, 'scanner.html'),
  ('Curieux',          'plan',       'Scanner 5 stands différents.',                         'commun',     'rond',    false, 'plan.html'),
  ('Fouineur',         'cible',      'Trouver une relique.',                                 'epique',     'etoile',  false, 'collection.html'),
  ('Autographe',       'etoile',     'Rencontrer un artiste en séance de dédicaces.',        'epique',     'ecusson', false, 'programme.html'),
  ('Lève-tôt',         'horloge',    'Scanner un QR avant 17h.',                             'commun',     'hexa',    false, 'scanner.html'),
  ('Échauffement',     'eclair',     'Réussir la mission Échauffement.',                     'commun',     'hexa',    false, 'missions.html'),
  ('Gourmet',          'couverts',   'Terminer la mission Gourmet du festival.',             'rare',       'rond',    false, 'missions.html'),
  ('En tournée',       'micro',      'Terminer la mission Tournée des scènes.',              'rare',       'etoile',  false, 'missions.html'),
  ('Noctambule',       'etoile',     'Scanner une scène pendant un concert après minuit.',   'rare',       'ecusson', false, 'programme.html'),
  ('Jury',             'coeur',      'Voter pour 3 stands dans les Coups de cœur.',          'commun',     'ecusson', false, 'coups-de-coeur.html'),
  ('Oreille d''or',    'micro',      'Finir dans le top 10 d''une manche du blind test.',    'epique',     'etoile',  false, 'blind-test.html'),
  ('Marathonien',      'calendrier', 'Scanner au moins un QR chacun des 4 jours.',           'rare',       'hexa',    false, 'scanner.html'),
  ('Podium',           'trophee',    'Finir une journée dans le top 3 du classement.',       'legendaire', 'etoile',  false, 'classement.html'),
  ('Sous les étoiles', 'etoile',     'Être là au bon moment, au bon endroit.',               'legendaire', 'rond',    true,  null),
  ('Backstage',        'cadenas',    'Quelqu''un en coulisses détient la clé.',              'epique',     'ecusson', true,  null)
) as v(name, icon, description, rarete, forme, secret, lien)
where b.name = v.name;

-- --- Un scan de scène par concert ----------------------------------------------
alter table public.scans add column if not exists creneau_id uuid;
alter table public.scans drop constraint if exists scans_creneau_id_fkey;
alter table public.scans add constraint scans_creneau_id_fkey
  foreign key (creneau_id) references public.creneaux(id) on update cascade;
create index if not exists scans_creneau_idx on public.scans (creneau_id) where creneau_id is not null;
drop index if exists public.scans_once_per_day;
create UNIQUE INDEX scans_once_per_day ON public.scans USING btree (player_id, qr_code_id, day, creneau_id) NULLS NOT DISTINCT;

-- --- Fonctions -------------------------------------------------------------------
create or replace function public.admin_create_qr(p_label text, p_type text, p_rarity text DEFAULT NULL::text, p_xp integer DEFAULT NULL::integer, p_hint text DEFAULT NULL::text, p_character text DEFAULT NULL::text, p_anime text DEFAULT NULL::text, p_badge_id uuid DEFAULT NULL::uuid, p_quest_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text; v_xp integer; v_qr public.qr_codes%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_label is null or char_length(trim(p_label)) = 0 then raise exception 'LABEL_MANQUANT'; end if;
  if p_type not in ('scene','stand','foodtruck','service','relique','dedicace','surprise') then raise exception 'TYPE_INVALIDE'; end if;
  if p_type = 'relique' and coalesce(p_rarity,'') not in ('commune','rare','legendaire') then
    raise exception 'RARETE_MANQUANTE';
  end if;

  v_xp := coalesce(p_xp, case
    when p_type = 'scene'     then 30
    when p_type = 'stand'     then 20
    when p_type = 'foodtruck' then 15
    when p_type = 'service'   then 10
    when p_type = 'dedicace'  then 100
    when p_type = 'surprise'  then 80
    when p_type = 'relique' and p_rarity = 'commune'    then 75
    when p_type = 'relique' and p_rarity = 'rare'       then 150
    when p_type = 'relique' and p_rarity = 'legendaire' then 300 else 20 end);

  v_code := public._gen_qr_code();
  insert into public.qr_codes (code, label, type, rarity, xp_reward, hint, character_name, anime, badge_id, quest_id, active)
  values (v_code, trim(p_label), p_type,
          case when p_type = 'relique' then p_rarity else null end,
          v_xp, nullif(trim(coalesce(p_hint,'')),''), nullif(trim(coalesce(p_character,'')),''),
          nullif(trim(coalesce(p_anime,'')),''), p_badge_id, p_quest_id, true)
  returning * into v_qr;
  return row_to_json(v_qr);
end;
$function$
;

create or replace function public.scan_qr(p_secret_code text, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player   public.players%rowtype;
  v_qr       public.qr_codes%rowtype;
  v_phase    text;
  v_total_xp int := 0;
  v_badge    text;
  v_new_badges text[] := '{}';
  v_completed  text[] := '{}';
  v_old_level int;
  v_count    int;
  v_prog     int;
  v_deja_collection boolean;
  v_quetes   json[] := '{}';
  v_creneau  uuid;
  v_rejeu    boolean;
  v_artiste  json;
  r          record;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  -- REGLES.md §6 : en RAID les quêtes standard sont verrouillées,
  -- en CLOTURE le jeu est figé. La bannière du téléphone prévient,
  -- ICI on refuse vraiment (anti-triche).
  select phase into v_phase from public.game_state where id = 1;
  if v_phase = 'RAID'    then raise exception 'PHASE_RAID';    end if;
  if v_phase = 'CLOTURE' then raise exception 'PHASE_CLOTURE'; end if;

  select * into v_qr from public.qr_codes where code = upper(trim(p_code));
  if v_qr.id is null then raise exception 'QR_INCONNU'; end if;
  if not v_qr.active then raise exception 'QR_INACTIF'; end if;

  -- Étape 4.5 : QR d'une scène scanné pendant un concert → ce concert.
  if v_qr.type = 'scene' then
    select c.id into v_creneau
    from public.lieux l
    join public.creneaux c on c.scene_id = l.id
    join public.artistes a on a.id = c.artiste_id and a.actif
    where l.qr_code_id = v_qr.id and l.categorie = 'scene'
      and now() >= c.debut and now() < c.fin
    order by c.debut desc
    limit 1;
  end if;

  -- (a) G2 : tout se rejoue chaque jour ; une scène, à chaque concert.
  perform 1 from public.scans
    where player_id = v_player.id and qr_code_id = v_qr.id and day = public.jour_jeu()
      and creneau_id is not distinct from v_creneau;
  if found then raise exception 'DEJA_SCANNE'; end if;

  select exists(
    select 1 from public.scans
    where player_id = v_player.id and qr_code_id = v_qr.id and day = public.jour_jeu()
  ) into v_rejeu;

  -- L'artiste que ce scan ajoute à la collection (nouveau = pas encore vu)
  if v_creneau is not null then
    select json_build_object('id', a.id, 'nom', a.nom, 'dedicace', false,
             'nouveau', not exists(
               select 1 from public.scans s join public.creneaux c2 on c2.id = s.creneau_id
               where s.player_id = v_player.id and c2.artiste_id = a.id))
      into v_artiste
    from public.creneaux c join public.artistes a on a.id = c.artiste_id
    where c.id = v_creneau;
  elsif v_qr.type = 'dedicace' then
    select json_build_object('id', a.id, 'nom', a.nom, 'dedicace', true,
             'nouveau', not exists(
               select 1 from public.scans s
               where s.player_id = v_player.id and s.qr_code_id = v_qr.id))
      into v_artiste
    from public.dedicaces d join public.artistes a on a.id = d.artiste_id
    where d.qr_code_id = v_qr.id
    limit 1;
  end if;

  -- (b) G6 : ce QR avait-il déjà été trouvé un jour précédent ?
  select exists(
    select 1 from public.scans
    where player_id = v_player.id and qr_code_id = v_qr.id
  ) into v_deja_collection;

  insert into public.scans (player_id, qr_code_id, creneau_id) values (v_player.id, v_qr.id, v_creneau);
  v_total_xp := v_qr.xp_reward;

  if v_qr.badge_id is not null then
    v_badge := public._award_badge(v_player.id, v_player.pseudo,
                 (select name from public.badges where id = v_qr.badge_id));
    v_new_badges := array_append(v_new_badges, v_badge);
  end if;

  -- Badges DOMAF attribués par le scan (liste = _is_system_badge).
  select count(*) into v_count from public.scans where player_id = v_player.id;
  if v_count = 1 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Première note'));
  end if;

  if v_qr.type in ('relique', 'dedicace') then
    select count(distinct s.qr_code_id) into v_count
    from public.scans s join public.qr_codes q on q.id = s.qr_code_id
    where s.player_id = v_player.id and q.type = v_qr.type;
    if v_count = 1 then
      v_new_badges := array_append(v_new_badges,
        public._award_badge(v_player.id, v_player.pseudo,
          case v_qr.type when 'relique' then 'Fouineur' else 'Autographe' end));
    end if;
  elsif v_qr.type = 'stand' then
    select count(distinct s.qr_code_id) into v_count
    from public.scans s join public.qr_codes q on q.id = s.qr_code_id
    where s.player_id = v_player.id and q.type = 'stand';
    if v_count = 5 then
      v_new_badges := array_append(v_new_badges,
        public._award_badge(v_player.id, v_player.pseudo, 'Curieux'));
    end if;
  end if;

  -- (c) G3 : progression du jour, par type de scan OU quête précise.
  for r in
    select * from public.quests
    where active = true
      and (counter in ('scan_any', 'scan_' || v_qr.type) or id = v_qr.quest_id)
      and not v_rejeu
  loop
    v_prog := null;
    insert into public.quest_progress (player_id, quest_id, progress, jour)
    values (v_player.id, r.id, 1, public.jour_jeu())
    on conflict (player_id, quest_id, jour) do update
      set progress = quest_progress.progress + 1
      where quest_progress.completed_at is null
    returning progress into v_prog;

    if v_prog is not null and (r.type <> 'secrete' or v_prog >= r.goal_count) then
      v_quetes := v_quetes || json_build_object(
        'titre', r.title, 'fait', least(v_prog, r.goal_count), 'objectif', r.goal_count,
        'xp', r.xp_reward, 'terminee', v_prog >= r.goal_count);
    end if;

    if v_prog is not null and v_prog >= r.goal_count then
      update public.quest_progress set completed_at = now()
      where player_id = v_player.id and quest_id = r.id and jour = public.jour_jeu() and completed_at is null;
      if found then
        v_total_xp  := v_total_xp + r.xp_reward;
        v_completed := array_append(v_completed, r.title);
        insert into public.events (type, player_id, payload)
        values ('quete', v_player.id, jsonb_build_object(
          'message', v_player.pseudo || ' a terminé la mission « ' || r.title || ' » (+' || r.xp_reward || ' XP)',
          'quest', r.title, 'xp', r.xp_reward));
        if r.badge_id is not null then
          v_new_badges := array_append(v_new_badges,
            public._award_badge(v_player.id, v_player.pseudo,
              (select name from public.badges where id = r.badge_id)));
        end if;
      end if;
    end if;
  end loop;

  v_old_level := public.level_for_xp(v_player.xp);
  update public.players
  set xp     = xp + v_total_xp,
      jetons = jetons + (v_total_xp / 10),
      level  = public.level_for_xp(xp + v_total_xp),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_total_xp))
  where id = v_player.id
  returning * into v_player;

  insert into public.events (type, player_id, payload)
  values ('scan', v_player.id, jsonb_build_object(
    'message',  v_player.pseudo || ' a trouvé « ' || v_qr.label || ' » (+' || v_qr.xp_reward || ' XP)',
    'label',    v_qr.label, 'qr_type', v_qr.type, 'xp', v_qr.xp_reward,
    'character', v_qr.character_name, 'anime', v_qr.anime, 'rarity', v_qr.rarity));

  if v_player.level > v_old_level then
    insert into public.events (type, player_id, payload)
    values ('level_up', v_player.id, jsonb_build_object(
      'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level',   v_player.level, 'old_level', v_old_level));
  end if;

  return json_build_object(
    'qr', json_build_object(
      'label', v_qr.label, 'type', v_qr.type, 'rarity', v_qr.rarity,
      'character_name', v_qr.character_name, 'anime', v_qr.anime, 'hint', v_qr.hint),
    'xp_gagne', v_total_xp, 'jetons_gagnes', v_total_xp / 10,
    'deja_collection', v_deja_collection, 'jour_label', public.jour_festival_label(),
    'nouveaux_badges', to_json(array_remove(v_new_badges, null)),
    'quetes_terminees', to_json(v_completed),
    'quetes', to_json(v_quetes),
    'artiste', v_artiste,
    'niveau_precedent', v_old_level, 'nouveau_niveau', v_player.level,
    'player', row_to_json(v_player));
end;
$function$
;

create or replace function public.player_collection(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_joueurs numeric;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  select greatest(count(*), 1) into v_joueurs from public.players;

  return json_build_object(
    'badges', coalesce((
      select json_agg(json_build_object(
        'id', b.id,
        'nom',   case when b.secret and pb.earned_at is null then null else b.name end,
        'icone', case when b.secret and pb.earned_at is null then null else b.icon end,
        'texte', b.description, 'rarete', b.rarete, 'forme', b.forme,
        'secret', b.secret, 'lien', b.lien,
        'pct', round(100 * coalesce(n.nb, 0) / v_joueurs),
        'obtenu', pb.earned_at)
        -- 01_reference crée tous les badges dans la même seconde : rareté, puis nom
        order by b.created_at, array_position(array['commun','rare','epique','legendaire'], b.rarete), b.name)
      from public.badges b
      left join public.player_badges pb on pb.badge_id = b.id and pb.player_id = v_player.id
      left join (select badge_id, count(*) as nb from public.player_badges group by badge_id) n
        on n.badge_id = b.id
    ), '[]'::json),

    -- Le concert affiché : le prochain (ou en cours), sinon le dernier.
    'artistes', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'nom', a.nom, 'genre', a.genre, 'photo_url', a.photo_url,
        'concert', c.concert,
        'vu', least(v.vu, d.vu), 'dedicace', (d.vu is not null)) order by c.debut, a.nom)
      from public.artistes a
      cross join lateral (
        select cr.debut, json_build_object('debut', cr.debut,
                 'scene', json_build_object('id', s.id, 'nom', l.nom, 'couleur', s.couleur)) as concert
        from public.creneaux cr
        join public.scenes s on s.id = cr.scene_id
        join public.lieux l on l.id = s.id
        where cr.artiste_id = a.id
        order by (cr.fin <= now()), case when cr.fin > now() then cr.debut end, cr.debut desc
        limit 1) c
      left join lateral (
        select min(sc.scanned_at) as vu
        from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
        where sc.player_id = v_player.id and cr.artiste_id = a.id) v on true
      left join lateral (
        select min(sc.scanned_at) as vu
        from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
        where sc.player_id = v_player.id and de.artiste_id = a.id) d on true
      where a.actif
    ), '[]'::json),

    'stands', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'nom', l.nom, 'categorie', l.categorie, 'zone', l.description,
        'vu', (select min(sc.scanned_at) from public.scans sc
               where sc.player_id = v_player.id and sc.qr_code_id = l.qr_code_id))
        order by l.ordre, l.nom)
      from public.lieux l
      where l.actif and l.categorie in ('stand', 'food') and l.qr_code_id is not null
    ), '[]'::json),

    -- Une relique éteinte reste dans la collection de ceux qui l'ont trouvée.
    'reliques', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'rarete', q.rarity, 'indice', q.hint,
        'nom', case when t.vu is not null then q.label end,
        'vu', t.vu) order by q.created_at)
      from public.qr_codes q
      left join lateral (
        select min(sc.scanned_at) as vu from public.scans sc
        where sc.player_id = v_player.id and sc.qr_code_id = q.id) t on true
      where q.type = 'relique' and (q.active or t.vu is not null)
    ), '[]'::json)
  );
end;
$function$;

grant execute on function public.player_collection(p_secret_code text) to anon, authenticated;

create or replace function public.admin_badge_affichage(
  p_id uuid, p_rarete text, p_forme text, p_secret boolean, p_lien text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  update public.badges
  set rarete = coalesce(p_rarete, rarete), forme = coalesce(p_forme, forme),
      secret = coalesce(p_secret, secret), lien = nullif(trim(coalesce(p_lien, '')), '')
  where id = p_id;
  if not found then raise exception 'BADGE_INCONNU'; end if;
  return json_build_object('id', p_id);
end;
$function$;

revoke all on function public.admin_badge_affichage(p_id uuid, p_rarete text, p_forme text, p_secret boolean, p_lien text) from public, anon, authenticated;
grant execute on function public.admin_badge_affichage(p_id uuid, p_rarete text, p_forme text, p_secret boolean, p_lien text) to authenticated;

commit;
