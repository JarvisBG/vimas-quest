/* ==========================================================================
   Page 7 — Plan du festival
   Plan SVG dessiné localement (hors ligne), zoom/déplacement au doigt,
   vue liste accessible, position GPS ou manuelle, bouton urgence.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, api, session } = App;

  const connecte = session.isLoggedIn();
  if (connecte) {
    App.initJoueur({ actif: "plus" });
    $("[data-retour]").href = "tableau-de-bord.html";
  }

  const svg = $("[data-svg]");
  const monde = $("[data-monde]");
  const carte = $("[data-carte]");
  const W = 1000, H = 700;
  const COULEURS = {
    nuit: ["#3B0A12", "#FFF8EE"], sodium: ["#FFC72C", "#3B0A12"], vert: ["#1FA05A", "#3B0A12"],
    bleu: ["#D90A22", "#FFF8EE"], rouge: ["#A00D25", "#FFF8EE"], papier: ["#FFF8EE", "#3B0A12"], rose: ["#F9A209", "#3B0A12"]
  };
  const ALIAS = { "stand-quest": "st-quest" };
  const CLE_POSITION = "vimasquest.plan.position";

  let d;
  try {
    d = await api.plan();
  } catch (e) {
    App.toast("Impossible de charger le plan.");
    return;
  }
  const lieuParId = Object.fromEntries(d.lieux.map((l) => [l.id, l]));
  // Aucun lieu en base : le fond du stade reste, avec une explication
  if (!d.lieux.length) $("#aide-carte").textContent = "Les scènes, stands et services seront placés sur le plan très bientôt. Repasse plus tard !";
  // Un lieu sans position (x / y pas encore saisis) n'est pas dessiné : liste seulement
  const place = (l) => l.place !== false && l.x != null && l.y != null;
  const lieux = d.lieux.filter(place);
  const cats = d.categories;
  const etat = {
    k: 1, tx: 0, ty: 0,
    filtres: new Set(Object.keys(cats)),
    actif: null,
    moi: (() => { try { return JSON.parse(sessionStorage.getItem(CLE_POSITION)); } catch (e) { return null; } })(),
    vue: "plan"
  };

  const couleurDe = (l) => COULEURS[l.cat === "scene" ? l.couleurScene : cats[l.cat].couleur] || COULEURS.papier;
  const distanceM = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * d.config.metresParUnite);
  const minutesA = (m) => Math.max(1, Math.ceil(m / d.config.metresParMinute));
  const trajetTxt = (l) => {
    if (!etat.moi || !place(l)) return null;
    const m = distanceM(etat.moi, l);
    return m < 30 ? "Tu y es presque" : `Environ ${minutesA(m)} min à pied (${m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`})`;
  };

  /* ======================================================================
     Dessin du site
     ====================================================================== */
  /* Le fond : Majestic Cinéma (Université de Yaoundé I), dessiné par outils/plan/fond_plan.py à partir
     d'OpenStreetMap (assets/js/plan-fond.js, dans le cache hors ligne). Les
     scènes y ajoutent leur halo de couleur ; boussole et échelle par-dessus. */
  function dessinerFond() {
    const scenes = lieux.filter((l) => l.cat === "scene").map((l) => {
      const [fond] = couleurDe(l);
      return `
        <g transform="translate(${l.x} ${l.y})">
          <path d="M-46 -20 Q0 46 46 -20 Z" fill="${fond}" opacity=".22"/>
          <rect x="-32" y="-38" width="64" height="18" rx="3" fill="${fond}" stroke="#3B0A12" stroke-width="2.5"/>
          <rect x="-32" y="-38" width="64" height="6" fill="#3B0A12" opacity=".25"/>
        </g>`;
    }).join("");
    const m = 100 / d.config.metresParUnite >= 40 ? 20 : 50;      // longueur de l'échelle, en mètres
    const u = m / d.config.metresParUnite;
    $("[data-fond]").innerHTML = `
      ${(App.planFond && App.planFond.svg) || `<rect width="${W}" height="${H}" fill="#E9EFD8"/>`}
      ${scenes}
      <g transform="translate(960 60)" aria-hidden="true">
        <circle r="26" fill="#FFF8EE" stroke="#3B0A12" stroke-width="2"/>
        <path d="M0 -18 L6 0 L0 -4 L-6 0 Z" fill="#A00D25"/><path d="M0 18 L6 0 L0 4 L-6 0 Z" fill="#3B0A12"/>
        <text y="-30" text-anchor="middle" font-size="14" fill="#3B0A12">N</text>
      </g>
      <g transform="translate(30 675)" aria-hidden="true">
        <rect width="${u.toFixed(0)}" height="6" fill="#3B0A12"/><rect width="${(u / 2).toFixed(0)}" height="6" fill="#FFF8EE" stroke="#3B0A12" stroke-width="1"/>
        <text y="-6" font-size="12" fill="#3B0A12">${m} m</text>
      </g>`;
  }

  function dessinerMarqueurs() {
    $("[data-marqueurs]").innerHTML = lieux.map((l) => {
      const [fond, encre] = couleurDe(l);
      const scene = l.cat === "scene";
      const r = scene ? 21 : 15;
      const ic = cats[l.cat].icone;
      return `
        <g class="marqueur marqueur--${l.cat}" data-lieu="${esc(l.id)}" tabindex="0" role="button"
          aria-label="${esc(l.nom)}, ${esc(cats[l.cat].nom)}" transform="translate(${l.x} ${l.y})">
          <g class="marqueur__echelle">
            <circle class="marqueur__halo" r="${r + 4}"/>
            <circle class="marqueur__pastille" r="${r}" fill="${fond}"/>
            <use class="marqueur__icone" href="#i-${ic}" x="${-r * 0.62}" y="${-r * 0.62}" width="${r * 1.24}" height="${r * 1.24}" stroke="${encre}"
              ${l.cat === "secours" ? `fill="${encre}"` : ""}/>
            ${l.tamponne ? `<circle class="marqueur__tampon" cx="${r * 0.75}" cy="${-r * 0.75}" r="6"/>` : ""}
            <text class="marqueur__nom" y="${r + (scene ? 20 : 15)}" text-anchor="middle">${esc(l.nom)}</text>
          </g>
        </g>`;
    }).join("");
    appliquerFiltres();
  }

  function dessinerMoi() {
    const g = $("[data-moi]");
    if (!etat.moi) { g.innerHTML = ""; return; }
    g.innerHTML = `
      <g transform="translate(${etat.moi.x} ${etat.moi.y})" aria-hidden="true">
        <g class="marqueur__echelle">
          <circle class="moi__halo" r="22"/>
          <circle class="moi__point" r="9"/>
        </g>
      </g>`;
    appliquerEchelle();
  }

  /* ======================================================================
     Zoom et déplacement
     ====================================================================== */
  const borne = (v, min, max) => Math.min(max, Math.max(min, v));
  /* Zone visible, en coordonnées du dessin (le SVG remplit le cadre, quitte à rogner) */
  function zoneVisible() {
    const r = carte.getBoundingClientRect();
    const a = versSvg(r.left, r.top), b = versSvg(r.right, r.bottom);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
  function contraindre(t, taille, v0, v1) {
    // Le dessin doit couvrir la zone visible ; s'il est plus petit, on le centre
    if (taille <= v1 - v0) return v0 + (v1 - v0 - taille) / 2;
    return borne(t, v1 - taille, v0);
  }
  function appliquerTransformation() {
    etat.k = borne(etat.k, 1, 5);
    const v = zoneVisible();
    etat.tx = contraindre(etat.tx, W * etat.k, v.x0, v.x1);
    etat.ty = contraindre(etat.ty, H * etat.k, v.y0, v.y1);
    monde.setAttribute("transform", `translate(${etat.tx.toFixed(2)} ${etat.ty.toFixed(2)}) scale(${etat.k.toFixed(3)})`);
    carte.dataset.zoom = etat.k >= 1.8 ? "proche" : "loin";
    appliquerEchelle();
  }
  // Les marqueurs gardent la même taille à l'écran, quel que soit le zoom
  function appliquerEchelle() {
    const s = (1 / Math.pow(etat.k, 0.8)).toFixed(3);
    $$(".marqueur__echelle", svg).forEach((g) => g.setAttribute("transform", `scale(${s})`));
  }

  function versSvg(clientX, clientY) {
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }

  function zoomer(facteur, cx = zoneVisible().cx, cy = zoneVisible().cy) {
    const k2 = borne(etat.k * facteur, 1, 5);
    etat.tx = cx - (cx - etat.tx) * (k2 / etat.k);
    etat.ty = cy - (cy - etat.ty) * (k2 / etat.k);
    etat.k = k2;
    appliquerTransformation();
  }

  function animerVers(k, tx, ty, duree = 450) {
    const v = zoneVisible();
    k = borne(k, 1, 5);
    tx = contraindre(tx, W * k, v.x0, v.x1);
    ty = contraindre(ty, H * k, v.y0, v.y1);
    const depart = { k: etat.k, tx: etat.tx, ty: etat.ty };
    if (App.reduceMotion) duree = 0;
    const t0 = performance.now();
    const pas = (t) => {
      const p = duree ? Math.min(1, (t - t0) / duree) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      etat.k = depart.k + (k - depart.k) * e;
      etat.tx = depart.tx + (tx - depart.tx) * e;
      etat.ty = depart.ty + (ty - depart.ty) * e;
      appliquerTransformation();
      if (p < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }
  const centrerSur = (x, y, k = 2.6) => {
    const v = zoneVisible();
    animerVers(k, v.cx - x * k, v.cy - y * k);
  };

  // Pointeurs : un doigt pour glisser, deux pour pincer
  const pointeurs = new Map();
  let glisse = false, departGlisse = null, pinceDepart = null, clicBloque = false;

  carte.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    departGlisse = { x: e.clientX, y: e.clientY, tx: etat.tx, ty: etat.ty, p: versSvg(e.clientX, e.clientY) };
    glisse = false;
    clicBloque = false;
    if (pointeurs.size === 2) {
      const [a, b] = [...pointeurs.values()];
      pinceDepart = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: etat.k };
    }
  });
  carte.addEventListener("pointermove", (e) => {
    if (!pointeurs.has(e.pointerId)) return;
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.size === 2 && pinceDepart) {
      const [a, b] = [...pointeurs.values()];
      const milieu = versSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      const facteur = (pinceDepart.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinceDepart.dist)) / etat.k;
      zoomer(facteur, milieu.x, milieu.y);
      clicBloque = true;
      return;
    }
    if (!departGlisse) return;
    if (!glisse && Math.hypot(e.clientX - departGlisse.x, e.clientY - departGlisse.y) > 6) {
      glisse = true;
      clicBloque = true;
      carte.classList.add("is-glisse");
      carte.setPointerCapture(e.pointerId);
    }
    if (glisse) {
      const p = versSvg(e.clientX, e.clientY);
      // La matrice change pendant le déplacement : on raisonne en coordonnées d'écran converties
      const ratio = W / svg.getBoundingClientRect().width;
      etat.tx = departGlisse.tx + (e.clientX - departGlisse.x) * ratio;
      etat.ty = departGlisse.ty + (e.clientY - departGlisse.y) * ratio;
      appliquerTransformation();
      void p;
    }
  });
  const finPointeur = (e) => {
    pointeurs.delete(e.pointerId);
    if (pointeurs.size < 2) pinceDepart = null;
    if (!pointeurs.size) {
      departGlisse = null; glisse = false; carte.classList.remove("is-glisse");
      setTimeout(() => { clicBloque = false; }, 60); // le clic qui suit un glissement est ignoré
    }
  };
  carte.addEventListener("pointerup", finPointeur);
  carte.addEventListener("pointercancel", finPointeur);

  carte.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = versSvg(e.clientX, e.clientY);
    zoomer(Math.pow(1.0018, -e.deltaY), p.x, p.y);
  }, { passive: false });

  carte.addEventListener("keydown", (e) => {
    const pas = 60;
    const actions = {
      ArrowLeft: () => { etat.tx += pas; appliquerTransformation(); },
      ArrowRight: () => { etat.tx -= pas; appliquerTransformation(); },
      ArrowUp: () => { etat.ty += pas; appliquerTransformation(); },
      ArrowDown: () => { etat.ty -= pas; appliquerTransformation(); },
      "+": () => zoomer(1.4), "=": () => zoomer(1.4), "-": () => zoomer(1 / 1.4)
    };
    if (actions[e.key] && !e.target.closest(".marqueur")) { e.preventDefault(); actions[e.key](); }
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".marqueur")) {
      e.preventDefault();
      ouvrirFiche(e.target.closest(".marqueur").dataset.lieu);
    }
  });

  $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
    const f = Number(b.dataset.zoom);
    const k = borne(etat.k * f, 1, 5);
    const v = zoneVisible();
    animerVers(k, v.cx - (v.cx - etat.tx) * (k / etat.k), v.cy - (v.cy - etat.ty) * (k / etat.k), 250);
  }));
  $("[data-recentrer]").addEventListener("click", () => animerVers(1, 0, 0));
  window.addEventListener("resize", appliquerTransformation);

  svg.addEventListener("click", (e) => {
    const m = e.target.closest(".marqueur");
    if (!m || clicBloque) return;
    ouvrirFiche(m.dataset.lieu);
  });

  /* ======================================================================
     Filtres
     ====================================================================== */
  $("[data-filtres]").innerHTML = Object.entries(cats).map(([id, c]) => {
    const nb = d.lieux.filter((l) => l.cat === id).length;
    return `<label class="puce"><input type="checkbox" value="${esc(id)}" checked><span>${icon(c.icone)} ${esc(c.nom)} <span class="texte-doux">${nb}</span></span></label>`;
  }).join("");
  $("[data-filtres]").addEventListener("change", (e) => {
    e.target.checked ? etat.filtres.add(e.target.value) : etat.filtres.delete(e.target.value);
    appliquerFiltres();
    rendreListe();
  });
  function reglerFiltres(liste) {
    etat.filtres = new Set(liste);
    $$("[data-filtres] input").forEach((i) => (i.checked = etat.filtres.has(i.value)));
    appliquerFiltres();
    rendreListe();
  }
  function appliquerFiltres() {
    $$(".marqueur", svg).forEach((m) => {
      const l = lieuParId[m.dataset.lieu];
      m.classList.toggle("is-cache", !etat.filtres.has(l.cat) && etat.actif !== l.id);
    });
    appliquerEchelle();
  }

  /* ======================================================================
     Fiche d'un lieu
     ====================================================================== */
  const fiche = $("[data-fiche]");
  const HEURE = (ms) => App.heureFestival(new Date(ms));

  function activer(id) {
    etat.actif = id;
    $$(".marqueur", svg).forEach((m) => m.classList.toggle("is-actif", m.dataset.lieu === id));
    appliquerFiltres();
  }

  function ouvrirFiche(id, { centrer = true } = {}) {
    const l = lieuParId[ALIAS[id] || id];
    if (!l) return;
    activer(l.id);
    if (centrer && etat.vue === "plan" && place(l)) centrerSur(l.x, l.y, Math.max(etat.k, 2.4));
    const c = cats[l.cat];
    $("[data-fiche-cat]").innerHTML = `${icon(c.icone)} ${esc(c.nom.replace(/s$/, ""))}`;
    $("[data-fiche-titre]").textContent = l.nom;

    const infos = [];
    if (l.pmr) infos.push(`<span class="pastille pastille--bleu">Accessible PMR</span>`);
    if (l.pmr === false) infos.push(`<span class="pastille">Accès PMR sur demande</span>`);
    if (l.horaires) infos.push(`<span class="pastille">${icon("horloge")} ${esc(l.horaires)}</span>`);
    if (l.tamponne === true) infos.push(`<span class="pastille pastille--vert">${icon("valide")} Tamponné</span>`);
    if (l.tamponne === false && connecte) infos.push(`<span class="pastille pastille--sodium">QR à scanner</span>`);

    const trajet = trajetTxt(l);
    let scene = "";
    if (l.cat === "scene") {
      scene = `<div class="fiche-lieu__scene">
        ${l.enCours ? `<span class="en-cours">En ce moment</span><strong>${esc(l.enCours.nom)}</strong><span>jusqu'à ${HEURE(l.enCours.finMs)}</span>` : ""}
        ${l.prochain ? `<span>${l.enCours ? "Ensuite" : "Prochain concert"}, ${HEURE(l.prochain.debutMs)}</span><strong>${esc(l.prochain.nom)}</strong>` : ""}
        ${!l.enCours && !l.prochain ? "<span>Plus de concert sur cette scène.</span>" : ""}
      </div>`;
    }
    const actions = [];
    if (l.cat === "scene") {
      const cible = l.enCours || l.prochain;
      if (cible) actions.push(`<a class="btn btn--sodium btn--bloc" href="programme.html#${encodeURIComponent(cible.artisteId)}">${icon("calendrier")} Voir la fiche du concert</a>`);
    }
    if (l.tamponne === false && connecte) actions.push(`<a class="btn btn--sodium btn--bloc" href="scanner.html">${icon("qr")} Scanner son QR sur place</a>`);
    if (l.tamponne === true) actions.push(`<a class="btn btn--contour btn--bloc" href="coups-de-coeur.html#${encodeURIComponent(l.id)}">${icon("coeur")} Voter pour ce stand</a>`);
    if (l.dedicaces) actions.push(`<a class="btn btn--contour btn--bloc" href="programme.html">${icon("calendrier")} Horaires des dédicaces</a>`);
    if (!place(l)) infos.push(`<span class="pastille">Pas encore placé sur le plan</span>`);
    if (etat.vue === "liste" && place(l)) actions.push(`<button class="btn btn--contour btn--bloc" type="button" data-voir-plan="${esc(l.id)}">${icon("plan")} Voir sur le plan</button>`);
    if (place(l)) actions.push(`<button class="btn btn--contour btn--bloc" type="button" data-je-suis-ici="${esc(l.id)}">${icon("position")} Je suis ici</button>`);

    $("[data-fiche-corps]").innerHTML = `
      ${infos.length ? `<div class="fiche-lieu__infos">${infos.join("")}</div>` : ""}
      ${l.desc ? `<p>${esc(l.desc)}</p>` : ""}
      ${trajet ? `<p class="fiche-lieu__trajet">${icon("plan")} ${esc(trajet)}</p>` : place(l) ? `<p class="texte-doux">Indique où tu es pour connaître le temps de marche.</p>` : ""}
      ${scene}
      <div class="fiche-lieu__actions">${actions.join("")}</div>`;
    if (!fiche.open) fiche.showModal();
    const url = new URL(location.href);
    url.searchParams.set("lieu", l.id);
    url.searchParams.delete("stand");
    history.replaceState(null, "", url);
  }

  $("[data-fermer-fiche]").addEventListener("click", () => fiche.close());
  fiche.addEventListener("click", async (e) => {
    if (e.target === fiche) { fiche.close(); return; }
    const ici = e.target.closest("[data-je-suis-ici]");
    if (ici) {
      const l = lieuParId[ici.dataset.jeSuisIci];
      definirPosition({ x: l.x, y: l.y }, `Position réglée : ${l.nom}.`);
      fiche.close();
    }
    const voir = e.target.closest("[data-voir-plan]");
    if (voir) {
      fiche.close();
      changerVue("plan");
      const l = lieuParId[voir.dataset.voirPlan];
      activer(l.id);
      setTimeout(() => centrerSur(l.x, l.y), 50);
    }
  });

  /* ======================================================================
     Position
     ====================================================================== */
  function definirPosition(p, message) {
    etat.moi = p;
    try { sessionStorage.setItem(CLE_POSITION, JSON.stringify(p)); } catch (e) { /* ignore */ }
    dessinerMoi();
    rendreListe();
    $("[data-etat-position]").textContent = message || "";
  }

  $("[data-localiser]").addEventListener("click", () => {
    if (etat.moi && etat.vue === "plan") centrerSur(etat.moi.x, etat.moi.y, Math.max(etat.k, 2.2));
    if (!navigator.geolocation) {
      $("[data-etat-position]").textContent = "Localisation indisponible. Touche un lieu proche de toi puis « Je suis ici ».";
      return;
    }
    $("[data-etat-position]").textContent = "Recherche de ta position…";
    navigator.geolocation.getCurrentPosition((pos) => {
      const g = d.config.geo;
      const x = ((pos.coords.longitude - g.ouest) / (g.est - g.ouest)) * W;
      const y = ((g.nord - pos.coords.latitude) / (g.nord - g.sud)) * H;
      if (x < 0 || x > W || y < 0 || y > H) {
        $("[data-etat-position]").textContent = "Tu ne sembles pas être sur le site. Touche un lieu proche de toi puis « Je suis ici ».";
        return;
      }
      definirPosition({ x, y }, `Position trouvée (précision environ ${Math.round(pos.coords.accuracy)} m).`);
      centrerSur(x, y, 2.4);
    }, (err) => {
      $("[data-etat-position]").textContent = err.code === 1
        ? "Localisation refusée. Touche un lieu proche de toi puis « Je suis ici »."
        : "Position introuvable pour l'instant. Touche un lieu proche de toi puis « Je suis ici ».";
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });

  function plusProche(cat) {
    const candidats = lieux.filter((l) => l.cat === cat);
    if (!etat.moi) return null;
    return candidats.sort((a, b) => distanceM(etat.moi, a) - distanceM(etat.moi, b))[0];
  }

  $$("[data-proche]").forEach((b) => b.addEventListener("click", () => {
    const cat = b.dataset.proche;
    if (!etat.filtres.has(cat)) { etat.filtres.add(cat); reglerFiltres([...etat.filtres]); }
    const l = plusProche(cat);
    if (!l) {
      App.toast("Indique d'abord où tu es : « Ma position » ou « Je suis ici » sur un lieu proche.");
      $$(".marqueur", svg).forEach((m) => m.classList.toggle("is-attenue", lieuParId[m.dataset.lieu].cat !== cat));
      setTimeout(() => $$(".marqueur", svg).forEach((m) => m.classList.remove("is-attenue")), 4000);
      if (etat.vue === "plan") animerVers(1, 0, 0);
      return;
    }
    ouvrirFiche(l.id);
  }));

  /* ======================================================================
     Vue liste
     ====================================================================== */
  const normaliser = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function rendreListe() {
    if (etat.vue !== "liste") return;
    const q = normaliser($("[data-chercher]").value.trim());
    const html = Object.entries(cats).filter(([id]) => etat.filtres.has(id)).map(([id, c]) => {
      let liste = d.lieux.filter((l) => l.cat === id && (!q || normaliser(`${l.nom} ${c.nom}`).includes(q)));
      if (etat.moi) liste = liste.sort((a, b) => (place(b) - place(a)) || (place(a) ? distanceM(etat.moi, a) - distanceM(etat.moi, b) : 0));
      if (!liste.length) return "";
      return `
        <section class="groupe-lieux">
          <h2 class="affiche groupe-lieux__titre">${icon(c.icone)} ${esc(c.nom)}</h2>
          ${liste.map((l) => {
            const [fond, encre] = couleurDe(l);
            const meta = l.cat === "scene"
              ? (l.enCours ? `En ce moment : ${l.enCours.nom}` : l.prochain ? `${HEURE(l.prochain.debutMs)} : ${l.prochain.nom}` : "Plus de concert")
              : (l.horaires || l.desc || "");
            return `
              <button class="lieu-l" type="button" data-ouvrir-lieu="${esc(l.id)}">
                <span class="lieu-l__pastille" style="--c:${fond};--ct:${encre}">${icon(c.icone)}</span>
                <span><span class="lieu-l__nom">${esc(l.nom)}</span><span class="lieu-l__meta">${esc(meta)}${l.pmr ? " Accessible PMR." : ""}</span></span>
                <span class="lieu-l__dist">${etat.moi && place(l) ? `${minutesA(distanceM(etat.moi, l))} min` : ""}</span>
              </button>`;
          }).join("")}
        </section>`;
    }).join("");
    $("[data-liste]").innerHTML = html || `<p class="texte-doux">${d.lieux.length ? "Aucun lieu ne correspond." : "Les scènes, stands et services arrivent ici dès que l'organisation les a placés."}</p>`;
  }
  $("[data-chercher]").addEventListener("input", rendreListe);
  $("[data-liste]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ouvrir-lieu]");
    if (b) ouvrirFiche(b.dataset.ouvrirLieu, { centrer: false });
  });

  function changerVue(v) {
    etat.vue = v;
    $(`input[name=vue][value=${v}]`).checked = true;
    $("[data-vue-plan]").hidden = v !== "plan";
    $("[data-vue-liste]").hidden = v !== "liste";
    rendreListe();
  }
  $$("input[name=vue]").forEach((r) => r.addEventListener("change", () => changerVue(r.value)));

  /* ======================================================================
     Urgence et alerte abris
     ====================================================================== */
  const dlgUrgence = $("[data-dialogue-urgence]");
  $("[data-urgence]").addEventListener("click", () => {
    const proche = plusProche("secours");
    const postes = d.lieux.filter((l) => l.cat === "secours");
    $("[data-urgence-corps]").innerHTML = `
      <a class="btn btn--lg btn--bloc urgence__appel" href="tel:${esc(d.config.telephoneSecurite)}">${icon("telephone")} Appeler la sécurité</a>
      <p class="texte-doux">${esc(d.config.libelleTelephone)}</p>
      <div class="urgence__proche">
        ${proche
          ? `<strong>${esc(proche.nom)}</strong><span>${esc(trajetTxt(proche))}. ${esc(proche.horaires || "")}</span>`
          : `<strong>Postes de secours</strong><span>${postes.map((p) => esc(p.nom)).join(" et ")}. Active ta position pour trouver le plus proche.</span>`}
      </div>
      <button class="btn btn--nuit btn--bloc" type="button" data-voir-secours="${esc((proche || postes[0]).id)}">${icon("plan")} Voir le poste sur le plan</button>
      <ul class="urgence__conseils">
        <li>Repère un bénévole en gilet jaune : tous peuvent appeler les secours par radio.</li>
        <li>Donne le nom du lieu le plus proche (scène, stand) pour qu'on te trouve vite.</li>
        <li>En cas d'orage, rejoins l'un des abris indiqués sur le plan.</li>
      </ul>`;
    dlgUrgence.showModal();
  });
  $("[data-fermer-urgence]").addEventListener("click", () => dlgUrgence.close());
  dlgUrgence.addEventListener("click", (e) => {
    if (e.target === dlgUrgence) dlgUrgence.close();
    const v = e.target.closest("[data-voir-secours]");
    if (v) {
      dlgUrgence.close();
      changerVue("plan");
      reglerFiltres([...new Set([...etat.filtres, "secours"])]);
      ouvrirFiche(v.dataset.voirSecours);
    }
  });

  if (d.alerteAbris) {
    const a = $("[data-alerte-abri]");
    a.hidden = false;
    $("[data-alerte-titre]").textContent = d.alerteAbris.titre;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      changerVue("plan");
      reglerFiltres(["abri", "secours", "scene"]);
      animerVers(1, 0, 0);
      $$(".marqueur--abri", svg).forEach((m) => m.classList.add("is-actif"));
    });
  }

  /* ======================================================================
     Démarrage
     ====================================================================== */
  dessinerFond();
  dessinerMarqueurs();
  dessinerMoi();
  appliquerTransformation();
  if (etat.moi) $("[data-etat-position]").textContent = "Position mémorisée pour cette visite.";

  const params = new URLSearchParams(location.search);
  if (params.has("urgence")) setTimeout(() => $("[data-urgence]").click(), 150);
  const cible = params.get("lieu") || params.get("stand");
  if (cible && lieuParId[ALIAS[cible] || cible]) {
    setTimeout(() => ouvrirFiche(cible), 100);
  }
});
