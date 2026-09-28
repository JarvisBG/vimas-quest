# Correspondance mock.js → Supabase (étape 3)

Fichier interne (non publié : `*.md` est dans `.assetsignore`).
`App.data.get(clé)` lit `mock.js`, sauf si `serveur.js` déclare `App.sources[clé]`.
Les actions (`App.api.*`) ont leur version démo dans `app.js` ; leur version serveur va dans
`App.serveurApi` (étape 4, page par page).

Légende — **Site** : reste une configuration du site (pas de base) · **Base** : lu/écrit en base ·
**Démo** : n'existe qu'en démonstration, disparaît en mode serveur · **À trancher** : pas de
fonction en base, décision à prendre à l'étape indiquée.

## Clés de données

| Clé mock.js | Devient | Source Supabase | Page / étape |
|---|---|---|---|
| `festival` | Site | — (nom, dates, lieu, contact) | accueil, infos |
| `jours` | Site | — (26 → 29/11) ; le jour courant vient de `jour_jeu()` | partout |
| `scenes` | Base | `programme_public()` → `scenes` ; saisie dans la console : une scène = un `lieux` de catégorie `scene` **et** sa ligne `scenes` (couleur), écrits ensemble par `console_lieu_enregistrer` (6.4) | programme 4.x, console 6.4 |
| `artistes` | Base | ✅ `programme_public()` → `artistes` + `creneaux` : `api.programme().concerts` = **une entrée par concert** (`id` = créneau, `artisteId`) ; lien `programme.html#<artiste>` ouvre la fiche (4.12) ; saisie : `console_artiste_enregistrer` / `console_concert_enregistrer` (6.4), style pris dans `profil_options()` | programme, mon-programme, console 6.4 |
| `dedicaces` | Base | `programme_public()` → `dedicaces` ; saisie : `console_dedicace_enregistrer` (6.4), le QR se relie dans l'écran QR (6.3) | programme, console 6.4 |
| `programmeConfig` | Site | — (heures d'ouverture de la grille, échelle) | programme |
| `marcheEntreScenes` | Démo | ✅ mode serveur : ligne droite entre `lieux.x/y` × `planConfig.metresParUnite` × 1,3 (détour) ÷ `metresParMinute` ; scène sans coordonnées → temps de marche inconnu, pas deviné (4.12) | mon-programme |
| `rappelsParDefaut` | Site | ✅ interrupteur et délai : **sur le téléphone** (`domafquest.rappels.<id>`) ; rappel par concert : `favoris_programme.rappel` via `programme_rappel` ; conflits acceptés : `domafquest.conflits.<id>` (4.12) | mon-programme |
| `infos` | ✅ Site + `regles_jeu()` (barème des XP par type de QR actif, coût et plafond de la roue ; public, nombres seulement ; cache « regles » 10 min gardé, resservi) | — (horaires, accès, FAQ) | infos |
| `fiche` | Site + Base | ✅ champs de la fiche fan et leurs réponses : les **valeurs** doivent rester celles de `profil_options()` (`sources/92_collecte.sql`) ; tranches « majeures » = `_fiche_majeur` ; enregistrement : `fiche_enregistrer` (6.3 bis) | inscription, carte |
| `banqueQuestions`, `coffreConfig` | Démo (copie de la base) | ✅ banque du coffre = `micro_questions` (`01_reference.sql`, fabriquées par le même script : **garder identiques**) ; en mode serveur la question arrive avec `scan_qr` / `player_home` (6.3 bis). Le sondage du soir (4.11) y est **fondu** | scanner |
| `planConfig` | Site | — (échelle, géorepères, n° sécurité **à remplacer**) | plan |
| `categoriesLieux` | Site | — (icônes, couleurs) | plan |
| `lieux` | Base | `programme_public()` → `lieux` ; saisie : `console_lieu_enregistrer` (6.4), `x`/`y` posés sur le fond du plan (`plan-fond.js`, 1000 × 700 unités) | plan, console 6.4 |
| `etapes`, `partenaires`, `bandeau` | Site | — ; `partenaires` **vide** (noms de démo inventés, décision du 18/09) : section et liens masqués tant qu'elle l'est ; `festival.contactPartenaires` à fournir. Le bilan de l'« édition précédente » (inventé) est **retiré** | accueil |
| `rangs` | Site | seuils = `level_for_xp` / `rank_for_level` en base (550 / 1 750 / 4 050 / 7 150, alignés le 18/09) : **garder les deux alignés** | partout |
| `lots` | Base | ✅ accueil : `App.api.vitrine()` → `roulette_prizes` (lecture publique, `kind = objet`, actifs, copie « lots » 5 min) ; line-up : copie « programme » | roue, accueil |
| `roue` | Base + Site | ✅ `roulette_joueur(code)` : coût, plafond (`game_state.roulette_max_jour`, 0 = aucun), tirages du jour, lots (`rarete`, `court`) ; tirage : `spin_roulette` ; plus de délai entre deux tirages ; lieu, horaires, date limite de retrait : **site** (`roue.retrait`) | roue |
| `bonsDeBase` | Base | ✅ bons de retrait = `roulette_spins` via `roulette_joueur` (50 derniers, « retiré par » = `redeemed_by` → `staff.display_name`) ; QR du bon : `DQ-BON:<code>` | roue |
| `blindTest` | Site | — (horaire, durées d'affichage) | blind test |
| `blindQuestions` | Base | ✅ écran : `quiz_board()` réécrite (5.2 : `quiz_scores`, 3 plus rapides, boss, exclus masqués) via `App.serveurApi.blindPlateau()` ; téléphone : `quiz_state(code)` ; réponse : `quiz_answer` | blind test |
| `quizDemo` | Démo | — | accueil |
| `billetterieDemo` | Base | `billetterie_config` (lecture publique) via `App.billetterie()` — gardé 5 min sur le téléphone | inscription ✅ 4.1 |
| `tickets` | Base | tickets papier : `ticket_verifier` ; n'apparaît que si `billetterie_config.actif` | inscription ✅ 4.1 |
| `joueurs` | Base | `players` + `create_player` / `login_with_code` (le champ `code` = code secret) | inscription ✅ 4.1 |
| `pseudosPris` | Démo | erreur `PSEUDO_DEJA_PRIS` de `create_player` ; **aucune vérification au fil de la frappe** en mode serveur | inscription ✅ 4.1 |
| `motsPseudo` | Site | — (suggestions de pseudo) | inscription |
| `genres` | Site + Base | liste : site (styles du programme), les **valeurs** doivent rester celles de `profil_options()` ; le choix du joueur passe par la fiche (`fiche_enregistrer`, 6.3 bis) | mon programme |
| `avatars` | Site | l'avatar choisi = `players.archetype` | partout |
| `missions` | Base | ✅ `player_home` → `quests` (avancée, catégorie, heure de validation) ; validation staff : `admin_validate_quest` | missions 4.4 |
| `categoriesMissions` | Site + Base | libellés et icônes : site ; valeur : `quests.categorie` (exploration, musique, gourmand, social, defi), réglée dans la console par `console_mission_enregistrer` (6.3) | missions ✅ 4.4 |
| `etatsJoueur` | Base | `player_home(code)`, `player_collection(code)`, `leaderboard_view(id)` | tableau de bord, collection |
| `annonces` | Base | ✅ `announcements` (lecture publique, 48 h, 30 au plus) : `titre`, `message`, `categorie`, `lien` + `lien_libelle`, `fin` (4.10) ; niveau = `type` (danger → urgent, alerte → important, info / succes → info) ; « lues » : sur le téléphone | annonces |
| `typesAnnonces` | Site | libellés et icônes ; les clés doivent rester celles de la contrainte `announcements.categorie` (meteo, horaire, surprise, securite, jeu, pratique) | annonces |
| `badges` | Base | ✅ `player_collection` → badges : `badges.rarete / forme / secret / lien` (4.5, réglés dans la console par `console_badge_enregistrer`, 6.3), % de joueurs calculé ; badge secret = nom et icône cachés | collection 4.5 |
| `raretes` | Site | — (reliques en base : commune / rare / legendaire → converties en commun / rare / legendaire) | collection |
| `stands` | Base | ✅ `player_collection` → stands : `lieux` stand / food **ayant un QR** ; zone = `lieux.description` | coups de cœur, collection 4.5 |
| `votesConfig` | Base + Site | ✅ `coeur_liste` : `max` (par catégorie), `xp`, `xp_restants`, `cloture` (`coeur_config.cloture`), `clos` ; texte des résultats : **site** (`votesConfig.resultats`) | coups de cœur |
| `votesTendances` | Base | ✅ total de chaque artiste / stand dans `coeur_liste` (`coeurs_totaux`) ; écran géant : `coeur_palmares(categorie, n)` | coups de cœur |
| `votesDeBase` | Base | ✅ `coeur_liste(code).mes` ; votes : `coeur_donner` / `coeur_retirer(code, categorie, id)` sur des **artistes** et des **stands** (table `coeurs`) | coups de cœur |
| `classementConfig` | Démo | ✅ `classement_joueur(code, periode)` : top 10, voisins, place, écart (4.7) ; écran géant : `mur_direct` (5.1) | classement 4.7 |
| `joueursConnus`, `amisDeBase` | Démo | ✅ amis **sur le téléphone** (`domafquest.amis.<id>`, pseudos) → `classement_amis` ; recherche → `classement_chercher` (4.7) | classement 4.7 |
| `qrcodes` | Base | scan : `scan_qr(code, qr)` ; la liste n'est **jamais** envoyée aux téléphones | scanner 4.3 |
| `typesQR` | Site | — (les types doivent rester ceux de la contrainte `qr_codes.type` : scene, stand, foodtruck, service, **relique**, dedicace, surprise) | scanner |
| `bonusBienvenue` | Site | `create_player` ne donne **ni XP ni jetons** : le joueur part de zéro. Seule la première mission est un texte du site | inscription ✅ 4.1 |

## Actions (App.api)

| Action démo | Version serveur prévue |
|---|---|
| `billetterie` | ✅ `billetterie_config` (`App.billetterie`, cache 5 min, gardé sur le téléphone) |
| `verifierBillet` | ✅ `ticket_verifier` |
| `pseudoDisponible` | ✅ renvoie toujours vrai en mode serveur (zéro requête) |
| `creerProfil` | ✅ `create_player` (le style et le reste de la fiche partent ensuite avec `enregistrerFiche`) |
| `enregistrerFiche`, `ficheEtat` | ✅ `fiche_enregistrer(code, fiche, téléphone, domaf, partenaires)` en UN appel (6.3 bis) ; `ficheEtat` = `player_home.fiche` (carte gardée 20 s) |
| `ouvrirCoffre`, `coffreEnAttente` | ✅ `coffre_ouvrir(code, clé, valeur, durée)` (rejouable) ; coffre fermé copié sur le téléphone (`domafquest.coffre.<id>`, `App.coffreLocal`) depuis `scan_qr` et `player_home` |
| `reprendre` | ✅ `login_with_code` (`App.joueur.connecter`) |
| `carte` | ✅ `player_home` seule (complétée à l'étape 4.2 : `prochain_concert`, `annonce`, `classement_general`, `scans_jour`, `roulette_cost`) ; cache `carte.<id>` 20 s → `App.cache.oublier(App.cleCarte())` après un scan, un tirage, un vote |
| `scanner` | ✅ `scan_qr` (QR `DQ-…`, complétée à l'étape 4.3 : `quetes` = avancée des missions touchées ; 6.3 bis : `coffre` = XP en attente + question) ; `ticket_utiliser` (ticket : `?t=` ou 8 caractères) |
| `missions` | ✅ `player_home` (cache partagé avec la carte) ; indices payants **retirés** (décision du 18/09) |
| `collection` | ✅ `player_collection` réécrite (4.5) : badges, artistes (scène scannée **pendant** le concert → `scans.creneau_id`, ou dédicace), stands, **reliques** (indice + rareté ; nom une fois trouvée) ; cache `collection.<id>` 2 min → `App.cache.oublier(App.cleCollection())` après un scan |
| `classement`, `chercherJoueur` | ✅ `classement_joueur` (cache 30 s par onglet), `classement_chercher` (sur validation, 3 lettres) ; flèche de progression du joueur calculée sur le téléphone |
| `amis`, `ajouterAmi` | ✅ `classement_amis` ; ajout par pseudo exact, liste gardée sur le téléphone (30 au plus) |
| `passeport` | ✅ `player_home` (place) + `player_collection` (joueurs, jours de présence, missions terminées, badges, artistes, stands) ; lien et QR = adresse du jeu (pas de passeport public, décision du 18/09) |
| `mur` (remplace `ecranClassement`, `ecranExploits`) | ✅ `mur_direct()` en **un appel** : tournoi du jour (top 10, roi de la veille), joueurs, scans du jour, 8 derniers exploits (relique, badge — nom caché si secret —, mission, roue, **changement de rang**), annonces en cours, phase. Temps réel (`App.direct`, canal « mur ») sur `events` INSERT, `announcements`, `game_state` UPDATE = simple signal → relecture, **au plus 1 / 5 s** ; filet 60 s (20 s canal coupé). `live_board` / `leaderboard_view` ne sont plus appelées (5.1) |
| `blindTestDirect`, `blindRepondre`, `blindMonScore`, `blindTerminer` | Démo seulement (horloge locale). ✅ Écran géant (5.2) : `App.serveurApi.blindPlateau()` = `quiz_board` remis en forme (session, boss, question, révélation, classement) ; la page recalcule le chrono localement ; phases serveur : attente (heure du site) → salle (manche lancée) → question → révélation 10 s → classement jusqu'à la question suivante → fin (2 h). Signal : `admin_quiz_next` touche `game_state.updated_at` (temps réel) ; fin : événements `raid` / `quiz`. ✅ Mode serveur : `App.serveurApi.blindEtat()` = `quiz_state` remis en forme (phase attente / salle / question / révélation / fin, heures locales de fin et de fermeture, ma réponse, moi, tête, boss, récapitulatif) ; `App.serveurApi.blindEnvoyer()` = `quiz_answer` (`DEJA_REPONDU` = reçu). La régie mène la manche ; gains versés par `admin_quiz_end` (une fois) |
| `coupsDeCoeur`, `voter` | ✅ `coeur_liste` (1 appel, cache `coeurs.<id>` 30 s) ; `coeur_donner` / `coeur_retirer` renvoient `mes` et le nouveau total → la copie en cache est corrigée, pas de relecture ; artiste votable si **vu** (scène scannée pendant un concert, dédicace), stand si scanné ; badge Jury au 3e stand |
| `roue`, `tirer` | ✅ `roulette_joueur` (1 appel, cache `roue.<id>` 20 s) ; `spin_roulette` renvoie l'`id` du lot → la roue s'arrête sur sa case ; `prize` nul = dernier exemplaire parti pendant le tirage |
| `programme`, `basculerFavori`, `monProgramme`, `reglerRappels`, `basculerRappel`, `resoudreConflit` | ✅ `programme_public` (cache « programme » 5 min, gardé, resservi) + `programme_favoris(code)` → `{ favoris, vus, genre }` (cache `favoris.<id>` 5 min, gardé ; `App.cleFavoris()`, oublié après un scan) ; `programme_basculer_favori` / `programme_rappel` corrigent la copie ; calculs partagés démo/serveur : `App.calculerMonProgramme` ; « garder X » = 1 bascule par concert retiré |
| `plan` | ✅ `programme_public` → `lieux` (copie « programme » : **0 requête** en venant du programme ; `programme({ joueur: false })`, sans les favoris) + stands scannés via `player_collection` (copie `collection.<id>` 2 min) + alerte abris via la copie « annonces » ; fond = `assets/js/plan-fond.js` (OpenStreetMap, `outils/plan/fond_plan.py`) ; lieu sans `x`/`y` : liste seulement |
| `infos` | ✅ Site + `regles_jeu()` (barème des XP par type de QR actif, coût et plafond de la roue ; public, nombres seulement ; cache « regles » 10 min gardé, resservi) |
| `deconnecter` | ✅ Téléphone seulement (oublie carte, collection, favoris, session). **Pas de formulaire de contact ni d'effacement côté joueur** (décision du 18/09) : e-mail + Point info ; l'effacement se demande au Stand DOMAF Quest |
| `codeValidation` | ✅ `DQ-JOUEUR:<id>` + pseudo (identifiant public, **jamais** le code secret) ; la console (`admin/joueurs.html`, 6.2) le scanne, ouvre la fiche et appelle `admin_validate_quest` |
| `annonces`, `marquerLues` | ✅ `App.lire('announcements')`, cache « annonces » 60 s gardé et resservi (`{ frais: true }` pour la page Annonces) ; « lues » sur le téléphone ; publication : `admin_publier_annonce`, fermeture : `admin_fermer_annonce` (console, étape 6) |
| **Console — programme** (6.4, hors `App.api` : `C.appel`) | ✅ `console_programme()` = tout l'écran en un appel (lieux et scènes + QR + cœurs + nombre de concerts, artistes, concerts + favoris + « scanné », séances, styles) ; `console_lieu_enregistrer` / `console_artiste_enregistrer` / `console_concert_enregistrer` / `console_dedicace_enregistrer` (tous les champs d'un formulaire) ; `console_programme_activer('lieu'|'artiste', …)` ; `console_programme_supprimer` (refusée dès qu'il y a une trace). Identifiant lisible **figé** après la création (les cœurs et les liens `programme.html#id` en dépendent) |
| `demo*` | Démo seulement |

## Rafraîchissement

- Téléphones : `App.sonder(fn, { toutesLes })` — rien quand l'écran est éteint, ± 20 %,
  intervalle doublé en cas d'échec. Pas de temps réel (forfait gratuit : 200 connexions).
  Repères : phase du jeu 20 s (`App.etatJeu`), statut du joueur 60 s (`App.joueur.surveiller`),
  blind test 2-3 s pendant une manche seulement.
- Écran géant / console : `App.direct(nom, canal => canal.on(...))`, **un** canal par page,
  sur `players`, `announcements`, `events`, `game_state` (seules tables publiées).
- L'alerte du GM, qu'Otaku poussait en temps réel sur les téléphones, n'arrivera qu'au rythme
  du polling (à reprendre en 6).

## Sobriété des requêtes

Les règles et le coût de chaque page sont dans `data/PERFORMANCE.md`.
Le mécanisme est `App.cache` (dans `serveur.js`), branché sur `App.rpc` et `App.lire`.
