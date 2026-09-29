-- ============================================================================
-- Correctif du 29/09/2026 (Vimas, étape 8) — la base passe au VIMAS FEST
-- ----------------------------------------------------------------------------
-- Décision de Jarvis (29/09) : « l'ancienne base du DOMAF ne m'intéresse pas,
-- on n'y a rien fait, tu peux tout remplacer ». Donc, SANS sauvegarde :
--
--  1. EFFACE toutes les données de jeu et tout le contenu DOMAF : joueurs,
--     codes, scans, missions, QR, lieux, scènes, artistes, concerts, dédicaces,
--     lots, annonces, blind tests, cœurs, coffres, réponses, tickets, carnets…
--     GARDE : les comptes de la console (staff), les réglages (game_state,
--     *_config) et le catalogue des badges.
--  2. Fonctions (copiées de 00_schema.sql régénéré, même texte) :
--       jour_festival_label  samedi 26 et dimanche 27 décembre
--       _code_secret_tirage  mots de Yaoundé au lieu de Douala (MELEN, ESSOS…)
--       scan_qr              badges de jour : Lève-tôt avant midi, « Jusqu'au
--                            bout » (ex-Noctambule) dès 20 h, Marathonien sur
--                            2 jours, Curieux à 3 stands
--       _is_system_badge     « Jusqu'au bout » au lieu de « Noctambule »
--       profil_options       quartiers de Yaoundé (ceux du téléphone)
--       _collecte_soir       questions de fin de journée dès 18 h
--  3. Réglages et badges : clôture des cœurs le 27/12 à 20 h, questions du soir
--     à 18 h, message de la billetterie, textes et noms des badges.
--  4. Banque de questions du coffre Vimas (01_reference.sql).
--
-- À coller dans l'éditeur SQL de Supabase (projet domaf-quest), puis Run.
-- Irréversible pour les données (voulu). Rejouable.
-- ============================================================================
begin;

-- 1. Tout le contenu et toutes les données de jeu DOMAF
truncate table coffres, micro_votes, coeurs, coeurs_totaux, favoris_programme, dedicaces, creneaux, artistes, scenes, lieux, quiz_answers, quiz_scores, quiz_questions, quiz_sessions, roulette_spins, roulette_prizes, announcements, quest_progress, missions_faites_jour, qr_scans_jour, scans, quests, qr_codes, events, tournament_kings, tickets, carnets, console_journal, player_badges, player_contact, player_profile, player_secrets, players, micro_questions restart identity cascade;
update public.game_state set phase = 'EXPLORATION', updated_at = now() where id = 1;

-- 2. Fonctions
create or replace function public._code_secret_tirage()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  -- 100 mots de musique et de Yaoundé (Vimas Quest), tous de 6 lettres au maximum (contrainte des 12
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
      'MELEN','ESSOS','OBILI','MVOG','BASTOS','EMANA','NGOA','MOKOLO','ETOUDI','VIMAS',
      'LION','AIGLE','COBRA','ZEBRE','LUNE','ETOILE','SOLEIL','FLAMME','IDOLE','STAR'
    ]) as t(mot)
    order by random()
    limit 1
  ) w;
$function$
;

create or replace function public._is_system_badge(p_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select p_name in ('Première note', 'Curieux', 'Fouineur', 'Autographe',
                    'Jury', 'Oreille d''or', 'Lève-tôt', 'Jusqu''au bout', 'Marathonien', 'Podium');
$function$
;

create or replace function public.jour_festival_label(p_jour date DEFAULT public.jour_jeu())
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case p_jour
    when date '2026-12-26' then 'samedi'
    when date '2026-12-27' then 'dimanche'
    else to_char(p_jour, 'DD/MM')
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
    if v_count = 3 then
      v_new_badges := array_append(v_new_badges,
        public._award_badge(v_player.id, v_player.pseudo, 'Curieux'));
    end if;
  end if;

  -- Heure du Cameroun (festival de jour, Vimas). Lève-tôt = un scan avant
  -- midi (la journée de jeu commence à 6 h) ; Jusqu'au bout = une scène
  -- scannée pendant un concert, à partir de 20 h.
  v_heure := extract(hour from now() at time zone 'Africa/Douala')::int;
  if v_heure between 6 and 11 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Lève-tôt'));
  end if;
  if v_creneau is not null and (v_heure >= 20 or v_heure < 6) then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Jusqu''au bout'));
  end if;
  -- Marathonien : un scan chacune des 2 journées. Compté seulement au
  -- premier scan de la journée (les autres ne peuvent rien changer).
  if not v_rejeu and not exists (
    select 1 from public.scans
    where player_id = v_player.id and day = public.jour_jeu() and id <> v_scan_id) then
    select count(distinct day) into v_count from public.scans where player_id = v_player.id;
    if v_count >= 2 then
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

-- 3. Réglages et badges
alter table public.coeur_config alter column cloture set default '2026-12-27 20:00:00+01';
update public.coeur_config set cloture = '2026-12-27 20:00:00+01' where id = 1;
alter table public.micro_config alter column soir_debut set default '18:00';
update public.micro_config set soir_debut = '18:00' where id = 1;
update public.billetterie_config
   set message = 'Le jeu Vimas Quest se joue avec un ticket. Demande-le à un membre de l''équipe, il en a sur lui.'
 where id = 1;

update public.badges set name = 'Jusqu''au bout', description = 'Scanner une scène pendant un concert après 20h.' where name = 'Noctambule';
update public.badges set name = 'Sous le soleil' where name = 'Sous les étoiles';
update public.badges set description = 'Scanner un QR avant midi.' where name = 'Lève-tôt';
update public.badges set description = 'Scanner au moins un QR les deux jours.' where name = 'Marathonien';
update public.badges set description = 'Scanner 3 stands différents.' where name = 'Curieux';

-- 4. Banque de questions du coffre (Vimas)
insert into public.micro_questions (id, ordre, code, theme, moment, chaque_jour, ordre_fixe, type, question, options) values
 (1, 1, 'S1', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu comment aujourd''hui ?',
  '[{"valeur": "a-pied", "libelle": "À pied"}, {"valeur": "moto-taxi", "libelle": "Moto-taxi"}, {"valeur": "taxi", "libelle": "Taxi"}, {"valeur": "voiture-personnelle", "libelle": "Voiture personnelle"}, {"valeur": "bus", "libelle": "Bus"}]'::jsonb),
 (2, 2, 'S2', 'venue', 'toujours', false, false, 'choix',
  'Tu as connu le VIMAS FEST comment ?',
  '[{"valeur": "un-ami-m-en-a-parle", "libelle": "Un ami m''en a parlé"}, {"valeur": "facebook-ou-instagram", "libelle": "Facebook ou Instagram"}, {"valeur": "tiktok", "libelle": "TikTok"}, {"valeur": "whatsapp", "libelle": "WhatsApp"}, {"valeur": "radio-ou-tele", "libelle": "Radio ou télé"}, {"valeur": "une-affiche", "libelle": "Une affiche"}, {"valeur": "autrement", "libelle": "Autrement", "bas": true}]'::jsonb),
 (3, 3, 'S3', 'venue', 'toujours', false, false, 'choix',
  'Tu es venu surtout pour…',
  '[{"valeur": "les-concerts", "libelle": "Les concerts"}, {"valeur": "la-mode-et-les-stands", "libelle": "La mode et les stands"}, {"valeur": "la-danse", "libelle": "La danse"}, {"valeur": "accompagner-quelqu-un", "libelle": "Accompagner quelqu''un"}, {"valeur": "tout-le-festival", "libelle": "Tout le festival", "bas": true}]'::jsonb),
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
  'Tu vis à Yaoundé depuis…',
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
  '[{"valeur": "la-musique", "libelle": "La musique"}, {"valeur": "l-ambiance", "libelle": "L''ambiance"}, {"valeur": "le-jeu-vimas-quest", "libelle": "Le jeu Vimas Quest"}, {"valeur": "la-nourriture", "libelle": "La nourriture"}, {"valeur": "l-organisation", "libelle": "L''organisation"}, {"valeur": "les-rencontres", "libelle": "Les rencontres"}]'::jsonb),
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
  'Conseillerais-tu Vimas Quest à un ami ? (0 = pas du tout, 10 = carrément)',
  '[{"valeur": "0", "libelle": "0"}, {"valeur": "1", "libelle": "1"}, {"valeur": "2", "libelle": "2"}, {"valeur": "3", "libelle": "3"}, {"valeur": "4", "libelle": "4"}, {"valeur": "5", "libelle": "5"}, {"valeur": "6", "libelle": "6"}, {"valeur": "7", "libelle": "7"}, {"valeur": "8", "libelle": "8"}, {"valeur": "9", "libelle": "9"}, {"valeur": "10", "libelle": "10"}]'::jsonb),
 (42, 42, 'N11', 'soir', 'soir', false, true, 'choix',
  'Tu reviendras au VIMAS FEST l''an prochain ?',
  '[{"valeur": "oui-sur", "libelle": "Oui, sûr"}, {"valeur": "peut-etre", "libelle": "Peut-être"}, {"valeur": "non", "libelle": "Non"}]'::jsonb)
on conflict (id) do nothing;

commit;

-- Vérification (à coller après) : 0 joueur, 42 questions, le nouveau badge,
-- et le libellé du samedi.
-- select (select count(*) from public.players) as joueurs,
--        (select count(*) from public.micro_questions) as questions,
--        (select count(*) from public.badges where name = 'Jusqu''au bout') as badge,
--        public.jour_festival_label(date '2026-12-26') as samedi;
