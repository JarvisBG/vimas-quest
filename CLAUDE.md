# Vimas Quest — mémoire du projet

> Fichier à lire en premier à chaque session. Le plan et l'avancement vivent dans
> `PLAN-VIMAS.md` (cases à cocher + journal + « Prochain prompt »). Mettre à jour les deux
> à chaque étape validée.

## En une phrase

Application **complète** (festivalier, écrans géants, console), d'abord montrée en démonstration à Vimas Production : le moteur DOMAF Quest
(lui-même issu de The Otaku Quest) ré-habillé aux couleurs du **VIMAS FEST**, sur la **même
base Supabase** et le **même lien** que la démo DOMAF. Objectif : montrer une app qui tourne,
pas un discours. **Le moins de travail possible** : on change la peau et le contenu, pas le moteur.

## Contexte (28/09/2026)

- **Vimas n'a rien confirmé.** La maquette sert à leur présenter l'app en direct.
- **DOMAF** : présenté, peu emballé, projet mis de côté (pas abandonné). Le dossier
  `../domaf/` reste **intact** comme archive ; ne jamais le modifier depuis ce projet.
- **VIMAS FEST**, 1ʳᵉ édition : **samedi 26 et dimanche 27 décembre 2026**, **Majestic Cinéma**
  (Université de Yaoundé I). Label jeune (officialisé le 17/01/2026), fondateur « Vimas »,
  talents urbains émergents, devise « Vimas, c'est toute une écriture ». Selon un contact :
  musique (reggae, caribéen), danse, mode — **non vérifié en ligne**.
- Affiche : `docs/affiche-vimas-fest.jpg`. Partenaires affichés : Canal 2 International,
  Sweet FM, AMZ Groupe. « Appel aux stands », pass obligatoire.

## Nom / marque

- **Vimas Quest** (gamme « … Quest » signée loJIC Solutions). Le jeu = « Vimas Quest »,
  le festival = « VIMAS FEST ». *(Nom provisoire, à valider par Jarvis.)*
- Palette (échantillonnée sur l'affiche, déjà posée dans `vimas_visuels/`) :
  rouge `#D90A22`, nuit/bordeaux `#3B0A12` (affiche `#941122`), jaune `#FFC72C`,
  orange `#F9A209`, vert `#1FA05A`, papier/crème `#FFF8EE`. Police Anton conservée.
- Les **noms** des variables CSS (`--bleu`, `--sodium`…) sont gardés : seules les valeurs changent.

## Décisions verrouillées (28/09/2026)

| Sujet | Décision |
|---|---|
| Base de données | Supabase `domaf-quest` (`greawdlzcuewlcndddxq`), compte 2utilisateursivraj@gmail.com, forfait gratuit. **Entièrement passée au VIMAS FEST le 29/09** (données DOMAF effacées, décision de Jarvis) : contenu d'essai Vimas fictif. La démo DOMAF ne doit plus être redéployée sur cette base. |
| Lien en ligne | **Le même** : Worker Cloudflare `festival-quest` (https://festival-quest.jarvismboummeu28.workers.dev). La démo DOMAF est **débranchée** (écrasée) ; elle se redéploie à tout moment depuis `../domaf/app`. |
| Moteur | **Inchangé**. Aucune modification SQL de structure. Tout identifiant côté base reste tel quel (préfixe de QR `DQ-`, noms de fonctions, `jour_jeu()` à l'heure de Douala = même fuseau que Yaoundé). |
| Dossier | `vimas/vimas-quest/` = copie de `domaf/` (app, supabase, outils) sans offre ni archives. |
| Horaires | Festival supposé **de jour** : **10 h → 22 h** les deux jours (hypothèse du 28/09, à confirmer avec Vimas). Blind test, questions « du soir », badges de nuit à adapter. |
| Contenu | **Fictif** (line-up inventé, pas de vrais noms d'artistes) tant que Vimas n'a pas signé. |
| Périmètre | **On termine l'app** (décision du 28/09) : y compris la console restante (animation, régie blind test, billetterie, statistiques). Plan complet : étapes 1 → 13 de `PLAN-VIMAS.md`. |
| Dépôt | **Dépôt GitHub propre à Vimas** (privé), distinct de `JarvisBG/domaf`. Le nom `domaf-quest` du projet Supabase est accepté tel quel. |

## Où sont les choses

| Chemin | Rôle |
|---|---|
| `app/` | L'application (site statique, Cloudflare). Serveur local : `app/lancer-serveur.bat` → http://localhost:8767 (8766 reste au DOMAF) |
| `app/assets/js/config.js` | URL Supabase + clé publishable (publique). Jamais de `sb_secret_…` |
| `app/data/mock.js` | Données du **mode démo** (`?mock=1`) — contenu Vimas de jour (étape 6, 29/09) |
| `vimas_visuels/` | Maquette statique déjà ré-habillée Vimas (27/09) : **référence** pour l'habillage de `app/` |
| `supabase/` | Scripts de la base (identiques à DOMAF). `contenu-essai/` = contenu fictif à remplacer par une version Vimas |
| `QUESTIONS-VIMAS.md` | Banque de questions du coffre (adaptée Vimas le 29/09 ; source : `supabase/outils/banque_questions.py`) |
| `outils/plan/` | Fond du plan (Majestic Cinéma, OpenStreetMap) : `python outils/plan/fond_plan.py` → `app/assets/js/plan-fond.js` |
| `docs/NOTES-MOTEUR-DOMAF.md` | **Tous les pièges techniques du moteur** (ancien CLAUDE.md DOMAF). À relire avant de toucher une page. |
| `docs/PLAN-DOMAF-archive.md` | Plan et journal complets du DOMAF (référence) |

## Points de vigilance

- **Bandeau « maquette »** : `App.config.maquette = true` (`app/assets/js/app.js`) affiche « Maquette de démonstration · contenu fictif » sur les pages du téléphone. À passer à `false` si Vimas signe.
- Le mode démo est retenu sous `vimasquest.mock` : les réglages d'un navigateur qui a vu la version DOMAF (`domafquest.*`) sont ignorés.

- **Base** : n'appartient plus qu'à Vimas (29/09). SQL en ligne : l'appliquer soi-même dans l'éditeur SQL de Supabase via Chrome
  (presse-papiers PowerShell `Get-Content -Raw -Encoding UTF8 … | Set-Clipboard`, Ctrl+A, Ctrl+V, Run, confirmer l'avertissement
  « destructive ») ; l'essayer d'abord sur PGlite. Vérifier ensuite par l'API publique (clé publishable de `config.js`).
- **Données personnelles** : la case de consentement de la fiche fan doit nommer Vimas Production,
  pas DOMAF. Joueurs d'essai DOMAF (`Essai%`) à effacer avant la démo.
- **Rien de public au nom de Vimas sans prévenir Jarvis** : le lien est public ; la maquette doit
  afficher clairement « démonstration » tant que Vimas n'a pas validé (logos partenaires compris).
- Changer `VERSION` dans `app/sw.js` à chaque mise en ligne (`cd app && npx wrangler deploy`).
- Git : dépôt **JarvisBG/vimas-quest** (privé, `main`) ; commit + push à chaque fin de tâche. `gh` n'est pas installé.
  Le dépôt `JarvisBG/domaf` n'est pas celui de ce projet.
- **Tester une page modifiée dans Chrome** : le service worker (« cache d'abord ») resert l'ancien CSS/JS, même après `fetch(..., {cache:'reload'})`, et un `unregister()` ne libère pas la page déjà contrôlée. Désinscrire + vider `caches`, puis **naviguer vers une autre page** avant de recharger (voir `navigator.serviceWorker.controller === null`).
- Détecteur de design : `~/.claude/skills/impeccable/scripts/impeccable detect --json <pages>` (skill impeccable). Les alertes `cream-palette`, `tight-leading` (Anton), `cramped-padding` des sections pleine largeur et les filets horizontaux sont **voulus** (univers de l'affiche).
- Contrôle visuel sans redimensionner Chrome : réécrire la page avec des `<iframe>` de 390 px (le redimensionnement
  de fenêtre ne prend pas). Edge sans fenêtre (`--headless`) impose une largeur minimale : captures trompeuses sous ~500 px.
- Le workflow `.github/workflows/reveil-supabase.yml` réveille la même base : inutile de le doubler.
- **Tester une page de console sans compte** : copie temporaire `admin/_essai-<page>.html` + `_essai.js` chargé entre `console.js` et le script de la page, qui remplace `C.garde`, `C.appel`, `C.sb`, `C.confirmer` et force `document.hidden` à `false` ; effacer ensuite. Jarvis préfère le **contrôle visuel dans Chrome** (onglet à part : ne jamais toucher un onglet qu'il a ouvert) ; si l'extension est déconnectée, Edge sans fenêtre (`--dump-dom`, profil neuf à chaque fois) avec un script de scénario.
- **Rester simple, comme The Otaku Quest** : quand un parcours existe dans Otaku (`../../Otaku_Quest/admin/`), le reprendre plutôt qu'inventer (ex. le vendeur trouve le joueur par son pseudo, pas en scannant un QR).
- Git : pas d'identité configurée sur ce PC → `git -c user.name="Jarvis" -c user.email=2utilisateursivraj@gmail.com commit …` (même auteur que les commits précédents).
- Console d'administration : **terminée** le 28/09 (5.0 → 5.4 : dates, annonces, roue, cœurs, régie du blind test, carnets, espace vendeur, statistiques) ; tirage au sort final mis de côté. Seul SQL écrit : `supabase/correctifs/2026-09-28_vimas-5.4-droits.sql` (vendeur sans écriture sur la roue et le blind test, pilotage de secours gardé ; retrait de `live_board` / `leaderboard_view`) — **appliqué en ligne par Jarvis le 28/09** (annulation : `…_ANNULER.sql`). Détail : `PLAN-VIMAS.md`.
- **Ni PostgreSQL ni `pg_dump` sur ce PC** (le banc `lancer.sh` et `sauvegarder.sh` ne tournent pas) : essayer le SQL avec **PGlite** — `supabase/outils/banc/audit_pglite.mjs` (mode d'emploi en tête : `npm install @electric-sql/pglite` dans un dossier temporaire). Le 28/09, l'audit de `00_schema.sql` sous PGlite = `audit_attendu.csv` à l'identique.
- `00_schema.sql` est **fabriqué** (`python supabase/outils/fabriquer_schema.py`, avec `PYTHONIOENCODING=utf-8` sous Windows) : tout changement passe par le générateur ou `sources/`, puis régénérer et vérifier que le diff ne contient que le changement voulu.

## Méthode de travail

Étape par étape, validation de Jarvis avant la suivante. Échanges en français.
**À chaque fin de tâche** : cocher `PLAN-VIMAS.md`, ajouter une ligne au journal, mettre à jour
ce fichier et le « Prochain prompt ».
