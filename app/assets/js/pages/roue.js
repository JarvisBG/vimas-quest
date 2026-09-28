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
    xp: ["#1F3FD1", "#FAFAF7"], jetons: ["#FFD23F", "#0A1440"],
    commun: ["#FAFAF7", "#0A1440"], rare: ["#2BB673", "#0A1440"],
    epique: ["#FF5FA2", "#0A1440"], legendaire: ["#0A1440", "#FFD23F"],
    rien: ["#E6E1D3", "#6A7299"]
  };
  const ICONE = { xp: "eclair", jetons: "roue", rien: "fermer" };
  const RARETE = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
  // lot = objet à retirer au stand ; badge = badge de collection (+ XP) ; rien = case vide
  const aRarete = (sg) => sg.type === "lot" || sg.type === "badge";
  const couleurs = (sg) => (aRarete(sg) ? COULEUR[sg.lotInfo.rarete] || COULEUR.commun : COULEUR[sg.type]);
  const iconeDe = (sg) => (aRarete(sg) ? sg.lotInfo.icone : ICONE[sg.type]);

  let d = null;
  let angle = 0;          // rotation actuelle en degrés
  let enRotation = false;

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
          <path d="M${C} ${C} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${fond}" stroke="#0A1440" stroke-width="3"/>
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
          <rect width="4" height="10" fill="rgba(10,20,64,.12)"/></pattern></defs>
        ${parts}
        <circle cx="${C}" cy="${C}" r="${R - 1.5}" fill="none" stroke="#0A1440" stroke-width="3"/>
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

  // Plafond par journée de jeu (6 h → 6 h) ; maxParJour = 0 : pas de plafond
  function majBoutons() {
    if (!d) return;
    const j = session.get();
    const plafond = d.maxParJour > 0;
    const restants = plafond ? d.maxParJour - d.tiragesJour : Infinity;
    let possible = true, info;
    const tirages = Math.min(Math.floor(j.jetons / d.cout), restants);
    if (enRotation) { possible = false; info = "La roue tourne…"; }
    else if (d.vide) { possible = false; info = "La roue n'a pas encore de lots : elle ouvre bientôt !"; }
    else if (d.pass === false) { possible = false; info = `Ta journée de jeu n'est pas ouverte. Prends un ticket auprès de l'équipe, puis <a href="scanner.html">scanne-le</a>.`; }
    else if (restants <= 0) { possible = false; info = `Tu as fait tes ${d.maxParJour} tirages du jour. La roue rouvre demain à 6 h !`; }
    else if (j.jetons < d.cout) {
      possible = false;
      const manque = d.cout - j.jetons;
      info = `Il te manque ${manque} jeton${manque > 1 ? "s" : ""}. <a href="missions.html">Gagne-les avec les missions</a> ou le blind test.`;
    } else {
      info = `Tu as ${j.jetons} jetons : ${tirages} tirage${tirages > 1 ? "s" : ""} possible${tirages > 1 ? "s" : ""}.`
        + (plafond ? ` ${restants} restant${restants > 1 ? "s" : ""} aujourd'hui.` : "");
    }
    btn.disabled = !possible;
    moyeu.disabled = !possible;
    $("[data-tourner-txt]").textContent = `Tourner pour ${d.cout} jetons`;
    $("[data-info]").innerHTML = info;
  }

  function rendreChances() {
    $("[data-chances]").innerHTML = d.segments.map((sg) => {
      const [fond] = couleurs(sg);
      const nom = sg.lotInfo ? sg.lotInfo.nom : sg.court;
      const s = sg.lotInfo && sg.lotInfo.stock;
      const stock = sg.epuise ? "épuisé" : s === null || s === undefined ? "illimité" : `${fmt.nombre(s)} en stock`;
      return `<li class="${sg.epuise ? "is-epuise" : ""}">
        <span class="chances__puce" style="background:${fond}"></span>
        <span>${esc(nom)} <span class="texte-doux">(${stock})</span></span>
        <span class="chances__pct">${String(sg.chance).replace(".", ",")} %</span></li>`;
    }).join("");
  }

  const quand = (q) => {
    const j = { "2026-11-26": "jeu.", "2026-11-27": "ven.", "2026-11-28": "sam.", "2026-11-29": "dim." }[q.jour]
      || String(q.jour).split("-").reverse().slice(0, 2).join("/"); // hors festival : 18/09
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
      // Pas encore de lot en base : la roue attend l'équipe
      if (!d.segments.length) d.pass = false, d.vide = true;
      // Redessinée seulement si les cases changent (lot ajouté, lot épuisé)
      const signature = d.segments.map((x) => `${x.id}:${x.epuise ? 0 : 1}`).join();
      if (d.segments.length && signature !== disque.dataset.signature) {
        dessinerRoue();
        disque.dataset.signature = signature;
      }
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
      const msg = {
        jetons: "Pas assez de jetons.",
        limite: "Tu as fait tous tes tirages du jour : la roue rouvre demain à 6 h.",
        pass: "Ta journée de jeu n'est pas ouverte : scanne un ticket de l'équipe.",
        // Réponse perdue : le tirage a peut-être eu lieu. On relit, sans rejouer.
        reseau: "Réseau coupé pendant le tirage. Vérifie tes jetons et tes lots avant de rejouer."
      };
      App.toast(msg[res.erreur] || res.message || "Tirage impossible.");
      await charger();
      return;
    }
    majJetons(true); // les jetons sont dépensés tout de suite
    // Case d'arrivée : donnée par la démo (index) ou retrouvée par l'id du lot
    let index = res.index;
    if (index === undefined && res.lotId) {
      index = d.segments.findIndex((x) => x.id === res.lotId);
      if (index < 0) {   // lot ajouté depuis le chargement : on redessine la roue
        await charger();
        dessinerRoue();
        index = d.segments.findIndex((x) => x.id === res.lotId);
      }
    }
    const sg = index >= 0 ? { ...d.segments[index], badge: res.segment && res.segment.badge } : res.segment;
    if (index >= 0) {
      $(".plateau-roue").classList.add("is-tourne");
      cadre.classList.add("is-tourne");
      if (navigator.vibrate) navigator.vibrate(20);
      await animer(index);
      $(".plateau-roue").classList.remove("is-tourne");
      cadre.classList.remove("is-tourne");
      disque.dataset.dernierIndex = index; // utile aux tests
    }
    enRotation = false;
    afficherGain({ ...res, segment: sg });
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
    const c = ["#FFD23F", "#FF5FA2", "#2BB673", "#1F3FD1", "#FAFAF7"];
    zone.innerHTML = Array.from({ length: 60 }, (_, i) =>
      `<i style="--x:${Math.random() * 100}%;--c:${c[i % 5]};--r:${Math.random()}s;--d:${2 + Math.random() * 2}s;--dx:${(Math.random() - 0.5) * 200}px;--rot:${360 + Math.random() * 720}deg"></i>`).join("");
    setTimeout(() => (zone.innerHTML = ""), 4500);
  }

  function afficherGain(res) {
    // Le dernier exemplaire est parti pendant le tirage : jetons dépensés, rien gagné
    const sg = res.perdu ? { type: "rien", lotInfo: { nom: "Lot épuisé" } } : res.segment;
    const [fond, encre] = couleurs(sg);
    const visuel = $("[data-gain-visuel]");
    visuel.style.setProperty("--c", fond);
    visuel.style.color = encre;
    visuel.innerHTML = icon(iconeDe(sg));
    const actions = [];
    if (res.perdu) {
      $("[data-gain-lib]").textContent = "Pas de chance";
      $("[data-gain-titre]").textContent = "Lot épuisé";
      $("[data-gain-texte]").textContent = "Un autre joueur a gagné le dernier exemplaire au même moment. La roue s'est mise à jour.";
      son("petit");
    } else if (sg.type === "rien") {
      $("[data-gain-lib]").textContent = "Pas de chance";
      $("[data-gain-titre]").textContent = sg.lotInfo.nom;
      $("[data-gain-texte]").textContent = "Ce sera pour le prochain tour !";
      son("petit");
    } else if (sg.type === "badge") {
      const deja = sg.badge && sg.badge.deja;
      $("[data-gain-lib]").textContent = deja ? "Badge déjà obtenu" : "Nouveau badge";
      $("[data-gain-titre]").textContent = (sg.badge && sg.badge.nom) || sg.lotInfo.nom;
      $("[data-gain-texte]").textContent = (deja ? "Il est déjà dans ta collection" : "Ajouté à ta collection")
        + (sg.valeur > 0 ? `, et +${sg.valeur} XP sur ta carte.` : ".");
      actions.push(`<a class="btn btn--sodium btn--lg btn--bloc" href="collection.html">${icon("etoile")} Voir ma collection</a>`);
      son(deja ? "petit" : "gain");
    } else if (sg.type === "lot") {
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
    const secondaire = !res.perdu && (sg.type === "lot" || sg.type === "badge");
    actions.push(`<button class="btn ${secondaire ? "btn--contour" : "btn--sodium"} btn--bloc" type="button" data-fermer-gain>Fermer</button>`);
    $("[data-gain-actions]").innerHTML = actions.join("");
    dlgGain.showModal();
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    if (!res.perdu && aRarete(sg) && sg.lotInfo.rarete !== "commun") confettis(dlgGain);
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
      try { qr = App.qrSvg(`DQ-BON:${b.code}`, { niveau: "Q", titre: `QR du bon ${b.code}` }); } catch (e) { /* librairie absente */ }
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
