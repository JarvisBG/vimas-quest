-- ============================================================================
-- Correctif du 19/09/2026 (étape 6.3 bis) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Collecte de données (décisions de Jarvis du 19/09, banque : QUESTIONS-DOMAF.md) :
--   · fiche fan en UN appel (fiche_enregistrer) : tranche d'âge (31-40 / 41+ au
--     lieu de 31+), sexe, quartier, genre, situation, concerts par an, téléphone
--     (19 ans et plus, consentements DOMAF / partenaires séparés, un tour de roue
--     offert une fois par numéro) ;
--   · coffre du scan : l'XP d'un scan attend la réponse à une question
--     (coffres, _coffre_remplir appelée par scan_qr, coffre_ouvrir) ; fiche
--     d'abord, questions du soir après 20 h, puis la banque (42 questions) ;
--   · player_home : fiche (ce qui manque) et coffre resté fermé ;
--   · console : recherche d'un joueur par numéro, 4 derniers chiffres sur la fiche ;
--   · retirés : sondage du soir (fondu dans le coffre), profil_etat /
--     profil_repondre, contact_etat / contact_enregistrer, micro_prochaine /
--     micro_repondre.
-- Copié de sources/92_collecte.sql, sources/99_console_joueurs.sql,
-- 00_schema.sql et 01_reference.sql. À appliquer après 2026-09-19_etape-6.3.sql.
-- S'arrête si des réponses existent déjà (sondage du soir ou micro-questions).
-- Rejouable tant que personne n'a répondu dans le coffre.
-- ============================================================================
begin;

do $$
declare v_n bigint;
begin
  v_n := 0;
  if to_regclass('public.sondage_reponses') is not null then
    execute 'select count(*) from public.sondage_reponses' into v_n;   -- table peut-être déjà retirée
  end if;
  if v_n > 0 then
    raise exception 'Des réponses au sondage du soir existent : les exporter avant de retirer la table.';
  end if;
  if exists (select 1 from public.micro_votes) then
    raise exception 'Des réponses aux micro-questions existent : les exporter avant de remplacer la banque.';
  end if;
end $$;

-- Retirés
drop function if exists public.sondage_etat(p_secret_code text);
drop function if exists public.sondage_repondre(p_secret_code text, p_jour date, p_reponses jsonb);
drop function if exists public.sondage_stats();
drop function if exists public.sondage_questions();
drop function if exists public._sondage_artistes(p_player uuid, p_jour date);
drop table if exists public.sondage_reponses;
drop table if exists public.sondage_config;
drop function if exists public.profil_etat(p_secret_code text);
drop function if exists public.profil_repondre(p_secret_code text, p_champ text, p_valeur text);
drop function if exists public.contact_etat(p_secret_code text);
drop function if exists public.contact_enregistrer(p_secret_code text, p_telephone text, p_consent boolean);
drop function if exists public.micro_prochaine(p_secret_code text);
drop function if exists public.micro_repondre(p_secret_code text, p_question_id integer, p_valeur text);

-- Ancienne tranche « 31+ » (données d'essai seulement) : à redemander
update public.player_profile set tranche_age = null where tranche_age = '31+';

-- ---------------------------------------------------------------------------
-- sources/92_collecte.sql
-- ---------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- Collecte de données (étape 6.3 bis) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Décisions de Jarvis du 19/09/2026 (banque : QUESTIONS-DOMAF.md) :
--   · fiche fan à l'inscription, FACULTATIVE mais récompensée : tranche d'âge,
--     sexe, quartier, genre, situation, concerts par an, puis téléphone ;
--   · téléphone : facultatif, à 19 ans et plus seulement, deux consentements
--     séparés (DOMAF / partenaires), jamais pré-cochés ; il sert d'abord à
--     retrouver la carte au stand et à joindre les gagnants du tirage final ;
--   · au scan, LA QUESTION VERROUILLE LA RÉCOMPENSE : l'XP d'un scan part dans
--     un coffre, versée quand le joueur répond. Sans plafond. Les champs de la
--     fiche encore vides passent en premier, puis (après 20 h) les questions du
--     soir, puis la banque ;
--   · le sondage du soir (4.11) est fondu dans la banque : page et tables retirées.
--
-- Un joueur a AU PLUS un coffre fermé (clé = player_id) : s'il scanne encore
-- sans avoir répondu, l'XP s'ajoute au même coffre, la question ne change pas.
-- Le scan lui-même est enregistré tout de suite (missions, badges, collection) :
-- seuls l'XP et les jetons attendent.
--
--   _collecte_prochaine(joueur, jour, soir)  la question suivante (ou null)
--   _coffre_remplir(joueur, xp, jetons)      appelée par scan_qr
--   coffre_ouvrir(code, cle, valeur, duree)  réponse → XP du coffre + de la réponse
--   fiche_enregistrer(code, fiche, tel, …)   toute la fiche en UN appel
--   profil_stats()                           décompte pour la console (6.8)
-- ----------------------------------------------------------------------------

-- Fiche : deux champs de plus
alter table public.player_profile add column if not exists situation text;
alter table public.player_profile add column if not exists concerts_an text;

-- Téléphone : « consent » = le DOMAF peut me contacter ; partenaires à part
alter table public.player_contact alter column consent set default false;
alter table public.player_contact add column if not exists partenaires boolean not null default false;
alter table public.player_contact add column if not exists updated_at timestamptz not null default now();

-- Réglages : plus de cadence ni de plafond (décision « sans plafond »)
alter table public.micro_config drop column if exists scans_avant_premier;
alter table public.micro_config drop column if exists scans_entre_deux;
alter table public.micro_config drop column if exists max_par_jour;
alter table public.micro_config drop column if exists xp_bonus_complet;
alter table public.micro_config add column if not exists soir_debut time not null default '20:00';

-- Banque : thème, moment (toujours / soir), reposée chaque jour ou non,
-- ordre des réponses fixe (échelles) ou mélangé, choix = liste ou artistes du jour
alter table public.micro_questions add column if not exists code text;
alter table public.micro_questions add column if not exists theme text;
alter table public.micro_questions add column if not exists moment text not null default 'toujours';
alter table public.micro_questions add column if not exists chaque_jour boolean not null default false;
alter table public.micro_questions add column if not exists ordre_fixe boolean not null default false;
alter table public.micro_questions add column if not exists type text not null default 'choix';
alter table public.micro_questions drop constraint if exists micro_questions_moment;
alter table public.micro_questions add constraint micro_questions_moment check (moment in ('toujours', 'soir'));
alter table public.micro_questions drop constraint if exists micro_questions_type;
alter table public.micro_questions add constraint micro_questions_type check (type in ('choix', 'artiste'));
alter table public.micro_questions drop constraint if exists micro_questions_code_key;
alter table public.micro_questions add constraint micro_questions_code_key unique (code);

-- Réponses : une par jour pour les questions du soir ; temps de réponse
-- (moins d'une seconde = marquée « rapide » dans les statistiques)
alter table public.micro_votes add column if not exists duree_ms integer;
alter table public.micro_votes drop constraint if exists micro_votes_pkey;
alter table public.micro_votes add constraint micro_votes_pkey primary key (player_id, question_id, jour);

create table if not exists public.coffres (
  player_id  uuid primary key references public.players(id) on delete cascade,
  xp         integer not null default 0 constraint coffres_xp check (xp >= 0),
  jetons     integer not null default 0 constraint coffres_jetons check (jetons >= 0),
  scans      integer not null default 1,        -- scans dont l'XP attend ici
  question   jsonb not null,                    -- la question posée, figée à la création
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now()
);
alter table public.coffres enable row level security;
-- Aucune politique : lu et écrit seulement par les fonctions ci-dessous.

-- ----------------------------------------------------------------------------
-- Les réponses de la fiche. Ajouter une valeur est gratuit ; en RETIRER une
-- casse l'affichage des réponses déjà données.
-- ----------------------------------------------------------------------------
create or replace function public.profil_options()
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  select json_build_object(
    'tranche_age', json_build_array(
      json_build_object('valeur','13-15','libelle','13 - 15 ans'),
      json_build_object('valeur','16-18','libelle','16 - 18 ans'),
      json_build_object('valeur','19-24','libelle','19 - 24 ans'),
      json_build_object('valeur','25-30','libelle','25 - 30 ans'),
      json_build_object('valeur','31-40','libelle','31 - 40 ans'),
      json_build_object('valeur','41+','libelle','41 ans et plus')
    ),
    'sexe', json_build_array(
      json_build_object('valeur','garcon','libelle','Un homme'),
      json_build_object('valeur','fille','libelle','Une femme')
    ),
    -- Les axes les plus peuplés d'abord, le centre ensuite, les sorties en dernier
    'quartier', json_build_array(
      json_build_object('valeur','ndokotti','libelle','Ndokotti'),
      json_build_object('valeur','bassa','libelle','Bassa'),
      json_build_object('valeur','logbaba','libelle','Logbaba'),
      json_build_object('valeur','village-ndogpassi','libelle','Village / Ndogpassi'),
      json_build_object('valeur','pk-8-14','libelle','PK 8 à PK 14'),
      json_build_object('valeur','pk-15-plus','libelle','PK 15 et au-delà'),
      json_build_object('valeur','nyalla','libelle','Nyalla'),
      json_build_object('valeur','yassa-japoma','libelle','Yassa / Japoma'),
      json_build_object('valeur','bepanda','libelle','Bépanda'),
      json_build_object('valeur','makepe','libelle','Makepè'),
      json_build_object('valeur','bonamoussadi','libelle','Bonamoussadi'),
      json_build_object('valeur','kotto-palmiers','libelle','Kotto / Cité des Palmiers'),
      json_build_object('valeur','akwa','libelle','Akwa'),
      json_build_object('valeur','deido','libelle','Deïdo'),
      json_build_object('valeur','new-bell','libelle','New Bell'),
      json_build_object('valeur','bali','libelle','Bali'),
      json_build_object('valeur','bonanjo','libelle','Bonanjo'),
      json_build_object('valeur','bonapriso','libelle','Bonapriso'),
      json_build_object('valeur','bonaberi','libelle','Bonabéri'),
      json_build_object('valeur','bonendale-sodiko','libelle','Bonendale / Sodiko'),
      json_build_object('valeur','autre-douala','libelle','Un autre quartier de Douala'),
      json_build_object('valeur','autre-ville','libelle','Une autre ville')
    ),
    'genre_prefere', json_build_array(
      json_build_object('valeur','afrobeats','libelle','Afrobeats / Afro-pop'),
      json_build_object('valeur','makossa','libelle','Makossa'),
      json_build_object('valeur','bikutsi','libelle','Bikutsi'),
      json_build_object('valeur','coupe-decale','libelle','Coupé-décalé'),
      json_build_object('valeur','rap','libelle','Rap / Hip-hop'),
      json_build_object('valeur','rnb-soul','libelle','R&B / Soul'),
      json_build_object('valeur','gospel','libelle','Gospel'),
      json_build_object('valeur','reggae','libelle','Reggae / Dancehall'),
      json_build_object('valeur','rumba','libelle','Rumba / Ndombolo'),
      json_build_object('valeur','jazz','libelle','Jazz'),
      json_build_object('valeur','electro','libelle','Électro'),
      json_build_object('valeur','zouk','libelle','Zouk / Kompa'),
      json_build_object('valeur','autre','libelle','Un autre')
    ),
    'situation', json_build_array(
      json_build_object('valeur','eleve','libelle','Élève'),
      json_build_object('valeur','etudiant','libelle','Étudiant'),
      json_build_object('valeur','salarie','libelle','Salarié'),
      json_build_object('valeur','independant','libelle','À mon compte / commerçant'),
      json_build_object('valeur','recherche','libelle','En recherche d''emploi'),
      json_build_object('valeur','autre','libelle','Autre')
    ),
    'concerts_an', json_build_array(
      json_build_object('valeur','aucun','libelle','Aucun, c''est mon premier'),
      json_build_object('valeur','1-2','libelle','1 ou 2'),
      json_build_object('valeur','3-5','libelle','3 à 5'),
      json_build_object('valeur','plus-5','libelle','Plus de 5')
    )
  );
$function$;

revoke all on function public.profil_options() from public, anon, authenticated;
grant execute on function public.profil_options() to anon, authenticated;

-- Les champs de la fiche, dans l'ordre où ils sont demandés
create or replace function public._fiche_champs()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array['tranche_age', 'sexe', 'quartier', 'genre_prefere', 'situation', 'concerts_an'];
$function$;

revoke all on function public._fiche_champs() from public, anon, authenticated;

-- Tranches d'âge à qui l'on peut demander un numéro (jamais aux mineurs :
-- 16-18 mélange mineurs et majeurs, elle est donc exclue)
create or replace function public._fiche_majeur(p_tranche text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select coalesce(p_tranche, '') in ('19-24', '25-30', '31-40', '41+');
$function$;

revoke all on function public._fiche_majeur(p_tranche text) from public, anon, authenticated;

create or replace function public._fiche_texte(p_champ text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case p_champ
    when 'tranche_age'   then 'Tu as quel âge ?'
    when 'sexe'          then 'Tu es…'
    when 'quartier'      then 'Tu habites où ?'
    when 'genre_prefere' then 'Ta musique, c''est surtout…'
    when 'situation'     then 'Dans la vie, tu es…'
    when 'concerts_an'   then 'Tu vas à combien de concerts par an ?'
  end;
$function$;

revoke all on function public._fiche_texte(p_champ text) from public, anon, authenticated;

-- Les concerts de la journée de jeu déjà commencés (ceux que le joueur a vus
-- en premier) : les choix de la question « ton concert préféré aujourd'hui »
create or replace function public._artistes_du_jour(p_player uuid, p_jour date)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('valeur', x.id::text, 'libelle', x.nom)
                            order by x.vu desc, x.debut), '[]'::jsonb)
  from (
    select a.id, a.nom, min(cr.debut) as debut,
           bool_or(exists (select 1 from public.scans sc
                           where sc.player_id = p_player and sc.creneau_id = cr.id)) as vu
    from public.creneaux cr
    join public.artistes a on a.id = cr.artiste_id and a.actif
    where cr.debut >= (p_jour + time '06:00') at time zone 'Africa/Douala'
      and cr.debut <  (p_jour + 1 + time '06:00') at time zone 'Africa/Douala'
      and cr.debut <= now()
    group by a.id, a.nom
  ) x;
$function$;

revoke all on function public._artistes_du_jour(p_player uuid, p_jour date) from public, anon, authenticated;

-- Est-ce le soir ? (de soir_debut à 6 h, heure de Douala)
create or replace function public._collecte_soir()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select (now() at time zone 'Africa/Douala')::time
           >= coalesce((select soir_debut from public.micro_config where id = 1), time '20:00')
      or (now() at time zone 'Africa/Douala')::time < time '06:00';
$function$;

revoke all on function public._collecte_soir() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- La question suivante : fiche d'abord, puis le soir, puis la banque.
-- Rend {cle, texte, options, ordre_fixe} ou null (tout est répondu).
-- ----------------------------------------------------------------------------
create or replace function public._collecte_prochaine(p_player uuid, p_jour date, p_soir boolean)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  v_prof  public.player_profile%rowtype;
  v_champ text;
  v_q     public.micro_questions%rowtype;
  v_opts  jsonb;
begin
  select * into v_prof from public.player_profile where player_id = p_player;
  v_champ := case
    when v_prof.tranche_age   is null then 'tranche_age'
    when v_prof.sexe          is null then 'sexe'
    when v_prof.quartier      is null then 'quartier'
    when v_prof.genre_prefere is null then 'genre_prefere'
    when v_prof.situation     is null then 'situation'
    when v_prof.concerts_an   is null then 'concerts_an'
  end;
  if v_champ is not null then
    return jsonb_build_object('cle', 'profil:' || v_champ, 'texte', public._fiche_texte(v_champ),
      'options', public.profil_options()::jsonb -> v_champ,
      -- les tranches et les quartiers sont déjà rangés ; sexe et genre, non
      'ordre_fixe', v_champ in ('tranche_age', 'quartier', 'concerts_an'));
  end if;

  for v_q in
    select q.* from public.micro_questions q
    where q.active
      and (q.moment = 'toujours' or p_soir)
      and not exists (select 1 from public.micro_votes v
                      where v.player_id = p_player and v.question_id = q.id
                        and (not q.chaque_jour or v.jour = p_jour))
    order by (q.moment = 'soir') desc, q.ordre
  loop
    if v_q.type = 'artiste' then
      v_opts := public._artistes_du_jour(p_player, p_jour);
      continue when jsonb_array_length(v_opts) < 2;   -- pas de choix : question suivante
    else
      v_opts := v_q.options;
    end if;
    return jsonb_build_object('cle', 'micro:' || v_q.id, 'texte', v_q.question,
      'options', v_opts, 'ordre_fixe', v_q.ordre_fixe or v_q.type = 'artiste');
  end loop;

  return null;
end;
$function$;

revoke all on function public._collecte_prochaine(p_player uuid, p_jour date, p_soir boolean) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Appelée par scan_qr : met l'XP du scan dans le coffre du joueur.
-- Rend le coffre (à montrer fermé) ou null : pas de question, XP versée
-- tout de suite par scan_qr.
-- ----------------------------------------------------------------------------
create or replace function public._coffre_remplir(p_player uuid, p_xp integer, p_jetons integer)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_q jsonb;
  v_c public.coffres%rowtype;
begin
  if not coalesce((select actif from public.micro_config where id = 1), true) then
    return null;
  end if;

  if not exists (select 1 from public.coffres where player_id = p_player) then
    v_q := public._collecte_prochaine(p_player, public.jour_jeu(), public._collecte_soir());
    if v_q is null then return null; end if;
  end if;

  -- Deux scans simultanés du même joueur : le second s'ajoute au premier coffre
  insert into public.coffres (player_id, xp, jetons, question)
  values (p_player, greatest(p_xp, 0), greatest(p_jetons, 0), coalesce(v_q, '{}'::jsonb))
  on conflict (player_id) do update
    set xp = coffres.xp + excluded.xp, jetons = coffres.jetons + excluded.jetons,
        scans = coffres.scans + 1, maj_le = now()
  returning * into v_c;

  return public._coffre_json(v_c);
end;
$function$;

revoke all on function public._coffre_remplir(p_player uuid, p_xp integer, p_jetons integer) from public, anon, authenticated;

create or replace function public._coffre_json(p_c public.coffres)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select case when p_c.player_id is null then null else jsonb_build_object(
    'xp', p_c.xp, 'jetons', p_c.jetons, 'scans', p_c.scans,
    'question', p_c.question,
    'xp_reponse', case when p_c.question ->> 'cle' like 'profil:%'
                       then coalesce((select xp_par_reponse from public.profil_config where id = 1), 20)
                       else coalesce((select xp_par_reponse from public.micro_config where id = 1), 10) end)
  end;
$function$;

revoke all on function public._coffre_json(p_c public.coffres) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Le joueur répond : la réponse est gardée, le coffre s'ouvre.
-- Rejouable : un second envoi (réseau coupé) trouve le coffre déjà ouvert et
-- ne verse rien de plus.
-- ----------------------------------------------------------------------------
create or replace function public.coffre_ouvrir(p_secret_code text, p_cle text, p_valeur text, p_duree_ms integer default null)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player  public.players%rowtype;
  v_c       public.coffres%rowtype;
  v_val     text := lower(trim(coalesce(p_valeur, '')));
  v_champ   text;
  v_qid     integer;
  v_rep     integer := 0;
  v_bonus   integer := 0;
  v_xp      integer;
  v_jetons  integer;
  v_old     integer;
  v_prof    public.player_profile%rowtype;
  v_lignes  integer;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  -- Même ordre de verrous que scan_qr : le coffre, puis le joueur
  select * into v_c from public.coffres where player_id = v_player.id for update;
  if v_c.player_id is null then
    return json_build_object('ouvert', false, 'deja', true, 'player', row_to_json(v_player));
  end if;
  -- Le téléphone montrait une autre question (coffre rempli entre-temps sur
  -- un autre appareil) : on lui renvoie la bonne, sans rien enregistrer.
  if v_c.question ->> 'cle' is distinct from p_cle then
    return json_build_object('ouvert', false, 'perimee', true, 'coffre', public._coffre_json(v_c));
  end if;

  if v_val = '' then raise exception 'VALEUR_VIDE'; end if;
  if not exists (select 1 from jsonb_array_elements(v_c.question -> 'options') o
                 where o ->> 'valeur' = v_val) then
    raise exception 'VALEUR_INVALIDE';
  end if;

  if p_cle like 'profil:%' then
    v_champ := substr(p_cle, 8);
    if not (v_champ = any (public._fiche_champs())) then raise exception 'QUESTION_INCONNUE'; end if;
    insert into public.player_profile (player_id) values (v_player.id) on conflict (player_id) do nothing;
    -- Seulement si le champ est encore vide (rempli entre-temps par la fiche : rien de plus)
    execute format('update public.player_profile set %I = $1, updated_at = now()
                    where player_id = $2 and %I is null', v_champ, v_champ)
      using v_val, v_player.id;
    get diagnostics v_lignes = row_count;          -- EXECUTE ne touche pas à FOUND
    if v_lignes > 0 then
      v_rep := coalesce((select xp_par_reponse from public.profil_config where id = 1), 20);
      select * into v_prof from public.player_profile where player_id = v_player.id;
      if not v_prof.bonus_verse
         and v_prof.tranche_age is not null and v_prof.sexe is not null and v_prof.quartier is not null
         and v_prof.genre_prefere is not null and v_prof.situation is not null and v_prof.concerts_an is not null then
        v_bonus := coalesce((select xp_bonus_complet from public.profil_config where id = 1), 50);
        update public.player_profile set bonus_verse = true where player_id = v_player.id;
      end if;
    end if;
  elsif p_cle like 'micro:%' then
    v_qid := substr(p_cle, 7)::integer;
    insert into public.micro_votes (player_id, question_id, valeur, duree_ms)
    values (v_player.id, v_qid, v_val,
            case when p_duree_ms is null then null else least(greatest(p_duree_ms, 0), 3600000) end)
    on conflict (player_id, question_id, jour) do nothing;
    if found then
      v_rep := coalesce((select xp_par_reponse from public.micro_config where id = 1), 10);
    end if;
  else
    raise exception 'QUESTION_INCONNUE';
  end if;

  delete from public.coffres where player_id = v_player.id;

  v_xp     := v_c.xp + v_rep + v_bonus;
  v_jetons := v_c.jetons + (v_rep + v_bonus) / 10;
  v_old    := v_player.level;
  update public.players
  set xp     = xp + v_xp,
      jetons = jetons + v_jetons,
      level  = public.level_for_xp(xp + v_xp),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_xp))
  where id = v_player.id
  returning * into v_player;

  if v_player.level > v_old then
    insert into public.events (type, player_id, payload)
    values ('level_up', v_player.id, jsonb_build_object(
      'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level', v_player.level, 'old_level', v_old));
  end if;

  -- Le journal ne contient jamais la réponse
  return json_build_object(
    'ouvert', true,
    'xp_coffre', v_c.xp, 'jetons_coffre', v_c.jetons,
    'xp_reponse', v_rep, 'bonus_fiche', v_bonus,
    'xp_gagne', v_xp, 'jetons_gagnes', v_jetons,
    'niveau_precedent', v_old, 'nouveau_niveau', v_player.level,
    'player', row_to_json(v_player));
end;
$function$;

revoke all on function public.coffre_ouvrir(p_secret_code text, p_cle text, p_valeur text, p_duree_ms integer) from public, anon, authenticated;
grant execute on function public.coffre_ouvrir(p_secret_code text, p_cle text, p_valeur text, p_duree_ms integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- La fiche de l'inscription, en UN appel (réseau du festival). Les champs
-- absents sont « passés » ; un champ déjà rempli n'est pas réécrit.
-- Téléphone : 19 ans et plus, numéro camerounais (6 suivi de 8 chiffres).
-- Bonus du numéro (une fois par joueur ET par numéro) : un tour de roue en
-- jetons (contact_config.jetons_bonus, sinon le prix d'un tour).
-- ----------------------------------------------------------------------------
create or replace function public.fiche_enregistrer(p_secret_code text, p_fiche jsonb,
  p_telephone text default null, p_domaf boolean default false, p_partenaires boolean default false)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player  public.players%rowtype;
  v_prof    public.player_profile%rowtype;
  v_champ   text;
  v_val     text;
  v_n       integer := 0;
  v_xp      integer := 0;
  v_jetons  integer := 0;
  v_bonus   integer := 0;
  v_tel     text;
  v_deja    boolean;
  v_connu   boolean;
  v_tour    integer := 0;
  v_old     integer;
  v_faits   integer;
  v_lignes  integer;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;
  if p_fiche is not null and jsonb_typeof(p_fiche) <> 'object' then raise exception 'FICHE_INVALIDE'; end if;

  insert into public.player_profile (player_id) values (v_player.id) on conflict (player_id) do nothing;
  select * into v_prof from public.player_profile where player_id = v_player.id for update;

  -- Toutes les valeurs sont vérifiées AVANT d'écrire quoi que ce soit
  for v_champ in select jsonb_object_keys(coalesce(p_fiche, '{}'::jsonb)) loop
    if not (v_champ = any (public._fiche_champs())) then raise exception 'CHAMP_INCONNU'; end if;
    v_val := lower(trim(coalesce(p_fiche ->> v_champ, '')));
    if v_val <> '' and not (v_val = any (public.profil_valeurs(v_champ))) then
      raise exception 'VALEUR_INVALIDE';
    end if;
  end loop;

  foreach v_champ in array public._fiche_champs() loop
    v_val := nullif(lower(trim(coalesce(p_fiche ->> v_champ, ''))), '');
    continue when v_val is null;
    execute format('update public.player_profile set %I = $1, updated_at = now()
                    where player_id = $2 and %I is null', v_champ, v_champ)
      using v_val, v_player.id;
    get diagnostics v_lignes = row_count;          -- EXECUTE ne touche pas à FOUND
    v_n := v_n + v_lignes;
  end loop;

  select * into v_prof from public.player_profile where player_id = v_player.id;
  v_faits := (v_prof.tranche_age is not null)::int + (v_prof.sexe is not null)::int
           + (v_prof.quartier is not null)::int + (v_prof.genre_prefere is not null)::int
           + (v_prof.situation is not null)::int + (v_prof.concerts_an is not null)::int;
  v_xp := v_n * coalesce((select xp_par_reponse from public.profil_config where id = 1), 20);
  if v_faits = 6 and not v_prof.bonus_verse then
    v_bonus := coalesce((select xp_bonus_complet from public.profil_config where id = 1), 50);
    update public.player_profile set bonus_verse = true where player_id = v_player.id;
  end if;

  -- Téléphone
  if nullif(trim(coalesce(p_telephone, '')), '') is not null then
    if not coalesce((select actif from public.contact_config where id = 1), true) then
      raise exception 'CONTACT_DESACTIVE';
    end if;
    -- Contrôlé ICI, pas seulement à l'affichage
    if not public._fiche_majeur(v_prof.tranche_age) then raise exception 'RESERVE_MAJEURS'; end if;
    -- « +237 6 99 12 34 56 » → « 699123456 »
    v_tel := regexp_replace(p_telephone, '[^0-9]', '', 'g');
    if left(v_tel, 3) = '237' and length(v_tel) = 12 then v_tel := substr(v_tel, 4); end if;
    if v_tel !~ '^6[0-9]{8}$' then raise exception 'NUMERO_INVALIDE'; end if;

    select exists (select 1 from public.player_contact where player_id = v_player.id) into v_deja;
    -- Un numéro = un seul bonus (sinon on se fabrique des tours avec le même téléphone)
    select exists (select 1 from public.player_contact where telephone = v_tel and player_id <> v_player.id) into v_connu;

    insert into public.player_contact (player_id, telephone, consent, partenaires)
    values (v_player.id, v_tel, coalesce(p_domaf, false), coalesce(p_partenaires, false))
    on conflict (player_id) do update
      set telephone = excluded.telephone, consent = excluded.consent,
          partenaires = excluded.partenaires, updated_at = now();

    if not v_deja and not v_connu then
      v_tour := coalesce(nullif((select jetons_bonus from public.contact_config where id = 1), 0),
                         (select roulette_cost from public.game_state where id = 1), 30);
    end if;
  end if;

  -- Le coffre fermé posait peut-être une question qui vient d'être remplie :
  -- on lui en donne une neuve (rien n'est perdu, son XP reste dedans).
  -- Avant la mise à jour du joueur : même ordre de verrous que scan_qr.
  update public.coffres c
  set question = coalesce(public._collecte_prochaine(v_player.id, public.jour_jeu(), public._collecte_soir()),
                          c.question)
  where c.player_id = v_player.id
    and c.question ->> 'cle' like 'profil:%'
    and v_n > 0;

  v_jetons := (v_xp + v_bonus) / 10 + v_tour;
  v_old := v_player.level;
  if v_xp + v_bonus + v_jetons > 0 then
    update public.players
    set xp     = xp + v_xp + v_bonus,
        jetons = jetons + v_jetons,
        level  = public.level_for_xp(xp + v_xp + v_bonus),
        rank   = public.rank_for_level(public.level_for_xp(xp + v_xp + v_bonus))
    where id = v_player.id
    returning * into v_player;
    if v_player.level > v_old then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level, 'old_level', v_old));
    end if;
  end if;

  -- Le journal ne contient jamais le numéro
  return json_build_object(
    'player', row_to_json(v_player),
    'xp_gagne', v_xp + v_bonus, 'bonus_fiche', v_bonus, 'jetons_gagnes', v_jetons,
    'tour_offert', v_tour > 0,
    'faits', v_faits, 'total', 6,
    'telephone', exists (select 1 from public.player_contact where player_id = v_player.id));
end;
$function$;

revoke all on function public.fiche_enregistrer(p_secret_code text, p_fiche jsonb, p_telephone text, p_domaf boolean, p_partenaires boolean) from public, anon, authenticated;
grant execute on function public.fiche_enregistrer(p_secret_code text, p_fiche jsonb, p_telephone text, p_domaf boolean, p_partenaires boolean) to anon, authenticated;

-- Ce que la carte (player_home) dit de la fiche : rappel du tableau de bord
create or replace function public._fiche_etat(p_player uuid)
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  select json_build_object(
    'faits', coalesce((p.tranche_age is not null)::int + (p.sexe is not null)::int
                    + (p.quartier is not null)::int + (p.genre_prefere is not null)::int
                    + (p.situation is not null)::int + (p.concerts_an is not null)::int, 0),
    'total', 6,
    'manquants', coalesce((select json_agg(c) from unnest(public._fiche_champs()) c
                           where (to_jsonb(p) ->> c) is null), '[]'::json),
    'majeur', public._fiche_majeur(p.tranche_age),
    'telephone', exists (select 1 from public.player_contact k where k.player_id = p_player),
    'xp_par_reponse', coalesce((select xp_par_reponse from public.profil_config where id = 1), 20),
    'xp_bonus_complet', coalesce((select xp_bonus_complet from public.profil_config where id = 1), 50))
  from (select 1) un
  left join public.player_profile p on p.player_id = p_player;
$function$;

revoke all on function public._fiche_etat(p_player uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Statistiques (console, étape 6.8) : fiche, téléphone, banque.
-- Réponses données en moins d'une seconde comptées à part (« rapides »).
-- ----------------------------------------------------------------------------
create or replace function public.profil_stats()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_out json;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  with fiche as (
    select f.champ, f.valeur, count(*) as n
    from public.player_profile p
    join public.players j on j.id = p.player_id and j.efface_le is null
    cross join lateral (values ('tranche_age', p.tranche_age), ('sexe', p.sexe), ('quartier', p.quartier),
                               ('genre_prefere', p.genre_prefere), ('situation', p.situation),
                               ('concerts_an', p.concerts_an)) f(champ, valeur)
    where f.valeur is not null
    group by f.champ, f.valeur
  )
  select json_build_object(
    'joueurs',  (select count(*) from public.players where efface_le is null),
    'fiches_completes', (select count(*) from public.player_profile p
                         where p.tranche_age is not null and p.sexe is not null and p.quartier is not null
                           and p.genre_prefere is not null and p.situation is not null and p.concerts_an is not null),
    'contacts', json_build_object(
      'total',       (select count(*) from public.player_contact),
      'domaf',       (select count(*) from public.player_contact where consent),
      'partenaires', (select count(*) from public.player_contact where partenaires)),
    'fiche',    (select coalesce(json_object_agg(champ, valeurs), '{}'::json) from (
                   select champ, json_agg(json_build_object('valeur', valeur, 'n', n) order by n desc) as valeurs
                   from fiche group by champ) t),
    'questions', (select coalesce(json_agg(t order by t.moment, t.ordre), '[]'::json) from (
                   select q.code, q.theme, q.moment, q.ordre, q.question,
                          count(v.player_id) as reponses,
                          count(v.player_id) filter (where v.duree_ms < 1000) as rapides,
                          (select coalesce(json_agg(json_build_object('valeur', r.valeur, 'n', r.n) order by r.n desc), '[]'::json)
                           from (select valeur, count(*) as n from public.micro_votes
                                 where question_id = q.id group by valeur) r) as valeurs
                   from public.micro_questions q
                   left join public.micro_votes v on v.question_id = q.id
                   group by q.id) t),
    'coeurs',   public.coeur_palmares(null, 20)
  ) into v_out;

  return v_out;
end;
$function$;

revoke all on function public.profil_stats() from public, anon, authenticated;
grant execute on function public.profil_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- scan_qr (coffre) et player_home (fiche, coffre) : 00_schema.sql
-- ---------------------------------------------------------------------------
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
  v_heure    int;
  v_scan_id  uuid;
  v_coffre   jsonb;
  v_credit   int;
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

  insert into public.scans (player_id, qr_code_id, creneau_id) values (v_player.id, v_qr.id, v_creneau)
  returning id into v_scan_id;
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

  -- Étape 6.3 : heure de Douala. Lève-tôt = un scan avant 17 h (la journée
  -- de jeu commence à 6 h) ; Noctambule = une scène scannée pendant un
  -- concert, entre minuit et 6 h.
  v_heure := extract(hour from now() at time zone 'Africa/Douala')::int;
  if v_heure between 6 and 16 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Lève-tôt'));
  end if;
  if v_creneau is not null and v_heure < 6 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Noctambule'));
  end if;
  -- Marathonien : un scan chacune des 4 journées. Compté seulement au
  -- premier scan de la journée (les autres ne peuvent rien changer).
  if not v_rejeu and not exists (
    select 1 from public.scans
    where player_id = v_player.id and day = public.jour_jeu() and id <> v_scan_id) then
    select count(distinct day) into v_count from public.scans where player_id = v_player.id;
    if v_count >= 4 then
      v_new_badges := array_append(v_new_badges,
        public._award_badge(v_player.id, v_player.pseudo, 'Marathonien'));
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

  v_coffre := public._coffre_remplir(v_player.id, v_total_xp, v_total_xp / 10);
  v_credit := case when v_coffre is null then v_total_xp else 0 end;

  v_old_level := public.level_for_xp(v_player.xp);
  update public.players
  set xp     = xp + v_credit,
      jetons = jetons + (v_credit / 10),
      level  = public.level_for_xp(xp + v_credit),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_credit))
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
    'coffre', v_coffre,
    'niveau_precedent', v_old_level, 'nouveau_niveau', v_player.level,
    'player', row_to_json(v_player));
end;
$function$
;

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

    'fiche', public._fiche_etat(v_player.id),
    'coffre', (select public._coffre_json(c) from public.coffres c where c.player_id = v_player.id),
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

-- ---------------------------------------------------------------------------
-- Console : recherche par numéro (sources/99_console_joueurs.sql)
-- ---------------------------------------------------------------------------
create or replace function public.console_joueurs(p_recherche text default null, p_filtre text default null,
                                                  p_rang text default null, p_page integer default 0)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour   date := public.jour_jeu();           -- UNE fois (voir _classement)
  v_debut  timestamptz := public._debut_jour_jeu();
  v_mur    boolean := coalesce((select actif from public.billetterie_config where id = 1), false);
  v_filtre text := coalesce(nullif(p_filtre, ''), 'tous');
  v_rang   text := nullif(p_rang, '');
  v_q      text := left(nullif(trim(coalesce(p_recherche, '')), ''), 40);
  v_motif  text;
  v_tel    text;                                -- recherche par numéro (6.3 bis)
  v_page   int := least(greatest(coalesce(p_page, 0), 0), 1000);
  v_par    constant int := 50;
  v_total  int;
  v_lignes json;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_filtre not in ('tous', 'actifs', 'exclus', 'ticket', 'sans_ticket', 'joue', 'pas_joue') then
    raise exception 'FILTRE_INVALIDE';
  end if;
  -- « 50% » cherche 50 %, pas « 50 suivi de n'importe quoi »
  v_motif := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  -- « 6 99 12 34 56 » ou « +237 699… » : le joueur qui a perdu son code
  v_tel := regexp_replace(coalesce(v_q, ''), '[^0-9]', '', 'g');
  if left(v_tel, 3) = '237' and length(v_tel) = 12 then v_tel := substr(v_tel, 4); end if;
  if v_tel !~ '^6[0-9]{8}$' then v_tel := null; end if;

  with choisis as (
    select p.id, p.xp, p.created_at
    from public.players p
    where p.efface_le is null
      and (v_q is null or p.pseudo ilike v_motif or p.id::text = lower(v_q)
           or p.id in (select k.player_id from public.player_contact k where k.telephone = v_tel))
      and (v_rang is null or p.rank = v_rang)
      and case v_filtre
            when 'actifs'   then p.status = 'actif'
            when 'exclus'   then p.status = 'exclu'
            when 'joue'     then p.jour = v_jour and p.xp_jour > 0
            when 'pas_joue' then not (p.jour = v_jour and p.xp_jour > 0)
            when 'ticket'   then not v_mur or exists (select 1 from public.tickets k
                                                       where k.utilise_par = p.id and k.jour = v_jour)
            when 'sans_ticket' then v_mur and not exists (select 1 from public.tickets k
                                                           where k.utilise_par = p.id and k.jour = v_jour)
            else true end
  ),
  page as (
    select c.id, count(*) over () as total
    from choisis c
    order by c.xp desc, c.created_at
    limit v_par offset v_page * v_par
  )
  select max(pg.total),
         json_agg(json_build_object(
           'id', p.id, 'pseudo', p.pseudo, 'avatar', p.archetype, 'xp', p.xp, 'jetons', p.jetons,
           'niveau', p.level, 'rang', p.rank, 'statut', p.status, 'inscrit', p.created_at,
           'xp_jour', case when p.jour = v_jour then p.xp_jour else 0 end,
           'ticket_jour', not v_mur or exists (select 1 from public.tickets k
                                                where k.utilise_par = p.id and k.jour = v_jour),
           'actions_jour', (select count(*) from public.events e
                             where e.player_id = p.id and e.created_at >= v_debut),
           -- journée de jeu écrite en clair (jour_de ligne par ligne = lent)
           'jours_joues', (select count(distinct ((e.created_at at time zone 'Africa/Douala') - interval '6 hours')::date)
                            from public.events e where e.player_id = p.id))
           order by p.xp desc, p.created_at)
    into v_total, v_lignes
  from page pg join public.players p on p.id = pg.id;

  -- Page au-delà de la fin : le total reste utile à l'écran
  if v_total is null then
    select count(*) into v_total from (
      select 1 from public.players p
      where p.efface_le is null
        and (v_q is null or p.pseudo ilike v_motif or p.id::text = lower(v_q)
           or p.id in (select k.player_id from public.player_contact k where k.telephone = v_tel))
        and (v_rang is null or p.rank = v_rang)
        and case v_filtre
              when 'actifs'   then p.status = 'actif'
              when 'exclus'   then p.status = 'exclu'
              when 'joue'     then p.jour = v_jour and p.xp_jour > 0
              when 'pas_joue' then not (p.jour = v_jour and p.xp_jour > 0)
              when 'ticket'   then not v_mur or exists (select 1 from public.tickets k
                                                         where k.utilise_par = p.id and k.jour = v_jour)
              when 'sans_ticket' then v_mur and not exists (select 1 from public.tickets k
                                                             where k.utilise_par = p.id and k.jour = v_jour)
              else true end) x;
  end if;

  return json_build_object(
    'jour', v_jour,
    'billetterie', v_mur,
    'page', v_page,
    'par_page', v_par,
    'total', v_total,
    'joueurs', coalesce(v_lignes, '[]'::json),
    'resume', json_build_object(
      'joueurs', (select count(*) from public.players where efface_le is null),
      'exclus',  (select count(*) from public.players where status = 'exclu' and efface_le is null),
      'joue_jour', (select count(*) from public.players
                    where status = 'actif' and jour = v_jour and xp_jour > 0),
      'tickets_jour', (select count(distinct utilise_par) from public.tickets
                       where jour = v_jour and utilise_par is not null)));
end;
$function$;

create or replace function public.console_joueur(p_player_id uuid)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour  date := public.jour_jeu();
  v_debut timestamptz := public._debut_jour_jeu();
  v_mur   boolean := coalesce((select actif from public.billetterie_config where id = 1), false);
  v_p     public.players%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_p from public.players where id = p_player_id;
  if v_p.id is null or v_p.efface_le is not null then raise exception 'JOUEUR_INCONNU'; end if;

  return json_build_object(
    'jour', v_jour,
    'billetterie', v_mur,
    'joueur', json_build_object(
      'id', v_p.id, 'pseudo', v_p.pseudo, 'avatar', v_p.archetype, 'xp', v_p.xp, 'jetons', v_p.jetons,
      'niveau', v_p.level, 'rang', v_p.rank, 'statut', v_p.status, 'inscrit', v_p.created_at,
      'xp_jour', case when v_p.jour = v_jour then v_p.xp_jour else 0 end),
    -- Place au classement général (index players_classement_general_idx)
    'place', case when v_p.status = 'actif' then 1 + (
      select count(*) from public.players q
      where q.status = 'actif' and (q.xp > v_p.xp or (q.xp = v_p.xp and q.created_at < v_p.created_at))) end,
    'ticket_jour', not v_mur or exists (select 1 from public.tickets k
                                         where k.utilise_par = v_p.id and k.jour = v_jour),
    'jours_tickets', (select count(distinct jour) from public.tickets
                      where utilise_par = v_p.id and jour is not null),
    'jours_joues', (select count(distinct ((e.created_at at time zone 'Africa/Douala') - interval '6 hours')::date)
                    from public.events e where e.player_id = v_p.id),
    'actions_jour', (select count(*) from public.events e
                     where e.player_id = v_p.id and e.created_at >= v_debut),
    'genre', (select genre_prefere from public.player_profile where player_id = v_p.id),
    -- Numéro : les 4 derniers chiffres seulement (le joueur dit le sien, le
    -- staff compare) ; recherche par numéro complet dans console_joueurs
    'telephone', (select json_build_object('fin', right(k.telephone, 4), 'domaf', k.consent,
                                           'partenaires', k.partenaires)
                  from public.player_contact k where k.player_id = v_p.id),

    -- Missions validées par le staff : consigne à faire respecter, faite aujourd'hui ?
    'missions', coalesce((
      select json_agg(json_build_object(
        'id', q.id, 'titre', q.title, 'consigne', q.description, 'xp', q.xp_reward,
        'categorie', q.categorie, 'badge', b.name, 'validee', qp.completed_at)
        order by q.priorite desc, q.created_at)
      from public.quests q
      left join public.badges b on b.id = q.badge_id
      left join public.quest_progress qp
        on qp.quest_id = q.id and qp.player_id = v_p.id and qp.jour = v_jour
      where q.counter = 'manuel' and q.active), '[]'::json),

    -- Tout le catalogue, possédés en tête : la remise manuelle choisit dedans
    'badges', coalesce((
      select json_agg(json_build_object(
        'id', b.id, 'nom', b.name, 'icone', b.icon, 'rarete', b.rarete, 'secret', b.secret,
        'systeme', public._is_system_badge(b.name), 'obtenu', pb.earned_at)
        order by pb.earned_at is null, pb.earned_at desc,
                 array_position(array['commun','rare','epique','legendaire'], b.rarete), b.name)
      from public.badges b
      left join public.player_badges pb on pb.badge_id = b.id and pb.player_id = v_p.id), '[]'::json),

    'faits', coalesce((
      select json_agg(json_build_object('type', e.type, 'at', e.created_at, 'message', e.payload->>'message',
                                        'xp', (e.payload->>'xp')::int)
                      order by e.created_at desc)
      from (select type, created_at, payload from public.events
            where player_id = v_p.id and type <> 'level_up'
            order by created_at desc limit 12) e), '[]'::json),

    'codes_lus', coalesce((
      select json_agg(json_build_object('par', j.par_nom, 'at', j.at) order by j.at desc)
      from (select par_nom, at from public.console_journal
            where joueur_id = v_p.id and action = 'code_lu'
            order by at desc limit 5) j), '[]'::json)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Banque de questions (01_reference.sql)
-- ---------------------------------------------------------------------------
delete from public.micro_questions;
insert into public.micro_questions (id, ordre, code, theme, moment, chaque_jour, ordre_fixe, type, question, options) values
 (1, 1, 'S1', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu comment aujourd''hui ?',
  '[{"valeur": "a-pied", "libelle": "À pied"}, {"valeur": "moto-taxi", "libelle": "Moto-taxi"}, {"valeur": "taxi", "libelle": "Taxi"}, {"valeur": "voiture-personnelle", "libelle": "Voiture personnelle"}, {"valeur": "bus", "libelle": "Bus"}]'::jsonb),
 (2, 2, 'S2', 'venue', 'toujours', false, false, 'choix',
  'Tu as connu le DOMAF comment ?',
  '[{"valeur": "un-ami-m-en-a-parle", "libelle": "Un ami m''en a parlé"}, {"valeur": "facebook-ou-instagram", "libelle": "Facebook ou Instagram"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "radio-ou-tele", "libelle": "Radio ou télé"}, {"valeur": "une-affiche", "libelle": "Une affiche"}, {"valeur": "autrement", "libelle": "Autrement", "bas": true}]'::jsonb),
 (3, 3, 'S3', 'venue', 'toujours', false, true, 'choix',
  'C''est ton combientième DOMAF ?',
  '[{"valeur": "mon-tout-premier", "libelle": "Mon tout premier"}, {"valeur": "le-2e-ou-le-3e", "libelle": "Le 2e ou le 3e"}, {"valeur": "je-viens-presque-chaque-", "libelle": "Je viens presque chaque année"}]'::jsonb),
 (4, 4, 'S4', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu avec qui ?',
  '[{"valeur": "seul", "libelle": "Seul"}, {"valeur": "avec-des-amis", "libelle": "Avec des amis"}, {"valeur": "en-couple", "libelle": "En couple"}, {"valeur": "en-famille", "libelle": "En famille"}, {"valeur": "avec-des-collegues", "libelle": "Avec des collègues"}]'::jsonb),
 (5, 5, 'S6', 'venue', 'toujours', false, false, 'choix',
  'Tu écoutes ta musique surtout où ?',
  '[{"valeur": "sur-une-appli-de-streami", "libelle": "Sur une appli de streaming"}, {"valeur": "sur-youtube", "libelle": "Sur YouTube"}, {"valeur": "sur-tiktok", "libelle": "Sur TikTok"}, {"valeur": "a-la-radio", "libelle": "À la radio"}, {"valeur": "en-concert-surtout", "libelle": "En concert, surtout"}]'::jsonb),
 (6, 6, 'S7', 'ecoute', 'toujours', false, false, 'choix',
  'Ton appli de musique principale ?',
  '[{"valeur": "boomplay", "libelle": "Boomplay"}, {"valeur": "audiomack", "libelle": "Audiomack"}, {"valeur": "spotify", "libelle": "Spotify"}, {"valeur": "youtube-music", "libelle": "YouTube Music"}, {"valeur": "apple-music", "libelle": "Apple Music"}, {"valeur": "deezer", "libelle": "Deezer"}, {"valeur": "aucune", "libelle": "Aucune", "bas": true}]'::jsonb),
 (7, 7, 'S8', 'ecoute', 'toujours', false, true, 'choix',
  'Tu paies un abonnement musique ?',
  '[{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non-la-version-gratuite-", "libelle": "Non, la version gratuite me suffit"}, {"valeur": "non-je-n-utilise-pas-d-a", "libelle": "Non, je n''utilise pas d''appli"}]'::jsonb),
 (8, 8, 'S9', 'ecoute', 'toujours', false, true, 'choix',
  'Tu écoutes de la musique combien de temps par jour ?',
  '[{"valeur": "moins-d-1-h", "libelle": "Moins d''1 h"}, {"valeur": "1-a-3-h", "libelle": "1 à 3 h"}, {"valeur": "3-a-5-h", "libelle": "3 à 5 h"}, {"valeur": "plus-de-5-h", "libelle": "Plus de 5 h"}]'::jsonb),
 (9, 9, 'S10', 'ecoute', 'toujours', false, false, 'choix',
  'Tu écoutes surtout…',
  '[{"valeur": "des-artistes-camerounais", "libelle": "Des artistes camerounais"}, {"valeur": "des-artistes-africains", "libelle": "Des artistes africains"}, {"valeur": "des-artistes-internation", "libelle": "Des artistes internationaux"}, {"valeur": "un-peu-de-tout", "libelle": "Un peu de tout", "bas": true}]'::jsonb),
 (10, 10, 'S11', 'ecoute', 'toujours', false, true, 'choix',
  'La radio, tu l''écoutes ?',
  '[{"valeur": "tous-les-jours", "libelle": "Tous les jours"}, {"valeur": "de-temps-en-temps", "libelle": "De temps en temps"}, {"valeur": "jamais", "libelle": "Jamais"}]'::jsonb),
 (11, 11, 'S12', 'ecoute', 'toujours', false, false, 'choix',
  'Tu écoutes la musique sur quoi ?',
  '[{"valeur": "le-telephone", "libelle": "Le téléphone"}, {"valeur": "des-ecouteurs-bluetooth", "libelle": "Des écouteurs Bluetooth"}, {"valeur": "une-enceinte", "libelle": "Une enceinte"}, {"valeur": "la-tele", "libelle": "La télé"}, {"valeur": "en-voiture", "libelle": "En voiture"}]'::jsonb),
 (12, 12, 'S13', 'gouts', 'toujours', false, false, 'choix',
  'Ton 2e genre préféré ?',
  '[{"valeur": "afrobeats-afro-pop", "libelle": "Afrobeats / Afro-pop"}, {"valeur": "makossa", "libelle": "Makossa"}, {"valeur": "bikutsi", "libelle": "Bikutsi"}, {"valeur": "coupe-decale", "libelle": "Coupé-décalé"}, {"valeur": "rap-hip-hop", "libelle": "Rap / Hip-hop"}, {"valeur": "r-b-soul", "libelle": "R&B / Soul"}, {"valeur": "gospel", "libelle": "Gospel"}, {"valeur": "reggae-dancehall", "libelle": "Reggae / Dancehall"}, {"valeur": "rumba-ndombolo", "libelle": "Rumba / Ndombolo"}, {"valeur": "jazz", "libelle": "Jazz"}, {"valeur": "electro", "libelle": "Électro"}, {"valeur": "zouk-kompa", "libelle": "Zouk / Kompa"}, {"valeur": "un-autre", "libelle": "Un autre", "bas": true}]'::jsonb),
 (13, 13, 'S14', 'gouts', 'toujours', false, false, 'choix',
  'Tu découvres les nouveaux artistes surtout par…',
  '[{"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "instagram", "libelle": "Instagram"}, {"valeur": "youtube", "libelle": "YouTube"}, {"valeur": "la-radio", "libelle": "La radio"}, {"valeur": "les-amis", "libelle": "Les amis"}, {"valeur": "les-concerts", "libelle": "Les concerts"}]'::jsonb),
 (14, 14, 'S15', 'gouts', 'toujours', false, true, 'choix',
  'Tu as déjà acheté un morceau ou un album ?',
  '[{"valeur": "oui-en-ligne", "libelle": "Oui, en ligne"}, {"valeur": "oui-un-cd", "libelle": "Oui, un CD"}, {"valeur": "jamais", "libelle": "Jamais"}]'::jsonb),
 (15, 15, 'S16', 'gouts', 'toujours', false, true, 'choix',
  'Tu suis des artistes sur les réseaux ?',
  '[{"valeur": "oui-beaucoup", "libelle": "Oui, beaucoup"}, {"valeur": "quelques-uns", "libelle": "Quelques-uns"}, {"valeur": "non", "libelle": "Non"}]'::jsonb),
 (16, 16, 'S17', 'gouts', 'toujours', false, true, 'choix',
  'Tu préfères…',
  '[{"valeur": "les-grandes-stars", "libelle": "Les grandes stars"}, {"valeur": "les-nouveaux-talents", "libelle": "Les nouveaux talents"}, {"valeur": "les-deux", "libelle": "Les deux"}]'::jsonb),
 (17, 17, 'S18', 'gouts', 'toujours', false, true, 'choix',
  'Tu fais toi-même de la musique ou de la danse ?',
  '[{"valeur": "oui-c-est-mon-metier", "libelle": "Oui, c''est mon métier"}, {"valeur": "oui-pour-le-plaisir", "libelle": "Oui, pour le plaisir"}, {"valeur": "non", "libelle": "Non"}]'::jsonb),
 (18, 18, 'S19', 'sorties', 'toujours', false, true, 'choix',
  'Tu sors (maquis, boîte, concert) combien de fois par mois ?',
  '[{"valeur": "jamais", "libelle": "Jamais"}, {"valeur": "1-a-2-fois", "libelle": "1 à 2 fois"}, {"valeur": "3-a-5-fois", "libelle": "3 à 5 fois"}, {"valeur": "plus-de-5-fois", "libelle": "Plus de 5 fois"}]'::jsonb),
 (19, 19, 'S20', 'sorties', 'toujours', false, true, 'choix',
  'Ton budget sorties par mois ?',
  '[{"valeur": "moins-de-10-000-fcfa", "libelle": "Moins de 10 000 FCFA"}, {"valeur": "10-000-a-25-000-fcfa", "libelle": "10 000 à 25 000 FCFA"}, {"valeur": "25-000-a-50-000-fcfa", "libelle": "25 000 à 50 000 FCFA"}, {"valeur": "plus-de-50-000-fcfa", "libelle": "Plus de 50 000 FCFA"}]'::jsonb),
 (20, 20, 'S21', 'sorties', 'toujours', false, false, 'choix',
  'Tes billets de concert, tu les achètes…',
  '[{"valeur": "en-ligne", "libelle": "En ligne"}, {"valeur": "sur-place", "libelle": "Sur place"}, {"valeur": "chez-un-revendeur", "libelle": "Chez un revendeur"}, {"valeur": "on-me-les-offre", "libelle": "On me les offre"}]'::jsonb),
 (21, 21, 'S22', 'sorties', 'toujours', false, false, 'choix',
  'Tu paies surtout avec…',
  '[{"valeur": "mtn-mobile-money", "libelle": "MTN Mobile Money"}, {"valeur": "orange-money", "libelle": "Orange Money"}, {"valeur": "especes", "libelle": "Espèces"}, {"valeur": "carte-bancaire", "libelle": "Carte bancaire"}]'::jsonb),
 (22, 22, 'S23', 'sorties', 'toujours', false, true, 'choix',
  'Un concert à 5 000 FCFA, c''est…',
  '[{"valeur": "pas-cher", "libelle": "Pas cher"}, {"valeur": "correct", "libelle": "Correct"}, {"valeur": "trop-cher", "libelle": "Trop cher"}]'::jsonb),
 (23, 23, 'S24', 'partenaires', 'toujours', false, false, 'choix',
  'Ton opérateur mobile principal ?',
  '[{"valeur": "mtn", "libelle": "MTN"}, {"valeur": "orange", "libelle": "Orange"}, {"valeur": "camtel-blue", "libelle": "Camtel / Blue"}, {"valeur": "nexttel", "libelle": "Nexttel"}]'::jsonb),
 (24, 24, 'S25', 'partenaires', 'toujours', false, true, 'choix',
  'Ton forfait internet, tu l''achètes…',
  '[{"valeur": "chaque-jour", "libelle": "Chaque jour"}, {"valeur": "chaque-semaine", "libelle": "Chaque semaine"}, {"valeur": "chaque-mois", "libelle": "Chaque mois"}]'::jsonb),
 (25, 25, 'S26', 'partenaires', 'toujours', false, false, 'choix',
  'Ton téléphone, c''est…',
  '[{"valeur": "un-android", "libelle": "Un Android"}, {"valeur": "un-iphone", "libelle": "Un iPhone"}, {"valeur": "un-telephone-simple", "libelle": "Un téléphone simple"}]'::jsonb),
 (26, 26, 'S27', 'partenaires', 'toujours', false, false, 'choix',
  'Le réseau social que tu ouvres le plus ?',
  '[{"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "facebook", "libelle": "Facebook"}, {"valeur": "instagram", "libelle": "Instagram"}, {"valeur": "snapchat", "libelle": "Snapchat"}, {"valeur": "x", "libelle": "X"}]'::jsonb),
 (27, 27, 'S28', 'partenaires', 'toujours', false, false, 'choix',
  'Au festival, tu bois plutôt…',
  '[{"valeur": "de-la-biere", "libelle": "De la bière"}, {"valeur": "du-soda", "libelle": "Du soda"}, {"valeur": "du-jus", "libelle": "Du jus"}, {"valeur": "de-l-eau", "libelle": "De l''eau"}, {"valeur": "un-energisant", "libelle": "Un énergisant"}, {"valeur": "rien", "libelle": "Rien", "bas": true}]'::jsonb),
 (28, 28, 'S30', 'partenaires', 'toujours', false, false, 'choix',
  'Tu manges quoi au festival ?',
  '[{"valeur": "grillades-soya", "libelle": "Grillades / soya"}, {"valeur": "plats-locaux", "libelle": "Plats locaux"}, {"valeur": "fast-food", "libelle": "Fast-food"}, {"valeur": "rien-je-mange-avant", "libelle": "Rien, je mange avant", "bas": true}]'::jsonb),
 (29, 29, 'S31', 'profil', 'toujours', false, true, 'choix',
  'Tu vis à Douala depuis…',
  '[{"valeur": "toujours", "libelle": "Toujours"}, {"valeur": "plus-de-5-ans", "libelle": "Plus de 5 ans"}, {"valeur": "moins-de-5-ans", "libelle": "Moins de 5 ans"}, {"valeur": "je-n-y-vis-pas", "libelle": "Je n''y vis pas"}]'::jsonb),
 (30, 30, 'S32', 'profil', 'toujours', false, false, 'choix',
  'À la maison, tu parles surtout…',
  '[{"valeur": "francais", "libelle": "Français"}, {"valeur": "anglais", "libelle": "Anglais"}, {"valeur": "pidgin", "libelle": "Pidgin"}, {"valeur": "une-langue-locale", "libelle": "Une langue locale"}]'::jsonb),
 (31, 31, 'S33', 'profil', 'toujours', false, true, 'choix',
  'Tu as des enfants ?',
  '[{"valeur": "oui", "libelle": "Oui"}, {"valeur": "non", "libelle": "Non"}]'::jsonb),
 (32, 32, 'N1', 'soir', 'soir', true, true, 'choix',
  'Ta journée, tu la notes comment ?',
  '[{"valeur": "decevante", "libelle": "Décevante"}, {"valeur": "moyenne", "libelle": "Moyenne"}, {"valeur": "bien", "libelle": "Bien"}, {"valeur": "tres-bien", "libelle": "Très bien"}, {"valeur": "inoubliable", "libelle": "Inoubliable"}]'::jsonb),
 (33, 33, 'N2', 'soir', 'soir', true, true, 'artiste',
  'Ton concert préféré aujourd''hui ?',
  '[]'::jsonb),
 (34, 34, 'N3', 'soir', 'soir', true, false, 'choix',
  'Ce qui t''a le plus plu aujourd''hui ?',
  '[{"valeur": "la-musique", "libelle": "La musique"}, {"valeur": "l-ambiance", "libelle": "L''ambiance"}, {"valeur": "le-jeu-domaf-quest", "libelle": "Le jeu DOMAF Quest"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "l-organisation", "libelle": "L''organisation"}, {"valeur": "les-rencontres", "libelle": "Les rencontres"}]'::jsonb),
 (35, 35, 'N4', 'soir', 'soir', true, true, 'choix',
  'L''attente à l''entrée ?',
  '[{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]'::jsonb),
 (36, 36, 'N5', 'soir', 'soir', true, true, 'choix',
  'L''attente au bar ?',
  '[{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]'::jsonb),
 (37, 37, 'N6', 'soir', 'soir', true, true, 'choix',
  'L''attente aux food-trucks ?',
  '[{"valeur": "rapide", "libelle": "Rapide"}, {"valeur": "correcte", "libelle": "Correcte"}, {"valeur": "trop-longue", "libelle": "Trop longue"}]'::jsonb),
 (38, 38, 'N7', 'soir', 'soir', true, true, 'choix',
  'Les toilettes ?',
  '[{"valeur": "propres-et-rapides", "libelle": "Propres et rapides"}, {"valeur": "correctes", "libelle": "Correctes"}, {"valeur": "a-revoir", "libelle": "À revoir"}]'::jsonb),
 (39, 39, 'N8', 'soir', 'soir', true, true, 'choix',
  'Combien as-tu dépensé aujourd''hui, sans le billet ?',
  '[{"valeur": "rien-du-tout", "libelle": "Rien du tout"}, {"valeur": "moins-de-2-000-fcfa", "libelle": "Moins de 2 000 FCFA"}, {"valeur": "2-000-a-5-000-fcfa", "libelle": "2 000 à 5 000 FCFA"}, {"valeur": "5-000-a-10-000-fcfa", "libelle": "5 000 à 10 000 FCFA"}, {"valeur": "plus-de-10-000-fcfa", "libelle": "Plus de 10 000 FCFA"}]'::jsonb),
 (40, 40, 'N9', 'soir', 'soir', true, false, 'choix',
  'Ce qu''on doit améliorer en priorité ?',
  '[{"valeur": "plus-de-stands", "libelle": "Plus de stands"}, {"valeur": "moins-d-attente", "libelle": "Moins d''attente"}, {"valeur": "plus-d-activites", "libelle": "Plus d''activités"}, {"valeur": "plus-de-place", "libelle": "Plus de place"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "rien-c-etait-bien", "libelle": "Rien, c''était bien", "bas": true}]'::jsonb),
 (41, 41, 'N10', 'soir', 'soir', false, true, 'choix',
  'Conseillerais-tu DOMAF Quest à un ami ? (0 = pas du tout, 10 = carrément)',
  '[{"valeur": "0", "libelle": "0"}, {"valeur": "1", "libelle": "1"}, {"valeur": "2", "libelle": "2"}, {"valeur": "3", "libelle": "3"}, {"valeur": "4", "libelle": "4"}, {"valeur": "5", "libelle": "5"}, {"valeur": "6", "libelle": "6"}, {"valeur": "7", "libelle": "7"}, {"valeur": "8", "libelle": "8"}, {"valeur": "9", "libelle": "9"}, {"valeur": "10", "libelle": "10"}]'::jsonb),
 (42, 42, 'N11', 'soir', 'soir', false, true, 'choix',
  'Tu reviendras au DOMAF l''an prochain ?',
  '[{"valeur": "oui-sur", "libelle": "Oui, sûr"}, {"valeur": "peut-etre", "libelle": "Peut-être"}, {"valeur": "non", "libelle": "Non"}]'::jsonb)
on conflict (id) do nothing;

commit;
