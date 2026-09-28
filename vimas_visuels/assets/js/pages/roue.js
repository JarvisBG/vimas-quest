/* ==========================================================================
   Page 11 — Roue des récompenses
   Le serveur (App.api.tirer) décide du résultat ; la roue ne fait que l'animer.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, $$, esc, icon, fmt, api, session } = App;

  const disque = $("[data-disque]");
  const cadre = $("[data-roue-cadre]");
  const languette = $("[data-languette]");
  const btn = $("[data-tourner]");
  const moyeu = $("[data-tourner-moyeu]");
  const dlgGain = $("[data-gain]");
  const dlgBon = $("[data-bon]");

  const COULEUR = {
    xp: ["#D90A22", "#FFF8EE"], jetons: ["#FFC72C", "#3B0A12"],
    commun: ["#FFF8EE", "#3B0A12"], rare: ["#1FA05A", "#3B0A12"],
    epique: ["#F9A209", "#3B0A12"], legendaire: ["#3B0A12", "#FFC72C"]
  };
  const ICONE = { xp: "eclair", jetons: "roue" };
  const RARETE = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
  const couleurs = (sg) => (sg.type === "lot" ? COULEUR[sg.lotInfo.rarete] : COULEUR[sg.type]);
  const iconeDe = (sg) => (sg.type === "lot" ? sg.lotInfo.icone : ICONE[sg.type]);

  let d = null;
  let angle = 0;          // rotation actuelle en degrés
  let enRotation = false;
  let minuteur = null;

  /* ======================================================================
     Son (généré)
     ====================================================================== */
  let ctxAudio = null;
  function son(type) {
    try {
      ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctxAudio.currentTime;
      const note = (f, dt, dur, onde, vol) => {
        const o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
        o.type = onde; o.frequency.value = f;
        g.gain.setValueAtTime(vol, t + dt);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + dur);
        o.connect(g).connect(ctxAudio.destination);
        o.start(t + dt); o.stop(t + dt + dur);
      };
      if (type === "tic") note(1800, 0, 0.03, "square", 0.08);
      if (type === "gain") [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.09, 0.35, "triangle", 0.25));
      if (type === "petit") [659, 880].forEach((f, i) => note(f, i * 0.1, 0.25, "triangle", 0.2));
    } catch (e) { /* audio indisponible */ }
  }

  /* ======================================================================
     Dessin de la roue (SVG)
     ====================================================================== */
  function dessinerRoue() {
    const n = d.segments.length, R = 200, C = 200, pas = 360 / n;
    const pt = (a, r) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
    };
    const parts = d.segments.map((sg, i) => {
      const [fond, encre] = sg.epuise ? ["#D3D8EA", "#6A7299"] : couleurs(sg);
      const a1 = i * pas - pas / 2, a2 = i * pas + pas / 2;
      const [x1, y1] = pt(a1, R), [x2, y2] = pt(a2, R);
      const [ix, iy] = pt(i * pas, R * 0.84);
      const etiquette = sg.epuise ? "Épuisé" : sg.court;
      return `
        <g>
          <path d="M${C} ${C} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${fond}" stroke="#3B0A12" stroke-width="3"/>
          ${sg.epuise ? `<path d="M${C} ${C} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="url(#raye)"/>` : ""}
          <use href="#i-${sg.epuise ? "cadenas" : iconeDe(sg)}" x="${(ix - 13).toFixed(1)}" y="${(iy - 13).toFixed(1)}" width="26" height="26"
            fill="none" stroke="${encre}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
            transform="rotate(${i * pas} ${ix.toFixed(1)} ${iy.toFixed(1)})"/>
          <text transform="rotate(${i * pas} ${C} ${C}) translate(${C} ${C - R * 0.47}) rotate(90)"
            fill="${encre}" font-size="${etiquette.length > 8 ? 21 : 25}" text-anchor="middle" dominant-baseline="central">${esc(etiquette)}</text>
        </g>`;
    }).join("");
    disque.innerHTML = `
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="raye" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="10" fill="rgba(59, 10, 18,.12)"/></pattern></defs>
        ${parts}
        <circle cx="${C}" cy="${C}" r="${R - 1.5}" fill="none" stroke="#3B0A12" stroke-width="3"/>
      </svg>`;
    disque.style.transform = `rotate(${angle}deg)`;
  }

  /* ======================================================================
     État, boutons et informations
     ====================================================================== */
  function majJetons(anime = false) {
    const j = session.get();
    const el = $("[data-jetons]");
    el.hidden = false;
    el.innerHTML = `<span class="jeton" aria-hidden="true"></span><span class="chiffres">${j.jetons}</span><span class="sr-only"> jetons</span>`;
    if (anime) { el.classList.remove("is-gagne"); void el.offsetWidth; el.classList.add("is-gagne"); }
  }

  function majBoutons() {
    clearTimeout(minuteur);
    if (!d) return;
    const j = session.get();
    const attente = d.prochainTirage - Date.now();
    let possible = true, info;
    const tirages = Math.floor(j.jetons / d.cout);
    if (enRotation) { possible = false; info = "La roue tourne…"; }
    else if (d.tiragesJour >= d.maxParJour) { possible = false; info = `Tu as fait tes ${d.maxParJour} tirages du jour. Reviens demain !`; }
    else if (j.jetons < d.cout) {
      possible = false;
      const manque = d.cout - j.jetons;
      info = `Il te manque ${manque} jeton${manque > 1 ? "s" : ""}. <a href="missions.html">Gagne-les avec les missions</a> ou le blind test.`;
    } else if (attente > 0) {
      possible = false;
      info = `Prochain tirage dans ${Math.ceil(attente / 1000)} s`;
      minuteur = setTimeout(majBoutons, 250);
    } else {
      info = `Tu as ${j.jetons} jetons : ${tirages} tirage${tirages > 1 ? "s" : ""} possible${tirages > 1 ? "s" : ""}. ${d.maxParJour - d.tiragesJour} restant${d.maxParJour - d.tiragesJour > 1 ? "s" : ""} aujourd'hui.`;
    }
    btn.disabled = !possible;
    moyeu.disabled = !possible;
    $("[data-tourner-txt]").textContent = `Tourner pour ${d.cout} jetons`;
    $("[data-info]").innerHTML = info;
  }

  function rendreChances() {
    $("[data-chances]").innerHTML = d.segments.map((sg) => {
      const [fond] = couleurs(sg);
      const nom = sg.type === "lot" ? sg.lotInfo.nom : sg.court;
      const stock = sg.type === "lot" ? (sg.epuise ? "épuisé" : `${fmt.nombre(sg.lotInfo.stock)} en stock`) : "illimité";
      return `<li class="${sg.epuise ? "is-epuise" : ""}">
        <span class="chances__puce" style="background:${fond}"></span>
        <span>${esc(nom)} <span class="texte-doux">(${stock})</span></span>
        <span class="chances__pct">${String(sg.chance).replace(".", ",")} %</span></li>`;
    }).join("");
  }

  const quand = (q) => {
    const j = { "2026-12-26": "sam.", "2026-12-27": "dim." }[q.jour] || q.jour;
    return `${j} à ${fmt.heure(q.heure)}`;
  };

  function rendreBons(nouveau = null) {
    const aRetirer = d.bons.filter((b) => b.statut === "a-retirer").length;
    const nb = $("[data-nb-a-retirer]");
    nb.hidden = aRetirer === 0;
    nb.className = "pastille pastille--rose";
    nb.textContent = `${aRetirer} à retirer`;
    $("[data-bons-vide]").hidden = d.bons.length > 0;
    $("[data-bons]").innerHTML = d.bons.map((b) => {
      const [fond] = COULEUR[b.lotInfo.rarete];
      const retire = b.statut === "retire";
      return `
        <li>
          <button class="billet bon-carte${retire ? " is-retire" : ""}${b.code === nouveau ? " is-nouveau" : ""}" type="button" data-ouvrir-bon="${esc(b.code)}">
            <span class="bon-carte__icone" style="--c:${fond};color:${COULEUR[b.lotInfo.rarete][1]}">${icon(b.lotInfo.icone)}</span>
            <span>
              <span class="bon-carte__nom">${esc(b.lotInfo.nom)}</span>
              <span class="bon-carte__meta">${retire ? `Retiré ${esc(quand(b.retireLe))}` : `Gagné ${esc(quand(b.creeLe))}, à retirer avant ${esc(d.retrait.limiteTexte)}`}</span>
            </span>
            <span class="pastille ${retire ? "" : "pastille--sodium"}">${retire ? "Retiré" : "Mon bon"}</span>
          </button>
        </li>`;
    }).join("");
    $("[data-retrait-lieu]").textContent = d.retrait.lieu;
    $("[data-retrait-infos]").textContent = `${d.retrait.horaires}. Lots à retirer avant ${d.retrait.limiteTexte}, avec ton bon et ton billet.`;
  }

  async function charger(nouveauBon = null) {
    try {
      d = await api.roue();
      if (!d) { location.replace("inscription.html"); return; }
      if (!disque.firstChild) dessinerRoue();
      rendreChances();
      rendreBons(nouveauBon);
      majJetons();
      majBoutons();
    } catch (e) {
      console.error(e);
      App.toast("Impossible de charger la roue. Vérifie ta connexion.");
    }
  }

  /* ======================================================================
     Tirage et animation
     ====================================================================== */
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function animer(indexCible) {
    return new Promise((fin) => {
      const n = d.segments.length, pas = 360 / n;
      const ecart = (Math.random() - 0.5) * pas * 0.7; // jamais pile sur une séparation
      const cibleMod = ((360 - indexCible * pas + ecart) % 360 + 360) % 360;
      const depart = angle;
      const tours = App.reduceMotion ? 1 : 6;
      const arrivee = depart + tours * 360 + ((cibleMod - (depart % 360)) + 360) % 360;
      const duree = App.reduceMotion ? 700 : 5200;
      const t0 = performance.now();
      let dernierIndex = null;

      const pas_ = (t) => {
        const p = Math.min(1, (t - t0) / duree);
        angle = depart + (arrivee - depart) * easeOut(p);
        disque.style.transform = `rotate(${angle}deg)`;
        const sous = Math.floor((((360 - (angle % 360)) + pas / 2) % 360) / pas);
        if (sous !== dernierIndex) {
          dernierIndex = sous;
          languette.classList.remove("is-choc"); void languette.offsetWidth; languette.classList.add("is-choc");
          son("tic");
        }
        if (p < 1) requestAnimationFrame(pas_);
        else { angle = arrivee % 360; disque.style.transform = `rotate(${angle}deg)`; fin(); }
      };
      requestAnimationFrame(pas_);
    });
  }

  async function tourner() {
    if (enRotation || btn.disabled) return;
    enRotation = true;
    majBoutons();
    let res;
    try {
      res = await api.tirer();
    } catch (e) {
      res = { ok: false, erreur: "reseau" };
    }
    if (!res.ok) {
      enRotation = false;
      const msg = { jetons: "Pas assez de jetons.", limite: "Limite de tirages atteinte pour aujourd'hui.", delai: "Patiente quelques secondes avant de rejouer.", reseau: "Le tirage n'a pas pu être envoyé. Aucun jeton n'a été dépensé." };
      App.toast(msg[res.erreur] || "Tirage impossible.");
      await charger();
      return;
    }
    majJetons(true); // les jetons sont dépensés tout de suite
    $(".plateau-roue").classList.add("is-tourne");
    cadre.classList.add("is-tourne");
    if (navigator.vibrate) navigator.vibrate(20);
    await animer(res.index);
    $(".plateau-roue").classList.remove("is-tourne");
    cadre.classList.remove("is-tourne");
    enRotation = false;
    disque.dataset.dernierIndex = res.index; // utile aux tests
    afficherGain(res);
    await charger(res.bon ? res.bon.code : null);
  }

  btn.addEventListener("click", tourner);
  moyeu.addEventListener("click", tourner);

  /* ======================================================================
     Résultat
     ====================================================================== */
  function confettis(conteneur) {
    if (App.reduceMotion) return;
    const zone = $("[data-confettis]");
    conteneur.append(zone); // dans la boîte de dialogue pour passer au premier plan
    const c = ["#FFC72C", "#F9A209", "#1FA05A", "#D90A22", "#FFF8EE"];
    zone.innerHTML = Array.from({ length: 60 }, (_, i) =>
      `<i style="--x:${Math.random() * 100}%;--c:${c[i % 5]};--r:${Math.random()}s;--d:${2 + Math.random() * 2}s;--dx:${(Math.random() - 0.5) * 200}px;--rot:${360 + Math.random() * 720}deg"></i>`).join("");
    setTimeout(() => (zone.innerHTML = ""), 4500);
  }

  function afficherGain(res) {
    const sg = res.segment;
    const [fond, encre] = couleurs(sg);
    const visuel = $("[data-gain-visuel]");
    visuel.style.setProperty("--c", fond);
    visuel.style.color = encre;
    visuel.innerHTML = icon(iconeDe(sg));
    const actions = [];
    if (sg.type === "lot") {
      $("[data-gain-lib]").textContent = `Tu gagnes un lot ${RARETE[sg.lotInfo.rarete].toLowerCase()}`;
      $("[data-gain-titre]").textContent = sg.lotInfo.nom;
      $("[data-gain-texte]").textContent = `Ton bon de retrait est prêt. Présente-le au ${d.retrait.lieu.split(",")[0]} avant ${d.retrait.limiteTexte}.`;
      actions.push(`<button class="btn btn--sodium btn--lg btn--bloc" type="button" data-voir-bon="${esc(res.bon.code)}">${icon("qr")} Voir mon bon</button>`);
      son(["rare", "epique", "legendaire"].includes(sg.lotInfo.rarete) ? "gain" : "petit");
    } else if (sg.type === "xp") {
      $("[data-gain-lib]").textContent = "Bonus";
      $("[data-gain-titre]").textContent = `+${sg.valeur} XP`;
      $("[data-gain-texte]").textContent = "Ajoutés directement à ta carte de festivalier.";
      son("petit");
    } else {
      $("[data-gain-lib]").textContent = "Bonus";
      $("[data-gain-titre]").textContent = `+${sg.valeur} jetons`;
      $("[data-gain-texte]").textContent = "De quoi retenter ta chance !";
      son("petit");
    }
    actions.push(`<button class="btn ${sg.type === "lot" ? "btn--contour" : "btn--sodium"} btn--bloc" type="button" data-fermer-gain>Fermer</button>`);
    $("[data-gain-actions]").innerHTML = actions.join("");
    dlgGain.showModal();
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    if (sg.type === "lot" && sg.lotInfo.rarete !== "commun") confettis(dlgGain);
  }

  dlgGain.addEventListener("click", (e) => {
    if (e.target.closest("[data-fermer-gain]") || e.target === dlgGain) dlgGain.close();
    const voir = e.target.closest("[data-voir-bon]");
    if (voir) { dlgGain.close(); ouvrirBon(voir.dataset.voirBon); }
  });
  dlgGain.addEventListener("close", () => { majJetons(true); majBoutons(); });

  /* ======================================================================
     Bon de retrait
     ====================================================================== */
  let verrou = null;
  async function ouvrirBon(code) {
    const b = d.bons.find((x) => x.code === code);
    if (!b) return;
    const zone = $("[data-bon-billet]");
    if (b.statut === "retire") {
      zone.innerHTML = `
        <p class="bon-d__nom">${esc(b.lotInfo.nom)}</p>
        <div class="bon-d__retire"><span class="tampon">Retiré</span>
          <p>Le ${esc(quand(b.retireLe))}${b.par ? `, remis par ${esc(b.par)}` : ""}.</p></div>
        <p class="bon-d__code">${esc(b.code)}</p>`;
    } else {
      let qr = "";
      try { qr = App.qrSvg(`VMS-BON:${b.code}`, { niveau: "Q", titre: `QR du bon ${b.code}` }); } catch (e) { /* librairie absente */ }
      zone.innerHTML = `
        <p class="pastille pastille--${b.lotInfo.rarete}">${RARETE[b.lotInfo.rarete]}</p>
        <p class="bon-d__nom">${esc(b.lotInfo.nom)}</p>
        <div class="bon-d__qr">${qr}</div>
        <p class="bon-d__code">${esc(b.code)}</p>
        <div class="bon-d__infos">
          <p><strong>${esc(d.retrait.lieu)}</strong></p>
          <p>${esc(d.retrait.horaires)}. Valable jusqu'à ${esc(d.retrait.limiteTexte)}.</p>
          <p class="texte-doux">Gagné ${esc(quand(b.creeLe))}. Présente aussi ton billet. Monte la luminosité si le scan ne passe pas.</p>
        </div>`;
      try { verrou = await navigator.wakeLock?.request("screen"); } catch (e) { /* non pris en charge */ }
    }
    $("[data-bon-demo]").hidden = !(App.config.demo && b.statut === "a-retirer");
    $("[data-bon-demo]").dataset.code = b.code;
    if (!dlgBon.open) dlgBon.showModal();
  }

  const fermerBon = () => dlgBon.close();
  $("[data-fermer-bon]").addEventListener("click", fermerBon);
  dlgBon.addEventListener("click", (e) => { if (e.target === dlgBon) fermerBon(); });
  dlgBon.addEventListener("close", () => { verrou?.release?.().catch(() => {}); verrou = null; });

  $("[data-bons]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ouvrir-bon]");
    if (b) ouvrirBon(b.dataset.ouvrirBon);
  });

  $("[data-bon-demo]").addEventListener("click", async (e) => {
    const bouton = e.currentTarget;
    const code = bouton.dataset.code;
    bouton.setAttribute("aria-busy", "true");
    const res = await api.demoRetirerBon(code);
    bouton.removeAttribute("aria-busy");
    if (!res.ok) return;
    await charger();
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    await ouvrirBon(code);
    App.toast("Lot remis, bonne fin de festival !");
  });

  /* ---------- Démarrage ---------- */
  await charger();
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash && d && d.bons.some((b) => b.code === hash)) ouvrirBon(hash);
});
