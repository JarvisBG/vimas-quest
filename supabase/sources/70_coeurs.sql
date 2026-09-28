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

create table public.coeurs (
  player_id  uuid not null references public.players(id) on delete cascade,
  categorie  text not null constraint coeurs_categorie check (categorie in ('artistes', 'stands')),
  cible      text not null,            -- artistes.id ou lieux.id (stand, food)
  created_at timestamptz not null default now(),
  primary key (player_id, categorie, cible)
);
alter table public.coeurs enable row level security;
create policy "lecture staff" on public.coeurs as permissive for select to authenticated using (is_staff());

-- Total de cœurs par artiste / stand, tenu par un déclencheur : recompter
-- 30 000 cœurs à chaque ouverture de la page coûtait ~13 ms au banc.
-- Aucune politique : lu seulement par les fonctions ci-dessous.
create table public.coeurs_totaux (
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
