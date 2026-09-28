/* ==========================================================================
   Page 29 — Écran géant : mur en direct
   Aucune session joueur. Tout se met à jour seul ; la régie a quelques raccourcis clavier.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api } = App;

  /* ---------- Paramètres (URL) ---------- */
  const params = new URLSearchParams(location.search);
  const CONFIG = {
    scene: params.get("scene") || "soleil",
    rotation: Math.max(6, Number(params.get("rotation")) || 15) * 1000,
    alerteDuree: 15000,
    alerteIntervalle: 3 * 60000,
    lienRejoindre: "https://vimas-festival.example/jouer"
  };
  const scene = $("[data-scene]");

  /* ---------- Mise à l'échelle 1920 × 1080 ---------- */
  App.ecran.echelle(scene);

  /* ---------- Données statiques ---------- */
  let st;
  try {
    const cles = ["scenes", "artistes", "jours", "blindTest", "missions", "festival"];
    const v = await Promise.all(cles.map(App.data.get));
    st = Object.fromEntries(cles.map((c, i) => [c, v[i]]));
  } catch (e) {
    console.error(e);
    return;
  }
  const sceneParId = Object.fromEntries(st.scenes.map((s) => [s.id, s]));
  $("[data-lieu]").textContent = sceneParId[CONFIG.scene]?.nom || "Écran géant";
  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  /* QR pour rejoindre */
  try { $("[data-qr-rejoindre]").innerHTML = App.qrSvg(CONFIG.lienRejoindre, { niveau: "Q", titre: "QR pour rejoindre le jeu" }); } catch (e) { /* librairie absente */ }
  $("[data-url-rejoindre]").innerHTML = esc(CONFIG.lienRejoindre.replace(/^https?:\/\//, "")).replace(/\//g, "<wbr>/");

  /* ---------- État de connexion ---------- */
  let derniereReussite = Date.now();
  function marquer(ok) {
    const etat = $("[data-etat]");
    if (ok) derniereReussite = Date.now();
    const horsLigne = Date.now() - derniereReussite > 45000;
    etat.classList.toggle("is-horsligne", horsLigne);
    $("[data-etat-texte]").textContent = horsLigne
      ? `Données de ${App.heureFestival(new Date(App.maintenant().getTime() - (Date.now() - derniereReussite)))}`
      : "En direct";
  }
  async function sur(fn) {
    try { await fn(); marquer(true); } catch (e) { console.warn(e); marquer(false); }
  }

  /* ======================================================================
     Horloge
     ====================================================================== */
  function horloge() {
    const [h, m] = App.heureFestival().split("h");
    $("[data-horloge]").innerHTML = `${h}<span>:</span>${m}`;
  }

  /* ======================================================================
     A. Top 10 avec animation des changements de place (technique FLIP)
     ====================================================================== */
  const anciennesPlaces = new Map();
  async function majTop() {
    const d = await api.ecranClassement(10);
    $("[data-nb-joueurs]").textContent = fmt.nombre(d.joueurs);
    $("[data-nb-scans]").textContent = fmt.nombre(d.scansJour);

    const liste = $("[data-top]");
    const avant = new Map($$(".top-ligne", liste).map((li) => [li.dataset.pseudo, li.getBoundingClientRect().top]));
    const echelleActuelle = scene.getBoundingClientRect().height / 1080;

    liste.innerHTML = d.liste.map((j) => {
      const ancien = anciennesPlaces.get(j.pseudo);
      const evo = ancien === undefined ? "" : ancien > j.rang ? "is-monte" : ancien < j.rang ? "is-descend" : "";
      return `
        <li class="top-ligne${avant.has(j.pseudo) ? "" : " is-nouveau"}" data-pseudo="${esc(j.pseudo)}" data-evo="${evo}">
          <span class="top-ligne__rang">${j.rang}</span>
          ${App.avatar(j.avatar, j.pseudo, "sm")}
          <span class="top-ligne__pseudo">${esc(j.pseudo)}</span>
          <span class="top-ligne__xp">${fmt.nombre(j.xp)} <small>XP</small></span>
          <span class="top-ligne__evo ${evo}" aria-hidden="true"></span>
        </li>`;
    }).join("");

    if (!App.reduceMotion) {
      $$(".top-ligne", liste).forEach((li) => {
        if (!avant.has(li.dataset.pseudo)) return;
        const delta = (avant.get(li.dataset.pseudo) - li.getBoundingClientRect().top) / echelleActuelle;
        if (!delta) return;
        li.style.transform = `translateY(${delta}px)`;
        li.style.transition = "none";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          li.style.transition = "transform .9s cubic-bezier(.2,.8,.2,1)";
          li.style.transform = "";
          if (li.dataset.evo === "is-monte") {
            li.classList.add("is-monte-flash");
            setTimeout(() => li.classList.remove("is-monte-flash"), 1600);
          }
        }));
      });
    }
    anciennesPlaces.clear();
    d.liste.forEach((j) => anciennesPlaces.set(j.pseudo, j.rang));
  }

  /* ======================================================================
     B. Diaporama
     ====================================================================== */
  const DIAPOS = [
    { id: "concerts", rendu: diapoConcerts },
    { id: "blind", rendu: diapoBlind },
    { id: "defi", rendu: diapoDefi }
  ];
  let indexDiapo = 0, minuteurDiapo = null, enPause = false, minuteurInterne = null;
  const zoneDiapo = $("[data-diapo-contenu]");
  scene.style.setProperty("--duree-diapo", `${CONFIG.rotation / 1000}s`);

  function afficherDiapo(i) {
    indexDiapo = (i + DIAPOS.length) % DIAPOS.length;
    clearInterval(minuteurInterne);
    DIAPOS[indexDiapo].rendu();
    $("[data-diapo-points]").innerHTML = DIAPOS.map((_, k) => `<i class="${k === indexDiapo ? "is-actif" : ""}"></i>`).join("");
    const barre = $("[data-diapo-barre]");
    barre.classList.remove("is-anime"); void barre.offsetWidth;
    if (!enPause) barre.classList.add("is-anime");
    clearTimeout(minuteurDiapo);
    if (!enPause) minuteurDiapo = setTimeout(() => afficherDiapo(indexDiapo + 1), CONFIG.rotation);
  }

  function concertsAVenir() {
    const maintenant = App.maintenant().getTime();
    return st.artistes
      .map((a) => ({ ...a, debutMs: App.dateConcert(a, st.jours).getTime() }))
      .filter((a) => a.debutMs + 60 * 60000 > maintenant && a.debutMs - maintenant < 8 * 3600000)
      .sort((a, b) => a.debutMs - b.debutMs);
  }

  function diapoConcerts() {
    const maintenant = App.maintenant().getTime();
    const liste = concertsAVenir();
    const enCours = liste.filter((a) => a.debutMs <= maintenant);
    const suivants = liste.filter((a) => a.debutMs > maintenant).slice(0, enCours.length ? 3 : 5);
    const rendu = () => {
      const now = App.maintenant().getTime();
      zoneDiapo.innerHTML = `
        <div class="diapo">
          <h2 class="affiche diapo__titre">${enCours.length ? "Sur scène" : "À suivre"}</h2>
          ${enCours.map((a) => `
            <div class="en-scene">
              <p class="en-scene__lib">En ce moment, ${esc(sceneParId[a.scene].nom)}</p>
              <p class="affiche en-scene__nom">${esc(a.nom)}</p>
              <p class="en-scene__meta">${esc(a.genre)}, depuis ${App.duree(now - a.debutMs)}</p>
            </div>`).join("")}
          ${enCours.length && suivants.length ? `<h3 class="affiche" style="font-size:48px">Ensuite</h3>` : ""}
          <div class="suivants">
            ${suivants.map((a) => `
              <div class="suivant c-${sceneParId[a.scene].couleur}">
                <span><span class="suivant__heure">${fmt.heure(a.debut)}</span><span class="suivant__dans">dans ${App.duree(a.debutMs - now)}</span></span>
                <span><span class="suivant__nom">${esc(a.nom)}</span><span class="suivant__scene" style="display:block">${esc(sceneParId[a.scene].nom)}, ${esc(a.genre)}</span></span>
              </div>`).join("")}
          </div>
          ${!enCours.length && !suivants.length ? `<p class="vide-diapo">Fin des concerts pour ce soir. Merci et à demain !</p>` : ""}
        </div>`;
    };
    rendu();
  }

  function diapoBlind() {
    const bt = st.blindTest;
    const debut = App.dateFestival(App.jourFestival(), bt.horaire).getTime();
    const tic = () => {
      const ecart = debut - App.maintenant().getTime();
      const dans = $(".blind-dans", zoneDiapo);
      if (!dans) return;
      dans.textContent = ecart > 0 ? `Départ dans ${App.duree(ecart)}`
        : ecart > -30 * 60000 ? "C'est maintenant, sors ton téléphone !" : "Prochaine manche demain";
    };
    zoneDiapo.innerHTML = `
      <div class="diapo diapo--blind">
        <h2 class="affiche diapo__titre">Blind test</h2>
        <p class="blind-heure">${fmt.heure(bt.horaire)}</p>
        <p class="blind-dans"></p>
        <p class="blind-texte">${bt.questions} extraits, tout le public joue depuis son téléphone. Podium sur cet écran.</p>
        <div class="eq blind-eq" data-eq-blind></div>
      </div>`;
    App.eq($("[data-eq-blind]"), 48);
    tic();
    minuteurInterne = setInterval(tic, 1000);
  }

  function diapoDefi() {
    const maintenant = App.maintenant();
    const jour = App.jourFestival(maintenant);
    const eclair = st.missions.find((m) => {
      if (!m.finHeure) return false;
      const j = st.jours.find((x) => x.id === m.jour);
      return j && j.date === jour && maintenant < App.dateFestival(j.date, m.finHeure);
    });
    if (eclair) {
      const fin = App.dateFestival(jour, eclair.finHeure).getTime();
      zoneDiapo.innerHTML = `
        <div class="diapo diapo--defi">
          <h2 class="affiche diapo__titre">Défi éclair</h2>
          <div class="defi-carte">
            <p class="defi-carte__lib">Jusqu'à ${fmt.heure(eclair.finHeure)}</p>
            <p class="affiche defi-carte__nom">${esc(eclair.titre.replace(/^Défi éclair\s*:\s*/i, ""))}</p>
            <p class="defi-carte__texte">${esc(eclair.texte)}</p>
            <p class="defi-gains"><span>+${eclair.xp} XP</span><span>+${eclair.jetons} jetons</span></p>
          </div>
          <p class="defi-chrono chiffres" data-chrono><small>Temps restant</small><span></span></p>
        </div>`;
      const tic = () => {
        const reste = fin - App.maintenant().getTime();
        const el = $("[data-chrono] span", zoneDiapo);
        if (!el) return;
        if (reste <= 0) { el.textContent = "Terminé"; return; }
        const mn = Math.floor(reste / 60000), s = Math.floor((reste % 60000) / 1000);
        el.textContent = mn >= 60 ? App.duree(reste) : `${String(mn).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      };
      tic();
      minuteurInterne = setInterval(tic, 1000);
    } else {
      const m = st.missions.find((x) => x.id === "m2") || st.missions[0];
      zoneDiapo.innerHTML = `
        <div class="diapo diapo--defi">
          <h2 class="affiche diapo__titre">Mission du moment</h2>
          <div class="defi-carte">
            <p class="affiche defi-carte__nom">${esc(m.titre)}</p>
            <p class="defi-carte__texte">${esc(m.texte)}</p>
            <p class="defi-gains"><span>+${m.xp} XP</span><span>+${m.jetons} jetons</span></p>
          </div>
        </div>`;
    }
  }

  /* ======================================================================
     C. Exploits
     ====================================================================== */
  const STYLE_EXPLOIT = {
    cache:   { icone: "cible",   couleur: "var(--rose)" },
    badge:   { icone: "etoile",  couleur: "var(--sodium)" },
    mission: { icone: "valide",  couleur: "var(--vert)" },
    roue:    { icone: "roue",    couleur: "var(--papier)" },
    rang:    { icone: "trophee", couleur: "#8FA6FF" }
  };
  const LIB_RARETE = { commun: "Badge commun", rare: "Badge rare", epique: "Badge épique", legendaire: "Légendaire !" };
  let dernierExploit = 0;
  const MAX_EXPLOITS = 7;

  async function majExploits() {
    const nouveaux = await api.ecranExploits(dernierExploit);
    if (!nouveaux.length) return;
    dernierExploit = nouveaux[nouveaux.length - 1].t;
    const liste = $("[data-exploits]");
    nouveaux.forEach((e) => {
      const s = STYLE_EXPLOIT[e.type] || STYLE_EXPLOIT.badge;
      const li = document.createElement("li");
      li.className = "exploit";
      li.innerHTML = `
        <span class="exploit__icone" style="--c:${s.couleur}">${icon(s.icone)}</span>
        <span class="exploit__texte"><strong>${esc(e.pseudo)}</strong>${esc(e.texte)}
          <span class="exploit__meta">${esc(e.heure)}, ${esc(LIB_RARETE[e.gain] || e.gain)}</span></span>`;
      liste.prepend(li);
    });
    while (liste.children.length > MAX_EXPLOITS) liste.lastElementChild.remove();
  }

  /* ======================================================================
     Annonces : bandeau + alerte urgente plein écran
     ====================================================================== */
  let urgente = null, derniereAlerte = 0, minuteurAlerte = null;

  async function majAnnonces() {
    const annonces = (await api.annonces()).filter((a) => !a.expiree);
    const infos = annonces.filter((a) => a.niveau !== "urgent");
    const toutes = [...annonces.filter((a) => a.niveau === "urgent"), ...infos];
    const items = toutes.map((a) => `<span><strong>${esc(a.titre)}</strong>${esc(a.texte)}</span>`).join("")
      || `<span><strong>Bienvenue</strong>Scanne les QR du site pour gagner des XP.</span>`;
    const piste = $("[data-bandeau]");
    const contenu = items + items;
    if (piste.innerHTML !== contenu) {
      piste.innerHTML = contenu;
      scene.style.setProperty("--duree-bandeau", `${Math.max(40, toutes.length * 18)}s`);
    }
    urgente = annonces.find((a) => a.niveau === "urgent") || null;
    if (urgente && Date.now() - derniereAlerte > CONFIG.alerteIntervalle) afficherAlerte();
  }

  function afficherAlerte(force = false) {
    const a = urgente || (force ? { titre: "Test d'alerte", texte: "Ceci est un essai de la régie." } : null);
    if (!a) return;
    derniereAlerte = Date.now();
    $("[data-alerte-titre]").textContent = a.titre;
    $("[data-alerte-texte]").textContent = a.texte;
    scene.style.setProperty("--duree-alerte", `${CONFIG.alerteDuree / 1000}s`);
    const bloc = $("[data-alerte]");
    const barre = $("[data-alerte-barre]");
    barre.style.animation = "none"; void barre.offsetWidth; barre.style.animation = "";
    bloc.hidden = false;
    clearTimeout(minuteurAlerte);
    minuteurAlerte = setTimeout(() => { bloc.hidden = true; }, CONFIG.alerteDuree);
  }

  /* ======================================================================
     Régie : clavier, plein écran, curseur
     ====================================================================== */
  App.ecran.boutonDemarrer($("[data-demarrer]"));
  App.ecran.curseurAuto();
  const pleinEcran = App.ecran.pleinEcran;

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "f") pleinEcran();
    else if (k === " ") {
      e.preventDefault();
      enPause = !enPause;
      $("[data-diapo]").classList.toggle("is-pause", enPause);
      if (enPause) clearTimeout(minuteurDiapo); else afficherDiapo(indexDiapo + 1);
    }
    else if (e.key === "ArrowRight") afficherDiapo(indexDiapo + 1);
    else if (e.key === "ArrowLeft") afficherDiapo(indexDiapo - 1);
    else if (k === "u") afficherAlerte(true);
    else if (k === "h") $("[data-aide]").hidden = !$("[data-aide]").hidden;
    else if (e.key === "Escape") { $("[data-aide]").hidden = true; $("[data-alerte]").hidden = true; }
  });

  /* ======================================================================
     Démarrage et boucles
     ====================================================================== */
  horloge();
  await Promise.all([sur(majTop), sur(majExploits), sur(majAnnonces)]);
  afficherDiapo(0);

  setInterval(horloge, 1000);
  setInterval(() => sur(majTop), 15000);
  setInterval(() => sur(majExploits), 7000);
  setInterval(() => sur(majAnnonces), 60000);
  setInterval(() => marquer(false), 15000);

  // Rechargement complet chaque nuit à 6h pour repartir d'un état propre
  setInterval(() => { if (App.heureFestival() === "06h00") location.reload(); }, 60000);
});
