# outils/ — outillage hors ligne

Ces scripts ne sont **pas** déployés (ils vivent hors de `app/`). Ils préparent
des fichiers que le site se contente ensuite de servir.

## `photos.py` — photos d'artistes en sérigraphie deux encres

### La décision (17/09/2026)

Le site n'avait **aucune photographie** : ni visage, ni image, rien que des
aplats et des motifs dessinés en CSS. C'est ce qui lui donnait le plus un air
de chose fabriquée en laboratoire.

Plutôt que des photos couleur, on les passe en **deux encres de la palette**,
comme une affiche de concert sérigraphiée. Trois raisons, dans cet ordre :

1. **Ça reste dans le système graphique.** Le style s'appelle « Sérigraphie de
   scène » ; des photos couleur au milieu l'auraient contredit.
2. **Ça homogénéise des sources qui ne le seront pas.** Le DOMAF fournira ce
   qu'il a : portraits studio, captures de scène sous-exposées, photos de
   téléphone. En deux encres, elles se ressemblent toutes. C'est l'argument le
   plus pratique, et il a été vérifié : une source volontairement sous-exposée
   ressort presque identique à une source bien éclairée.
3. **Ça pèse quatre fois moins.** Mesuré sur les images d'essai :

   | Réglage | Poids par photo (480 px) |
   |---|---|
   | 4 tons | 1,9 – 2,2 Ko |
   | **6 tons (défaut)** | **3,4 – 3,9 Ko** |
   | 10 tons | 12,8 – 16,6 Ko |

   Une photo couleur équivalente en WebP pèse 40 à 50 Ko. Dix tons coûtent
   quatre fois le défaut sans rien apporter : le grain retraverse les paliers
   et la moucheture revient. **Ne pas monter au-dessus de 6 sans raison.**

### Usage

```bash
python outils/photos.py photos-brutes/              # défaut : nuit → sodium, 6 tons, 480 px
python outils/photos.py photos-brutes/ --tons 4     # plus graphique, deux fois plus léger
python outils/photos.py photos-brutes/ --encres bleu,sodium
python outils/photos.py une-photo.jpg --cadrage centre
```

Sortie dans `app/assets/photos/`, en WebP. Le nom du fichier vient du nom de la
source, mis au format des identifiants d'artiste :
`Nova Kassa.jpg` → `nova-kassa.webp` → `photo_url = /assets/photos/nova-kassa.webp`

### Ce qui compte dans les réglages

- `--lissage` (défaut 3) applique un **médian avant l'aplatissement**. Sans lui,
  le grain du capteur tombe de part et d'autre d'un palier et se transforme en
  moucheture sur tous les bords. Il a divisé le poids par deux en plus de
  nettoyer le rendu. Ne le mettre à 0 que sur une image déjà propre.
- `--cadrage haut` (défaut) garde le tiers supérieur du carré : sur un portrait,
  le visage n'est presque jamais au centre de l'image.
- Couples d'encres essayés : `nuit,sodium` et `bleu,sodium` se lisent bien.
  `nuit,rose` devient boueux — à éviter pour des visages.

### La trame de points

Elle n'est **pas** dans l'image : elle est posée en CSS (`.pochette--photo::after`
dans `app/assets/css/style.css`). Elle ne coûte donc aucun octet et se règle en
un seul endroit, par `--trame-force` et `--trame-pas` sur `:root`.

> **À revoir quand les vraies photos arriveront.** Les réglages actuels ont été
> jugés sur des images d'essai synthétiques, sans détail de visage. Sur un vrai
> portrait, une trame trop forte empâte les yeux et la bouche.

### Côté site

`App.photo(artiste, taille)` dans `app/assets/js/app.js` :

- affiche la photo dans le cadre « pochette » (tailles `sm` / `md` / `lg` / `xl`) ;
- **sans photo**, retombe sur une pochette dessinée tirée du nom, donc toujours
  la même pour un artiste donné. Il en manquera jusqu'au dernier jour : c'est
  l'état normal, pas une exception ;
- si le fichier ne se charge pas, montre le cadre et jamais une image brisée.

### Droit à l'image

**Cet outil ne règle rien de ce côté.** Passer une photo en deux encres ne la
rend pas libre de droits. Chaque portrait publié doit avoir son autorisation —
c'est déjà signalé dans le commentaire de la colonne `artistes.photo_url` et
dans `CLAUDE.md` pour les figures du blind test.

### Images de démonstration

`app/assets/photos/demo-artiste-*.webp` sont **synthétiques** : des formes
générées, pas des photos de personnes. Elles servent uniquement à construire les
pages avant que la programmation réelle n'existe. À supprimer à l'étape 7.

## `police.py` — police d'affiche réduite

La police Anton d'origine (`outils/police/Anton-Regular.ttf`, 167 Ko, OFL) est
réduite au latin + accents français + ponctuation typographique et compressée
en WOFF2 : `app/assets/fonts/Anton-Regular.woff2` (**15 Ko**), préchargée par
chaque page.

    python -m pip install fonttools brotli
    python outils/police.py

Un caractère hors de cette liste s'affiche dans la police de secours : ajouter
sa plage dans `UNICODES` et relancer. Changer le nom du fichier si on la refait
pendant le festival (polices gardées un an, `app/_headers`).

## `plan/fond_plan.py` — fond du plan (Stade de Bonamoussadi)

Dessine le fond SVG de `plan.html` à partir des données **OpenStreetMap**
enregistrées dans `plan/osm-bonamoussadi.json` et écrit `app/assets/js/plan-fond.js`
(`App.planFond = { geo, metresParUnite, svg }`, 18 Ko, 5,8 Ko compressés).

    python outils/plan/fond_plan.py

- Plan de 1000 × 700 unités, nord en haut, 1 unité ≈ 0,40 m. Les lieux du
  festival (table `lieux`, colonnes `x` / `y`) se placent dans ces unités.
- Si le fond est régénéré, recopier `geo` et `metresParUnite` dans
  `planConfig` (`app/data/mock.js`).
- Données © contributeurs OpenStreetMap (ODbL) : la mention est dessinée dans le
  plan. **Ne pas décalquer Google Maps** (conditions d'utilisation).
- Rafraîchir les données : voir l'en-tête du script (requête Overpass).
