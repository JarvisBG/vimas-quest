# DOMAF Quest — mémoire du projet

> Fichier à lire en premier à chaque session. Le plan détaillé et l'avancement vivent
> dans `PLAN-DOMAF.md` (cases à cocher). Mettre à jour les deux à chaque étape validée.

## En une phrase

Reprendre le moteur **The Otaku Quest** (jeu de festival : inscription par code, scans de QR,
missions, XP, classement, roue, raids sur écran géant, console admin, billetterie vendeur)
et l'habiller avec les visuels de `domaf_visuels/` pour le **DOMAF 2026**, sur une base
Supabase **dédiée**.

## Le festival (vérifié sur domaf.org le 17/09/2026)

- **Douala Music'Art Festival (DOMAF)**, 15ᵉ édition — 15 ans
- **Du jeudi 26 au dimanche 29 novembre 2026**
- Site principal : **Stade Annexe de Bonamoussadi**, Douala (le festival déborde aussi sur
  Bonapriso, Akwa, Bépanda, Bonabéri, Bilongué, Japoma, Nkongmondo, Bali)
- Thème : « 1 cerveau + 1 cerveau = 3 cerveaux » (« na so e dey »)
- Organisé par l'association Green Grass depuis 2010

## Nom / marque

- **DOMAF Quest** (validé le 17/09/2026) — gamme « … Quest » signée loJIC Solutions
  (Otaku Quest → DOMAF Quest → …). Le **jeu** s'appelle « DOMAF Quest », le **festival** « DOMAF ».
- Les visuels d'origine s'appelaient « Résonance » (festival fictif) : renommé dans `app/`
  (clés `localStorage` `domafquest.*`, domaine provisoire `domafquest.example` à remplacer au déploiement).
- L'offre commerciale envoyée parle de « Parcours DOMAF » (`offre/`).

## Décisions verrouillées (17/09/2026)

| Sujet | Décision |
|---|---|
| Inscription | **Système de code d'Otaku** (`create_player` / `login_with_code`). Le « scan du billet » des visuels est à **corriger**. |
| Billetterie vendeur | **Conservée** (tickets papier, comptes vendeurs, encaissement) |
| Raids | **Conservés, devenus le blind test** : les boss sont des **figures de la musique** au lieu de persos d'animés. `blind-test.html` + `ecran/blind-test.html` = moteur raid. |
| Chasses au trésor, duels | **Écartés** |
| Tournoi du jour | **Gardé** (roi de la veille, `tournament_kings`) |
| Journée de jeu | **6 h → 6 h, heure de Douala** (`public.jour_jeu()`), et non minuit UTC |
| Base de données | Projet Supabase **domaf-quest** (`greawdlzcuewlcndddxq`, eu-west-3) sur le compte **2utilisateursivraj@gmail.com**, **forfait gratuit** |
| Code | GitHub **JarvisBG/domaf**, **privé** ; racine du dépôt = `domaf/`, site = `domaf/app/` |
| Console (étape 6) | **Style néon des pages Game Master d'Otaku** (pas l'habillage sérigraphie des joueurs) : `assets/css/console.css`, `console-theme.js` (clair / sombre) |
| Structure BDD | Copiée depuis la **prod** Otaku (`krkzahdbcnutxoyxproj`), lecture seule, **aucune donnée joueur** |

## Contraintes du forfait gratuit Supabase

- 200 connexions Realtime simultanées max (Otaku tournait en Pro pour 500) → **téléphones en
  polling, Realtime réservé à l'écran géant et à l'admin** (règle déjà en place dans Otaku)
- 500 Mo de base, 2 M messages Realtime / mois, pas de sauvegardes automatiques
- Le projet se **met en pause après 7 jours sans activité** → le réveiller avant le festival
  et faire des exports SQL manuels
- Passage en Pro à rediscuter si l'affluence attendue dépasse ~200 écrans connectés

## Où sont les choses

| Chemin | Rôle |
|---|---|
| `app/` | **L'application** (site statique déployé sur Cloudflare, `wrangler.jsonc` ici). Serveur local : `app/lancer-serveur.bat` → http://localhost:8766 |
| `app/assets/js/config.js` | URL du projet + clé **publishable** (`sb_publishable_…`, successeur de `anon`, publique). Jamais de `sb_secret_…` |
| `supabase/ROUTINE.md` | Forfait gratuit : sauvegarde (`outils/sauvegarder.sh`, hors Git dans `supabase/sauvegardes/`), réveil, échéances |
| `app/assets/js/serveur.js` | **Accès à la base** : `App.rpc`, `App.lire`, `App.sonder`, `App.etatJeu`, `App.joueur`, `App.direct`, `App.messageErreur` ; bascule `App.api` → `App.serveurApi` |
| `app/data/CORRESPONDANCE.md` | Clé de `mock.js` / action → table ou RPC (non publié) |
| `outils/police.py` | **Police Anton** réduite en WOFF2 (15 Ko) → `app/assets/fonts/Anton-Regular.woff2` ; la TTF d'origine est dans `outils/police/` |
| `outils/plan/fond_plan.py` | **Fond du plan** (Stade de Bonamoussadi, OpenStreetMap) → `app/assets/js/plan-fond.js`. Hors ligne, non déployé |
| `outils/photos.py` + `outils/README.md` | **Photos d'artistes en sérigraphie deux encres** (3 à 4 Ko pièce). Hors ligne, non déployé. Affichage : `App.photo()` |
| `app/data/PERFORMANCE.md` | **Règles de sobriété** (combien de requêtes par page) + coût de chaque page. À relire au début de chaque page de l'étape 4 |
| `.github/workflows/reveil-supabase.yml` | Requête à la base tous les 3 jours (anti-pause du forfait gratuit) ; lancement manuel : `gh workflow run reveil-supabase.yml` |
| `app/admin/` + `assets/js/console.js` | **Console** : `App.console` (`garde`, `appel`, `suivre`, `confirmer`, `occuper`, `MENU`) ; style `assets/css/console.css` (néon d'Otaku, autonome) + `console-theme.js` ; une page = `pages/console-<nom>.js` |
| `app/data/mock.js` | Données de démo (4 jours 26-29/11) — à remplacer par Supabase à l'étape 3 |
| `domaf_visuels/` | **Visuels d'origine**, référence intacte (versionnée) — ne pas modifier |
| `app/assets/js/app.js` | `App.data.get('<clé>')` = seul point d'accès aux données → à rebrancher sur Supabase |
| `app/assets/js/vendor/` | Bibliothèques locales : jsQR, qrcode-generator, supabase-js 2.110.2 |
| `supabase/00_schema.sql`, `01_reference.sql` | **Scripts de la base DOMAF**, à coller dans l'ordre. `00` est FABRIQUÉ par `supabase/outils/fabriquer_schema.py` : ne jamais l'éditer à la main |
| `supabase/sources/` | SQL **écrit à la main** propre à DOMAF (programme…), inséré dans `00` par le générateur |
| `supabase/contenu-essai/` | **Contenu d'essai** (20/09) : `contenu_essai.sql` (site, programme, QR, missions, lots, annonces, blind test) + `effacer_contenu_essai.sql` + `README.md`. **Line-up fictif avec de vrais artistes camerounais**, sans photo. Posé sur Supabase, à retirer à l'étape 7 |
| `supabase/correctifs/` | Scripts datés pour mettre à jour une base **déjà installée** (le contenu est aussi dans `00`) |
| `supabase/outils/audit_base.sql` | Audit (tables, politiques, droits, fonctions) ; résultat attendu : `audit_attendu.csv` |
| `supabase/outils/banc/` | Banc d'essai sur PostgreSQL 18 local (`C:\Program Files\PostgreSQL\18`) : `bash supabase/outils/banc/lancer.sh` |
| `supabase/extraction-otaku/` | Structure réelle de la prod Otaku (référence, lecture seule) + requêtes d'extraction |
| `parcours-domaf/`, `_sauvegarde/` | Archives, **ne pas modifier**, hors Git |
| `QUESTIONS-DOMAF.md` | **Banque de questions** du coffre + fiche fan (validée le 19/09) ; SQL et démo fabriqués par `supabase/outils/banque_questions.py` |
| `offre/` | Offre commerciale et captures — **hors Git** (`.gitignore`) |
| `../Otaku_Quest/` | Moteur de référence : `assets/js/api.js`, `admin/`, `live/`, `supabase/*.sql`, `REGLES.md`, `CONTEXTE-PROJET.md` |

## Principes hérités d'Otaku (non négociables)

1. Le client n'écrit **jamais** XP / jetons directement : tout passe par des RPC Postgres.
2. Sécurité = RLS + fonctions SQL + `is_staff`, jamais l'écran.
3. Site 100 % statique, sans build, **zéro CDN** (tout dans `assets/vendor/`).
4. Réseau de festival saturé : chaque kilo-octet compte.
5. **Sobriété des requêtes** : tout ce qui se lit passe par `App.cache` ; rien ne part
   quand l'onglet est caché ; aucune requête déclenchée par la frappe au clavier ; un bouton
   qui appelle la base se verrouille pendant l'appel. Détail : `app/data/PERFORMANCE.md`.

## Points de vigilance

- Dans Chrome, le JavaScript sur les pages Supabase est refusé : passer par l'éditeur SQL
  (collage via `Set-Clipboard`, bouton Run, Export → Download CSV). Écrire `upper('create')`
  dans les requêtes qui fabriquent du DDL, sinon l'éditeur ouvre une alerte RLS.
- Le forfait de l'organisation JarvisBG (Otaku) affiche aussi **FREE** au 17/09/2026.
- **En ligne (démo, 19/09/2026)** : https://festival-quest.jarvismboummeu28.workers.dev — Worker `festival-quest` (nom neutre voulu par Jarvis, pas « domaf »), compte Cloudflare jarvismboummeu28@gmail.com. Redéployer : `cd app && npx wrangler deploy` (changer `VERSION` dans `sw.js` avant ; **v15** au 20/09). La base porte maintenant le **contenu d'essai** : la démo se visite en mode serveur (`?mock=0` pour forcer, `?mock=1` pour revenir à la démo hors ligne).

- Jamais de clé `service_role` / `sb_secret_…` dans le code (la clé `anon` / publishable est publique par conception).
- `app/.assetsignore` : tout fichier interne ajouté dans `app/` doit y être déclaré, sinon il part en ligne.
- **Contenu d'essai en ligne** : le line-up posé sur Supabase est **fictif** mais porte de **vrais noms d'artistes camerounais**, et la démo est publique : ne jamais le présenter comme une annonce du festival. Aucune photo n'est posée. À remplacer à l'étape 7 (`supabase/contenu-essai/effacer_contenu_essai.sql`).
- Boss du blind test = vraies personnes (artistes) : droit à l'image des photos à vérifier.
- Les photos passent par `outils/photos.py` (deux encres). Le traitement **ne rend pas** une photo libre de droits.
- `app/assets/photos/demo-artiste-*.webp` sont **synthétiques** : à supprimer à l'étape 7.

## Pièges connus

- Éditeur SQL de Supabase : si le collage ne prend pas, cibler l'éditeur par `find` (« Editor content ») plutôt que par coordonnées ; les captures d'écran expirent parfois, `get_page_text` / `find` prennent le relais.
- Heredoc + Python pour écrire du Python : même avec `'EOF'`, préférer écrire le bloc dans un fichier puis l'insérer (les barres obliques inverses suivies de n ont été converties en vrais retours à la ligne).
- Mode : `App.mock` (démo) si `?mock=1` (retenu dans `localStorage`) ou sans `config.js` ; `?mock=0` pour revenir au serveur. Sessions séparées (`domafquest.session` / `domafquest.demo.session`).
- **Joueur d'essai en base** : `Essai41`, code `LOOP-67461` (créé le 17/09/2026 pour l'étape 4.1). À effacer avant le festival : `delete from player_secrets where player_id in (select id from players where pseudo like 'Essai%'); delete from players where pseudo like 'Essai%';`
- Service worker = « cache d'abord » pour les scripts : en développement, un fichier modifié arrive au **2ᵉ** chargement. Désinscrire le service worker + vider les caches avant de tester ; changer `VERSION` dans `sw.js` à chaque mise en ligne.
- Téléphones : **pas** de supabase-js ni de temps réel (`App.rpc`/`App.sonder`). Écran géant et console seulement : `vendor/supabase.min.js` + `App.direct`.
- `curl` de Windows vers Supabase : ajouter `--ssl-no-revoke` (le contrôle de révocation échoue, CRYPT_E_REVOCATION_OFFLINE).
- L'onglet Chrome peut se figer (zone d'affichage de quelques pixels) : ouvrir un nouvel onglet plutôt qu'insister. Le presse-papiers ne passe parfois plus : taper la requête (action `type`) si elle est courte.
- La page Users de Supabase affiche un total « estimé » faux : compter dans `auth.users`.
- N'importe qui peut se créer un compte Supabase Auth (tant que l'inscription est ouverte) : toute fonction ouverte à `authenticated` doit vérifier le rôle elle-même.
- Éditeur SQL : attendre ~2 s après le collage avant Run, sinon « expected string to have >=1 characters ». Il coupe à 100 lignes sans `limit` explicite.
- Exports CSV de Supabase : fins de ligne Windows dans les valeurs (le générateur les normalise).
- `select unnest(array[...]) ... order by random() limit 1` renvoie toujours le 1er élément
  (tri avant dépliage). Toujours mettre `unnest` dans le FROM. Bug présent en prod Otaku.
- **Annonces** : lecture publique de `announcements` (48 h), copie « annonces » gardée 1 min et partagée par tous les compteurs. Niveau = `type` (danger = urgent, alerte = important). `lien` n'accepte qu'une page du site. Fermer = `admin_fermer_annonce` (l'annonce passe dans « Anciennes »).
- Contenu des QR imprimés (format Otaku) : jeu = `…/scanner.html?code=DQ-XXXXXX`, ticket = `…/inscription.html?t=XXXXXXXX` (8 caractères). La base en ligne n'a **encore aucun QR** : un scan réussi n'a été vérifié que sur le banc local.
- Validation staff d'une mission : le QR du téléphone contient `DQ-JOUEUR:<id du joueur>` (public), jamais le code secret. La console (étape 5) devra le lire et appeler `admin_validate_quest`.
- Rangs : les seuils de `mock.js` (`rangs`) doivent rester ceux de `level_for_xp` / `rank_for_level` (550 / 1 750 / 4 050 / 7 150 XP).
- Cache de la carte : `carte.<id joueur>` (20 s, gardé sur le téléphone). Toute page qui change XP/jetons/missions doit appeler `App.cache.oublier(App.cleCarte())`.
- `quiz_sessions`, `tickets`, `carnets`… n'ont aucune politique de lecture : tout passe par les RPC.
- **Reliques** : le mot est gardé (décision du 18/09). Type de QR `relique` (plus `cache`), rareté `commune/rare/legendaire` (≠ badges `commun/rare/epique/legendaire`). L'indice d'une relique est **public** dès que le QR est actif : n'activer une relique qu'une fois cachée.
- **QR de scène** : un scan par concert (`scans.creneau_id`), une fois par jour hors concert ; le 2ᵉ scan du jour n'avance pas les missions. Un concert déjà scanné ne peut plus être supprimé (clé étrangère) : le déplacer plutôt.
- Cache de la collection : `collection.<id>` (2 min). Toute page qui ajoute un badge, un stand, un artiste ou une relique doit appeler `App.cache.oublier(App.cleCollection())`.
- **`jour_jeu()` ligne par ligne = lent** : fonction à `search_path` fixé, jamais dépliée ; dans un `where` sur `players` elle coûte ~27 ms pour 5 000 joueurs. La calculer une fois (variable, `(select public.jour_jeu())` ou paramètre). Même piège avec `_points_jour` : encore présent dans `leaderboard_view`, `live_board` (étape 5) et `admin_set_phase`.
- Cache de la roue : `roue.<id>` (20 s), oublié après un tirage. `spin_roulette` n'est **jamais** réessayé (un second envoi redépense des jetons). Plafond : `game_state.roulette_max_jour` (0 = aucun). La base en ligne n'a **encore aucun lot** : la page affiche « la roue ouvre bientôt ».
- **Coups de cœur** : table `coeurs` (catégorie `artistes` / `stands`, cible = `artistes.id` / `lieux.id`), totaux dans `coeurs_totaux` (déclencheur). Cache `coeurs.<id>` (30 s) **corrigé** par la réponse du vote, pas oublié. Clôture : `coeur_config.cloture` (console, politique « ecriture staff »). Badge « Jury » donné par `coeur_donner` au 3e stand.
- **Collecte (6.3 bis)** : fiche fan à l'inscription (facultative, « Passer » discret, 20 XP par réponse + 50 si complète, **un appel à la fin** : `fiche_enregistrer`) ; téléphone **19 ans et plus** (`_fiche_majeur` : 16-18 exclu), deux cases **jamais pré-cochées** (`player_contact.consent` = DOMAF, `.partenaires`), tour de roue offert une fois par numéro. **Coffre du scan** : l'XP d'un scan attend la réponse à une question (`coffres`, un par joueur, les scans suivants s'y ajoutent) ; ordre : champs de fiche vides → questions du soir (après `micro_config.soir_debut`, 20 h) → banque (`micro_questions`, 42) ; sans plafond ; le téléphone n'est **jamais** demandé par le coffre. Banque en base (`01_reference.sql`) **et** dans `mock.js` (`banqueQuestions`), fabriquées par le même script (`QUESTIONS-DOMAF.md` = source lisible) : garder identiques ; ne jamais changer une `valeur` après le début du festival. Le sondage du soir (4.11) est **retiré** (fondu dans le coffre). Recherche d'un joueur par numéro dans la console ; la fiche console ne montre que les 4 derniers chiffres.
- **Mesurer au banc** : un `raise notice` évalue ses arguments **dans l'ordre**. Un `(select count(*) …)` placé avant l'expression de durée s'ajoute au temps mesuré (un `count(*)` sur `scans`, 1,16 million de lignes avec politique RLS, coûte des secondes) : `console_qr` semblait coûter 1 394 ms au lieu de 38. Compter **avant** de lancer l'horloge, ou mettre la durée dans une variable. Corrigé en 6.4 dans `180_console.sql`, `190_joueurs.sql`, `200_contenu.sql`, `220_programme_console.sql`.
- **`<dialog>` dans Chrome piloté par l'extension** : l'événement `close` n'arrive pas (vérifié sur Chrome 153, même avec un vrai clic et `close()` en direct), alors que `returnValue` est bien posé. `C.confirmer` attend cet événement : dans un essai automatisé, remplacer `C.confirmer` par une fonction qui renvoie `true` plutôt que de conclure à un bogue de la page. Les captures d'écran expirent aussi quand une `<dialog>` est ouverte : passer par `javascript_tool`. **À confirmer dans un Chrome ordinaire** : si `close` n'arrivait pas non plus, toutes les confirmations de la console (6.2, 6.3, 6.4) et les pages qui écoutent `close` (scanner, roue, collection, programme) seraient touchées.
- **Programme de la console (6.4)** : l'identifiant lisible d'un lieu ou d'un artiste est **figé** après la création (`coeurs.cible` est un texte sans clé étrangère, et les liens `programme.html#id` en dépendent) ; une scène = une ligne `lieux` **et** une ligne `scenes`, écrites ensemble ; le style d'un artiste doit rester une valeur de `profil_options()` (sinon « mon programme » ne suggère plus rien) ; `x`/`y` sont en unités du fond (1000 × 700), posés au clic sur le plan.
- **PL/pgSQL** : `EXECUTE` ne met pas `FOUND` à jour → `get diagnostics n = row_count` (bogue trouvé au banc en 6.3 bis).
- **Banc** : `lancer.sh` éteint le coffre (`micro_config.actif = false`) pour les scénarios écrits avant lui ; `210_collecte.sql` le rallume et remplace `_collecte_soir()` pour choisir jour / soir. `json->'x' is null` est faux quand la valeur est un `null` JSON : `json_typeof(...) = 'null'`.
- **Style d'un artiste** : la base stocke le **code** (`rnb-soul`), les pages affichent le **libellé** du site (`genres` de `mock.js`). La traduction se fait dans `serveur.js` (`libellesGenres` / `nomGenre`) : carte, collection, cœurs et programme. Une nouvelle page qui montre un style doit passer par là.
- **Programme** : `api.programme().concerts` = une entrée **par concert** (`id` = créneau, `artisteId`) ; favori = créneau. Copie « programme » (5 min, gardée, resservie) partagée par programme, mon programme et bientôt le plan ; favoris `favoris.<id>` (`App.cleFavoris()`) corrigés par les réponses, **oubliés après un scan**. Réglages des rappels et conflits acceptés : sur le téléphone (`domafquest.rappels.<id>`, `domafquest.conflits.<id>`). La base en ligne n'a **encore aucun artiste** : la page affiche « Programme bientôt annoncé ».
- **Plan** : lieux = table `lieux` (`x`/`y` en unités du fond, 1 unité ≈ 0,40 m) ; aucun lieu en base pour l'instant (le plan affiche « bientôt »). Si le fond est régénéré, recopier `geo` et `metresParUnite` dans `planConfig` (`mock.js`). Ne jamais décalquer Google Maps. Pas de formulaire de contact ni d'effacement côté joueur : l'effacement se fait au stand (console, étape 6).
- **Blind test** (4.14) : points = 1 000 → 500 selon la vitesse, XP = points ÷ 25 **à la réponse**, pas de jetons par réponse. `quiz_scores` = totaux par joueur (tenus par `quiz_answer`, jamais recalculés). `quiz_state` ne montre place / PV / trio / verdict qu'**une fois le chrono fini** (+2 s). `admin_quiz_end` ne récompense qu'**une fois** (`recompenses_at`) ; missions `blind` seulement avec ticket du jour (piège `pass_garde`). `raid_bonus_xp` n'est plus versé. Téléphone : rythme dans `modeServeur` (`pages/blind-test.js`), pas `App.sonder`. La base en ligne n'a **encore aucune manche**.
- **Service worker** : n'installe que ce qu'ouvre un téléphone (pas `ecran/`, pas supabase-js) ; une page = une copie, sans ses paramètres. Toute nouvelle page ou script de téléphone doit être ajouté à `PAGES` / `FICHIERS` de `sw.js`. `404.html` est servie par Cloudflare à n'importe quelle adresse : chemins **absolus** dans ce fichier seulement.
- Police : caractère absent du sous-ensemble = police de secours → l'ajouter dans `outils/police.py` (et changer le nom du fichier : polices gardées un an).
- Amis du classement : **sur le téléphone** (`domafquest.amis.<id>`, 30 pseudos), perdus si on change de téléphone ; place précédente pour la flèche : `domafquest.place.<id>.<periode>`.
- Badges secrets : le nom est caché par `player_collection`, mais la table `badges` reste **lisible par tous** (politique d'Otaku) : le secret n'est qu'un effet d'écran.
- Le drapeau `dq.pass_bypass` (bonus du GM) dure jusqu'à la fin de la transaction.
- **Mur** (5.1) : `mur_direct()` = tout l'écran ; `App.api.mur` (démo + serveur). Le temps réel n'est qu'un **signal** (relecture au plus 1 / 5 s, filet 60 s) ; `live_board` / `leaderboard_view` ne sont plus appelées (à retirer en 6 si la console n'en a pas besoin). Exploit « rang » = seulement quand `rank_for_level` change ; le journal de la roue n'a pas `old_level` (un niveau d'écart supposé). Onglet caché = aucune relecture (pour tester, mettre l'onglet au premier plan).
- **Plateau du blind test** (5.2) : `quiz_board` réécrite (`sources/98_ecran_blind.sql`) ; l'écran suit la régie par `game_state` (`admin_quiz_next` touche `updated_at`) et les événements `raid` / `quiz`. En mode serveur l'écran ne pilote rien. `boss_image`, `audio_url`, `pochette_url` : chemin du site (résolu depuis `App.racine`) ou `https://`. Tester un écran : l'onglet doit être **visible** (sinon aucune relecture) ; dans un onglet d'arrière-plan, forcer `document.hidden` dans la console pour l'essai.
- Heredocs bash + Python : les barres obliques inverses (`\n`, `\1`…) y sont
  interprétées. Pour éditer un script Python ou un fichier Markdown, préférer l'outil d'édition.

- **Joueur effacé** (6.2) : jamais supprimé (son ticket payé redeviendrait libre) : `players.efface_le` non nul, pseudo « Effacé-XXXXXX », statut `exclu`, plus de code ni de téléphone. Toute nouvelle requête qui liste ou compte des joueurs « exclus » doit ajouter `efface_le is null`. `console_journal` (lecture du code, effacement) n'a aucune politique : lue seulement par les fonctions. Bonus : 1 à 5 000 XP, jamais de malus (en base). `admin_liste_joueurs` n'existe plus : `console_joueurs` (paginée).
- **Console** : la session du compte staff est dans supabase-js (`App.clientSupabase()`), les appels passent par `App.console.appel` (jamais `App.rpc`, qui n'envoie que la clé publique). Tester une page de console sans mot de passe : copie temporaire de la page + script qui remplace `C.garde` / `C.appel` (et `document.hidden` forcé à `false`), à effacer ensuite. `admin_set_phase` reste ouverte aux vendeurs (`is_equipe`, héritage Otaku).

- **Contenu du jeu** (6.3) : les `admin_*` d'Otaku pour missions / badges / QR n'existent plus → `console_missions`, `console_badges`, `console_qr` (lecture) et `console_*_enregistrer` (JSON, tous les champs) ; `console_activer('mission'|'qr', …)`. Compteurs de mission : liste fermée `_compteurs_mission()` (à compléter si un nouveau compteur apparaît en base). Suppression refusée dès qu'un joueur a scanné / terminé / gagné : **éteindre**.
- **Totaux par déclencheur** : `qr_scans_jour` (scans par QR et journée) et `missions_faites_jour` (missions terminées) sont tenus par `scans_compter` / `quest_progress_compter`. Toute écriture dans `scans` ou `quest_progress` les met à jour ; ne jamais les remplir à la main (une remise à zéro des données de test passe par `delete` sur `scans` / `quest_progress`, les totaux suivent).
- **Badges système** (donnés par leur nom, protégés) : Première note, Curieux, Fouineur, Autographe, Jury, Oreille d'or, Lève-tôt, Noctambule, Marathonien, Podium (`_is_system_badge`). Un nouveau badge donné par son nom dans une fonction doit y être ajouté. Podium n'est donné que si le GM passe la phase **Clôture** le soir.
- **QR** : relique créée **éteinte** ; le lien au lieu (`lieux.qr_code_id`) ou à la séance (`dedicaces.qr_code_id`) se règle dans l'écran QR (un lieu = un QR). Étiquettes : `console-etiquettes.js`, l'adresse encodée est `App.racine` + `scanner.html?code=` → imprimer **depuis le site en ligne** (sinon « ESSAI » en travers).
- Sprite : l'icône `plus` est trois points (« plus d'options »), pas un signe +. Captures d'écran Chrome : elles expirent souvent quand une `<dialog>` est ouverte → contrôler par `javascript_tool`.
- Banc complet (`lancer.sh`) : ~9 min depuis `200_contenu.sql` (1,28 million de scans avec déclencheur) ; ses mesures se font dans une connexion neuve (`\c`).

## Méthode de travail

Étape par étape, page par page, validation de Jarvis avant de passer à la suivante.
Échanges en français.
**À chaque fin de tâche** : cocher `PLAN-DOMAF.md`, ajouter une ligne au journal, mettre à jour
ce fichier et la section « Prochain prompt » ci-dessous, puis commit + push.

## État d'avancement

- ✅ Étape 0 (cadrage) — ✅ Étape 1 (mise en place, 17/09/2026)
- ✅ Étape 2.1 : structure de la prod Otaku extraite → `supabase/extraction-otaku/`
- ✅ Étapes 2.2 + 2.3 : `supabase/00_schema.sql` + `01_reference.sql`, testés en local (voir `supabase/README.md`)
- ✅ Étape 2.4 : projet Supabase **domaf-quest** créé (réf. `greawdlzcuewlcndddxq`, AWS eu-west-3 Paris, org. Sivraj), les deux scripts passés
- ✅ Étape 2.5 : base vérifiée (audit reproductible, faille `_award_badge` héritée d'Otaku corrigée, voir `supabase/README.md`)
- ✅ Étape 2.6 : tables du programme et du plan (`supabase/sources/10_programme.sql`), appliquées sur Supabase
- ✅ Étape 2.7 : champs du blind test (`sources/20_blind_test.sql` + générateur), appliqués sur Supabase
- ✅ Fin de l'étape 2 : compte GM « Jarvis » (rôle `gm`), `app/assets/js/config.js`, routine du forfait gratuit (`supabase/ROUTINE.md`)
- ✅ Étape 3 : couche de données (`app/assets/js/serveur.js`, `app/data/CORRESPONDANCE.md`) ; rappel automatique anti-pause (`.github/workflows/reveil-supabase.yml`)
- ✅ Étape 4.1 : `inscription.html` au système de code (carte + code secret + reprise par code, ticket papier conditionnel) ; `App.cache` dans `serveur.js` et `app/data/PERFORMANCE.md`
- ✅ Visuels : décision du 17/09 — photos d'artistes en **sérigraphie deux encres**. Outil, composant `App.photo` et cadre CSS en place, **branchés sur `programme.html`** (liste + fiche artiste, 18/09) ; il manque les vraies photos (étape 7)
- ✅ Étape 4.2 : `tableau-de-bord.html` sur `player_home` seule (complétée en base, correctif `2026-09-18_etape-4.2.sql` appliqué)
- ✅ Étape 4.3 : `scanner.html` sur `scan_qr` (complétée) + `ticket_utiliser` ; correctif `2026-09-18_etape-4.3.sql` appliqué
- ✅ Étape 4.4 : `missions.html` (catégories gardées via `quests.categorie`, indices payants retirés) ; correctif `2026-09-18_etape-4.4.sql` appliqué
- ✅ Étape 4.5 : `collection.html` sur `player_collection` réécrite (badges, artistes, stands, **reliques**) ; scan de scène par concert ; correctif `2026-09-18_etape-4.5.sql` appliqué
- ✅ Étape 4.6 : `passeport.html` sur `player_home` + `player_collection` (0 à 2 requêtes) ; pas de passeport public, lien = adresse du jeu ; correctif `2026-09-18_etape-4.6.sql` appliqué
- ✅ Étape 4.7 : `classement.html` sur `classement_joueur` / `_chercher` / `_amis` (amis sur le téléphone) ; `player_home` 87 → 33 ms ; correctif `2026-09-18_etape-4.7.sql` appliqué
- ✅ Étape 4.8 : `roue.html` sur `roulette_joueur` (un appel) + `spin_roulette` (plafond par journée de jeu) ; correctif `2026-09-18_etape-4.8.sql` appliqué
- ✅ Étape 4.9 : `coups-de-coeur.html` — artistes + stands (table `coeurs`, 3 cœurs par catégorie, « vu » requis), clôture datée ; correctif `2026-09-18_etape-4.9.sql` appliqué
- ✅ Étape 4.10 : `annonces.html` — `announcements` enrichie (titre, catégorie, lien, fin), version serveur de `App.api.annonces` ; correctif `2026-09-18_etape-4.10.sql` appliqué
- ✅ Étape 4.11 : `sondage.html` — sondage du soir (9 questions, lié au joueur, 40 XP si venu), sortie d'Otaku retirée ; correctif `2026-09-18_etape-4.11.sql` appliqué
- ✅ Étape 4.12 : `programme.html` + `mon-programme.html` sur `programme_public` (gardé) + `programme_favoris` complétée (favoris, vus, style) ; une entrée par concert ; correctif `2026-09-18_etape-4.12.sql` appliqué
- ✅ Étape 4.13 : `plan.html` sur le vrai fond du stade (OpenStreetMap, `outils/plan/`) + lieux de `programme_public` (0 requête en venant du programme) ; `infos.html` + `regles_jeu()`, sans formulaire de contact ni effacement ; correctif `2026-09-18_etape-4.13.sql` appliqué
- ✅ Étape 4.14 : `blind-test.html` côté joueur sur `quiz_state` / `quiz_answer` réécrites (barème des visuels, `quiz_scores`), récompenses à la clôture ; correctif `2026-09-18_etape-4.14.sql` appliqué
- ✅ Étape 4.15 : `index.html` (line-up et lots de la base, bilan retiré, partenaires masqués), pages système (404 Cloudflare), `sw.js` allégé, police WOFF2 15 Ko — **fin de l'étape 4**
- ✅ Étape 5.1 : `ecran/mur.html` sur `mur_direct()` (un appel, 5 à 6,5 ms au banc contre 78 ms pour `live_board`) + temps réel (relecture au plus 1 / 5 s) ; tournoi du jour seulement ; correctif `2026-09-18_etape-5.1.sql` appliqué
- ✅ Étape 5.2 : `ecran/blind-test.html` sur `quiz_board` réécrite (0,6 à 1,6 ms au banc), boss à l'écran, 3 plus rapides, signal `game_state` à chaque question ; correctif `2026-09-18_etape-5.2.sql` appliqué — **fin de l'étape 5**
- ✅ Étape 6 cadrée : découpage 6.1 → 6.8 validé (voir `PLAN-DOMAF.md`)
- ✅ Étape 6.1 : socle de la console `app/admin/` (connexion, garde par rôle, menu, style néon d'Otaku, clair / sombre) + tableau de bord sur `console_accueil()` (un appel, 10 ms au banc) ; correctif `2026-09-18_etape-6.1.sql` appliqué
- ✅ Étape 6.2 : `admin/joueurs.html` sur `console_joueurs` (50 par page, 16 ms au banc) + `console_joueur` (fiche en un appel) ; bonus 1 à 5 000 sans malus, code tracé, effacement GM (ligne anonyme) ; correctif `2026-09-18_etape-6.2.sql` appliqué
- ✅ Étape 6.3 : `admin/missions.html`, `badges.html`, `qr.html` sur `console_missions` / `_badges` / `_qr` (un appel chacun ; totaux `qr_scans_jour` / `missions_faites_jour` par déclencheur : 38 et 1,4 ms au banc, mesures refaites en 6.4) ; lien QR ↔ lieu / séance, suppression refusée après usage, étiquettes A4 (sérigraphie) ; badges Lève-tôt, Noctambule, Marathonien, Podium automatiques ; correctif `2026-09-19_etape-6.3.sql` appliqué
- ✅ Étape 6.3 bis (collecte, demandée par Jarvis avant 6.4 pour le rendez-vous) : fiche fan + téléphone à l'inscription, **coffre du scan** (la question verrouille l'XP), banque de 42 questions (`QUESTIONS-DOMAF.md`), sondage du soir fondu ; correctif `2026-09-19_etape-6.3bis.sql` **appliqué** sur Supabase le 19/09 (audit en ligne identique), démo redéployée (v14)
- ✅ Étape 6.4 : `admin/programme.html` sur `console_programme` (un appel, 8,8 ms au banc pour 106 lieux, 129 artistes, 210 concerts) + `console_lieu_/_artiste_/_concert_/_dedicace_enregistrer`, `console_programme_activer` / `_supprimer` ; grille jour × scène, placement sur le fond du plan ; correctif `2026-09-19_etape-6.4.sql` appliqué (audit en ligne identique, 251 lignes)
- ⏭ Étape 6.5 : animation (roue et lots, annonces, coups de cœur, tirage au sort final)

## ▶ Prochain prompt (en cas de coupure)

> Continue le projet DOMAF Quest : lis `CLAUDE.md`, `PLAN-DOMAF.md`, `app/data/CORRESPONDANCE.md`
> et `app/data/PERFORMANCE.md`, puis attaque l'**étape 6.5** — animation dans la console : roue (lots, coût, plafond par journée,
> retrait des bons gagnés), annonces (publier, fermer, niveaux), coups de cœur (clôture datée,
> palmarès) et **tirage au sort final** (joueurs avec numéro, 29/11, validé le 19/09).
> Comparer d'abord ce que la base offre (`admin_publier_annonce` / `admin_fermer_annonce` existent,
> la roue et les cœurs n'ont pas de fonctions d'écriture côté console) et soumettre à Jarvis ce qui manque.
> Style néon, socle `App.console`, une page = `pages/console-<nom>.js`.
> À prévoir plus tard : retrait du numéro d'un joueur depuis la console, statistiques de
> collecte (6.8, `profil_stats`).
