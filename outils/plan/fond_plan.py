"""
Fond du plan du festival — Majestic Cinéma, Université de Yaoundé I (étape 7 Vimas).
(Version DOMAF, Stade de Bonamoussadi : historique Git, avant le 29/09/2026.)

Dessine, dans le style de l'app (sol clair, allées blanches épaisses, encre
nuit Vimas), le fond SVG de plan.html à partir des données OpenStreetMap
enregistrées dans osm-majestic.json. Hors ligne, non déployé.

    python outils/plan/fond_plan.py

Écrit app/assets/js/plan-fond.js : App.planFond = { geo, metresParUnite, svg }.
Le plan fait 1000 × 700 unités, nord en haut. Les lieux du festival (table
`lieux`, colonnes x / y ; démo : app/data/mock.js → lieux) se placent dans ces
mêmes unités. Après régénération, recopier geo / metresParUnite dans
mock.js → planConfig.

Données : © contributeurs OpenStreetMap, licence ODbL. La mention est dessinée
dans le plan (obligatoire). Ne PAS décalquer Google Maps : ses conditions
l'interdisent ; la vue satellite ne sert qu'à se repérer.

Rafraîchir les données (overpass-api.de refuse parfois : kumi.systems répond) :
    curl "https://overpass.kumi.systems/api/interpreter" --data-urlencode \
      'data=[out:json][timeout:90];(way(3.8572,11.4944,3.8612,11.4989);node(3.8572,11.4944,3.8612,11.4989)[name];);out tags geom;' \
      -o outils/plan/osm-majestic.json
"""
import json
import sys
import math
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent
SORTIE = RACINE / "app" / "assets" / "js" / "plan-fond.js"

# Couleurs Vimas (affiche) : nuit, papier, vert ; sol et eau neutres
NUIT, PAPIER, VERT = "#3B0A12", "#FFF8EE", "#1FA05A"
SOL, BATI, EAU = "#F1E7D0", "#E2D5B8", "#7FB4D9"

# --- Cadre : 280 m de large, centré sur l'enceinte du Majestic --------------
W, H = 1000, 700
LARGEUR_M = 280
LAT_CENTRE, LON_CENTRE = 3.859211, 11.4966074      # enceinte (way 881969107)
M_PAR_DEG_LAT = 110574
M_PAR_DEG_LON = 111320 * math.cos(math.radians(LAT_CENTRE))
METRES_PAR_UNITE = LARGEUR_M / W
DEMI_LON = LARGEUR_M / 2 / M_PAR_DEG_LON
DEMI_LAT = H * METRES_PAR_UNITE / 2 / M_PAR_DEG_LAT
OUEST, EST = LON_CENTRE - DEMI_LON, LON_CENTRE + DEMI_LON
NORD, SUD = LAT_CENTRE + DEMI_LAT, LAT_CENTRE - DEMI_LAT


def xy(p):
    return ((p["lon"] - OUEST) / (EST - OUEST) * W, (NORD - p["lat"]) / (NORD - SUD) * H)


def pts(g):
    return " ".join(f"{x:.0f},{y:.0f}" for x, y in map(xy, g))


def boite(g):
    xs, ys = zip(*map(xy, g))
    return min(xs), min(ys), max(xs), max(ys)


def visible(g, marge=40):
    x0, y0, x1, y1 = boite(g)
    return x1 > -marge and x0 < W + marge and y1 > -marge and y0 < H + marge


donnees = json.loads((ICI / "osm-majestic.json").read_text(encoding="utf-8"))
ways = [e for e in donnees["elements"] if e["type"] == "way" and e.get("geometry")]
par_id = {e["id"]: e for e in ways}
tag = lambda e, k: e.get("tags", {}).get(k)

ENCEINTE = par_id[881969107]   # amenity=cinema « Majestic Yaoundé I University » : le site du festival

morceaux = []
ajoute = morceaux.append
poly = lambda e: f'<polygon points="{pts(e["geometry"])}"/>'
ligne = lambda e: f'<polyline points="{pts(e["geometry"])}"/>'
vus = lambda filtre: [e for e in ways if filtre(e) and visible(e["geometry"])]

ajoute(f'<defs><clipPath id="cadre-plan"><rect width="{W}" height="{H}"/></clipPath></defs>')
ajoute('<g clip-path="url(#cadre-plan)">')
ajoute(f'<rect width="{W}" height="{H}" fill="{SOL}"/>')

# Végétation : bois, pelouses, broussailles
bois = vus(lambda e: tag(e, "landuse") == "forest" or tag(e, "natural") in ("wood", "scrub"))
pelouses = vus(lambda e: tag(e, "landuse") in ("village_green", "grass") or tag(e, "leisure") == "park")
ajoute(f'<g fill="{VERT}" opacity=".16">' + "".join(poly(e) for e in bois) + "</g>")
ajoute(f'<g fill="{VERT}" opacity=".28">' + "".join(poly(e) for e in pelouses) + "</g>")

# Eau : bassins de la pisciculture, ruisseaux
bassins = vus(lambda e: tag(e, "landuse") in ("basin", "aquaculture") or tag(e, "natural") == "water")
ruisseaux = vus(lambda e: tag(e, "waterway"))
ajoute(f'<g fill="{EAU}" opacity=".45">' + "".join(poly(e) for e in bassins) + "</g>")
ajoute(f'<g fill="none" stroke="{EAU}" stroke-width="4" stroke-linecap="round">' + "".join(ligne(e) for e in ruisseaux) + "</g>")

# Terrains de sport voisins, en pointillés
terrains = vus(lambda e: tag(e, "leisure") == "pitch")
ajoute(f'<g fill="{VERT}" fill-opacity=".12" stroke="{VERT}" stroke-width="2" stroke-dasharray="8 6">'
       + "".join(poly(e) for e in terrains) + "</g>")

# Rues et allées : blanches et épaisses (l'axe du campus plus large)
axes = vus(lambda e: tag(e, "highway") in ("tertiary", "secondary", "primary"))
rues = vus(lambda e: tag(e, "highway") in ("residential", "unclassified", "service", "living_street"))
ajoute(f'<g fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">'
       + "".join(ligne(e) for e in axes) + "</g>")
ajoute(f'<g fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">'
       + "".join(ligne(e) for e in rues) + "</g>")
ajoute('<g fill="none" stroke="#D8CBAE" stroke-width="2" stroke-dasharray="6 8">'
       + "".join(ligne(e) for e in axes + rues) + "</g>")

# L'enceinte du Majestic : le site du festival
ajoute(f'<polygon points="{pts(ENCEINTE["geometry"])}" fill="{PAPIER}" stroke="{NUIT}" stroke-width="5" stroke-linejoin="round"/>')

# Parking (gravier) : hachures
parkings = vus(lambda e: tag(e, "amenity") == "parking")
ajoute('<defs><pattern id="hachures-plan" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
       f'<line x1="0" y1="0" x2="0" y2="10" stroke="{NUIT}" stroke-width="1.5" stroke-opacity=".18"/></pattern></defs>')
ajoute(f'<g fill="url(#hachures-plan)" stroke="{NUIT}" stroke-width="1" stroke-opacity=".3">' + "".join(poly(e) for e in parkings) + "</g>")

# Bâtiments ; panneaux solaires du Majestic en rangées sombres
batis = vus(lambda e: bool(tag(e, "building")))
solaire = vus(lambda e: tag(e, "power") == "generator")
ajoute(f'<g fill="{BATI}" stroke="{NUIT}" stroke-width="1.2" stroke-opacity=".45">' + "".join(poly(e) for e in batis) + "</g>")
ajoute(f'<g fill="{NUIT}" fill-opacity=".55" stroke="{NUIT}" stroke-width="1">' + "".join(poly(e) for e in solaire) + "</g>")

# Murs : filets fins
murs = vus(lambda e: tag(e, "barrier") in ("wall", "retaining_wall", "fence", "hedge"))
ajoute(f'<g fill="none" stroke="{NUIT}" stroke-width="1.5" stroke-opacity=".35">' + "".join(ligne(e) for e in murs) + "</g>")


# Libellés
def libelle(texte, x, y, rot=0, classe="zone-lib"):
    t = f' transform="rotate({rot} {x:.0f} {y:.0f})"' if rot else ""
    return f'<text class="{classe}" x="{x:.0f}" y="{y:.0f}" text-anchor="middle"{t}>{texte}</text>'


ex0, ey0, ex1, ey1 = boite(ENCEINTE["geometry"])
CONTOUR = [xy(p) for p in ENCEINTE["geometry"]]


def dans_enceinte(x, y, marge=40):
    """Point dans l'enceinte (ou à moins de `marge` de son cadre) : pas de nom de rue par-dessus les scènes."""
    if not (ex0 - marge < x < ex1 + marge and ey0 - marge < y < ey1 + marge):
        return False
    dedans = False
    for (xa, ya), (xb, yb) in zip(CONTOUR, CONTOUR[1:] + CONTOUR[:1]):
        if (ya > y) != (yb > y) and x < xa + (y - ya) * (xb - xa) / (yb - ya):
            dedans = not dedans
    return dedans or ex0 < x < ex1 and ey0 < y < ey1



ajoute(libelle("Majestic Cinéma", (ex0 + ex1) / 2, ey0 - 12, 0, "zone-lib zone-lib--fort"))
for e in terrains[:1]:
    bx0, by0, bx1, by1 = boite(e["geometry"])
    ajoute(libelle("Complexe sportif", min(max((bx0 + bx1) / 2, 90), W - 90), min(max((by0 + by1) / 2, 30), H - 20)))
nommees = set()
for e in axes + rues:
    nom = tag(e, "name")
    if not nom or nom in nommees:
        continue
    g = [p for p in e["geometry"] if 30 < xy(p)[0] < W - 30 and 30 < xy(p)[1] < H - 30]
    if len(g) < 2:
        continue
    (xa, ya), (xb, yb) = xy(g[0]), xy(g[-1])
    if math.hypot(xb - xa, yb - ya) < 120:
        continue
    if dans_enceinte((xa + xb) / 2, (ya + yb) / 2):
        continue
    rot = math.degrees(math.atan2(yb - ya, xb - xa))
    if rot > 90: rot -= 180
    if rot < -90: rot += 180
    ajoute(libelle(nom, (xa + xb) / 2, (ya + yb) / 2 + 5, rot, "rue-lib"))
    nommees.add(nom)

# Mention obligatoire (ODbL)
ajoute(f'<text class="osm-lib" x="{W - 8}" y="{H - 8}" text-anchor="end">© contributeurs OpenStreetMap</text>')
ajoute("</g>")

svg = "".join(morceaux)
geo = {"nord": round(NORD, 6), "sud": round(SUD, 6), "ouest": round(OUEST, 6), "est": round(EST, 6)}
js = (
    "/* FABRIQUÉ par outils/plan/fond_plan.py : ne pas éditer à la main.\n"
    "   Fond du plan : Majestic Cinéma, Université de Yaoundé I. 1000 × 700 unités, nord en haut.\n"
    "   Données © contributeurs OpenStreetMap (ODbL). */\n"
    "window.App = window.App || {};\n"
    f"App.planFond = {json.dumps({'geo': geo, 'metresParUnite': round(METRES_PAR_UNITE, 4), 'svg': svg}, ensure_ascii=False)};\n"
)
SORTIE.write_text(js, encoding="utf-8", newline="\n")
print(f"{SORTIE.relative_to(RACINE)} : {len(js.encode('utf-8')) / 1024:.1f} Ko, "
      f"{len(batis)} bâtiments, {len(axes) + len(rues)} rues, {len(pelouses)} pelouses, {len(solaire)} rangées solaires")
print(f"1 unité = {METRES_PAR_UNITE:.3f} m ; geo = {geo}")
print(f"enceinte : {ex0:.0f},{ey0:.0f} -> {ex1:.0f},{ey1:.0f}")
for e in parkings + batis:
    x0, y0, x1, y1 = boite(e["geometry"])
    if x1 > ex0 and x0 < ex1 and y1 > ey0 and y0 < ey1:
        print(f"  dans l'enceinte : {'parking' if tag(e, 'amenity') else 'bâtiment'} {x0:.0f},{y0:.0f} -> {x1:.0f},{y1:.0f}")
