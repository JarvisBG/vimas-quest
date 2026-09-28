# Vimas Quest — mémoire du projet

> Fichier à lire en premier à chaque session. Le plan et l'avancement vivent dans
> `PLAN-VIMAS.md` (cases à cocher + journal + « Prochain prompt »). Mettre à jour les deux
> à chaque étape validée.

## En une phrase

**Maquette de démonstration** pour convaincre Vimas Production : le moteur DOMAF Quest
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
| Base de données | **La même que DOMAF** : Supabase `domaf-quest` (`greawdlzcuewlcndddxq`), compte 2utilisateursivraj@gmail.com, forfait gratuit. Le contenu d'essai DOMAF y sera remplacé par un contenu d'essai Vimas. |
| Lien en ligne | **Le même** : Worker Cloudflare `festival-quest` (https://festival-quest.jarvismboummeu28.workers.dev). La démo DOMAF est **débranchée** (écrasée) ; elle se redéploie à tout moment depuis `../domaf/app`. |
| Moteur | **Inchangé**. Aucune modification SQL de structure. Tout identifiant côté base reste tel quel (préfixe de QR `DQ-`, noms de fonctions, `jour_jeu()` à l'heure de Douala = même fuseau que Yaoundé). |
| Dossier | `vimas/vimas-quest/` = copie de `domaf/` (app, supabase, outils) sans offre ni archives. |
| Contenu | **Fictif** (line-up inventé, pas de vrais noms d'artistes) tant que Vimas n'a pas signé. |

## Où sont les choses

| Chemin | Rôle |
|---|---|
| `app/` | L'application (site statique, Cloudflare). Serveur local : `app/lancer-serveur.bat` → http://localhost:8766 |
| `app/assets/js/config.js` | URL Supabase + clé publishable (publique). Jamais de `sb_secret_…` |
| `app/data/mock.js` | Données du **mode démo** (`?mock=1`) — à passer en Vimas |
| `vimas_visuels/` | Maquette statique déjà ré-habillée Vimas (27/09) : **référence** pour l'habillage de `app/` |
| `supabase/` | Scripts de la base (identiques à DOMAF). `contenu-essai/` = contenu fictif à remplacer par une version Vimas |
| `QUESTIONS-VIMAS.md` | Banque de questions du coffre (copie DOMAF, à adapter) |
| `docs/NOTES-MOTEUR-DOMAF.md` | **Tous les pièges techniques du moteur** (ancien CLAUDE.md DOMAF). À relire avant de toucher une page. |
| `docs/PLAN-DOMAF-archive.md` | Plan et journal complets du DOMAF (référence) |

## Points de vigilance

- **Base partagée** : tant que Vimas n'a pas signé, toute écriture en base écrase le contenu DOMAF.
  Avant de toucher la base : exporter une sauvegarde SQL (`supabase/ROUTINE.md`).
- **Données personnelles** : la case de consentement de la fiche fan doit nommer Vimas Production,
  pas DOMAF. Joueurs d'essai DOMAF (`Essai%`) à effacer avant la démo.
- **Rien de public au nom de Vimas sans prévenir Jarvis** : le lien est public ; la maquette doit
  afficher clairement « démonstration » tant que Vimas n'a pas validé (logos partenaires compris).
- Changer `VERSION` dans `app/sw.js` à chaque mise en ligne (`cd app && npx wrangler deploy`).
- Git : le `.git` de `domaf/` déposé était vide. Dépôt local à créer ici ; le dépôt GitHub
  `JarvisBG/domaf` n'est pas celui de ce projet. Ne pas pousser sans accord de Jarvis.
- Le workflow `.github/workflows/reveil-supabase.yml` réveille la même base : inutile de le doubler.

## Méthode de travail

Étape par étape, validation de Jarvis avant la suivante. Échanges en français.
**À chaque fin de tâche** : cocher `PLAN-VIMAS.md`, ajouter une ligne au journal, mettre à jour
ce fichier et le « Prochain prompt ».
