/* ==========================================================================
   Vimas Quest — console-etiquettes.js : étiquettes QR à imprimer (étape 6.3)
   Décision de Jarvis (19/09) : habillage des joueurs, sérigraphie deux
   encres — papier blanc (rien à imprimer), encre « nuit » pour le QR et les
   textes, une seule encre de couleur par type (bande du haut, décalage du
   nom). Le QR reste nuit sur blanc : contraste maximal, lisible de loin.
   La planche est un DOCUMENT AUTONOME (A4, millimètres, police Anton du
   site) montré dans un cadre : l'aperçu est ce qui sort de l'imprimante.
   Le QR encode l'adresse du jeu (App.racine) : depuis un poste d'essai
   (localhost, domaine .example), chaque étiquette porte « ESSAI » en
   travers — du papier ne se corrige pas.
   Nécessite vendor/qrcode-generator.min.js (App.qrSvg).
   ========================================================================== */
(function () {
  "use strict";
  const App = window.App;
  if (!App) return;
  const esc = App.esc;

  const ENCRES = { nuit: "#0A1440", sodium: "#FFD23F", bleu: "#1F3FD1", rose: "#FF5FA2", vert: "#2BB673" };
  /* Mêmes noms que typesQR (mock.js) ; l'encre de couleur de chaque type */
  const TYPES = {
    scene: { nom: "Scène", encre: "sodium" },
    stand: { nom: "Stand", encre: "bleu" },
    foodtruck: { nom: "Food-truck", encre: "vert" },
    relique: { nom: "Relique", encre: "rose" },
    dedicace: { nom: "Dédicace", encre: "rose" },
    surprise: { nom: "Événement", encre: "nuit" },
    service: { nom: "Service", encre: "bleu" }
  };
  const ETOILES = { commune: "★", rare: "★★", legendaire: "★★★" };
  /* Colonnes × lignes par page A4 et unité de dessin (mm) */
  const FORMATS = {
    6: { cols: 2, rangs: 3, u: 1 },
    12: { cols: 3, rangs: 4, u: 0.68 },
    1: { cols: 1, rangs: 1, u: 2.3 }
  };

  const E = {};
  App.etiquettes = E;
  E.TYPES = TYPES;

  E.adresse = (code) => new URL(`scanner.html?code=${encodeURIComponent(code)}`, App.racine).href;
  /* Poste d'essai : l'adresse encodée ne mènerait pas au vrai jeu */
  E.essai = () => {
    const h = location.hostname;
    return location.protocol === "file:" || !h || h === "localhost" || /^127\./.test(h) || h === "[::1]" || /\.example$/.test(h);
  };
  E.site = () => new URL(App.racine).host;

  function etiquette(q, essai) {
    const t = TYPES[q.type] || { nom: q.type, encre: "nuit" };
    const couleur = ENCRES[t.encre];
    const texteBande = t.encre === "nuit" || t.encre === "bleu" ? "#FFFFFF" : ENCRES.nuit;
    const type = t.nom + (q.type === "relique" && ETOILES[q.rarete] ? ` ${ETOILES[q.rarete]}` : "");
    const qr = App.qrSvg(E.adresse(q.code), { niveau: "Q", marge: 3, encre: ENCRES.nuit, fond: "#FFFFFF", titre: q.code });
    return `<div class="etq" style="--encre:${couleur};--sur-encre:${texteBande}">
      <div class="etq__bande"><span class="etq__marque">DOMAF QUEST</span><span class="etq__type">${esc(type)}</span></div>
      <div class="etq__qr">${qr}</div>
      <div class="etq__nom">${esc(q.nom)}</div>
      <div class="etq__pied"><span>Scanne avec l'appareil photo</span><span class="etq__code">${esc(q.code)}</span></div>
      ${essai ? '<div class="etq__essai">ESSAI — NE PAS COLLER</div>' : ""}
    </div>`;
  }

  /* Le document complet, prêt à imprimer */
  E.document = (liste, format = 6) => {
    const f = FORMATS[format] || FORMATS[6];
    const parPage = f.cols * f.rangs;
    const essai = E.essai();
    const pages = [];
    for (let i = 0; i < liste.length; i += parPage) {
      pages.push(`<section class="page">${liste.slice(i, i + parPage).map((q) => etiquette(q, essai)).join("")}</section>`);
    }
    const police = new URL("assets/fonts/Anton-Regular.woff2", App.racine).href;
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes Vimas Quest</title><style>
@font-face { font-family: "Anton"; src: url("${police}") format("woff2"); font-display: block; }
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #FFFFFF; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: ${ENCRES.nuit};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; --u: ${f.u}mm; }
.page { width: 210mm; height: 297mm; padding: 10mm; display: grid; overflow: hidden;
  grid-template-columns: repeat(${f.cols}, 1fr); grid-template-rows: repeat(${f.rangs}, 1fr);
  break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.etq { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  gap: calc(var(--u) * 2); padding: calc(var(--u) * 3.5) calc(var(--u) * 4);
  outline: 0.2mm dashed #B8BCC8; outline-offset: -0.1mm; text-align: center; }
.etq__bande { align-self: stretch; display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 2);
  padding: calc(var(--u) * 1.4) calc(var(--u) * 2.5); background: var(--encre); color: var(--sur-encre);
  font-family: "Anton", Impact, sans-serif; letter-spacing: .04em; line-height: 1.1; }
.etq__marque { font-size: calc(var(--u) * 4.6); }
.etq__type { font-size: calc(var(--u) * 3.6); text-transform: uppercase; }
.etq__qr { flex: none; width: calc(var(--u) * 50); height: calc(var(--u) * 50); }
.etq__qr svg { width: 100%; height: 100%; display: block; }
.etq__nom { font-family: "Anton", Impact, sans-serif; font-size: calc(var(--u) * 6.2); line-height: 1.05; text-transform: uppercase;
  letter-spacing: .01em; text-shadow: calc(var(--u) * .45) calc(var(--u) * .3) 0 var(--encre); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.etq__pied { align-self: stretch; display: flex; justify-content: space-between; align-items: baseline; gap: calc(var(--u) * 2);
  border-top: calc(var(--u) * .35) solid ${ENCRES.nuit}; padding-top: calc(var(--u) * 1.4);
  font-size: calc(var(--u) * 2.9); font-weight: 600; }
.etq__code { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: calc(var(--u) * 3.4); font-weight: 700; letter-spacing: .06em; }
.etq__essai { position: absolute; left: -20%; right: -20%; top: 44%; transform: rotate(-28deg); padding: calc(var(--u) * 1.5) 0;
  background: rgba(226, 59, 59, .85); color: #FFFFFF; font-family: "Anton", Impact, sans-serif; font-size: calc(var(--u) * 5); letter-spacing: .08em; }
@media screen {
  html, body { background: #8A8F9C; }
  body { padding: 16px; display: grid; gap: 16px; justify-content: center; }
  .page { background: #FFFFFF; box-shadow: 0 6px 24px rgba(0, 0, 0, .35); }
}
</style></head><body>${pages.join("") || '<p style="padding:24px">Aucun QR à imprimer.</p>'}</body></html>`;
  };

  /* Charge le document dans le cadre et attend la police (sinon le 1er
     aperçu, et surtout l'impression, partiraient en police de secours). */
  E.afficher = (cadre, html) => new Promise((resoudre) => {
    cadre.onload = async () => {
      try { await cadre.contentDocument.fonts.ready; } catch (e) { /* ancien navigateur : tant pis */ }
      resoudre();
    };
    cadre.srcdoc = html;
  });
})();
