-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.9) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Coups de cœur : on vote pour des artistes et des stands (3 cœurs par
-- catégorie), plus pour des QR codes. coups_de_coeur (Otaku) est remplacée par
-- coeurs + coeurs_totaux ; coeur_config.cloture (dimanche 29/11 20 h) ;
-- coeur_liste / coeur_donner / coeur_retirer / coeur_palmares réécrites.
-- player_home (sans le compteur de cœurs) et profil_stats : copiées de
-- 00_schema.sql. À appliquer après 2026-09-18_etape-4.8.sql. Rejouable.
-- S'ARRÊTE si coups_de_coeur contient déjà des votes.
-- ============================================================================
begin;

do $$
declare v_votes boolean := false;
begin
  -- execute : la table n'existe plus au 2e passage
  if to_regclass('public.coups_de_coeur') is not null then
    execute 'select exists (select 1 from public.coups_de_coeur)' into v_votes;
  end if;
  if v_votes then raise exception 'coups_de_coeur contient des votes : les reprendre avant ce correctif'; end if;
end $$;
drop function if exists public.coeur_donner(text, uuid);
drop function if exists public.coeur_retirer(text, uuid);
drop function if exists public.coeur_palmares(integer);
drop table if exists public.coups_de_coeur;

alter table public.coeur_config add column if not exists cloture timestamp with time zone
  default '2026-11-29 20:00:00+01'::timestamp with time zone not null;

-- ----------------------------------------------------------------------------
-- Coups de cœur (étape 4.9) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Otaku votait pour des QR codes scannés (3 cœurs en tout). DOMAF vote pour
-- des ARTISTES et des STANDS, 3 cœurs par catégorie (coeur_config.max_coeurs),
-- modifiables jusqu'à la clôture. coups_de_coeur est retirée (générateur).
--
-- Voter demande d'être venu (décision du 18/09, principe d'Otaku : impossible
-- de voter depuis chez soi) :
--   · un artiste : scène scannée pendant un de ses concerts, ou sa dédicace
--     (le « vu » de player_collection) ;
--   · un stand ou un food-truck : son QR scanné.
-- Clôture : coeur_config.cloture (dimanche 20 h par défaut, réglable dans la
-- console : politique « ecriture staff » d'Otaku), ou phase CLOTURE.
-- XP : 10 XP (+1 jeton) par cœur, versés max_coeurs fois sur toute la partie
-- (player_profile.coeurs_payes, comme Otaku). Badge « Jury » au 3e stand voté.
--
--   coeur_liste(code)                 la page en UN appel : réglages, mes cœurs,
--                                     artistes et stands avec leur total de cœurs
--   coeur_donner(code, categorie, id) / coeur_retirer(code, categorie, id)
--                                     renvoient de quoi mettre la page à jour
--                                     sans la relire
--   coeur_palmares(categorie, n)      le haut du palmarès (écran géant)
-- ----------------------------------------------------------------------------

create table if not exists public.coeurs (
  player_id  uuid not null references public.players(id) on delete cascade,
  categorie  text not null constraint coeurs_categorie check (categorie in ('artistes', 'stands')),
  cible      text not null,            -- artistes.id ou lieux.id (stand, food)
  created_at timestamptz not null default now(),
  primary key (player_id, categorie, cible)
);
alter table public.coeurs enable row level security;
drop policy if exists "lecture staff" on public.coeurs;
create policy "lecture staff" on public.coeurs as permissive for select to authenticated using (is_staff());

-- Total de cœurs par artiste / stand, tenu par un déclencheur : recompter
-- 30 000 cœurs à chaque ouverture de la page coûtait ~13 ms au banc.
-- Aucune politique : lu seulement par les fonctions ci-dessous.
create table if not exists public.coeurs_totaux (
  categorie text not null,
  cible     text not null,
  n         integer not null default 0 constraint coeurs_totaux_n check (n >= 0),
  primary key (categorie, cible)
);
alter table public.coeurs_totaux enable row level security;

create or replace function public._coeurs_compter()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.coeurs_totaux (categorie, cible, n) values (new.categorie, new.cible, 1)
    on conflict (categorie, cible) do update set n = coeurs_totaux.n + 1;
  else
    update public.coeurs_totaux set n = n - 1 where categorie = old.categorie and cible = old.cible;
  end if;
  return null;
end;
$function$;

revoke all on function public._coeurs_compter() from public, anon, authenticated;
drop trigger if exists coeurs_compter on public.coeurs;
create trigger coeurs_compter after insert or delete on public.coeurs
  for each row execute function public._coeurs_compter();

-- Le joueur est-il venu voir cet artiste / ce stand ?
create or replace function public._coeur_votable(p_player uuid, p_categorie text, p_cible text)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select case p_categorie
    when 'artistes' then exists (
        select 1 from public.artistes a where a.id = p_cible and a.actif)
      and (exists (select 1 from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
                   where sc.player_id = p_player and cr.artiste_id = p_cible)
        or exists (select 1 from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
                   where sc.player_id = p_player and de.artiste_id = p_cible))
    when 'stands' then exists (
        select 1 from public.lieux l join public.scans sc on sc.qr_code_id = l.qr_code_id
        where l.id = p_cible and l.actif and l.categorie in ('stand', 'food') and sc.player_id = p_player)
    else false end;
$function$;

revoke all on function public._coeur_votable(p_player uuid, p_categorie text, p_cible text) from public, anon, authenticated;

-- Refus communs à donner et retirer : réglages, clôture, catégorie
create or replace function public._coeur_ouvert(p_categorie text)
 returns public.coeur_config
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare v_cfg public.coeur_config%rowtype;
begin
  if p_categorie is null or p_categorie not in ('artistes', 'stands') then raise exception 'CATEGORIE_INVALIDE'; end if;
  select * into v_cfg from public.coeur_config where id = 1;
  if not coalesce(v_cfg.actif, true) then raise exception 'COEUR_DESACTIVE'; end if;
  if now() >= v_cfg.cloture
     or coalesce((select phase from public.game_state where id = 1), 'EXPLORATION') = 'CLOTURE' then
    raise exception 'VOTES_CLOS';
  end if;
  return v_cfg;
end;
$function$;

revoke all on function public._coeur_ouvert(p_categorie text) from public, anon, authenticated;

create or replace function public.coeur_liste(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- Appelée au chargement de la page, jamais en boucle. Après un vote, la page
-- se met à jour avec la réponse de coeur_donner / coeur_retirer.
declare
  v_player public.players%rowtype;
  v_cfg    public.coeur_config%rowtype;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select * into v_cfg from public.coeur_config where id = 1;

  return (
    with totaux as (select categorie, cible, n from public.coeurs_totaux),
    mes as (select categorie, cible from public.coeurs where player_id = v_player.id),
    -- Artistes vus : les scans du joueur (quelques dizaines), pas un test par
    -- artiste. Même règle que _coeur_votable.
    vus as (select cr.artiste_id from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
            where sc.player_id = v_player.id
            union
            select de.artiste_id from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
            where sc.player_id = v_player.id),
    scannes as (select distinct qr_code_id from public.scans where player_id = v_player.id)
    select json_build_object(
      'actif',    coalesce(v_cfg.actif, true),
      'max',      coalesce(v_cfg.max_coeurs, 3),
      'xp',       coalesce(v_cfg.xp_par_coeur, 10),
      'xp_restants', greatest(coalesce(v_cfg.max_coeurs, 3)
                     - coalesce((select coeurs_payes from public.player_profile where player_id = v_player.id), 0), 0),
      'cloture',  v_cfg.cloture,
      'clos',     now() >= v_cfg.cloture
                  or coalesce((select phase from public.game_state where id = 1), 'EXPLORATION') = 'CLOTURE',
      'jury',     exists (select 1 from public.player_badges pb join public.badges b on b.id = pb.badge_id
                          where pb.player_id = v_player.id and b.name = 'Jury'),
      'mes', json_build_object(
        'artistes', coalesce((select json_agg(cible order by cible) from mes where categorie = 'artistes'), '[]'::json),
        'stands',   coalesce((select json_agg(cible order by cible) from mes where categorie = 'stands'), '[]'::json)),
      -- Même concert affiché que la collection : le prochain (ou en cours), sinon le dernier
      'artistes', coalesce((
        select json_agg(json_build_object(
          'id', a.id, 'nom', a.nom, 'genre', a.genre, 'photo_url', a.photo_url,
          'concert', c.concert, 'vu', a.id in (select artiste_id from vus), 'coeurs', coalesce(t.n, 0)) order by a.nom)
        from public.artistes a
        cross join lateral (
          select json_build_object('debut', cr.debut, 'fin', cr.fin,
                   'scene', json_build_object('id', s.id, 'nom', l.nom, 'couleur', s.couleur)) as concert
          from public.creneaux cr
          join public.scenes s on s.id = cr.scene_id
          join public.lieux l on l.id = s.id
          where cr.artiste_id = a.id
          order by (cr.fin <= now()), case when cr.fin > now() then cr.debut end, cr.debut desc
          limit 1) c
        left join totaux t on t.categorie = 'artistes' and t.cible = a.id
        where a.actif
      ), '[]'::json),
      'stands', coalesce((
        select json_agg(json_build_object(
          'id', l.id, 'nom', l.nom, 'categorie', l.categorie, 'zone', l.description,
          'vu', l.qr_code_id in (select qr_code_id from scannes),
          'coeurs', coalesce(t.n, 0)) order by l.ordre, l.nom)
        from public.lieux l
        left join totaux t on t.categorie = 'stands' and t.cible = l.id
        where l.actif and l.categorie in ('stand', 'food') and l.qr_code_id is not null
      ), '[]'::json)
    ));
end;
$function$;

revoke all on function public.coeur_liste(p_secret_code text) from public, anon, authenticated;
grant execute on function public.coeur_liste(p_secret_code text) to anon, authenticated;

create or replace function public.coeur_donner(p_secret_code text, p_categorie text, p_cible text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player    public.players%rowtype;
  v_cfg       public.coeur_config%rowtype;
  v_donnes    integer;
  v_payes     integer;
  v_gain      integer := 0;
  v_quete_xp  integer := 0;
  v_completed text[] := '{}';
  v_badges    text[] := '{}';
  v_old_level integer;
  v_prog      integer;
  r           record;
begin
  -- La ligne du joueur est verrouillée : deux votes simultanés du même joueur
  -- passent l'un après l'autre, le second voit le premier (plafond tenu).
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code))
  for update of p;
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  v_cfg := public._coeur_ouvert(p_categorie);
  if not public._coeur_votable(v_player.id, p_categorie, p_cible) then raise exception 'PAS_SCANNE'; end if;

  select count(*) into v_donnes from public.coeurs where player_id = v_player.id and categorie = p_categorie;
  if v_donnes >= coalesce(v_cfg.max_coeurs, 3) then raise exception 'PLUS_DE_COEURS'; end if;

  insert into public.coeurs (player_id, categorie, cible) values (v_player.id, p_categorie, p_cible)
  on conflict do nothing;
  if not found then raise exception 'DEJA_VOTE'; end if;

  -- L'XP est versée au plus max_coeurs fois sur toute la partie (Otaku) :
  -- retirer puis redonner ne rapporte rien de plus.
  insert into public.player_profile (player_id) values (v_player.id)
  on conflict (player_id) do nothing;
  select coeurs_payes into v_payes from public.player_profile where player_id = v_player.id;
  if v_payes < coalesce(v_cfg.max_coeurs, 3) then
    v_gain := coalesce(v_cfg.xp_par_coeur, 10);
    update public.player_profile set coeurs_payes = coeurs_payes + 1 where player_id = v_player.id;
  end if;

  -- Missions de compteur `coeur` (reprises d'Otaku, par journée de jeu)
  for r in
    select * from public.quests where active = true and counter = 'coeur'
  loop
    v_prog := null;
    insert into public.quest_progress (player_id, quest_id, progress, jour)
    values (v_player.id, r.id, 1, public.jour_jeu())
    on conflict (player_id, quest_id, jour) do update
      set progress = quest_progress.progress + 1
      where quest_progress.completed_at is null
    returning progress into v_prog;

    if v_prog is not null and v_prog >= r.goal_count then
      update public.quest_progress set completed_at = now()
      where player_id = v_player.id and quest_id = r.id
        and jour = public.jour_jeu() and completed_at is null;
      if found then
        v_quete_xp  := v_quete_xp + r.xp_reward;
        v_completed := array_append(v_completed, r.title);
        insert into public.events (type, player_id, payload)
        values ('quete', v_player.id, jsonb_build_object(
          'message', v_player.pseudo || ' a terminé la mission « ' || r.title || ' » (+' || r.xp_reward || ' XP)',
          'quest', r.title, 'xp', r.xp_reward));
        if r.badge_id is not null then
          v_badges := array_append(v_badges,
            public._award_badge(v_player.id, v_player.pseudo,
              (select name from public.badges where id = r.badge_id)));
        end if;
      end if;
    end if;
  end loop;

  -- Badge « Jury » : 3 stands votés (01_reference.sql)
  if p_categorie = 'stands' and v_donnes + 1 >= 3 then
    v_badges := array_append(v_badges, public._award_badge(v_player.id, v_player.pseudo, 'Jury'));
  end if;

  -- Une seule écriture sur players : XP du cœur + XP des missions
  v_old_level := public.level_for_xp(v_player.xp);
  if (v_gain + v_quete_xp) > 0 then
    update public.players set
      xp     = xp + v_gain + v_quete_xp,
      jetons = jetons + ((v_gain + v_quete_xp) / 10),
      level  = public.level_for_xp(xp + v_gain + v_quete_xp),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_gain + v_quete_xp))
    where id = v_player.id
    returning * into v_player;

    if v_player.level > v_old_level then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level, 'old_level', v_old_level));
    end if;
  end if;

  return json_build_object(
    'categorie', p_categorie,
    'cible',     p_cible,
    'coeurs',    coalesce((select n from public.coeurs_totaux where categorie = p_categorie and cible = p_cible), 0),
    'mes',       (select json_agg(cible order by cible) from public.coeurs
                  where player_id = v_player.id and categorie = p_categorie),
    'gain',      v_gain + v_quete_xp,
    'quetes',    to_jsonb(array_remove(v_completed, null)),
    'badges',    to_jsonb(array_remove(v_badges, null)),
    'xp',        v_player.xp,
    'jetons',    v_player.jetons,
    'level',     v_player.level,
    'rank',      v_player.rank);
end;
$function$;

revoke all on function public.coeur_donner(p_secret_code text, p_categorie text, p_cible text) from public, anon, authenticated;
grant execute on function public.coeur_donner(p_secret_code text, p_categorie text, p_cible text) to anon, authenticated;

create or replace function public.coeur_retirer(p_secret_code text, p_categorie text, p_cible text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_cfg    public.coeur_config%rowtype;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  v_cfg := public._coeur_ouvert(p_categorie);
  -- Retirer un cœur qu'on n'a pas donné ne fait rien (double clic)
  delete from public.coeurs where player_id = v_player.id and categorie = p_categorie and cible = p_cible;

  return json_build_object(
    'categorie', p_categorie,
    'cible',     p_cible,
    'coeurs',    coalesce((select n from public.coeurs_totaux where categorie = p_categorie and cible = p_cible), 0),
    'mes',       coalesce((select json_agg(cible order by cible) from public.coeurs
                           where player_id = v_player.id and categorie = p_categorie), '[]'::json));
end;
$function$;

revoke all on function public.coeur_retirer(p_secret_code text, p_categorie text, p_cible text) from public, anon, authenticated;
grant execute on function public.coeur_retirer(p_secret_code text, p_categorie text, p_cible text) to anon, authenticated;

-- Écran géant (étape 5) : le haut du palmarès, une catégorie ou les deux
create or replace function public.coeur_palmares(p_categorie text default null, p_limite integer default 10)
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(json_agg(t), '[]'::json) from (
    select x.categorie, x.cible as id, coalesce(a.nom, l.nom) as nom, x.n as coeurs
    from public.coeurs_totaux x
    left join public.artistes a on x.categorie = 'artistes' and a.id = x.cible and a.actif
    left join public.lieux l on x.categorie = 'stands' and l.id = x.cible and l.actif
    where (p_categorie is null or x.categorie = p_categorie) and x.n > 0 and coalesce(a.nom, l.nom) is not null
    order by x.n desc, coalesce(a.nom, l.nom)
    limit greatest(least(coalesce(p_limite, 10), 50), 1)
  ) t;
$function$;

revoke all on function public.coeur_palmares(p_categorie text, p_limite integer) from public, anon, authenticated;
grant execute on function public.coeur_palmares(p_categorie text, p_limite integer) to anon, authenticated;

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

create or replace function public.profil_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_out json;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  select json_build_object(
    'joueurs',    (select count(*) from public.players),
    'repondants', (select count(*) from public.player_profile),
    'contacts',   (select count(*) from public.player_contact),
    'age',        (select coalesce(json_agg(t), '[]'::json) from (
                     select tranche_age as valeur, count(*) as n
                     from public.player_profile where tranche_age is not null
                     group by 1 order by 1) t),
    'sexe',       (select coalesce(json_agg(t), '[]'::json) from (
                     select sexe as valeur, count(*) as n
                     from public.player_profile where sexe is not null
                     group by 1 order by 2 desc) t),
    'quartier',   (select coalesce(json_agg(t), '[]'::json) from (
                     select quartier as valeur, count(*) as n
                     from public.player_profile where quartier is not null
                     group by 1 order by 2 desc limit 20) t),
    'genre',      (select coalesce(json_agg(t), '[]'::json) from (
                     select genre_prefere as valeur, count(*) as n
                     from public.player_profile where genre_prefere is not null
                     group by 1 order by 2 desc limit 20) t),
    'micro',      (select coalesce(json_agg(t), '[]'::json) from (
                     select q.ordre, q.question, v.valeur, count(*) as n
                     from public.micro_votes v
                     join public.micro_questions q on q.id = v.question_id
                     group by q.ordre, q.question, v.valeur
                     order by q.ordre, count(*) desc) t),
    'coeurs',     public.coeur_palmares(null, 20),
    'sortie',     (select coalesce(json_agg(t), '[]'::json) from (
                     select 'journee' as champ, journee as valeur, count(*) as n
                       from public.sortie_reponses where journee is not null group by 2
                     union all
                     select 'revenir', revenir, count(*)
                       from public.sortie_reponses where revenir is not null group by 2
                     union all
                     select 'depense', depense, count(*)
                       from public.sortie_reponses where depense is not null group by 2
                     union all
                     select 'ameliorer', ameliorer, count(*)
                       from public.sortie_reponses where ameliorer is not null group by 2) t)
  ) into v_out;

  return v_out;
end;
$function$
;

commit;
