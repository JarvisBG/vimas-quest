-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.11) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Sondage du soir : remplace le questionnaire de sortie d'Otaku (sortie_*).
-- sondage_config, sondage_reponses, sondage_questions, sondage_etat,
-- sondage_repondre, sondage_stats. profil_stats (le décompte du sondage au
-- lieu de la sortie) : copiée de 00_schema.sql.
-- À appliquer après 2026-09-18_etape-4.10.sql. Rejouable.
-- S'ARRÊTE si sortie_reponses contient déjà des réponses.
-- ============================================================================
begin;

do $$
declare v_reponses boolean := false;
begin
  -- execute : la table n'existe plus au 2e passage
  if to_regclass('public.sortie_reponses') is not null then
    execute 'select exists (select 1 from public.sortie_reponses)' into v_reponses;
  end if;
  if v_reponses then raise exception 'sortie_reponses contient des réponses : les exporter avant ce correctif'; end if;
end $$;
drop function if exists public.sortie_etat(text);
drop function if exists public.sortie_options();
drop function if exists public.sortie_repondre(text, text, text);
drop table if exists public.sortie_reponses;

-- ----------------------------------------------------------------------------
-- Sondage du soir (étape 4.11) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Remplace le questionnaire de sortie d'Otaku (sortie_*, retiré par le
-- générateur). Décisions du 18/09 :
--   · un sondage par journée de jeu, ouvert de 22 h à 6 h (heure de Douala) ;
--   · réponses LIÉES au joueur (statistiques croisées avec le profil) ;
--   · 40 XP + 2 jetons, seulement s'il a scanné au moins un QR ce jour-là ;
--   · les 6 questions de la maquette + 3 d'Otaku (dépense, retour, à améliorer).
-- Les questions vivent ici (sondage_questions) : le serveur vérifie chaque
-- réponse. Le brouillon reste sur le téléphone.
--
--   sondage_etat(code)                 la page en UN appel
--   sondage_repondre(code, jour, rep)  envoi unique, récompense
--   sondage_stats()                    décompte pour la console (profil_stats),
--                                      sans les textes libres
-- ----------------------------------------------------------------------------

create table if not exists public.sondage_config (
  id         integer primary key default 1 constraint sondage_config_un check (id = 1),
  actif      boolean not null default true,
  ouverture  time not null default '22:00',     -- heure de Douala, jour J
  fermeture  time not null default '06:00',     -- heure de Douala, lendemain (≤ 6 h)
  xp         integer not null default 40 constraint sondage_config_xp check (xp between 0 and 500),
  jetons     integer not null default 2 constraint sondage_config_jetons check (jetons between 0 and 50),
  constraint sondage_config_heures check (ouverture >= '06:00' and fermeture <= '06:00')
);
insert into public.sondage_config (id) values (1) on conflict (id) do nothing;
alter table public.sondage_config enable row level security;
drop policy if exists "lecture staff" on public.sondage_config;
create policy "lecture staff" on public.sondage_config as permissive for select to authenticated using (is_staff());
drop policy if exists "ecriture staff" on public.sondage_config;
create policy "ecriture staff" on public.sondage_config as permissive for update to authenticated using (is_staff());

create table if not exists public.sondage_reponses (
  player_id  uuid not null references public.players(id) on delete cascade,
  jour       date not null,                     -- journée de jeu (6 h → 6 h)
  reponses   jsonb not null,                    -- vérifiées par sondage_repondre
  created_at timestamptz not null default now(),
  primary key (player_id, jour)
);
alter table public.sondage_reponses enable row level security;
drop policy if exists "lecture staff" on public.sondage_reponses;
create policy "lecture staff" on public.sondage_reponses as permissive for select to authenticated using (is_staff());

-- Les questions, dans l'ordre. Mêmes champs que la maquette (mock.js).
-- « concert » reçoit ses choix dans sondage_etat (artistes du jour).
create or replace function public.sondage_questions()
 returns jsonb
 language sql
 immutable
 set search_path to 'public'
as $function$
  select jsonb_build_array(
    jsonb_build_object('id', 'note', 'type', 'echelle', 'obligatoire', true, 'titre', 'Ta journée, tu la notes comment ?',
      'libelles', jsonb_build_array('Décevante', 'Moyenne', 'Bien', 'Très bien', 'Inoubliable')),
    jsonb_build_object('id', 'concert', 'type', 'artiste', 'obligatoire', false, 'titre', 'Ton concert préféré aujourd''hui ?'),
    jsonb_build_object('id', 'plus', 'type', 'multi', 'obligatoire', true, 'titre', 'Qu''est-ce qui t''a le plus plu ?', 'max', 3,
      'choix', jsonb_build_array('La musique', 'L''ambiance', 'Le jeu DOMAF Quest', 'La nourriture', 'L''organisation', 'Les rencontres', 'Le site')),
    jsonb_build_object('id', 'attente', 'type', 'attente', 'obligatoire', false, 'titre', 'Et l''attente, c''était comment ?',
      'points', jsonb_build_array('Entrée', 'Bar', 'Food-trucks', 'Toilettes', 'Points d''eau'),
      'niveaux', jsonb_build_array('Rapide', 'Correct', 'Trop long')),
    jsonb_build_object('id', 'depense', 'type', 'choix', 'obligatoire', false, 'titre', 'Combien as-tu dépensé aujourd''hui ?',
      'aide', 'Sur le site du festival : boissons, repas, stands, objets. Sans compter ton billet.',
      'choix', jsonb_build_array('Rien du tout', 'Moins de 2 000 FCFA', '2 000 à 5 000 FCFA', '5 000 à 10 000 FCFA', 'Plus de 10 000 FCFA')),
    jsonb_build_object('id', 'ameliorer', 'type', 'multi', 'obligatoire', false, 'titre', 'Qu''est-ce qu''on doit améliorer ?', 'max', 3,
      'choix', jsonb_build_array('Plus de stands', 'Moins d''attente', 'Plus d''activités', 'Plus de place', 'La nourriture', 'Rien, c''était bien')),
    jsonb_build_object('id', 'jeu', 'type', 'nps', 'obligatoire', true, 'titre', 'Conseillerais-tu le jeu DOMAF Quest à un ami ?',
      'bornes', jsonb_build_array('Pas du tout', 'Carrément')),
    jsonb_build_object('id', 'revenir', 'type', 'choix', 'obligatoire', false, 'titre', 'Reviendras-tu au DOMAF l''an prochain ?',
      'choix', jsonb_build_array('Oui, sûr', 'Peut-être', 'Non')),
    jsonb_build_object('id', 'mot', 'type', 'texte', 'obligatoire', false, 'titre', 'Un mot pour l''équipe ?', 'max', 280,
      'aide', 'Idée, remerciement, problème rencontré… Pas d''informations personnelles, s''il te plaît.'));
$function$;

revoke all on function public.sondage_questions() from public, anon, authenticated;

-- Les concerts de la journée de jeu déjà commencés : les choix de « concert »
create or replace function public._sondage_artistes(p_player uuid, p_jour date)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nom', x.nom, 'scene', x.scene, 'vu', x.vu)
                            order by x.vu desc, x.debut), '[]'::jsonb)
  from (
    select a.id, a.nom, min(l.nom) as scene, min(cr.debut) as debut,
           bool_or(exists (select 1 from public.scans sc
                           where sc.player_id = p_player and sc.creneau_id = cr.id)) as vu
    from public.creneaux cr
    join public.artistes a on a.id = cr.artiste_id and a.actif
    join public.lieux l on l.id = cr.scene_id
    where cr.debut >= (p_jour + time '06:00') at time zone 'Africa/Douala'
      and cr.debut <  (p_jour + 1 + time '06:00') at time zone 'Africa/Douala'
      and cr.debut <= now()
    group by a.id, a.nom
  ) x;
$function$;

revoke all on function public._sondage_artistes(p_player uuid, p_jour date) from public, anon, authenticated;

create or replace function public.sondage_etat(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player public.players%rowtype;
  v_cfg    public.sondage_config%rowtype;
  v_jour   date := public.jour_jeu();
  v_ouv    timestamptz;
  v_ferm   timestamptz;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select * into v_cfg from public.sondage_config where id = 1;
  v_ouv  := (v_jour + coalesce(v_cfg.ouverture, time '22:00')) at time zone 'Africa/Douala';
  v_ferm := (v_jour + 1 + coalesce(v_cfg.fermeture, time '06:00')) at time zone 'Africa/Douala';

  return json_build_object(
    'jour',       v_jour,
    'actif',      coalesce(v_cfg.actif, true),
    'ouvert',     coalesce(v_cfg.actif, true) and now() >= v_ouv and now() < v_ferm,
    'ouverture',  v_ouv,
    'fermeture',  v_ferm,
    'deja',       exists (select 1 from public.sondage_reponses where player_id = v_player.id and jour = v_jour),
    'venu',       exists (select 1 from public.scans where player_id = v_player.id and day = v_jour),
    'xp',         coalesce(v_cfg.xp, 40),
    'jetons',     coalesce(v_cfg.jetons, 2),
    'questions',  (select jsonb_agg(case when q->>'type' = 'artiste'
                                         then q || jsonb_build_object('choix', public._sondage_artistes(v_player.id, v_jour))
                                         else q end order by n)
                   from jsonb_array_elements(public.sondage_questions()) with ordinality as t(q, n)));
end;
$function$;

revoke all on function public.sondage_etat(p_secret_code text) from public, anon, authenticated;
grant execute on function public.sondage_etat(p_secret_code text) to anon, authenticated;

create or replace function public.sondage_repondre(p_secret_code text, p_jour date, p_reponses jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player   public.players%rowtype;
  v_cfg      public.sondage_config%rowtype;
  v_jour     date := public.jour_jeu();
  v_old_lvl  integer;
  v_propres  jsonb := '{}'::jsonb;
  v_gain_xp  integer := 0;
  v_gain_jt  integer := 0;
  q          jsonb;
  v          jsonb;
  e          record;
  v_n        integer;
  v_txt      text;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code))
  for update of p;
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select * into v_cfg from public.sondage_config where id = 1;
  -- La page a été ouverte la veille : la soirée a changé
  if p_jour is distinct from v_jour then raise exception 'SONDAGE_PERIME'; end if;
  if not coalesce(v_cfg.actif, true)
     or now() <  (v_jour + coalesce(v_cfg.ouverture, time '22:00')) at time zone 'Africa/Douala'
     or now() >= (v_jour + 1 + coalesce(v_cfg.fermeture, time '06:00')) at time zone 'Africa/Douala' then
    raise exception 'SONDAGE_FERME';
  end if;
  if exists (select 1 from public.sondage_reponses where player_id = v_player.id and jour = v_jour) then
    raise exception 'DEJA_REPONDU';
  end if;
  if jsonb_typeof(p_reponses) is distinct from 'object' then raise exception 'REPONSE_INVALIDE'; end if;

  -- Aucune clé inconnue
  if exists (select 1 from jsonb_object_keys(p_reponses) k
             where k not in (select x->>'id' from jsonb_array_elements(public.sondage_questions()) x)) then
    raise exception 'REPONSE_INVALIDE';
  end if;

  -- Chaque réponse est vérifiée selon le type de sa question
  for q in select x from jsonb_array_elements(public.sondage_questions()) x loop
    v := p_reponses -> (q->>'id');
    if v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb or v = '{}'::jsonb then
      if (q->>'obligatoire')::boolean then raise exception 'SONDAGE_INCOMPLET'; end if;
      continue;
    end if;
    case q->>'type'
      when 'echelle' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not in (1, 2, 3, 4, 5) then raise exception 'REPONSE_INVALIDE'; end if;
      when 'nps' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)
           or (v #>> '{}')::numeric not between 0 and 10 then raise exception 'REPONSE_INVALIDE'; end if;
      when 'choix' then
        if jsonb_typeof(v) <> 'string' or not (q->'choix') ? (v #>> '{}') then raise exception 'REPONSE_INVALIDE'; end if;
      when 'multi' then
        if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > (q->>'max')::int
           or exists (select 1 from jsonb_array_elements(v) c where jsonb_typeof(c) <> 'string' or not (q->'choix') ? (c #>> '{}'))
           or (select count(distinct c) from jsonb_array_elements(v) c) <> jsonb_array_length(v) then
          raise exception 'REPONSE_INVALIDE';
        end if;
      when 'artiste' then
        if jsonb_typeof(v) <> 'string'
           or ((v #>> '{}') <> 'aucun'
               and not public._sondage_artistes(v_player.id, v_jour) @> jsonb_build_array(jsonb_build_object('id', v #>> '{}'))) then
          raise exception 'REPONSE_INVALIDE';
        end if;
      when 'attente' then
        if jsonb_typeof(v) <> 'object' then raise exception 'REPONSE_INVALIDE'; end if;
        for e in select * from jsonb_each(v) loop
          if not (q->'points') ? e.key
             or not (e.value = '"na"'::jsonb
                     or (jsonb_typeof(e.value) = 'number' and (e.value #>> '{}') in ('0', '1', '2'))) then
            raise exception 'REPONSE_INVALIDE';
          end if;
        end loop;
      when 'texte' then
        if jsonb_typeof(v) <> 'string' then raise exception 'REPONSE_INVALIDE'; end if;
        v_txt := trim(v #>> '{}');
        if char_length(v_txt) > (q->>'max')::int then raise exception 'TEXTE_TROP_LONG'; end if;
        if v_txt = '' then continue; end if;
        v := to_jsonb(v_txt);
    end case;
    v_propres := v_propres || jsonb_build_object(q->>'id', v);
  end loop;

  insert into public.sondage_reponses (player_id, jour, reponses) values (v_player.id, v_jour, v_propres);

  -- Récompense : seulement pour qui a scanné au moins un QR ce jour-là
  if exists (select 1 from public.scans where player_id = v_player.id and day = v_jour) then
    v_gain_xp := coalesce(v_cfg.xp, 40);
    v_gain_jt := coalesce(v_cfg.jetons, 2);
    v_old_lvl := public.level_for_xp(v_player.xp);
    update public.players set
      xp     = xp + v_gain_xp,
      jetons = jetons + v_gain_jt,
      level  = public.level_for_xp(xp + v_gain_xp),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_gain_xp))
    where id = v_player.id
    returning * into v_player;
    insert into public.events (type, player_id, payload)
    values ('sondage', v_player.id, jsonb_build_object('message', v_player.pseudo || ' a répondu au sondage du soir', 'xp', v_gain_xp));
    if v_player.level > v_old_lvl then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level, 'old_level', v_old_lvl));
    end if;
  end if;

  return json_build_object(
    'xp_gagne', v_gain_xp, 'jetons_gagnes', v_gain_jt,
    'xp', v_player.xp, 'jetons', v_player.jetons, 'level', v_player.level, 'rank', v_player.rank);
end;
$function$;

revoke all on function public.sondage_repondre(p_secret_code text, p_jour date, p_reponses jsonb) from public, anon, authenticated;
grant execute on function public.sondage_repondre(p_secret_code text, p_jour date, p_reponses jsonb) to anon, authenticated;

-- Décompte par question et par réponse, toutes soirées confondues (console,
-- via profil_stats). Les textes libres n'y sont pas : la console les lira à
-- part (étape 6), les réponses restant liées au joueur.
create or replace function public.sondage_stats()
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  select json_build_object(
    'reponses', (select count(*) from public.sondage_reponses),
    'par_jour', coalesce((select json_object_agg(jour, n) from (
                  select jour, count(*) as n from public.sondage_reponses group by jour) j), '{}'::json),
    'questions', coalesce((select json_object_agg(question, valeurs) from (
      select question, json_object_agg(valeur, n) as valeurs from (
        -- Une ligne par valeur : réponse simple, élément d'une liste, ou
        -- « point : niveau » pour l'attente
        select e.key as question, coalesce(a.value #>> '{}', p.key || ' : ' || (p.value #>> '{}'), e.value #>> '{}') as valeur, count(*) as n
        from public.sondage_reponses r
        cross join jsonb_each(r.reponses) e
        left join lateral jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value end) a on true
        left join lateral jsonb_each(case when jsonb_typeof(e.value) = 'object' then e.value end) p on true
        where e.key <> 'mot'
        group by 1, 2) v
      group by question) q), '{}'::json));
$function$;

revoke all on function public.sondage_stats() from public, anon, authenticated;

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
    'sondage',    public.sondage_stats()
  ) into v_out;

  return v_out;
end;
$function$
;

commit;
