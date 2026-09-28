/* ==========================================================================
   Page 14 — Passeport partageable
   L'image est dessinée en Canvas 2D (aucune librairie) : l'aperçu = le fichier partagé.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, $$, esc, fmt, api } = App;

  const canvas = $("[data-canvas]");
  const ctx = canvas.getContext("2d");
  const cadre = $("[data-cadre]");
  const CLE_PREFS = "domafquest.passeport";

  const COULEURS = {
    bleu: "#D90A22", nuit: "#3B0A12", sodium: "#FFC72C", rose: "#F9A209",
    vert: "#1FA05A", papier: "#FFF8EE", papier2: "#FCEBD8", doux: "#6E3A30"
  };
  const THEMES = {
    bleu:   { fond: COULEURS.bleu,   texte: COULEURS.papier, titre: COULEURS.sodium, decalage: COULEURS.rose,   rayons: "rgba(255,199,44,.13)" },
    nuit:   { fond: COULEURS.nuit,   texte: COULEURS.papier, titre: COULEURS.sodium, decalage: COULEURS.rose,   rayons: "rgba(249,162,9,.12)" },
    sodium: { fond: COULEURS.sodium, texte: COULEURS.nuit,   titre: COULEURS.bleu,   decalage: COULEURS.rose,   rayons: "rgba(217,10,34,.10)" },
    rose:   { fond: COULEURS.rose,   texte: COULEURS.nuit,   titre: COULEURS.nuit,   decalage: COULEURS.sodium, rayons: "rgba(59,10,18,.08)" }
  };
  const RARETE = {
    commun: [COULEURS.bleu, COULEURS.papier], rare: [COULEURS.vert, COULEURS.nuit],
    epique: [COULEURS.rose, COULEURS.nuit], legendaire: [COULEURS.sodium, COULEURS.nuit]
  };
  const AFFICHE = "Anton, Impact, 'Arial Narrow', sans-serif";
  const TEXTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

  /* ---------- Préférences ---------- */
  const prefs = { format: "story", theme: "bleu", place: true, artistes: true, qr: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(CLE_PREFS)) || {}); } catch (e) { /* défaut */ }
  $(`input[name=format][value=${prefs.format}]`).checked = true;
  $(`input[name=theme][value=${prefs.theme}]`).checked = true;
  ["place", "artistes", "qr"].forEach((k) => ($(`input[name=${k}]`).checked = prefs[k]));

  /* ---------- Données ---------- */
  let d;
  try {
    d = await api.passeport();
    if (!d) { window.location.replace("inscription.html"); return; }
  } catch (e) {
    App.toast("Impossible de préparer ton passeport. Vérifie ta connexion.");
    return;
  }
  // La police doit être prête avant de dessiner, sinon le canvas utilise la police de secours
  try { await Promise.all([document.fonts.load("100px Anton"), document.fonts.ready]); } catch (e) { /* secours */ }

  /* ======================================================================
     Outils de dessin
     ====================================================================== */
  const police = (taille, famille = AFFICHE, graisse = 400) => `${graisse} ${taille}px ${famille}`;

  function rectArrondi(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  }

  /* Réduit la taille jusqu'à ce que le texte tienne dans la largeur */
  function ajuster(texte, largeur, taille, mini, famille = AFFICHE, graisse = 400) {
    let t = taille;
    ctx.font = police(t, famille, graisse);
    while (ctx.measureText(texte).width > largeur && t > mini) {
      t -= 2;
      ctx.font = police(t, famille, graisse);
    }
    return t;
  }

  function tronquer(texte, largeur) {
    if (ctx.measureText(texte).width <= largeur) return texte;
    let t = texte;
    while (t.length > 1 && ctx.measureText(t + "…").width > largeur) t = t.slice(0, -1);
    return t.trimEnd() + "…";
  }

  function texteDecale(texte, x, y, couleur, decalage, taille) {
    const o = Math.round(taille * 0.05);
    ctx.fillStyle = decalage;
    ctx.fillText(texte, x + o, y + o * 0.7);
    ctx.fillStyle = couleur;
    ctx.fillText(texte, x, y);
  }

  /* Découpe un texte en lignes (mots séparés par « / ») */
  function lignes(elements, largeur, max) {
    const res = [];
    let courant = "";
    elements.forEach((el) => {
      const essai = courant ? `${courant} / ${el}` : el;
      if (ctx.measureText(essai).width <= largeur || !courant) courant = essai;
      else { res.push(courant); courant = el; }
    });
    if (courant) res.push(courant);
    if (res.length > max) {
      const reste = res.slice(max - 1).join(" / ");
      res.length = max - 1;
      res.push(tronquer(reste, largeur));
    }
    return res;
  }

  /* Icônes : on réutilise le SVG de app.js via Path2D */
  const cacheIcones = {};
  function cheminsIcone(nom) {
    if (cacheIcones[nom]) return cacheIcones[nom];
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${App.iconeBrute(nom)}</svg>`, "image/svg+xml");
    const chemins = [];
    doc.documentElement.childNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      const a = (k) => Number(n.getAttribute(k) || 0);
      if (n.tagName === "path") chemins.push(new Path2D(n.getAttribute("d")));
      else if (n.tagName === "circle") { const p = new Path2D(); p.arc(a("cx"), a("cy"), a("r"), 0, Math.PI * 2); chemins.push(p); }
      else if (n.tagName === "rect") {
        const p = new Path2D();
        if (p.roundRect) p.roundRect(a("x"), a("y"), a("width"), a("height"), a("rx")); else p.rect(a("x"), a("y"), a("width"), a("height"));
        chemins.push(p);
      }
    });
    return (cacheIcones[nom] = chemins);
  }

  function icone(nom, x, y, taille, couleur, epaisseur = 2.2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(taille / 24, taille / 24);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epaisseur;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    cheminsIcone(nom).forEach((p) => ctx.stroke(p));
    ctx.restore();
  }

  /* Rayons de lumière en fond */
  function rayons(w, h, cx, cy, couleur) {
    ctx.save();
    ctx.fillStyle = couleur;
    const n = 36, r = Math.hypot(w, h);
    for (let i = 0; i < n; i += 2) {
      const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
      ctx.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* Carte « billet » avec encoches réellement découpées */
  function billet(x, y, w, h, encocheY) {
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const c = off.getContext("2d");
    c.fillStyle = COULEURS.papier;
    rectArrondi(c, 0, 0, w, h, 34);
    c.fill();
    c.globalCompositeOperation = "destination-out";
    [0, w].forEach((cx) => { c.beginPath(); c.arc(cx, encocheY, 34, 0, Math.PI * 2); c.fill(); });
    // ombre « encre » décalée
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.drawImage(tinte(off, COULEURS.nuit), x + 14, y + 14);
    ctx.drawImage(off, x, y);
    ctx.restore();
    // pointillés
    ctx.save();
    ctx.strokeStyle = "rgba(59,10,18,.35)";
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(x + 56, y + encocheY);
    ctx.lineTo(x + w - 56, y + encocheY);
    ctx.stroke();
    ctx.restore();
  }
  function tinte(source, couleur) {
    const c = document.createElement("canvas");
    c.width = source.width; c.height = source.height;
    const x = c.getContext("2d");
    x.drawImage(source, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = couleur;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* Pochette (avatar) : reprend les motifs CSS de style.css */
  function pochette(x, y, t, av, initiale, rotation = -0.05) {
    const fond = COULEURS[av.fond] || COULEURS.bleu;
    const encre = COULEURS[av.encre] || COULEURS.sodium;
    ctx.save();
    ctx.translate(x + t / 2, y + t / 2);
    ctx.rotate(rotation);
    ctx.translate(-t / 2, -t / 2);
    ctx.fillStyle = COULEURS.rose;
    ctx.fillRect(t * 0.05, t * 0.05, t, t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, t, t);
    ctx.clip();
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, t, t);
    ctx.fillStyle = encre;
    ctx.strokeStyle = encre;
    const m = av.motif;
    if (m === "rayures") {
      ctx.lineWidth = t * 0.085;
      for (let i = -t; i < t * 2; i += t * 0.24) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + t, t); ctx.stroke(); }
    } else if (m === "ondes") {
      ctx.lineWidth = t * 0.06;
      for (let r = t * 0.1; r < t * 1.5; r += t * 0.13) { ctx.beginPath(); ctx.arc(t / 2, t * 1.1, r, 0, Math.PI * 2); ctx.stroke(); }
    } else if (m === "vinyle") {
      ctx.beginPath(); ctx.arc(t * 0.6, t * 0.4, t * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = fond; ctx.lineWidth = t * 0.02;
      [0.17, 0.22, 0.3].forEach((r) => { ctx.beginPath(); ctx.arc(t * 0.6, t * 0.4, t * r, 0, Math.PI * 2); ctx.stroke(); });
      ctx.fillStyle = COULEURS.papier; ctx.beginPath(); ctx.arc(t * 0.6, t * 0.4, t * 0.06, 0, Math.PI * 2); ctx.fill();
    } else if (m === "damier") {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * t / 4, j * t / 4, t / 8, t / 8), ctx.fillRect(i * t / 4 + t / 8, j * t / 4 + t / 8, t / 8, t / 8);
    } else if (m === "demi") {
      ctx.beginPath(); ctx.arc(t * 0.7, t * 0.35, t * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(0, t * 0.7, t, t * 0.03);
    } else if (m === "soleil") {
      for (let k = 0; k < 30; k += 2) {
        const a1 = (k / 30) * Math.PI * 2, a2 = ((k + 1) / 30) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(t * 0.7, t * 0.3);
        ctx.lineTo(t * 0.7 + Math.cos(a1) * t * 2, t * 0.3 + Math.sin(a1) * t * 2);
        ctx.lineTo(t * 0.7 + Math.cos(a2) * t * 2, t * 0.3 + Math.sin(a2) * t * 2);
        ctx.fill();
      }
    } else if (m === "points") {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc((i + 0.5) * t / 4, (j + 0.5) * t / 4, t * 0.0375, 0, Math.PI * 2); ctx.fill(); }
    } else if (m === "grille") {
      for (let i = 0; i < 4; i++) { ctx.fillRect(i * t / 4, 0, t * 0.02, t); ctx.fillRect(0, i * t / 4, t, t * 0.02); }
    }
    ctx.restore();
    ctx.lineWidth = Math.max(4, t * 0.02);
    ctx.strokeStyle = COULEURS.nuit;
    ctx.strokeRect(0, 0, t, t);
    // étiquette de l'initiale
    const e = t * 0.34;
    ctx.fillStyle = COULEURS.papier;
    ctx.fillRect(t * 0.06, t - e - t * 0.06, e, e);
    ctx.lineWidth = 3;
    ctx.strokeRect(t * 0.06, t - e - t * 0.06, e, e);
    ctx.fillStyle = COULEURS.nuit;
    ctx.font = police(Math.round(e * 0.8));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initiale, t * 0.06 + e / 2, t - e / 2 - t * 0.06 + e * 0.04);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function tampon(texte, x, y, taille, couleur) {
    ctx.save();
    ctx.font = police(taille);
    const w = ctx.measureText(texte.toUpperCase()).width + taille * 0.8;
    const h = taille * 1.45;
    ctx.translate(x, y);
    ctx.rotate(-0.07);
    ctx.fillStyle = COULEURS.papier;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = Math.max(4, taille * 0.09);
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = couleur;
    ctx.textBaseline = "middle";
    ctx.fillText(texte.toUpperCase(), taille * 0.4, h / 2 + taille * 0.04);
    ctx.restore();
  }

  function autocollant(x, y, t, badge) {
    const [fond, encre] = RARETE[badge.rarete] || RARETE.commun;
    ctx.save();
    ctx.fillStyle = COULEURS.nuit;
    ctx.beginPath(); ctx.arc(x + t / 2 + 6, y + t / 2 + 6, t / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, t / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fond;
    ctx.beginPath(); ctx.arc(x + t / 2, y + t / 2, t * 0.43, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    icone(badge.icone, x + t * 0.29, y + t * 0.29, t * 0.42, encre, 2.4);
  }

  function qr(texte, x, y, t) {
    if (typeof window.qrcode !== "function") return;
    const q = window.qrcode(0, "M");
    q.addData(texte);
    q.make();
    const n = q.getModuleCount();
    const marge = t * 0.06;
    const m = (t - marge * 2) / n;
    ctx.fillStyle = "#fff";
    rectArrondi(ctx, x, y, t, t, 14);
    ctx.fill();
    ctx.fillStyle = COULEURS.nuit;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (q.isDark(r, c)) ctx.fillRect(Math.floor(x + marge + c * m), Math.floor(y + marge + r * m), Math.ceil(m), Math.ceil(m));
    }
  }

  function egaliseur(x, y, w, h, n, couleur) {
    const pas = w / n;
    ctx.fillStyle = couleur;
    for (let i = 0; i < n; i++) {
      const hh = h * (0.25 + Math.abs(Math.sin(i * 1.7)) * 0.75);
      ctx.fillRect(x + i * pas, y + h - hh, pas * 0.62, hh);
    }
  }

  function vumetre(x, y, w, h, progression) {
    const n = 24, pas = w / n, pleines = Math.round(progression * n);
    for (let i = 0; i < n; i++) {
      const hh = h * (0.3 + (i / (n - 1)) * 0.7);
      ctx.fillStyle = i < pleines ? (i >= n - 5 ? COULEURS.rose : COULEURS.bleu) : COULEURS.papier2;
      ctx.fillRect(x + i * pas, y + h - hh, pas * 0.72, hh);
    }
  }

  function statistique(x, y, w, valeur, libelle, tailleValeur) {
    ctx.fillStyle = COULEURS.nuit;
    ajuster(valeur, w - 10, tailleValeur, tailleValeur * 0.5);
    ctx.fillText(valeur, x, y);
    ctx.fillStyle = COULEURS.doux;
    ctx.font = police(Math.round(tailleValeur * 0.34), TEXTE, 800);
    ctx.fillText(libelle.toUpperCase(), x, y + tailleValeur * 0.5);
  }

  /* ======================================================================
     Contenu calculé
     ====================================================================== */
  /* En base, les missions se refont chaque jour : pas de total (« 12 » et non « 12/10 ») */
  const missionsCourt = () => d.missions.total == null
    ? fmt.nombre(d.missions.terminees) : `${d.missions.terminees}/${d.missions.total}`;

  function contenu() {
    const stats = [
      [fmt.nombre(d.joueur.xp), "XP"],
      prefs.place ? [`${fmt.nombre(d.place)}e`, `sur ${fmt.nombre(d.totalJoueurs)}`] : [missionsCourt(), "Missions"],
      [`${d.badges.liste.length}/${d.badges.total}`, "Badges"],
      prefs.artistes ? [`${d.artistes.liste.length}/${d.artistes.total}`, "Artistes vus"] : [`${d.stands.nombre}/${d.stands.total}`, "Stands"]
    ];
    const noms = d.artistes.liste.map((a) => a.nom.toUpperCase());
    return { stats, noms, initiale: (d.joueur.pseudo[0] || "?").toUpperCase() };
  }

  /* ======================================================================
     Mise en page « Story » 1080 × 1920
     ====================================================================== */
  function dessinerStory(th) {
    const W = 1080, H = 1920, M = 80;
    const { stats, noms, initiale } = contenu();
    ctx.fillStyle = th.fond;
    ctx.fillRect(0, 0, W, H);
    rayons(W, H, W / 2, 1180, th.rayons);

    // En-tête (0 → 340)
    ajuster("DOMAF QUEST", W - M * 2, 190, 120);
    texteDecale("DOMAF QUEST", M, 250, th.titre, th.decalage, 190);
    ctx.font = police(38, TEXTE, 800);
    ctx.fillStyle = th.texte;
    ctx.fillText(`PASSEPORT JOUEUR, ÉDITION ${d.festival.edition}`, M, 318);

    // Billet (380 → 1540), encoche à 1000
    const bx = M - 10, by = 380, bw = W - (M - 10) * 2, bh = 1160, encoche = 620;
    billet(bx, by, bw, bh, encoche);
    const gx = bx + 60, gw = bw - 120;

    // Identité
    pochette(gx, by + 60, 300, d.avatar, initiale);
    const px = gx + 360, pw = bw - 60 - 360 - 50;
    ctx.fillStyle = COULEURS.nuit;
    const tp = ajuster(d.joueur.pseudo.toUpperCase(), pw, 110, 54);
    ctx.fillText(d.joueur.pseudo.toUpperCase(), px, by + 160);
    tampon(d.rang.actuel.nom, px + 4, by + 160 + tp * 0.3, 54, COULEURS.bleu);
    ctx.font = police(32, TEXTE, 700);
    ctx.fillStyle = COULEURS.doux;
    ctx.fillText(`Présent ${d.jours.presents} jour${d.jours.presents > 1 ? "s" : ""} sur ${d.jours.total}`, px, by + 340);

    // Niveau
    vumetre(gx, by + 410, gw, 80, d.rang.progression);
    ctx.font = police(32, TEXTE, 800);
    ctx.fillStyle = COULEURS.nuit;
    ctx.fillText(d.rang.suivant ? `Prochain rang : ${d.rang.suivant.nom}` : "Rang maximum atteint", gx, by + 545);

    // Statistiques 2 × 2
    const colW = gw / 2;
    stats.forEach(([v, l], i) => {
      statistique(gx + (i % 2) * colW, by + 760 + Math.floor(i / 2) * 175, colW, v, l, 104);
    });

    // Badges (les plus rares d'abord)
    const liste = d.badges.liste.slice(0, 5);
    liste.forEach((b, i) => autocollant(gx + i * 185, by + 1000, 132, b));
    if (!liste.length) {
      ctx.font = police(34, TEXTE, 600);
      ctx.fillStyle = COULEURS.doux;
      ctx.fillText("Premier badge en vue…", gx, by + 1080);
    }

    // Pied (1580 → 1920) : artistes vus ou infos du festival, QR d'invitation
    const largeurTexte = prefs.qr ? W - M * 2 - 290 : W - M * 2;
    if (prefs.artistes && noms.length) {
      ctx.font = police(30, TEXTE, 800);
      ctx.fillStyle = th.texte;
      ctx.fillText("J'AI VU", M, 1620);
      ctx.font = police(62);
      lignes(noms, largeurTexte, 3).forEach((l, i) => {
        ctx.fillStyle = i % 2 ? th.titre : th.texte;
        ctx.fillText(l, M, 1695 + i * 70);
      });
    } else {
      const dates = d.festival.dates.toUpperCase().replace(/(\d+), (\d+) ET (\d+)/, "$1 AU $3");
      ajuster(dates, largeurTexte, 66, 40);
      ctx.fillStyle = th.texte;
      ctx.fillText(dates, M, 1690);
      ajuster(d.festival.lieu.toUpperCase(), largeurTexte, 66, 40);
      ctx.fillStyle = th.titre;
      ctx.fillText(d.festival.lieu.toUpperCase(), M, 1770);
    }
    if (prefs.qr) {
      qr(d.lienInvitation, W - M - 240, 1585, 240);
      ctx.font = police(26, TEXTE, 800);
      ctx.fillStyle = th.texte;
      ctx.textAlign = "center";
      ctx.fillText("JOUE AVEC MOI", W - M - 120, 1856);
      ctx.textAlign = "left";
    }
    egaliseur(0, H - 44, W, 44, 54, th.titre);
  }

  /* ======================================================================
     Mise en page « Carré » 1080 × 1080
     ====================================================================== */
  function dessinerCarre(th) {
    const W = 1080, H = 1080, M = 60;
    const { stats, noms, initiale } = contenu();
    ctx.fillStyle = th.fond;
    ctx.fillRect(0, 0, W, H);
    rayons(W, H, W / 2, 620, th.rayons);

    ajuster("DOMAF QUEST", 640, 130, 80);
    texteDecale("DOMAF QUEST", M, 160, th.titre, th.decalage, 130);
    ctx.font = police(30, TEXTE, 800);
    ctx.fillStyle = th.texte;
    ctx.textAlign = "right";
    ctx.fillText("PASSEPORT JOUEUR", W - M, 104);
    ctx.fillText(`ÉDITION ${d.festival.edition}`, W - M, 146);
    ctx.textAlign = "left";

    const bx = M, by = 220, bw = W - M * 2, bh = 780, encoche = 540;
    billet(bx, by, bw, bh, encoche);

    pochette(bx + 50, by + 50, 230, d.avatar, initiale);
    const px = bx + 330, pw = bw - 330 - 40;
    ctx.fillStyle = COULEURS.nuit;
    const tp = ajuster(d.joueur.pseudo.toUpperCase(), pw, 96, 46);
    ctx.fillText(d.joueur.pseudo.toUpperCase(), px, by + 130);
    tampon(d.rang.actuel.nom, px + 4, by + 130 + tp * 0.3, 44, COULEURS.bleu);
    vumetre(px, by + 230, pw, 50, d.rang.progression);

    const colW = (bw - 100) / 4;
    stats.forEach(([v, l], i) => statistique(bx + 50 + i * colW, by + 410, colW, v, l, 76));

    if (prefs.artistes && noms.length) {
      ctx.font = police(38);
      ctx.fillStyle = COULEURS.bleu;
      ctx.fillText(tronquer(`J'AI VU ${noms.join(" / ")}`, bw - 100), bx + 50, by + 500);
    }

    const liste = d.badges.liste.slice(0, prefs.qr ? 4 : 6);
    liste.forEach((b, i) => autocollant(bx + 50 + i * 140, by + encoche + 55, 112, b));
    if (!liste.length) {
      ctx.font = police(30, TEXTE, 600);
      ctx.fillStyle = COULEURS.doux;
      ctx.fillText("Premier badge en vue…", bx + 50, by + encoche + 120);
    }
    ctx.font = police(26, TEXTE, 800);
    ctx.fillStyle = COULEURS.doux;
    ctx.fillText("MES BADGES", bx + 50, by + encoche + 215);

    if (prefs.qr) {
      qr(d.lienInvitation, bx + bw - 50 - 190, by + encoche + 30, 190);
    }
    egaliseur(0, H - 44, W, 44, 60, th.titre);
  }

  /* ======================================================================
     Rendu
     ====================================================================== */
  function rendre() {
    const th = THEMES[prefs.theme] || THEMES.bleu;
    const story = prefs.format === "story";
    canvas.width = 1080;
    canvas.height = story ? 1920 : 1080;
    cadre.dataset.format = prefs.format;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      story ? dessinerStory(th) : dessinerCarre(th);
    } catch (e) {
      console.error(e);
      App.toast("L'aperçu n'a pas pu être dessiné.");
    }
    $("[data-chargement]").hidden = true;
    cadre.classList.remove("is-rendu"); void cadre.offsetWidth; cadre.classList.add("is-rendu");
    canvas.setAttribute("aria-label",
      `Passeport de ${d.joueur.pseudo}, rang ${d.rang.actuel.nom}, ${fmt.nombre(d.joueur.xp)} XP, ` +
      `${d.badges.liste.length} badges${prefs.place ? `, ${d.place}e au classement` : ""}` +
      `${prefs.artistes && d.artistes.liste.length ? `, artistes vus : ${d.artistes.liste.map((a) => a.nom).join(", ")}` : ""}.`);
    try { localStorage.setItem(CLE_PREFS, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  $(".reglages-p").addEventListener("change", (e) => {
    const el = e.target;
    if (el.name === "format" || el.name === "theme") prefs[el.name] = el.value;
    else if (el.type === "checkbox") prefs[el.name] = el.checked;
    else return;
    rendre();
  });

  /* ---------- Résumé textuel (accessibilité) ---------- */
  const r = [
    ["Rang", d.rang.actuel.nom],
    ["XP", fmt.nombre(d.joueur.xp)],
    ["Classement général", `${fmt.nombre(d.place)}e sur ${fmt.nombre(d.totalJoueurs)}`],
    ["Badges", `${d.badges.liste.length} sur ${d.badges.total}${d.badges.liste.length ? ` (${d.badges.liste.slice(0, 3).map((b) => b.nom).join(", ")}…)` : ""}`],
    ["Artistes vus", d.artistes.liste.length ? d.artistes.liste.map((a) => a.nom + (a.dedicace ? " (dédicace)" : "")).join(", ") : "Aucun pour l'instant"],
    ["Stands tamponnés", `${d.stands.nombre} sur ${d.stands.total}`],
    ["Missions terminées", d.missions.total == null ? fmt.nombre(d.missions.terminees) : `${d.missions.terminees} sur ${d.missions.total}`],
    ["Jours de festival", `${d.jours.presents} sur ${d.jours.total}`]
  ];
  $("[data-resume]").innerHTML = r.map(([k, v]) => `<li><span>${esc(k)}</span><strong>${esc(v)}</strong></li>`).join("");

  /* ======================================================================
     Export et partage
     ====================================================================== */
  const nomFichier = () => `passeport-domafquest-${d.joueur.pseudo.normalize("NFD").replace(/[^\w-]/g, "").toLowerCase()}-${prefs.format}.png`;
  const versBlob = () => new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("Export impossible"))), "image/png"));

  async function telecharger(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomFichier();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  $("[data-partager]").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.setAttribute("aria-busy", "true");
    try {
      const blob = await versBlob();
      const fichier = new File([blob], nomFichier(), { type: "image/png" });
      const texte = `Mon passeport Vimas Quest : ${d.rang.actuel.nom}, ${fmt.nombre(d.joueur.xp)} XP. Viens jouer avec moi !`;
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: "Mon passeport Vimas Quest", text: `${texte} ${d.lienInvitation}` });
      } else if (navigator.share) {
        await navigator.share({ title: "Mon passeport Vimas Quest", text: texte, url: d.lienPublic });
        await telecharger(blob);
      } else {
        await telecharger(blob);
        App.toast("Image enregistrée. Publie-la depuis ta galerie.");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        App.toast("Le partage n'a pas fonctionné. Enregistre l'image à la place.");
      }
    } finally {
      b.removeAttribute("aria-busy");
    }
  });

  $("[data-telecharger]").addEventListener("click", async () => {
    try {
      await telecharger(await versBlob());
      App.toast("Image enregistrée.");
    } catch (e) {
      App.toast("Impossible d'enregistrer l'image.");
    }
  });

  $("[data-copier]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(d.lienPublic);
    } catch (e) {
      const zone = document.createElement("textarea");
      zone.value = d.lienPublic;
      zone.setAttribute("readonly", "");
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.append(zone);
      zone.select();
      document.execCommand("copy");
      zone.remove();
    }
    App.toast("Lien du jeu copié : colle-le dans ta bio ou un message.");
  });

  rendre();
});
