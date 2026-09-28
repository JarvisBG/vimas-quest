"""
Police d'affiche du site (Anton) réduite pour le réseau du festival (étape 4.15).

La TTF d'origine (outils/police/Anton-Regular.ttf, 167 Ko, licence OFL :
app/assets/fonts/OFL.txt) contient des centaines de glyphes inutiles ici.
On ne garde que le latin de base, le latin-1 (accents français), Œ œ Ÿ et la
ponctuation typographique (« », ’, –, —, …, espaces fines insécables que
Intl.NumberFormat("fr-FR") produit), puis on compresse en WOFF2.

    python -m pip install fonttools brotli
    python outils/police.py

Écrit app/assets/fonts/Anton-Regular.woff2. Changer de NOM de fichier si on
la refait pendant le festival (les polices sont gardées un an : _headers).
"""
from pathlib import Path
from fontTools import subset

ICI = Path(__file__).resolve().parent
SOURCE = ICI / "police" / "Anton-Regular.ttf"
SORTIE = ICI.parent / "app" / "assets" / "fonts" / "Anton-Regular.woff2"

UNICODES = (
    "U+0020-007E,"          # latin de base
    "U+00A0-00FF,"          # latin-1 : accents, « », °, ×, ÷, espace insécable
    "U+0152-0153,U+0178,"   # Œ œ Ÿ
    "U+2009,U+202F,"        # espaces fines (nombres « 1 240 » en français)
    "U+2010-2015,U+2018-201E,U+2022,U+2026,U+2030,U+2039-203A,"
    "U+20AC,U+2122,U+2190-2193,U+2212"
)

options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["kern", "liga", "calt"]
options.name_IDs = ["*"]          # garde le nom et la licence dans le fichier
options.notdef_outline = True

police = subset.load_font(str(SOURCE), options)
sous_ensemble = subset.Subsetter(options)
sous_ensemble.populate(unicodes=subset.parse_unicodes(UNICODES))
sous_ensemble.subset(police)
subset.save_font(police, str(SORTIE), options)
print(f"{SORTIE.name} : {SORTIE.stat().st_size / 1024:.1f} Ko (source {SOURCE.stat().st_size / 1024:.0f} Ko)")
