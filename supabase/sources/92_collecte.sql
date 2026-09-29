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
alter table public.micro_config add column if not exists soir_debut time not null default '18:00';   -- festival de jour (Vimas)

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

create table public.coffres (
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
    -- Yaoundé (Vimas, 29/09) : les quartiers autour du campus d'abord, puis le
    -- reste de la ville. Mêmes valeurs que app/data/mock.js (fiche.champs).
    'quartier', json_build_array(
      json_build_object('valeur','ngoa-ekelle-obili','libelle','Ngoa-Ekellé / Obili'),
      json_build_object('valeur','melen-mini-ferme','libelle','Melen / Mini Ferme'),
      json_build_object('valeur','biyem-assi','libelle','Biyem-Assi'),
      json_build_object('valeur','mendong-simbock','libelle','Mendong / Simbock'),
      json_build_object('valeur','etoug-ebe','libelle','Etoug-Ébé'),
      json_build_object('valeur','mvog-mbi','libelle','Mvog-Mbi'),
      json_build_object('valeur','mvog-ada','libelle','Mvog-Ada'),
      json_build_object('valeur','essos','libelle','Essos'),
      json_build_object('valeur','mimboman','libelle','Mimboman'),
      json_build_object('valeur','ekounou','libelle','Ekounou'),
      json_build_object('valeur','odza-nkoabang','libelle','Odza / Nkoabang'),
      json_build_object('valeur','nsam-efoulan','libelle','Nsam / Efoulan'),
      json_build_object('valeur','bastos','libelle','Bastos'),
      json_build_object('valeur','etoudi-olembe','libelle','Etoudi / Olembé'),
      json_build_object('valeur','emana','libelle','Emana'),
      json_build_object('valeur','tsinga-nlongkak','libelle','Tsinga / Nlongkak'),
      json_build_object('valeur','mokolo-madagascar','libelle','Mokolo / Madagascar'),
      json_build_object('valeur','nkolbisson','libelle','Nkolbisson'),
      json_build_object('valeur','mvan-ahala','libelle','Mvan / Ahala'),
      json_build_object('valeur','centre-ville','libelle','Centre-ville'),
      json_build_object('valeur','autre-yaounde','libelle','Un autre quartier de Yaoundé'),
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
           >= coalesce((select soir_debut from public.micro_config where id = 1), time '18:00')
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
