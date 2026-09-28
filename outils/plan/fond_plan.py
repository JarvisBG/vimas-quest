"""
Fond du plan du festival — Stade de Bonamoussadi, Douala (étape 4.13).

Dessine, dans le style des visuels (sol clair, voies blanches épaisses, encre
nuit), le fond SVG de plan.html à partir des données OpenStreetMap enregistrées
dans osm-bonamoussadi.json. Hors ligne, non déployé.

    python outils/plan/fond_plan.py

Écrit app/assets/js/plan-fond.js : App.planFond = { geo, metresParUnite, svg }.
Le plan fait 1000 × 700 unités, nord en haut. Les lieux du festival (table
`lieux`, colonnes x / y) se placent dans ces mêmes unités.

Données : © contributeurs OpenStreetMap, licence ODbL. La mention est dessinée
dans le plan (obligatoire). Ne PAS décalquer Google Maps : ses conditions
l'interdisent ; la vue satellite ne sert qu'à se repérer.

Rafraîchir les données (serveur Overpass, parfois saturé : réessayer) :
    curl "https://overpass-api.de/api/interpreter" --data-urlencode \
      'data=[out:json][timeout:60];(way(4.0928,9.7373,4.0963,9.7419);node(4.0928,9.7373,4.0963,9.7419)[name];);out tags geom;' \
      -o outils/plan/osm-bonamoussadi.json
"""
import json
import sys
import math
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent
SORTIE = RACINE / "app" / "assets" / "js" / "plan-fond.js"

# --- Cadre : centré sur le stade, écoles à l'est et lycée à l'ouest compris ---
W, H = 1000, 700
OUEST, EST = 9.73780, 9.74140
LAT_CENTRE = 4.09458
M_PAR_DEG_LAT = 110574
M_PAR_DEG_LON = 111320 * math.cos(math.radians(LAT_CENTRE))
METRES_PAR_UNITE = (EST - OUEST) * M_PAR_DEG_LON / W
DEMI_LAT = H * METRES_PAR_UNITE / M_PAR_DEG_LAT / 2
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


donnees = json.loads((ICI / "osm-bonamoussadi.json").read_text(encoding="utf-8"))
ways = [e for e in donnees["elements"] if e["type"] == "way" and e.get("geometry")]
par_id = {e["id"]: e for e in ways}
tag = lambda e, k: e.get("tags", {}).get(k)

STADE = par_id[900485476]      # leisure=sports_centre « Stade de Bonamoussadi »
TERRAIN = par_id[450614576]    # leisure=pitch
TRIBUNE = par_id[900485477]    # building=rafters : la tribune couverte, côté ouest

# Zones voisines, en pointillés comme les zones des visuels
ZONES = {
    457415574: ("Lycée de Bonamoussadi", "#1F3FD1"),
    900485478: ("Écoles publiques", "#1F3FD1"),
    900485481: ("École maternelle", "#1F3FD1"),
    450614579: ("Marché de Bonamoussadi", "#FFD23F"),
}

morceaux = []
ajoute = morceaux.append

# Sol, reliefs doux (comme les visuels) et découpe au cadre
ajoute(f'<defs><clipPath id="cadre-plan"><rect width="{W}" height="{H}"/></clipPath></defs>')
ajoute('<g clip-path="url(#cadre-plan)">')
ajoute(f'<rect width="{W}" height="{H}" fill="#E9EFD8"/>')

# Zones voisines
for i, (nom, couleur) in ZONES.items():
    e = par_id.get(i)
    if e and visible(e["geometry"]):
        ajoute(f'<polygon points="{pts(e["geometry"])}" fill="{couleur}" opacity=".10" '
               f'stroke="{couleur}" stroke-width="2" stroke-dasharray="8 6"/>')

# Bâtiments du quartier : blocs discrets
batis = []
for e in ways:
    if tag(e, "building") and e["id"] != TRIBUNE["id"] and visible(e["geometry"], 0):
        batis.append(pts(e["geometry"]))
ajoute('<g fill="#D5DCBE" stroke="#0A1440" stroke-width="1" stroke-opacity=".35">'
       + "".join(f'<polygon points="{p}"/>' for p in batis) + "</g>")

# Rues : blanches et épaisses, comme les allées des visuels
rues = [e for e in ways if tag(e, "highway") in ("residential", "tertiary", "secondary", "unclassified", "service")
        and visible(e["geometry"])]
ajoute('<g fill="none" stroke="#FAFAF7" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">'
       + "".join(f'<polyline points="{pts(e["geometry"])}"/>' for e in rues) + "</g>")
ajoute('<g fill="none" stroke="#C9CFB0" stroke-width="2" stroke-dasharray="6 8">'
       + "".join(f'<polyline points="{pts(e["geometry"])}"/>' for e in rues) + "</g>")

# Caniveaux : filets bleus
drains = [e for e in ways if tag(e, "waterway") and visible(e["geometry"])]
ajoute('<g fill="none" stroke="#8FB3FF" stroke-width="3" stroke-linecap="round">'
       + "".join(f'<polyline points="{pts(e["geometry"])}"/>' for e in drains) + "</g>")

# L'enceinte du stade : le site du festival
ajoute(f'<polygon points="{pts(STADE["geometry"])}" fill="#F4F1DF" stroke="#0A1440" stroke-width="4" stroke-linejoin="round"/>')

# Le terrain, aligné sur son rectangle OSM (grand axe nord-sud)
x0, y0, x1, y1 = boite(TERRAIN["geometry"])
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
u = 1 / METRES_PAR_UNITE                       # unités par mètre
larg_surface, prof_surface = 40.3 * u, 16.5 * u
larg_but, prof_but = 18.3 * u, 5.5 * u
ligne = 'fill="none" stroke="#FAFAF7" stroke-width="2.5"'
ajoute(f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{x1 - x0:.0f}" height="{y1 - y0:.0f}" fill="#2BB673" opacity=".55"/>')
bandes = "".join(f'<rect x="{x0:.0f}" y="{y0 + k * (y1 - y0) / 10:.0f}" width="{x1 - x0:.0f}" height="{(y1 - y0) / 10:.0f}"/>'
                 for k in range(0, 10, 2))
ajoute(f'<g fill="#2BB673" opacity=".25">{bandes}</g>')
ajoute(f'<g {ligne}>'
       f'<rect x="{x0 + 4:.0f}" y="{y0 + 4:.0f}" width="{x1 - x0 - 8:.0f}" height="{y1 - y0 - 8:.0f}"/>'
       f'<line x1="{x0 + 4:.0f}" y1="{cy:.0f}" x2="{x1 - 4:.0f}" y2="{cy:.0f}"/>'
       f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{9.15 * u:.0f}"/>'
       f'<rect x="{cx - larg_surface / 2:.0f}" y="{y0 + 4:.0f}" width="{larg_surface:.0f}" height="{prof_surface:.0f}"/>'
       f'<rect x="{cx - larg_surface / 2:.0f}" y="{y1 - 4 - prof_surface:.0f}" width="{larg_surface:.0f}" height="{prof_surface:.0f}"/>'
       f'<rect x="{cx - larg_but / 2:.0f}" y="{y0 + 4:.0f}" width="{larg_but:.0f}" height="{prof_but:.0f}"/>'
       f'<rect x="{cx - larg_but / 2:.0f}" y="{y1 - 4 - prof_but:.0f}" width="{larg_but:.0f}" height="{prof_but:.0f}"/>'
       '</g>')

# La tribune couverte : toit rayé, à l'encre
tx0, ty0, tx1, ty1 = boite(TRIBUNE["geometry"])
ajoute(f'<polygon points="{pts(TRIBUNE["geometry"])}" fill="#FAFAF7" stroke="#0A1440" stroke-width="3"/>')
rayures = "".join(f'<line x1="{tx0:.0f}" y1="{y:.0f}" x2="{tx1:.0f}" y2="{y:.0f}"/>'
                  for y in range(int(ty0) + 10, int(ty1), 12))
ajoute(f'<g stroke="#0A1440" stroke-width="1.5" opacity=".35">{rayures}</g>')

# Libellés
def libelle(texte, x, y, rot=0, classe="zone-lib"):
    t = f' transform="rotate({rot} {x:.0f} {y:.0f})"' if rot else ""
    return f'<text class="{classe}" x="{x:.0f}" y="{y:.0f}" text-anchor="middle"{t}>{texte}</text>'

for i, (nom, _) in ZONES.items():
    e = par_id.get(i)
    if e and visible(e["geometry"]):
        bx0, by0, bx1, by1 = boite(e["geometry"])
        x = min(max((bx0 + bx1) / 2, 90), W - 90)
        y = min(max((by0 + by1) / 2, 30), H - 20)
        ajoute(libelle(nom, x, y))
ajoute(libelle("Tribune", (tx0 + tx1) / 2, (ty0 + ty1) / 2, -90))
sx0, sy0, sx1, sy1 = boite(STADE["geometry"])
ajoute(libelle("Stade de Bonamoussadi", (sx0 + sx1) / 2, sy0 - 10, 0, "zone-lib zone-lib--fort"))
for e in rues:
    if tag(e, "name"):
        g = e["geometry"]
        (xa, ya), (xb, yb) = xy(g[0]), xy(g[-1])
        rot = math.degrees(math.atan2(yb - ya, xb - xa))
        if rot > 90: rot -= 180
        if rot < -90: rot += 180
        xm, ym = (xa + xb) / 2, (ya + yb) / 2
        if 0 < xm < W and 0 < ym < H:
            ajoute(libelle(tag(e, "name"), xm, ym + 5, rot, "rue-lib"))

# Mention obligatoire (ODbL)
ajoute(f'<text class="osm-lib" x="{W - 8}" y="{H - 8}" text-anchor="end">© contributeurs OpenStreetMap</text>')
ajoute("</g>")

svg = "".join(morceaux)
geo = {"nord": round(NORD, 6), "sud": round(SUD, 6), "ouest": OUEST, "est": EST}
js = (
    "/* FABRIQUÉ par outils/plan/fond_plan.py : ne pas éditer à la main.\n"
    "   Fond du plan : Stade de Bonamoussadi, Douala. 1000 × 700 unités, nord en haut.\n"
    "   Données © contributeurs OpenStreetMap (ODbL). */\n"
    "window.App = window.App || {};\n"
    f"App.planFond = {json.dumps({'geo': geo, 'metresParUnite': round(METRES_PAR_UNITE, 4), 'svg': svg}, ensure_ascii=False)};\n"
)
SORTIE.write_text(js, encoding="utf-8", newline="\n")
print(f"{SORTIE.relative_to(RACINE)} : {len(js.encode('utf-8')) / 1024:.1f} Ko, "
      f"{len(batis)} bâtiments, {len(rues)} rues, {len(drains)} caniveaux")
print(f"1 unité = {METRES_PAR_UNITE:.3f} m ; geo = {geo}")
print(f"terrain : {x0:.0f},{y0:.0f} -> {x1:.0f},{y1:.0f} ; tribune : {tx0:.0f},{ty0:.0f} -> {tx1:.0f},{ty1:.0f} ; "
      f"enceinte : {sx0:.0f},{sy0:.0f} -> {sx1:.0f},{sy1:.0f}")
