# Contenu d'essai — Vimas Quest

De quoi jouer pour de vrai avant que le vrai contenu n'existe, calqué sur la démo
(`app/data/mock.js`) : le Majestic Cinéma (1re édition, tout dans l'enceinte), un
programme sur les deux jours, des QR à scanner, des missions, des lots, des annonces
et deux manches de blind test.

> ⚠ **Tout est fictif** : artistes, horaires, stands, lots. Aucun vrai artiste,
> aucune photo. Le site en ligne lit cette base : il affiche « Maquette de
> démonstration · contenu fictif ». À remplacer par le vrai contenu si Vimas
> Production signe (étape 13 de `PLAN-VIMAS.md`).

## Ce qu'il y a dedans

| | Nombre | Détail |
|---|---|---|
| Lieux | 16 | 2 scènes, 4 stands, 2 food-trucks, 8 points pratiques, placés sur le plan (1 unité = 0,20 m) |
| Artistes | 12 | reggae, dancehall, soca, zouk, makossa, rap, afro-pop, défilé, battle de danse — 3 têtes d'affiche |
| Concerts | 12 | samedi 26 et dimanche 27 décembre, 11 h → 22 h, sans chevauchement |
| Dédicaces | 3 | chacune avec son QR |
| QR codes | 16 | 2 scènes, 4 stands, 2 food, 1 service, 3 reliques, 3 dédicaces, 1 surprise |
| Missions | 11 | exploration, musique, gourmand, social, défi |
| Lots de la roue | 11 | du sticker au pass backstage (2 exemplaires) |
| Annonces | 3 | horaires, astuce de jeu, pluie |
| Blind test | 2 manches | 8 questions chacune : les musiques du week-end, le VIMAS FEST |

## Poser le contenu

Sur une base déjà passée au VIMAS FEST (`correctifs/2026-09-29_vimas-8-base.sql`),
coller `contenu_essai.sql` dans l'éditeur SQL de Supabase (projet **domaf-quest**),
puis Run. Le script est **rejouable** : il efface d'abord tout le contenu du
festival avant de le remettre. Posé en ligne le 29/09/2026.

> Relancer le script **remet le contenu à zéro** : effacer un QR efface les scans
> qui s'y rapportent, effacer une mission efface l'avancée des joueurs. Les
> joueurs et leur XP, eux, restent.

## Tout retirer

Coller `effacer_contenu_essai.sql` (même conséquence sur les scans et l'avancée).

## Les QR à imprimer pour essayer

La console les imprime en planche A4 : **QR et reliques → Étiquettes**, **depuis le
site en ligne** (sinon les étiquettes sortent barrées « ESSAI »). Pour scanner sans
imprimer : `<adresse du site>/scanner.html?code=DQ-XXXXXX`.

| Code | Type | XP | Lieu / objet |
|---|---|---|---|
| `DQ-VSCGRD` | scène | 30 | Grande Scène |
| `DQ-VSCPDM` | scène | 30 | Le Podium Mode |
| `DQ-VSTRAD` | stand | 20 | Radio Écho |
| `DQ-VSTKRA` | stand | 20 | Maison Kora |
| `DQ-VSTBAR` | stand | 20 | Buvette du Majestic |
| `DQ-VSTQST` | stand | 20 | Stand Vimas Quest |
| `DQ-VFDYAS` | food | 15 | Chez Yassa |
| `DQ-VFDBRZ` | food | 15 | Le Braisé |
| `DQ-VSVEAU` | service | 10 | Point d'eau Grande Scène |
| `DQ-VRLWAX` | relique commune | 75 | Le coupon de wax |
| `DQ-VRLVYN` | relique rare | 150 | Le 45 tours perdu |
| `DQ-VRLBBN` | relique légendaire | 300 | La première bobine |
| `DQ-VDDNVK` | dédicace | 100 | Nova Kassa |
| `DQ-VDDAMA` | dédicace | 100 | Ama Rise |
| `DQ-VDDTNK` | dédicace | 100 | Tanka |
| `DQ-VSPPRD` | surprise | 80 | Parade de clôture |

Les **reliques sont livrées allumées** pour qu'on puisse les essayer. En vrai, on
n'allume une relique qu'une fois l'objet caché : son indice devient public dès
l'allumage.

## Bon à savoir pour les essais

- **La billetterie est coupée** : on s'inscrit sans ticket. Elle se rallume depuis la console (Carnets).
- **Un QR de scène** ne se scanne qu'une fois par concert ; hors concert, une fois
  par journée de jeu (6 h → 6 h, heure du Cameroun).
- **Le coffre** s'ouvre après chaque scan : l'XP attend la réponse à une question.
  Les questions « de fin de journée » arrivent à partir de 18 h.
- **Le blind test** se lance depuis la régie (console → Régie blind test) : les deux
  manches sont « préparées » et attendent.
- Avant le festival, le **prochain concert** affiché est celui du samedi 26 décembre.
