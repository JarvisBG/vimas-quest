# Contenu d'essai — DOMAF Quest

De quoi jouer pour de vrai avant que le vrai contenu n'existe : un site complet,
un programme sur les quatre jours, des QR à scanner, des missions, des lots, des
annonces et deux manches de blind test.

> ⚠ **Programmation fictive.** Les artistes sont de **vrais artistes camerounais
> en activité**, mais **aucun n'est engagé** : scènes, horaires et séances de
> dédicaces sont inventés pour les essais. Ce contenu ne doit pas être montré
> comme une annonce du festival — et il est visible de quiconque ouvre la démo
> en ligne, puisque le site lit cette base. Aucune photo d'artiste n'est posée
> (droit à l'image, étape 7) : les fiches affichent l'initiale.

## Ce qu'il y a dedans

| | Nombre | Détail |
|---|---|---|
| Lieux | 25 | 4 scènes, 6 stands, 5 points de restauration, 10 points pratiques, tous placés sur le plan |
| Artistes | 28 | makossa, bikutsi, afrobeats, rap, soul, jazz — 5 têtes d'affiche |
| Concerts | 36 | du jeudi 26 au dimanche 29 novembre, 16 h → 1 h 30, sans chevauchement |
| Dédicaces | 6 | chacune avec son QR |
| QR codes | 30 | 4 scènes, 6 stands, 5 food, 3 services, 5 reliques, 6 dédicaces, 1 surprise |
| Missions | 11 | exploration, musique, gourmand, social, défi |
| Lots de la roue | 11 | du sticker au pass backstage (4 exemplaires) |
| Annonces | 3 | horaires, astuce de jeu, alerte météo |
| Blind test | 2 manches | 8 questions chacune, sur la musique camerounaise |

## Poser le contenu

Coller `contenu_essai.sql` dans l'éditeur SQL de Supabase (projet **domaf-quest**),
puis Run. Le script est **rejouable** : il efface d'abord son propre contenu avant
de le remettre.

> Relancer le script **remet les essais à zéro** : effacer un QR efface les scans
> qui s'y rapportent, effacer une mission efface l'avancée des joueurs. Les
> joueurs et leur XP, eux, restent.

## Tout retirer

Coller `effacer_contenu_essai.sql`. Même conséquence : ce que les essais ont
produit sur ce contenu s'en va avec lui. Les joueurs restent (la fin du fichier
donne, en commentaire, de quoi les effacer aussi).

À faire **avant le festival**, quand le vrai contenu arrive (étape 7).

## Les QR à imprimer pour essayer

La console les imprime en planche A4 : **QR et reliques → Étiquettes**. Il faut
le faire **depuis le site en ligne**, sinon les étiquettes sortent barrées
« ESSAI ». Pour scanner sans imprimer, l'adresse encodée est
`<adresse du site>/scanner.html?code=DQ-XXXXXX`.

| Code | Type | XP | Lieu / objet |
|---|---|---|---|
| `DQ-SC2WRU` | scène | 30 | Scène Wouri |
| `DQ-SC2BNM` | scène | 30 | Scène Bonamoussadi |
| `DQ-SC2MNG` | scène | 30 | Scène du Manguier |
| `DQ-SC2NJG` | scène | 30 | Chapiteau Njangi |
| `DQ-ST2GRG` | stand | 20 | Village Green Grass |
| `DQ-ST2QST` | stand | 20 | Stand DOMAF Quest |
| `DQ-ST2DSQ` | stand | 20 | Disquaire & librairie |
| `DQ-ST2RAD` | stand | 20 | Radio du festival |
| `DQ-ST2PGN` | stand | 20 | Créateurs & pagne |
| `DQ-ST2ART` | stand | 20 | Artisanat du Wouri |
| `DQ-FD2NDL` | food | 15 | Chez Mama Ndolè |
| `DQ-FD2SYA` | food | 15 | Soya braisé du stade |
| `DQ-FD2BGN` | food | 15 | Beignets-haricot-bouillie |
| `DQ-FD2FLR` | food | 15 | Folère & gingembre |
| `DQ-FD2PSN` | food | 15 | Poisson braisé Bonamoussadi |
| `DQ-SV2EAU` | service | 10 | Point d'eau central |
| `DQ-SV2PTS` | service | 10 | Point info & objets trouvés |
| `DQ-SV2RCH` | service | 10 | Recharge téléphone |
| `DQ-RL2BLF` | relique commune | 75 | Le balafon oublié |
| `DQ-RL2BGN` | relique commune | 75 | La recette de mamie |
| `DQ-RL2VYN` | relique rare | 150 | Le 45 tours rayé |
| `DQ-RL2TAM` | relique rare | 150 | Le tam-tam du veilleur |
| `DQ-RL2SAX` | relique légendaire | 300 | Le saxophone d'argent |
| `DQ-DDBDCA` | dédicace | 100 | Ben Decca |
| `DQ-DDDPHN` | dédicace | 100 | Daphné |
| `DQ-DDCDPA` | dédicace | 100 | Charlotte Dipanda |
| `DQ-DDBLNC` | dédicace | 100 | Blanche Bailly |
| `DQ-DDSTAN` | dédicace | 100 | Stanley Enow |
| `DQ-DDLPNC` | dédicace | 100 | Lady Ponce |
| `DQ-SPRZ22` | surprise | 80 | Surprise du Green Grass |

Les **reliques sont livrées allumées** pour qu'on puisse les essayer. En vrai, on
n'allume une relique qu'une fois l'objet caché : son indice devient public dès
l'allumage.

## Bon à savoir pour les essais

- **La billetterie est coupée** (réglage de `01_reference.sql`) : on s'inscrit
  sans ticket. Elle se rallume depuis la console.
- **Un QR de scène** ne se scanne qu'une fois par concert ; hors concert, une
  fois par journée de jeu (6 h → 6 h, heure de Douala).
- **Le coffre** s'ouvre après chaque scan : l'XP attend la réponse à une
  question. C'est voulu (étape 6.3 bis).
- **Le blind test** se lance depuis la régie (console, étape 6.6, pas encore
  écrite) : les deux manches sont « préparées » et attendent.
- Pendant les essais, le **prochain concert** affiché sur la carte est celui du
  jeudi 26 novembre : les dates sont celles du vrai festival, encore à venir.

## Ce qui reste à faire à l'étape 7

Remplacer ce contenu par le vrai : line-up confirmé, photos passées par
`outils/photos.py` (droit à l'image vérifié), stands et partenaires réels, lots
négociés, extraits audio et pochettes du blind test, vraie position des lieux sur
le plan.
