# Base de données DOMAF Quest

## Installer une base neuve (éditeur SQL de Supabase)

Coller **dans l'ordre**, une seule fois :

| Fichier | Contenu |
|---|---|
| `00_schema.sql` | Toute la structure : 37 tables, 119 fonctions, RLS, droits, Realtime |
| `01_reference.sql` | Réglages de départ, 15 badges DOMAF, 6 micro-questions (rejouable) |

`00_schema.sql` est **fabriqué** : ne pas le modifier à la main.
Corriger `outils/fabriquer_schema.py`, puis :

```bash
python supabase/outils/fabriquer_schema.py
```

## Ce qui change par rapport à Otaku Quest

- **Retirés** : chasses au trésor, duels, archives de Yaoundé (15 fonctions, 4 tables).
- **Journée de jeu** = `public.jour_jeu()` : de **6 h à 6 h, heure de Douala**. Une nuit de
  concerts reste dans la journée où elle a commencé (ticket du jour, classement, missions).
  Otaku coupait à minuit UTC, soit 1 h du matin à Douala, en plein concert.
- **Types de QR** : `scene`, `stand`, `foodtruck`, `service`, `cache` (avec rareté),
  `dedicace`, `surprise`. XP par défaut : 30 / 20 / 15 / 10 / 75-300 / 100 / 80.
- **Rangs** : Spectateur (niv. 1), Fan (3), Groupie (6), Backstage (10), Tête d'affiche (14).
- **Badges automatiques** : Première note (1er scan), Curieux (5 stands),
  Fouineur (1er QR caché), Autographe (1re dédicace).
- **Profil** : `genre_prefere` (genre musical) remplace `anime_prefere`.
- **Codes secrets** : mots de musique et de Douala (`KORA-12345`), préfixe des QR `DQ-`.
- **Programme et plan** (`sources/10_programme.sql`) : `lieux` (tout le plan), `scenes`
  (lieux de catégorie scène + couleur), `artistes` (`actif = false` = pas encore annoncé,
  invisible du public), `creneaux` (deux concerts ne peuvent pas se chevaucher sur une scène),
  `dedicaces`, `favoris_programme` (par créneau, uniquement via `programme_favoris`,
  `programme_basculer_favori`, `programme_rappel`). `programme_public()` renvoie tout le
  programme en une requête ; `programme_popularite()` compte les favoris par concert.
- **Missions** : `quests.categorie` (exploration, musique, gourmand, social, defi), réglée par
  `admin_quest_categorie` (`sources/30_missions.sql`, staff) ; pas d'indices payants.
- **Téléphones (étape 4)** : `player_home` renvoie en plus le prochain concert, l'alerte en
  cours, le rang général, les scans du jour, le coût de la roue, la catégorie et l'heure de
  validation des missions ; `scan_qr` renvoie `quetes` (avancée des missions touchées).
- **Roue** (`sources/60_roue.sql`) : `roulette_joueur(code)` (page Roue en un appel, bons du
  joueur compris) ; plafond de tirages par journée de jeu `game_state.roulette_max_jour`
  (10 par défaut, 0 = aucun, `admin_set_roulette_plafond`) ; `roulette_prizes.rarete` et
  `court` (`admin_prize_affichage`) ; `roulette_spins.redeemed_by` (qui a remis le lot) ;
  icône par défaut `cadeau` (plus de Font Awesome).
- **Coups de cœur** (`sources/70_coeurs.sql`) : on vote pour des **artistes** et des **stands**
  (3 cœurs par catégorie), plus pour des QR codes : `coups_de_coeur` est remplacée par `coeurs`
  (+ `coeurs_totaux`, tenu par un déclencheur). Voter demande d'être venu : scène scannée
  pendant un concert de l'artiste ou sa dédicace, QR du stand. Clôture `coeur_config.cloture`
  (dimanche 29/11 20 h) ou phase CLOTURE ; 10 XP par cœur, 3 fois au plus ; badge « Jury » au
  3e stand. `player_home` ne compte plus les cœurs.
- **Annonces** (`sources/80_annonces.sql`) : `announcements` gagne `titre`, `categorie`,
  `lien` (page du site uniquement) + `lien_libelle`, `fin` de validité. Niveau = `type`
  (danger = urgent). `admin_publier_annonce`, `admin_fermer_annonce` (gm / staff). L'alerte
  de la carte (`player_home`) suit la fin de validité.
- **Sondage du soir** (`sources/90_sondage.sql`) : remplace le questionnaire de sortie d'Otaku
  (`sortie_*` et `sortie_reponses` retirés). 9 questions (`sondage_questions()`), une réponse
  par joueur et par journée de jeu, de 22 h à 6 h (`sondage_config`), réponses liées au joueur
  (`sondage_reponses`, lecture staff), 40 XP + 2 jetons s'il a scanné un QR ce jour-là.
  `profil_stats` → `sondage` : décompte sans les textes libres.
- **Blind test** = moteur raid d'Otaku, textes adaptés (« Le public a conquis … »).
  `quiz_questions` gagne `categorie`, `reponse`, `anecdote`, `audio_url`, `audio_debut`,
  `pochette_url`, réglés par `admin_blind_question` (`sources/20_blind_test.sql`).
  Téléphones (`quiz_state`) : catégorie tout de suite ; réponse, anecdote, pochette chrono
  fini ; jamais l'extrait. Écran (`quiz_board`) : en plus l'extrait audio pendant la question
  (**nom de fichier neutre obligatoire**) et le top 10 de la manche après chaque révélation.
  Côté joueur (`sources/25_blind_joueur.sql`, étape 4.14) : barème des visuels (1 000 → 500
  points selon la vitesse, XP = points ÷ 25 à la réponse, plus de jetons par réponse) ;
  `quiz_scores` (totaux de la manche, une ligne par joueur) ; `quiz_state` réécrite (ma place,
  série, trio de tête et PV du boss **chrono fini seulement**, récapitulatif à la fin, retour à
  l'attente 2 h après) ; `admin_quiz_end` verse **une fois** (`recompenses_at`) badge Oreille
  d'or (top 10), jetons (podium 5, top 10 2, 10 bonnes 1), missions au compteur `blind` (avec
  ticket du jour) ; plus de bonus collectif du boss ; PV d'un boss jusqu'à 100 millions.
- **Correctif** : le tirage du mot du code secret renvoyait toujours le premier mot
  de la liste (bug présent en prod Otaku).
- **Correctif de sécurité** (2.5) : `_award_badge`, `_gen_qr_code` et `pass_actif` étaient
  exécutables par tout compte connecté, sans contrôle de rôle (faille présente en prod
  Otaku : un compte créé librement pouvait donner des badges et écrire sur l'écran géant).
  `search_path` fixé sur toutes les fonctions.

## Banc d'essai local

Un PostgreSQL local (installé : `C:\Program Files\PostgreSQL\18`) joue un festival en
accéléré : inscription avec ticket, 11 scans, badges, cœurs, profil, contact,
micro-question, roulette, blind test, vendeur, clôture, statistiques, refus de sécurité ;
puis le programme (`20_programme.sql` : saisie par le GM, refus pour les autres,
artistes non annoncés, chevauchements, favoris, rappels).

```bash
PG="/c/Program Files/PostgreSQL/18/bin"
"$PG/initdb.exe" -D /tmp/pgdomaf -U postgres -A trust -E UTF8 --locale=C   # une fois
"$PG/pg_ctl.exe" -D /tmp/pgdomaf -o "-p 54329" -l /tmp/pgdomaf.log start
bash supabase/outils/banc/lancer.sh        # doit finir par « SCÉNARIO COMPLET : OK », « PROGRAMME : OK », « BLIND TEST : OK », « TABLEAU DE BORD : OK », « SCANNER : OK », « MISSIONS : OK », « COLLECTION : OK », « CLASSEMENT : OK », « ROUE : OK », « COUPS DE CŒUR : OK », « ANNONCES : OK » et « SONDAGE : OK »
"$PG/pg_ctl.exe" -D /tmp/pgdomaf stop
```

`outils/banc/00_imiter_supabase.sql` imite les rôles et `auth.uid()` de Supabase :
**ne jamais l'exécuter sur Supabase**.

## Audit de la base (étape 2.5)

`outils/audit_base.sql` liste, une ligne par objet : tables (RLS, droits de `anon` /
`authenticated`, nombre de politiques), politiques, fonctions (`DEFINER`, `search_path`,
exécution par `anon` / `authenticated`, empreinte du code), déclencheurs, Realtime. `outils/audit_attendu.csv`
est le résultat attendu. Après toute modification de la base :

1. passer `audit_base.sql` sur une base locale neuve (`psql --csv -f`) → mettre à jour
   `audit_attendu.csv` si le changement est voulu ;
2. passer `audit_base.sql` dans l'éditeur SQL de Supabase → Export → **Copy as CSV** →
   comparer avec `audit_attendu.csv` (en ignorant les `\r`) : aucune différence attendue.

État au 17/09/2026 après 2.7 (Security Advisor) : 0 erreur ; 137 avertissements, tous voulus
(fonctions `SECURITY DEFINER` appelables par l'API = l'architecture « tout passe par des
RPC ») ; 7 infos « RLS sans politique » voulues (`carnets`, `favoris_programme`,
`player_secrets`, `quiz_answers`, `quiz_questions`, `quiz_sessions`, `tickets` : lecture par
RPC seulement).
Sonde : toutes les fonctions ouvertes aux connectés refusent un compte non staff
(`ACCES_REFUSE`), sauf `mon_acces` (ne renvoie que les droits de l'appelant).

## Correctifs d'une base déjà installée

`correctifs/` : scripts datés, à coller sur une base installée **avant** leur date
(le contenu est déjà dans `00_schema.sql`), dans l'ordre et **une seule fois**
(le 2.5 est rejouable, pas les 2.6 et 2.7 qui créent des tables ou des colonnes).

| Fichier | Contenu | Appliqué sur domaf-quest |
|---|---|---|
| `2026-09-17_etape-2.5.sql` | `_award_badge`, `_gen_qr_code`, `pass_actif` fermées aux connectés ; `search_path` fixé sur 13 fonctions | 17/09/2026 |
| `2026-09-17_etape-2.6.sql` | Programme et plan (copie de `sources/10_programme.sql`) | 17/09/2026 |
| `2026-09-17_etape-2.7.sql` | Colonnes du blind test, 5 fonctions complétées, `admin_blind_question` | 17/09/2026 |

## Dossiers

- `extraction-otaku/` : structure réelle de la prod Otaku (source du générateur).
- `sources/` : SQL propre à DOMAF, écrit à la main, inséré dans `00_schema.sql` par le générateur.
- `outils/` : générateur, banc d'essai, audit.
- `correctifs/` : mises à jour d'une base déjà installée.
