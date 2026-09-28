/* ==========================================================================
   Page 29 — Écran géant : mur en direct
   Aucune session joueur. Tout se met à jour seul ; la régie a quelques raccourcis clavier.

   Données (étape 5.1) : TOUT le mur vient d'un seul appel, App.api.mur()
   (serveur : mur_direct — tournoi du jour, compteurs, exploits, annonces, phase).
   Serveur : temps réel (App.direct, un seul canal) sur events, announcements,
   game_state. Un signal ne transporte rien : il programme une relecture, au plus
   une toutes les 5 s même pendant une rafale de scans. Filet de sécurité : 60 s
   (20 s si le canal est coupé). Démo (?mock=1) : relecture toutes les 7 s.
   Concerts : copie « programme » (5 min, partagée), aucun appel de plus.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api } = App;

  /* ---------- Paramètres (URL) ---------- */
  const params = new URLSearchParams(location.search);
  const CONFIG = {
    scene: params.get("scene"),
    rotation: Math.max(6, Number(params.get("rotation")) || 15) * 1000,
    alerteDuree: 15000,
    alerteIntervalle: 3 * 60000,
    relectureMin: 5000,          // jamais plus d'une lecture de la base toutes les 5 s
    filet: 60000, filetCoupe: 20000, demo: 7000,
    lienRejoindre: new URL("../inscription.html", location.href).href
  };
  const scene = $("[data-scene]");

  /* ---------- Mise à l'échelle 1920 × 1080 ---------- */
  App.ecran.echelle(scene);

  /* ---------- Données du site ---------- */
  let blindTest, prog = { scenes: [], concerts: [] };
  try {
    blindTest = await App.data.get("blindTest");
  } catch (e) {
    console.error(e);
    return;
  }
  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  /* QR pour rejoindre : l'adresse du site où l'écran est servi */
  try { $("[data-qr-rejoindre]").innerHTML = App.qrSvg(CONFIG.lienRejoindre, { niveau: "Q", titre: "QR pour rejoindre le jeu" }); } catch (e) { /* librairie absente */ }
  $("[data-url-rejoindre]").innerHTML = esc(CONFIG.lienRejoindre.replace(/^https?:\/\//, "")).replace(/\//g, "<wbr>/");

  /* ---------- État de connexion ---------- */
  let derniereReussite = Date.now();
  function marquer(ok) {
    const etat = $("[data-etat]");
    if (ok) derniereReussite = Date.now();
    // Canal ouvert : un mur calme ne relit qu'une fois par minute, il n'est pas hors ligne pour autant
    const horsLigne = Date.now() - derniereReussite > (canalOk ? 90000 : 45000);
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
     Programme (concerts du diaporama, nom de la scène)
     ====================================================================== */
  async function majProgramme() {
    prog = await api.programme({ joueur: false });
    const s = CONFIG.scene && prog.scenes.find((x) => x.id === CONFIG.scene);
    $("[data-lieu]").textContent = s ? s.nom : "Écran géant";
  }

  /* ======================================================================
     A. Tournoi du jour, avec animation des changements de place (FLIP)
     ====================================================================== */
  const anciennesPlaces = new Map();
  function rendreTop(d) {
    $("[data-nb-joueurs]").textContent = fmt.nombre(d.joueurs);
    $("[data-nb-scans]").textContent = fmt.nombre(d.scansJour);
    const roi = $("[data-roi]");
    roi.hidden = !d.roi;
    if (d.roi) roi.innerHTML = `Roi d'hier : <strong>${esc(d.roi.pseudo)}</strong>, ${fmt.nombre(d.roi.points)} XP`;

    const liste = $("[data-top]");
    if (!d.top.length) {
      liste.innerHTML = `<li class="top-vide">Le tournoi repart de zéro à 6 h. Premier QR scanné, première place !</li>`;
      anciennesPlaces.clear();
      return;
    }
    const avant = new Map($$(".top-ligne", liste).map((li) => [li.dataset.pseudo, li.getBoundingClientRect().top]));
    const echelleActuelle = scene.getBoundingClientRect().height / 1080;

    liste.innerHTML = d.top.map((j, i) => {
      const ancien = anciennesPlaces.get(j.pseudo);
      const rang = i + 1;
      const evo = ancien === undefined ? "" : ancien > rang ? "is-monte" : ancien < rang ? "is-descend" : "";
      return `
        <li class="top-ligne${avant.has(j.pseudo) ? "" : " is-nouveau"}" data-pseudo="${esc(j.pseudo)}" data-evo="${evo}">
          <span class="top-ligne__rang">${j.place}</span>
          ${App.avatar(j.avatar, j.pseudo, "sm")}
          <span class="top-ligne__pseudo">${esc(j.pseudo)}</span>
          <span class="top-ligne__xp">${fmt.nombre(j.points)} <small>XP</small></span>
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
    d.top.forEach((j, i) => anciennesPlaces.set(j.pseudo, i + 1));
  }

  /* ======================================================================
     B. Diaporama : concerts, blind test
     ====================================================================== */
  const DIAPOS = [
    { id: "concerts", rendu: diapoConcerts },
    { id: "blind", rendu: diapoBlind }
  ];
  let indexDiapo = 0, minuteurDiapo = null, enPause = false, minuteurInterne = null;
  let phase = "EXPLORATION";
  const enManche = () => phase === "QUIZ" || phase === "RAID";
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

  function diapoConcerts() {
    const now = App.maintenant().getTime();
    const liste = prog.concerts
      .filter((c) => c.finMs > now && c.debutMs - now < 8 * 3600000)
      .sort((a, b) => a.debutMs - b.debutMs);
    const enCours = liste.filter((c) => c.debutMs <= now);
    const suivants = liste.filter((c) => c.debutMs > now).slice(0, enCours.length ? 3 : 5);
    zoneDiapo.innerHTML = `
      <div class="diapo">
        <h2 class="affiche diapo__titre">${enCours.length ? "Sur scène" : "À suivre"}</h2>
        ${enCours.map((c) => `
          <div class="en-scene">
            <p class="en-scene__lib">En ce moment, ${esc(c.scene.nom)}</p>
            <p class="affiche en-scene__nom">${esc(c.nom)}</p>
            <p class="en-scene__meta">${c.genre ? `${esc(c.genre)}, ` : ""}depuis ${App.duree(now - c.debutMs)}</p>
          </div>`).join("")}
        ${enCours.length && suivants.length ? `<h3 class="affiche" style="font-size:48px">Ensuite</h3>` : ""}
        <div class="suivants">
          ${suivants.map((c) => `
            <div class="suivant c-${c.scene.couleur}">
              <span><span class="suivant__heure">${App.heureFestival(new Date(c.debutMs))}</span><span class="suivant__dans">dans ${App.duree(c.debutMs - now)}</span></span>
              <span><span class="suivant__nom">${esc(c.nom)}</span><span class="suivant__scene" style="display:block">${esc(c.scene.nom)}${c.genre ? `, ${esc(c.genre)}` : ""}</span></span>
            </div>`).join("")}
        </div>
        ${!enCours.length && !suivants.length ? `<p class="vide-diapo">${prog.concerts.length ? "Fin des concerts pour ce soir. Merci et à demain !" : "Programme bientôt annoncé."}</p>` : ""}
      </div>`;
  }

  /* Horaire : réglage du site (blindTest.horaire). « C'est maintenant » dès que
     la régie lance la manche (phase QUIZ / RAID, reçue en temps réel). */
  function diapoBlind() {
    const debut = App.dateFestival(App.jourFestival(), blindTest.horaire).getTime();
    const tic = () => {
      const dans = $(".blind-dans", zoneDiapo);
      if (!dans) return;
      const ecart = debut - App.maintenant().getTime();
      $(".diapo--blind", zoneDiapo).classList.toggle("is-direct", enManche());
      dans.textContent = enManche() ? "C'est maintenant, sors ton téléphone !"
        : ecart > 0 ? `Départ dans ${App.duree(ecart)}`
        : ecart > -30 * 60000 ? "Ça commence, sors ton téléphone !" : "Prochaine manche demain";
    };
    zoneDiapo.innerHTML = `
      <div class="diapo diapo--blind">
        <h2 class="affiche diapo__titre">Blind test</h2>
        <p class="blind-heure">${fmt.heure(blindTest.horaire)}</p>
        <p class="blind-dans"></p>
        <p class="blind-texte">${blindTest.questions} extraits, tout le public joue depuis son téléphone. Podium sur cet écran.</p>
        <div class="eq blind-eq" data-eq-blind></div>
      </div>`;
    App.eq($("[data-eq-blind]"), 48);
    tic();
    minuteurInterne = setInterval(tic, 1000);
  }

  /* La régie lance une manche : le diaporama passe tout de suite sur le blind test */
  function appliquerPhase(nouvelle) {
    const avant = enManche();
    phase = nouvelle || "EXPLORATION";
    if (enManche() && !avant && !enPause) afficherDiapo(DIAPOS.findIndex((d) => d.id === "blind"));
  }

  /* ======================================================================
     C. Exploits
     ====================================================================== */
  const STYLE_EXPLOIT = {
    relique: { icone: "cible",   couleur: "var(--rose)" },
    badge:   { icone: "etoile",  couleur: "var(--sodium)" },
    mission: { icone: "valide",  couleur: "var(--vert)" },
    roue:    { icone: "roue",    couleur: "var(--papier)" },
    rang:    { icone: "trophee", couleur: "#FF9A85" }
  };
  const LIB_BADGE = { commun: "Badge commun", rare: "Badge rare", epique: "Badge épique", legendaire: "Badge légendaire !" };
  const LIB_RELIQUE = { commune: "Relique commune", rare: "Relique rare", legendaire: "Relique légendaire !" };
  const MAX_EXPLOITS = 7;
  const exploitsVus = new Set();

  function texteExploit(e) {
    const guil = (s) => `« ${s} »`;
    switch (e.type) {
      case "relique": return { texte: `a trouvé la relique ${guil(e.nom)}`, gain: LIB_RELIQUE[e.detail] || "Relique" };
      case "badge":   return { texte: e.nom ? `décroche le badge ${guil(e.nom)}` : "décroche un badge secret", gain: LIB_BADGE[e.detail] || "Badge" };
      case "mission": return { texte: `termine la mission ${guil(e.nom)}`, gain: e.detail ? `+${fmt.nombre(Number(e.detail))} XP` : "Mission" };
      case "roue":    return { texte: `gagne ${guil(e.nom)} à la roue`, gain: e.detail === "badge" ? "Badge" : "Lot à retirer au stand" };
      default:        return { texte: `passe au rang ${e.nom}`, gain: "Nouveau rang" };
    }
  }

  function rendreExploits(exploits) {
    const liste = $("[data-exploits]");
    // Du plus ancien au plus récent : chaque nouveau passe en tête
    exploits.filter((e) => !exploitsVus.has(e.id)).reverse().forEach((e) => {
      exploitsVus.add(e.id);
      const s = STYLE_EXPLOIT[e.type] || STYLE_EXPLOIT.badge;
      const { texte, gain } = texteExploit(e);
      const heure = App.heureFestival(new Date(App.maintenant().getTime() - (Date.now() - e.dateMs)));
      const li = document.createElement("li");
      li.className = "exploit";
      li.innerHTML = `
        <span class="exploit__icone" style="--c:${s.couleur}">${icon(s.icone)}</span>
        <span class="exploit__texte"><strong>${esc(e.pseudo)}</strong> ${esc(texte)}
          <span class="exploit__meta">${esc(heure)}, ${esc(gain)}</span></span>`;
      liste.prepend(li);
    });
    while (liste.children.length > MAX_EXPLOITS) liste.lastElementChild.remove();
    if (exploitsVus.size > 200) exploitsVus.clear();   // l'écran tourne toute la nuit
    exploits.forEach((e) => exploitsVus.add(e.id));
  }

  /* ======================================================================
     Annonces : bandeau + alerte urgente plein écran
     ====================================================================== */
  let urgente = null, derniereAlerte = 0, minuteurAlerte = null;

  function rendreAnnonces(annonces) {
    const maintenant = Date.now();
    const actives = annonces.filter((a) => !a.finMs || a.finMs > maintenant);
    const toutes = [...actives.filter((a) => a.niveau === "urgent"), ...actives.filter((a) => a.niveau !== "urgent")];
    const items = toutes.map((a) => `<span><strong>${esc(a.titre)}</strong>${esc(a.texte)}</span>`).join("")
      || `<span><strong>Bienvenue</strong>Scanne les QR du site pour gagner des XP.</span>`;
    const piste = $("[data-bandeau]");
    const contenu = items + items;
    if (piste.innerHTML !== contenu) {
      piste.innerHTML = contenu;
      scene.style.setProperty("--duree-bandeau", `${Math.max(40, toutes.length * 18)}s`);
    }
    const avant = urgente && urgente.id;
    urgente = actives.find((a) => a.niveau === "urgent") || null;
    // Nouvelle alerte : tout de suite ; sinon rappel toutes les 3 minutes
    if (urgente && (urgente.id !== avant || Date.now() - derniereAlerte > CONFIG.alerteIntervalle)) afficherAlerte();
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
     Lecture de la base : UN appel pour tout le mur
     ====================================================================== */
  let dernierReleve = 0, relectureProgrammee = null, canalOk = false;

  async function relire() {
    const d = await api.mur();
    dernierReleve = Date.now();
    rendreTop(d);
    rendreExploits(d.exploits);
    rendreAnnonces(d.annonces);
    appliquerPhase(d.phase);
  }

  /* Un signal = une relecture prévue. Les signaux suivants rejoignent la même :
     pendant une rafale de scans, l'écran relit au plus toutes les 5 s. */
  function programmer(delai = 1500) {
    if (relectureProgrammee) return;
    const attente = Math.max(delai, CONFIG.relectureMin - (Date.now() - dernierReleve));
    relectureProgrammee = setTimeout(() => {
      relectureProgrammee = null;
      if (document.hidden) return;   // relu au retour de l'onglet
      sur(relire);
    }, attente);
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
  await Promise.all([sur(majProgramme), sur(relire)]);
  afficherDiapo(0);

  setInterval(horloge, 1000);
  setInterval(() => sur(majProgramme), 5 * 60000);   // copie « programme » : 0 appel la plupart du temps
  setInterval(() => marquer(false), 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) programmer(0); });

  if (App.mock) {
    setInterval(() => { if (!document.hidden) sur(relire); }, CONFIG.demo);
  } else {
    /* Temps réel : écran géant seulement (forfait gratuit : 200 connexions) */
    try {
      App.direct("mur", (c) => c
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => programmer())
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => programmer(600))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state" }, (charge) => {
          if (charge.new && charge.new.phase) appliquerPhase(charge.new.phase);
          programmer(600);
        }),
      (statut) => {
        canalOk = statut === "SUBSCRIBED";
        if (canalOk) programmer(0);   // un signal a pu être manqué pendant la coupure
      });
    } catch (e) { console.warn(e); }
    // Filet de sécurité : 60 s, ou 20 s tant que le canal est coupé
    setInterval(() => {
      if (Date.now() - dernierReleve > (canalOk ? CONFIG.filet : CONFIG.filetCoupe)) programmer(0);
    }, 5000);
  }

  // Rechargement complet chaque nuit à 6h pour repartir d'un état propre
  setInterval(() => { if (App.heureFestival() === "06h00") location.reload(); }, 60000);
});
