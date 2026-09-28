#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DOMAF Quest — préparation des photos d'artistes (sérigraphie deux encres)

POURQUOI CET OUTIL
------------------
Le DOMAF fournira les photos qu'il a : portraits studio, captures de scène mal
éclairées, photos de téléphone. Passées en DEUX ENCRES de la palette, elles se
ressemblent toutes — c'est un avantage pratique autant qu'esthétique.

Et comme une image en aplats se compresse bien mieux qu'une photo couleur, on
tombe autour de 10-15 Ko au lieu de 40-50. Sur le réseau d'un festival, c'est la
différence entre une page qui s'affiche et une page qui ne s'affiche pas.

CE QU'IL FAIT
-------------
  photo source  ->  redressée (EXIF)  ->  recadrée en carré  ->  niveaux de gris
                ->  contraste étalé   ->  aplatie en N tons   ->  deux encres
                ->  WebP (le plus léger entre avec et sans perte)

Le grain de sérigraphie (trame de points) N'EST PAS incrusté dans l'image : il
est posé en CSS par-dessus (.photo). Il ne coûte donc aucun octet et reste
réglable. Voir assets/css/style.css, section « Photos ».

USAGE
-----
  python outils/photos.py <dossier-source> [options]
  python outils/photos.py photos-brutes/ --taille 480
  python outils/photos.py photos-brutes/ --encres bleu,sodium
  python outils/photos.py photos-brutes/ --cadrage haut       # visages hauts

Le nom du fichier de sortie est celui de la source, en minuscules sans accent :
  « Nova Kassa.jpg » -> app/assets/photos/nova-kassa.webp
C'est aussi l'identifiant à mettre dans artistes.photo_url (/assets/photos/…).

DROIT À L'IMAGE
---------------
Cet outil ne règle RIEN de ce côté. Le traitement en deux encres ne rend pas une
photo libre de droits. Chaque portrait publié doit avoir son autorisation.
"""

import argparse
import re
import sys
import unicodedata
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageOps, ImageFilter
except ImportError:
    sys.exit("Pillow n'est pas installé :  python -m pip install Pillow")

# La console Windows est en cp1252 : sans ça, une flèche ou un accent dans un
# message suffit à faire planter l'outil au lieu de traiter les photos.
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# La palette. Ce sont EXACTEMENT les encres de assets/css/style.css : si l'une
# change là-bas, elle doit changer ici, sinon les photos jurent avec le reste.
# ---------------------------------------------------------------------------
ENCRES = {
    "nuit":    (0x0A, 0x14, 0x40),
    "bleu":    (0x1F, 0x3F, 0xD1),
    "sodium":  (0xFF, 0xD2, 0x3F),
    "rose":    (0xFF, 0x5F, 0xA2),
    "vert":    (0x2B, 0xB6, 0x73),
    "papier":  (0xFA, 0xFA, 0xF7),
}

DOSSIER_SORTIE = Path("app/assets/photos")
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def nom_fichier(nom: str) -> str:
    """« Nova Kassà.JPG » -> « nova-kassa ». Même règle que les id d'artiste
    en base (contrainte artistes_id_format : minuscules, chiffres, tirets)."""
    sans_accent = unicodedata.normalize("NFD", nom)
    sans_accent = "".join(c for c in sans_accent if unicodedata.category(c) != "Mn")
    tirets = re.sub(r"[^a-zA-Z0-9]+", "-", sans_accent).strip("-").lower()
    return tirets or "photo"


def aplatir(tons: int):
    """Table de 256 valeurs qui ramène les gris à `tons` paliers. C'est elle qui
    donne l'aspect sérigraphie ET qui rend le fichier minuscule : de grands
    aplats d'une seule valeur, exactement ce que WebP compresse le mieux."""
    if tons < 2:
        tons = 2
    return [round(min(i * tons // 256, tons - 1) * 255 / (tons - 1)) for i in range(256)]


def recadrer(img: Image.Image, cadrage: str) -> Image.Image:
    """Carré. Sur un portrait, le visage est rarement au centre de l'image :
    « haut » garde le tiers supérieur, ce qui rate beaucoup moins souvent."""
    l, h = img.size
    cote = min(l, h)
    x = (l - cote) // 2
    if cadrage == "haut":
        y = 0
    elif cadrage == "bas":
        y = h - cote
    else:
        y = (h - cote) // 2
    return img.crop((x, y, x + cote, y + cote))


def traiter(source: Path, sortie: Path, args) -> dict:
    sombre = ENCRES[args.encres[0]]
    clair = ENCRES[args.encres[1]]

    img = Image.open(source)
    img = ImageOps.exif_transpose(img)          # photos de téléphone : à redresser
    img = img.convert("L")                      # en gris AVANT tout le reste
    img = recadrer(img, args.cadrage)
    img = img.resize((args.taille, args.taille), Image.LANCZOS)

    # Étaler le contraste : une photo de scène sous-exposée n'a que des gris
    # moyens ; sans ça, les deux encres ne se distinguent presque pas.
    img = ImageOps.autocontrast(img, cutoff=args.contraste)
    if args.nettete:
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=3))

    # Lisser AVANT d'aplatir. Le grain du capteur tombe de part et d'autre d'un
    # palier et se transforme sinon en moucheture sur tous les bords. Le médian
    # efface ce grain sans manger les contours, contrairement à un flou.
    # Effet de bord heureux : moins de détail haute fréquence = fichier plus petit.
    if args.lissage:
        img = img.filter(ImageFilter.MedianFilter(size=args.lissage))

    # Aplatir d'abord, colorer ensuite : deux encres, N paliers entre elles.
    img = img.point(aplatir(args.tons))
    couleur = ImageOps.colorize(img, black=sombre, white=clair)

    # Avec perte ou sans perte ? Sur des aplats, le sans-perte gagne souvent, et
    # il évite les bavures autour des paliers. On garde le plus petit des deux.
    essais = {}
    for nom, options in (("sans perte", {"lossless": True, "quality": 100}),
                         ("avec perte", {"quality": args.qualite, "method": 6})):
        tampon = BytesIO()
        couleur.save(tampon, "WEBP", **options)
        essais[nom] = tampon.getvalue()

    gagnant = min(essais, key=lambda k: len(essais[k]))
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_bytes(essais[gagnant])

    return {
        "source": source.name,
        "sortie": sortie.name,
        "octets": len(essais[gagnant]),
        "mode": gagnant,
        "avant": source.stat().st_size,
    }


def main():
    p = argparse.ArgumentParser(
        description="Prépare les photos d'artistes en sérigraphie deux encres.")
    p.add_argument("source", type=Path, help="dossier des photos d'origine (ou un fichier)")
    p.add_argument("--taille", type=int, default=480,
                   help="côté du carré en pixels (défaut 480 : net sur un écran de téléphone)")
    p.add_argument("--encres", default="nuit,sodium",
                   help="encre sombre,encre claire — parmi " + ", ".join(ENCRES))
    p.add_argument("--tons", type=int, default=6,
                   help="nombre de paliers (défaut 6 ; 4 = très graphique, 10 = plus doux)")
    p.add_argument("--cadrage", choices=["centre", "haut", "bas"], default="haut",
                   help="quelle partie garder en recadrant (défaut haut : les visages)")
    p.add_argument("--contraste", type=float, default=2.0, help="%% de pixels ignorés aux extrêmes")
    p.add_argument("--lissage", type=int, default=3,
                   help="médian avant aplatissement, en pixels impairs (0 = aucun, défaut 3)")
    p.add_argument("--qualite", type=int, default=82, help="qualité WebP avec perte")
    p.add_argument("--nettete", action="store_true", help="accentuer avant l'aplatissement")
    p.add_argument("--sortie", type=Path, default=DOSSIER_SORTIE)
    args = p.parse_args()

    args.encres = [e.strip() for e in args.encres.split(",")]
    if len(args.encres) != 2 or any(e not in ENCRES for e in args.encres):
        sys.exit(f"--encres attend deux noms parmi : {', '.join(ENCRES)}")
    if args.tons < 2:
        sys.exit("--tons vaut au moins 2")
    if args.lissage and (args.lissage < 3 or args.lissage % 2 == 0):
        sys.exit("--lissage attend 0 ou un nombre impair >= 3")

    fichiers = ([args.source] if args.source.is_file()
                else sorted(f for f in args.source.rglob("*") if f.suffix.lower() in EXTENSIONS))
    if not fichiers:
        sys.exit(f"Aucune image trouvée dans {args.source}")

    print(f"{len(fichiers)} image(s) — encres {args.encres[0]} → {args.encres[1]}, "
          f"{args.tons} tons, {args.taille} px\n")
    total = avant = 0
    for f in fichiers:
        try:
            r = traiter(f, args.sortie / (nom_fichier(f.stem) + ".webp"), args)
        except Exception as e:
            print(f"  ✗ {f.name} : {e}")
            continue
        total += r["octets"]
        avant += r["avant"]
        print(f"  ✓ {r['sortie']:<28} {r['octets'] / 1024:6.1f} Ko "
              f"({r['mode']}, source {r['avant'] / 1024:.0f} Ko)")

    if total:
        print(f"\nTotal : {total / 1024:.1f} Ko pour {len(fichiers)} photos "
              f"(sources : {avant / 1024:.0f} Ko)")
        print(f"Dossier : {args.sortie}")
        print("\nÀ reporter dans artistes.photo_url : /assets/photos/<nom>.webp")


if __name__ == "__main__":
    main()
