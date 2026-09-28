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
> Étapes 1 à 4 terminées (habillage, textes, écrans géants refaits sur le modèle d'Otaku Quest, passe
> anti-« IA » avec le skill `impeccable`). Attaque l'**étape 5 — console d'administration** (`app/admin/`,
> style néon d'Otaku gardé) :
> - **5.0** marque Vimas déjà posée ; reste les **dates du festival** dans `app/assets/js/pages/console-programme.js`
>   (grille de 4 jours de novembre → sam. 26 et dim. 27 décembre 2026, journées **10 h → 22 h**) ;
> - puis **5.1 Animation** : roue (lots, coût, plafond, retrait des bons), annonces, coups de cœur (clôture,
>   palmarès), tirage au sort final. Comparer d'abord ce que la base offre (`supabase/sources/`, fonctions
>   `console_*` / `admin_*`) et soumettre à Jarvis ce qui manque avant d'écrire du SQL.
> Rappels : base Supabase **partagée** avec l'ancien DOMAF (`domaf-quest`) → sauvegarde SQL avant toute écriture ;
> festival supposé **de jour, 10 h → 22 h** (contenu à adapter en étape 6) ; serveur local
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

---

## État hérité du DOMAF (au 28/09/2026)

| Partie | État |
|---|---|
| Base (schéma, sécurité, RPC) | ✅ complète, en ligne |
| Pages festivalier (14) | ✅ branchées sur la base |
| Écrans géants (mur, blind test) | ✅ branchés |
| Console | ⏳ 2/3 : connexion, tableau de bord, joueurs, missions, badges, QR, programme. **Manquent** : animation, régie blind test, billetterie, statistiques |
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
- [ ] 5.0 Marque Vimas dans la console (le style néon est gardé), dates du festival dans `console-programme.js`
- [ ] 5.1 Animation : roue (lots, coût, plafond, retrait des bons), annonces, coups de cœur (clôture, palmarès), **tirage au sort final**
- [ ] 5.2 Régie du blind test : manches, questions (extrait, pochette), boss, lancement / passage en direct
- [ ] 5.3 Billetterie : carnets de tickets (GM) + espace vendeur (encaissement)
- [ ] 5.4 Statistiques (parcours, profil, micro-questions, consentements) + relecture des droits ; retirer `live_board` / `leaderboard_view` si inutiles
- [ ] Chaque sous-étape : essai au banc local (`supabase/outils/banc/`) avant la base en ligne

## Étape 6 — Contenu de démo hors ligne (`app/data/mock.js`)
- [ ] Festival : 2 jours, scènes (Grande Scène, Yard Reggae, Salle Majestic, Podium Mode, Sound System Nuit), line-up **fictif** (reggae, caribéen, urbain, danse, mode)
- [ ] Stands, food, QR (codes courts), missions, badges, lots, annonces, FAQ
- [ ] Banque de questions du coffre : `QUESTIONS-VIMAS.md` → `supabase/outils/banque_questions.py` (mock + SQL, identiques)
- [ ] Blind test : manches et boss **fictifs** ou libres de droits (pas de photos de vraies personnes)
- [ ] Faux joueurs du classement / de l'écran aux pseudos Vimas

## Étape 7 — Plan du site
- [ ] Fond du Majestic Cinéma / campus de Yaoundé I (OpenStreetMap via `outils/plan/`, jamais Google Maps)
- [ ] Lieux placés (scènes, stands, food, entrée, secours, toilettes) ; `geo` / `metresParUnite` recopiés dans `planConfig`

## Étape 8 — Base de données (partagée, `domaf-quest`)
- [ ] **Sauvegarde SQL** avant toute écriture (`supabase/ROUTINE.md`)
- [ ] Effacer le contenu d'essai DOMAF (`contenu-essai/effacer_contenu_essai.sql`) + joueurs `Essai%`
- [ ] Correctif Vimas : quartiers de Yaoundé (`profil_options`), textes des règles (`regles_jeu`), badges liés au nombre de jours, commentaires « DOMAF » des sources
- [ ] Régénérer `00_schema.sql` (générateur) pour que le dépôt reflète la base

## Étape 9 — Contenu d'essai Vimas en base
- [ ] Programme, scènes, lieux, artistes fictifs (reprend l'étape 6), saisis **par la console** (valide la console au passage)
- [ ] QR (scènes, stands, reliques), missions, badges, lots de la roue, annonces, manches du blind test
- [ ] Banque de questions du coffre en base
- [ ] Compte GM Vimas de démo + un compte vendeur d'essai

## Étape 10 — Mise en ligne sur festival-quest
- [ ] `VERSION` de `sw.js`, `cd app && npx wrangler deploy` (remplace la démo DOMAF)
- [ ] Étiquettes QR imprimées **depuis le site en ligne** (console → étiquettes)
- [ ] Vérifier `app/.assetsignore` (aucun fichier interne en ligne)

## Étape 11 — Recette complète
- [ ] Parcours festivalier sur 2–3 vrais téléphones, réseau dégradé, hors ligne
- [ ] Écran géant en direct pendant que des téléphones jouent ; blind test de bout en bout
- [ ] Console : chaque rôle (GM, staff, vendeur) ; anti-triche (aucune écriture directe d'XP / jetons), RLS relue
- [ ] Test de charge adapté au forfait gratuit (≤ 200 connexions temps réel)

## Étape 12 — Présentation à Vimas
- [ ] Scénario de 5 min : inscription → scan d'un QR → coffre → mission → roue → écran géant en direct → console
- [ ] Kit : QR imprimés, lien, captures, offre courte (adapter `../domaf/offre/`)

## Étape 13 — Si Vimas signe
- [ ] Vrai line-up, vraies photos (droit à l'image, `outils/photos.py`), vrais stands et partenaires
- [ ] Retirer le bandeau « démonstration », les faux joueurs et `assets/photos/demo-artiste-*.webp`
- [ ] Forfait Supabase selon l'affluence attendue ; éventuellement renommer le projet Supabase (Settings → General, la référence ne change pas)
- [ ] Répétition générale, remise à zéro des données de test, réveil de la base avant le 26/12
