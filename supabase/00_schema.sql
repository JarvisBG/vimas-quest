-- ============================================================================
-- DOMAF Quest — 00_schema.sql
-- ----------------------------------------------------------------------------
-- Structure complète de la base, à coller UNE FOIS dans l'éditeur SQL d'un
-- projet Supabase NEUF, puis 01_reference.sql.
--
-- FICHIER FABRIQUÉ par supabase/outils/fabriquer_schema.py à partir de la
-- structure réelle de la prod Otaku Quest (supabase/extraction-otaku/).
-- Ne pas le modifier à la main : corriger le script et le relancer.
--
-- Différences avec Otaku Quest :
--   · retirés : chasses au trésor, duels, archives de Yaoundé ;
--   · journée de jeu = public.jour_jeu() : coupure à 6 h, heure de Douala
--     (une nuit de concerts reste dans la journée où elle a commencé) ;
--   · types de QR : scene,stand,foodtruck,service,relique,dedicace,surprise ;
--   · rangs : Spectateur, Fan, Groupie, Backstage, Tête d'affiche ;
--   · badges système : Première note, Curieux, Fouineur, Autographe, Jury, Oreille d'or,
--     Lève-tôt, Noctambule, Marathonien, Podium ;
--   · profil : genre musical préféré (genre_prefere) au lieu de l'animé ;
--   · raids = blind test (mêmes tables, textes adaptés) ;
--   · blind test : catégorie, réponse, anecdote, extrait audio, pochette ;
--   · en plus : programme et plan (sources/10_programme.sql),
--     saisie du blind test (sources/20_blind_test.sql),
--     blind test côté joueur : barème, place, récompenses (sources/25_blind_joueur.sql),
--     collection : badges, artistes, stands, reliques (sources/40_collection.sql),
--     classement des téléphones (sources/50_classement.sql),
--     roue : bons du joueur, plafond par jour, rareté des lots (sources/60_roue.sql),
--     coups de cœur : artistes et stands, clôture datée (sources/70_coeurs.sql),
--     annonces : titre, catégorie, lien, fin de validité (sources/80_annonces.sql),
--     collecte : fiche fan, téléphone, coffre du scan (sources/92_collecte.sql),
--     mur de l'écran géant en un appel (sources/97_mur.sql),
--     plateau du blind test sur l'écran géant (sources/98_ecran_blind.sql),
--     tableau de bord de la console en un appel (sources/99_console.sql),
--     écran Joueurs : liste paginée, fiche en un appel, effacement (sources/99_console_joueurs.sql),
--     contenu du jeu : missions, badges, QR (sources/99_console_contenu.sql),
--     programme : lieux, scènes, artistes, concerts, dédicaces (sources/99_console_programme.sql) ;
--   · player_home complète (carte en un appel), scan_qr renvoie l'avancée des missions ;
--   · un QR de scène se scanne une fois par concert (scans.creneau_id).
-- Tables : 42 · fonctions : 154
-- ============================================================================

begin;

-- Les fonctions SQL se référencent entre elles : on laisse Postgres les créer
-- dans l'ordre alphabétique sans vérifier les corps tout de suite.
set local check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- Extensions (gen_random_uuid est natif ; pgcrypto et uuid-ossp par prudence)
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ----------------------------------------------------------------------------
-- La journée de jeu DOMAF
-- ----------------------------------------------------------------------------
-- Le festival ferme ses portes vers 3 h du matin. Une journée de jeu va donc
-- de 6 h à 6 h, heure de Douala : le ticket du vendredi reste valable jusqu'à
-- la fin de la nuit, le classement du jour aussi.
create or replace function public.jour_de(p_instant timestamptz)
 returns date
 language sql
 stable
 set search_path to 'public'
as $function$
  select ((p_instant at time zone 'Africa/Douala') - interval '6 hours')::date;
$function$;

create or replace function public.jour_jeu()
 returns date
 language sql
 stable
 set search_path to 'public'
as $function$
  select public.jour_de(now());
$function$;

grant execute on function public.jour_de(timestamptz) to anon, authenticated;
grant execute on function public.jour_jeu() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Tables (29)
-- ----------------------------------------------------------------------------
create table public.announcements (
  id uuid default gen_random_uuid() not null,
  message text not null,
  type text default 'info'::text not null,
  created_at timestamp with time zone default now() not null,
  titre text,
  categorie text default 'pratique' not null,
  lien text,                                  -- page du site : plan.html?lieu=abri-1
  lien_libelle text,                          -- « Voir les abris »
  fin timestamp with time zone,               -- null : sans fin
  constraint announcements_titre check (char_length(titre) between 1 and 80),
  constraint announcements_categorie check (categorie in ('meteo', 'horaire', 'surprise', 'securite', 'jeu', 'pratique')),
  constraint announcements_lien check (lien ~ '^[a-z0-9-]+[.]html([?#][A-Za-z0-9_=&#.-]*)?$'),
  constraint announcements_lien_libelle check (lien_libelle is null or (lien is not null and char_length(lien_libelle) between 1 and 40)),
  constraint announcements_fin check (fin is null or fin >= created_at)
);

create table public.badges (
  id uuid default gen_random_uuid() not null,
  name text not null,
  icon text default 'fa-medal'::text not null,
  description text,
  created_at timestamp with time zone default now() not null,
  rarete text default 'commun' not null,     -- commun, rare, epique, legendaire
  forme text default 'rond' not null,        -- découpe de l'autocollant
  secret boolean default false not null,     -- nom caché tant qu'il n'est pas gagné
  lien text,                                 -- page où l'obtenir : « scanner.html »
  constraint badges_rarete check (rarete in ('commun', 'rare', 'epique', 'legendaire')),
  constraint badges_forme check (forme in ('rond', 'etoile', 'hexa', 'ecusson')),
  constraint badges_lien check (lien ~ '^[a-z0-9-]+[.]html(#[A-Za-z0-9_-]+)?$')
);

create table public.billetterie_config (
  id integer default 1 not null,
  prix_journee integer default 500 not null,
  actif boolean default true not null,
  message text default 'Le jeu se joue avec un ticket. Cherche un membre de l''équipe, il en a sur lui.'::text not null
);

create table public.carnets (
  id uuid default gen_random_uuid() not null,
  numero integer not null,
  vendeur_nom text not null,
  vendeur_user uuid,
  nb_tickets integer not null,
  rendus integer default 0 not null,
  actif boolean default true not null,
  note text,
  cree_le timestamp with time zone default now() not null,
  cree_par uuid
);

create table public.coeur_config (
  id integer default 1 not null,
  xp_par_coeur integer default 10 not null,
  max_coeurs integer default 3 not null,
  actif boolean default true not null,
  cloture timestamp with time zone default '2026-11-29 20:00:00+01'::timestamp with time zone not null
);

create table public.contact_config (
  id integer default 1 not null,
  actif boolean default true not null,
  jetons_bonus integer default 0 not null
);

create table public.events (
  id uuid default gen_random_uuid() not null,
  type text not null,
  player_id uuid,
  payload jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.game_state (
  id integer default 1 not null,
  phase text default 'EXPLORATION'::text not null,
  updated_at timestamp with time zone default now() not null,
  roulette_cost integer default 30 not null,
  roulette_max_jour integer default 10 not null,
  constraint game_state_roulette_max_jour check (roulette_max_jour >= 0)
);

create table public.micro_config (
  id integer default 1 not null,
  xp_par_reponse integer default 10 not null,
  xp_bonus_complet integer default 30 not null,
  scans_avant_premier integer default 2 not null,
  scans_entre_deux integer default 3 not null,
  max_par_jour integer default 3 not null,
  actif boolean default true not null
);

create table public.micro_questions (
  id integer not null,
  ordre integer not null,
  question text not null,
  options jsonb not null,
  active boolean default true not null
);

create table public.micro_votes (
  player_id uuid not null,
  question_id integer not null,
  valeur text not null,
  jour date default public.jour_jeu() not null,
  created_at timestamp with time zone default now() not null
);

create table public.player_badges (
  player_id uuid not null,
  badge_id uuid not null,
  earned_at timestamp with time zone default now() not null
);

create table public.player_contact (
  player_id uuid not null,
  telephone text not null,
  consent boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.player_profile (
  player_id uuid not null,
  tranche_age text,
  sexe text,
  quartier text,
  genre_prefere text,
  bonus_verse boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  coeurs_payes integer default 0 not null
);

create table public.player_secrets (
  player_id uuid not null,
  secret_code text not null
);

create table public.players (
  id uuid default gen_random_uuid() not null,
  pseudo text not null,
  archetype text not null,
  xp integer default 0 not null,
  jetons integer default 0 not null,
  level integer default 1 not null,
  rank text default 'Spectateur'::text not null,
  status text default 'actif'::text not null,
  created_at timestamp with time zone default now() not null,
  xp_jour integer default 0 not null,
  jour date default public.jour_jeu() not null,
  efface_le timestamp with time zone         -- effacé au stand : pseudo anonyme, statut exclu
);

create table public.profil_config (
  id integer default 1 not null,
  xp_par_reponse integer default 20 not null,
  xp_bonus_complet integer default 50 not null,
  actif boolean default true not null
);

create table public.qr_codes (
  id uuid default gen_random_uuid() not null,
  code text not null,
  label text not null,
  type text not null,
  rarity text,
  xp_reward integer default 50 not null,
  badge_id uuid,
  hint text,
  character_name text,
  anime text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  quest_id uuid
);

create table public.quest_progress (
  player_id uuid not null,
  quest_id uuid not null,
  progress integer default 0 not null,
  completed_at timestamp with time zone,
  jour date default public.jour_jeu() not null
);

create table public.quests (
  id uuid default gen_random_uuid() not null,
  title text not null,
  description text,
  type text default 'standard'::text not null,
  goal_count integer default 1 not null,
  xp_reward integer default 100 not null,
  badge_id uuid,
  requires_staff boolean default false not null,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  counter text default 'manuel'::text not null,
  vague smallint default 0 not null,
  priorite smallint default 0 not null,
  categorie text,                            -- exploration, musique, gourmand, social, defi
  constraint quests_categorie check (categorie in ('exploration', 'musique', 'gourmand', 'social', 'defi'))
);

create table public.quiz_answers (
  id uuid default gen_random_uuid() not null,
  question_id uuid not null,
  player_id uuid not null,
  answer_index integer not null,
  is_correct boolean,
  response_ms integer,
  answered_at timestamp with time zone default now() not null,
  points integer default 0 not null
);

create table public.quiz_questions (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  question text not null,
  choices jsonb not null,
  correct_index integer not null,
  question_order integer default 1 not null,
  duration_seconds integer default 20 not null,
  categorie text,                            -- « Artiste », « Instrument »…
  reponse text,                              -- révélée : « Artiste, « Titre » »
  anecdote text,
  audio_url text,                            -- extrait joué par l'écran géant
  audio_debut integer default 0 not null,    -- seconde de départ dans le fichier
  pochette_url text,                         -- montrée à la révélation
  constraint quiz_questions_audio_debut check (audio_debut between 0 and 3600),
  constraint quiz_questions_audio_url check (audio_url ~ '^(https://|[A-Za-z0-9_][A-Za-z0-9_./-]*$)'),
  constraint quiz_questions_pochette_url check (pochette_url ~ '^(https://|[A-Za-z0-9_][A-Za-z0-9_./-]*$)')
);

create table public.quiz_sessions (
  id uuid default gen_random_uuid() not null,
  title text not null,
  status text default 'preparee'::text not null,
  current_question integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  question_started_at timestamp with time zone,
  kind text default 'quiz'::text not null,
  boss_name text,
  boss_image text,
  boss_hp_max integer default 0 not null,
  raid_bonus_xp integer default 0 not null,
  recompenses_at timestamp with time zone    -- fin de manche : récompenses versées
);

create table public.roulette_prizes (
  id uuid default gen_random_uuid() not null,
  name text not null,
  icon text default 'cadeau'::text not null,
  weight integer default 10 not null,
  stock integer,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  kind text default 'objet'::text not null,
  value integer default 0 not null,
  badge_id uuid,
  rarete text default 'commun' not null,     -- commun, rare, epique, legendaire
  court text,                                -- libellé sur la roue : « Casquette »
  constraint roulette_prizes_rarete check (rarete in ('commun', 'rare', 'epique', 'legendaire')),
  constraint roulette_prizes_court check (char_length(court) between 1 and 12)
);

create table public.roulette_spins (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  prize_id uuid,
  cost integer default 30 not null,
  redeem_code text,
  redeemed_at timestamp with time zone,
  redeemed_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.scans (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  qr_code_id uuid not null,
  day date default public.jour_jeu() not null,
  scanned_at timestamp with time zone default now() not null,
  creneau_id uuid
);

create table public.staff (
  user_id uuid not null,
  display_name text default 'Staff'::text not null,
  role text default 'gm'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.tickets (
  id uuid default gen_random_uuid() not null,
  carnet_id uuid not null,
  code text not null,
  rang integer not null,
  utilise_par uuid,
  utilise_le timestamp with time zone,
  jour date,
  rendu_le timestamp with time zone
);

create table public.tournament_kings (
  jour date not null,
  pseudo text not null,
  points integer not null,
  decided_at timestamp with time zone default now() not null
);

-- ----------------------------------------------------------------------------
-- Clés primaires, contraintes UNIQUE et CHECK
-- ----------------------------------------------------------------------------
alter table public.announcements add constraint announcements_pkey PRIMARY KEY (id);
alter table public.badges add constraint badges_pkey PRIMARY KEY (id);
alter table public.billetterie_config add constraint billetterie_config_pkey PRIMARY KEY (id);
alter table public.carnets add constraint carnets_pkey PRIMARY KEY (id);
alter table public.coeur_config add constraint coeur_config_pkey PRIMARY KEY (id);
alter table public.contact_config add constraint contact_config_pkey PRIMARY KEY (id);
alter table public.events add constraint events_pkey PRIMARY KEY (id);
alter table public.game_state add constraint game_state_pkey PRIMARY KEY (id);
alter table public.micro_config add constraint micro_config_pkey PRIMARY KEY (id);
alter table public.micro_questions add constraint micro_questions_pkey PRIMARY KEY (id);
alter table public.micro_votes add constraint micro_votes_pkey PRIMARY KEY (player_id, question_id);
alter table public.player_badges add constraint player_badges_pkey PRIMARY KEY (player_id, badge_id);
alter table public.player_contact add constraint player_contact_pkey PRIMARY KEY (player_id);
alter table public.player_profile add constraint player_profile_pkey PRIMARY KEY (player_id);
alter table public.player_secrets add constraint player_secrets_pkey PRIMARY KEY (player_id);
alter table public.players add constraint players_pkey PRIMARY KEY (id);
alter table public.profil_config add constraint profil_config_pkey PRIMARY KEY (id);
alter table public.qr_codes add constraint qr_codes_pkey PRIMARY KEY (id);
alter table public.quest_progress add constraint quest_progress_pkey PRIMARY KEY (player_id, quest_id, jour);
alter table public.quests add constraint quests_pkey PRIMARY KEY (id);
alter table public.quiz_answers add constraint quiz_answers_pkey PRIMARY KEY (id);
alter table public.quiz_questions add constraint quiz_questions_pkey PRIMARY KEY (id);
alter table public.quiz_sessions add constraint quiz_sessions_pkey PRIMARY KEY (id);
alter table public.roulette_prizes add constraint roulette_prizes_pkey PRIMARY KEY (id);
alter table public.roulette_spins add constraint roulette_spins_pkey PRIMARY KEY (id);
alter table public.scans add constraint scans_pkey PRIMARY KEY (id);
alter table public.staff add constraint staff_pkey PRIMARY KEY (user_id);
alter table public.tickets add constraint tickets_pkey PRIMARY KEY (id);
alter table public.tournament_kings add constraint tournament_kings_pkey PRIMARY KEY (jour);

alter table public.badges add constraint badges_name_key UNIQUE (name);
alter table public.carnets add constraint carnets_numero_key UNIQUE (numero);
alter table public.player_secrets add constraint player_secrets_secret_code_key UNIQUE (secret_code);
alter table public.players add constraint players_pseudo_key UNIQUE (pseudo);
alter table public.qr_codes add constraint qr_codes_code_key UNIQUE (code);
alter table public.quiz_answers add constraint quiz_answers_question_id_player_id_key UNIQUE (question_id, player_id);
alter table public.roulette_spins add constraint roulette_spins_redeem_code_key UNIQUE (redeem_code);
alter table public.tickets add constraint tickets_code_key UNIQUE (code);

alter table public.announcements add constraint announcements_type_check CHECK ((type = ANY (ARRAY['info'::text, 'alerte'::text, 'succes'::text, 'danger'::text])));
alter table public.billetterie_config add constraint billetterie_config_id_check CHECK ((id = 1));
alter table public.billetterie_config add constraint billetterie_config_prix_journee_check CHECK ((prix_journee >= 0));
alter table public.carnets add constraint carnets_nb_tickets_check CHECK (((nb_tickets >= 1) AND (nb_tickets <= 500)));
alter table public.carnets add constraint carnets_rendus_check CHECK ((rendus >= 0));
alter table public.coeur_config add constraint coeur_config_id_check CHECK ((id = 1));
alter table public.contact_config add constraint contact_config_id_check CHECK ((id = 1));
alter table public.game_state add constraint game_state_id_check CHECK ((id = 1));
alter table public.game_state add constraint game_state_phase_check CHECK ((phase = ANY (ARRAY['EXPLORATION'::text, 'QUIZ'::text, 'RAID'::text, 'CLOTURE'::text])));
alter table public.micro_config add constraint micro_config_id_check CHECK ((id = 1));
alter table public.players add constraint players_pseudo_check CHECK (((char_length(pseudo) >= 2) AND (char_length(pseudo) <= 16)));
alter table public.players add constraint players_status_check CHECK ((status = ANY (ARRAY['actif'::text, 'exclu'::text])));
alter table public.profil_config add constraint profil_config_id_check CHECK ((id = 1));
alter table public.qr_codes add constraint qr_codes_rarity_check CHECK ((rarity = ANY (ARRAY['commune'::text, 'rare'::text, 'legendaire'::text])));
alter table public.qr_codes add constraint qr_codes_type_check CHECK ((type = ANY (ARRAY['scene'::text, 'stand'::text, 'foodtruck'::text, 'service'::text, 'relique'::text, 'dedicace'::text, 'surprise'::text])));
alter table public.quests add constraint quests_type_check CHECK ((type = ANY (ARRAY['standard'::text, 'secrete'::text, 'boss'::text, 'collection'::text])));
alter table public.quiz_sessions add constraint quiz_sessions_kind_check CHECK ((kind = ANY (ARRAY['quiz'::text, 'raid'::text])));
alter table public.quiz_sessions add constraint quiz_sessions_status_check CHECK ((status = ANY (ARRAY['preparee'::text, 'en_cours'::text, 'terminee'::text])));
alter table public.roulette_prizes add constraint roulette_prizes_badge_ck CHECK (((kind <> 'badge'::text) OR (badge_id IS NOT NULL)));
alter table public.roulette_prizes add constraint roulette_prizes_kind_ck CHECK ((kind = ANY (ARRAY['objet'::text, 'xp'::text, 'jetons'::text, 'badge'::text, 'rien'::text])));
alter table public.staff add constraint staff_role_check CHECK ((role = ANY (ARRAY['gm'::text, 'staff'::text, 'vendeur'::text])));

-- ----------------------------------------------------------------------------
-- Fonctions (74)
-- ----------------------------------------------------------------------------
create or replace function public._award_badge(p_player_id uuid, p_pseudo text, p_badge_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_badge public.badges%rowtype;
begin
  if p_badge_name is null then return null; end if;
  select * into v_badge from public.badges where name = p_badge_name;
  if v_badge.id is null then return null; end if;

  insert into public.player_badges (player_id, badge_id)
  values (p_player_id, v_badge.id)
  on conflict do nothing;
  if not found then return null; end if;   -- déjà possédé

  insert into public.events (type, player_id, payload)
  values ('badge', p_player_id, jsonb_build_object(
    'message', p_pseudo || ' a débloqué le badge « ' || v_badge.name || ' »',
    'badge',   v_badge.name,
    'icon',    v_badge.icon));
  return v_badge.name;
end;
$function$
;

create or replace function public._code_secret_tirage()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  -- 100 mots de musique et de Douala (DOMAF Quest), tous de 6 lettres au maximum (contrainte des 12
  -- caractères, PARTIE 0). Sans accents et sans lettre ambiguë : le
  -- code se lit à voix haute au stand d'aide, et se retape à une main
  -- sur un téléphone. Les chiffres et les lettres ne se mélangent
  -- jamais — pas de confusion possible entre O et 0, ni entre I et 1.
  select w.mot || '-' || lpad(floor(random() * 100000)::text, 5, '0')
  from (
    select t.mot from unnest(array[
      'KORA','BALAFO','DJEMBE','NGOMA','MVET','SANZA','TAMTAM','CONGA','BONGO','GONG',
      'MAKOSA','ASSIKO','ESSEWE','KWASSA','DECALE','AFRO','RUMBA','ZOUK','SALSA','REGGAE',
      'JAZZ','SOUL','FUNK','BLUES','GOSPEL','DISCO','TECHNO','HOUSE','ROCK','PUNK',
      'METAL','INDIE','RAP','GROOVE','SWING','BEAT','REMIX','RIFF','LOOP','TEMPO',
      'RYTHME','ACCORD','GAMME','NOTE','SOLO','DUO','TRIO','CHOEUR','CHANT','VOIX',
      'MICRO','SCENE','LIVE','SHOW','BRAVO','RAPPEL','ALBUM','VINYLE','DISQUE','TUBE',
      'PIANO','ORGUE','VIOLON','HARPE','FLUTE','SAXO','TUBA','CUIVRE','BASSE','CAISSE',
      'AMPLI','CASQUE','SONO','ECHO','ONDE','NEON','LASER','FIESTA','DANSE','RAGGA',
      'WOURI','AKWA','DEIDO','BALI','MBOA','SAWA','KOLA','NDOLE','BRAISE','DOMAF',
      'LION','AIGLE','COBRA','ZEBRE','LUNE','ETOILE','SOLEIL','FLAMME','IDOLE','STAR'
    ]) as t(mot)
    order by random()
    limit 1
  ) w;
$function$
;

create or replace function public._gen_qr_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code  text;
  v_i     int;
  v_tries int := 0;
begin
  loop
    v_code := 'DQ-';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from public.qr_codes where code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 50 then raise exception 'CODE_GENERATION'; end if;
  end loop;
  return v_code;
end;
$function$
;

create or replace function public._is_system_badge(p_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select p_name in ('Première note', 'Curieux', 'Fouineur', 'Autographe',
                    'Jury', 'Oreille d''or', 'Lève-tôt', 'Noctambule', 'Marathonien', 'Podium');
$function$
;

create or replace function public._maj_xp_jour()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_hausse integer := greatest(new.xp - old.xp, 0);
begin
  if old.jour <> public.jour_jeu() then

    -- ⬇️ LE SEUL AJOUT (2026-08-13). On est au dernier instant où les
    -- points de `old.jour` existent encore. `on conflict do nothing`
    -- fait deux choses d'un coup : il laisse la main au GM (s'il a
    -- appuyé sur CLOTURE, sa ligne est déjà là et fait foi), et il
    -- rend l'écriture insensible à deux joueurs qui gagneraient de
    -- l'XP dans la même milliseconde.
    begin
      insert into public.tournament_kings (jour, pseudo, points)
      select old.jour, p.pseudo, p.xp_jour
        from public.players p
       where p.status = 'actif'
         and p.jour    = old.jour
         and p.xp_jour > 0            -- personne n'est sacré à 0 point
       order by p.xp_jour desc, p.created_at asc
       limit 1
      on conflict (jour) do nothing;
    exception when others then
      null;   -- graver le roi ne vaut JAMAIS de faire échouer un scan
    end;

    new.xp_jour := v_hausse;
  else
    new.xp_jour := old.xp_jour + v_hausse;
  end if;
  new.jour := public.jour_jeu();
  return new;
end;
$function$
;

create or replace function public._norm_answer(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select regexp_replace(
    translate(lower(coalesce(p, '')),
      'àâäáãåéèêëíìîïóòôöõúùûüýÿçñ',
      'aaaaaaeeeeiiiiooooouuuuyycn'),
    '[^a-z0-9]', '', 'g');
$function$
;

create or replace function public._norm_ticket(p_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$function$
;

create or replace function public._points_jour(p_xp_jour integer, p_jour date)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case when p_jour = public.jour_jeu() then p_xp_jour else 0 end;
$function$
;

create or replace function public._ticket_code()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$function$
;

create or replace function public.admin_award_badge(p_player_id uuid, p_badge_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players%rowtype;
  v_badge  public.badges%rowtype;
  v_result text;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then raise exception 'JOUEUR_INCONNU'; end if;
  if v_player.status <> 'actif' then raise exception 'JOUEUR_EXCLU'; end if;

  select * into v_badge from public.badges where id = p_badge_id;
  if v_badge.id is null then raise exception 'BADGE_INCONNU'; end if;
  if exists (select 1 from public.player_badges
             where player_id = p_player_id and badge_id = p_badge_id) then
    raise exception 'BADGE_DEJA_POSSEDE';
  end if;

  v_result := public._award_badge(p_player_id, v_player.pseudo, v_badge.name);
  return json_build_object('player', v_player.pseudo, 'badge', v_result);
end;
$function$
;

create or replace function public.admin_create_announcement(p_message text, p_type text DEFAULT 'info'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.announcements%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_message is null or char_length(trim(p_message)) = 0 then raise exception 'MESSAGE_VIDE'; end if;
  if p_type not in ('info','alerte','succes','danger') then raise exception 'TYPE_INVALIDE'; end if;

  insert into public.announcements (message, type)
  values (trim(p_message), p_type)
  returning * into v_row;
  return row_to_json(v_row);
end;
$function$
;

create or replace function public.admin_create_prize(p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean DEFAULT true, p_kind text DEFAULT 'objet'::text, p_value integer DEFAULT 0, p_badge_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p public.roulette_prizes%rowtype; v_kind text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if p_name is null or char_length(trim(p_name)) = 0 then raise exception 'NOM_MANQUANT'; end if;
  v_kind := coalesce(nullif(trim(coalesce(p_kind,'')),''), 'objet');
  if v_kind not in ('objet','xp','jetons','badge','rien') then raise exception 'GENRE_INCONNU'; end if;
  if v_kind = 'badge' and p_badge_id is null then raise exception 'BADGE_MANQUANT'; end if;

  insert into public.roulette_prizes (name, icon, weight, stock, active, kind, value, badge_id)
  values (trim(p_name), coalesce(nullif(trim(coalesce(p_icon,'')),''),'cadeau'),
          greatest(0, coalesce(p_weight,10)), p_stock, coalesce(p_active,true),
          v_kind, greatest(0, coalesce(p_value,0)),
          case when v_kind = 'badge' then p_badge_id else null end)
  returning * into v_p;
  return row_to_json(v_p);
end;
$function$
;

create or replace function public.admin_create_quiz_question(p_session_id uuid, p_question text, p_choices jsonb, p_correct integer, p_duration integer DEFAULT 20)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_q public.quiz_questions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if not exists (select 1 from public.quiz_sessions where id = p_session_id) then
    raise exception 'QUIZ_INCONNU';
  end if;
  if coalesce(trim(p_question), '') = '' then raise exception 'QUESTION_MANQUANTE'; end if;
  if jsonb_typeof(p_choices) <> 'array'
     or jsonb_array_length(p_choices) < 2
     or jsonb_array_length(p_choices) > 4 then
    raise exception 'CHOIX_INVALIDES';
  end if;
  if p_correct is null or p_correct < 0 or p_correct >= jsonb_array_length(p_choices) then
    raise exception 'BONNE_REPONSE_INVALIDE';
  end if;
  if p_duration is null or p_duration < 5 or p_duration > 120 then
    raise exception 'DUREE_INVALIDE';
  end if;

  insert into public.quiz_questions
    (session_id, question, choices, correct_index, question_order, duration_seconds)
  values (p_session_id, trim(p_question), p_choices, p_correct,
    coalesce((select max(question_order) from public.quiz_questions
              where session_id = p_session_id), 0) + 1,
    p_duration)
  returning * into v_q;
  return row_to_json(v_q);
end;
$function$
;

create or replace function public.admin_create_quiz_session(p_title text, p_kind text DEFAULT 'quiz'::text, p_boss_name text DEFAULT NULL::text, p_boss_image text DEFAULT NULL::text, p_boss_hp integer DEFAULT 0, p_bonus_xp integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'TITRE_MANQUANT'; end if;
  if p_kind not in ('quiz', 'raid') then raise exception 'TYPE_INVALIDE'; end if;

  if p_kind = 'raid' then
    if coalesce(trim(p_boss_name), '') = '' then raise exception 'BOSS_MANQUANT'; end if;
    if p_boss_hp is null or p_boss_hp < 1 or p_boss_hp > 100000000 then
      raise exception 'PV_INVALIDES';
    end if;
    if p_bonus_xp is null or p_bonus_xp < 0 or p_bonus_xp > 10000 then
      raise exception 'BONUS_INVALIDE';
    end if;
  end if;

  insert into public.quiz_sessions (title, kind, boss_name, boss_image, boss_hp_max, raid_bonus_xp)
  values (trim(p_title), p_kind,
    case when p_kind = 'raid' then trim(p_boss_name) end,
    case when p_kind = 'raid' then nullif(trim(p_boss_image), '') end,
    case when p_kind = 'raid' then p_boss_hp else 0 end,
    case when p_kind = 'raid' then p_bonus_xp else 0 end)
  returning * into v_session;
  return row_to_json(v_session);
end;
$function$
;

create or replace function public.admin_delete_announcement(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  delete from public.announcements where id = p_id;
end;
$function$
;

create or replace function public.admin_delete_prize(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  delete from public.roulette_prizes where id = p_id;
end;
$function$
;

create or replace function public.admin_delete_quiz_question(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_q public.quiz_questions%rowtype;
  v_status text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_q from public.quiz_questions where id = p_id;
  if v_q.id is null then raise exception 'QUESTION_INCONNUE'; end if;
  select status into v_status from public.quiz_sessions where id = v_q.session_id;
  if v_status <> 'preparee' then raise exception 'QUESTION_VERROUILLEE'; end if;

  delete from public.quiz_questions where id = p_id;
  update public.quiz_questions
     set question_order = question_order - 1
   where session_id = v_q.session_id and question_order > v_q.question_order;
end;
$function$
;

create or replace function public.admin_delete_quiz_session(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if exists (select 1 from public.quiz_answers a
             join public.quiz_questions q on q.id = a.question_id
             where q.session_id = p_id) then
    raise exception 'QUIZ_VERROUILLE';
  end if;
  delete from public.quiz_sessions where id = p_id;
end;
$function$
;

create or replace function public.admin_duplicate_quiz_session(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_src public.quiz_sessions%rowtype;
  v_new public.quiz_sessions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_src from public.quiz_sessions where id = p_session_id;
  if v_src.id is null then raise exception 'QUIZ_INCONNU'; end if;

  -- La copie : neuve, en préparation, jamais lancée. On ne copie
  -- QUE le contenu (titre, boss) — pas le statut, ni les réponses.
  insert into public.quiz_sessions
    (title, kind, boss_name, boss_image, boss_hp_max, raid_bonus_xp)
  values
    (v_src.title || ' (copie)', v_src.kind,
     v_src.boss_name, v_src.boss_image, v_src.boss_hp_max, v_src.raid_bonus_xp)
  returning * into v_new;

  -- Les questions recopiées à l'identique (énoncé, choix, bonne
  -- réponse, ordre, durée), reliées à la nouvelle session.
  insert into public.quiz_questions
    (session_id, question, choices, correct_index, question_order, duration_seconds,
     categorie, reponse, anecdote, audio_url, audio_debut, pochette_url)
  select v_new.id, question, choices, correct_index, question_order, duration_seconds,
     categorie, reponse, anecdote, audio_url, audio_debut, pochette_url
  from public.quiz_questions
  where session_id = v_src.id;

  return row_to_json(v_new);
end;
$function$
;

create or replace function public.admin_journal_bonus(p_jour date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_jour date := coalesce(p_jour, public.jour_jeu());
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  return coalesce((
    select json_agg(row_to_json(t)) from (
      select e.created_at                                   as quand,
             coalesce(e.payload->>'par', 'Game Master')     as par,
             coalesce(e.payload->>'par_role', 'gm')         as role,
             p.pseudo                                       as joueur,
             coalesce((e.payload->>'xp')::int, 0)           as xp,
             e.payload->>'reason'                           as motif
        from public.events e
        left join public.players p on p.id = e.player_id
       where e.type = 'bonus'
         and public.jour_de(e.created_at) = v_jour
       order by e.created_at desc
       limit 300
    ) t), '[]'::json);
end;
$function$
;

create or replace function public.admin_list_quiz_questions(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((select json_agg(row_to_json(q) order by q.question_order) from (
    select qq.id, qq.question_order, qq.question, qq.choices,
           qq.correct_index, qq.duration_seconds,
           qq.categorie, qq.reponse, qq.anecdote,
           qq.audio_url, qq.audio_debut, qq.pochette_url,
      (select count(*) from public.quiz_answers where question_id = qq.id) as answers
    from public.quiz_questions qq
    where qq.session_id = p_session_id
  ) q), '[]'::json);
end;
$function$
;

create or replace function public.admin_list_quiz_sessions()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((select json_agg(row_to_json(s) order by s.created_at desc) from (
    select qs.id, qs.title, qs.status, qs.current_question, qs.created_at,
      qs.kind, qs.boss_name, qs.boss_image, qs.boss_hp_max, qs.raid_bonus_xp,
      (select count(*) from public.quiz_questions where session_id = qs.id) as questions,
      (select count(distinct a.player_id)
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        where q.session_id = qs.id) as participants,
      case when qs.kind = 'raid' then public._raid_damage(qs.id) end as damage
    from public.quiz_sessions qs
  ) s), '[]'::json);
end;
$function$
;

create or replace function public.admin_manual_quests(p_player_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Inchangé : is_equipe() laisse passer un vendeur (§15.5, fichier 26).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((
    select json_agg(row_to_json(t)) from (
      -- ⬇️ CHANGEMENT 1/2 : `q.description`, la consigne à faire respecter.
      select q.id, q.title, q.description, q.xp_reward,
             (select b.name from public.badges b where b.id = q.badge_id) as badge,
             p.completed_at
      from public.quests q
      left join public.quest_progress p
        on p.quest_id = q.id and p.player_id = p_player_id and p.jour = public.jour_jeu()
      where q.counter = 'manuel' and q.active = true
      -- ⬇️ CHANGEMENT 2/2 : le même ordre que sur le téléphone du joueur
      --    (player_home, fichier 48). Avant : order by q.created_at
      order by q.priorite desc, q.created_at
    ) t
  ), '[]'::json);
end;
$function$
;

create or replace function public.admin_move_quiz_question(p_id uuid, p_direction text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_q       public.quiz_questions%rowtype;
  v_voisine public.quiz_questions%rowtype;
  v_status  text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if p_direction not in ('haut', 'bas') then raise exception 'DIRECTION_INVALIDE'; end if;

  select * into v_q from public.quiz_questions where id = p_id;
  if v_q.id is null then raise exception 'QUESTION_INCONNUE'; end if;

  select status into v_status from public.quiz_sessions where id = v_q.session_id;
  if v_status <> 'preparee' then raise exception 'QUIZ_DEJA_LANCE'; end if;

  -- Ceinture ET bretelles : un quiz « preparee » où des réponses
  -- existent ne devrait pas exister, mais si ça arrivait, déplacer
  -- les questions décalerait des points déjà versés.
  if exists (select 1 from public.quiz_answers a
             join public.quiz_questions q on q.id = a.question_id
             where q.session_id = v_q.session_id) then
    raise exception 'QUIZ_VERROUILLE';
  end if;

  -- La voisine immédiate dans la direction demandée
  if p_direction = 'haut' then
    select * into v_voisine from public.quiz_questions
    where session_id = v_q.session_id and question_order < v_q.question_order
    order by question_order desc limit 1;
  else
    select * into v_voisine from public.quiz_questions
    where session_id = v_q.session_id and question_order > v_q.question_order
    order by question_order asc limit 1;
  end if;

  -- Déjà tout en haut / tout en bas : ce n'est pas une erreur,
  -- la console ne montre simplement pas le bouton. On ne fait rien.
  if v_voisine.id is null then return row_to_json(v_q); end if;

  update public.quiz_questions set question_order = v_q.question_order
  where id = v_voisine.id;
  update public.quiz_questions set question_order = v_voisine.question_order
  where id = v_q.id
  returning * into v_q;

  return row_to_json(v_q);
end;
$function$
;

create or replace function public.admin_quiz_live(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_elapsed numeric;
  v_damage  int;
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_session from public.quiz_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;

  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
    end if;
  end if;

  if v_session.kind = 'raid' then
    v_damage := public._raid_damage(v_session.id);
  end if;

  return json_build_object(
    'session', row_to_json(v_session),
    'total_questions', (select count(*) from public.quiz_questions
                        where session_id = v_session.id),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'damage', v_damage,
      'hp_left', greatest(0, v_session.boss_hp_max - v_damage),
      'defeated', v_damage >= v_session.boss_hp_max) end,

    'question', case when v_q.id is null then null else json_build_object(
      'id', v_q.id, 'question', v_q.question, 'choices', v_q.choices,
      'categorie', v_q.categorie, 'reponse', v_q.reponse, 'anecdote', v_q.anecdote,
      'audio_url', v_q.audio_url, 'audio_debut', v_q.audio_debut,
      'pochette_url', v_q.pochette_url,
      'correct_index', v_q.correct_index,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms', round(v_elapsed * 1000),
      'answers_count', (select count(*) from public.quiz_answers
                        where question_id = v_q.id),
      'correct_count', (select count(*) from public.quiz_answers
                        where question_id = v_q.id and is_correct),
      'distribution', (select coalesce(json_agg(n order by idx), '[]'::json) from (
        select gs.idx, count(a.id)::int as n
        from generate_series(0, jsonb_array_length(v_q.choices) - 1) gs(idx)
        left join public.quiz_answers a
          on a.question_id = v_q.id and a.answer_index = gs.idx
        group by gs.idx) d)) end,

    'top', coalesce((select json_agg(row_to_json(t)) from (
      select p.pseudo, sum(a.points)::int as points
      from public.quiz_answers a
      join public.quiz_questions q on q.id = a.question_id
      join public.players p on p.id = a.player_id
      where q.session_id = v_session.id
      group by p.id, p.pseudo
      order by sum(a.points) desc, max(a.answered_at) asc
      limit 5) t), '[]'::json));
end;
$function$
;

create or replace function public.admin_quiz_next(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_total   int;
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_session from public.quiz_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;
  if v_session.status <> 'en_cours' then raise exception 'QUIZ_INACTIF'; end if;

  select count(*) into v_total from public.quiz_questions where session_id = p_session_id;
  if v_session.current_question >= v_total then raise exception 'PLUS_DE_QUESTIONS'; end if;

  update public.quiz_sessions
     set current_question = current_question + 1, question_started_at = now()
   where id = p_session_id
  returning * into v_session;
  -- Signal de l'écran géant (temps réel sur game_state) : il relit quiz_board
  update public.game_state set updated_at = now() where id = 1;
  return row_to_json(v_session);
end;
$function$
;

create or replace function public.admin_quiz_start(p_session_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_phase   text;
begin
  -- ⬇️ LA SEULE LIGNE MODIFIÉE : is_staff() devient is_equipe(),
  --    donc un vendeur passe (secours du 2026-08-16).
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_session from public.quiz_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;
  if not exists (select 1 from public.quiz_questions where session_id = p_session_id) then
    raise exception 'QUIZ_VIDE';
  end if;

  -- Une seule session en cours à la fois
  update public.quiz_sessions set status = 'terminee'
  where status = 'en_cours' and id <> p_session_id;

  update public.quiz_sessions
     set status = 'en_cours', current_question = 0, question_started_at = null
   where id = p_session_id
  returning * into v_session;

  -- Quiz → phase QUIZ ; blind test (raid) → phase RAID (missions en pause)
  v_phase := case when v_session.kind = 'raid' then 'RAID' else 'QUIZ' end;
  update public.game_state set phase = v_phase, updated_at = now() where id = 1;
  insert into public.events (type, payload)
  values ('phase', jsonb_build_object(
    'message', case when v_session.kind = 'raid'
      then 'BLIND TEST — « ' || v_session.boss_name
        || ' » monte sur scène ! Tous sur vos téléphones !'
      else 'Le grand quiz commence — tous sur vos téléphones !' end,
    'phase', v_phase));

  return row_to_json(v_session);
end;
$function$
;

create or replace function public.admin_recent_spins(p_limit integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  return coalesce((
    select json_agg(row_to_json(t)) from (
      select s.id, s.redeem_code, s.created_at, s.redeemed_at,
             p.pseudo, pr.name as prize_name, pr.icon as prize_icon
      from public.roulette_spins s
      join public.players p on p.id = s.player_id
      left join public.roulette_prizes pr on pr.id = s.prize_id
      where s.redeem_code is not null
      order by s.created_at desc limit greatest(1, coalesce(p_limit,30))
    ) t
  ), '[]'::json);
end;
$function$
;

create or replace function public.admin_redeem(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_spin public.roulette_spins%rowtype; v_prize public.roulette_prizes%rowtype; v_player public.players%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_spin from public.roulette_spins where redeem_code = upper(trim(p_code));
  if v_spin.id is null then raise exception 'BON_INCONNU'; end if;
  if v_spin.redeemed_at is not null then raise exception 'DEJA_RETIRE'; end if;

  update public.roulette_spins set redeemed_at = now(), redeemed_by = auth.uid() where id = v_spin.id;
  select * into v_prize from public.roulette_prizes where id = v_spin.prize_id;
  select * into v_player from public.players where id = v_spin.player_id;
  return json_build_object('prize', v_prize.name, 'player', v_player.pseudo);
end;
$function$
;

create or replace function public.admin_rename_player(p_player_id uuid, p_pseudo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_player public.players%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  p_pseudo := trim(p_pseudo);
  if p_pseudo is null or char_length(p_pseudo) < 2 or char_length(p_pseudo) > 16 then
    raise exception 'PSEUDO_INVALIDE';
  end if;
  if exists (select 1 from public.players
             where lower(pseudo) = lower(p_pseudo) and id <> p_player_id) then
    raise exception 'PSEUDO_DEJA_PRIS';
  end if;

  update public.players set pseudo = p_pseudo
  where id = p_player_id and efface_le is null returning * into v_player;
  if v_player.id is null then raise exception 'JOUEUR_INCONNU'; end if;
  return row_to_json(v_player);
end;
$function$
;

create or replace function public.admin_rename_quiz_session(p_id uuid, p_title text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_session from public.quiz_sessions where id = p_id;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;

  -- Le titre s'affiche sur l'écran géant ET sur tous les téléphones.
  -- Le changer en pleine partie ferait clignoter le nom de l'épreuve
  -- sous les yeux de tout le jardin : on l'interdit.
  if v_session.status <> 'preparee' then raise exception 'QUIZ_DEJA_LANCE'; end if;

  -- Volontairement TITRE_VIDE et non TITRE_MANQUANT : ce dernier est
  -- déjà traduit par « Donne un titre à la quête » côté console.
  if coalesce(trim(p_title), '') = '' then raise exception 'TITRE_VIDE'; end if;
  if char_length(trim(p_title)) > 80 then raise exception 'TITRE_TROP_LONG'; end if;

  update public.quiz_sessions set title = trim(p_title)
  where id = p_id
  returning * into v_session;
  return row_to_json(v_session);
end;
$function$
;

create or replace function public.admin_set_phase(p_phase text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state public.game_state%rowtype;
  v_roi   record;
  v_jour  date := public.jour_jeu();   -- UNE fois (voir _classement)
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if p_phase not in ('EXPLORATION','QUIZ','RAID','CLOTURE') then
    raise exception 'PHASE_INVALIDE';
  end if;

  if p_phase = 'CLOTURE' then
    select p.pseudo, p.xp_jour as points
      into v_roi
      from public.players p
      where p.status = 'actif' and p.jour = v_jour and p.xp_jour > 0
      order by p.xp_jour desc, p.created_at asc
      limit 1;
    if v_roi.points is not null and v_roi.points > 0 then
      insert into public.tournament_kings (jour, pseudo, points)
      values (v_jour, v_roi.pseudo, v_roi.points)
      on conflict (jour) do update
        set pseudo = excluded.pseudo, points = excluded.points, decided_at = now();
    end if;
    for v_roi in
      select p.id, p.pseudo from public.players p
      where p.status = 'actif' and p.jour = v_jour and p.xp_jour > 0
      order by p.xp_jour desc, p.created_at asc
      limit 3
    loop
      perform public._award_badge(v_roi.id, v_roi.pseudo, 'Podium');
    end loop;
  end if;

  update public.game_state
     set phase = p_phase, updated_at = now()
   where id = 1
  returning * into v_state;

  -- Trace pour l'écran géant et le journal
  insert into public.events (type, payload)
  values ('phase', jsonb_build_object(
    'message', case p_phase
      when 'EXPLORATION' then 'Retour à l''exploration libre — toutes les quêtes sont ouvertes !'
      when 'QUIZ'        then 'Le grand quiz commence — tous sur vos téléphones !'
      when 'RAID'        then 'BLIND TEST — les missions sont en pause, tout le monde joue ensemble !'
      else                    'Le jeu est terminé — place au podium !'
    end,
    'phase', p_phase));

  return row_to_json(v_state);
end;
$function$
;

create or replace function public.admin_set_roulette_cost(p_cost integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if p_cost is null or p_cost < 1 or p_cost > 100000 then raise exception 'COUT_INVALIDE'; end if;
  update public.game_state set roulette_cost = p_cost where id = 1;
end;
$function$
;

create or replace function public.admin_set_status(p_player_id uuid, p_status text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_status not in ('actif', 'exclu') then raise exception 'STATUT_INVALIDE'; end if;

  update public.players set status = p_status
  where id = p_player_id and efface_le is null
  returning * into v_player;
  if v_player.id is null then raise exception 'JOUEUR_INCONNU'; end if;

  insert into public.events (type, player_id, payload)
  values ('kill_switch', p_player_id, jsonb_build_object(
    'message', case when p_status = 'exclu'
                    then v_player.pseudo || ' a été exclu du jeu par le Game Master'
                    else v_player.pseudo || ' a été réintégré dans le jeu' end,
    'status', p_status));

  return row_to_json(v_player);
end;
$function$
;

create or replace function public.admin_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v json;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  select json_build_object(
    'players_total',    (select count(*) from public.players),
    'players_active',   (select count(*) from public.players where status = 'actif'),
    'players_engaged',  (select count(distinct player_id) from public.scans),
    'players_excluded', (select count(*) from public.players where status = 'exclu'),
    'xp_total',         (select coalesce(sum(xp), 0) from public.players),
    'scans_total',      (select count(*) from public.scans),
    'qr_total',         (select count(*) from public.qr_codes),
    'qr_active',        (select count(*) from public.qr_codes where active),
    'quests_active',    (select count(*) from public.quests where active),
    'badges_awarded',   (select count(*) from public.player_badges),
    'announcements_total', (select count(*) from public.announcements),
    'quests_by_type',   (select json_object_agg(type, n) from (
                           select type, count(*) as n from public.quests group by type
                         ) q)
  ) into v;
  return v;
end;
$function$
;

create or replace function public.admin_update_prize(p_id uuid, p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean, p_kind text DEFAULT 'objet'::text, p_value integer DEFAULT 0, p_badge_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p public.roulette_prizes%rowtype; v_kind text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  v_kind := coalesce(nullif(trim(coalesce(p_kind,'')),''), 'objet');
  if v_kind not in ('objet','xp','jetons','badge','rien') then raise exception 'GENRE_INCONNU'; end if;
  if v_kind = 'badge' and p_badge_id is null then raise exception 'BADGE_MANQUANT'; end if;

  update public.roulette_prizes set
    name = trim(p_name), icon = coalesce(nullif(trim(coalesce(p_icon,'')),''),'cadeau'),
    weight = greatest(0, coalesce(p_weight,10)), stock = p_stock, active = coalesce(p_active,true),
    kind = v_kind, value = greatest(0, coalesce(p_value,0)),
    badge_id = case when v_kind = 'badge' then p_badge_id else null end
  where id = p_id returning * into v_p;
  if v_p.id is null then raise exception 'LOT_INCONNU'; end if;
  return row_to_json(v_p);
end;
$function$
;

create or replace function public.admin_update_quiz_question(p_id uuid, p_question text, p_choices jsonb, p_correct integer, p_duration integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_q public.quiz_questions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if exists (select 1 from public.quiz_answers where question_id = p_id) then
    raise exception 'QUESTION_VERROUILLEE';
  end if;
  if coalesce(trim(p_question), '') = '' then raise exception 'QUESTION_MANQUANTE'; end if;
  if jsonb_typeof(p_choices) <> 'array'
     or jsonb_array_length(p_choices) < 2
     or jsonb_array_length(p_choices) > 4 then
    raise exception 'CHOIX_INVALIDES';
  end if;
  if p_correct is null or p_correct < 0 or p_correct >= jsonb_array_length(p_choices) then
    raise exception 'BONNE_REPONSE_INVALIDE';
  end if;
  if p_duration is null or p_duration < 5 or p_duration > 120 then
    raise exception 'DUREE_INVALIDE';
  end if;

  update public.quiz_questions set
    question = trim(p_question), choices = p_choices,
    correct_index = p_correct, duration_seconds = p_duration
  where id = p_id
  returning * into v_q;
  if v_q.id is null then raise exception 'QUESTION_INCONNUE'; end if;
  return row_to_json(v_q);
end;
$function$
;

create or replace function public.admin_update_raid_params(p_session_id uuid, p_boss_name text, p_boss_image text, p_boss_hp integer, p_bonus_xp integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.quiz_sessions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  select * into v_session from public.quiz_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;
  if v_session.kind <> 'raid' then raise exception 'PAS_UN_RAID'; end if;
  if v_session.status = 'terminee' then raise exception 'RAID_TERMINE'; end if;

  if coalesce(trim(p_boss_name), '') = '' then raise exception 'BOSS_MANQUANT'; end if;
  if p_boss_hp is null or p_boss_hp < 1 or p_boss_hp > 100000000 then
    raise exception 'PV_INVALIDES';
  end if;
  if p_bonus_xp is null or p_bonus_xp < 0 or p_bonus_xp > 10000 then
    raise exception 'BONUS_INVALIDE';
  end if;

  update public.quiz_sessions set
    boss_name = trim(p_boss_name),
    boss_image = nullif(trim(p_boss_image), ''),
    boss_hp_max = p_boss_hp,
    raid_bonus_xp = p_bonus_xp
  where id = p_session_id
  returning * into v_session;
  return row_to_json(v_session);
end;
$function$
;

create or replace function public.admin_validate_quest(p_player_id uuid, p_quest_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player    public.players%rowtype;
  v_quest     public.quests%rowtype;
  v_prog      public.quest_progress%rowtype;
  v_old_level int;
  v_badge     text;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_quest from public.quests where id = p_quest_id;
  if v_quest.id is null then raise exception 'QUETE_INCONNUE'; end if;
  if v_quest.counter <> 'manuel' then raise exception 'QUETE_NON_MANUELLE'; end if;
  if not v_quest.active then raise exception 'QUETE_INACTIVE'; end if;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then raise exception 'JOUEUR_INCONNU'; end if;
  if v_player.status <> 'actif' then raise exception 'JOUEUR_EXCLU'; end if;

  -- Anti-double : une quête staff ne se valide qu'UNE fois par jour.
  select * into v_prog from public.quest_progress
   where player_id = p_player_id and quest_id = p_quest_id and jour = public.jour_jeu()
   for update;
  if v_prog.completed_at is not null then raise exception 'QUETE_DEJA_VALIDEE'; end if;

  insert into public.quest_progress (player_id, quest_id, progress, completed_at, jour)
  values (p_player_id, p_quest_id, v_quest.goal_count, now(), public.jour_jeu())
  on conflict (player_id, quest_id, jour) do update
    set progress = excluded.progress, completed_at = excluded.completed_at;

  -- Récompense (même mécanique que le Bonus GM : l'XP ne baisse jamais)
  v_old_level := public.level_for_xp(v_player.xp);
  update public.players set
    xp     = xp + v_quest.xp_reward,
    jetons = jetons + v_quest.xp_reward / 10,
    level  = public.level_for_xp(xp + v_quest.xp_reward),
    rank   = public.rank_for_level(public.level_for_xp(xp + v_quest.xp_reward))
  where id = p_player_id
  returning * into v_player;

  if v_quest.badge_id is not null then
    v_badge := public._award_badge(p_player_id, v_player.pseudo,
                 (select name from public.badges where id = v_quest.badge_id));
  end if;

  insert into public.events (type, player_id, payload)
  values ('quete', p_player_id, jsonb_build_object(
    'message', v_player.pseudo || ' a terminé la mission « ' || v_quest.title || ' » (+' || v_quest.xp_reward || ' XP)',
    'quest', v_quest.title, 'xp', v_quest.xp_reward));

  if v_player.level > v_old_level then
    insert into public.events (type, player_id, payload)
    values ('level_up', p_player_id, jsonb_build_object(
      'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level', v_player.level, 'old_level', v_old_level));
  end if;

  return json_build_object(
    'player', row_to_json(v_player),
    'quest',  v_quest.title,
    'xp',     v_quest.xp_reward,
    'badge',  v_badge);
end;
$function$
;

create or replace function public.billetterie_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prix integer;
  v_out  json;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select prix_journee into v_prix from public.billetterie_config where id = 1;

  select json_build_object(
    'prix',    v_prix,
    'jour',    public.jour_jeu(),
    'total',   json_build_object(
      'carnets',  (select count(*) from public.carnets),
      'remis',    (select coalesce(sum(nb_tickets), 0) from public.carnets),
      'rendus',   (select coalesce(sum(rendus), 0) from public.carnets),
      'rendus_reels',
                  (select count(*) from public.tickets where rendu_le is not null),
      'libres',   (select count(*) from public.tickets k
                    join public.carnets c on c.id = k.carnet_id
                   where k.utilise_par is null and k.rendu_le is null and c.actif),
      'actives',  (select count(*) from public.tickets where utilise_par is not null),
      'actives_aujourdhui',
                  (select count(*) from public.tickets where jour = public.jour_jeu()),
      'du',       (select coalesce(sum(nb_tickets - rendus), 0) * v_prix from public.carnets),
      -- ⬇️ l'argent déjà rentré, prouvé par des tickets activés
      'encaisse', (select count(*) from public.tickets where utilise_par is not null) * v_prix,
      'encaisse_jour',
                  (select count(*) from public.tickets where jour = public.jour_jeu()) * v_prix,
      -- ⬇️ le papier encore dans les mains des vendeurs
      'en_main',  greatest(
                    (select coalesce(sum(nb_tickets - rendus), 0) from public.carnets)
                  - (select count(*) from public.tickets where utilise_par is not null), 0)
    ),
    'vendeurs', coalesce((
      select json_agg(t order by t.vendeur_nom) from (
        select c.vendeur_nom,
               count(*)                                          as carnets,
               coalesce(sum(c.nb_tickets), 0)                    as remis,
               coalesce(sum(c.rendus), 0)                        as rendus,
               coalesce(sum(k.actives), 0)                       as actives,
               coalesce(sum(c.nb_tickets - c.rendus), 0) * v_prix as du,
               -- ⬇️ les trois nouveaux
               coalesce(sum(k.actives_jour), 0)                  as actives_aujourdhui,
               greatest(coalesce(sum(c.nb_tickets - c.rendus), 0)
                      - coalesce(sum(k.actives), 0), 0)          as en_main,
               coalesce(sum(k.actives), 0) * v_prix              as encaisse,
               coalesce(sum(k.actives_jour), 0) * v_prix         as encaisse_jour
        from public.carnets c
        left join lateral (
          select count(*) filter (where t2.utilise_par is not null)   as actives,
                 count(*) filter (where t2.jour = public.jour_jeu())       as actives_jour
          from public.tickets t2 where t2.carnet_id = c.id
        ) k on true
        group by c.vendeur_nom
      ) t), '[]'::json),
    'carnets', coalesce((
      select json_agg(t order by t.numero) from (
        select c.numero, c.vendeur_nom, c.nb_tickets, c.rendus, c.actif,
               (c.nb_tickets - c.rendus) * v_prix as du,
               (select count(*) from public.tickets k
                 where k.carnet_id = c.id and k.utilise_par is not null) as actives
        from public.carnets c
      ) t), '[]'::json)
  ) into v_out;

  return v_out;
end;
$function$
;

create or replace function public.carnet_attribuer(p_carnet_id uuid, p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user   uuid;
  v_carnet public.carnets%rowtype;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select id into v_user from auth.users where lower(email) = lower(trim(coalesce(p_email, '')));
  if v_user is null then raise exception 'COMPTE_INCONNU'; end if;
  if not exists (select 1 from public.staff where user_id = v_user) then
    raise exception 'PAS_DANS_LE_STAFF';
  end if;

  update public.carnets set vendeur_user = v_user where id = p_carnet_id
  returning * into v_carnet;
  if v_carnet.id is null then raise exception 'CARNET_INCONNU'; end if;

  return row_to_json(v_carnet);
end;
$function$
;

create or replace function public.carnet_creer(p_vendeur_nom text, p_nb_tickets integer, p_note text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carnet public.carnets%rowtype;
  v_numero integer;
  v_code   text;
  v_tries  integer;
  i        integer;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  p_vendeur_nom := trim(coalesce(p_vendeur_nom, ''));
  if char_length(p_vendeur_nom) < 2 then raise exception 'VENDEUR_MANQUANT'; end if;
  if p_nb_tickets is null or p_nb_tickets < 1 or p_nb_tickets > 500 then
    raise exception 'NOMBRE_INVALIDE';
  end if;

  select coalesce(max(numero), 0) + 1 into v_numero from public.carnets;

  insert into public.carnets (numero, vendeur_nom, nb_tickets, note, cree_par)
  values (v_numero, p_vendeur_nom, p_nb_tickets, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning * into v_carnet;

  for i in 1..p_nb_tickets loop
    v_tries := 0;
    loop
      v_code := public._ticket_code();
      exit when not exists (select 1 from public.tickets where code = v_code);
      v_tries := v_tries + 1;
      if v_tries > 50 then raise exception 'CODE_GENERATION'; end if;
    end loop;
    insert into public.tickets (carnet_id, code, rang) values (v_carnet.id, v_code, i);
  end loop;

  return json_build_object(
    'carnet', row_to_json(v_carnet),
    'tickets', (select coalesce(json_agg(json_build_object('rang', rang, 'code', code)
                                         order by rang), '[]'::json)
                from public.tickets where carnet_id = v_carnet.id)
  );
end;
$function$
;

create or replace function public.carnet_etat(p_carnet_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role   text;
  v_carnet public.carnets%rowtype;
  v_prix   integer;
begin
  v_role := public.staff_role();
  if v_role is null or v_role not in ('gm','vendeur') then raise exception 'ACCES_REFUSE'; end if;

  select * into v_carnet from public.carnets where id = p_carnet_id;
  if v_carnet.id is null then raise exception 'CARNET_INCONNU'; end if;
  if v_role = 'vendeur' and v_carnet.vendeur_user is distinct from auth.uid() then
    raise exception 'ACCES_REFUSE';
  end if;

  select prix_journee into v_prix from public.billetterie_config where id = 1;

  return json_build_object(
    'carnet',  row_to_json(v_carnet),
    'prix',    v_prix,
    'du',      (v_carnet.nb_tickets - v_carnet.rendus) * v_prix,
    'tickets', (select coalesce(json_agg(json_build_object(
                          'rang',     k.rang,
                          'code',     k.code,
                          'utilise',  k.utilise_par is not null,
                          'jour',     k.jour,
                          'rendu_le', k.rendu_le,
                          -- L'ordre des tests EST la règle : « utilisé »
                          -- l'emporte sur tout, « annulé » ne vient qu'en
                          -- dernier (un carnet désactivé n'efface pas les
                          -- journées déjà payées).
                          'etat', case
                                    when k.utilise_par is not null then 'utilise'
                                    when k.rendu_le    is not null then 'rendu'
                                    when not v_carnet.actif        then 'annule'
                                    else 'libre'
                                  end
                        ) order by k.rang), '[]'::json)
                from public.tickets k where k.carnet_id = v_carnet.id)
  );
end;
$function$
;

create or replace function public.carnet_liste()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text;
  v_prix integer;
  v_out  json;
begin
  v_role := public.staff_role();
  if v_role is null or v_role not in ('gm','vendeur') then raise exception 'ACCES_REFUSE'; end if;

  select prix_journee into v_prix from public.billetterie_config where id = 1;

  select json_build_object(
    'role',    v_role,
    'prix',    v_prix,
    'carnets', coalesce((
      select json_agg(t order by t.numero) from (
        select c.id, c.numero, c.vendeur_nom, c.nb_tickets, c.rendus, c.actif,
               c.note, c.cree_le,
               (select count(*) from public.tickets k
                 where k.carnet_id = c.id and k.utilise_par is not null)          as actives,
               (select count(*) from public.tickets k
                 where k.carnet_id = c.id and k.jour = public.jour_jeu())              as actives_aujourdhui,
               -- ⬇️ les deux nouveaux
               (select count(*) from public.tickets k
                 where k.carnet_id = c.id and k.rendu_le is not null)             as rendus_reels,
               (select count(*) from public.tickets k
                 where k.carnet_id = c.id
                   and k.utilise_par is null and k.rendu_le is null)              as libres,
               (c.nb_tickets - c.rendus) * v_prix                                 as du
        from public.carnets c
        where v_role = 'gm' or c.vendeur_user = auth.uid()
      ) t), '[]'::json)
  ) into v_out;

  return v_out;
end;
$function$
;

create or replace function public.carnet_pointer(p_carnet_id uuid, p_rendus integer DEFAULT NULL::integer, p_actif boolean DEFAULT NULL::boolean, p_note text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carnet     public.carnets%rowtype;
  v_neutralises integer;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_carnet from public.carnets where id = p_carnet_id;
  if v_carnet.id is null then raise exception 'CARNET_INCONNU'; end if;

  if p_rendus is not null then
    if p_rendus < 0 or p_rendus > v_carnet.nb_tickets then raise exception 'RENDUS_INVALIDE'; end if;

    if p_rendus > v_carnet.nb_tickets - (select count(*) from public.tickets
                                         where carnet_id = v_carnet.id and utilise_par is not null) then
      raise exception 'RENDUS_SUPERIEUR_AUX_INVENDUS';
    end if;

    select count(*) into v_neutralises from public.tickets
     where carnet_id = v_carnet.id and rendu_le is not null;
    if p_rendus < v_neutralises then
      raise exception 'RENDUS_INFERIEUR_AUX_IDENTIFIES';
    end if;
  end if;

  update public.carnets set
    rendus = coalesce(p_rendus, rendus),
    actif  = coalesce(p_actif,  actif),
    note   = coalesce(nullif(trim(coalesce(p_note, '')), ''), note)
  where id = p_carnet_id
  returning * into v_carnet;

  return row_to_json(v_carnet);
end;
$function$
;

create or replace function public.carnet_rendre(p_carnet_id uuid, p_codes text[] DEFAULT NULL::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carnet public.carnets%rowtype;
  v_n      integer;      -- rendus par CET appel
  v_total  integer;      -- rendus en tout sur le carnet
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_carnet from public.carnets where id = p_carnet_id;
  if v_carnet.id is null then raise exception 'CARNET_INCONNU'; end if;

  update public.tickets
     set rendu_le = now()
   where carnet_id   = p_carnet_id
     and utilise_par is null          -- déjà activé = payé, on n'y touche pas
     and rendu_le    is null          -- déjà rendu = on ne redate pas
     and (p_codes is null
          or code in (select public._norm_ticket(saisi.brut)
                        from unnest(p_codes) as saisi(brut)));
  get diagnostics v_n = row_count;

  -- La colonne « rendus » du carnet reste LA RÉFÉRENCE DE L'ARGENT
  -- (elle sert au calcul du dû). On la recale sur ce qui est
  -- réellement neutralisé : les deux chiffres ne doivent jamais
  -- pouvoir se contredire dans le dos du Game Master.
  select count(*) into v_total
    from public.tickets where carnet_id = p_carnet_id and rendu_le is not null;

  update public.carnets set rendus = v_total where id = p_carnet_id
  returning * into v_carnet;

  return json_build_object(
    'rendus_maintenant', v_n,
    'rendus_total',      v_total,
    'carnet',            row_to_json(v_carnet)
  );
end;
$function$
;

create or replace function public.carnet_reprendre(p_carnet_id uuid, p_codes text[] DEFAULT NULL::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_carnet public.carnets%rowtype;
  v_n      integer;
  v_total  integer;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_carnet from public.carnets where id = p_carnet_id;
  if v_carnet.id is null then raise exception 'CARNET_INCONNU'; end if;

  update public.tickets
     set rendu_le = null
   where carnet_id = p_carnet_id
     and rendu_le is not null
     and (p_codes is null
          or code in (select public._norm_ticket(saisi.brut)
                        from unnest(p_codes) as saisi(brut)));
  get diagnostics v_n = row_count;

  select count(*) into v_total
    from public.tickets where carnet_id = p_carnet_id and rendu_le is not null;

  update public.carnets set rendus = v_total where id = p_carnet_id
  returning * into v_carnet;

  return json_build_object(
    'reprises',     v_n,
    'rendus_total', v_total,
    'carnet',       row_to_json(v_carnet)
  );
end;
$function$
;

create or replace function public.create_player(p_pseudo text, p_archetype text, p_ticket text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players;
  v_code   text;
  -- ⬇️ CHANGEMENT 1 : le tableau `v_words` a disparu, il vit
  -- maintenant dans _code_secret_tirage() (PARTIE 1).
  v_tries  int := 0;
  v_mur    boolean;
  v_tcode  text;
  v_ticket public.tickets%rowtype;
  v_etat   text;
begin
  p_pseudo := trim(p_pseudo);

  if p_pseudo is null or char_length(p_pseudo) < 2 or char_length(p_pseudo) > 16 then
    raise exception 'PSEUDO_INVALIDE';
  end if;
  if p_archetype is null or char_length(p_archetype) = 0 then
    raise exception 'ARCHETYPE_MANQUANT';
  end if;

  v_mur := coalesce((select actif from public.billetterie_config where id = 1), false);
  if v_mur then
    v_tcode := public._norm_ticket(p_ticket);
    if v_tcode is null or v_tcode = '' then
      raise exception 'TICKET_REQUIS';
    end if;
  end if;

  if exists (select 1 from public.players where lower(pseudo) = lower(p_pseudo)) then
    raise exception 'PSEUDO_DEJA_PRIS';
  end if;

  -- Rattrapage de la ruée d'inscription (fichier 54) : deux personnes
  -- qui tapent le même pseudo dans la même seconde passent toutes les
  -- deux la vérification ci-dessus. La seconde doit lire la vraie
  -- raison, pas « Une erreur est survenue ».
  begin
    insert into public.players (pseudo, archetype)
    values (p_pseudo, p_archetype)
    returning * into v_player;
  exception when unique_violation then
    raise exception 'PSEUDO_DEJA_PRIS';
  end;

  loop
    -- ⬇️ CHANGEMENT 2 : le tirage passe par la fonction dédiée.
    v_code := public._code_secret_tirage();
    exit when not exists (select 1 from public.player_secrets where secret_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 50 then raise exception 'CODE_GENERATION'; end if;
  end loop;

  insert into public.player_secrets (player_id, secret_code)
  values (v_player.id, v_code);

  if v_mur then
    update public.tickets t
       set utilise_par = v_player.id,
           utilise_le  = now(),
           jour        = public.jour_jeu()
      from public.carnets c
     where c.id = t.carnet_id
       and t.code = v_tcode
       and t.utilise_par is null
       and t.rendu_le is null
       and c.actif
    returning t.* into v_ticket;

    if v_ticket.id is null then
      select * into v_ticket from public.tickets where code = v_tcode;
      if v_ticket.id is null then
        v_etat := 'INCONNU';
      elsif v_ticket.utilise_par is not null then
        v_etat := 'UTILISE';
      elsif v_ticket.rendu_le is not null then
        v_etat := 'RENDU';
      else
        v_etat := 'ANNULE';
      end if;
      raise exception 'TICKET_%', v_etat;
    end if;
  end if;

  return json_build_object(
    'player',      row_to_json(v_player),
    'secret_code', v_code
  );
end;
$function$
;

create or replace function public.is_equipe()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.staff where user_id = auth.uid());
$function$
;

create or replace function public.is_gm()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'gm');
$function$
;

create or replace function public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.staff
                  where user_id = auth.uid() and role in ('gm','staff'));
$function$
;

create or replace function public.is_vendeur()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'vendeur');
$function$
;

create or replace function public.jour_festival_label(p_jour date DEFAULT public.jour_jeu())
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case p_jour
    when date '2026-11-26' then 'jeudi'
    when date '2026-11-27' then 'vendredi'
    when date '2026-11-28' then 'samedi'
    when date '2026-11-29' then 'dimanche'
    else to_char(p_jour, 'DD/MM')
  end;
$function$
;

create or replace function public.leaderboard_view(p_player_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me json := null;
begin
  if p_player_id is not null then
    select json_build_object(
      'position', (select count(*) + 1 from public.players x
                   where public._points_jour(x.xp_jour, x.jour) > public._points_jour(p.xp_jour, p.jour)),
      'points_jour', public._points_jour(p.xp_jour, p.jour),
      'player',   row_to_json(p))
    into v_me
    from public.players p where p.id = p_player_id;
  end if;

  return json_build_object(
    'jour', public.jour_jeu(),
    'jour_label', public.jour_festival_label(),
    'roi_veille', public.roi_veille(),
    'players', coalesce((select json_agg(row_to_json(t)) from (
      select id, pseudo, archetype, xp, level,
             public._points_jour(xp_jour, jour) as points_jour
      from public.players
      where status = 'actif'
      order by public._points_jour(xp_jour, jour) desc, created_at asc
      limit 50) t), '[]'::json),
    'me', v_me,
    'total', (select count(*) from public.players where status = 'actif'));
end;
$function$
;

create or replace function public.level_for_xp(p_xp integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  v_level int := 1;
  v_rest  int := coalesce(p_xp, 0);
begin
  while v_rest >= (200 + v_level * 50) loop
    v_rest  := v_rest - (200 + v_level * 50);
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$function$
;

create or replace function public.live_board()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'jour', public.jour_jeu(),
    'jour_label', public.jour_festival_label(),
    'roi_veille', public.roi_veille(),
    'players', coalesce((select json_agg(row_to_json(t)) from (
      select id, pseudo, archetype, xp, level,
             public._points_jour(xp_jour, jour) as points_jour
      from public.players
      where status = 'actif'
      order by public._points_jour(xp_jour, jour) desc, created_at asc limit 10) t), '[]'::json),

    'stats', json_build_object(
      'players_total', (select count(*) from public.players where status = 'actif'),
      'xp_total',      (select coalesce(sum(xp), 0) from public.players where status = 'actif'),
      'scans_total',   (select count(*) from public.scans)),

    'winners', coalesce((select json_agg(row_to_json(w)) from (
      select e.type, e.payload, e.created_at,
             (select json_build_object('pseudo', p.pseudo, 'archetype', p.archetype)
              from public.players p where p.id = e.player_id) as players
      from public.events e
      -- 'roulette' ← AJOUT DU 37. La roulette n'écrit un événement que
      -- pour un objet ou un badge (fichier 36) : le journal ne risque
      -- donc pas d'être noyé par les gains d'XP et de jetons.
      where e.type in ('badge','level_up','quete','bonus','roulette')
         or (e.type = 'scan' and coalesce(e.payload->>'qr_type','') <> 'stand')
      order by e.created_at desc limit 8) w), '[]'::json),

    'announcements', coalesce((select json_agg(row_to_json(a)) from (
      select message, type, created_at
      from public.announcements
      order by created_at desc limit 6) a), '[]'::json));
$function$
;

create or replace function public.live_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'players_total', (select count(*) from public.players where status = 'actif'),
    'xp_total',      (select coalesce(sum(xp), 0) from public.players where status = 'actif'),
    'scans_total',   (select count(*) from public.scans)
  );
$function$
;

create or replace function public.login_with_code(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_code));

  if v_player.id is null then
    raise exception 'CODE_INCONNU';
  end if;
  if v_player.status = 'exclu' then
    raise exception 'JOUEUR_EXCLU';
  end if;

  return row_to_json(v_player);
end;
$function$
;

create or replace function public.mon_acces()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_staff public.staff%rowtype;
begin
  select * into v_staff from public.staff where user_id = auth.uid();
  if v_staff.user_id is null then
    return json_build_object('membre', false);
  end if;

  return json_build_object(
    'membre',   true,
    'nom',      v_staff.display_name,
    'role',     v_staff.role,
    'console',  v_staff.role in ('gm','staff'),   -- la console actuelle
    'gm',       v_staff.role = 'gm',              -- carnets, recette, tarif
    'vendeur',  v_staff.role = 'vendeur',         -- la page allégée
    'accueil',  case when v_staff.role = 'vendeur'
                     then 'vendeur.html' else 'index.html' end
  );
end;
$function$
;

create or replace function public.pass_actif(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when not coalesce((select actif from public.billetterie_config where id = 1), false)
      then true
    else exists (select 1 from public.tickets
                 where utilise_par = p_player_id and jour = public.jour_jeu())
  end;
$function$
;

create or replace function public.pass_etat(p_secret_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players%rowtype;
  v_cfg    public.billetterie_config%rowtype;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  select * into v_cfg from public.billetterie_config where id = 1;

  return json_build_object(
    'actif',       public.pass_actif(v_player.id),
    'jour',        public.jour_jeu(),
    'billetterie', coalesce(v_cfg.actif, false),
    'prix',        coalesce(v_cfg.prix_journee, 500),
    'message',     coalesce(v_cfg.message, ''),
    -- Les journées déjà payées : de quoi écrire « tu as joué samedi ».
    'jours',       (select coalesce(json_agg(distinct jour order by jour), '[]'::json)
                    from public.tickets where utilise_par = v_player.id and jour is not null)
  );
end;
$function$
;

create or replace function public.pass_garde()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- On ne s'intéresse QU'À l'augmentation d'XP. Un joueur sans ticket
  -- peut toujours être renommé, exclu, réintégré, dépenser ses jetons,
  -- voir sa carte : §15.4 ne ferme que le gain.
  if new.xp is null or old.xp is null or new.xp <= old.xp then
    return new;
  end if;

  -- La porte de secours du GM (partie 2). Le drapeau est posé pour la
  -- durée d'UNE transaction seulement : impossible de le laisser
  -- ouvert par mégarde.
  if coalesce(current_setting('dq.pass_bypass', true), '') = '1' then
    return new;
  end if;

  -- pass_actif() répond « oui » à tout le monde quand la billetterie
  -- est coupée : l'interrupteur du fichier 25 rouvre donc aussi cette
  -- garde, sans rien avoir à défaire ici.
  if not public.pass_actif(new.id) then
    raise exception 'PASS_REQUIS';
  end if;

  return new;
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

create or replace function public.profil_public_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n     integer;
  v_seuil constant integer := 10;
begin
  select count(*) into v_n from public.player_profile
  where tranche_age is not null or quartier is not null or genre_prefere is not null;

  if v_n < v_seuil then
    return json_build_object('pret', false, 'repondants', v_n, 'seuil', v_seuil);
  end if;

  return json_build_object(
    'pret',       true,
    'repondants', v_n,
    'quartier', (select coalesce(json_agg(t), '[]'::json) from (
        select quartier as valeur, count(*) as n,
               round(100.0 * count(*) / nullif(sum(count(*)) over (), 0)) as pct
        from public.player_profile where quartier is not null
        group by 1 order by 2 desc limit 5) t),
    'genre', (select coalesce(json_agg(t), '[]'::json) from (
        select genre_prefere as valeur, count(*) as n,
               round(100.0 * count(*) / nullif(sum(count(*)) over (), 0)) as pct
        from public.player_profile where genre_prefere is not null
        group by 1 order by 2 desc limit 5) t),
    'age', (select coalesce(json_agg(t), '[]'::json) from (
        select tranche_age as valeur, count(*) as n,
               round(100.0 * count(*) / nullif(sum(count(*)) over (), 0)) as pct
        from public.player_profile where tranche_age is not null
        group by 1 order by 1) t)
  );
end;
$function$
;

create or replace function public.profil_valeurs(p_champ text)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select array(
    select jsonb_array_elements(
             (public.profil_options()::jsonb) -> p_champ
           ) ->> 'valeur'
  );
$function$
;

create or replace function public.rank_for_level(p_level integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    -- Paliers DOMAF, calés sur les visuels (0 / 500 / 1 500 / 3 500 / 7 000 XP)
    -- via level_for_xp : niv. 3 = 550 XP, 6 = 1 750, 10 = 4 050, 14 = 7 150.
    when p_level >= 14 then 'Tête d''affiche'
    when p_level >= 10 then 'Backstage'
    when p_level >= 6  then 'Groupie'
    when p_level >= 3  then 'Fan'
    else 'Spectateur'
  end;
$function$
;

create or replace function public.roi_veille()
 RETURNS json
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select json_build_object('jour', jour, 'jour_label', public.jour_festival_label(jour),
                              'pseudo', pseudo, 'points', points)
    from public.tournament_kings
    where jour < public.jour_jeu()
    order by jour desc limit 1
  ), 'null'::json);
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

create or replace function public.spin_roulette(p_secret_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player  public.players%rowtype;
  v_cost    integer := 30;
  v_total   integer;
  v_pick    integer;
  v_acc     integer := 0;
  v_prize   public.roulette_prizes%rowtype;
  v_redeem  text := null;
  v_updated integer;
  v_kind    text;
  v_gain_xp integer := 0;
  v_gain_je integer := 0;
  v_badge   public.badges%rowtype;
  v_deja    boolean := false;
  v_old_lvl integer;
  v_max     integer;
  v_tirages integer;
  r         record;
begin
  -- Qui joue ?
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  -- Mur payant (§15.4). C'est aussi ce qui rend légitime l'écriture
  -- d'XP plus bas : sans pass actif, on ne serait jamais arrivé ici.
  if not public.pass_actif(v_player.id) then raise exception 'PASS_REQUIS'; end if;

  -- Coût configurable par l'admin
  select coalesce(roulette_cost, 30), coalesce(roulette_max_jour, 0) into v_cost, v_max
  from public.game_state where id = 1;

  -- Débit ATOMIQUE : la condition "jetons >= coût" est DANS le update.
  update public.players set jetons = jetons - v_cost
  where id = v_player.id and jetons >= v_cost
  returning * into v_player;
  if v_player.id is null then raise exception 'JETONS_INSUFFISANTS'; end if;

  select count(*) into v_tirages from public.roulette_spins
  where player_id = v_player.id and created_at >= public._debut_jour_jeu();
  if v_max > 0 and v_tirages >= v_max then raise exception 'PLAFOND_JOUR'; end if;

  -- Tirage pondéré parmi les lots actifs encore en stock
  select coalesce(sum(weight), 0) into v_total
  from public.roulette_prizes where active and (stock is null or stock > 0);

  if v_total = 0 then
    insert into public.roulette_spins (player_id, prize_id, cost) values (v_player.id, null, v_cost);
    return json_build_object('prize', null, 'jetons_restants', v_player.jetons, 'cost', v_cost);
  end if;

  v_pick := floor(random() * v_total);
  for r in
    select * from public.roulette_prizes
    where active and (stock is null or stock > 0) order by created_at
  loop
    v_acc := v_acc + r.weight;
    if v_pick < v_acc then v_prize := r; exit; end if;
  end loop;

  -- Stock limité : décrément CONDITIONNEL. Si un tirage simultané a
  -- raflé la dernière unité, v_updated = 0 → "rien", jamais un lot
  -- fantôme. (Un lot en XP ou en jetons se laisse en stock vide :
  -- il n'y a rien à épuiser.)
  if v_prize.stock is not null then
    update public.roulette_prizes set stock = stock - 1
    where id = v_prize.id and stock > 0;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      insert into public.roulette_spins (player_id, prize_id, cost) values (v_player.id, null, v_cost);
      return json_build_object('prize', null, 'jetons_restants', v_player.jetons, 'cost', v_cost);
    end if;
  end if;

  -- Le genre du lot. Le `ilike 'rien%'` reste en filet : si un lot est
  -- créé à la main en base sans passer par la console, un nom qui
  -- commence par "rien" vaut toujours case vide.
  v_kind := coalesce(v_prize.kind, 'objet');
  if v_prize.name ilike 'rien%' then v_kind := 'rien'; end if;

  -- ---------- La case vide : rien à verser, rien à retirer ----------
  if v_kind = 'rien' then
    insert into public.roulette_spins (player_id, prize_id, cost) values (v_player.id, v_prize.id, v_cost);
    return json_build_object(
      'prize', json_build_object('id', v_prize.id, 'name', v_prize.name, 'icon', v_prize.icon,
                                 'kind', 'rien', 'value', 0, 'redeem', null),
      'jetons_restants', v_player.jetons, 'cost', v_cost);
  end if;

  -- ---------- Les gains qui ne coûtent rien ----------
  if v_kind = 'xp'     then v_gain_xp := greatest(0, coalesce(v_prize.value, 0)); end if;
  if v_kind = 'jetons' then v_gain_je := greatest(0, coalesce(v_prize.value, 0)); end if;

  if v_kind = 'badge' then
    -- Le badge d'abord. `on conflict do nothing` : un badge ne se gagne
    -- qu'une fois (clé primaire player_id+badge_id), et retomber dessus
    -- ne doit pas faire échouer le tour.
    insert into public.player_badges (player_id, badge_id)
    values (v_player.id, v_prize.badge_id)
    on conflict do nothing;
    get diagnostics v_updated = row_count;
    v_deja := (v_updated = 0);
    select * into v_badge from public.badges where id = v_prize.badge_id;
    -- Le bonus d'XP tombe dans tous les cas : c'est lui qui garantit
    -- qu'un joueur déjà titulaire du badge ne repart pas bredouille.
    v_gain_xp := greatest(0, coalesce(v_prize.value, 0));
  end if;

  -- Versement. L'XP recalcule niveau ET rang, exactement comme un scan
  -- (03_scan.sql) — sinon un joueur pourrait dépasser un palier sans
  -- que son rang bouge. En revanche, PAS de jetons automatiques au
  -- dixième de l'XP : ici les jetons sont une dépense qu'on ne
  -- rembourse pas en douce.
  if v_gain_xp > 0 or v_gain_je > 0 then
    v_old_lvl := public.level_for_xp(v_player.xp);
    update public.players
    set xp     = xp + v_gain_xp,
        jetons = jetons + v_gain_je,
        level  = public.level_for_xp(xp + v_gain_xp),
        rank   = public.rank_for_level(public.level_for_xp(xp + v_gain_xp))
    where id = v_player.id
    returning * into v_player;

    if v_player.level > v_old_lvl then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level));
    end if;
  end if;

  -- ---------- L'objet physique : le seul à donner un bon ----------
  if v_kind = 'objet' then
    v_redeem := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  end if;

  insert into public.roulette_spins (player_id, prize_id, cost, redeem_code)
  values (v_player.id, v_prize.id, v_cost, v_redeem);

  -- Écran géant : on n'y annonce que le remarquable. Un objet et un
  -- badge, oui. Les XP et les jetons, non : ils vont tomber toutes les
  -- trente secondes et noieraient le mur sous la roulette.
  if v_kind in ('objet','badge') then
    insert into public.events (type, player_id, payload)
    values ('roulette', v_player.id, jsonb_build_object(
      'message', v_player.pseudo || ' a gagné « ' || v_prize.name || ' » à la roulette',
      'prize', v_prize.name, 'icon', v_prize.icon,
      -- 'kind' ← AJOUT DU 37. C'est lui qui dit à l'écran géant s'il
      -- doit sortir la grande carte et la fanfare (objet, à retirer au
      -- stand) ou se contenter du journal et d'un son bref (badge).
      'kind', v_kind));
  end if;

  return json_build_object(
    'prize', json_build_object(
      'id',     v_prize.id,
      'name',   v_prize.name,
      'icon',   v_prize.icon,
      'kind',   v_kind,
      'value',  greatest(v_gain_xp, v_gain_je),
      'xp',     v_gain_xp,
      'jetons', v_gain_je,
      'badge',  case when v_badge.id is null then null
                     else json_build_object('name', v_badge.name, 'icon', v_badge.icon) end,
      'deja',   v_deja,
      'redeem', v_redeem),
    'jetons_restants', v_player.jetons,
    'xp', v_player.xp, 'level', v_player.level, 'rank', v_player.rank,
    'cost', v_cost);
end;
$function$
;

create or replace function public.staff_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.staff where user_id = auth.uid();
$function$
;

create or replace function public.stats_parcours()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_out json;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  with
  -- LE JOURNAL D'ACTIVITÉ. Une ligne par geste de jeu, quel qu'il
  -- soit. `player_id is not null` écarte les événements collectifs
  -- (phases, ouverture du raid) : ils n'appartiennent à personne.
  actions as (
    select e.player_id, e.created_at, public.jour_de(e.created_at) as jour
    from public.events e
    where e.player_id is not null
  ),

  jours_joues_l as (select distinct jour from actions),
  jours_num as (select jour, row_number() over (order by jour) as n from jours_joues_l),

  -- Un « passage » = un joueur, un jour.
  passages as (
    select player_id, jour,
           count(*)                                                      as actions,
           extract(epoch from (max(created_at) - min(created_at))) / 60.0 as minutes
    from actions
    group by player_id, jour
  ),
  passages_mesures as (select * from passages where actions >= 2),

  -- Reste sur `scans` : ce panneau compte des QR, pas des gestes.
  scans_par_joueur as (
    select p.id as player_id,
           coalesce((select count(*) from public.scans s where s.player_id = p.id), 0) as n
    from public.players p
  )

  select json_build_object(

    'jours', coalesce((
      select json_agg(t order by t.jour) from (
        select j.jour,
               (select count(distinct a.player_id) from actions a where a.jour = j.jour) as joueurs,
               -- « scans » garde son sens de toujours : des QR scannés.
               (select count(*) from public.scans s where s.day = j.jour)                as scans,
               (select count(*) from actions a where a.jour = j.jour)                    as actions,
               (select count(*) from public.tickets k where k.jour = j.jour)             as journees_vendues
        from jours_joues_l j
      ) t), '[]'::json),

    -- LE RETOUR AU LENDEMAIN — corrigé. Le joueur revenu pour le seul
    -- raid du dimanche compte enfin.
    'retours', coalesce((
      select json_agg(t order by t.rang) from (
        select a.n as rang, a.jour as jour1, b.jour as jour2,
               (select count(distinct x.player_id) from actions x where x.jour = a.jour) as presents,
               (select count(*) from (
                  select x1.player_id from actions x1 where x1.jour = a.jour
                  intersect
                  select x2.player_id from actions x2 where x2.jour = b.jour
                ) y) as revenus
        from jours_num a
        join jours_num b on b.n = a.n + 1
      ) t), '[]'::json),

    -- LES HEURES D'ATTENTION — du premier au dernier GESTE, pas du
    -- premier au dernier scan. Un joueur qui finit sa soirée au raid
    -- voit enfin sa soirée comptée jusqu'au bout.
    'attention', (
      select json_build_object(
        'passages',        (select count(*) from passages),
        'passages_simples',(select count(*) from passages where actions = 1),
        'passages_mesures',(select count(*) from passages_mesures),
        'minutes_totales', coalesce((select round(sum(minutes))  from passages_mesures), 0),
        'minutes_moyennes',coalesce((select round(avg(minutes))  from passages_mesures), 0),
        'minutes_medianes',coalesce((select round(
                              percentile_cont(0.5) within group (order by minutes)::numeric)
                            from passages_mesures), 0),
        'par_jour', coalesce((
          select json_agg(t order by t.jour) from (
            select jour, count(*) as passages,
                   round(sum(minutes)) as minutes_totales,
                   round(avg(minutes)) as minutes_moyennes
            from passages_mesures group by jour
          ) t), '[]'::json)
      )),

    -- LA COURBE DES HEURES — en actions, donc le pic du raid s'y voit.
    -- « at time zone 'Africa/Douala' » : la base stocke en UTC, le
    -- festival se vit à UTC+1.
    'heures', coalesce((
      select json_agg(t order by t.heure) from (
        select extract(hour from (a.created_at at time zone 'Africa/Douala'))::int as heure,
               count(*)                       as scans,   -- nom gardé : l'écran le lit
               count(distinct a.player_id)    as joueurs
        from actions a
        group by 1
      ) t), '[]'::json),

    -- RESTE SUR LES SCANS : ce panneau compte des QR.
    'profondeur', coalesce((
      select json_agg(t order by t.rang) from (
        select 0 as rang, 'Aucun scan' as tranche, count(*) as n from scans_par_joueur where n = 0
        union all
        select 1, '1 scan',            count(*) from scans_par_joueur where n = 1
        union all
        select 2, '2 à 4 scans',       count(*) from scans_par_joueur where n between 2 and 4
        union all
        select 3, '5 à 9 scans',       count(*) from scans_par_joueur where n between 5 and 9
        union all
        select 4, '10 scans ou plus',  count(*) from scans_par_joueur where n >= 10
      ) t), '[]'::json),

    -- RESTE SUR LES SCANS : c'est le trafic par QR.
    'qr', coalesce((
      select json_agg(t order by t.scans desc) from (
        select q.label, q.type,
               count(*)                    as scans,
               count(distinct s.player_id) as joueurs
        from public.scans s
        join public.qr_codes q on q.id = s.qr_code_id
        group by q.id, q.label, q.type
        order by count(*) desc
        limit 25
      ) t), '[]'::json)

  ) into v_out;

  return v_out;
end;
$function$
;

create or replace function public.ticket_utiliser(p_secret_code text, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player public.players%rowtype;
  v_cfg    public.billetterie_config%rowtype;
  v_ticket public.tickets%rowtype;
  v_code   text;
  v_etat   text;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select * into v_cfg from public.billetterie_config where id = 1;

  if not coalesce(v_cfg.actif, false) then
    return json_build_object('ok', true, 'gratuit', true, 'jour', public.jour_jeu());
  end if;

  if exists (select 1 from public.tickets
             where utilise_par = v_player.id and jour = public.jour_jeu()) then
    return json_build_object('ok', true, 'deja', true, 'jour', public.jour_jeu());
  end if;

  v_code := public._norm_ticket(p_code);

  update public.tickets t
     set utilise_par = v_player.id,
         utilise_le  = now(),
         jour        = public.jour_jeu()
    from public.carnets c
   where c.id = t.carnet_id
     and t.code = v_code
     and t.utilise_par is null
     and t.rendu_le is null                       -- ⬅️ AJOUT
     and c.actif
  returning t.* into v_ticket;

  if v_ticket.id is null then
    select * into v_ticket from public.tickets where code = v_code;
    if v_ticket.id is null then
      v_etat := 'INCONNU';
    elsif v_ticket.utilise_par is not null then
      v_etat := 'UTILISE';
    elsif v_ticket.rendu_le is not null then      -- ⬅️ AJOUT
      v_etat := 'RENDU';
    else
      v_etat := 'ANNULE';
    end if;
    raise exception 'TICKET_%', v_etat;
  end if;

  return json_build_object(
    'ok',   true,
    'jour', v_ticket.jour,
    'prix', coalesce(v_cfg.prix_journee, 500)
  );
end;
$function$
;

create or replace function public.ticket_verifier(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cfg    public.billetterie_config%rowtype;
  v_ticket public.tickets%rowtype;
  v_actif  boolean;
  v_etat   text;
begin
  select * into v_cfg from public.billetterie_config where id = 1;

  select * into v_ticket from public.tickets where code = public._norm_ticket(p_code);
  if v_ticket.id is null then
    v_etat := 'inconnu';
  elsif v_ticket.utilise_par is not null then
    v_etat := 'utilise';
  elsif v_ticket.rendu_le is not null then          -- ⬅️ AJOUT
    v_etat := 'rendu';
  else
    select c.actif into v_actif from public.carnets c where c.id = v_ticket.carnet_id;
    v_etat := case when v_actif then 'libre' else 'annule' end;
  end if;

  return json_build_object(
    'etat',        v_etat,                       -- libre | utilise | rendu | annule | inconnu
    'valide',      v_etat = 'libre',
    'jour',        v_ticket.jour,
    'prix',        coalesce(v_cfg.prix_journee, 500),
    'billetterie', coalesce(v_cfg.actif, false),
    'message',     coalesce(v_cfg.message, '')
  );
end;
$function$
;

create or replace function public.vendeur_award_bonus(p_player_id uuid, p_xp integer, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_player    public.players%rowtype;
  v_old_level int;
  v_qui       text;
  v_role      text;
begin
  -- ⬇️ DIFFÉRENCE 1 : is_equipe() et non is_staff(). Un vendeur passe,
  --    le staff et le GM aussi (fichier 26). Un compte inconnu, non.
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;

  -- Qui donne. On le lit MAINTENANT pour l'écrire dans le journal :
  -- si ce compte est supprimé après le festival, la trace reste
  -- lisible (un nom, pas un identifiant technique).
  select s.display_name, s.role into v_qui, v_role
    from public.staff s where s.user_id = auth.uid();
  v_qui := coalesce(nullif(trim(v_qui), ''), 'Un membre de l''équipe');

  -- ⬇️ DIFFÉRENCE 2 : aucun malus. Le GM peut retirer de l'XP, pas le
  --    vendeur. Le plafond de 100 000 est le même que celui du GM :
  --    ce n'est pas une limite de jeu, c'est un garde-fou contre la
  --    faute de frappe monumentale.
  if p_xp is null or p_xp <= 0 or p_xp > 100000 then
    raise exception 'BONUS_INVALIDE';
  end if;

  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null     then raise exception 'JOUEUR_INCONNU'; end if;
  -- ⬇️ DIFFÉRENCE 3 : un joueur exclu ne se récompense pas.
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  v_old_level := public.level_for_xp(v_player.xp);

  -- ⬇️ DIFFÉRENCE 4 : PAS de `set_config('dq.pass_bypass', …)`.
  --    Le déclencheur `pass_garde` va donc parler si le joueur n'a pas
  --    ouvert sa journée, et lever PASS_REQUIS. C'est le comportement
  --    voulu (voir l'en-tête).

  update public.players set
    xp     = xp + p_xp,
    -- Les jetons au dixième, exactement comme le bonus du GM : un
    -- bonus de 50 XP offre 5 jetons, donc un tour de roulette n'est
    -- jamais loin. C'est de l'animation, pas un cadeau supplémentaire.
    jetons = jetons + p_xp / 10,
    level  = public.level_for_xp(xp + p_xp),
    rank   = public.rank_for_level(public.level_for_xp(xp + p_xp))
  where id = p_player_id
  returning * into v_player;

  -- LE JOURNAL. Le type reste 'bonus' : il est déjà dans le filtre de
  -- `live_board()` (fichier 37) et dans `evenementRemarquable()` côté
  -- écran géant — rien d'autre à brancher, l'annonce part toute seule.
  -- Les clés `par` et `par_role` sont neuves : c'est elles qui rendent
  -- le geste nominatif.
  insert into public.events (type, player_id, payload)
  values ('bonus', p_player_id, jsonb_build_object(
    'message',  v_qui || ' récompense ' || v_player.pseudo || ' : +' || p_xp || ' XP'
                || coalesce(' — ' || nullif(trim(p_reason), ''), ''),
    'xp',       p_xp,
    'reason',   nullif(trim(p_reason), ''),
    'par',      v_qui,
    'par_role', coalesce(v_role, 'inconnu')));

  if v_player.level > v_old_level then
    insert into public.events (type, player_id, payload)
    values ('level_up', p_player_id, jsonb_build_object(
      'message',   v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level',     v_player.level,
      'old_level', v_old_level));
  end if;

  return row_to_json(v_player);
end;
$function$
;

-- ----------------------------------------------------------------------------
-- Clés étrangères
-- ----------------------------------------------------------------------------
alter table public.carnets add constraint carnets_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.carnets add constraint carnets_vendeur_user_fkey FOREIGN KEY (vendeur_user) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.events add constraint events_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
alter table public.micro_votes add constraint micro_votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.micro_votes add constraint micro_votes_question_id_fkey FOREIGN KEY (question_id) REFERENCES micro_questions(id);
alter table public.player_badges add constraint player_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE;
alter table public.player_badges add constraint player_badges_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_contact add constraint player_contact_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_profile add constraint player_profile_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.player_secrets add constraint player_secrets_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.qr_codes add constraint qr_codes_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges(id);
alter table public.qr_codes add constraint qr_codes_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE SET NULL;
alter table public.quest_progress add constraint quest_progress_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.quest_progress add constraint quest_progress_quest_id_fkey FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE;
alter table public.quests add constraint quests_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges(id);
alter table public.quiz_answers add constraint quiz_answers_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.quiz_answers add constraint quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;
alter table public.quiz_questions add constraint quiz_questions_session_id_fkey FOREIGN KEY (session_id) REFERENCES quiz_sessions(id) ON DELETE CASCADE;
alter table public.roulette_prizes add constraint roulette_prizes_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL;
alter table public.roulette_spins add constraint roulette_spins_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.roulette_spins add constraint roulette_spins_prize_id_fkey FOREIGN KEY (prize_id) REFERENCES roulette_prizes(id);
alter table public.scans add constraint scans_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
alter table public.scans add constraint scans_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE CASCADE;
alter table public.staff add constraint staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_carnet_id_fkey FOREIGN KEY (carnet_id) REFERENCES carnets(id) ON DELETE CASCADE;
alter table public.tickets add constraint tickets_utilise_par_fkey FOREIGN KEY (utilise_par) REFERENCES players(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
create INDEX events_created_idx ON public.events USING btree (created_at DESC);
create INDEX events_player_created_idx ON public.events USING btree (player_id, created_at DESC);
create INDEX micro_votes_jour ON public.micro_votes USING btree (player_id, jour);
create INDEX contact_par_numero ON public.player_contact USING btree (telephone);
create INDEX players_xp_idx ON public.players USING btree (xp DESC);
create UNIQUE INDEX scans_once_per_day ON public.scans USING btree (player_id, qr_code_id, day, creneau_id) NULLS NOT DISTINCT;
create INDEX tickets_pass ON public.tickets USING btree (utilise_par, jour);
create INDEX tickets_rendus ON public.tickets USING btree (carnet_id) WHERE (rendu_le IS NOT NULL);
create INDEX tickets_carnet ON public.tickets USING btree (carnet_id, rang);

-- ----------------------------------------------------------------------------
-- Déclencheurs (mêmes noms qu'en prod : Postgres les lance par ordre alphabétique)
-- ----------------------------------------------------------------------------
create TRIGGER pass_garde_players BEFORE UPDATE OF xp ON public.players FOR EACH ROW EXECUTE FUNCTION public.pass_garde();
create TRIGGER maj_xp_jour BEFORE UPDATE OF xp ON public.players FOR EACH ROW EXECUTE FUNCTION public._maj_xp_jour();

-- ----------------------------------------------------------------------------
-- Row Level Security : activée sur TOUTES les tables
-- ----------------------------------------------------------------------------
ALTER table public.announcements enable row level security;
ALTER table public.badges enable row level security;
ALTER table public.billetterie_config enable row level security;
ALTER table public.carnets enable row level security;
ALTER table public.coeur_config enable row level security;
ALTER table public.contact_config enable row level security;
ALTER table public.events enable row level security;
ALTER table public.game_state enable row level security;
ALTER table public.micro_config enable row level security;
ALTER table public.micro_questions enable row level security;
ALTER table public.micro_votes enable row level security;
ALTER table public.player_badges enable row level security;
ALTER table public.player_contact enable row level security;
ALTER table public.player_profile enable row level security;
ALTER table public.player_secrets enable row level security;
ALTER table public.players enable row level security;
ALTER table public.profil_config enable row level security;
ALTER table public.qr_codes enable row level security;
ALTER table public.quest_progress enable row level security;
ALTER table public.quests enable row level security;
ALTER table public.quiz_answers enable row level security;
ALTER table public.quiz_questions enable row level security;
ALTER table public.quiz_sessions enable row level security;
ALTER table public.roulette_prizes enable row level security;
ALTER table public.roulette_spins enable row level security;
ALTER table public.scans enable row level security;
ALTER table public.staff enable row level security;
ALTER table public.tickets enable row level security;
ALTER table public.tournament_kings enable row level security;

CREATE policy "lecture publique" on public.announcements as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture publique" on public.badges as PERMISSIVE for SELECT to public using (true);
CREATE policy "ecriture gm" on public.billetterie_config as PERMISSIVE for UPDATE to authenticated using (is_gm());
CREATE policy "lecture publique" on public.billetterie_config as PERMISSIVE for SELECT to public using (true);
CREATE policy "ecriture staff" on public.coeur_config as PERMISSIVE for UPDATE to authenticated using (is_staff());
CREATE policy "lecture publique" on public.coeur_config as PERMISSIVE for SELECT to public using (true);
CREATE policy "ecriture staff" on public.contact_config as PERMISSIVE for UPDATE to authenticated using (is_staff());
CREATE policy "lecture publique" on public.contact_config as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture publique" on public.events as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture publique" on public.game_state as PERMISSIVE for SELECT to public using (true);
CREATE policy "ecriture staff" on public.micro_config as PERMISSIVE for UPDATE to authenticated using (is_staff());
CREATE policy "lecture publique" on public.micro_config as PERMISSIVE for SELECT to public using (true);
CREATE policy "ecriture staff" on public.micro_questions as PERMISSIVE for ALL to authenticated using (is_staff()) with check (is_staff());
CREATE policy "lecture publique" on public.micro_questions as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture staff" on public.micro_votes as PERMISSIVE for SELECT to authenticated using (is_staff());
CREATE policy "lecture publique" on public.player_badges as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture staff" on public.player_contact as PERMISSIVE for SELECT to authenticated using (is_staff());
CREATE policy "lecture staff" on public.player_profile as PERMISSIVE for SELECT to authenticated using (is_staff());
CREATE policy "lecture publique" on public.players as PERMISSIVE for SELECT to public using (true);
CREATE policy "ecriture staff" on public.profil_config as PERMISSIVE for UPDATE to authenticated using (is_staff());
CREATE policy "lecture publique" on public.profil_config as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture staff" on public.qr_codes as PERMISSIVE for SELECT to authenticated using (is_staff());
CREATE policy "lecture publique" on public.quest_progress as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture publique" on public.quests as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture publique" on public.roulette_prizes as PERMISSIVE for SELECT to public using (true);
CREATE policy "lecture staff" on public.roulette_spins as PERMISSIVE for SELECT to authenticated using (is_staff());
CREATE policy "lecture staff" on public.scans as PERMISSIVE for SELECT to authenticated using (is_staff());
CREATE policy "staff se voit lui-meme" on public.staff as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));
CREATE policy "lecture staff" on public.tournament_kings as PERMISSIVE for SELECT to authenticated using (is_staff());

-- ----------------------------------------------------------------------------
-- Droits d'exécution des fonctions (ceux de la prod Otaku, 3 fonctions internes fermées)
-- ----------------------------------------------------------------------------
revoke all on function public._award_badge(p_player_id uuid, p_pseudo text, p_badge_name text) from public, anon, authenticated;
revoke all on function public._code_secret_tirage() from public, anon, authenticated;
revoke all on function public._gen_qr_code() from public, anon, authenticated;
revoke all on function public._is_system_badge(p_name text) from public, anon, authenticated;
grant execute on function public._maj_xp_jour() to anon, authenticated;
grant execute on function public._norm_answer(p text) to anon, authenticated;
revoke all on function public._norm_ticket(p_code text) from public, anon, authenticated;
grant execute on function public._points_jour(p_xp_jour integer, p_jour date) to anon, authenticated;
revoke all on function public._ticket_code() from public, anon, authenticated;
revoke all on function public.admin_award_badge(p_player_id uuid, p_badge_id uuid) from public, anon, authenticated;
grant execute on function public.admin_award_badge(p_player_id uuid, p_badge_id uuid) to authenticated;
revoke all on function public.admin_create_announcement(p_message text, p_type text) from public, anon, authenticated;
grant execute on function public.admin_create_announcement(p_message text, p_type text) to authenticated;
revoke all on function public.admin_create_prize(p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean, p_kind text, p_value integer, p_badge_id uuid) from public, anon, authenticated;
grant execute on function public.admin_create_prize(p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean, p_kind text, p_value integer, p_badge_id uuid) to authenticated;
revoke all on function public.admin_create_quiz_question(p_session_id uuid, p_question text, p_choices jsonb, p_correct integer, p_duration integer) from public, anon, authenticated;
grant execute on function public.admin_create_quiz_question(p_session_id uuid, p_question text, p_choices jsonb, p_correct integer, p_duration integer) to authenticated;
revoke all on function public.admin_create_quiz_session(p_title text, p_kind text, p_boss_name text, p_boss_image text, p_boss_hp integer, p_bonus_xp integer) from public, anon, authenticated;
grant execute on function public.admin_create_quiz_session(p_title text, p_kind text, p_boss_name text, p_boss_image text, p_boss_hp integer, p_bonus_xp integer) to authenticated;
revoke all on function public.admin_delete_announcement(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_announcement(p_id uuid) to authenticated;
revoke all on function public.admin_delete_prize(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_prize(p_id uuid) to authenticated;
revoke all on function public.admin_delete_quiz_question(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_quiz_question(p_id uuid) to authenticated;
revoke all on function public.admin_delete_quiz_session(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_quiz_session(p_id uuid) to authenticated;
revoke all on function public.admin_duplicate_quiz_session(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_duplicate_quiz_session(p_session_id uuid) to authenticated;
revoke all on function public.admin_journal_bonus(p_jour date) from public, anon, authenticated;
grant execute on function public.admin_journal_bonus(p_jour date) to authenticated;
revoke all on function public.admin_list_quiz_questions(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_list_quiz_questions(p_session_id uuid) to authenticated;
revoke all on function public.admin_list_quiz_sessions() from public, anon, authenticated;
grant execute on function public.admin_list_quiz_sessions() to authenticated;
revoke all on function public.admin_manual_quests(p_player_id uuid) from public, anon, authenticated;
grant execute on function public.admin_manual_quests(p_player_id uuid) to authenticated;
revoke all on function public.admin_move_quiz_question(p_id uuid, p_direction text) from public, anon, authenticated;
grant execute on function public.admin_move_quiz_question(p_id uuid, p_direction text) to authenticated;
revoke all on function public.admin_quiz_live(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_quiz_live(p_session_id uuid) to authenticated;
revoke all on function public.admin_quiz_next(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_quiz_next(p_session_id uuid) to authenticated;
revoke all on function public.admin_quiz_start(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_quiz_start(p_session_id uuid) to authenticated;
revoke all on function public.admin_recent_spins(p_limit integer) from public, anon, authenticated;
grant execute on function public.admin_recent_spins(p_limit integer) to authenticated;
revoke all on function public.admin_redeem(p_code text) from public, anon, authenticated;
grant execute on function public.admin_redeem(p_code text) to authenticated;
revoke all on function public.admin_rename_player(p_player_id uuid, p_pseudo text) from public, anon, authenticated;
grant execute on function public.admin_rename_player(p_player_id uuid, p_pseudo text) to authenticated;
revoke all on function public.admin_rename_quiz_session(p_id uuid, p_title text) from public, anon, authenticated;
grant execute on function public.admin_rename_quiz_session(p_id uuid, p_title text) to authenticated;
revoke all on function public.admin_set_phase(p_phase text) from public, anon, authenticated;
grant execute on function public.admin_set_phase(p_phase text) to authenticated;
revoke all on function public.admin_set_roulette_cost(p_cost integer) from public, anon, authenticated;
grant execute on function public.admin_set_roulette_cost(p_cost integer) to authenticated;
revoke all on function public.admin_set_status(p_player_id uuid, p_status text) from public, anon, authenticated;
grant execute on function public.admin_set_status(p_player_id uuid, p_status text) to authenticated;
revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;
revoke all on function public.admin_update_prize(p_id uuid, p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean, p_kind text, p_value integer, p_badge_id uuid) from public, anon, authenticated;
grant execute on function public.admin_update_prize(p_id uuid, p_name text, p_icon text, p_weight integer, p_stock integer, p_active boolean, p_kind text, p_value integer, p_badge_id uuid) to authenticated;
revoke all on function public.admin_update_quiz_question(p_id uuid, p_question text, p_choices jsonb, p_correct integer, p_duration integer) from public, anon, authenticated;
grant execute on function public.admin_update_quiz_question(p_id uuid, p_question text, p_choices jsonb, p_correct integer, p_duration integer) to authenticated;
revoke all on function public.admin_update_raid_params(p_session_id uuid, p_boss_name text, p_boss_image text, p_boss_hp integer, p_bonus_xp integer) from public, anon, authenticated;
grant execute on function public.admin_update_raid_params(p_session_id uuid, p_boss_name text, p_boss_image text, p_boss_hp integer, p_bonus_xp integer) to authenticated;
revoke all on function public.admin_validate_quest(p_player_id uuid, p_quest_id uuid) from public, anon, authenticated;
grant execute on function public.admin_validate_quest(p_player_id uuid, p_quest_id uuid) to authenticated;
revoke all on function public.billetterie_stats() from public, anon, authenticated;
grant execute on function public.billetterie_stats() to authenticated;
revoke all on function public.carnet_attribuer(p_carnet_id uuid, p_email text) from public, anon, authenticated;
grant execute on function public.carnet_attribuer(p_carnet_id uuid, p_email text) to authenticated;
revoke all on function public.carnet_creer(p_vendeur_nom text, p_nb_tickets integer, p_note text) from public, anon, authenticated;
grant execute on function public.carnet_creer(p_vendeur_nom text, p_nb_tickets integer, p_note text) to authenticated;
revoke all on function public.carnet_etat(p_carnet_id uuid) from public, anon, authenticated;
grant execute on function public.carnet_etat(p_carnet_id uuid) to authenticated;
revoke all on function public.carnet_liste() from public, anon, authenticated;
grant execute on function public.carnet_liste() to authenticated;
revoke all on function public.carnet_pointer(p_carnet_id uuid, p_rendus integer, p_actif boolean, p_note text) from public, anon, authenticated;
grant execute on function public.carnet_pointer(p_carnet_id uuid, p_rendus integer, p_actif boolean, p_note text) to authenticated;
revoke all on function public.carnet_rendre(p_carnet_id uuid, p_codes text[]) from public, anon, authenticated;
grant execute on function public.carnet_rendre(p_carnet_id uuid, p_codes text[]) to authenticated;
revoke all on function public.carnet_reprendre(p_carnet_id uuid, p_codes text[]) from public, anon, authenticated;
grant execute on function public.carnet_reprendre(p_carnet_id uuid, p_codes text[]) to authenticated;
grant execute on function public.create_player(p_pseudo text, p_archetype text, p_ticket text) to anon, authenticated;
grant execute on function public.is_equipe() to anon, authenticated;
grant execute on function public.is_gm() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_vendeur() to anon, authenticated;
grant execute on function public.jour_festival_label(p_jour date) to anon, authenticated;
grant execute on function public.leaderboard_view(p_player_id uuid) to anon, authenticated;
grant execute on function public.level_for_xp(p_xp integer) to anon, authenticated;
grant execute on function public.live_board() to anon, authenticated;
grant execute on function public.live_stats() to anon, authenticated;
grant execute on function public.login_with_code(p_code text) to anon, authenticated;
revoke all on function public.mon_acces() from public, anon, authenticated;
grant execute on function public.mon_acces() to authenticated;
revoke all on function public.pass_actif(p_player_id uuid) from public, anon, authenticated;
grant execute on function public.pass_etat(p_secret_code text) to anon, authenticated;
grant execute on function public.pass_garde() to anon, authenticated;
grant execute on function public.player_home(p_secret_code text) to anon, authenticated;
grant execute on function public.profil_public_stats() to anon, authenticated;
grant execute on function public.profil_valeurs(p_champ text) to anon, authenticated;
grant execute on function public.rank_for_level(p_level integer) to anon, authenticated;
grant execute on function public.roi_veille() to anon, authenticated;
grant execute on function public.scan_qr(p_secret_code text, p_code text) to anon, authenticated;
grant execute on function public.spin_roulette(p_secret_code text) to anon, authenticated;
grant execute on function public.staff_role() to anon, authenticated;
revoke all on function public.stats_parcours() from public, anon, authenticated;
grant execute on function public.stats_parcours() to authenticated;
grant execute on function public.ticket_utiliser(p_secret_code text, p_code text) to anon, authenticated;
grant execute on function public.ticket_verifier(p_code text) to anon, authenticated;
revoke all on function public.vendeur_award_bonus(p_player_id uuid, p_xp integer, p_reason text) from public, anon, authenticated;
grant execute on function public.vendeur_award_bonus(p_player_id uuid, p_xp integer, p_reason text) to authenticated;

-- ----------------------------------------------------------------------------
-- Programme et plan du festival (étape 2.6) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Écrit à la main (pas d'équivalent Otaku) ; inséré tel quel dans 00_schema.sql
-- par outils/fabriquer_schema.py.
--
--   lieux              tout ce qui figure sur le plan (scènes, stands, eau…)
--   scenes             les lieux de catégorie « scene », avec leur couleur
--   artistes           fiche artiste ; actif = false tant qu'il n'est pas annoncé
--   creneaux           un concert = un artiste, une scène, un début, une fin
--   dedicaces          séances de dédicaces
--   favoris_programme  « mon programme » d'un joueur (par créneau)
--
-- Identifiants lisibles (« soleil », « st-kora », « nova-kassa ») pour les lieux
-- et les artistes : ils servent dans les liens et pèsent peu sur le réseau.
-- Heures en timestamptz : un concert de 0 h 30 appartient à la journée de jeu
-- de la veille (public.jour_de).
-- Lecture publique de ce qui est annoncé ; écriture réservée au staff.
-- Les favoris ne se lisent et ne s'écrivent que par les fonctions joueur.
-- ----------------------------------------------------------------------------

-- Empêche deux concerts de se chevaucher sur une même scène.
create extension if not exists btree_gist with schema extensions;

create table public.lieux (
  id          text primary key
              constraint lieux_id_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 40),
  categorie   text not null
              constraint lieux_categorie check (categorie in
                ('scene','stand','food','eau','toilettes','secours','abri','service','entree')),
  nom         text not null constraint lieux_nom check (length(trim(nom)) between 1 and 80),
  description text,
  horaires    text,
  x           integer,              -- position sur le plan dessiné (unités du plan)
  y           integer,
  pmr         boolean,              -- null = non renseigné
  qr_code_id  uuid references public.qr_codes(id) on delete set null,
  ordre       integer not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint lieux_id_categorie unique (id, categorie)
);

create table public.scenes (
  id         text primary key,
  -- Une scène est forcément un lieu de catégorie « scene » (clé composée).
  categorie  text not null default 'scene' constraint scenes_categorie check (categorie = 'scene'),
  couleur    text not null default 'nuit'
             constraint scenes_couleur check (couleur in ('sodium','vert','rose','bleu','nuit','rouge','papier')),
  ordre      integer not null default 0,
  constraint scenes_lieu_fk foreign key (id, categorie)
    references public.lieux(id, categorie) on update cascade on delete cascade
);

create table public.artistes (
  id           text primary key
               constraint artistes_id_format check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 60),
  nom          text not null constraint artistes_nom check (length(trim(nom)) between 1 and 80),
  genre        text,
  bio          text,
  photo_url    text,                -- droit à l'image : à vérifier avant publication
  tete_affiche boolean not null default false,
  actif        boolean not null default true,   -- false : pas encore annoncé
  created_at   timestamptz not null default now()
);

create table public.creneaux (
  id         uuid primary key default gen_random_uuid(),
  artiste_id text not null references public.artistes(id) on update cascade on delete cascade,
  scene_id   text not null references public.scenes(id) on update cascade,
  debut      timestamptz not null,
  fin        timestamptz not null,
  created_at timestamptz not null default now(),
  constraint creneaux_duree check (fin > debut and fin <= debut + interval '12 hours'),
  constraint creneaux_sans_chevauchement exclude using gist (
    scene_id extensions.gist_text_ops with =,
    tstzrange(debut, fin) with &&)
);
create index creneaux_debut_idx on public.creneaux (debut);
create index creneaux_artiste_idx on public.creneaux (artiste_id);

create table public.dedicaces (
  id         uuid primary key default gen_random_uuid(),
  artiste_id text not null references public.artistes(id) on update cascade on delete cascade,
  lieu_id    text references public.lieux(id) on update cascade on delete set null,
  debut      timestamptz not null,
  fin        timestamptz not null,
  qr_code_id uuid references public.qr_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dedicaces_duree check (fin > debut and fin <= debut + interval '12 hours')
);
create index dedicaces_artiste_idx on public.dedicaces (artiste_id);

create table public.favoris_programme (
  player_id  uuid not null references public.players(id) on delete cascade,
  creneau_id uuid not null references public.creneaux(id) on delete cascade,
  rappel     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (player_id, creneau_id)
);
create index favoris_programme_creneau_idx on public.favoris_programme (creneau_id);

-- --- Sécurité ----------------------------------------------------------------
ALTER table public.lieux enable row level security;
ALTER table public.scenes enable row level security;
ALTER table public.artistes enable row level security;
ALTER table public.creneaux enable row level security;
ALTER table public.dedicaces enable row level security;
ALTER table public.favoris_programme enable row level security;

CREATE policy "lecture publique" on public.lieux for select to public using (actif);
CREATE policy "lecture publique" on public.scenes for select to public using (true);
CREATE policy "lecture publique" on public.artistes for select to public using (actif);
CREATE policy "lecture publique" on public.creneaux for select to public
  using (exists (select 1 from public.artistes a where a.id = artiste_id and a.actif));
CREATE policy "lecture publique" on public.dedicaces for select to public
  using (exists (select 1 from public.artistes a where a.id = artiste_id and a.actif));

CREATE policy "ecriture staff" on public.lieux for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.scenes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.artistes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.creneaux for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
CREATE policy "ecriture staff" on public.dedicaces for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- favoris_programme : aucune politique, tout passe par les fonctions ci-dessous.

-- --- Fonctions ----------------------------------------------------------------

-- Tout le programme en UNE requête (réseau du festival saturé).
-- SECURITY INVOKER : les politiques ci-dessus filtrent ce qui n'est pas annoncé.
create or replace function public.programme_public()
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  select json_build_object(
    'lieux', coalesce((select json_agg(json_build_object(
        'id', l.id, 'categorie', l.categorie, 'nom', l.nom, 'description', l.description,
        'horaires', l.horaires, 'x', l.x, 'y', l.y, 'pmr', l.pmr, 'qr_code_id', l.qr_code_id)
        order by l.categorie, l.ordre, l.nom) from public.lieux l), '[]'::json),
    'scenes', coalesce((select json_agg(json_build_object(
        'id', s.id, 'nom', l.nom, 'couleur', s.couleur)
        order by s.ordre, l.nom)
        from public.scenes s join public.lieux l on l.id = s.id), '[]'::json),
    'artistes', coalesce((select json_agg(json_build_object(
        'id', a.id, 'nom', a.nom, 'genre', a.genre, 'bio', a.bio,
        'photo_url', a.photo_url, 'tete_affiche', a.tete_affiche)
        order by a.nom) from public.artistes a), '[]'::json),
    'creneaux', coalesce((select json_agg(json_build_object(
        'id', c.id, 'artiste_id', c.artiste_id, 'scene_id', c.scene_id,
        'debut', c.debut, 'fin', c.fin, 'jour', public.jour_de(c.debut))
        order by c.debut) from public.creneaux c), '[]'::json),
    'dedicaces', coalesce((select json_agg(json_build_object(
        'id', d.id, 'artiste_id', d.artiste_id, 'lieu_id', d.lieu_id,
        'debut', d.debut, 'fin', d.fin, 'jour', public.jour_de(d.debut))
        order by d.debut) from public.dedicaces d), '[]'::json)
  );
$function$;

-- Ce que le programme affiche en plus pour un joueur, en UN appel (étape 4.12) :
--   favoris  concerts de son programme et rappel de chacun
--   vus      artistes vus (même règle que player_collection : scène scannée
--            pendant un de ses concerts, ou QR de sa dédicace)
--   genre    style préféré (profil), pour les suggestions de « mon programme »
create or replace function public.programme_favoris(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player_id uuid;
begin
  select s.player_id into v_player_id
  from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_player_id is null then raise exception 'SESSION_INVALIDE'; end if;

  return json_build_object(
    'favoris', coalesce((
      select json_agg(json_build_object('creneau_id', f.creneau_id, 'rappel', f.rappel)
                      order by c.debut)
      from public.favoris_programme f
      join public.creneaux c on c.id = f.creneau_id
      join public.artistes a on a.id = c.artiste_id and a.actif
      where f.player_id = v_player_id), '[]'::json),
    'vus', coalesce((
      select json_agg(distinct v.artiste_id)
      from (
        select cr.artiste_id
        from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
        where sc.player_id = v_player_id
        union
        select de.artiste_id
        from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
        where sc.player_id = v_player_id
      ) v
      join public.artistes a on a.id = v.artiste_id and a.actif), '[]'::json),
    'genre', (select pp.genre_prefere from public.player_profile pp where pp.player_id = v_player_id));
end;
$function$;

-- Ajoute ou retire un concert du programme du joueur.
-- Renvoie les favoris qui chevauchent le concert ajouté (alerte « conflit »).
create or replace function public.programme_basculer_favori(p_secret_code text, p_creneau_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player  public.players%rowtype;
  v_creneau public.creneaux%rowtype;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select c.* into v_creneau
  from public.creneaux c
  join public.artistes a on a.id = c.artiste_id and a.actif
  where c.id = p_creneau_id;
  if v_creneau.id is null then raise exception 'CRENEAU_INCONNU'; end if;

  delete from public.favoris_programme
  where player_id = v_player.id and creneau_id = p_creneau_id;
  if found then
    return json_build_object('favori', false, 'chevauchements', '[]'::json);
  end if;

  if (select count(*) from public.favoris_programme where player_id = v_player.id) >= 200 then
    raise exception 'TROP_DE_FAVORIS';
  end if;

  insert into public.favoris_programme (player_id, creneau_id)
  values (v_player.id, p_creneau_id);

  return json_build_object(
    'favori', true,
    'chevauchements', coalesce((
      select json_agg(c.id order by c.debut)
      from public.favoris_programme f
      join public.creneaux c on c.id = f.creneau_id
      where f.player_id = v_player.id
        and c.id <> v_creneau.id
        and c.debut < v_creneau.fin and v_creneau.debut < c.fin), '[]'::json));
end;
$function$;

-- Active ou coupe le rappel d'un concert du programme.
create or replace function public.programme_rappel(p_secret_code text, p_creneau_id uuid, p_rappel boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player_id uuid;
begin
  select s.player_id into v_player_id
  from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_player_id is null then raise exception 'SESSION_INVALIDE'; end if;
  if p_rappel is null then raise exception 'VALEUR_INVALIDE'; end if;

  update public.favoris_programme set rappel = p_rappel
  where player_id = v_player_id and creneau_id = p_creneau_id;
  if not found then raise exception 'PAS_FAVORI'; end if;

  return json_build_object('creneau_id', p_creneau_id, 'rappel', p_rappel);
end;
$function$;

-- Nombre de joueurs qui ont mis chaque concert annoncé dans leur programme
-- (suggestions « populaires », console). Aucune donnée personnelle.
create or replace function public.programme_popularite()
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(json_object_agg(t.creneau_id, t.n), '{}'::json)
  from (
    select f.creneau_id, count(*) as n
    from public.favoris_programme f
    join public.creneaux c on c.id = f.creneau_id
    join public.artistes a on a.id = c.artiste_id and a.actif
    group by f.creneau_id
  ) t;
$function$;

revoke all on function public.programme_public() from public, anon, authenticated;
revoke all on function public.programme_favoris(p_secret_code text) from public, anon, authenticated;
revoke all on function public.programme_basculer_favori(p_secret_code text, p_creneau_id uuid) from public, anon, authenticated;
revoke all on function public.programme_rappel(p_secret_code text, p_creneau_id uuid, p_rappel boolean) from public, anon, authenticated;
revoke all on function public.programme_popularite() from public, anon, authenticated;
grant execute on function public.programme_public() to anon, authenticated;
grant execute on function public.programme_favoris(p_secret_code text) to anon, authenticated;
grant execute on function public.programme_basculer_favori(p_secret_code text, p_creneau_id uuid) to anon, authenticated;
grant execute on function public.programme_rappel(p_secret_code text, p_creneau_id uuid, p_rappel boolean) to anon, authenticated;
grant execute on function public.programme_popularite() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Blind test (étape 2.7) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Les colonnes (categorie, reponse, anecdote, audio_url, audio_debut,
-- pochette_url) sont ajoutées à quiz_questions par le générateur, qui complète
-- aussi quiz_state, quiz_board, admin_quiz_live, admin_list_quiz_questions et
-- admin_duplicate_quiz_session. Les fonctions Otaku de création et de
-- modification d'une question ne changent pas : ce qui est propre au blind
-- test se règle ici, question par question.
--
-- ⚠️ audio_url est lisible par tous PENDANT la question (l'écran géant est une
--    page publique) : le nom du fichier ne doit rien dire de la réponse
--    (ex. « bt/2026-11-27/q07.mp3 », jamais « nova-kassa-lumiere.mp3 »).
-- ----------------------------------------------------------------------------

create or replace function public.admin_blind_question(
  p_id uuid,
  p_categorie text,
  p_reponse text,
  p_anecdote text,
  p_audio_url text,
  p_audio_debut integer,
  p_pochette_url text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_q public.quiz_questions%rowtype;
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(p_audio_debut, 0) not between 0 and 3600 then raise exception 'DEBUT_INVALIDE'; end if;
  if length(p_categorie) > 40 or length(p_reponse) > 160 or length(p_anecdote) > 400 then
    raise exception 'TEXTE_TROP_LONG';
  end if;

  begin
    update public.quiz_questions set
      categorie    = nullif(trim(p_categorie), ''),
      reponse      = nullif(trim(p_reponse), ''),
      anecdote     = nullif(trim(p_anecdote), ''),
      audio_url    = nullif(trim(p_audio_url), ''),
      audio_debut  = coalesce(p_audio_debut, 0),
      pochette_url = nullif(trim(p_pochette_url), '')
    where id = p_id
    returning * into v_q;
  exception when check_violation then
    raise exception 'ADRESSE_INVALIDE';
  end;
  if v_q.id is null then raise exception 'QUESTION_INCONNUE'; end if;
  return row_to_json(v_q);
end;
$function$;

revoke all on function public.admin_blind_question(p_id uuid, p_categorie text, p_reponse text, p_anecdote text, p_audio_url text, p_audio_debut integer, p_pochette_url text) from public, anon, authenticated;
grant execute on function public.admin_blind_question(p_id uuid, p_categorie text, p_reponse text, p_anecdote text, p_audio_url text, p_audio_debut integer, p_pochette_url text) to authenticated;

-- ----------------------------------------------------------------------------
-- Blind test côté joueur (étape 4.14) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Le moteur reste celui des raids d'Otaku (quiz_sessions.kind = 'raid', la
-- régie lance chaque question). Décisions de Jarvis du 18/09 :
--   · barème des visuels : une bonne réponse vaut de 1 000 points (tout de
--     suite) à 500 points (au bout du chrono) ; XP = points ÷ 25, versés à la
--     réponse (au plus 40 XP par question) ; plus de jetons par réponse ;
--   · fin de manche (admin_quiz_end, UNE fois : quiz_sessions.recompenses_at) :
--     badge « Oreille d'or » au top 10, jetons de classement (podium 5, top 10
--     2, 10 bonnes réponses ou plus 1), missions au compteur « blind » (bonnes
--     réponses de la journée de jeu) ; le lot du podium se retire au stand ;
--   · PAS de bonus collectif quand le boss tombe (raid_bonus_xp n'est plus
--     versé) : le boss (une figure de la musique) reste un objectif commun,
--     ses PV se comptent dans les mêmes points ;
--   · téléphones sans temps réel : quiz_state est lu à la fermeture de chaque
--     question puis toutes les ~3 s en attendant la suivante. Il doit rester
--     léger : les totaux de la manche sont tenus dans quiz_scores (une ligne
--     par joueur) au lieu d'additionner toutes les réponses à chaque lecture.
--
--   quiz_state(code)          l'état du téléphone en UN appel : question,
--                             chrono du serveur, ma réponse, mes points, ma
--                             place et le trio de tête (chrono fini), le boss,
--                             et à la fin mon récapitulatif
--   quiz_answer(code, q, i)   une réponse, définitive (rejouer ne change rien)
--   admin_quiz_end(session)   clôture par la régie + récompenses
--   _raid_damage(session)     PV retirés au boss = somme des points
-- ----------------------------------------------------------------------------

create table public.quiz_scores (
  session_id  uuid not null references public.quiz_sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  points      integer not null default 0,
  bonnes      integer not null default 0,
  xp          integer not null default 0,      -- XP gagnés par les réponses
  derniere_at timestamptz not null default now(),   -- départage (le plus rapide devant)
  recap       jsonb,                           -- rempli par admin_quiz_end
  primary key (session_id, player_id)
);
create index quiz_scores_classement_idx on public.quiz_scores (session_id, points desc, derniere_at);
-- Aucune politique : lue seulement par les fonctions ci-dessous.
alter table public.quiz_scores enable row level security;

create or replace function public._raid_damage(p_session_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(points), 0)::int from public.quiz_scores where session_id = p_session_id;
$function$;

revoke all on function public._raid_damage(p_session_id uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
create or replace function public.quiz_answer(p_secret_code text, p_question_id uuid, p_answer_index integer)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player    public.players%rowtype;
  v_session   public.quiz_sessions%rowtype;
  v_q         public.quiz_questions%rowtype;
  v_elapsed   numeric;
  v_correct   boolean;
  v_points    int := 0;
  v_xp        int := 0;
  v_old_level int;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;
  if not public.pass_actif(v_player.id) then raise exception 'PASS_REQUIS'; end if;

  select * into v_session from public.quiz_sessions
  where status = 'en_cours' order by created_at desc limit 1;
  if v_session.id is null then raise exception 'QUIZ_INACTIF'; end if;

  -- La réponse doit viser LA question en cours (pas une ancienne)
  select * into v_q from public.quiz_questions
  where session_id = v_session.id and question_order = v_session.current_question;
  if v_q.id is null or v_q.id is distinct from p_question_id
     or v_session.question_started_at is null then
    raise exception 'QUESTION_FERMEE';
  end if;

  -- Chrono du serveur (+2 s de grâce pour le réseau du festival)
  v_elapsed := extract(epoch from (now() - v_session.question_started_at));
  if v_elapsed > v_q.duration_seconds + 2 then raise exception 'TROP_TARD'; end if;

  if p_answer_index is null or p_answer_index < 0
     or p_answer_index >= jsonb_array_length(v_q.choices) then
    raise exception 'REPONSE_INVALIDE';
  end if;

  -- Barème des visuels : 1 000 points tout de suite, 500 au bout du chrono
  -- (la grâce de 2 s compte comme la fin du chrono).
  v_correct := (p_answer_index = v_q.correct_index);
  if v_correct then
    v_points := 1000 - round(500 * least(1, v_elapsed / greatest(v_q.duration_seconds, 1)))::int;
    v_xp     := round(v_points / 25.0)::int;
  end if;

  -- Une seule réponse par joueur et par question (contrainte unique) : un
  -- second envoi (réseau qui renvoie) est refusé, rien n'est compté deux fois.
  insert into public.quiz_answers (question_id, player_id, answer_index, is_correct, response_ms, points)
  values (v_q.id, v_player.id, p_answer_index, v_correct, round(v_elapsed * 1000), v_points)
  on conflict (question_id, player_id) do nothing;
  if not found then raise exception 'DEJA_REPONDU'; end if;

  insert into public.quiz_scores (session_id, player_id, points, bonnes, xp, derniere_at)
  values (v_session.id, v_player.id, v_points, v_correct::int, v_xp, now())
  on conflict (session_id, player_id) do update set
    points      = quiz_scores.points + excluded.points,
    bonnes      = quiz_scores.bonnes + excluded.bonnes,
    xp          = quiz_scores.xp + excluded.xp,
    derniere_at = excluded.derniere_at;

  -- Récompense immédiate en base (le joueur ne la VOIT qu'au chrono fini)
  if v_xp > 0 then
    v_old_level := public.level_for_xp(v_player.xp);
    update public.players set
      xp    = xp + v_xp,
      level = public.level_for_xp(xp + v_xp),
      rank  = public.rank_for_level(public.level_for_xp(xp + v_xp))
    where id = v_player.id
    returning * into v_player;

    if v_player.level > v_old_level then
      insert into public.events (type, player_id, payload)
      values ('level_up', v_player.id, jsonb_build_object(
        'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
        'level', v_player.level, 'old_level', v_old_level));
    end if;
  end if;

  -- Surtout PAS de verdict dans la réponse : juste « verrouillée »
  return json_build_object('locked', true);
end;
$function$;

revoke all on function public.quiz_answer(p_secret_code text, p_question_id uuid, p_answer_index integer) from public, anon, authenticated;
grant execute on function public.quiz_answer(p_secret_code text, p_question_id uuid, p_answer_index integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
create or replace function public.quiz_state(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player  public.players%rowtype;
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_ma      public.quiz_answers%rowtype;
  v_moi     public.quiz_scores%rowtype;
  v_elapsed numeric;
  v_closed  boolean := false;      -- chrono fini : on peut tout montrer
  v_fini    boolean;
  v_points  int;
  v_bonnes  int;
  v_serie   int := 0;
  v_damage  int;
  v_nb      int;             -- participants
  v_total   int;
  r         record;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;

  -- La manche en cours en priorité, sinon la dernière jouée (récapitulatif),
  -- pendant 2 h : le lendemain, le téléphone revient à l'attente.
  select * into v_session from public.quiz_sessions
  where status in ('en_cours', 'terminee')
  order by (status = 'en_cours') desc,
           coalesce(question_started_at, created_at) desc
  limit 1;
  if v_session.id is null
     or (v_session.status = 'terminee'
         and coalesce(v_session.recompenses_at, v_session.question_started_at, v_session.created_at)
             < now() - interval '2 hours') then
    return json_build_object('session', null);
  end if;
  v_fini := v_session.status = 'terminee';
  select count(*) into v_total from public.quiz_questions where session_id = v_session.id;

  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
      -- On ne révèle jamais avant d'avoir cessé d'accepter les réponses (+2 s)
      v_closed  := v_elapsed > v_q.duration_seconds + 2 or v_fini;
    end if;
    select * into v_ma from public.quiz_answers
    where question_id = v_q.id and player_id = v_player.id;
  end if;

  -- Mes totaux. Pendant la question, ma réponse n'est pas encore comptée à
  -- l'écran (sinon les points trahiraient le verdict).
  select * into v_moi from public.quiz_scores
  where session_id = v_session.id and player_id = v_player.id;
  v_points := coalesce(v_moi.points, 0) - case when v_closed then 0 else coalesce(v_ma.points, 0) end;
  v_bonnes := coalesce(v_moi.bonnes, 0) - case when v_closed or not coalesce(v_ma.is_correct, false) then 0 else 1 end;

  -- Série de bonnes réponses, jusqu'à la dernière question fermée (≤ 20 lignes)
  for r in
    select a.is_correct
    from public.quiz_questions q
    left join public.quiz_answers a on a.question_id = q.id and a.player_id = v_player.id
    where q.session_id = v_session.id
      and q.question_order <= v_session.current_question - case when v_closed then 0 else 1 end
    order by q.question_order desc
  loop
    exit when not coalesce(r.is_correct, false);
    v_serie := v_serie + 1;
  end loop;

  -- Le boss : PV seulement chrono fini (une barre qui bouge pendant la
  -- question dirait, dans une petite salle, qui a juste)
  -- (participants et PV en UNE lecture de quiz_scores : c'est l'appel que tous
  -- les téléphones répètent entre deux questions)
  if v_closed or v_session.current_question = 0 then
    select count(*), coalesce(sum(points), 0)::int into v_nb, v_damage
    from public.quiz_scores where session_id = v_session.id;
    if v_session.kind <> 'raid' then v_damage := null; end if;
  end if;

  return json_build_object(
    'session', json_build_object(
      'id', v_session.id, 'title', v_session.title, 'status', v_session.status,
      'kind', v_session.kind,
      'current_question', v_session.current_question,
      'total_questions', v_total),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'boss_name', v_session.boss_name,
      'hp_max', v_session.boss_hp_max,
      'damage', v_damage,
      'hp_left', case when v_damage is null then null else greatest(0, v_session.boss_hp_max - v_damage) end,
      'defeated', case when v_damage is null then null else v_session.boss_hp_max > 0 and v_damage >= v_session.boss_hp_max end) end,

    -- La question : choix toujours, la bonne réponse SEULEMENT chrono fini.
    -- Pas d'extrait audio : il est joué sur l'écran géant.
    'question', case when v_q.id is null then null else json_build_object(
      'id', v_q.id,
      'categorie', v_q.categorie,
      'question', v_q.question,
      'choices', v_q.choices,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms', round(v_elapsed * 1000),
      'closed', v_closed,
      'correct_index', case when v_closed then v_q.correct_index end,
      'reponse',       case when v_closed then v_q.reponse end,
      'anecdote',      case when v_closed then v_q.anecdote end,
      'pochette_url',  case when v_closed then v_q.pochette_url end) end,

    -- Ma réponse : l'index tout de suite (pour griser les touches), le verdict
    -- et les points seulement chrono fini
    'my_answer', case when v_ma.id is null then null else json_build_object(
      'answer_index', v_ma.answer_index,
      'is_correct',   case when v_closed then v_ma.is_correct end,
      'points',       case when v_closed then v_ma.points end,
      'response_ms',  v_ma.response_ms) end,

    'moi', json_build_object(
      'points', v_points, 'bonnes', v_bonnes, 'serie', v_serie,
      'rang', case when v_closed and v_moi.player_id is not null then
        (select count(*) + 1 from public.quiz_scores
         where session_id = v_session.id and points > v_moi.points) end,
      'participants', case when v_closed then v_nb end),

    -- Le trio de tête (chrono fini, et podium à la fin)
    'tete', case when not v_closed then null else
      coalesce((select json_agg(row_to_json(t)) from (
        select p.pseudo, p.archetype, s.points
        from public.quiz_scores s
        join public.players p on p.id = s.player_id
        where s.session_id = v_session.id
        order by s.points desc, s.derniere_at asc
        limit 3) t), '[]'::json) end,

    -- Mon récapitulatif (quand la régie a clos la manche)
    'recap', case when v_fini then v_moi.recap end);
end;
$function$;

revoke all on function public.quiz_state(p_secret_code text) from public, anon, authenticated;
grant execute on function public.quiz_state(p_secret_code text) to anon, authenticated;

-- ----------------------------------------------------------------------------
create or replace function public.admin_quiz_end(p_session_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_session      public.quiz_sessions%rowtype;
  v_top          record;
  v_damage       int;
  v_defeated     boolean := false;
  v_participants int := 0;
  v_total        int;
  r              record;
  q              record;
  v_jetons       int;
  v_badge        text;
  v_xp_mission   int;
  v_prog         int;
  v_mission      json;
begin
  -- is_equipe() : un vendeur peut clore la manche (secours d'Otaku)
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  update public.quiz_sessions set status = 'terminee'
  where id = p_session_id
  returning * into v_session;
  if v_session.id is null then raise exception 'QUIZ_INCONNU'; end if;
  select count(*) into v_total from public.quiz_questions where session_id = p_session_id;

  -- Les récompenses ne partent qu'une fois (deux clics de la régie, ou une
  -- manche close deux fois)
  update public.quiz_sessions set recompenses_at = now()
  where id = p_session_id and recompenses_at is null;
  if found then
    for r in
      select s.*, p.pseudo, rank() over (order by s.points desc) as rang
      from public.quiz_scores s
      join public.players p on p.id = s.player_id
      where s.session_id = p_session_id and p.status <> 'exclu'
    loop
      v_jetons := case when r.points <= 0 then 0
                       when r.rang <= 3 then 5
                       when r.rang <= 10 then 2
                       when r.bonnes >= 10 then 1
                       else 0 end;
      v_badge := case when r.rang <= 10 and r.points > 0
                      then public._award_badge(r.player_id, r.pseudo, 'Oreille d''or') end;

      -- Missions au compteur « blind » : bonnes réponses de la journée de jeu.
      -- (Pas d'événement par mission : 300 lignes d'un coup noieraient l'écran.)
      -- Seulement avec un ticket du jour valable : sinon la garde pass_garde
      -- refuserait l'XP et annulerait la clôture de TOUTE la manche (piège
      -- connu d'Otaku). Badge et jetons ne passent pas par cette garde.
      v_xp_mission := 0;
      v_mission := null;
      if r.bonnes > 0 and public.pass_actif(r.player_id) then
        for q in
          select * from public.quests where active and counter = 'blind' order by priorite desc, created_at
        loop
          v_prog := null;
          insert into public.quest_progress (player_id, quest_id, progress, jour)
          values (r.player_id, q.id, r.bonnes, public.jour_jeu())
          on conflict (player_id, quest_id, jour) do update
            set progress = quest_progress.progress + excluded.progress
            where quest_progress.completed_at is null
          returning progress into v_prog;
          continue when v_prog is null;

          if v_prog >= q.goal_count then
            update public.quest_progress set completed_at = now()
            where player_id = r.player_id and quest_id = q.id and jour = public.jour_jeu()
              and completed_at is null;
            if found then
              v_xp_mission := v_xp_mission + q.xp_reward;
              if q.badge_id is not null then
                perform public._award_badge(r.player_id, r.pseudo,
                  (select name from public.badges where id = q.badge_id));
              end if;
            end if;
          end if;
          if v_mission is null and (q.type <> 'secrete' or v_prog >= q.goal_count) then
            v_mission := json_build_object('titre', q.title, 'fait', least(v_prog, q.goal_count),
              'objectif', q.goal_count, 'terminee', v_prog >= q.goal_count, 'xp', q.xp_reward);
          end if;
        end loop;
      end if;

      if v_jetons > 0 or v_xp_mission > 0 then
        update public.players set
          xp     = xp + v_xp_mission,
          jetons = jetons + v_jetons + v_xp_mission / 10,
          level  = public.level_for_xp(xp + v_xp_mission),
          rank   = public.rank_for_level(public.level_for_xp(xp + v_xp_mission))
        where id = r.player_id;
      end if;

      update public.quiz_scores set recap = jsonb_build_object(
        'rang', r.rang, 'points', r.points, 'bonnes', r.bonnes, 'total_questions', v_total,
        'xp', r.xp + v_xp_mission, 'jetons', v_jetons + v_xp_mission / 10,
        'badge', v_badge, 'mission', v_mission)
      where session_id = p_session_id and player_id = r.player_id;
    end loop;
  end if;

  -- La meilleure oreille (le plus rapide départage)
  select p.id, p.pseudo, s.points into v_top
  from public.quiz_scores s
  join public.players p on p.id = s.player_id
  where s.session_id = p_session_id
  order by s.points desc, s.derniere_at asc
  limit 1;
  select count(*) into v_participants from public.quiz_scores where session_id = p_session_id;

  if v_session.kind = 'raid' then
    v_damage   := public._raid_damage(p_session_id);
    v_defeated := v_session.boss_hp_max > 0 and v_damage >= v_session.boss_hp_max;
    -- Le moment fort sur l'écran géant (pas de bonus collectif : décision du 18/09)
    insert into public.events (type, payload)
    values ('raid', jsonb_build_object(
      'message', case when v_defeated then
          'VICTOIRE ! Le public a conquis « ' || v_session.boss_name || ' » ! Bravo aux '
          || v_participants || ' joueurs du blind test !'
        else
          '« ' || v_session.boss_name || ' » résiste encore, il manquait '
          || (v_session.boss_hp_max - v_damage) || ' points… Revanche au prochain blind test !'
        end,
      'boss', v_session.boss_name, 'defeated', v_defeated,
      'damage', v_damage, 'hp_max', v_session.boss_hp_max,
      'bonus_xp', 0, 'participants', v_participants));
  end if;

  if v_top.id is not null then
    insert into public.events (type, player_id, payload)
    values ('quiz', v_top.id, jsonb_build_object(
      'message', v_top.pseudo || ' a la meilleure oreille du blind test avec '
        || v_top.points || ' points !',
      'quiz', v_session.title, 'points', v_top.points));
  end if;

  select * into v_session from public.quiz_sessions where id = p_session_id;
  return row_to_json(v_session);
end;
$function$;

revoke all on function public.admin_quiz_end(p_session_id uuid) from public, anon, authenticated;
grant execute on function public.admin_quiz_end(p_session_id uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Collection (étape 4.5) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Quatre rayons : badges, artistes vus, stands tamponnés, reliques trouvées.
-- La player_collection d'Otaku (boss, cosplayers, reliques) est remplacée en
-- entier ; le générateur ne reprend pas son corps.
--
--   artiste vu   = QR de sa scène scanné PENDANT son concert (scans.creneau_id,
--                  noté par scan_qr), ou QR de sa séance de dédicaces ;
--   stand        = lieu « stand » ou « food » qui a un QR, scanné au moins une fois ;
--   relique      = QR de type « relique ». Tant qu'elle n'est pas trouvée, le
--                  joueur ne voit que sa rareté et son indice (ni nom ni code) ;
--   badge secret = nom et icône cachés tant qu'il n'est pas gagné (le texte
--                  est une devinette, il reste visible).
-- Une seule requête par joueur ; pas de ligne « player » (la page n'en a pas
-- besoin, le statut est surveillé ailleurs). Sert aussi au passeport (4.6).
-- ----------------------------------------------------------------------------

alter table public.scans add constraint scans_creneau_id_fkey
  foreign key (creneau_id) references public.creneaux(id) on update cascade;
create index scans_creneau_idx on public.scans (creneau_id) where creneau_id is not null;

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
    -- Étape 4.6 (passeport) : « 312ᵉ sur 1 800 », « présent 3 jours sur 4 »,
    -- missions terminées sur tout le festival (une mission refaite un autre
    -- jour compte à nouveau : quest_progress est par journée).
    'joueurs', v_joueurs,
    'jours_presents', (select count(distinct day) from public.scans where player_id = v_player.id),
    'missions', (select count(*) from public.quest_progress
                 where player_id = v_player.id and completed_at is not null),

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

-- ----------------------------------------------------------------------------
-- Classement des téléphones (étape 4.7) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- leaderboard_view (Otaku) ne classe que sur les points du jour et reste celle
-- de l'écran géant. Les téléphones utilisent ces trois fonctions :
--
--   classement_joueur(code, periode)   top 10, mes 2 voisins de chaque côté,
--                                      ma place, l'écart avec celui qui me précède
--   classement_chercher(code, texte, periode)
--                                      10 pseudos au plus contenant le texte
--                                      (3 lettres minimum, sur validation)
--   classement_amis(code, pseudos[], periode)
--                                      les amis du joueur, gardés SUR SON
--                                      TÉLÉPHONE (pas de table, 30 au plus)
--
-- periode : 'general' = XP total ; 'jour' = XP gagnés depuis 6 h (xp_jour du
-- jour de jeu ; seuls ceux qui ont joué aujourd'hui sont classés, plus le
-- joueur qui demande). Seuls les joueurs actifs comptent. Ex æquo : même place
-- (rank()), départagés à l'affichage par la date d'inscription.
--
-- Coût (banc, 5 000 joueurs, 80_classement.sql) : classement_joueur ne lit que
-- des index ; la recherche et les amis (à la demande) font UN passage trié
-- (_classement).
-- Rien de secret n'est renvoyé : pseudo, avatar, XP, place (déjà publics sur
-- l'écran géant). Le code secret sert seulement à savoir qui demande.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- La roue (étape 4.8) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Le tirage reste spin_roulette (Otaku), complétée par le générateur : plafond
-- de tirages par journée de jeu (game_state.roulette_max_jour, 0 = aucun),
-- identifiant du lot gagné dans la réponse. admin_redeem note qui a remis le
-- lot (roulette_spins.redeemed_by).
--
--   roulette_joueur(code)          tout ce que la page Roue affiche, en UN appel :
--                                  coût, plafond, tirages du jour, lots de la roue
--                                  (stock à jour), bons de retrait du joueur
--   admin_prize_affichage(id, rarete, court)
--                                  couleur de la case et libellé court d'un lot
--   admin_set_roulette_plafond(n)  tirages par joueur et par journée de jeu
--
-- Les bons ne sont lisibles que par leur titulaire (le code secret prouve qui
-- demande) : roulette_spins reste fermée en lecture aux joueurs.
-- ----------------------------------------------------------------------------

-- Tirages d'un joueur depuis 6 h, et ses bons du plus récent au plus ancien.
create index if not exists roulette_spins_joueur_idx on public.roulette_spins (player_id, created_at desc);

-- Début de la journée de jeu en cours (6 h, heure de Douala), en instant.
-- À comparer à created_at : une borne calculée une fois, jamais jour_de()
-- ligne par ligne (fonction jamais dépliée par Postgres, voir PERFORMANCE.md).
create or replace function public._debut_jour_jeu()
 returns timestamptz
 language sql
 stable
 set search_path to 'public'
as $function$
  select (public.jour_jeu() + time '06:00') at time zone 'Africa/Douala';
$function$;

revoke all on function public._debut_jour_jeu() from public, anon, authenticated;

create or replace function public.roulette_joueur(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
-- Appelée au chargement de la page Roue, jamais en boucle. Après un tirage, la
-- page se met à jour avec la réponse de spin_roulette, sans relire.
declare
  v_player public.players%rowtype;
  v_cout   integer;
  v_max    integer;
begin
  select p.* into v_player
  from public.players p
  join public.player_secrets s on s.player_id = p.id
  where s.secret_code = upper(trim(p_secret_code));
  if v_player.id is null then raise exception 'SESSION_INVALIDE'; end if;
  if v_player.status = 'exclu' then raise exception 'JOUEUR_EXCLU'; end if;

  select coalesce(roulette_cost, 30), coalesce(roulette_max_jour, 0) into v_cout, v_max
  from public.game_state where id = 1;

  return json_build_object(
    'jetons', v_player.jetons,
    'cout', v_cout,
    'max_jour', v_max,
    'tirages_jour', (select count(*) from public.roulette_spins
                     where player_id = v_player.id and created_at >= public._debut_jour_jeu()),
    'pass_actif', public.pass_actif(v_player.id),
    -- Même ordre que le tirage (created_at) : c'est l'ordre des cases.
    'lots', coalesce((
      select json_agg(json_build_object(
               'id', pr.id, 'nom', pr.name, 'court', pr.court, 'icone', pr.icon,
               'genre', pr.kind, 'valeur', pr.value, 'rarete', pr.rarete,
               'poids', pr.weight, 'stock', pr.stock) order by pr.created_at)
      from public.roulette_prizes pr
      where pr.active and pr.weight > 0), '[]'::json),
    -- Les objets à retirer au stand (les seuls à avoir un code), 50 au plus
    'bons', coalesce((
      select json_agg(b order by b.cree_le desc) from (
        select s.redeem_code as code, s.prize_id as lot, pr.name as nom, pr.icon as icone,
               pr.rarete, s.created_at as cree_le, s.redeemed_at as retire_le,
               st.display_name as par
        from public.roulette_spins s
        left join public.roulette_prizes pr on pr.id = s.prize_id
        left join public.staff st on st.user_id = s.redeemed_by
        where s.player_id = v_player.id and s.redeem_code is not null
        order by s.created_at desc
        limit 50
      ) b), '[]'::json)
  );
end;
$function$;

revoke all on function public.roulette_joueur(p_secret_code text) from public, anon, authenticated;
grant execute on function public.roulette_joueur(p_secret_code text) to anon, authenticated;

create or replace function public.admin_prize_affichage(p_id uuid, p_rarete text, p_court text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rarete text := coalesce(nullif(lower(trim(coalesce(p_rarete, ''))), ''), 'commun');
  v_court  text := nullif(trim(coalesce(p_court, '')), '');
begin
  if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;
  if v_rarete not in ('commun', 'rare', 'epique', 'legendaire') then raise exception 'RARETE_INVALIDE'; end if;
  if char_length(v_court) > 12 then raise exception 'LIBELLE_TROP_LONG'; end if;
  update public.roulette_prizes set rarete = v_rarete, court = v_court where id = p_id;
  if not found then raise exception 'LOT_INCONNU'; end if;
  return json_build_object('id', p_id, 'rarete', v_rarete, 'court', v_court);
end;
$function$;

revoke all on function public.admin_prize_affichage(p_id uuid, p_rarete text, p_court text) from public, anon, authenticated;
grant execute on function public.admin_prize_affichage(p_id uuid, p_rarete text, p_court text) to authenticated;

create or replace function public.admin_set_roulette_plafond(p_max integer)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_max is null or p_max < 0 or p_max > 1000 then raise exception 'VALEUR_INVALIDE'; end if;
  update public.game_state set roulette_max_jour = p_max where id = 1;
  return json_build_object('roulette_max_jour', p_max);
end;
$function$;

revoke all on function public.admin_set_roulette_plafond(p_max integer) from public, anon, authenticated;
grant execute on function public.admin_set_roulette_plafond(p_max integer) to authenticated;

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
create index announcements_recentes_idx on public.announcements (created_at desc);

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

-- ----------------------------------------------------------------------------
-- Règles du jeu affichées sur la page Infos (étape 4.13) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- regles_jeu() : le barème des XP par type de QR (min et max des QR actifs) et
-- les règles de la roue (coût d'un tour, plafond par journée de jeu).
-- Publique (visiteurs compris) : aucun code, aucun libellé, aucun indice de QR
-- ne sort — seulement des nombres par type. Suit les réglages du GM sans
-- retoucher le site.
-- ----------------------------------------------------------------------------
create or replace function public.regles_jeu()
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select json_build_object(
    'bareme', coalesce((
      select json_agg(json_build_object('type', b.type, 'min', b.min, 'max', b.max) order by b.max desc, b.type)
      from (
        select q.type, min(q.xp_reward) as min, max(q.xp_reward) as max
        from public.qr_codes q
        where q.active
        group by q.type
      ) b), '[]'::json),
    'roue', (select json_build_object('cout', g.roulette_cost, 'max_jour', g.roulette_max_jour)
             from public.game_state g where g.id = 1)
  );
$function$;

revoke all on function public.regles_jeu() from public, anon, authenticated;
grant execute on function public.regles_jeu() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Mur de l'écran géant (étape 5.1) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- mur_direct() : TOUT le mur en un appel, relu à chaque signal du temps réel
-- (nouvel événement, annonce, phase du jeu), au plus une fois toutes les 5 s.
--   · top      : tournoi du jour (XP gagnés depuis 6 h), 10 premiers, sur
--                l'index players_classement_jour_idx (décision du 18/09 : le
--                mur n'affiche QUE le jour) ; roi_veille à côté ;
--   · compteurs: joueurs actifs, joueurs du jour, scans de la journée de jeu
--                (index scans_jour_idx : Otaku comptait tous les scans) ;
--   · exploits : 8 derniers — relique trouvée, badge (nom caché si secret),
--                mission, objet ou badge gagné à la roue, CHANGEMENT DE RANG
--                (pas chaque niveau). Jamais : scènes, stands, exclusions,
--                phases, profils. Joueurs exclus masqués ;
--   · annonces : 48 h, pas encore finies (fermée = fin passée), 10 au plus.
-- Remplace live_board / leaderboard_view pour le mur (tri ligne par ligne
-- sur _points_jour : 152 ms au banc sur 5 000 joueurs).
-- Publique : rien que l'écran géant ne montre déjà (pseudo, avatar, XP).
-- ----------------------------------------------------------------------------

create index if not exists scans_jour_idx on public.scans (day);
-- Les exploits candidats seulement : les scans de scènes et de stands (le gros
-- du journal) ne sont jamais relus.
create index if not exists events_mur_idx on public.events (created_at desc)
  where type in ('badge', 'quete', 'roulette', 'level_up')
     or (type = 'scan' and payload->>'qr_type' = 'relique');

create or replace function public.mur_direct()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour date := public.jour_jeu();   -- UNE fois (voir _classement)
begin
  return json_build_object(
    'jour',         v_jour,
    'phase',        (select g.phase from public.game_state g where g.id = 1),
    'roi_veille',   public.roi_veille(),
    'joueurs',      (select count(*) from public.players where status = 'actif'),
    'joueurs_jour', (select count(*) from public.players
                     where status = 'actif' and jour = v_jour and xp_jour > 0),
    'scans_jour',   (select count(*) from public.scans where day = v_jour),

    'top', coalesce((
      select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype, 'points', t.xp_jour,
                                        'xp', t.xp, 'place', t.place) order by t.xp_jour desc, t.created_at)
      from (select x.*, (rank() over (order by x.xp_jour desc))::int as place
            from (select pseudo, archetype, xp, xp_jour, created_at from public.players
                  where status = 'actif' and jour = v_jour and xp_jour > 0
                  order by xp_jour desc, created_at limit 10) x) t), '[]'::json),

    'exploits', coalesce((
      select json_agg(json_build_object('id', e.id, 'type', e.genre, 'at', e.created_at,
                                        'pseudo', e.pseudo, 'avatar', e.archetype,
                                        'nom', e.nom, 'detail', e.detail) order by e.created_at desc)
      from (
        select c.id, c.created_at, p.pseudo, p.archetype,
               case c.type when 'scan' then 'relique' when 'quete' then 'mission'
                           when 'roulette' then 'roue' when 'level_up' then 'rang' else c.type end as genre,
               case c.type
                 when 'scan'     then c.payload->>'label'
                 when 'badge'    then case when b.secret then null else c.payload->>'badge' end
                 when 'quete'    then c.payload->>'quest'
                 when 'roulette' then c.payload->>'prize'
                 else public.rank_for_level((c.payload->>'level')::int) end as nom,
               case c.type
                 when 'scan'     then c.payload->>'rarity'
                 when 'badge'    then coalesce(b.rarete, 'commun')
                 when 'quete'    then c.payload->>'xp'
                 when 'roulette' then c.payload->>'kind'
                 else null end as detail
        from (select id, type, payload, created_at, player_id from public.events
              where type in ('badge', 'quete', 'roulette', 'level_up')
                 or (type = 'scan' and payload->>'qr_type' = 'relique')
              order by created_at desc limit 50) c
        join public.players p on p.id = c.player_id and p.status = 'actif'
        left join public.badges b on c.type = 'badge' and b.name = c.payload->>'badge'
        -- Un niveau de plus ne s'affiche que s'il change le rang ('old_level'
        -- manque dans le journal de la roue : un seul niveau d'écart supposé)
        where c.type <> 'level_up'
           or public.rank_for_level((c.payload->>'level')::int)
              <> public.rank_for_level(coalesce((c.payload->>'old_level')::int, (c.payload->>'level')::int - 1))
        order by c.created_at desc limit 8) e), '[]'::json),

    'annonces', coalesce((
      select json_agg(json_build_object('id', a.id, 'titre', a.titre, 'message', a.message, 'type', a.type,
                                        'categorie', a.categorie, 'fin', a.fin, 'created_at', a.created_at)
                      order by a.created_at desc)
      from (select id, titre, message, type, categorie, fin, created_at from public.announcements
            where created_at >= now() - interval '48 hours' and (fin is null or fin > now())
            order by created_at desc limit 10) a), '[]'::json)
  );
end;
$function$;

revoke all on function public.mur_direct() from public, anon, authenticated;
grant execute on function public.mur_direct() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Plateau du blind test sur l'écran géant (étape 5.2) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- quiz_board() : tout le plateau en UN appel. Réécrite (le corps d'Otaku
-- additionnait toutes les réponses de la manche à chaque lecture) : les
-- totaux viennent de quiz_scores (4.14), comme sur les téléphones.
-- Décisions de Jarvis du 18/09 :
--   · le boss (une figure de la musique) est à l'écran : nom, photo, PV ; les
--     PV ne bougent qu'une fois le chrono fini, comme sur les téléphones ;
--   · « les plus rapides » : les 3 bonnes réponses les plus rapides de la
--     question, chrono fini seulement ;
--   · après la révélation, l'écran montre le top 10 de la manche jusqu'à la
--     question suivante (top renvoyé dès que le chrono est fini) ;
--   · l'écran apprend qu'une question commence par game_state (temps réel) :
--     admin_quiz_next touche game_state.updated_at (voir fabriquer_schema.py).
-- Même fenêtre que quiz_state : la dernière manche jouée reste affichée 2 h
-- (podium), puis l'écran revient à l'attente.
-- Rien ne sort avant la fin du chrono (+2 s) : bonne réponse, réponse,
-- anecdote, pochette, répartition, rapides, PV, classement. Joueurs exclus
-- masqués. Publique : l'écran géant n'a pas de session.
-- ----------------------------------------------------------------------------

create or replace function public.quiz_board()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_session public.quiz_sessions%rowtype;
  v_q       public.quiz_questions%rowtype;
  v_elapsed numeric;
  v_closed  boolean := false;      -- chrono fini (+2 s) : on peut tout montrer
  v_fini    boolean;
  v_total   int;
  v_nb      int;                   -- participants (une ligne de quiz_scores chacun)
  v_damage  int;
begin
  select * into v_session from public.quiz_sessions
  where status in ('en_cours', 'terminee')
  order by (status = 'en_cours') desc,
           coalesce(question_started_at, created_at) desc
  limit 1;
  if v_session.id is null
     or (v_session.status = 'terminee'
         and coalesce(v_session.recompenses_at, v_session.question_started_at, v_session.created_at)
             < now() - interval '2 hours') then
    return json_build_object('session', null);
  end if;
  v_fini := v_session.status = 'terminee';
  select count(*) into v_total from public.quiz_questions where session_id = v_session.id;

  if v_session.current_question >= 1 then
    select * into v_q from public.quiz_questions
    where session_id = v_session.id and question_order = v_session.current_question;
    if v_q.id is not null and v_session.question_started_at is not null then
      v_elapsed := extract(epoch from (now() - v_session.question_started_at));
      v_closed  := v_elapsed > v_q.duration_seconds + 2 or v_fini;
    end if;
  end if;

  -- Participants et PV en une lecture ; les PV seulement chrono fini
  select count(*), coalesce(sum(points), 0)::int into v_nb, v_damage
  from public.quiz_scores where session_id = v_session.id;
  if not (v_closed or v_session.current_question = 0) then v_damage := null; end if;

  return json_build_object(
    'session', json_build_object(
      'id', v_session.id, 'title', v_session.title, 'status', v_session.status,
      'kind', v_session.kind,
      'current_question', v_session.current_question,
      'total_questions', v_total,
      'participants', v_nb),

    'raid', case when v_session.kind <> 'raid' then null else json_build_object(
      'boss_name', v_session.boss_name,
      'boss_image', v_session.boss_image,
      'hp_max', v_session.boss_hp_max,
      'damage', v_damage,
      'hp_left', case when v_damage is null then null else greatest(0, v_session.boss_hp_max - v_damage) end,
      'defeated', case when v_damage is null then null else v_session.boss_hp_max > 0 and v_damage >= v_session.boss_hp_max end) end,

    'question', case when v_q.id is null then null else json_build_object(
      'numero',           v_q.question_order,
      'categorie',        v_q.categorie,
      'question',         v_q.question,
      'choices',          v_q.choices,
      'duration_seconds', v_q.duration_seconds,
      'elapsed_ms',       round(v_elapsed * 1000),
      'closed',           v_closed,
      'audio_url',        v_q.audio_url,
      'audio_debut',      v_q.audio_debut,
      'answers_count',    (select count(*) from public.quiz_answers where question_id = v_q.id),
      'correct_index',    case when v_closed then v_q.correct_index end,
      'reponse',          case when v_closed then v_q.reponse end,
      'anecdote',         case when v_closed then v_q.anecdote end,
      'pochette_url',     case when v_closed then v_q.pochette_url end,
      'distribution', case when not v_closed then null else
        (select coalesce(json_agg(n order by idx), '[]'::json) from (
          select gs.idx, count(a.id)::int as n
          from generate_series(0, jsonb_array_length(v_q.choices) - 1) gs(idx)
          left join public.quiz_answers a
            on a.question_id = v_q.id and a.answer_index = gs.idx
          group by gs.idx) d) end,
      'rapides', case when not v_closed then null else
        coalesce((select json_agg(json_build_object('pseudo', r.pseudo, 'avatar', r.archetype, 'ms', r.response_ms)
                                  order by r.response_ms, r.answered_at)
          from (select p.pseudo, p.archetype, a.response_ms, a.answered_at
                from public.quiz_answers a
                join public.players p on p.id = a.player_id and p.status = 'actif'
                where a.question_id = v_q.id and a.is_correct
                order by a.response_ms, a.answered_at limit 3) r), '[]'::json) end) end,

    -- Top 10 de la manche (quiz_scores, sur index) : chrono fini ou manche close
    'top', case when not v_closed and v_session.current_question > 0 then null else
      coalesce((select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype,
                                                  'points', t.points, 'bonnes', t.bonnes)
                                order by t.points desc, t.derniere_at)
        from (select p.pseudo, p.archetype, s.points, s.bonnes, s.derniere_at
              from public.quiz_scores s
              join public.players p on p.id = s.player_id and p.status = 'actif'
              where s.session_id = v_session.id
              order by s.points desc, s.derniere_at limit 10) t), '[]'::json) end);
end;
$function$;

revoke all on function public.quiz_board() from public, anon, authenticated;
grant execute on function public.quiz_board() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Console d'administration (étape 6.1) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- console_accueil() : TOUT le tableau de bord de la console en un appel,
-- relu au signal du temps réel (au plus une fois toutes les 5 s) ou toutes
-- les 60 s. Otaku envoyait 7 requêtes (stats, événements, annonces,
-- classement, phase, bonus, identité), dont leaderboard_view (152 ms).
--   · acces    : qui est connecté (mon_acces) ;
--   · chiffres : joueurs, nouveaux et venus aujourd'hui, exclus, scans et XP
--                de la journée de jeu, journées ouvertes par ticket ;
--   · top      : tournoi du jour, 5 premiers (index players_classement_jour_idx) ;
--   · manche   : blind test en cours (titre, question n / N) ;
--   · fil      : 15 derniers faits utiles (index partiel events_console_idx :
--                ni les scans de scènes et de stands, ni les niveaux) ;
--   · bonus    : points offerts depuis 6 h — total, par personne, 12 derniers
--                (index partiel events_bonus_idx : ce panneau EST le garde-fou
--                des bonus sans plafond) ;
--   · annonces : en cours (48 h, pas finies), 3 dernières + nombre ;
--   · contenu  : ce qui est déjà saisi (QR, missions, lots, artistes,
--                concerts, lieux placés, manches) avant le festival.
-- Réservée au staff et au GM (pas aux vendeurs).
-- ----------------------------------------------------------------------------

create index if not exists events_console_idx on public.events (created_at desc)
  where type not in ('scan', 'level_up')
     or (type = 'scan' and payload->>'qr_type' = 'relique');
create index if not exists events_bonus_idx on public.events (created_at desc)
  where type = 'bonus';

create or replace function public.console_accueil()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_jour  date := public.jour_jeu();          -- UNE fois (voir _classement)
  v_debut timestamptz := public._debut_jour_jeu();
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  return json_build_object(
    'acces',      public.mon_acces(),
    'jour',       v_jour,
    'jour_label', public.jour_festival_label(v_jour),
    'phase',      (select g.phase from public.game_state g where g.id = 1),
    'roi_veille', public.roi_veille(),

    'chiffres', json_build_object(
      'joueurs',        (select count(*) from public.players where status = 'actif'),
      'exclus',         (select count(*) from public.players where status = 'exclu' and efface_le is null),
      'nouveaux_jour',  (select count(*) from public.players where created_at >= v_debut),
      'joueurs_jour',   (select count(*) from public.players
                         where status = 'actif' and jour = v_jour and xp_jour > 0),
      'xp_jour',        (select coalesce(sum(xp_jour), 0) from public.players
                         where status = 'actif' and jour = v_jour),
      'scans_jour',     (select count(*) from public.scans where day = v_jour),
      'tickets_jour',   (select count(*) from public.tickets where jour = v_jour and utilise_par is not null),
      'billetterie',    (select b.actif from public.billetterie_config b where b.id = 1)
    ),

    'top', coalesce((
      select json_agg(json_build_object('pseudo', t.pseudo, 'avatar', t.archetype,
                                        'points', t.xp_jour, 'xp', t.xp) order by t.xp_jour desc, t.created_at)
      from (select pseudo, archetype, xp, xp_jour, created_at from public.players
            where status = 'actif' and jour = v_jour and xp_jour > 0
            order by xp_jour desc, created_at limit 5) t), '[]'::json),

    'manche', (
      select json_build_object('id', s.id, 'titre', s.title, 'boss', s.boss_name,
                               'question', s.current_question,
                               'questions', (select count(*) from public.quiz_questions q where q.session_id = s.id))
      from public.quiz_sessions s where s.status = 'en_cours'
      order by s.created_at desc limit 1),

    'fil', coalesce((
      select json_agg(json_build_object('id', e.id, 'type', e.type, 'at', e.created_at,
                                        'message', e.payload->>'message', 'pseudo', p.pseudo)
                      order by e.created_at desc)
      from (select id, type, payload, player_id, created_at from public.events
            where type not in ('scan', 'level_up')
               or (type = 'scan' and payload->>'qr_type' = 'relique')
            order by created_at desc limit 15) e
      left join public.players p on p.id = e.player_id), '[]'::json),

    'bonus', (
      with b as (
        select e.created_at, coalesce(e.payload->>'par', 'Game Master') as par,
               coalesce((e.payload->>'xp')::int, 0) as xp, e.payload->>'reason' as motif, p.pseudo
        from public.events e
        left join public.players p on p.id = e.player_id
        where e.type = 'bonus' and e.created_at >= v_debut
      )
      select json_build_object(
        'total', coalesce((select sum(xp) from b), 0),
        'gestes', (select count(*) from b),
        'par', coalesce((select json_agg(json_build_object('par', par, 'xp', xp, 'gestes', n) order by xp desc)
                         from (select par, sum(xp)::int as xp, count(*)::int as n from b group by par) x), '[]'::json),
        'derniers', coalesce((select json_agg(json_build_object('at', created_at, 'par', par, 'joueur', pseudo,
                                                                'xp', xp, 'motif', motif) order by created_at desc)
                              from (select * from b order by created_at desc limit 12) d), '[]'::json))),

    'annonces', json_build_object(
      'en_cours', (select count(*) from public.announcements
                   where created_at >= now() - interval '48 hours' and (fin is null or fin > now())),
      'dernieres', coalesce((
        select json_agg(json_build_object('id', a.id, 'titre', a.titre, 'message', a.message,
                                          'type', a.type, 'created_at', a.created_at) order by a.created_at desc)
        from (select id, titre, message, type, created_at from public.announcements
              where created_at >= now() - interval '48 hours' and (fin is null or fin > now())
              order by created_at desc limit 3) a), '[]'::json)),

    'contenu', json_build_object(
      'qr',         (select count(*) from public.qr_codes),
      'qr_actifs',  (select count(*) from public.qr_codes where active),
      'missions',   (select count(*) from public.quests where active),
      'lots',       (select count(*) from public.roulette_prizes where active),
      'artistes',   (select count(*) from public.artistes),
      'concerts',   (select count(*) from public.creneaux),
      'lieux',      (select count(*) from public.lieux),
      'lieux_places', (select count(*) from public.lieux where x is not null and y is not null),
      'manches',    (select count(*) from public.quiz_sessions where status <> 'terminee')
    )
  );
end;
$function$;

revoke all on function public.console_accueil() from public, anon, authenticated;
grant execute on function public.console_accueil() to authenticated;

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

-- ----------------------------------------------------------------------------
-- Console : écran Joueurs (étape 6.2) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- console_joueurs(recherche, filtre, rang, page) : 50 joueurs par page, triés
--   par XP. Remplace admin_liste_joueurs d'Otaku (tous les joueurs d'un coup,
--   5 sous-requêtes et jour_jeu() pour CHAQUE ligne, filtrage à la frappe).
--   Les détails coûteux (actions du jour, journées jouées) ne sont calculés
--   que pour les 50 lignes affichées.
-- console_joueur(id) : toute la fiche en un appel (Otaku : 4 appels).
-- admin_get_reconnect_code : chaque lecture du code est tracée dans
--   console_journal (qui, quand), table sans aucune politique : ni les
--   téléphones ni l'écran géant ne la voient (events est public).
-- admin_award_bonus : de 1 à 5 000 XP, jamais de malus (décision du 18/09) ;
--   le nom de celui qui donne part dans le journal (payload.par).
-- admin_effacer_joueur : GM seul. Le joueur n'est PAS supprimé : son ticket
--   payé repasserait « libre » (tickets.utilise_par → null) et la caisse
--   baisserait. On retire son identité (pseudo anonyme, code secret,
--   téléphone), on anonymise ses messages dans le journal public et le roi
--   du jour ; le reste (scans, réponses, cœurs) devient anonyme.
-- Réservées au staff et au GM (pas aux vendeurs : leur espace, étape 6.7).
-- ----------------------------------------------------------------------------

create table public.console_journal (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  par        uuid,                              -- auth.users (compte staff)
  par_nom    text not null,
  action     text not null,
  joueur_id  uuid references public.players(id) on delete set null,
  detail     jsonb,
  constraint console_journal_action check (action in ('code_lu', 'effacement'))
);
create index console_journal_joueur_idx on public.console_journal (joueur_id, at desc);
-- Aucune politique : lue et écrite seulement par les fonctions ci-dessous.
alter table public.console_journal enable row level security;
revoke all on sequence public.console_journal_id_seq from public, anon, authenticated;

create or replace function public._staff_nom()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select display_name from public.staff where user_id = auth.uid()), 'Équipe');
$function$;

-- ---------------------------------------------------------------------------
-- La liste
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

-- ---------------------------------------------------------------------------
-- La fiche
-- ---------------------------------------------------------------------------
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
-- Code de reprise : lu à la demande, et chaque lecture est tracée
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_reconnect_code(p_player_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_code text;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  select secret_code into v_code from public.player_secrets where player_id = p_player_id;
  if v_code is null then raise exception 'JOUEUR_INCONNU'; end if;
  insert into public.console_journal (par, par_nom, action, joueur_id)
  values (auth.uid(), public._staff_nom(), 'code_lu', p_player_id);
  return v_code;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Bonus : de 1 à 5 000 XP, jamais de malus ; qui donne est écrit
-- ---------------------------------------------------------------------------
create or replace function public.admin_award_bonus(p_player_id uuid, p_xp integer, p_reason text default null::text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_player    public.players%rowtype;
  v_old_level int;
  v_par       text := public._staff_nom();
  v_motif     text := left(nullif(trim(coalesce(p_reason, '')), ''), 80);
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  -- L'XP ne baisse jamais (règle d'Otaku, tenue en base depuis le 18/09)
  if p_xp is null or p_xp < 1 or p_xp > 5000 then raise exception 'BONUS_INVALIDE'; end if;

  select * into v_player from public.players where id = p_player_id for update;
  if v_player.id is null or v_player.efface_le is not null then raise exception 'JOUEUR_INCONNU'; end if;

  v_old_level := public.level_for_xp(v_player.xp);

  -- Porte de secours du GM (REGLES.md §15.4) : le bonus passe sans ticket du
  -- jour. Le « true » limite le drapeau à cette transaction.
  perform set_config('dq.pass_bypass', '1', true);

  update public.players set
    xp     = xp + p_xp,
    jetons = jetons + p_xp / 10,
    level  = public.level_for_xp(xp + p_xp),
    rank   = public.rank_for_level(public.level_for_xp(xp + p_xp))
  where id = p_player_id
  returning * into v_player;

  insert into public.events (type, player_id, payload)
  values ('bonus', p_player_id, jsonb_build_object(
    'message', 'Le Game Master accorde +' || p_xp || ' XP à ' || v_player.pseudo
               || coalesce(' — ' || v_motif, ''),
    'xp', p_xp, 'reason', v_motif, 'par', v_par));

  if v_player.level > v_old_level then
    insert into public.events (type, player_id, payload)
    values ('level_up', p_player_id, jsonb_build_object(
      'message', v_player.pseudo || ' passe au niveau ' || v_player.level || ' !',
      'level', v_player.level, 'old_level', v_old_level));
  end if;

  return row_to_json(v_player);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Effacement au stand (GM seul) : identité retirée, ligne gardée anonyme
-- ---------------------------------------------------------------------------
create or replace function public.admin_effacer_joueur(p_player_id uuid, p_confirmation text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_p     public.players%rowtype;
  v_anon  text;
  v_motif text;
  v_n     int := 6;
begin
  if not public.is_gm() then raise exception 'ACCES_REFUSE'; end if;

  select * into v_p from public.players where id = p_player_id for update;
  if v_p.id is null or v_p.efface_le is not null then raise exception 'JOUEUR_INCONNU'; end if;
  -- Le GM retape le pseudo : on n'efface pas le mauvais joueur d'un clic
  if lower(trim(coalesce(p_confirmation, ''))) <> lower(v_p.pseudo) then
    raise exception 'CONFIRMATION_INVALIDE';
  end if;

  -- Nouveau pseudo : « Effacé-3FA2C1 » (16 caractères au plus, unique)
  loop
    v_anon := 'Effacé-' || upper(left(replace(v_p.id::text, '-', ''), v_n));
    exit when not exists (select 1 from public.players where lower(pseudo) = lower(v_anon));
    v_n := v_n + 1;
  end loop;

  -- Le pseudo dans les messages publics du journal, seulement en mot entier
  -- (« Al » ne doit pas abîmer « Alpha »)
  v_motif := '(^|[^[:alnum:]_])'
          || regexp_replace(v_p.pseudo, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
          || '($|[^[:alnum:]_])';
  update public.events
     set payload = jsonb_set(payload, '{message}',
                             to_jsonb(regexp_replace(payload->>'message', v_motif, '\1Un joueur\2', 'g')))
   where player_id = p_player_id and payload ? 'message';

  update public.tournament_kings set pseudo = v_anon where pseudo = v_p.pseudo;

  delete from public.player_secrets where player_id = p_player_id;   -- plus de reprise possible
  delete from public.player_contact where player_id = p_player_id;   -- numéro de téléphone

  update public.players
     set pseudo = v_anon, status = 'exclu', efface_le = now()
   where id = p_player_id;

  insert into public.console_journal (par, par_nom, action, joueur_id, detail)
  values (auth.uid(), public._staff_nom(), 'effacement', p_player_id,
          jsonb_build_object('xp', v_p.xp, 'inscrit', v_p.created_at));

  return json_build_object('pseudo', v_anon);
end;
$function$;

revoke all on function public._staff_nom() from public, anon, authenticated;
revoke all on function public.console_joueurs(p_recherche text, p_filtre text, p_rang text, p_page integer) from public, anon, authenticated;
grant execute on function public.console_joueurs(p_recherche text, p_filtre text, p_rang text, p_page integer) to authenticated;
revoke all on function public.console_joueur(p_player_id uuid) from public, anon, authenticated;
grant execute on function public.console_joueur(p_player_id uuid) to authenticated;
revoke all on function public.admin_get_reconnect_code(p_player_id uuid) from public, anon, authenticated;
grant execute on function public.admin_get_reconnect_code(p_player_id uuid) to authenticated;
revoke all on function public.admin_award_bonus(p_player_id uuid, p_xp integer, p_reason text) from public, anon, authenticated;
grant execute on function public.admin_award_bonus(p_player_id uuid, p_xp integer, p_reason text) to authenticated;
revoke all on function public.admin_effacer_joueur(p_player_id uuid, p_confirmation text) from public, anon, authenticated;
grant execute on function public.admin_effacer_joueur(p_player_id uuid, p_confirmation text) to authenticated;

-- ----------------------------------------------------------------------------
-- Console : programme du festival (étape 6.4) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Un écran lu en UN appel : console_programme() (lieux et scènes, artistes,
-- concerts, dédicaces, styles de la fiche fan). Un enregistrement par
-- formulaire, tous les champs d'un coup (décision du 19/09 : fonctions
-- validées plutôt qu'écriture directe dans les tables) :
--   console_lieu_enregistrer · console_artiste_enregistrer
--   console_concert_enregistrer · console_dedicace_enregistrer
--   console_programme_supprimer · console_programme_activer
-- Règles :
--   · une scène = un lieu + sa ligne dans scenes, écrits ensemble ;
--   · l'identifiant lisible (« nova-kassa ») est FIGÉ après la création : les
--     cœurs (coeurs.cible, texte sans clé) et les liens programme.html#id en
--     dépendent. Le nom affiché reste libre ;
--   · le style d'un artiste est un des styles de la fiche fan (profil_options)
--     pour que les suggestions de « mon programme » fonctionnent ;
--   · deux concerts d'une même scène ne se chevauchent pas : le concert gênant
--     est nommé (DETAIL de l'erreur) ;
--   · un concert scanné garde son artiste et sa scène (on peut le décaler) ;
--   · suppression refusée dès qu'il y a une trace (scan, cœur) : on éteint
--     (artiste « pas encore annoncé », lieu retiré du plan) ou on déplace.
-- Le lien lieu ↔ QR et séance ↔ QR se règle dans l'écran QR (6.3) : ici en
-- lecture seulement. Réservées au staff et au GM (pas aux vendeurs).
-- ----------------------------------------------------------------------------

-- Les styles de la fiche fan (valeurs de profil_options)
create or replace function public._genres_artiste()
 returns text[]
 language sql
 stable
 set search_path to 'public'
as $function$
  select array_agg(g ->> 'valeur')
    from json_array_elements(public.profil_options() -> 'genre_prefere') g;
$function$;

-- Une date lue dans le JSON d'un formulaire (null si absente ou illisible)
create or replace function public._json_instant(p jsonb, p_cle text)
 returns timestamptz
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  if trim(coalesce(p ->> p_cle, '')) !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$' then
    return null;
  end if;
  return (p ->> p_cle)::timestamptz;
exception when others then
  return null;
end;
$function$;

-- ===========================================================================
-- Lecture
-- ===========================================================================
create or replace function public.console_programme()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  return json_build_object(
    'lieux', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'categorie', l.categorie, 'nom', l.nom, 'description', l.description,
        'horaires', l.horaires, 'x', l.x, 'y', l.y, 'pmr', l.pmr, 'ordre', l.ordre, 'actif', l.actif,
        'couleur', s.couleur,
        'qr', case when q.id is not null then json_build_object(
                'id', q.id, 'code', q.code, 'nom', q.label, 'actif', q.active,
                'scans', coalesce((select sum(n) from public.qr_scans_jour t where t.qr_code_id = q.id), 0)) end,
        'coeurs', coalesce(ct.n, 0),
        'concerts', (select count(*) from public.creneaux c where c.scene_id = l.id),
        'dedicaces', (select count(*) from public.dedicaces d where d.lieu_id = l.id))
        order by l.categorie, l.ordre, l.nom)
      from public.lieux l
      left join public.scenes s on s.id = l.id
      left join public.qr_codes q on q.id = l.qr_code_id
      left join public.coeurs_totaux ct on ct.categorie = 'stands' and ct.cible = l.id
    ), '[]'::json),
    'artistes', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'nom', a.nom, 'genre', a.genre, 'bio', a.bio, 'photo_url', a.photo_url,
        'tete_affiche', a.tete_affiche, 'actif', a.actif, 'coeurs', coalesce(ct.n, 0))
        order by a.nom)
      from public.artistes a
      left join public.coeurs_totaux ct on ct.categorie = 'artistes' and ct.cible = a.id
    ), '[]'::json),
    -- scanne : au moins un scan pendant ce concert (index scans_creneau_idx)
    'concerts', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'artiste_id', c.artiste_id, 'scene_id', c.scene_id, 'debut', c.debut, 'fin', c.fin,
        'favoris', coalesce(f.n, 0),
        'scanne', exists (select 1 from public.scans s where s.creneau_id = c.id))
        order by c.debut)
      from public.creneaux c
      left join (select creneau_id, count(*) as n from public.favoris_programme group by creneau_id) f
        on f.creneau_id = c.id
    ), '[]'::json),
    'dedicaces', coalesce((
      select json_agg(json_build_object(
        'id', d.id, 'artiste_id', d.artiste_id, 'lieu_id', d.lieu_id, 'debut', d.debut, 'fin', d.fin,
        'qr', case when q.id is not null then json_build_object(
                'id', q.id, 'code', q.code, 'nom', q.label, 'actif', q.active) end,
        'scanne', d.qr_code_id is not null
                  and exists (select 1 from public.qr_scans_jour t where t.qr_code_id = d.qr_code_id and t.n > 0))
        order by d.debut)
      from public.dedicaces d
      left join public.qr_codes q on q.id = d.qr_code_id
    ), '[]'::json),
    'genres', public.profil_options() -> 'genre_prefere'
  );
end;
$function$;

-- ===========================================================================
-- Lieux et scènes
-- ===========================================================================
create or replace function public.console_lieu_enregistrer(p_id text, p_lieu jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id       text := nullif(lower(trim(coalesce(p_lieu ->> 'id', ''))), '');
  v_cat      text := nullif(trim(coalesce(p_lieu ->> 'categorie', '')), '');
  v_nom      text := nullif(trim(coalesce(p_lieu ->> 'nom', '')), '');
  v_desc     text := nullif(trim(coalesce(p_lieu ->> 'description', '')), '');
  v_horaires text := nullif(trim(coalesce(p_lieu ->> 'horaires', '')), '');
  v_x        integer := public._json_entier(p_lieu, 'x');
  v_y        integer := public._json_entier(p_lieu, 'y');
  v_pmr      boolean := case p_lieu ->> 'pmr' when 'true' then true when 'false' then false end;
  v_ordre    integer := coalesce(public._json_entier(p_lieu, 'ordre'), 0);
  v_actif    boolean := coalesce((p_lieu ->> 'actif')::boolean, true);
  v_couleur  text := coalesce(nullif(trim(coalesce(p_lieu ->> 'couleur', '')), ''), 'nuit');
  v_avant    public.lieux%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_nom is null or char_length(v_nom) > 80 then raise exception 'NOM_MANQUANT'; end if;
  if char_length(coalesce(v_desc, '')) > 400 then raise exception 'DESCRIPTION_TROP_LONGUE'; end if;
  if char_length(coalesce(v_horaires, '')) > 80 then raise exception 'HORAIRES_TROP_LONGS'; end if;
  if v_cat is null or v_cat not in ('scene','stand','food','eau','toilettes','secours','abri','service','entree') then
    raise exception 'CATEGORIE_INVALIDE';
  end if;
  -- Place sur le fond du plan (1000 × 700 unités), les deux ou aucune
  if (v_x is null) <> (v_y is null) or v_x not between 0 and 1000 or v_y not between 0 and 700 then
    raise exception 'POSITION_INVALIDE';
  end if;
  if v_ordre not between -999 and 999 then raise exception 'ORDRE_INVALIDE'; end if;
  if v_couleur not in ('sodium','vert','rose','bleu','nuit','rouge','papier') then raise exception 'COULEUR_INVALIDE'; end if;

  if p_id is null then
    if v_id is null or v_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_id) > 40 then raise exception 'ID_INVALIDE'; end if;
    if exists (select 1 from public.lieux where id = v_id) then raise exception 'ID_PRIS'; end if;
    insert into public.lieux (id, categorie, nom, description, horaires, x, y, pmr, ordre, actif)
    values (v_id, v_cat, v_nom, v_desc, v_horaires, v_x, v_y, v_pmr, v_ordre, v_actif);
    if v_cat = 'scene' then
      insert into public.scenes (id, couleur, ordre) values (v_id, v_couleur, v_ordre);
    end if;
    return json_build_object('id', v_id);
  end if;

  select * into v_avant from public.lieux where id = p_id for update;
  if v_avant.id is null then raise exception 'LIEU_INCONNU'; end if;
  -- Changer de catégorie : jamais pour une scène (ses concerts), ni quand le
  -- lieu a son QR (le type du QR en dépend) ou des cœurs (vote des stands)
  if v_cat <> v_avant.categorie then
    if v_cat = 'scene' or v_avant.categorie = 'scene' then raise exception 'CATEGORIE_SCENE_FIGEE'; end if;
    if v_avant.qr_code_id is not null then raise exception 'CATEGORIE_QR_RELIE'; end if;
    if exists (select 1 from public.coeurs_totaux where categorie = 'stands' and cible = p_id and n > 0) then
      raise exception 'CATEGORIE_COEURS';
    end if;
  end if;
  update public.lieux
     set categorie = v_cat, nom = v_nom, description = v_desc, horaires = v_horaires,
         x = v_x, y = v_y, pmr = v_pmr, ordre = v_ordre, actif = v_actif
   where id = p_id;
  if v_cat = 'scene' then
    update public.scenes set couleur = v_couleur, ordre = v_ordre where id = p_id;
  end if;
  return json_build_object('id', p_id);
end;
$function$;

-- ===========================================================================
-- Artistes
-- ===========================================================================
create or replace function public.console_artiste_enregistrer(p_id text, p_artiste jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id    text := nullif(lower(trim(coalesce(p_artiste ->> 'id', ''))), '');
  v_nom   text := nullif(trim(coalesce(p_artiste ->> 'nom', '')), '');
  v_genre text := nullif(trim(coalesce(p_artiste ->> 'genre', '')), '');
  v_bio   text := nullif(trim(coalesce(p_artiste ->> 'bio', '')), '');
  v_photo text := nullif(trim(coalesce(p_artiste ->> 'photo_url', '')), '');
  v_tete  boolean := coalesce((p_artiste ->> 'tete_affiche')::boolean, false);
  -- Pas encore annoncé par défaut : on l'allume le jour de l'annonce
  v_actif boolean := coalesce((p_artiste ->> 'actif')::boolean, false);
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_nom is null or char_length(v_nom) > 80 then raise exception 'NOM_MANQUANT'; end if;
  if v_genre is not null and not (v_genre = any (public._genres_artiste())) then raise exception 'GENRE_INVALIDE'; end if;
  if char_length(coalesce(v_bio, '')) > 600 then raise exception 'BIO_TROP_LONGUE'; end if;
  -- Un fichier du site (passé par outils/photos.py) ou une adresse https
  if v_photo is not null and v_photo !~ '^assets/photos/[a-z0-9-]+[.](webp|jpg|jpeg|png)$'
     and (v_photo !~ '^https://[^\s"<>]+$' or char_length(v_photo) > 300) then
    raise exception 'PHOTO_INVALIDE';
  end if;

  if p_id is null then
    if v_id is null or v_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_id) > 60 then raise exception 'ID_INVALIDE'; end if;
    if exists (select 1 from public.artistes where id = v_id) then raise exception 'ID_PRIS'; end if;
    insert into public.artistes (id, nom, genre, bio, photo_url, tete_affiche, actif)
    values (v_id, v_nom, v_genre, v_bio, v_photo, v_tete, v_actif);
    return json_build_object('id', v_id);
  end if;

  update public.artistes
     set nom = v_nom, genre = v_genre, bio = v_bio, photo_url = v_photo, tete_affiche = v_tete, actif = v_actif
   where id = p_id;
  if not found then raise exception 'ARTISTE_INCONNU'; end if;
  return json_build_object('id', p_id);
end;
$function$;

-- ===========================================================================
-- Concerts
-- ===========================================================================
create or replace function public.console_concert_enregistrer(p_id uuid, p_concert jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_artiste text := nullif(trim(coalesce(p_concert ->> 'artiste_id', '')), '');
  v_scene   text := nullif(trim(coalesce(p_concert ->> 'scene_id', '')), '');
  v_debut   timestamptz := public._json_instant(p_concert, 'debut');
  v_fin     timestamptz := public._json_instant(p_concert, 'fin');
  v_avant   public.creneaux%rowtype;
  v_gene    record;
  v_id      uuid;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_artiste is null or not exists (select 1 from public.artistes where id = v_artiste) then
    raise exception 'ARTISTE_INCONNU';
  end if;
  if v_scene is null or not exists (select 1 from public.scenes where id = v_scene) then
    raise exception 'SCENE_INCONNUE';
  end if;
  if v_debut is null or v_fin is null then raise exception 'HEURE_INVALIDE'; end if;
  if v_fin <= v_debut or v_fin > v_debut + interval '12 hours' then raise exception 'DUREE_INVALIDE'; end if;

  if p_id is not null then
    select * into v_avant from public.creneaux where id = p_id for update;
    if v_avant.id is null then raise exception 'CONCERT_INCONNU'; end if;
    -- Scanné : les joueurs l'ont « vu » sur cette scène, avec cet artiste
    if (v_artiste <> v_avant.artiste_id or v_scene <> v_avant.scene_id)
       and exists (select 1 from public.scans where creneau_id = p_id) then
      raise exception 'CONCERT_DEJA_SCANNE';
    end if;
  end if;

  -- Même règle que la contrainte creneaux_sans_chevauchement, mais en nommant le concert gênant
  select a.nom, c.debut, c.fin into v_gene
    from public.creneaux c join public.artistes a on a.id = c.artiste_id
   where c.scene_id = v_scene and c.id is distinct from p_id
     and tstzrange(c.debut, c.fin) && tstzrange(v_debut, v_fin)
   order by c.debut limit 1;
  if found then
    raise exception 'CHEVAUCHEMENT' using detail = json_build_object(
      'artiste', v_gene.nom, 'debut', v_gene.debut, 'fin', v_gene.fin)::text;
  end if;

  if p_id is null then
    insert into public.creneaux (artiste_id, scene_id, debut, fin)
    values (v_artiste, v_scene, v_debut, v_fin)
    returning id into v_id;
  else
    update public.creneaux
       set artiste_id = v_artiste, scene_id = v_scene, debut = v_debut, fin = v_fin
     where id = p_id
    returning id into v_id;
  end if;
  return json_build_object('id', v_id);
exception when exclusion_violation then
  -- Enregistré en même temps depuis un autre poste
  raise exception 'CHEVAUCHEMENT';
end;
$function$;

-- ===========================================================================
-- Dédicaces
-- ===========================================================================
create or replace function public.console_dedicace_enregistrer(p_id uuid, p_dedicace jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_artiste text := nullif(trim(coalesce(p_dedicace ->> 'artiste_id', '')), '');
  v_lieu    text := nullif(trim(coalesce(p_dedicace ->> 'lieu_id', '')), '');
  v_debut   timestamptz := public._json_instant(p_dedicace, 'debut');
  v_fin     timestamptz := public._json_instant(p_dedicace, 'fin');
  v_avant   public.dedicaces%rowtype;
  v_id      uuid;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_artiste is null or not exists (select 1 from public.artistes where id = v_artiste) then
    raise exception 'ARTISTE_INCONNU';
  end if;
  if v_lieu is not null and not exists (select 1 from public.lieux where id = v_lieu) then
    raise exception 'LIEU_INCONNU';
  end if;
  if v_debut is null or v_fin is null then raise exception 'HEURE_INVALIDE'; end if;
  if v_fin <= v_debut or v_fin > v_debut + interval '12 hours' then raise exception 'DUREE_INVALIDE'; end if;

  if p_id is null then
    insert into public.dedicaces (artiste_id, lieu_id, debut, fin)
    values (v_artiste, v_lieu, v_debut, v_fin)
    returning id into v_id;
    return json_build_object('id', v_id);
  end if;

  select * into v_avant from public.dedicaces where id = p_id for update;
  if v_avant.id is null then raise exception 'DEDICACE_INCONNUE'; end if;
  -- Son QR scanné : les joueurs ont « vu » CET artiste
  if v_artiste <> v_avant.artiste_id and v_avant.qr_code_id is not null
     and exists (select 1 from public.scans where qr_code_id = v_avant.qr_code_id) then
    raise exception 'DEDICACE_DEJA_SCANNEE';
  end if;
  update public.dedicaces
     set artiste_id = v_artiste, lieu_id = v_lieu, debut = v_debut, fin = v_fin
   where id = p_id;
  return json_build_object('id', p_id);
end;
$function$;

-- ===========================================================================
-- Supprimer, allumer / éteindre
-- ===========================================================================
-- p_quoi : lieu | artiste | concert | dedicace. Renvoie ce qui est parti avec
-- (favoris des joueurs, concerts, séances) pour le message de la console.
create or replace function public.console_programme_supprimer(p_quoi text, p_id text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uuid     uuid;
  v_lieu     public.lieux%rowtype;
  v_favoris  integer := 0;
  v_concerts integer := 0;
  v_seances  integer := 0;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  if p_quoi = 'lieu' then
    select * into v_lieu from public.lieux where id = p_id for update;
    if v_lieu.id is null then raise exception 'LIEU_INCONNU'; end if;
    if exists (select 1 from public.creneaux where scene_id = p_id) then raise exception 'SCENE_A_DES_CONCERTS'; end if;
    -- Son QR scanné : le stand est dans des collections ; des cœurs : dans le palmarès
    if v_lieu.qr_code_id is not null
       and exists (select 1 from public.scans where qr_code_id = v_lieu.qr_code_id) then
      raise exception 'LIEU_DEJA_SCANNE';
    end if;
    if exists (select 1 from public.coeurs_totaux where categorie = 'stands' and cible = p_id and n > 0) then
      raise exception 'LIEU_A_DES_COEURS';
    end if;
    select count(*) into v_seances from public.dedicaces where lieu_id = p_id;
    delete from public.lieux where id = p_id;   -- scène : sa ligne part aussi ; QR, séances : déliés
    return json_build_object('seances', v_seances);

  elsif p_quoi = 'artiste' then
    if not exists (select 1 from public.artistes where id = p_id) then raise exception 'ARTISTE_INCONNU'; end if;
    if exists (select 1 from public.scans s join public.creneaux c on c.id = s.creneau_id where c.artiste_id = p_id)
       or exists (select 1 from public.scans s join public.dedicaces d on d.qr_code_id = s.qr_code_id where d.artiste_id = p_id) then
      raise exception 'ARTISTE_DEJA_VU';
    end if;
    if exists (select 1 from public.coeurs_totaux where categorie = 'artistes' and cible = p_id and n > 0) then
      raise exception 'ARTISTE_A_DES_COEURS';
    end if;
    select count(*) into v_favoris
      from public.favoris_programme f join public.creneaux c on c.id = f.creneau_id where c.artiste_id = p_id;
    select count(*) into v_concerts from public.creneaux where artiste_id = p_id;
    select count(*) into v_seances from public.dedicaces where artiste_id = p_id;
    delete from public.artistes where id = p_id;   -- concerts, séances, favoris : partent avec
    return json_build_object('favoris', v_favoris, 'concerts', v_concerts, 'seances', v_seances);

  elsif p_quoi in ('concert', 'dedicace') then
    v_uuid := public._json_uuid(jsonb_build_object('id', p_id), 'id');
    if p_quoi = 'concert' then
      if v_uuid is null or not exists (select 1 from public.creneaux where id = v_uuid) then raise exception 'CONCERT_INCONNU'; end if;
      if exists (select 1 from public.scans where creneau_id = v_uuid) then raise exception 'CONCERT_DEJA_SCANNE'; end if;
      select count(*) into v_favoris from public.favoris_programme where creneau_id = v_uuid;
      delete from public.creneaux where id = v_uuid;
      return json_build_object('favoris', v_favoris);
    end if;
    if v_uuid is null or not exists (select 1 from public.dedicaces where id = v_uuid) then raise exception 'DEDICACE_INCONNUE'; end if;
    if exists (select 1 from public.dedicaces d join public.scans s on s.qr_code_id = d.qr_code_id where d.id = v_uuid) then
      raise exception 'DEDICACE_DEJA_SCANNEE';
    end if;
    delete from public.dedicaces where id = v_uuid;   -- son QR : délié
    return json_build_object();
  end if;
  raise exception 'QUOI_INVALIDE';
end;
$function$;

-- Interrupteur de la liste : lieu (retiré du plan) ou artiste (annoncé ou non)
create or replace function public.console_programme_activer(p_quoi text, p_id text, p_actif boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_actif is null then raise exception 'ETAT_INVALIDE'; end if;
  if p_quoi = 'lieu' then
    update public.lieux set actif = p_actif where id = p_id;
    if not found then raise exception 'LIEU_INCONNU'; end if;
  elsif p_quoi = 'artiste' then
    update public.artistes set actif = p_actif where id = p_id;
    if not found then raise exception 'ARTISTE_INCONNU'; end if;
  else
    raise exception 'QUOI_INVALIDE';
  end if;
  return json_build_object('id', p_id, 'actif', p_actif);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Droits : comptes connectés seulement, chaque fonction vérifie le rôle
-- ---------------------------------------------------------------------------
revoke all on function public._genres_artiste() from public, anon, authenticated;
revoke all on function public._json_instant(p jsonb, p_cle text) from public, anon, authenticated;
revoke all on function public.console_programme() from public, anon, authenticated;
grant execute on function public.console_programme() to authenticated;
revoke all on function public.console_lieu_enregistrer(p_id text, p_lieu jsonb) from public, anon, authenticated;
grant execute on function public.console_lieu_enregistrer(p_id text, p_lieu jsonb) to authenticated;
revoke all on function public.console_artiste_enregistrer(p_id text, p_artiste jsonb) from public, anon, authenticated;
grant execute on function public.console_artiste_enregistrer(p_id text, p_artiste jsonb) to authenticated;
revoke all on function public.console_concert_enregistrer(p_id uuid, p_concert jsonb) from public, anon, authenticated;
grant execute on function public.console_concert_enregistrer(p_id uuid, p_concert jsonb) to authenticated;
revoke all on function public.console_dedicace_enregistrer(p_id uuid, p_dedicace jsonb) from public, anon, authenticated;
grant execute on function public.console_dedicace_enregistrer(p_id uuid, p_dedicace jsonb) to authenticated;
revoke all on function public.console_programme_supprimer(p_quoi text, p_id text) from public, anon, authenticated;
grant execute on function public.console_programme_supprimer(p_quoi text, p_id text) to authenticated;
revoke all on function public.console_programme_activer(p_quoi text, p_id text, p_actif boolean) from public, anon, authenticated;
grant execute on function public.console_programme_activer(p_quoi text, p_id text, p_actif boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Temps réel : uniquement ce que l'écran géant et la console écoutent
-- ----------------------------------------------------------------------------
ALTER publication supabase_realtime add table public.players;
ALTER publication supabase_realtime add table public.announcements;
ALTER publication supabase_realtime add table public.events;
ALTER publication supabase_realtime add table public.game_state;

commit;
