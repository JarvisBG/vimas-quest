/* ==========================================================================
   Page 18 — Erreur / hors connexion
   Un seul script pour erreur.html?code=…, hors-ligne.html et 404.html.
   ========================================================================== */
document.addEventListener("app:ready", () => {
  "use strict";
  const { $, $$, esc, icon, session } = App;

  const params = new URLSearchParams(location.search);
  const code = document.body.dataset.code || params.get("code") || (navigator.onLine ? "500" : "hors-ligne");
  const connecte = session.isLoggedIn();
  const maison = connecte ? { href: "tableau-de-bord.html", lib: "Retour à ma carte" } : { href: "index.html", lib: "Retour à l'accueil" };
  // Page d'origine (fournie par le service worker), limitée à une page du site
  const retourBrut = params.get("retour") || "";
  const retour = /^[\w\-/]+\.html(\?[\w=&%-]*)?(#[\w-]*)?$/.test(retourBrut) ? retourBrut : null;

  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  /* ---------- Illustrations ---------- */
  const VISUELS = {
    disque: `
      <svg viewBox="0 0 200 200">
        <g class="visu-disque visu-disque--saute">
          <circle cx="100" cy="100" r="92" fill="#1F0409" stroke="#FFF8EE" stroke-width="3"/>
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255, 248, 238,.15)" stroke-width="2"/>
          <circle cx="100" cy="100" r="54" fill="none" stroke="rgba(255, 248, 238,.12)" stroke-width="2"/>
          <circle cx="100" cy="100" r="30" fill="#FFC72C"/>
          <circle cx="100" cy="100" r="5" fill="#3B0A12"/>
          <path d="M30 70 L60 80 L52 92 L84 104" fill="none" stroke="#F9A209" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <path d="M188 20 L150 20 L118 62" fill="none" stroke="#FFF8EE" stroke-width="6" stroke-linecap="round"/>
        <rect x="108" y="56" width="18" height="12" rx="2" fill="#F9A209" transform="rotate(-50 117 62)"/>
      </svg>`,
    micro: `
      <svg viewBox="0 0 200 200">
        <rect x="70" y="14" width="60" height="96" rx="30" fill="#FFC72C" stroke="#FFF8EE" stroke-width="4"/>
        <path d="M78 44h44M78 60h44M78 76h44" stroke="#3B0A12" stroke-width="3" opacity=".35"/>
        <path d="M50 88a50 50 0 0 0 100 0" fill="none" stroke="#FFF8EE" stroke-width="6" stroke-linecap="round"/>
        <path d="M100 138v22 q0 12 -14 16" fill="none" stroke="#FFF8EE" stroke-width="6" stroke-linecap="round"/>
        <rect x="64" y="170" width="24" height="16" rx="3" fill="#F9A209"/>
        <path d="M112 184 q14 -2 22 -14 q8 -12 26 -10" fill="none" stroke="#FFF8EE" stroke-width="6" stroke-linecap="round"/>
        <rect x="102" y="178" width="20" height="14" rx="3" fill="#F9A209"/>
        <g class="visu-etincelle" fill="#FFC72C"><path d="M94 180l4-9 3 9 8 2-8 3-3 9-4-9-8-3z"/></g>
      </svg>`,
    enceinte: `
      <svg viewBox="0 0 200 200">
        <rect x="40" y="30" width="90" height="140" rx="10" fill="#1F0409" stroke="#FFF8EE" stroke-width="4"/>
        <circle cx="85" cy="70" r="16" fill="#FFC72C"/><circle cx="85" cy="70" r="6" fill="#3B0A12"/>
        <circle cx="85" cy="126" r="30" fill="#FFC72C"/><circle cx="85" cy="126" r="11" fill="#3B0A12"/>
        <g class="visu-onde" fill="none" stroke="#F9A209" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M140 70 l10 -10 l8 16 l10 -18 l10 14"/>
          <path d="M140 120 l12 -12 l8 18 l10 -20 l12 16"/>
        </g>
      </svg>`,
    pause: `
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" fill="#D90A22" stroke="#FFF8EE" stroke-width="4"/>
        <g class="visu-pause" fill="#FFC72C">
          <rect x="68" y="58" width="22" height="84" rx="5"/><rect x="110" y="58" width="22" height="84" rx="5"/>
        </g>
      </svg>`
  };

  /* ---------- Contenu selon le code ---------- */
  const reference = `ERR-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const CONTENUS = {
    "404": {
      surtitre: "Erreur 404", titre: "Fausse note", visuel: "disque",
      message: "Cette page n'existe pas ou a changé d'adresse. Le concert continue ailleurs !",
      actions: [
        { href: maison.href, lib: maison.lib, style: "sodium" },
        { href: "programme.html", lib: "Voir le programme", icone: "calendrier" },
        { href: "plan.html", lib: "Ouvrir le plan", icone: "plan" }
      ]
    },
    "500": {
      surtitre: "Erreur technique", titre: "Larsen", visuel: "enceinte",
      message: "Un problème est survenu de notre côté. Tes points sont en sécurité : réessaie dans un instant.",
      reference: true,
      actions: [
        { action: "recharger", lib: "Réessayer", style: "sodium", icone: "roue" },
        { href: maison.href, lib: maison.lib }
      ]
    },
    "503": {
      surtitre: "Maintenance", titre: "Entracte", visuel: "pause",
      message: "Le jeu fait une courte pause pour une mise à jour. Les concerts, eux, continuent !",
      reessai: 30,
      actions: [
        { action: "recharger", lib: "Réessayer maintenant", style: "sodium" },
        { href: "infos.html", lib: "Infos pratiques", icone: "info" }
      ]
    },
    "hors-ligne": {
      surtitre: "Hors connexion", titre: "Micro coupé", visuel: "micro",
      message: "Pas de réseau pour le moment : c'est fréquent quand tout le monde filme la même scène. On réessaie tout seuls.",
      horsLigne: true,
      actions: [
        { action: "tester", lib: "Réessayer maintenant", style: "sodium", icone: "roue" }
      ]
    }
  };
  const c = CONTENUS[code] || CONTENUS["500"];

  document.title = `${c.titre} | Vimas Fest`;
  $("[data-visuel]").innerHTML = VISUELS[c.visuel];
  $("[data-surtitre]").textContent = c.surtitre;
  $("[data-titre]").textContent = c.titre;
  $("[data-message]").textContent = c.message;
  $("[data-actions]").innerHTML = c.actions.map((a) => {
    const cls = `btn ${a.style === "sodium" ? "btn--sodium btn--lg" : "btn--contour"} btn--bloc`;
    const ic = a.icone ? icon(a.icone) : "";
    return a.href
      ? `<a class="${cls}" href="${esc(a.href)}">${ic} ${esc(a.lib)}</a>`
      : `<button class="${cls}" type="button" data-action="${esc(a.action)}">${ic} ${esc(a.lib)}</button>`;
  }).join("") + (c.reference ? `<p class="erreur__reference">Si ça persiste, donne ce code au Point info : <code>${reference}</code></p>` : "");
  $("[data-titre]").focus({ preventScroll: true });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "recharger") {
      if (retour) location.href = retour; else location.reload();
    }
    if (b.dataset.action === "tester") tester(true);
  });

  /* ======================================================================
     Hors connexion : test régulier du réseau et liens disponibles
     ====================================================================== */
  const zoneConnexion = $("[data-connexion]");
  let prochainTest = null, compteRebours = null, secondes = 0;

  async function reseauDisponible() {
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(new URL(`manifest.webmanifest?ping=${Date.now()}`, App.racine), { cache: "no-store", signal: ctrl.signal });
      return r.ok;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(minuteur);
    }
  }

  function afficherConnexion(etat, texte) {
    zoneConnexion.hidden = false;
    zoneConnexion.className = `etat-connexion is-${etat}`;
    zoneConnexion.innerHTML = `<span class="etat-connexion__point" aria-hidden="true"></span><span>${texte}</span>`;
  }

  async function tester(manuel = false) {
    clearTimeout(prochainTest);
    clearInterval(compteRebours);
    afficherConnexion("test", "Test de la connexion…");
    const ok = await reseauDisponible();
    if (ok) {
      afficherConnexion("ok", "Connexion rétablie !");
      if (navigator.vibrate) navigator.vibrate(60);
      $("[data-actions]").innerHTML = retour
        ? `<a class="btn btn--sodium btn--lg btn--bloc" href="${esc(retour)}">${icon("fleche")} Reprendre là où j'étais</a>
           <a class="btn btn--contour btn--bloc" href="${maison.href}">${esc(maison.lib)}</a>`
        : `<a class="btn btn--sodium btn--lg btn--bloc" href="${maison.href}">${icon("fleche")} ${esc(maison.lib)}</a>`;
      return;
    }
    // Attente progressive : 10 s, 15 s, 20 s… jusqu'à 30 s maximum
    const delai = Math.min(30, 10 + (tester.essais = (tester.essais || 0) + 1) * 5 - 5);
    secondes = delai;
    const maj = () => afficherConnexion("ko", `${manuel ? "Toujours pas de réseau." : "Pas de réseau."} Nouvel essai dans ${secondes} s.`);
    maj();
    compteRebours = setInterval(() => { secondes -= 1; if (secondes > 0) maj(); }, 1000);
    prochainTest = setTimeout(() => tester(), delai * 1000);
  }

  async function liensHorsLigne() {
    const pages = [
      { href: connecte ? "tableau-de-bord.html" : "index.html", lib: connecte ? "Ma carte" : "Accueil", icone: "carte" },
      { href: "programme.html", lib: "Programme", icone: "calendrier" },
      { href: "plan.html", lib: "Plan du site", icone: "plan" },
      { href: "infos.html", lib: "Infos pratiques", icone: "info" },
      { href: "annonces.html", lib: "Dernières annonces", icone: "cloche" },
      { href: connecte ? "passeport.html" : "infos.html#faq", lib: connecte ? "Mon passeport" : "Questions", icone: connecte ? "passeport" : "info" }
    ];
    // On ne propose que les pages réellement disponibles dans le cache
    const disponibles = await Promise.all(pages.map(async (p) => {
      if (!("caches" in window)) return true;
      try { return !!(await caches.match(new URL(p.href.split("#")[0], App.racine).href, { ignoreSearch: true })); } catch (e) { return true; }
    }));
    $("[data-liens-hors-ligne]").innerHTML = pages.map((p, i) => `
      <li><a class="${disponibles[i] ? "" : "is-indisponible"}" href="${p.href}" ${disponibles[i] ? "" : 'aria-disabled="true" tabindex="-1"'}>
        ${icon(p.icone)} ${esc(p.lib)}${disponibles[i] ? "" : " (non enregistrée)"}</a></li>`).join("");
  }

  if (c.horsLigne) {
    $("[data-hors-ligne]").hidden = false;
    $("[data-rythme]").hidden = false;
    liensHorsLigne();
    tester();
    window.addEventListener("online", () => tester(true));
  }

  if (c.reessai) {
    let s = c.reessai;
    $("[data-aide]").textContent = `Nouvel essai automatique dans ${s} s.`;
    const id = setInterval(() => {
      s -= 1;
      $("[data-aide]").textContent = `Nouvel essai automatique dans ${s} s.`;
      if (s <= 0) { clearInterval(id); retour ? (location.href = retour) : location.reload(); }
    }, 1000);
  }

  if (code === "404") {
    const chemin = params.get("chemin") || (/\/(erreur|404)\.html$/.test(location.pathname) ? "" : location.pathname);
    if (chemin) $("[data-aide]").textContent = `Adresse demandée : ${chemin}`;
  }

  /* ======================================================================
     Mini-jeu « Garde le rythme » (96 battements par minute)
     ====================================================================== */
  const PERIODE = 625, TOLERANCE = 110, CLE_RECORD = "vimas.rythme.record";
  const cercle = $("[data-rythme-btn]");
  const jeu = { depart: null, serie: 0, record: Number(localStorage.getItem(CLE_RECORD)) || 0, dernierTemps: -1, audio: null, tic: null };

  const majEtat = (texte) => {
    $("[data-rythme-etat]").textContent = `${texte ? `${texte} ` : ""}Série : ${jeu.serie}, record : ${jeu.record}`;
  };
  majEtat();

  function clic(fort) {
    if (!jeu.audio) return;
    const o = jeu.audio.createOscillator(), g = jeu.audio.createGain(), t = jeu.audio.currentTime;
    o.frequency.value = fort ? 1320 : 880;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(jeu.audio.destination);
    o.start(t); o.stop(t + 0.06);
  }

  function arreter(message) {
    clearInterval(jeu.tic);
    jeu.depart = null;
    cercle.classList.remove("is-actif");
    $("[data-rythme-txt]").textContent = "Rejouer";
    majEtat(message);
  }

  function marquer(etat) {
    cercle.classList.remove("is-pile", "is-rate");
    void cercle.offsetWidth;
    cercle.classList.add(etat);
    setTimeout(() => cercle.classList.remove(etat), 180);
  }

  cercle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const maintenant = performance.now();
    if (jeu.depart === null) {
      try { jeu.audio = jeu.audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { jeu.audio = null; }
      // Le premier temps tombe une période après le toucher
      jeu.depart = maintenant + PERIODE;
      jeu.serie = 0;
      jeu.dernierTemps = -1;
      cercle.style.animationDelay = `${PERIODE}ms`;
      cercle.classList.add("is-actif");
      $("[data-rythme-txt]").textContent = "Tape !";
      let n = 0;
      clearInterval(jeu.tic);
      setTimeout(() => { clic(true); jeu.tic = setInterval(() => clic(++n % 4 === 0), PERIODE); }, PERIODE);
      majEtat("C'est parti :");
      return;
    }
    const ecoule = maintenant - jeu.depart;
    const temps = Math.round(ecoule / PERIODE);
    const ecart = ecoule - temps * PERIODE;
    if (Math.abs(ecart) <= TOLERANCE && temps !== jeu.dernierTemps && temps >= 0) {
      jeu.dernierTemps = temps;
      jeu.serie += 1;
      if (jeu.serie > jeu.record) {
        jeu.record = jeu.serie;
        try { localStorage.setItem(CLE_RECORD, String(jeu.record)); } catch (err) { /* ignore */ }
      }
      marquer("is-pile");
      if (navigator.vibrate) navigator.vibrate(15);
      majEtat(Math.abs(ecart) < 40 ? "Pile !" : "Bien.");
    } else {
      marquer("is-rate");
      if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
      arreter(ecart < 0 ? "Trop tôt !" : "Trop tard !");
    }
  });
  // Clavier : Entrée ou Espace sur le cercle
  cercle.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); cercle.dispatchEvent(new PointerEvent("pointerdown")); }
  });
  cercle.addEventListener("click", (e) => e.preventDefault());
  document.addEventListener("visibilitychange", () => { if (document.hidden && jeu.depart !== null) arreter("Pause."); });
});
