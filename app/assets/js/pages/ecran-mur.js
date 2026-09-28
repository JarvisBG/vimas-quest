/* ==========================================================================
   Page 29 — Écran géant : mur en direct
   Aucune session joueur. Tout se met à jour seul ; la régie a quelques raccourcis clavier.
   Mise en page (28/09, modèle Otaku Quest) : UN panneau à la fois en plein écran
   (tournoi, exploits, programme, rejoindre, blind test, festival), qui tournent ;
   une seule annonce à la fois en pied. Un panneau vide est sauté.

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
  let blindTest, festival, partenaires = [], prog = { scenes: [], concerts: [] };
  try {
    [blindTest, festival, partenaires] = await Promise.all(["blindTest", "festival", "partenaires"].map(App.data.get));
  } catch (e) {
    console.error(e);
    return;
  }
  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));
  $("[data-festival]").textContent = festival.nom;

  /* QR pour rejoindre : l'adresse du site où l'écran est servi */
  try { $("[data-qr-rejoindre]").innerHTML = App.qrSvg(CONFIG.lienRejoindre, { niveau: "Q", titre: "QR pour rejoindre le jeu" }); } catch (e) { /* librairie absente */ }
  $("[data-url-rejoindre]").innerHTML = esc(CONFIG.lienRejoindre.replace(/^https?:\/\//, "")).replace(/\//g, "<wbr>/");

  /* Vitrine : le festival et ses partenaires (données du site, fixes) */
  $("[data-vitrine-sur]").textContent = `${festival.edition === 1 ? "1ʳᵉ" : `${festival.edition}ᵉ`} édition · ${festival.lieu}`;
  $("[data-vitrine-dates]").textContent = festival.dates;
  $("[data-partenaires]").innerHTML = partenaires.map((p) =>
    `<li><strong>${esc(p.nom)}</strong><span>${esc(p.role)}</span></li>`).join("");

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
     Programme (panneau « programme », nom de la scène)
     ====================================================================== */
  async function majProgramme() {
    prog = await api.programme({ joueur: false });
    const s = CONFIG.scene && prog.scenes.find((x) => x.id === CONFIG.scene);
    $("[data-lieu]").textContent = s ? s.nom : "Écran géant";
  }

  /* ======================================================================
     1. Tournoi du jour : podium (3 premiers) + registre (4e à 10e)
     ====================================================================== */
  const anciennesPlaces = new Map();
  function rendreTop(d) {
    $("[data-nb-joueurs]").textContent = fmt.nombre(d.joueurs);
    $("[data-nb-scans]").textContent = fmt.nombre(d.scansJour);
    $("[data-roi]").innerHTML = d.roi
      ? `Roi d'hier : <strong>${esc(d.roi.pseudo)}</strong>, ${fmt.nombre(d.roi.points)} XP`
      : "Remise à zéro chaque matin à 6 h";

    const evo = (j, rang) => {
      const ancien = anciennesPlaces.get(j.pseudo);
      return ancien === undefined ? "" : ancien > rang ? "is-monte" : ancien < rang ? "is-descend" : "";
    };
    const marche = (j, rang) => j ? `
      <div class="marche marche--${rang}">
        ${App.avatar(j.avatar, j.pseudo, "lg")}
        <p class="marche__pseudo">${esc(j.pseudo)}</p>
        <p class="marche__xp">${fmt.nombre(j.points)} <small>XP</small></p>
        <p class="marche__socle">${rang}</p>
      </div>` : `
      <div class="marche marche--${rang} is-vacant">
        <p class="marche__pseudo">À prendre</p>
        <p class="marche__xp">&nbsp;</p>
        <p class="marche__socle">${rang}</p>
      </div>`;
    $("[data-podium]").innerHTML = marche(d.top[1], 2) + marche(d.top[0], 1) + marche(d.top[2], 3);

    const reste = d.top.slice(3, 10);
    const registre = $("[data-registre]");
    registre.style.setProperty("--n", Math.max(reste.length, 1));
    registre.innerHTML = reste.length ? reste.map((j, i) => `
      <li class="ligne">
        <span class="registre__place">${j.place}</span>
        ${App.avatar(j.avatar, j.pseudo, "sm")}
        <span class="registre__pseudo">${esc(j.pseudo)}</span>
        <span class="registre__evo ${evo(j, i + 4)}" aria-hidden="true"></span>
        <span class="registre__xp">${fmt.nombre(j.points)} <small>XP</small></span>
      </li>`).join("")
      : `<li class="vide">${d.top.length ? "Les places 4 à 10 attendent leurs joueurs." : "Premier QR scanné, première place !"}</li>`;

    anciennesPlaces.clear();
    d.top.forEach((j, i) => anciennesPlaces.set(j.pseudo, i + 1));
  }

  /* ======================================================================
     2. Exploits : deux carnets de 4 lignes
     ====================================================================== */
  const STYLE_EXPLOIT = {
    relique: { icone: "cible",   merite: true },
    badge:   { icone: "etoile",  merite: true },
    mission: { icone: "valide",  merite: false },
    roue:    { icone: "roue",    merite: false },
    rang:    { icone: "trophee", merite: true }
  };
  const LIB_BADGE = { commun: "badge commun", rare: "badge rare", epique: "badge épique", legendaire: "badge légendaire !" };
  const LIB_RELIQUE = { commune: "relique commune", rare: "relique rare", legendaire: "relique légendaire !" };
  let exploits = [];

  function texteExploit(e) {
    const guil = (s) => `« ${s} »`;
    switch (e.type) {
      case "relique": return `a trouvé la relique ${guil(e.nom)}, ${LIB_RELIQUE[e.detail] || "relique"}`;
      case "badge":   return e.nom ? `décroche le badge ${guil(e.nom)}, ${LIB_BADGE[e.detail] || "badge"}` : "décroche un badge secret";
      case "mission": return `termine la mission ${guil(e.nom)}${e.detail ? `, +${fmt.nombre(Number(e.detail))} XP` : ""}`;
      case "roue":    return `gagne ${guil(e.nom)} à la roue`;
      default:        return `passe au rang ${e.nom}`;
    }
  }

  function rendreExploits(liste) {
    exploits = liste.slice(0, 8);
    const zone = $("[data-exploits]");
    const ligne = (e) => {
      const s = STYLE_EXPLOIT[e.type] || STYLE_EXPLOIT.badge;
      const heure = App.heureFestival(new Date(App.maintenant().getTime() - (Date.now() - e.dateMs)));
      return `
        <div class="ligne exploit">
          <span class="exploit__sceau${s.merite ? " is-merite" : ""}">${icon(s.icone)}</span>
          <div class="exploit__c">
            <p class="exploit__qui">${esc(e.pseudo)}</p>
            <p class="exploit__quoi">${esc(texteExploit(e))}</p>
          </div>
          <span class="exploit__heure">${esc(heure)}</span>
        </div>`;
    };
    const moities = exploits.length > 4 ? [exploits.slice(0, 4), exploits.slice(4)] : [exploits];
    zone.classList.toggle("is-solo", moities.length === 1);
    zone.innerHTML = moities.map((m) => `<div class="carnet" style="--n:${m.length}">${m.map(ligne).join("")}</div>`).join("");
  }

  /* ======================================================================
     3. Programme : ce qui se passe, puis ce qui arrive
     ====================================================================== */
  function rendreProgramme() {
    const now = App.maintenant().getTime();
    const liste = prog.concerts
      .filter((c) => c.finMs > now && c.debutMs - now < 8 * 3600000)
      .sort((a, b) => a.debutMs - b.debutMs);
    const enCours = liste.filter((c) => c.debutMs <= now)[0];
    const suivants = liste.filter((c) => c.debutMs > now).slice(0, 4);
    $("[data-prog-titre]").innerHTML = enCours ? "Sur <span>scène</span>" : "À <span>suivre</span>";
    $("[data-prog-note]").textContent = suivants.length > 1 ? `Les ${suivants.length} prochains rendez-vous` : "";
    const zone = $("[data-programme]");
    zone.classList.toggle("is-solo", !enCours || !suivants.length);
    zone.innerHTML = `
      ${enCours ? `
        <div class="en-scene">
          <p class="en-scene__lib">En ce moment, ${esc(enCours.scene.nom)}</p>
          <p class="affiche en-scene__nom">${esc(enCours.nom)}</p>
          <p class="en-scene__meta">${enCours.genre ? `${esc(enCours.genre)}, ` : ""}depuis ${App.duree(now - enCours.debutMs)}</p>
        </div>` : ""}
      ${suivants.length ? `
        <div class="carnet suivants" style="--n:${suivants.length}">
          ${suivants.map((c) => `
            <div class="ligne suivant c-${c.scene.couleur}">
              <span class="suivant__pastille" aria-hidden="true"></span>
              <span class="suivant__heure">${App.heureFestival(new Date(c.debutMs))}</span>
              <div class="suivant__c">
                <p class="suivant__nom">${esc(c.nom)}</p>
                <p class="suivant__scene">${esc(c.scene.nom)}${c.genre ? `, ${esc(c.genre)}` : ""}</p>
              </div>
              <span class="suivant__dans">dans ${App.duree(c.debutMs - now)}</span>
            </div>`).join("")}
        </div>` : ""}`;
    return Boolean(enCours || suivants.length);
  }

  /* ======================================================================
     4. Blind test. « C'est maintenant » dès que la régie lance la manche
     (phase QUIZ / RAID, reçue en temps réel).
     ====================================================================== */
  let phase = "EXPLORATION";
  const enManche = () => phase === "QUIZ" || phase === "RAID";
  $("[data-blind-heure]").textContent = fmt.heure(blindTest.horaire);
  $("[data-blind-texte]").textContent = `${blindTest.questions} extraits, tout le public joue depuis son téléphone. Podium sur cet écran.`;
  App.eq($("[data-eq-blind]"), 56);
  function ticBlind() {
    const debut = App.dateFestival(App.jourFestival(), blindTest.horaire).getTime();
    const ecart = debut - App.maintenant().getTime();
    $('[data-panneau="blind"]').classList.toggle("is-direct", enManche());
    $("[data-blind-dans]").textContent = enManche() ? "C'est maintenant, sors ton téléphone !"
      : ecart > 0 ? `Départ dans ${App.duree(ecart)}`
      : ecart > -30 * 60000 ? "Ça commence, sors ton téléphone !" : "Prochaine manche demain";
  }

  /* ======================================================================
     La rotation : un panneau à la fois. Un panneau sans contenu est sauté.
     ====================================================================== */
  const PANNEAUX = [
    { id: "tournoi",     present: () => true },
    { id: "exploits",    present: () => exploits.length > 0 },
    { id: "programme",   present: rendreProgramme },
    { id: "rejoindre",   present: () => true },
    { id: "blind",       present: () => true },
    { id: "partenaires", present: () => partenaires.length > 0 }
  ];
  let indexPanneau = 0, minuteurPanneau = null, enPause = false;
  scene.style.setProperty("--duree-panneau", `${CONFIG.rotation / 1000}s`);

  function afficherPanneau(i, sens = 1) {
    for (let n = 0; n < PANNEAUX.length; n++, i += sens) {
      i = (i + PANNEAUX.length) % PANNEAUX.length;
      if (PANNEAUX[i].present()) break;
    }
    indexPanneau = i;
    const id = PANNEAUX[i].id;
    $$("[data-panneau]").forEach((el) => el.classList.toggle("is-actif", el.dataset.panneau === id));
    const visibles = PANNEAUX.filter((p) => p.id === id || p.present());
    $("[data-pastilles]").innerHTML = visibles.map((p) => `<i class="${p.id === id ? "is-actif" : ""}"></i>`).join("");
    clearTimeout(minuteurPanneau);
    if (!enPause) minuteurPanneau = setTimeout(() => afficherPanneau(indexPanneau + 1), CONFIG.rotation);
  }

  /* La régie lance une manche : l'écran passe tout de suite sur le blind test */
  function appliquerPhase(nouvelle) {
    const avant = enManche();
    phase = nouvelle || "EXPLORATION";
    if (enManche() && !avant && !enPause) afficherPanneau(PANNEAUX.findIndex((p) => p.id === "blind"));
  }

  /* ======================================================================
     Annonces : bandeau + alerte urgente plein écran
     ====================================================================== */
  let urgente = null, derniereAlerte = 0, minuteurAlerte = null;

  let fileAnnonces = [], indexAnnonce = 0;
  const ANNONCE_DEFAUT = { titre: "Bienvenue", texte: "Scanne les QR des stands pour gagner des XP." };

  function rendreAnnonces(annonces) {
    const maintenant = Date.now();
    const actives = annonces.filter((a) => !a.finMs || a.finMs > maintenant);
    fileAnnonces = [...actives.filter((a) => a.niveau === "urgent"), ...actives.filter((a) => a.niveau !== "urgent")];
    const avant = urgente && urgente.id;
    urgente = actives.find((a) => a.niveau === "urgent") || null;
    // Nouvelle alerte : tout de suite ; sinon rappel toutes les 3 minutes
    if (urgente && (urgente.id !== avant || Date.now() - derniereAlerte > CONFIG.alerteIntervalle)) afficherAlerte();
  }

  /* Une annonce à la fois, qui change toutes les 9 s */
  function annonceSuivante() {
    const a = fileAnnonces.length ? fileAnnonces[indexAnnonce++ % fileAnnonces.length] : ANNONCE_DEFAUT;
    $("[data-annonce]").classList.toggle("is-urgente", a.niveau === "urgent");
    $("[data-annonce-etiq]").textContent = a.niveau === "urgent" ? "Important" : "Annonce";
    const texte = $("[data-annonce-texte]");
    texte.innerHTML = `<strong>${esc(a.titre)}</strong>${esc(a.texte)}`;
    texte.style.animation = "none"; void texte.offsetWidth; texte.style.animation = "";
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
      scene.classList.toggle("is-pause", enPause);
      if (enPause) clearTimeout(minuteurPanneau); else afficherPanneau(indexPanneau + 1);
    }
    else if (e.key === "ArrowRight") afficherPanneau(indexPanneau + 1);
    else if (e.key === "ArrowLeft") afficherPanneau(indexPanneau - 1, -1);
    else if (k === "u") afficherAlerte(true);
    else if (k === "h") $("[data-aide]").hidden = !$("[data-aide]").hidden;
    else if (e.key === "Escape") { $("[data-aide]").hidden = true; $("[data-alerte]").hidden = true; }
  });

  /* ======================================================================
     Démarrage et boucles
     ====================================================================== */
  horloge();
  await Promise.all([sur(majProgramme), sur(relire)]);
  afficherPanneau(0);
  annonceSuivante();
  ticBlind();

  setInterval(horloge, 1000);
  setInterval(ticBlind, 1000);
  setInterval(annonceSuivante, 9000);
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
