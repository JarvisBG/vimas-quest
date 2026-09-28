# Sobriété — combien de requêtes chaque page a le droit d'envoyer

Fichier interne (non publié : `*.md` est dans `.assetsignore`).
À relire au début de chaque page de l'étape 4, et à compléter à la fin.

## Pourquoi c'est une contrainte et pas un confort

Le forfait gratuit Supabase donne **200 connexions temps réel** et une seule petite
instance Postgres. Si 500 personnes sont sur le site et que chaque téléphone envoie
une requête toutes les 5 secondes, la base reçoit **100 requêtes par seconde** sans que
personne n'ait rien fait. Sur le réseau d'un festival, une requête qui traîne bloque
l'écran du joueur : la lenteur ressentie vient d'abord du **nombre** d'appels, pas de
leur poids.

## Les six règles

### 1. Une page ne demande jamais deux fois la même chose

Tout ce qui se lit passe par `App.cache` (dans `serveur.js`) :

```js
App.rpc("programme_public", {}, { cache: "programme", duree: 300000, garde: true, resservir: true });
App.lire("roulette_prizes", "select=id,nom,rarete", { cache: "lots", duree: 600000, garde: true });
```

| Option | Ce qu'elle fait |
|---|---|
| `cache: "clé"` | active le mécanisme ; la clé nomme la donnée |
| `duree` | au bout de combien de ms on accepte de redemander (défaut 30 s) |
| `garde: true` | garde la réponse **sur le téléphone** : conservée d'une page à l'autre et d'une visite à l'autre |
| `resservir: true` | affiche tout de suite ce qu'on a, même périmé, et relit la base en arrière-plan |

Après une écriture qui change la donnée : `App.cache.oublier("clé")`.

`cache` est **interdit** sur une fonction qui écrit (`scan_qr`, `spin_roulette`,
`create_player`…) : elle doit partir à chaque fois.

### 2. Deux demandes simultanées = une seule requête

C'est automatique dès qu'il y a un `cache`. Une page qui affiche le programme en haut,
dans un compteur et dans une liste ne fait qu'un appel.

### 3. Rien ne part quand l'écran est éteint

Toute interrogation régulière passe par `App.sonder`, qui se met en pause quand l'onglet
est caché, décale les appels de ± 20 % (pour que 500 téléphones ne frappent pas à la même
seconde) et double l'attente après un échec, jusqu'à 5 minutes.

Cadences retenues :

| Ce qu'on surveille | Intervalle |
|---|---|
| statut du joueur (exclusion) | 60 s |
| tableau de bord, missions | 30 s |
| annonces | 60 s (page Annonces) ; compteurs des autres pages : copie de moins d'1 min |
| blind test | **rien pendant une question ouverte**, 1 lecture à la fermeture (étalée sur 1 s), ~3 s en attendant la question suivante, 1 / min hors manche |
| classement | 60 s |
| écran géant, console | temps réel (`App.direct`, un canal) : le signal programme une relecture, **au plus 1 / 5 s** ; filet de sécurité 60 s (20 s canal coupé) |

### 4. Aucune requête déclenchée par le clavier

Pas de vérification « au fil de la frappe ». À l'inscription, le pseudo n'est pas
vérifié en base : c'est `create_player` qui répond `PSEUDO_DEJA_PRIS`. Une vérification
par lettre tapée, ce serait dix requêtes par joueur pour zéro information utile.

### 5. Un bouton qui appelle la base se verrouille

Sur le réseau du festival, la réponse met plusieurs secondes : sans verrou, le joueur
tape deux fois et l'action part deux fois. Voir `occuper()` dans `pages/inscription.js`.

### 6. On ne demande que les colonnes utiles

`select=*` transporte des octets pour rien et empêche Postgres d'utiliser un index
couvrant. Toujours nommer les colonnes.

## Ce que coûte chaque page (à remplir au fur et à mesure)

| Page | Au chargement | Ensuite | Notes |
|---|---|---|---|
| `inscription.html` | **0 à 1** (`?fiche=1` depuis la carte : 0, carte gardée 20 s) | aucune | billetterie gardée 5 min ; création = 1 appel ; fiche fan = **1 appel à la fin** (`fiche_enregistrer`, téléphone compris), aucun pendant les 7 écrans ; reprise = 1 appel |
| `tableau-de-bord.html` | **1** (0 si carte de moins de 20 s) | 1 / 30 s, écran allumé | tout vient de `player_home` (complétée en base : prochain concert, alerte, rang général, scans du jour, coût de la roue) ; pas de surveillance du statut séparée ; hors ligne : dernière carte connue |
| `scanner.html` | **0** (le coffre resté fermé est lu sur le téléphone) | 1 par scan ; 1 par réponse au coffre (`coffre_ouvrir`, réessayé : la base ne paie jamais deux fois) ; statut du joueur 1 / 60 s | aucune liste de QR sur le téléphone ; la question arrive **avec** `scan_qr` (0 requête pour la charger) ; pas de nouvel essai automatique du scan (un doublon serait refusé) ; boutons verrouillés pendant l'envoi ; carte oubliée du cache après un scan, un ticket ou un coffre ouvert. Au banc : `coffre_ouvrir` 3,6 ms ; le coffre n'ajoute rien de mesurable à `scan_qr` |
| `missions.html` | **1** (0 en venant de la carte depuis moins de 20 s) | 1 / 30 s ; 1 / 10 s **seulement** pendant l'affichage du code staff | même cache que la carte (`player_home`) ; pas de surveillance du statut séparée |
| `collection.html` | **1** (0 si collection de moins de 2 min) | statut du joueur 1 / 60 s ; rien d'autre | `player_collection` en un appel (4 rayons), cache `collection.<id>` 2 min gardé sur le téléphone, **oublié après un scan ou un ticket** ; pas d'interrogation régulière (la collection ne bouge qu'avec une action du joueur) ; hors ligne : dernière collection connue |
| `passeport.html` | **0 à 2** (carte < 20 s et collection < 2 min : 0) | statut du joueur 1 / 60 s | aucune fonction propre : `player_home` + `player_collection` et leurs caches ; l'image est dessinée sur le téléphone (Canvas), rien n'est envoyé |
| `classement.html` | **1** (0 en revenant sur un onglet vu il y a moins de 30 s) | 1 / 60 s écran allumé (`App.sonder`) ; recherche et ajout d'ami : 1 par validation | `classement_joueur` lit des index : 6 ms (général) / 2 ms (jour) au banc sur 5 000 joueurs ; amis et recherche : un passage trié, ~10 ms, seulement à la demande ; aucune requête pendant la frappe |
| `roue.html` | **1** (0 si roue vue il y a moins de 20 s) | 1 par tirage, **jamais réessayé** ; aucune interrogation régulière | `roulette_joueur` en un appel (coût, plafond, tirages du jour, lots et stock, 50 derniers bons) : 0,2 ms au banc sur 20 000 tirages ; `spin_roulette` 0,6 ms (compte du jour sur index, borne `_debut_jour_jeu()` calculée une fois) ; cache `roue.<id>` oublié après un tirage, carte oubliée aussi ; lieu et horaires de retrait dans le site |
| `coups-de-coeur.html` | **1** (0 si page vue il y a moins de 30 s) | statut du joueur 1 / 60 s ; 1 par cœur donné ou repris, **jamais réessayé**, sans relecture | `coeur_liste` en un appel (réglages, mes cœurs, artistes et stands avec leur total) : 4 ms au banc sur 30 000 cœurs (totaux tenus par un déclencheur dans `coeurs_totaux` : recompter coûtait 23 ms) ; `coeur_donner` / `coeur_retirer` 0,4 à 0,6 ms ; la réponse du vote corrige la copie en cache ; tendances calculées sur le téléphone |
| `annonces.html` | **0 à 1** (copie de moins d'1 min : 0) | 1 / 60 s écran allumé (`App.sonder`) ; « lue » : rien n'est envoyé | lecture publique de `announcements` (48 h, 30 au plus, index sur la date) : 0,02 ms au banc ; copie « annonces » gardée sur le téléphone et **partagée par les compteurs de toutes les pages** (cloche, « Plus ») : 1 lecture pour 3 pages visitées, mesuré dans Chrome ; visiteurs sans carte compris |
| `programme.html`, `mon-programme.html` | **0 à 2** (programme de moins de 5 min et favoris de moins de 5 min : 0 ; visiteur : 0 à 1) | statuts recalculés 1 / min **sans requête** (`App.sonder`) ; au plus 1 relecture de chaque copie toutes les 5 min (resservie) ; 1 par étoile / rappel, **jamais réessayé**, sans relecture | `programme_public` : tout le programme en un appel, **gardé sur le téléphone** et partagé par les deux pages (et le plan en 4.13) : 4,3 ms au banc pour 208 concerts, 100 Ko, **12 Ko compressés** ; `programme_favoris` (favoris, vus, style) 0,5 ms, cache `favoris.<id>` corrigé par les réponses, oublié après un scan ; conflits, trajets (plan `lieux.x/y`), suggestions calculés sur le téléphone ; réglages des rappels et « je fais les deux » **sur le téléphone** |
| `plan.html` | **0 à 2** (en venant du programme, visiteur : 0 ; joueur : + collection si plus de 2 min ; + annonces si plus de 1 min) | aucune (pas de sondage : le plan ne bouge pas) | `programme_public` partagé avec le programme (gardé, resservi) ; `player_collection` partagé avec la Collection ; fond du plan = fichier du site `plan-fond.js` (18 Ko, **5,8 Ko compressés**, dans le cache hors ligne), rien de la base ; distances et temps de marche calculés sur le téléphone |
| `infos.html` | **0 à 1** (`regles_jeu` de moins de 10 min : 0) | aucune | `regles_jeu` 0,08 ms au banc (7 types de QR), < 1 Ko ; tout le reste est du contenu du site ; plus de formulaire de contact (aucune écriture) |
| `blind-test.html` | **1** (`quiz_state`) | question ouverte : 0 ; fermeture : 1 ; révélation / salle d'attente : 1 / ~3 s ; hors manche : 1 / min ; 1 par réponse (renvoyée toutes les ~1,5 s si le réseau manque, sans risque : un doublon est refusé) | `quiz_state` < 1 Ko : 0,3 ms question ouverte, **1,4 à 3 ms** chrono fini (place, trio de tête, PV) sur 2 000 joueurs × 15 questions ; `quiz_answer` 0,4 à 0,9 ms ; `admin_quiz_end` 0,2 à 2,4 s pour 2 000 joueurs (une fois par manche). Estimation : 300 téléphones ≈ 100 lectures / s pendant les ~10 s entre deux questions, rien pendant les questions |
| `index.html` | **0 à 2** (`programme_public` : copie « programme » partagée, 5 min ; `roulette_prizes` : copie « lots », 5 min ; 0 si déjà lues) | aucune | visiteurs compris ; line-up et lots vides en ligne → « bientôt » |
| `404.html`, `erreur.html`, `hors-ligne.html` | **0** | hors ligne : test du réseau sur le site lui-même (`manifest.webmanifest?ping`), 10 → 30 s | 404 servie par Cloudflare à toute adresse inconnue (`not_found_handling`), chemins absolus |
| `ecran/mur.html` (écran géant) | **1** (`mur_direct`) + copie « programme » | au plus **1 / 5 s** sur signal du temps réel (nouvel événement, annonce, phase), sinon 1 / 60 s (1 / 20 s canal coupé) ; rien quand l'onglet est caché ; 1 connexion temps réel | `mur_direct` **5 à 6,5 ms** au banc (7 000 joueurs, 200 000 événements, 30 000 scans du jour), ~3 Ko, contre **78 ms** pour `live_board` ; index `scans_jour_idx` (scans du jour) et `events_mur_idx` (partiel : les scans de scènes et stands ne sont jamais relus) ; le signal ne transporte rien d'utile, la page relit la base |
| `ecran/blind-test.html` (écran géant) | **1** (`quiz_board`) | question ouverte : 1 / 4 s (réponses reçues) + 1 à la fin du chrono ; hors question : au signal du temps réel (`game_state` : manche ou question lancée ; `events` raid / quiz : manche close), au plus 1 / s, sinon 1 / 60 s (1 / 20 s canal coupé) ; chrono recalculé 4 fois / s **sans requête** ; rien onglet caché | `quiz_board` réécrite sur `quiz_scores` : **0,6 ms** question ouverte (731 octets), **1,6 ms** chrono fini (1,7 Ko : répartition, 3 plus rapides, top 10) au banc (2 000 joueurs, 15 questions, 28 000 réponses) ; l'ancienne additionnait toutes les réponses de la manche à chaque lecture. Vérifié en ligne (manche d'essai effacée) |
| `admin/index.html` (console) | **1** (`console_accueil`) + `mon_acces` si l'accès n'est pas gardé (10 min) | au plus **1 / 5 s** sur signal du temps réel (événement, annonce, phase), sinon 1 / 60 s (1 / 20 s canal coupé) ; rien onglet caché ; 1 connexion temps réel | `console_accueil` **10 ms** au banc (7 000 joueurs, 200 000 événements), 5 Ko, contre 7 requêtes chez Otaku ; index partiels `events_console_idx` (fil) et `events_bonus_idx` (points offerts) |
| `admin/joueurs.html` (console) | **1** (`console_joueurs`, 50 lignes) + `mon_acces` si l'accès n'est pas gardé | aucune interrogation régulière ni temps réel ; 1 par recherche **validée**, filtre ou page ; fiche : 1 (`console_joueur`) ; 1 par action, puis la fiche relue (1), la ligne corrigée sans relire la liste | `console_joueurs` **16 ms** au banc (7 000 joueurs, 200 000 événements, 15 Ko) sur la 1re page (les plus actifs), 4 ms sur une page filtrée, 8 ms en recherche ; `console_joueur` **1,5 ms** (4,6 Ko) ; Otaku chargeait tous les joueurs avec 5 sous-requêtes chacun (`admin_liste_joueurs`, retirée) et filtrait à la frappe |
| `admin/missions.html` (console) | **1** (`console_missions` : missions + terminées aujourd'hui / au total + badges du menu) + `mon_acces` si l'accès n'est pas gardé | aucune interrogation régulière ni temps réel ; recherche et filtres **sans requête** (liste déjà chargée) ; 1 par action (enregistrer, allumer, supprimer), puis 1 relecture après enregistrer / supprimer | `console_missions` **1,4 ms** au banc (57 missions, 283 000 terminées) grâce aux totaux `missions_faites_jour` tenus par déclencheur ; recompter coûtait 65 à 105 ms |
| `admin/badges.html` (console) | **1** (`console_badges` : badges, gagnants, missions / QR / lots qui les donnent) | idem : filtres sans requête, 1 par action + 1 relecture | `console_badges` **4 ms** au banc (5 Ko) |
| `admin/qr.html` (console) | **1** (`console_qr` : QR + scans du jour / au total + lieux, séances, missions, badges, barème) | idem ; historique d'un QR : 1 (`console_qr_scans`, 50 derniers scans) à la demande ; **étiquettes : 0 requête** (dessinées sur le poste, `console-etiquettes.js`) | `console_qr` **38 ms** au banc (375 QR, 1,17 million de scans ; ~150 Ko, ~400 octets par QR) grâce aux totaux `qr_scans_jour` tenus par déclencheur (recompter : ~0,5 s) ; `console_qr_scans` **1,7 ms** (index `scans_qr_idx`) ; coût payé par chaque scan : 1 mise à jour d'une ligne de total |
| `admin/programme.html` (console) | **1** (`console_programme` : lieux et scènes avec leur QR, leurs cœurs et leurs concerts, artistes, concerts, séances, styles de la fiche fan) | aucune interrogation régulière ni temps réel ; onglets, jour, recherche, filtres et **placement sur le plan : 0 requête** (tout est déjà chargé) ; 1 par action (enregistrer, allumer, supprimer) + 1 relecture ; l'interrupteur corrige la copie sans relire | `console_programme` **8,8 ms** au banc (106 lieux, 129 artistes, 210 concerts, 1,16 million de scans ; 120 Ko), 44 ms au premier appel d'une connexion neuve. Concert scanné = `exists` sur `scans.creneau_id` (index `scans_creneau_idx`), scans d'un lieu = totaux `qr_scans_jour`, jamais un `count(*)` sur `scans` |
| **Installation** (service worker, 1re visite) | — | — | **331 Ko compressés** (au lieu de 556) : police Anton en WOFF2 réduite **15 Ko** (au lieu de 167, `outils/police.py`) ; écrans géants et supabase-js plus préchargés sur les téléphones ; une seule copie par page (sans les paramètres de l'adresse) |

## À surveiller côté base

- **Index** : chaque colonne qui sert de filtre dans une RPC appelée souvent doit en avoir
  un. À vérifier une fois les pages branchées (`explain analyze` sur `player_home`,
  `leaderboard_view`, `quiz_state`).
- **`jour_jeu()` appelée ligne par ligne** (directement ou via `_points_jour`) : ~27 ms
  pour 5 000 joueurs, parce qu'une fonction à `search_path` fixé n'est jamais dépliée par
  Postgres. Toujours la calculer une fois. Mesuré à l'étape 4.7.
- **`player_home`** : 87 → **33 ms** au banc (5 000 joueurs) après la réécriture de la position
  du jour (4.7). Le reste (événements, prochain concert, roi de la veille…) est à mesurer
  à l'étape 8 ; c'est la fonction la plus appelée (toutes les 30 s par carte allumée).
- **`leaderboard_view`** : **152 ms** au banc sur 5 000 joueurs (tri sur `_points_jour` pour
  chaque ligne). Les téléphones ne l'appellent plus (4.7 : `classement_joueur`, 2 à 6 ms) ;
  l'écran géant non plus depuis l'étape 5.1 (`mur_direct`, 5 à 6,5 ms). `live_board` et elle ne
  servent plus : à retirer à l'étape 6 si la console ne les appelle pas.
- **`mur_direct`** : le compte des scans du jour lit tout l'index `scans_jour_idx` (~250 000
  entrées par jour de festival à 5 000 joueurs, ~10 ms) : acceptable à 1 appel / 5 s par écran ;
  si plusieurs écrans, à surveiller à l'étape 8.
- **`player_collection`** compte les badges de tous les joueurs (un `group by` sur
  `player_badges`) pour le « % des joueurs ». Bon marché tant que la page n'est pas
  interrogée en boucle (elle ne l'est pas) ; à mesurer à l'étape 8.
- **Realtime** : réservé à l'écran géant et à la console (limite de 200 connexions).
- **Totaux tenus par déclencheur** (`qr_scans_jour`, `missions_faites_jour`, 6.3) : une ligne
  par QR (ou mission) et par journée, mise à jour à chaque scan. Sur un QR de scène très
  demandé, les scans simultanés attendent chacun leur tour sur cette ligne (quelques ms) :
  à surveiller au test de charge de l'étape 8.
