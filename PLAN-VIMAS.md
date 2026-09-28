# Plan — Vimas Quest (maquette de démonstration pour Vimas Production)

> Objectif : une démo **qui tourne** sur téléphone, écran géant et console, aux couleurs du
> VIMAS FEST (26–27 déc. 2026, Majestic Cinéma, Yaoundé), avec la base et le lien de la démo
> DOMAF. Minimum de travail : peau + contenu, moteur inchangé.
> Une étape à la fois, validée par Jarvis. Cocher `[x]` au fur et à mesure. Contexte : `CLAUDE.md`.

---

## ▶ Prochain prompt (en cas de coupure)

> Continue le projet Vimas Quest : lis `CLAUDE.md` et `PLAN-VIMAS.md` (et `docs/NOTES-MOTEUR-DOMAF.md`
> avant de toucher une page), puis attaque l'**étape 2** — habillage de `app/` aux couleurs Vimas
> en reprenant les valeurs de `vimas_visuels/`.

---

## Journal

| Date | Fait |
|---|---|
| 28/09/2026 | Cadrage : maquette pour Vimas, même base et même lien que DOMAF. Copie de `domaf/` → `vimas-quest/` (sans offre ni archives), docs de suivi créés. |

---

## Étape 0 — Cadrage ✅
- [x] Objectif : démonstration à présenter à Vimas (rien de signé)
- [x] Même base Supabase, même Worker `festival-quest` ; démo DOMAF débranchée, dossier `domaf/` gardé intact
- [x] Moteur inchangé, contenu fictif

## Étape 1 — Mise en place ✅ (sauf Git)
- [x] Copie du projet dans `vimas-quest/` (app, supabase, outils, visuels Vimas, affiche)
- [x] `CLAUDE.md`, `PLAN-VIMAS.md`, notes techniques du moteur dans `docs/`
- [ ] Dépôt Git local (`git init` + premier commit) — dépôt GitHub à décider avec Jarvis
- [ ] Valider le nom « Vimas Quest »

## Étape 2 — Habillage (couleurs, logo, icônes)
- [ ] Reporter les valeurs de couleurs de `vimas_visuels/assets/css` dans `app/assets/css` (noms de variables gardés)
- [ ] Logo / marque dans l'en-tête, `manifest.webmanifest` (nom, couleurs), icônes de l'app
- [ ] Écrans géants (`app/ecran/`) : même palette ; console (`app/admin/`) : garder le néon, juste le nom
- [ ] Contrôle visuel page par page en local (téléphone 390 px)

## Étape 3 — Textes et identité
- [ ] Remplacer « DOMAF » (≈ 188 mentions, 54 fichiers) : titres, pages, infos, règles, 404, hors-ligne
- [ ] Clés du téléphone `domafquest.*` → `vimasquest.*` (sessions, cache) ; **ne pas** toucher `DQ-` (côté base)
- [ ] Dates (2 jours : sam. 26 / dim. 27 déc.), lieu (Majestic Cinéma, Université de Yaoundé I)
- [ ] Consentement de la fiche fan : « Vimas Production » ; mention « démonstration » visible
- [ ] Partenaires : Canal 2 International, Sweet FM, AMZ Groupe (texte seulement, pas de logos sans accord)

## Étape 4 — Contenu de démo (mode hors ligne, `app/data/mock.js`)
- [ ] Programme sur 2 jours, scènes (Grande Scène, Yard Reggae, Salle Majestic, Podium Mode, Sound System Nuit), line-up **fictif**
- [ ] Plan du site : fond schématique du Majestic Cinéma (remplace le Stade de Bonamoussadi)
- [ ] Missions, badges, lots de la roue, annonces adaptés (musique, danse, mode)
- [ ] Banque de questions du coffre (`QUESTIONS-VIMAS.md` → script → `mock.js` + SQL)
- [ ] Blind test : manches et « boss » reggae / caribéen (sans photos de vraies personnes)

## Étape 5 — Base de données (la même que DOMAF)
- [ ] Sauvegarde SQL de la base avant toute écriture
- [ ] Effacer le contenu d'essai DOMAF (`supabase/contenu-essai/effacer_contenu_essai.sql`) et les joueurs `Essai%`
- [ ] Poser un contenu d'essai Vimas (même contenu que l'étape 4) + fond de plan / lieux
- [ ] Quelques QR de démo imprimables (scène, stand, relique) depuis la console

## Étape 6 — Mise en ligne
- [ ] `VERSION` de `sw.js`, `npx wrangler deploy` depuis `app/` (écrase la démo DOMAF sur `festival-quest`)
- [ ] Recette sur un vrai téléphone : inscription, scan, missions, roue, classement, blind test
- [ ] Écran géant (mur + blind test) et console testés

## Étape 7 — Présentation à Vimas
- [ ] Scénario de démo (5 min) : inscription → scan d'un QR → mission → roue → écran géant en direct
- [ ] Kit : QR imprimés, lien, captures d'écran, une page d'offre courte (reprendre `../domaf/offre/` si utile)

## Plus tard — seulement si Vimas signe
- [ ] Vrai line-up, vraies photos (droit à l'image), vrai plan
- [ ] Décider : base dédiée ou on garde la base partagée ; forfait Supabase selon l'affluence attendue
- [ ] Recette complète (voir étapes 7–8 de `docs/PLAN-DOMAF-archive.md`)
