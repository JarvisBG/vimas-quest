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

> Continue le projet Vimas Quest : lis `CLAUDE.md` et `PLAN-VIMAS.md` (et `docs/NOTES-MOTEUR-DOMAF.md`
> avant de toucher une page), puis attaque l'**étape 3** — identité et textes (DOMAF → VIMAS FEST, 2 jours,
> Majestic Cinéma, clés `vimasquest.*`, consentement Vimas Production, bandeau « démonstration »).

---

## Journal

| Date | Fait |
|---|---|
| 28/09/2026 | Cadrage : maquette pour Vimas, même base et même lien que DOMAF. Copie de `domaf/` → `vimas-quest/` (sans offre ni archives), docs de suivi créés, dépôt Git local. |
| 28/09/2026 | Vérifié : le mode démo (`?mock=1`) accepte les vrais QR imprimés (`scanner.html?code=QR-…`), sans base. Limites : chaque téléphone joue seul, classement et écran géant simulés. |
| 28/09/2026 | Décision de Jarvis : on **termine** l'application pour Vimas (festivalier + console + écrans). Plan complet réécrit (étapes 1 → 13). |
| 28/09/2026 | Dépôt GitHub JarvisBG/vimas-quest créé et poussé. **Étape 2 terminée** : couleurs, icônes, marque, manifeste ; `VERSION` du service worker = `vimasquest-v1` ; serveur local sur le port **8767** (8766 = DOMAF). |

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

## Étape 3 — Identité et textes (festivalier)
- [ ] « DOMAF » → « VIMAS FEST » / « Vimas Quest » partout (≈ 188 mentions, 54 fichiers) : accueil, infos, règles, FAQ, 404, hors ligne
- [ ] Clés du téléphone `domafquest.*` → `vimasquest.*` ; **ne pas** toucher ce que lit la base (`DQ-`, `DQ-JOUEUR:`)
- [ ] 2 jours au lieu de 4 : dates, compte à rebours, badge « Marathonien », tirage au sort final (27/12), lots (« Pass 2 jours »)
- [ ] Lieu : Majestic Cinéma, Université de Yaoundé I
- [ ] Fiche fan : consentement « Vimas Production », quartiers de **Yaoundé** (page + `profil_options()` en base, étape 8)
- [ ] Partenaires : Canal 2 International, Sweet FM, AMZ Groupe (texte ; logos seulement avec accord)
- [ ] Bandeau discret « démonstration » tant que Vimas n'a pas signé
- [ ] `sw.js` : nom du cache + `VERSION`

## Étape 4 — Écrans géants
- [ ] `ecran/mur.html` et `ecran/blind-test.html` aux couleurs Vimas (projecteur : contraste fort sur fond nuit)
- [ ] Textes et marque de l'écran ; test à 1920 × 1080

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
