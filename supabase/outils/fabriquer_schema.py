"""
Fabrique supabase/00_schema.sql à partir de la structure RÉELLE de la prod Otaku
(supabase/extraction-otaku/*.csv), en appliquant les décisions DOMAF Quest :

  - retrait : chasses au trésor, duels, schéma archive_yaounde ;
  - conservé : raids (= blind test), billetterie / vendeurs, tournoi du jour ;
  - journée de jeu DOMAF : coupure à 6 h (heure de Douala) au lieu de minuit UTC ;
  - habillage musique : types de QR, rangs, badges système, codes secrets,
    profil (genre musical au lieu de l'animé), textes du blind test.

Chaque remplacement est VÉRIFIÉ : si le texte attendu n'est plus trouvé, le
script s'arrête au lieu de produire un schéma silencieusement faux.

Usage :  python supabase/outils/fabriquer_schema.py
"""
import csv
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
EXTR = RACINE / "extraction-otaku"
SORTIE = RACINE / "00_schema.sql"
csv.field_size_limit(10**9)


def lire(nom):
    with open(EXTR / nom, encoding="utf-8-sig", newline="") as f:
        # Les exports Supabase arrivent avec des fins de ligne Windows.
        return [{k: (v or "").replace(chr(13) + chr(10), chr(10)) for k, v in r.items()} for r in csv.DictReader(f)]


def remplacer(texte, ancien, nouveau, quoi, n=1):
    trouve = texte.count(ancien)
    if trouve != n:
        raise SystemExit(f"[{quoi}] attendu {n} occurrence(s), trouvé {trouve} : {ancien[:70]!r}")
    return texte.replace(ancien, nouveau)


def minuscules(ddl):
    return re.sub(r"^(CREATE|ALTER) ", lambda m: m.group(1).lower() + " ", ddl, flags=re.M)


# ---------------------------------------------------------------------------
# Ce qu'on retire
# ---------------------------------------------------------------------------
TABLES_RETIREES = {"treasure_hunts", "treasure_steps", "treasure_progress", "duels",
                   "coups_de_coeur",   # remplacée par coeurs (sources/70_coeurs.sql)
                   "sortie_reponses"}  # sondage du soir (4.11), lui-même fondu dans le coffre du scan (6.3 bis)
FONCTIONS_RETIREES = {
    "admin_create_hunt", "admin_create_step", "admin_delete_hunt", "admin_delete_step",
    "admin_duplicate_hunt", "admin_list_hunts", "admin_list_steps", "admin_set_hunt_active",
    "admin_update_hunt", "admin_update_step", "treasure_answer", "treasure_view",
    "admin_list_duels", "admin_record_duel", "archive_lire",
    # Questionnaire de sortie d'Otaku : remplacé par le sondage du soir (4.11),
    # lui-même fondu dans les questions du coffre (6.3 bis)
    "sortie_etat", "sortie_options", "sortie_repondre",
    # Liste complète avec 5 sous-requêtes par joueur : remplacée par
    # console_joueurs, paginée (sources/99_console_joueurs.sql, 6.2)
    "admin_liste_joueurs",
    # Contenu du jeu (6.3) : une lecture par écran et un enregistrement par
    # formulaire (sources/99_console_contenu.sql). Les listes d'Otaku
    # comptaient scans et missions faites sans index ; la catégorie, la
    # priorité, la rareté d'un badge se réglaient à part (ou pas du tout) ;
    # supprimer effaçait l'historique des joueurs.
    "admin_list_quests", "admin_create_quest", "admin_update_quest", "admin_delete_quest",
    "admin_list_badges", "admin_create_badge", "admin_update_badge", "admin_delete_badge",
    "admin_list_qr", "admin_create_qr", "admin_edit_qr", "admin_delete_qr", "admin_set_qr_active",
    # Collecte (6.3 bis, sources/92_collecte.sql) : la fiche part en UN appel
    # (fiche_enregistrer, téléphone compris), les questions passent par le
    # coffre du scan (coffre_ouvrir). Plus de cadence ni de plafond.
    "profil_etat", "profil_repondre", "contact_etat", "contact_enregistrer",
    "micro_prochaine", "micro_repondre",
    # Écran géant : remplacées par mur_direct (5.1 DOMAF), retirées (Vimas 5.4)
    "live_board", "leaderboard_view",
}
TYPES_QR = "'scene','stand','foodtruck','service','relique','dedicace','surprise'"
# Réécrites à la main dans sources/ (le corps Otaku ne sert plus du tout)
FONCTIONS_REECRITES = {"player_collection",   # sources/40_collection.sql
                       "coeur_donner", "coeur_liste", "coeur_retirer", "coeur_palmares",   # sources/70_coeurs.sql
                       "quiz_state", "quiz_answer", "admin_quiz_end", "_raid_damage",      # sources/25_blind_joueur.sql
                       "quiz_board",                                                      # sources/98_ecran_blind.sql
                       "admin_award_bonus", "admin_get_reconnect_code",                   # sources/99_console_joueurs.sql
                       "profil_options", "profil_stats"}                                  # sources/92_collecte.sql

# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------
tables = []
for r in lire("q1_tables.csv"):
    if r["table_name"] in TABLES_RETIREES:
        continue
    ddl = minuscules(r["ddl"])
    ddl = ddl.replace("default CURRENT_DATE", "default public.jour_jeu()")
    if r["table_name"] == "player_profile":
        ddl = remplacer(ddl, "anime_prefere text", "genre_prefere text", "player_profile")
    if r["table_name"] == "quiz_questions":
        # Étape 2.7 : ce que le blind test affiche en plus d'une question de quiz
        ddl = remplacer(ddl, """  duration_seconds integer default 20 not null
);""", """  duration_seconds integer default 20 not null,
  categorie text,                            -- « Artiste », « Instrument »…
  reponse text,                              -- révélée : « Artiste, « Titre » »
  anecdote text,
  audio_url text,                            -- extrait joué par l'écran géant
  audio_debut integer default 0 not null,    -- seconde de départ dans le fichier
  pochette_url text,                         -- montrée à la révélation
  constraint quiz_questions_audio_debut check (audio_debut between 0 and 3600),
  constraint quiz_questions_audio_url check (audio_url ~ '^(https://|[A-Za-z0-9_][A-Za-z0-9_./-]*$)'),
  constraint quiz_questions_pochette_url check (pochette_url ~ '^(https://|[A-Za-z0-9_][A-Za-z0-9_./-]*$)')
);""", "quiz_questions")
    if r["table_name"] == "quiz_sessions":
        # Étape 4.14 : les récompenses de fin de manche ne partent qu'une fois
        # (admin_quiz_end, sources/25_blind_joueur.sql)
        ddl = remplacer(ddl, """  raid_bonus_xp integer default 0 not null
);""", """  raid_bonus_xp integer default 0 not null,
  recompenses_at timestamp with time zone    -- fin de manche : récompenses versées
);""", "quiz_sessions")
    if r["table_name"] == "players":
        ddl = remplacer(ddl, "rank text default 'E'::text", "rank text default 'Spectateur'::text", "players.rank")
        # Étape 6.2 : effacement au stand = identité retirée, ligne gardée
        # anonyme (sources/99_console_joueurs.sql)
        ddl = remplacer(ddl, """  jour date default public.jour_jeu() not null
);""", """  jour date default public.jour_jeu() not null,
  efface_le timestamp with time zone         -- effacé au stand : pseudo anonyme, statut exclu
);""", "players")
    if r["table_name"] == "quests":
        # Étape 4.4 : catégorie affichée sur la page Missions (réglée par
        # console_mission_enregistrer, sources/99_console_contenu.sql)
        ddl = remplacer(ddl, """  priorite smallint default 0 not null
);""", """  priorite smallint default 0 not null,
  categorie text,                            -- exploration, musique, gourmand, social, defi
  constraint quests_categorie check (categorie in ('exploration', 'musique', 'gourmand', 'social', 'defi'))
);""", "quests")
    if r["table_name"] == "badges":
        # Étape 4.5 : ce que la collection affiche (autocollant, badge secret,
        # lien « comment l'obtenir »)
        ddl = remplacer(ddl, """  created_at timestamp with time zone default now() not null
);""", """  created_at timestamp with time zone default now() not null,
  rarete text default 'commun' not null,     -- commun, rare, epique, legendaire
  forme text default 'rond' not null,        -- découpe de l'autocollant
  secret boolean default false not null,     -- nom caché tant qu'il n'est pas gagné
  lien text,                                 -- page où l'obtenir : « scanner.html »
  constraint badges_rarete check (rarete in ('commun', 'rare', 'epique', 'legendaire')),
  constraint badges_forme check (forme in ('rond', 'etoile', 'hexa', 'ecusson')),
  constraint badges_lien check (lien ~ '^[a-z0-9-]+[.]html(#[A-Za-z0-9_-]+)?$')
);""", "badges")
    if r["table_name"] == "roulette_prizes":
        # Étape 4.8 : couleur de la case et libellé court sur la roue ; l'icône
        # est un nom du jeu d'icônes du site (plus de Font Awesome)
        ddl = remplacer(ddl, "icon text default 'fa-gift'::text not null", "icon text default 'cadeau'::text not null", "roulette_prizes.icon")
        ddl = remplacer(ddl, """  badge_id uuid
);""", """  badge_id uuid,
  rarete text default 'commun' not null,     -- commun, rare, epique, legendaire
  court text,                                -- libellé sur la roue : « Casquette »
  constraint roulette_prizes_rarete check (rarete in ('commun', 'rare', 'epique', 'legendaire')),
  constraint roulette_prizes_court check (char_length(court) between 1 and 12)
);""", "roulette_prizes")
    if r["table_name"] == "roulette_spins":
        # Étape 4.8 : qui a remis le lot au stand (auth.uid() du staff)
        ddl = remplacer(ddl, """  redeemed_at timestamp with time zone,""", """  redeemed_at timestamp with time zone,
  redeemed_by uuid,""", "roulette_spins")
    if r["table_name"] == "announcements":
        # Étape 4.10 : titre, catégorie (icône, filtres), lien vers une page du
        # site, fin de validité. Le niveau reste `type` : danger = urgent
        # (épinglée), alerte = important, info / succes = info.
        ddl = remplacer(ddl, """  created_at timestamp with time zone default now() not null
);""", """  created_at timestamp with time zone default now() not null,
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
);""", "announcements")
    if r["table_name"] == "coeur_config":
        # Étape 4.9 : les votes se ferment à une date (et à la phase CLOTURE)
        ddl = remplacer(ddl, """  actif boolean default true not null
);""", """  actif boolean default true not null,
  cloture timestamp with time zone default '2026-11-29 20:00:00+01'::timestamp with time zone not null
);""", "coeur_config")
    if r["table_name"] == "game_state":
        # Étape 4.8 : plafond de tirages par journée de jeu (0 = sans plafond)
        ddl = remplacer(ddl, """  roulette_cost integer default 30 not null
);""", """  roulette_cost integer default 30 not null,
  roulette_max_jour integer default 10 not null,
  constraint game_state_roulette_max_jour check (roulette_max_jour >= 0)
);""", "game_state")
    if r["table_name"] == "scans":
        # Étape 4.5 : le concert pendant lequel un QR de scène a été scanné
        # (clé étrangère dans sources/40_collection.sql, après creneaux)
        ddl = remplacer(ddl, """  scanned_at timestamp with time zone default now() not null
);""", """  scanned_at timestamp with time zone default now() not null,
  creneau_id uuid
);""", "scans")
    tables.append(ddl)

# ---------------------------------------------------------------------------
# Contraintes
# ---------------------------------------------------------------------------
contraintes = {r["type_contrainte"]: r["ddl"] for r in lire("q2_contraintes.csv")}


def garder_contrainte(ligne):
    m = re.match(r"ALTER table public\.(\w+) ", ligne, re.I)
    if m and m.group(1) in TABLES_RETIREES:
        return False
    return not any(f"REFERENCES {t}(" in ligne for t in TABLES_RETIREES)


def contraintes_de(type_):
    lignes = [minuscules(l) for l in contraintes.get(type_, "").splitlines() if l.strip()]
    return [l for l in lignes if garder_contrainte(l)]


checks = contraintes_de("c")
checks = [
    l.replace(
        "CHECK ((type = ANY (ARRAY['stand'::text, 'boss'::text, 'cosplayer'::text, 'relique'::text])))",
        "CHECK ((type = ANY (ARRAY[" + ", ".join(f"{t}::text" for t in TYPES_QR.split(",")) + "])))",
    )
    for l in checks
]
assert any("'foodtruck'::text" in l for l in checks), "contrainte des types de QR non remplacée"

# ---------------------------------------------------------------------------
# Fonctions
# ---------------------------------------------------------------------------
fonctions = {}
for lot in lire("q4_fonctions.csv"):
    for bloc in re.split(r"(?=^CREATE OR REPLACE FUNCTION )", lot["ddl"], flags=re.M):
        m = re.match(r"CREATE OR REPLACE FUNCTION public\.(\w+)", bloc)
        if m:
            fonctions[m.group(1)] = bloc.strip()
assert len(fonctions) == 126, len(fonctions)
for nom in FONCTIONS_RETIREES | FONCTIONS_REECRITES:
    del fonctions[nom]


def f(nom, ancien, nouveau, n=1):
    fonctions[nom] = remplacer(fonctions[nom], ancien, nouveau, nom, n)


# --- Journée de jeu : coupure à 6 h, heure de Douala -----------------------
for nom in list(fonctions):
    t = fonctions[nom]
    t = t.replace("CURRENT_DATE", "public.jour_jeu()").replace("current_date", "public.jour_jeu()")
    fonctions[nom] = t

f("admin_journal_bonus",
  "coalesce(p_jour, (now() at time zone 'Africa/Douala')::date)",
  "coalesce(p_jour, public.jour_jeu())")
f("admin_journal_bonus",
  "(e.created_at at time zone 'Africa/Douala')::date = v_jour",
  "public.jour_de(e.created_at) = v_jour")
f("stats_parcours", "e.created_at::date as jour", "public.jour_de(e.created_at) as jour")

# --- Codes secrets : des mots de musique au lieu de mots japonais ----------
MOTS = """
KORA BALAFO DJEMBE NGOMA MVET SANZA TAMTAM CONGA BONGO GONG
MAKOSA ASSIKO ESSEWE KWASSA DECALE AFRO RUMBA ZOUK SALSA REGGAE
JAZZ SOUL FUNK BLUES GOSPEL DISCO TECHNO HOUSE ROCK PUNK
METAL INDIE RAP GROOVE SWING BEAT REMIX RIFF LOOP TEMPO
RYTHME ACCORD GAMME NOTE SOLO DUO TRIO CHOEUR CHANT VOIX
MICRO SCENE LIVE SHOW BRAVO RAPPEL ALBUM VINYLE DISQUE TUBE
PIANO ORGUE VIOLON HARPE FLUTE SAXO TUBA CUIVRE BASSE CAISSE
AMPLI CASQUE SONO ECHO ONDE NEON LASER FIESTA DANSE RAGGA
WOURI AKWA DEIDO BALI MBOA SAWA KOLA NDOLE BRAISE DOMAF
LION AIGLE COBRA ZEBRE LUNE ETOILE SOLEIL FLAMME IDOLE STAR
""".split()
MOTS = [m for m in MOTS if len(m) <= 6]
assert len(MOTS) == len(set(MOTS)), "mot en double"
assert len(MOTS) >= 100, len(MOTS)
MOTS = MOTS[:100]
lignes_mots = []
for i in range(0, 100, 10):
    lignes_mots.append("      " + ",".join(f"'{m}'" for m in MOTS[i:i + 10]))
ancien_tableau = re.search(r"select unnest\(array\[\n(.*?)\n    \]\) as mot", fonctions["_code_secret_tirage"], re.S).group(1)
f("_code_secret_tirage", ancien_tableau, ",\n".join(lignes_mots))
# 🔴 CORRECTIF (17/09/2026). En prod Otaku, `select unnest(...) as mot order by
#    random() limit 1` renvoie TOUJOURS le premier mot : Postgres trie la ligne
#    unique AVANT de déplier le tableau. Le code ne valait donc que ses 5
#    chiffres (100 000 possibilités au lieu de 10 millions). Le tableau passe
#    dans le FROM, où le tri porte bien sur les 100 mots.
f("_code_secret_tirage", "    select unnest(array[", "    select t.mot from unnest(array[")
f("_code_secret_tirage", "    ]) as mot", "    ]) as t(mot)")
f("_code_secret_tirage", "-- 100 mots, tous de 6 lettres au maximum",
  "-- 100 mots de musique et de Douala (DOMAF Quest), tous de 6 lettres au maximum")

# --- Préfixes propres à DOMAF Quest ----------------------------------------
f("_gen_qr_code", "v_code := 'OQ-';", "v_code := 'DQ-';")
f("pass_garde", "'oq.pass_bypass'", "'dq.pass_bypass'")

# --- Joueur effacé au stand (6.2) : plus de réintégration ni de renommage ---
f("admin_set_status", """  update public.players set status = p_status
  where id = p_player_id
  returning * into v_player;""", """  update public.players set status = p_status
  where id = p_player_id and efface_le is null
  returning * into v_player;""")
f("admin_rename_player", """  update public.players set pseudo = p_pseudo
  where id = p_player_id returning * into v_player;""", """  update public.players set pseudo = p_pseudo
  where id = p_player_id and efface_le is null returning * into v_player;""")
f("vendeur_award_bonus", "set_config('oq.pass_bypass', …)", "set_config('dq.pass_bypass', …)")

# --- Badges attribués automatiquement --------------------------------------
f("_is_system_badge",
  "select p_name in ('Premier Scan', 'Chasseur Assidu', 'Boss Vaincu',\n                    'Grand Explorateur', 'Maître Pokédex');",
  # Étape 6.3 : tout badge donné par son NOM dans une fonction est protégé
  # (renommé, il ne serait plus jamais donné) : Jury (coeur_donner), Oreille
  # d'or (admin_quiz_end), Lève-tôt / Noctambule / Marathonien (scan_qr),
  # Podium (admin_set_phase, clôture de la journée).
  """select p_name in ('Première note', 'Curieux', 'Fouineur', 'Autographe',
                    'Jury', 'Oreille d''or', 'Lève-tôt', 'Noctambule', 'Marathonien', 'Podium');""")

# --- Rangs DOMAF (niveau → rang) --------------------------------------------
f("rank_for_level",
  """    when p_level >= 25 then 'S'
    when p_level >= 20 then 'A'
    when p_level >= 15 then 'B'
    when p_level >= 10 then 'C'
    when p_level >= 5  then 'D'
    else 'E'""",
  """    -- Paliers DOMAF, calés sur les visuels (0 / 500 / 1 500 / 3 500 / 7 000 XP)
    -- via level_for_xp : niv. 3 = 550 XP, 6 = 1 750, 10 = 4 050, 14 = 7 150.
    when p_level >= 14 then 'Tête d''affiche'
    when p_level >= 10 then 'Backstage'
    when p_level >= 6  then 'Groupie'
    when p_level >= 3  then 'Fan'
    else 'Spectateur'""")

# --- Jours du festival -------------------------------------------------------
f("jour_festival_label",
  """    when date '2026-08-15' then 'samedi'
    when date '2026-08-16' then 'dimanche'""",
  """    when date '2026-11-26' then 'jeudi'
    when date '2026-11-27' then 'vendredi'
    when date '2026-11-28' then 'samedi'
    when date '2026-11-29' then 'dimanche'""")

# --- Types de QR ---------------------------------------------------------------
# Barème par type : console_qr_enregistrer (sources/99_console_contenu.sql, 6.3).


f("scan_qr",
  """  select count(*) into v_count from public.scans where player_id = v_player.id;
  if v_count = 1 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Premier Scan'));
  end if;
  if v_count = 10 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Chasseur Assidu'));
  end if;
""",
  """  -- Badges DOMAF attribués par le scan (liste = _is_system_badge).
  select count(*) into v_count from public.scans where player_id = v_player.id;
  if v_count = 1 then
    v_new_badges := array_append(v_new_badges,
      public._award_badge(v_player.id, v_player.pseudo, 'Première note'));
  end if;
""")
bloc_types = re.search(r"  if v_qr\.type = 'boss' then\n.*?\n  end if;\n", fonctions["scan_qr"], re.S).group(0)
f("scan_qr", bloc_types, """  if v_qr.type in ('relique', 'dedicace') then
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
""")

# --- Accueil joueur sans trésor ni duel ----------------------
bloc_tresor = re.search(r"    -- ⬇️ AJOUT DU FICHIER 87.*?      limit 1\),\n\n", fonctions["player_home"], re.S).group(0)
f("player_home", bloc_tresor, "")

# --- Profil : le genre musical préféré au lieu de l'animé -------------------
# (profil_options, profil_stats : réécrites dans sources/92_collecte.sql)
fonctions["profil_public_stats"] = fonctions["profil_public_stats"].replace("anime_prefere", "genre_prefere")
f("profil_public_stats", "    'anime', (select", "    'genre', (select")
# --- Textes du blind test (le moteur raid) ----------------------------------
f("admin_quiz_start",
  """      then 'RAID FINAL — le boss « ' || v_session.boss_name
        || ' » attaque le festival ! Tous sur vos téléphones !'""",
  """      then 'BLIND TEST — « ' || v_session.boss_name
        || ' » monte sur scène ! Tous sur vos téléphones !'""")
f("admin_quiz_start", "-- Quiz → phase QUIZ ; raid → phase RAID (quêtes verrouillées)",
  "-- Quiz → phase QUIZ ; blind test (raid) → phase RAID (missions en pause)")
f("admin_set_phase",
  "'RAID FINAL — les quêtes sont verrouillées, épreuve collective !'",
  "'BLIND TEST — les missions sont en pause, tout le monde joue ensemble !'")
# Étape 6.1 : le roi du jour à la clôture, sur l'index du classement du jour
# (_points_jour ligne par ligne recalculait jour_jeu() pour chaque joueur).
f("admin_set_phase",
  """    select p.pseudo, public._points_jour(p.xp_jour, p.jour) as points
      into v_roi
      from public.players p
      where p.status = 'actif'
      order by public._points_jour(p.xp_jour, p.jour) desc, p.created_at asc
      limit 1;
    if v_roi.points is not null and v_roi.points > 0 then
      insert into public.tournament_kings (jour, pseudo, points)
      values (public.jour_jeu(), v_roi.pseudo, v_roi.points)""",
  """    select p.pseudo, p.xp_jour as points
      into v_roi
      from public.players p
      where p.status = 'actif' and p.jour = v_jour and p.xp_jour > 0
      order by p.xp_jour desc, p.created_at asc
      limit 1;
    if v_roi.points is not null and v_roi.points > 0 then
      insert into public.tournament_kings (jour, pseudo, points)
      values (v_jour, v_roi.pseudo, v_roi.points)""")
f("admin_set_phase", """  v_roi   record;
begin""", """  v_roi   record;
  v_jour  date := public.jour_jeu();   -- UNE fois (voir _classement)
begin""")
# Étape 6.3 : badge Podium aux trois premiers de la journée, à la clôture
# (même tri que le roi du jour ; rejouer la clôture ne le donne pas deux fois).
f("admin_set_phase",
  """      on conflict (jour) do update
        set pseudo = excluded.pseudo, points = excluded.points, decided_at = now();
    end if;""",
  """      on conflict (jour) do update
        set pseudo = excluded.pseudo, points = excluded.points, decided_at = now();
    end if;
    for v_roi in
      select p.id, p.pseudo from public.players p
      where p.status = 'actif' and p.jour = v_jour and p.xp_jour > 0
      order by p.xp_jour desc, p.created_at asc
      limit 3
    loop
      perform public._award_badge(v_roi.id, v_roi.pseudo, 'Podium');
    end loop;""")
# admin_quiz_end : réécrite dans sources/25_blind_joueur.sql (étape 4.14)
# Étape 5.2 : l'écran géant apprend qu'une question commence par le temps réel
# de game_state (déjà publié, lecture publique) : aucune table de plus à publier.
f("admin_quiz_next",
  """     set current_question = current_question + 1, question_started_at = now()
   where id = p_session_id
  returning * into v_session;""",
  """     set current_question = current_question + 1, question_started_at = now()
   where id = p_session_id
  returning * into v_session;
  -- Signal de l'écran géant (temps réel sur game_state) : il relit quiz_board
  update public.game_state set updated_at = now() where id = 1;""")
# Étape 4.14 : barème des visuels (jusqu'à 1 000 points par bonne réponse) :
# 500 joueurs sur 15 questions dépassent 3 millions de points, le plafond
# d'Otaku (1 million de PV) ne suffisait plus.
f("admin_create_quiz_session", "p_boss_hp > 1000000", "p_boss_hp > 100000000")
f("admin_update_raid_params", "p_boss_hp > 1000000", "p_boss_hp > 100000000")

# Plus aucune trace des éléments retirés
for nom, t in fonctions.items():
    assert not re.search(r"treasure|duels\b|archive_yaounde|cosplayer|'OQ-|oq\.pass", t), nom

# --- Blind test : champs de l'étape 2.7 --------------------------------------
# Écran et téléphones : réponse, anecdote et pochette seulement chrono fini,
# comme la bonne réponse (la pochette la trahirait) ; la console voit tout.
# quiz_state : réécrite dans sources/25_blind_joueur.sql (étape 4.14)
# quiz_board : réécrite dans sources/98_ecran_blind.sql (étape 5.2)
f("admin_quiz_live",
  """      'id', v_q.id, 'question', v_q.question, 'choices', v_q.choices,""",
  """      'id', v_q.id, 'question', v_q.question, 'choices', v_q.choices,
      'categorie', v_q.categorie, 'reponse', v_q.reponse, 'anecdote', v_q.anecdote,
      'audio_url', v_q.audio_url, 'audio_debut', v_q.audio_debut,
      'pochette_url', v_q.pochette_url,""")
f("admin_list_quiz_questions",
  """           qq.correct_index, qq.duration_seconds,""",
  """           qq.correct_index, qq.duration_seconds,
           qq.categorie, qq.reponse, qq.anecdote,
           qq.audio_url, qq.audio_debut, qq.pochette_url,""")
f("admin_duplicate_quiz_session",
  """    (session_id, question, choices, correct_index, question_order, duration_seconds)
  select v_new.id, question, choices, correct_index, question_order, duration_seconds""",
  """    (session_id, question, choices, correct_index, question_order, duration_seconds,
     categorie, reponse, anecdote, audio_url, audio_debut, pochette_url)
  select v_new.id, question, choices, correct_index, question_order, duration_seconds,
     categorie, reponse, anecdote, audio_url, audio_debut, pochette_url""")

# --- Étape 4.2 : la carte du joueur en UN appel ------------------------------
# Le tableau de bord aurait sinon besoin de 4 requêtes de plus (programme,
# favoris, annonces, état du jeu). On ajoute seulement ce qu'il affiche :
#   · classement_general : rang sur l'XP totale (position = rang du jour) ;
#   · scans_jour         : nombre de QR trouvés dans la journée de jeu ;
#   · roulette_cost      : coût d'un tirage (game_state) ;
#   · annonce            : dernière alerte (alerte / danger) de moins de 3 h ;
#   · prochain_concert   : prochain concert en programme du joueur, sinon le
#                          prochain tout court (non terminé, artiste annoncé) ;
#   · quests.requires_staff : « validée par le staff ».
# SECURITY DEFINER : les filtres des politiques (artiste / lieu actifs) sont
# réécrits à la main.
f("player_home",
  """        'xp_reward', q.xp_reward,""",
  """        'xp_reward', q.xp_reward, 'requires_staff', q.requires_staff,
        'categorie', q.categorie, 'completed_at', qp.completed_at,""")
f("player_home",
  """    'events', coalesce((""",
  """    'classement_general', (select count(*) + 1 from public.players x
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

    'events', coalesce((""")

# --- Étape 4.3 : le scan dit où en sont les missions qu'il fait avancer -------
# Otaku ne renvoyait que les titres des missions TERMINÉES. L'écran de
# résultat affiche aussi « Tournée des scènes 2/3 » : on renvoie, pour chaque
# mission touchée par ce scan, titre, avancée, objectif et XP. Une mission
# secrète n'apparaît que terminée (sinon le scan trahirait son existence).
f("scan_qr",
  """  v_deja_collection boolean;""",
  """  v_deja_collection boolean;
  v_quetes   json[] := '{}';""")
f("scan_qr",
  """    if v_prog is not null and v_prog >= r.goal_count then""",
  """    if v_prog is not null and (r.type <> 'secrete' or v_prog >= r.goal_count) then
      v_quetes := v_quetes || json_build_object(
        'titre', r.title, 'fait', least(v_prog, r.goal_count), 'objectif', r.goal_count,
        'xp', r.xp_reward, 'terminee', v_prog >= r.goal_count);
    end if;

    if v_prog is not null and v_prog >= r.goal_count then""")
f("scan_qr",
  """    'quetes_terminees', to_json(v_completed),""",
  """    'quetes_terminees', to_json(v_completed),
    'quetes', to_json(v_quetes),""")

# --- Étape 4.5 : un QR de scène se scanne une fois par CONCERT ----------------
# Otaku : un QR, une fois par jour. DOMAF : scanner la scène pendant un
# concert ajoute l'artiste à la collection ; rester devant la même scène toute
# la soirée doit donc permettre un scan par concert (XP à chaque fois). Hors
# concert, la règle reste « une fois par jour ». Le concert est noté dans
# scans.creneau_id (l'index unique scans_once_per_day l'inclut).
# Un second scan du même QR dans la journée ne fait PAS avancer les missions :
# « Tournée des scènes : 3 scènes » veut dire trois scènes différentes.
f("scan_qr",
  """  v_quetes   json[] := '{}';""",
  """  v_quetes   json[] := '{}';
  v_creneau  uuid;
  v_rejeu    boolean;
  v_artiste  json;""")
f("scan_qr",
  """  -- (a) G2 : plus d'exception de type, tout se rejoue chaque jour.
  perform 1 from public.scans
    where player_id = v_player.id and qr_code_id = v_qr.id and day = public.jour_jeu();
  if found then raise exception 'DEJA_SCANNE'; end if;
""",
  """  -- Étape 4.5 : QR d'une scène scanné pendant un concert → ce concert.
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
""")
f("scan_qr",
  """  insert into public.scans (player_id, qr_code_id) values (v_player.id, v_qr.id);""",
  """  insert into public.scans (player_id, qr_code_id, creneau_id) values (v_player.id, v_qr.id, v_creneau);""")
f("scan_qr",
  """      and (counter in ('scan_any', 'scan_' || v_qr.type) or id = v_qr.quest_id)""",
  """      and (counter in ('scan_any', 'scan_' || v_qr.type) or id = v_qr.quest_id)
      and not v_rejeu""")
f("scan_qr",
  """    'quetes', to_json(v_quetes),""",
  """    'quetes', to_json(v_quetes),
    'artiste', v_artiste,""")
# Étape 6.3 : Lève-tôt, Noctambule, Marathonien (bloc des badges plus haut)
f("scan_qr",
  """  v_artiste  json;""",
  """  v_artiste  json;
  v_heure    int;
  v_scan_id  uuid;""")
f("scan_qr",
  """  insert into public.scans (player_id, qr_code_id, creneau_id) values (v_player.id, v_qr.id, v_creneau);""",
  """  insert into public.scans (player_id, qr_code_id, creneau_id) values (v_player.id, v_qr.id, v_creneau)
  returning id into v_scan_id;""")

# --- Étape 4.7 : position du jour sans recalculer le jour de jeu par joueur --
# _points_jour appelle jour_jeu() (conversion de fuseau, fonction à search_path
# fixé donc jamais « dépliée ») pour CHAQUE ligne : 39 ms sur 5 000 joueurs, dans
# la fonction que chaque téléphone appelle toutes les 30 s. Même résultat :
# un joueur d'un autre jour a 0 point, il ne peut pas être devant.
f("player_home",
  """    'position', (select count(*) + 1 from public.players x
                 where public._points_jour(x.xp_jour, x.jour)
                     > public._points_jour(v_player.xp_jour, v_player.jour)),""",
  """    'position', (select count(*) + 1 from public.players x
                 where x.jour = (select public.jour_jeu())
                   and x.xp_jour > public._points_jour(v_player.xp_jour, v_player.jour)),""")

# --- Étape 4.10 : annonces ---------------------------------------------------
# L'alerte de la carte : titre, lien, et plus rien après sa fin de validité.
f("player_home",
  """    'annonce', (select json_build_object('id', a.id, 'message', a.message,
                                         'type', a.type, 'created_at', a.created_at)
                from public.announcements a
                where a.type in ('alerte', 'danger')
                  and a.created_at > now() - interval '3 hours'""",
  """    'annonce', (select json_build_object('id', a.id, 'message', a.message,
                                         'type', a.type, 'created_at', a.created_at,
                                         'titre', a.titre, 'lien', a.lien, 'lien_libelle', a.lien_libelle)
                from public.announcements a
                where a.type in ('alerte', 'danger')
                  and a.created_at > now() - interval '3 hours'
                  and (a.fin is null or a.fin > now())""")

# --- Étape 4.9 : coups de cœur -----------------------------------------------
# Plus de compteur de cœurs dans la carte : aucune page ne le lit, et il
# visait coups_de_coeur (retirée). La page Coups de cœur a coeur_liste.
f("player_home",
  """    -- ⬇️ CLÉ DU FICHIER 84 — les coups de cœur remontent avec le reste.
    'coeurs', json_build_object(
      'donnes', (select count(*) from public.coups_de_coeur
                  where player_id = v_player.id),
      'max',    coalesce((select max_coeurs from public.coeur_config where id = 1), 3),
      'actif',  coalesce((select actif      from public.coeur_config where id = 1), true)
    ),

""", "")
# --- Étape 4.8 : la roue -----------------------------------------------------
# Plafond par journée de jeu. Le compte se fait APRÈS le débit : l'update des
# jetons verrouille la ligne du joueur, deux tirages simultanés du même joueur
# passent donc l'un après l'autre et le second voit le premier. La borne est
# calculée une fois (jamais jour_de() ligne par ligne) et lit l'index
# roulette_spins_joueur_idx (sources/60_roue.sql).
f("spin_roulette",
  """  v_old_lvl integer;
  r         record;""",
  """  v_old_lvl integer;
  v_max     integer;
  v_tirages integer;
  r         record;""")
f("spin_roulette",
  """  select coalesce(roulette_cost, 30) into v_cost from public.game_state where id = 1;
""",
  """  select coalesce(roulette_cost, 30), coalesce(roulette_max_jour, 0) into v_cost, v_max
  from public.game_state where id = 1;
""")
f("spin_roulette",
  """  if v_player.id is null then raise exception 'JETONS_INSUFFISANTS'; end if;
""",
  """  if v_player.id is null then raise exception 'JETONS_INSUFFISANTS'; end if;

  select count(*) into v_tirages from public.roulette_spins
  where player_id = v_player.id and created_at >= public._debut_jour_jeu();
  if v_max > 0 and v_tirages >= v_max then raise exception 'PLAFOND_JOUR'; end if;
""")
# La roue du téléphone s'arrête sur la case du lot : il lui faut son id.
f("spin_roulette",
  """    'prize', json_build_object(
      'name',   v_prize.name,""",
  """    'prize', json_build_object(
      'id',     v_prize.id,
      'name',   v_prize.name,""")
f("spin_roulette",
  """      'prize', json_build_object('name', v_prize.name, 'icon', v_prize.icon,""",
  """      'prize', json_build_object('id', v_prize.id, 'name', v_prize.name, 'icon', v_prize.icon,""")
f("admin_redeem",
  """  update public.roulette_spins set redeemed_at = now() where id = v_spin.id;""",
  """  update public.roulette_spins set redeemed_at = now(), redeemed_by = auth.uid() where id = v_spin.id;""")
for nom in ("admin_create_prize", "admin_update_prize"):
    f(nom, "'fa-gift'", "'cadeau'")

# --- Étape 6.3 bis : le coffre du scan ---------------------------------------
# L'XP du scan (et des missions qu'il termine) part dans un coffre, versée
# quand le joueur répond à la question (coffre_ouvrir, sources/92_collecte.sql).
# Plus de question à poser : versée tout de suite, comme avant.
f("scan_qr",
  """  v_scan_id  uuid;""",
  """  v_scan_id  uuid;
  v_coffre   jsonb;
  v_credit   int;""")
f("scan_qr",
  """  v_old_level := public.level_for_xp(v_player.xp);
  update public.players
  set xp     = xp + v_total_xp,
      jetons = jetons + (v_total_xp / 10),
      level  = public.level_for_xp(xp + v_total_xp),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_total_xp))""",
  """  v_coffre := public._coffre_remplir(v_player.id, v_total_xp, v_total_xp / 10);
  v_credit := case when v_coffre is null then v_total_xp else 0 end;

  v_old_level := public.level_for_xp(v_player.xp);
  update public.players
  set xp     = xp + v_credit,
      jetons = jetons + (v_credit / 10),
      level  = public.level_for_xp(xp + v_credit),
      rank   = public.rank_for_level(public.level_for_xp(xp + v_credit))""")
f("scan_qr",
  """    'artiste', v_artiste,""",
  """    'artiste', v_artiste,
    'coffre', v_coffre,""")
# La carte dit ce qui manque à la fiche et montre un coffre resté fermé
f("player_home",
  """    'pass_actif', public.pass_actif(v_player.id),""",
  """    'pass_actif', public.pass_actif(v_player.id),

    'fiche', public._fiche_etat(v_player.id),
    'coffre', (select public._coffre_json(c) from public.coffres c where c.player_id = v_player.id),""")

# ---------------------------------------------------------------------------
# Droits d'exécution (reproduits depuis la prod)
# ---------------------------------------------------------------------------
droits = {}
for ligne in next(r["v"] for r in lire("q3_divers.csv") if r["k"] == "droits_fonctions").splitlines():
    m = re.match(r"(\w+)\((.*)\) (\{.*\}|DEFAULT)$", ligne)
    droits[m.group(1)] = (m.group(2), m.group(3))

# Correctif 2.5 : en prod Otaku, ces fonctions internes sont ouvertes à tout
# compte connecté, sans contrôle de rôle. Or n'importe qui peut se créer un
# compte : _award_badge donnait alors n'importe quel badge à n'importe quel
# joueur et affichait un texte libre sur l'écran géant. Aucune page ne les
# appelle : seules les fonctions SECURITY DEFINER s'en servent.
FERMEES = {"_award_badge", "_gen_qr_code", "pass_actif"}

grants = []
for nom in sorted(fonctions):
    args, acl = droits[nom]
    signature = f"public.{nom}({args})"
    if re.search(r"[{,]=X/", acl) and nom not in FERMEES:   # entrée PUBLIC : ouverte à tous (anon compris)
        grants.append(f"grant execute on function {signature} to anon, authenticated;")
        continue
    grants.append(f"revoke all on function {signature} from public, anon, authenticated;")
    if "authenticated=X" in acl and nom not in FERMEES:
        grants.append(f"grant execute on function {signature} to authenticated;")

# Correctif 2.5 : chemin de recherche fixé partout (alerte « Function Search
# Path Mutable » du Security Advisor de Supabase).
for nom, t in fonctions.items():
    entete = t.split("AS $function$", 1)[0]
    if "SET search_path" not in entete:
        fonctions[nom] = t.replace("\nAS $function$", "\n SET search_path TO 'public'\nAS $function$", 1)

# ---------------------------------------------------------------------------
# Le reste
# ---------------------------------------------------------------------------
divers = {r["k"]: r["v"] for r in lire("q3_divers.csv")}
index = [minuscules(l) for l in divers["index"].splitlines()]
# Étape 4.5 : une scène se scanne une fois par concert (voir scan_qr).
# NULLS NOT DISTINCT : hors concert, la règle reste « une fois par jour ».
index = [remplacer(l, "USING btree (player_id, qr_code_id, day);",
                   "USING btree (player_id, qr_code_id, day, creneau_id) NULLS NOT DISTINCT;", "scans_once_per_day")
         if "scans_once_per_day" in l else l for l in index]
index = [l for l in index if not any(f"public.{t} " in l for t in TABLES_RETIREES)]
rls = [l for l in divers["rls"].splitlines() if not any(f".{t} " in l for t in TABLES_RETIREES)]
policies = [l for l in divers["policies"].splitlines() if not any(f"public.{t} " in l for t in TABLES_RETIREES)]
triggers = [minuscules(l).replace("EXECUTE FUNCTION pass_garde()", "EXECUTE FUNCTION public.pass_garde()")
            .replace("EXECUTE FUNCTION _maj_xp_jour()", "EXECUTE FUNCTION public._maj_xp_jour()")
            for l in divers["triggers"].splitlines()]
realtime = divers["realtime"].splitlines()


# --- Droits (Vimas 5.4, correctifs/2026-09-28_vimas-5.4-droits.sql) ---------
# Un vendeur n'écrit plus rien dans la roue ni dans le blind test : is_equipe()
# devient is_staff(). Il garde ses outils et le pilotage de secours du blind
# test (liste, direct, lancer, suivante, terminer, phase), comme dans Otaku.
# admin_prize_affichage (sources/60_roue.sql) et admin_blind_question
# (sources/20_blind_test.sql) sont corrigées dans leur source.
for nom in ("admin_create_prize", "admin_update_prize", "admin_delete_prize",
            "admin_set_roulette_cost", "admin_recent_spins", "admin_redeem",
            "admin_create_quiz_session", "admin_rename_quiz_session", "admin_duplicate_quiz_session",
            "admin_delete_quiz_session", "admin_update_raid_params",
            "admin_create_quiz_question", "admin_update_quiz_question",
            "admin_delete_quiz_question", "admin_move_quiz_question"):
    f(nom, "if not public.is_equipe() then raise exception 'ACCES_REFUSE'; end if;",
           "if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;")

def corps_fonction(t):
    t = re.sub(r"^CREATE OR REPLACE FUNCTION", "create or replace function", t)
    return t if t.rstrip().endswith(";") else t + "\n;"


# Tables et fonctions propres à DOMAF Quest, écrites à la main
programme = chr(10).join(f.read_text(encoding="utf-8") for f in sorted((RACINE / "sources").glob("*.sql")))
nb_tables_prog = len(re.findall(r"^create table ", programme, re.M))
nb_fonctions_prog = len(re.findall(r"^create or replace function ", programme, re.M))

sortie = f"""-- ============================================================================
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
--   · types de QR : {TYPES_QR.replace("'", "")} ;
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
-- Tables : {len(tables) + nb_tables_prog} · fonctions : {len(fonctions) + 2 + nb_fonctions_prog}
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
-- Tables ({len(tables)})
-- ----------------------------------------------------------------------------
{chr(10).join(t + chr(10) for t in tables)}
-- ----------------------------------------------------------------------------
-- Clés primaires, contraintes UNIQUE et CHECK
-- ----------------------------------------------------------------------------
{chr(10).join(contraintes_de("p"))}

{chr(10).join(contraintes_de("u"))}

{chr(10).join(checks)}

-- ----------------------------------------------------------------------------
-- Fonctions ({len(fonctions)})
-- ----------------------------------------------------------------------------
{chr(10).join(corps_fonction(fonctions[n]) + chr(10) for n in sorted(fonctions))}
-- ----------------------------------------------------------------------------
-- Clés étrangères
-- ----------------------------------------------------------------------------
{chr(10).join(contraintes_de("f"))}

-- ----------------------------------------------------------------------------
-- Index
-- ----------------------------------------------------------------------------
{chr(10).join(index)}

-- ----------------------------------------------------------------------------
-- Déclencheurs (mêmes noms qu'en prod : Postgres les lance par ordre alphabétique)
-- ----------------------------------------------------------------------------
{chr(10).join(triggers)}

-- ----------------------------------------------------------------------------
-- Row Level Security : activée sur TOUTES les tables
-- ----------------------------------------------------------------------------
{chr(10).join(rls)}

{chr(10).join(policies)}

-- ----------------------------------------------------------------------------
-- Droits d'exécution des fonctions (ceux de la prod Otaku, 3 fonctions internes fermées)
-- ----------------------------------------------------------------------------
{chr(10).join(grants)}

{programme}
-- ----------------------------------------------------------------------------
-- Temps réel : uniquement ce que l'écran géant et la console écoutent
-- ----------------------------------------------------------------------------
{chr(10).join(realtime)}

commit;
"""
SORTIE.write_text(sortie, encoding="utf-8", newline="\n")
print(f"{SORTIE.name} : {len(tables) + nb_tables_prog} tables, {len(fonctions) + 2 + nb_fonctions_prog} fonctions, "
      f"{len(policies)} politiques, {len(grants)} lignes de droits, {len(sortie)} caractères")
