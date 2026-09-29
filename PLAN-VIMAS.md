# Plan — Vimas Quest (application complète pour le VIMAS FEST)

> Objectif : l'application **complète** — festivalier, écrans géants, console d'administration —
> aux couleurs du VIMAS FEST (sam. 26 – dim. 27 déc. 2026, Majestic Cinéma, Université de Yaoundé I),
> d'abord présentée à Vimas Production en démonstration.
> Base Supabase **partagée** avec l'ancien projet DOMAF (`domaf-quest`, le nom ne gêne pas),
> lien **festival-quest** (la démo DOMAF y est débranchée), dépôt GitHub **propre à Vimas**.
> Une étape à la fois, validée par Jarvis. Cocher `[x]` au fur et à mesure. Contexte : `CLAUDE.md`.
> Pièges techniques du moteur : `docs/NOTES-MOTEUR-DOMAF.md` (à relire avant de toucher une page).

---

## ▶ Prochain prompt (en cas de coupure)

> Continue le projet **Vimas Quest** (dossier `C:\Users\HP\Documents\PROJETS\vimas\vimas-quest`, dépôt
> GitHub `JarvisBG/vimas-quest`, branche `main` — commit + push à chaque fin de tâche, tu y es autorisé).
> Lis d'abord `CLAUDE.md` et `PLAN-VIMAS.md`, et `docs/NOTES-MOTEUR-DOMAF.md` avant de toucher une page.
> Étapes 1 à 4 terminées ; **étape 5 (console) terminée** sauf le tirage au sort final (mis de côté par Jarvis,
> proposition dans la case 5.1). 5.4 : `admin/statistiques.html` faite ; correctif des droits
> `supabase/correctifs/2026-09-28_vimas-5.4-droits.sql` **appliqué en ligne par Jarvis le 28/09** (annulation :
> `…_ANNULER.sql`). **Site en ligne depuis le 29/09**. **Étape 6 (contenu de démo) terminée le 29/09**,
> **mise en ligne le 29/09** (prochaine mise en ligne : `vimasquest-v6` puis `npx wrangler deploy`, wrangler connecté).
> Étapes 6 et 7 en ligne (`vimasquest-v5`). **Étapes 8 et 9 faites le 29/09** : la base est au VIMAS FEST (correctif
> `2026-09-29_vimas-8-base.sql` + `contenu-essai/contenu_essai.sql`, appliqués en ligne). **Étape 11 commencée le 29/09** : suivre `docs/RECETTE.md` (§A fait hors ligne ; §B–C avec Jarvis). Suite de l'**étape 11 — recette**
> (parcours festivalier sur vrais téléphones avec les QR `DQ-V…`, écran géant, blind test depuis la régie, console par rôle ;
> créer un compte vendeur d'essai). Questions ouvertes : écran de secours du vendeur, tirage au sort final.
> SQL en ligne : l'extension Chrome peut coller un script dans l'éditeur SQL de Supabase (presse-papiers + Ctrl+V + Run).
> Essai d'une page de console sans compte : copie de page + script qui remplace `C.garde` / `C.appel` / `C.sb` /
> `C.confirmer` (effacer ensuite). Essai SQL sans PostgreSQL installé : `supabase/outils/banc/audit_pglite.mjs` (PGlite).
> Rappels : base Supabase **partagée** avec l'ancien DOMAF (`domaf-quest`) → sauvegarde SQL avant toute écriture ;
> festival supposé **de jour, 10 h → 22 h** (contenu de démo fait, base en étape 8) ; serveur local
> `app/lancer-serveur.bat` → http://localhost:8767 ; pour tester dans Chrome, désinscrire le service worker
> puis changer de page (voir `CLAUDE.md`). Travail étape par étape, validation de Jarvis avant la suivante,
> échanges en français.

---

## Journal

| Date | Fait |
|---|---|
| 28/09/2026 | Cadrage : maquette pour Vimas, même base et même lien que DOMAF. Copie de `domaf/` → `vimas-quest/` (sans offre ni archives), docs de suivi créés, dépôt Git local. |
| 28/09/2026 | Vérifié : le mode démo (`?mock=1`) accepte les vrais QR imprimés (`scanner.html?code=QR-…`), sans base. Limites : chaque téléphone joue seul, classement et écran géant simulés. |
| 28/09/2026 | Décision de Jarvis : on **termine** l'application pour Vimas (festivalier + console + écrans). Plan complet réécrit (étapes 1 → 13). |
| 28/09/2026 | Dépôt GitHub JarvisBG/vimas-quest créé et poussé. **Étape 2 terminée** : couleurs, icônes, marque, manifeste ; `VERSION` du service worker = `vimasquest-v1` ; serveur local sur le port **8767** (8766 = DOMAF). |
| 28/09/2026 | Hypothèse de Jarvis : festival **de jour** (affiche = village de stands) → horaires provisoires **10 h – 22 h**. **Étape 3 terminée** (textes, clés, consentement, quartiers de Yaoundé, partenaires, bandeau « maquette ») ; les 2 jours passent à l'étape 6 avec le contenu. |
| 28/09/2026 | Mur de l'écran géant refait sur le modèle d'Otaku Quest (un panneau à la fois, enseigne sobre, une annonce en pied) + passe `impeccable polish`. Skill impeccable (pbakaus/impeccable) installé dans `~/.claude/skills/` à la demande de Jarvis. |
| 28/09/2026 | Plateau du blind test aligné sur le mur ; passe anti-« IA » sur toutes les pages festivalier (détecteur impeccable) ; `sw.js` → `vimasquest-v2`. **Étape 4 terminée** (hors contenu de jour, étape 6). |
| 28/09/2026 | Fin de session : fichiers de progression à jour, prochain prompt préparé (étape 5, console). |
| 28/09/2026 | **5.0 terminée** (dates de la console). Inventaire de la base pour 5.1 : seul le tirage au sort final manque côté SQL — proposition soumise à Jarvis. |
| 28/09/2026 | Jarvis : « laisse d'abord le tirage ». Écrans **Annonces**, **Roue et lots**, **Coups de cœur** écrits sur les fonctions existantes (aucun SQL). Non essayés, non committés (shell indisponible). |
| 28/09/2026 | Shell revenu (hors mode automatique) : `node --check` OK, les trois écrans essayés dans Chrome sur une fausse base, un défaut d'affichage corrigé ; commit + push. |
| 28/09/2026 | **5.2 terminée** : régie du blind test (aucun SQL), essayée dans Edge sans fenêtre (scénario complet), un doublon de question corrigé ; commit + push. |
| 28/09/2026 | **5.3 terminée** : carnets (GM), impression des tickets, espace vendeur, sur le modèle d'Otaku (recherche du joueur par pseudo, décision de Jarvis), aucun SQL ; commit + push. |
| 28/09/2026 | **5.4 terminée** (côté dépôt) : écran Statistiques (aucun SQL, modèle d'Otaku, CSV, impression), essayé dans Chrome sur une fausse base ; correctif des droits (décision de Jarvis : vendeur sans écriture sur la roue et le blind test, pilotage de secours gardé comme Otaku ; `live_board` / `leaderboard_view` retirées), essayé sur PGlite (aller-retour avec l'annulation) ; `sources/20_blind_test.sql` perdu depuis le DOMAF, restauré ; générateur et audit attendu à jour. **Correctif pas encore appliqué en ligne.** |
| 28/09/2026 | Correctif des droits **appliqué en ligne** par Jarvis ; vérifié par l'API publique : `live_board` / `leaderboard_view` introuvables (PGRST202), `admin_create_prize` / `admin_quiz_start` toujours là (refusées à la clé publique). Le correctif tenant en une transaction, les 17 gardes sont passées avec. |
| 29/09/2026 | **Première mise en ligne Vimas** sur festival-quest (demande de Jarvis) : `sw.js` → `vimasquest-v3`, `npx wrangler deploy` (version `3ba21ade`), wrangler connecté sur ce PC. Vérifié : accueil Vimas, compte à rebours, console et statistiques servies, fichiers internes en 404. La démo DOMAF est remplacée. Contenu encore fictif DOMAF (étape 6). |
| 29/09/2026 | **Étape 6 terminée** : contenu de démo Vimas de jour (2 jours, 10 h → 22 h, line-up fictif recalé, blind test 17 h, annonces sur l'horloge de démo), banque de questions Vimas (démo + SQL), formulations de jour dans les pages, contrôle dans Chrome. Pas encore remis en ligne. |
| 29/09/2026 | Étape 6 **mise en ligne** : `sw.js` → `vimasquest-v4`, `npx wrangler deploy` (version `41a35e22`) ; vérifié en ligne (sw v4, contenu Vimas de jour, fichiers internes en 404). |
| 29/09/2026 | **Étape 7 terminée (démo)** : fond du plan tiré d'OpenStreetMap autour du Majestic Cinéma (cinéma en plein air de l'Université de Yaoundé I). Jarvis : « le Vimas, ce n'est pas le DOMAF, c'est leur début » → site resserré dans l'enceinte : 2 scènes, 4 stands, 2 food-trucks, cadre de 200 m. Mis en ligne (`vimasquest-v5`, version `e66efd34`). |
| 29/09/2026 | Jarvis : « l'ancienne base du DOMAF ne m'intéresse pas… tu peux tout remplacer ». **Étapes 8 et 9 faites et en ligne** : correctif `2026-09-29_vimas-8-base.sql` (tout le contenu et les données DOMAF effacés, fonctions Vimas : jours, codes, badges de jour, quartiers de Yaoundé, 18 h) puis contenu d'essai Vimas, collés par Claude dans l'éditeur SQL de Supabase (Chrome) ; essayés d'abord sur PGlite, vérifiés ensuite par l'API publique. |

| 29/09/2026 | **Étape 11 commencée** : fiche `docs/RECETTE.md`. Anti-triche relu sur l'audit attendu (RLS sur les 42 tables, aucune écriture publique directe, les 48 fonctions publiques exigent le code secret ou ne font que lire) ; temps réel réservé aux écrans et à la console. Les sondes contre la base en ligne ont été refusées par le mode automatique : à lancer avec l'accord de Jarvis. Parcours sur vrais téléphones : à faire par Jarvis. |
---

## État hérité du DOMAF (au 28/09/2026)

| Partie | État |
|---|---|
| Base (schéma, sécurité, RPC) | ✅ complète, en ligne |
| Pages festivalier (14) | ✅ branchées sur la base |
| Écrans géants (mur, blind test) | ✅ branchés |
| Console | ✅ terminée pour Vimas (5.0 → 5.4), sauf le tirage au sort final |
| Contenu | ❌ fictif DOMAF (Douala, 4 jours) |

---

## Étape 1 — Mise en place
- [x] Copie du projet dans `vimas-quest/` (app, supabase, outils, visuels Vimas, affiche)
- [x] `CLAUDE.md`, `PLAN-VIMAS.md`, notes techniques du moteur dans `docs/`
- [x] Dépôt Git local
- [x] Dépôt GitHub privé **JarvisBG/vimas-quest** (branche `main`), premier push le 28/09
- [ ] Valider le nom « Vimas Quest »

## Étape 2 — Habillage festivalier ✅ (28/09)
- [x] Couleurs Vimas dans `app/` (336 valeurs, 51 fichiers : CSS, pages JS, SVG) — correspondance tirée de `vimas_visuels/` + teintes intermédiaires ; console (`console.css`, `console-*.js`), fond du plan (`plan-fond.js`) et étiquettes non touchés
- [x] Marque « Vimas Quest » (en-têtes, pieds, titres), accueil « Vimas / Quest — Le VIMAS FEST se joue », icônes PWA + favicon Vimas, `manifest.webmanifest`
- [x] Police : aucun caractère nouveau (même alphabet)
- [x] Contrôle visuel dans Chrome à 390 px (accueil, inscription, tableau de bord, passeport, collection, roue, programme, plan, infos, blind test, hors ligne) + écrans géants (mur, blind test) : pas de débordement, contrastes lisibles
- Reste pour l'étape 3 : textes « DOMAF » (ex. titre du passeport partagé), dates, lieu, édition

## Étape 3 — Identité et textes (festivalier) ✅ (28/09)
- [x] « DOMAF » → « VIMAS FEST » / « Vimas Quest » : titres, descriptions, accueil, infos, plan, programme, partage, agenda (.ics), passeport (image), console (marque, en-tête), étiquettes QR
- [x] Clés du téléphone `domafquest.*` → `vimasquest.*` (+ canal des écrans, domaine d'exemple `vimasquest.example`) ; **gardés** : `DQ-`, `DQ-JOUEUR:`, le paramètre `p_domaf` de `fiche_enregistrer` (côté base)
- [x] Édition 1 (« 1re édition »), dates « 26 et 27 décembre 2026 », ouverture 26/12 à 10 h, tirage au sort final le 27/12
- [x] Lieu : Majestic Cinéma, Université de Yaoundé I (Ngoa-Ekellé)
- [x] Fiche fan : consentement « Vimas Production », partenaires « du VIMAS FEST », 22 quartiers de **Yaoundé** (démo ; en base à l'étape 8)
- [x] Partenaires sur l'accueil : Canal 2 International, Sweet FM, AMZ Groupe, Majestic Cinéma, Vimas Production, « Ton stand ici » (texte, pas de logos)
- [x] Bandeau « Maquette de démonstration · contenu fictif » en haut des pages du téléphone (`App.config.maquette` dans `app.js`)
- [x] Console : « heure du Cameroun » au lieu de « heure de Douala » (le fuseau technique reste `Africa/Douala`)
- **Déplacé à l'étape 6** (c'est du contenu) : passage de 4 à 2 jours (`jours`, horaires, horloge de démo, grille de la console, `roue.js`), line-up, banque de questions (mentions « DOMAF », « Douala »), bandeau défilant

### Festival de jour (remarque de Jarvis, 28/09 — hypothèse à confirmer avec Vimas)
**Décision provisoire : 10 h → 22 h les deux jours** (validée par Jarvis le 28/09).
L'affiche n'indique aucun horaire, mais montre un village de stands en plein air, en plein jour (« Appel aux stands »).
Le moteur DOMAF est calé sur des **soirées de concerts** : à adapter (étapes 6, 8 et 9) —
- horaires d'ouverture (`infos.horaires`, compte à rebours), grille du programme (`programmeConfig` 17 h → 2 h 30)
- blind test « chaque soir à 21 h 30 » → créneau de l'après-midi ; questions « du soir » du coffre (`micro_config.soir_debut`, 20 h)
- badges « Noctambule » (après minuit) et « Lève-tôt » (avant 17 h) à redéfinir ; scène « Sound System Nuit » à renommer
- **stands au centre du jeu** : missions, coups de cœur et QR de stands mis en avant
- la journée de jeu 6 h → 6 h reste valable

## Étape 4 — Écrans géants
- [x] **Mur refait sur le modèle d'Otaku Quest** (28/09, jugé « touffu » par Jarvis) : une enseigne sobre (marque + joueurs / scans / heure séparés par des filets), **un panneau à la fois en plein écran** qui tourne (tournoi du jour : podium + registre 4 à 10 · derniers exploits : deux carnets · programme · rejoindre : grand QR + 3 étapes · blind test · festival et partenaires), une seule annonce à la fois en pied (plus de bandeau défilant), crédit « Propulsé par loJIC Solutions », pastilles de rotation. Panneau vide = sauté. Données et temps réel inchangés (`App.api.mur`, un appel).
- [x] Passe `impeccable polish` : point « En direct » et horloge fixes (plus de clignotement), couleur des scènes en pastille (plus de barre latérale), partenaires en grille 3 × 2, blind test sans chevauchement
- [x] `ecran/blind-test.html` (plateau du blind test) : même grammaire (enseigne commune dans `ecran.css`, réponses en feuilles de papier, classement et top 10 en carnets, podium en marches comme le mur) ; platine décorative et halos retirés ; « Aujourd'hui à » au lieu de « Ce soir à »
- [x] **Passe anti-« généré par IA » sur les 16 pages du festivalier** (`impeccable detect`, 28/09) : plus de points qui clignotent ni de projecteurs qui se balancent, bandeau de l'accueil **fixe** (plus de défilement), barres de couleur latérales retirées (programme, mon programme, annonces, classement, messages, champs en erreur, notes) → la couleur de scène passe en pastille, halos lumineux → ombres décalées, contrastes corrigés (texte clair sur rouge). **Gardé exprès** (univers de l'affiche) : fond papier crème, titres Anton serrés, ombres décalées de sérigraphie, filets horizontaux, rayures « danger » de l'alerte, frise du tableau de bord
- [ ] Contenu des panneaux (horaires de jour, blind test l'après-midi) : avec l'étape 6

## Étape 5 — Console d'administration (finir ce que le DOMAF n'a pas fini)
- [x] 5.0 Marque Vimas dans la console (le style néon est gardé), dates du festival dans `console-programme.js` (sam. 26 / dim. 27 déc., grille vide 10 h → 22 h, concert proposé à 15 h, « Soirée » → « Journée » dans `admin/programme.html`)
- Inventaire base pour 5.1 (28/09) : roue = tout existe (`admin_create/update/delete_prize`, `admin_prize_affichage`, `admin_set_roulette_cost`, `admin_set_roulette_plafond`, `admin_recent_spins`, `admin_redeem`) ; annonces = tout existe (`admin_publier_annonce`, `admin_fermer_annonce`, `admin_delete_announcement`) ; cœurs = `coeur_config` modifiable par le staff (table), `coeur_palmares` ; **tirage au sort final : rien en base** (à écrire). À revoir en 5.4 : les fonctions de lots acceptent `is_equipe()` (un vendeur peut modifier la roue) ; `_code_secret_tirage()` contient des mots DOMAF/Douala (étape 8).
- [ ] 5.1 Animation : roue (lots, coût, plafond, retrait des bons), annonces, coups de cœur (clôture, palmarès), **tirage au sort final**
  - [x] `admin/annonces.html` + `console-annonces.js` : liste (table `announcements`), publier (titre, niveau, catégorie, bouton vers une page, retrait daté), retirer, effacer ; temps réel
  - [x] `admin/roue.html` + `console-roue.js` : lots (chance calculée, stock, interrupteur, création / modification / suppression, rareté + libellé court), coût et plafond par jour, **remise d'un objet par son code** (`admin_redeem`), 30 derniers bons + nombre à retirer
  - [x] `admin/coups-de-coeur.html` + `console-coeurs.js` : palmarès artistes / stands (`coeur_palmares`, 20 premiers), réglages `coeur_config` (ouverture, clôture datée, cœurs par catégorie, XP) ; alerte si la clôture tombe hors du 26–27/12 (la base a encore **29/11 20 h**, date DOMAF)
  - [x] Menu de la console : les trois écrans allumés
  - [x] Essayés dans Chrome (28/09) avec une fausse base (garde, appels et tables simulés, fichiers effacés ensuite) : remise d'un bon (bon et mauvais code), interrupteur, modification / création de lot, suppression refusée après gain, réglages de la roue ; publier (message vide, fin passée, lien), retirer, effacer une annonce ; réglages des cœurs (bornes, confirmation à la baisse, alerte de date). Corrigé : l'icône du cœur passait au-dessus du chiffre (`.cliste__val` en ligne). **Pas encore essayés sur la vraie base** (compte GM) : à faire en étape 9
  - [ ] Tirage au sort final : **mis de côté par Jarvis** (28/09) — proposition prête : table `tirages` + `console_tirage(n)` (GM, joueurs actifs avec numéro, sans remise)
- [x] 5.2 Régie du blind test : manches, questions (extrait, pochette), boss, lancement / passage en direct (28/09)
  - Aucune fonction SQL nouvelle : tout existait (`admin_list_quiz_sessions`, `admin_list_quiz_questions`, `admin_quiz_live`, `admin_create/rename/duplicate/delete_quiz_session`, `admin_update_raid_params`, `admin_create/update/delete/move_quiz_question`, `admin_blind_question`, `admin_quiz_start/next/end`, `admin_set_phase`)
  - `admin/blind-test.html` + `console-blind.js` : liste des manches → une manche (préparation : boss, PV avec repère, questions 2 à 4 réponses, extrait, départ, pochette, révélation, ordre ; direct : chrono, répartition des réponses, bonne réponse, PV du boss, top 5, relu chaque seconde ; fin : récompenses puis « Rouvrir le jeu »). Confirmations : lancer, couper un chrono, terminer. Adresse d'extrait vérifiée avant envoi (sinon doublon de question, trouvé à l'essai)
  - Essayée de bout en bout sur une fausse base dans **Edge sans fenêtre** (extension Chrome déconnectée) : scénario automatique + capture ; fichiers d'essai effacés
  - Au passage : « Remettre un lot » accepte aussi le QR du bon (`DQ-BON:…`) ; numéros d'étape DOMAF (6.5–6.8) remplacés dans la console
- [x] 5.3 Billetterie : carnets de tickets (GM) + espace vendeur (encaissement) (28/09)
  - **Modèle d'Otaku**, aucune fonction SQL nouvelle (tout existait : `billetterie_stats`, `carnet_liste/etat/creer/attribuer/rendre/reprendre/pointer`, `billetterie_config` modifiable par le GM, `vendeur_award_bonus`, `admin_manual_quests`, `admin_validate_quest`). Le vendeur trouve le joueur **par son pseudo** (table `players`, lecture publique, comme Otaku) — décision de Jarvis : pas de QR du joueur à scanner
  - `admin/carnets.html` + `console-carnets.js` (GM) : chiffres (encaissé du jour / en tout, à rapporter, papier en main, libres, payant ou gratuit), carnets, par vendeur, réglages « jeu payant » + prix + message (confirmation avant de rendre payant), nouveau carnet → impression, fiche d'un carnet (compte vendeur par e-mail, rendre des codes / tous les libres, annuler un retour, désactiver)
  - **Tickets imprimés** (`console-etiquettes.js`, `E.tickets`) : 15 par A4, QR → `inscription.html?ticket=CODE`, code en clair, prix, carnet et rang, « ESSAI » en travers hors du site en ligne. ⚠ La page d'inscription lit `?ticket=` (les notes disaient `?t=`) : elle accepte maintenant les deux. **Étiquettes de QR repassées aux couleurs Vimas** (elles avaient gardé celles de Résonance)
  - `admin/vendeur.html` + `console-vendeur.js` (rôle vendeur, une colonne pour téléphone) : recette du jour, mon carnet, mode sans papier (QR d'un code libre, codes déjà montrés retenus sur le téléphone), récompenser un joueur (pseudo → +25/+50/+100 avec motif, missions « validées par l'équipe »). Les comptes vendeurs y sont envoyés à la connexion (plus de message « bientôt »)
  - Essais : scénarios complets dans Edge sans fenêtre + contrôle visuel dans Chrome (table resserrée, grilles 2 × 2 sur téléphone, motif avant les montants) ; fichiers d'essai effacés
  - `inscription.js` modifié (page du téléphone) : penser à changer `VERSION` de `sw.js` à la mise en ligne
- [x] 5.4 Statistiques + relecture des droits (28/09) — correctif **appliqué en ligne** par Jarvis le 28/09
  - `admin/statistiques.html` + `console-statistiques.js` (GM et staff, lecture seule, relue au bouton) : 6 chiffres (inscrits, ont joué, QR scannés, fiches complètes, contacts Vimas / partenaires), **le parcours** (retour au lendemain, heures passées, durée médiane, courbe des heures, journée par journée, profondeur, QR les plus scannés), **qui est venu** (6 champs de la fiche, libellés de `profil_options`), **ce qu'ils ont aimé** (artistes / stands), **questions du coffre** par thème (réponses « en moins d'une seconde » signalées, artistes nommés). Export CSV (« ; » + BOM, pour Excel), impression en clair. Aucun SQL. Essayée dans Chrome sur une fausse base (bureau, 390 px, CSV, erreurs) ; fichiers d'essai effacés
  - ⚠ Les quartiers de la base sont encore ceux de Douala : une valeur de Yaoundé s'affiche brute (« ngoa-ekelle ») jusqu'au correctif de l'étape 8
  - `correctifs/2026-09-28_vimas-5.4-droits.sql` : 17 fonctions (roue : lots, coût, bons, derniers tirages ; blind test : manches, questions, boss) passent de `is_equipe()` à `is_staff()` — seule la ligne de garde change (réécriture depuis `pg_get_functiondef`, s'arrête si déjà appliqué). Le vendeur garde ses outils (`admin_manual_quests`, `admin_validate_quest`, `vendeur_award_bonus`) et le **pilotage de secours** du blind test (liste, direct, lancer, suivante, terminer, `admin_set_phase`) — décision de Jarvis, comme Otaku. `live_board` / `leaderboard_view` retirées. Annulation : `…_ANNULER.sql`
  - Essais (PostgreSQL absent du PC) : **PGlite** (`outils/banc/audit_pglite.mjs`) — l'audit de l'ancien schéma y est identique à `audit_attendu.csv` ; après correctif = nouveau schéma, après annulation = ancien schéma ; vendeur refusé / staff accepté ; second passage refusé
  - Dépôt : `sources/20_blind_test.sql` (perdu dès le DOMAF, le générateur ne le trouvait plus) restauré depuis le schéma ; `fabriquer_schema.py`, `sources/60_roue.sql`, `00_schema.sql` régénéré, `audit_attendu.csv` à jour
  - Reste : l'**écran de secours** du vendeur n'existe pas encore dans Vimas (Otaku : bloc « En cas de secours » de l'espace vendeur → raid.html) ; la base l'autorise déjà
  - Inventaire (28/09) : **statistiques sans SQL** (`profil_stats` = fiche, contacts, questions du coffre, cœurs ; `stats_parcours` = jours, retour au lendemain, temps passé, heures, profondeur, top QR ; `admin_stats`) — le sondage de sortie d'Otaku a été retiré au DOMAF (6.3 bis). **Droits** : 29 fonctions acceptent un vendeur (`is_equipe`) ; aucune politique RLS. Otaku ouvrait exprès le *pilotage* du raid au vendeur (secours), jamais l'écriture. `live_board` / `leaderboard_view` : plus appelées par l'app. Proposition soumise à Jarvis.
- [ ] Chaque sous-étape : essai au banc local (`supabase/outils/banc/`) avant la base en ligne

## Étape 6 — Contenu de démo hors ligne (`app/data/mock.js`) ✅ (29/09)
- [x] Festival : **samedi 26 et dimanche 27 décembre**, **de jour** (portes 10 h → 22 h, grille 10 h → 22 h 30), scènes Grande Scène · Le Yard Reggae · La Salle Majestic · Le Podium Mode · **Le Sound System** (« Nuit » retiré) — identifiants techniques gardés (`soleil`, `clairiere`, `dock`, `kiosque`, `chapiteau` : QR et base y renvoient). Line-up **fictif** repris de `vimas_visuels/` et recalé de jour : 6 artistes par jour (fanfare 11 h, reggae, défilé mode, soca, dancehall, afro-pop en clôture du samedi ; dub, battle de danse, DJ vinyles, zouk, makossa, rap en clôture du dimanche), 3 dédicaces
- [x] Infos (horaires, navettes 9 h → 22 h 30, consigne, lots jusqu'au dimanche 21 h 30, sorties jusqu'à 20 h), accessibilité, missions (défi éclair Salle Majestic avant 18 h), badges (Lève-tôt avant midi, « Jusqu'au bout » au lieu de Noctambule, Marathonien sur 2 jours, « Sous le soleil »), lots (Pass 2e édition), roue (retrait 10 h → 21 h 30), QR (Grande Scène, Salle Majestic, relique « La première bobine », parade de clôture 21 h 45), coups de cœur (résultats dimanche 20 h 15), annonces de démo **calées sur l'horloge de démo** (samedi 26, 16 h 25), dates du joueur de démo. Stands et food-trucks : noms génériques gardés
- [x] Banque de questions : `banque_questions.py` → `mock.js` **et** `01_reference.sql` (identiques) : VIMAS FEST au lieu de DOMAF, Yaoundé au lieu de Douala, S3 « Tu es venu surtout pour… » (1re édition : plus de « combientième DOMAF »). Questions « de fin de journée » dès **18 h** en démo (`coffreConfig.soirDebut`) ; `QUESTIONS-VIMAS.md` à jour
- [x] Blind test : **17 h**, Grande Scène, 15 questions sur le line-up fictif (extraits synthétisés, aucune vraie personne)
- [x] Faux joueurs : pseudos générés (mots de musique neutres), rien à changer
- [x] Pages : « Ce soir » → « Aujourd'hui », « chaque soir » → « chaque jour » (accueil, programme, mon programme, blind test, infos, carte) ; horloge de démo → **samedi 26 décembre, 16 h 25** ; roue (dates des bons), classement (« depuis samedi »), scanner de démo, annonces de démo de la console, exemples de la console. Écran géant : plus de « Roi d'hier » le 1er jour
- Contrôle dans Chrome (mode démo, 390 px) : accueil, programme, carte, blind test (« dans 35 min »), infos, annonces, roue, écran géant — aucune erreur JavaScript
- **Reste pour la base (étapes 8 et 9)** : `micro_config.soir_debut` → 18 h, badges Noctambule / Lève-tôt / Marathonien (règles en SQL), banque de questions en base (`on conflict do nothing` : la mettre à jour, pas seulement l'insérer), heure du blind test. Plan : fond et positions encore ceux du Stade de Bonamoussadi → **étape 7**

## Étape 7 — Plan du site ✅ (29/09, démo)
- [x] Fond du **Majestic Cinéma** (OpenStreetMap : way 881969107 « Majestic Yaoundé I University », cinéma **en plein air** de Bolloré, panneaux solaires, parking ; ouvert le samedi dès 10 h d'après OSM) : `outils/plan/fond_plan.py` réécrit, données `outils/plan/osm-majestic.json` (serveur Overpass **kumi.systems**, overpass-api.de refuse), cadre **200 m × 140 m** centré sur l'enceinte (1 unité = 0,20 m), couleurs Vimas, mention ODbL ; pas de nom de rue en travers de l'enceinte. Données du stade DOMAF retirées (historique Git)
- [x] **Décision de Jarvis (29/09) : 1re édition, site modeste — tout tient dans l'enceinte du Majestic** (≈ 80 m × 110 m). **2 scènes** au lieu de 5 : Grande Scène (devant l'écran) et Podium Mode (parking : défilé, battle, fanfare, sets dancehall et DJ) ; les 12 artistes répartis sans chevauchement. **4 stands** (Radio Écho, Maison Kora, Brasserie du Port, Stand Vimas Quest) et **2 food-trucks** ; 2 points d'eau, 2 toilettes, 1 poste de secours, hall du Majestic en abri, tente dédicaces, 1 entrée sur l'axe du campus. Missions (Tournée des scènes : 2 scènes ; Gourmet : 2 food-trucks ; défi éclair au Podium), badge Curieux (3 stands), QR du Podium (`QR-PODIUM`), question de blind test « À quelle heure… » au lieu de « Sur quelle scène… », FAQ (plus de Wi-Fi Telco+ ni de consigne). `geo` / `metresParUnite` recopiés dans `planConfig`
- Contrôle dans Chrome (390 px) : plan lisible, programme à 2 scènes. **Mis en ligne le 29/09** (`vimasquest-v5`)
- ⚠ Emplacements **inventés** : les vrais viendront de Vimas (étape 13). En base (étape 9) : saisir scènes et lieux par la console

## Étape 8 — Base de données (partagée, `domaf-quest`) ✅ (29/09)
- [x] ~~Sauvegarde SQL~~ : **décision de Jarvis (29/09)** : « l'ancienne base du DOMAF ne m'intéresse pas, on n'y a rien fait, tu peux tout remplacer » → pas de sauvegarde
- [x] `correctifs/2026-09-29_vimas-8-base.sql` **appliqué en ligne le 29/09** (par Claude, dans l'éditeur SQL de Supabase via Chrome) : efface **toutes** les données de jeu et tout le contenu DOMAF (joueurs, scans, QR, lieux, programme, lots, annonces, blind tests, réponses, tickets, carnets…) ; garde les comptes de la console, les réglages et le catalogue des badges. Fonctions : jours 26–27/12 (`jour_festival_label`), mots des codes secrets de Yaoundé (MELEN, ESSOS, OBILI, VIMAS…), badges de jour (Lève-tôt avant midi, **« Jusqu'au bout »** au lieu de Noctambule dès 20 h, Marathonien sur 2 jours, Curieux à 3 stands), **quartiers de Yaoundé** (la base refusait jusque-là ceux du téléphone), questions de fin de journée dès **18 h**, clôture des cœurs le 27/12 à 20 h, message de billetterie, banque de questions Vimas
- [x] Générateur, `sources/92_collecte.sql`, `01_reference.sql`, `00_schema.sql` régénéré ; console : règles des badges système à jour
- Essais sur **PGlite** : ancien schéma + joueur + compte GM → correctif → le joueur part, le compte reste, structure identique au nouveau schéma, correctif rejouable
- Vérifié en ligne par l'API publique : samedi 26, 22 quartiers de Yaoundé, 42 questions, badges renommés, 0 joueur
- ⚠ La démo DOMAF (`../domaf/app`) lirait maintenant le contenu Vimas : ne plus la redéployer sur cette base

## Étape 9 — Contenu d'essai Vimas en base ✅ (29/09)
- [x] `contenu-essai/contenu_essai.sql` réécrit pour Vimas et **posé en ligne le 29/09** (même méthode) : 16 lieux (2 scènes, 4 stands, 2 food, services) aux positions de la démo, 12 artistes **fictifs**, 12 concerts (26–27/12, 11 h → 22 h), 3 dédicaces avec QR, 16 QR (`DQ-V…`, liste dans `contenu-essai/README.md`), 11 missions, 11 lots, 3 annonces, 2 manches de blind test (boss fictifs : musiques du week-end, le VIMAS FEST). Rejouable ; `effacer_contenu_essai.sql` à jour
- Saisi par SQL plutôt que par la console (plus rapide) : la console sera éprouvée à l'étape 11
- [x] Banque de questions du coffre en base (42 questions Vimas)
- [ ] Compte vendeur d'essai (le compte GM existant est gardé)
- Essai PGlite : contenu posé deux fois de suite, un joueur s'inscrit et scanne la Grande Scène → 80 XP, badges Première note + Échauffement

## Étape 10 — Mise en ligne sur festival-quest
- [x] `VERSION` de `sw.js`, `cd app && npx wrangler deploy` (remplace la démo DOMAF) — première fois le 29/09 (`vimasquest-v3`) ; à refaire après l'étape 6/9
- [ ] Étiquettes QR imprimées **depuis le site en ligne** (console → étiquettes)
- [x] Vérifier `app/.assetsignore` (aucun fichier interne en ligne) — 29/09 : `wrangler.jsonc`, `*.md`, `lancer-serveur.bat` en 404

## Étape 11 — Recette complète
- [ ] Parcours festivalier sur 2–3 vrais téléphones, réseau dégradé, hors ligne
- [ ] Écran géant en direct pendant que des téléphones jouent ; blind test de bout en bout
- [ ] Console : chaque rôle (GM, staff, vendeur) ; [x] anti-triche (aucune écriture directe d'XP / jetons), RLS relue sur l'audit attendu le 29/09 (`docs/RECETTE.md` §A) — reste à comparer avec la base en ligne (`audit_base.sql`)
- [ ] Test de charge adapté au forfait gratuit (≤ 200 connexions temps réel) — analyse faite : les téléphones n'ouvrent aucune connexion temps réel (§A) ; essai réel à faire
- Fiche de recette à suivre : **`docs/RECETTE.md`**

## Étape 12 — Présentation à Vimas
- [ ] Scénario de 5 min : inscription → scan d'un QR → coffre → mission → roue → écran géant en direct → console
- [ ] Kit : QR imprimés, lien, captures, offre courte (adapter `../domaf/offre/`)

## Étape 13 — Si Vimas signe
- [ ] Vrai line-up, vraies photos (droit à l'image, `outils/photos.py`), vrais stands et partenaires
- [ ] Retirer le bandeau « démonstration », les faux joueurs et `assets/photos/demo-artiste-*.webp`
- [ ] Forfait Supabase selon l'affluence attendue ; éventuellement renommer le projet Supabase (Settings → General, la référence ne change pas)
- [ ] Répétition générale, remise à zéro des données de test, réveil de la base avant le 26/12
