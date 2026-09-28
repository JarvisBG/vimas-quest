/* ==========================================================================
   Vimas Quest — app.js (commun à toutes les pages)
   Contenu : icônes SVG, accès aux données, session, navigation, utilitaires.
   Aucune dépendance. Expose window.App.
   ========================================================================== */
(function () {
  "use strict";

  const App = {};
  // Racine du site, déduite de l'emplacement de ce fichier (fonctionne aussi depuis /ecran/)
  const RACINE = document.currentScript ? new URL("../../", document.currentScript.src).href : new URL("./", location.href).href;
  App.racine = RACINE;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  App.reduceMotion = reduceMotion;

  /* ---------- Sélecteurs et helpers DOM ---------- */
  App.$ = (sel, ctx = document) => ctx.querySelector(sel);
  App.$$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  App.esc = esc;

  /* ---------- Icônes (sprite injecté une seule fois, fonctionne aussi en file://) ---------- */
  const ICONS = {
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M16 16h2v2"/>',
    fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    billet: '<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z"/><path d="M15 6v2M15 11v2M15 16v2"/>',
    lieu: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    trophee: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8M9 17h6"/>',
    micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    roue: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
    cible: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    eclair: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    etoile: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    onde: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>',
    retour: '<path d="M15 5l-7 7 7 7"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    clavier: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    coche: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    lampe: '<path d="M8 3h8l-2 6h-4z"/><path d="M10 9v12h4V9"/>',
    alerte: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    des: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01"/>',
    sortie: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
    carte: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 3v2h4V3"/><circle cx="12" cy="11" r="2.5"/><path d="M8.5 17c.6-1.8 2-2.7 3.5-2.7s2.9.9 3.5 2.7"/>',
    calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    plus: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    cloche: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    coeur: '<path d="M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z"/>',
    plan: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    partage: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
    sondage: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    passeport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
    cadenas: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
    ampoule: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    couverts: '<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6M17 21V3c-2 1.5-3 4-3 7s1 4 3 4"/>',
    valide: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>',
    goutte: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
    croix: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    wc: '<circle cx="7" cy="5" r="2"/><circle cx="17" cy="5" r="2"/><path d="M7 9v12M4 9h6v6M17 9l-3 8h6l-3-8M17 17v4"/>',
    tente: '<path d="M3 20L12 4l9 16z"/><path d="M12 4v16M9 20l3-6 3 6"/>',
    entree: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
    position: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
    telephone: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    zoomplus: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M16 16l5 5"/>',
    zoommoins: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M16 16l5 5"/>',
    cadre: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    gemme: '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M10 4l-2 5 4 11 4-11-2-5"/>',
    cadeau: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 3.8 8.5 8 12 8zM12 8s1.5-5 4-4.2S15.5 8 12 8z"/>'
  };

  function injectSprite() {
    if (document.getElementById("app-sprite")) return;
    const symbols = Object.entries(ICONS)
      .map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${d}</symbol>`)
      .join("");
    const wrap = document.createElement("div");
    wrap.innerHTML = `<svg id="app-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">${symbols}</svg>`;
    document.body.prepend(wrap.firstChild);
  }

  /* Contenu SVG brut d'une icône (utile pour la dessiner dans un canvas) */
  App.iconeBrute = (name) => ICONS[name] || "";

  App.icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  /* Remplace <i data-icon="qr"></i> par le SVG correspondant */
  function hydrateIcons(ctx = document) {
    App.$$("[data-icon]", ctx).forEach((el) => {
      el.outerHTML = App.icon(el.dataset.icon, el.className);
    });
  }
  App.hydrateIcons = hydrateIcons;

  /* ---------- Mode : serveur (Supabase) ou démo (mock.js) ----------
     ?mock=1 passe en démo, ?mock=0 revient au serveur ; le choix est retenu sur l'appareil.
     Sans assets/js/config.js chargé avant ce fichier, c'est toujours la démo. */
  const CLE_MODE = "vimasquest.mock";
  try {
    const demande = new URLSearchParams(location.search).get("mock");
    if (demande === "1") localStorage.setItem(CLE_MODE, "1");
    if (demande === "0") localStorage.removeItem(CLE_MODE);
  } catch (e) { /* stockage indisponible */ }
  const configServeur = typeof SUPABASE_URL === "string" && typeof SUPABASE_ANON_KEY === "string";
  let demoRetenue = false;
  try { demoRetenue = localStorage.getItem(CLE_MODE) === "1"; } catch (e) { /* ignore */ }
  App.mock = !configServeur || demoRetenue;

  /* ---------- Couche de données ----------
     get(cle) lit mock.js, sauf si assets/js/serveur.js a déclaré une source serveur
     pour cette clé (App.sources[cle]) et qu'on n'est pas en démo.
     Correspondance clé → table / RPC : data/CORRESPONDANCE.md. */
  App.sources = {};
  const memoSources = {};
  App.data = {
    async get(cle) {
      if (!App.mock && App.sources[cle]) {
        memoSources[cle] = memoSources[cle] || App.sources[cle]().catch((e) => { delete memoSources[cle]; throw e; });
        return JSON.parse(JSON.stringify(await memoSources[cle]));
      }
      const source = window.MOCK || {};
      if (!(cle in source)) throw new Error(`Donnée inconnue : ${cle}`);
      return JSON.parse(JSON.stringify(source[cle]));
    },
    /* Oublie une source serveur déjà lue (après une écriture qui la modifie) */
    oublier(cle) { delete memoSources[cle]; }
  };

  /* ---------- Configuration ---------- */
  App.config = {
    demo: App.mock,   /* raccourcis et horloge de démonstration : seulement en mode démo */
    latence: 450      /* délai simulé des appels réseau (démo), en ms */
  };
  const attendre = (ms = App.config.latence) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Actions (écriture / vérification) ----------
     Chaque méthode correspond à une future route d'API, indiquée en commentaire.
     Les erreurs métier sont renvoyées dans l'objet résultat, pas en exception. */
  const normaliser = (txt) => String(txt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  /* Partie du joueur conservée sur le téléphone en mode démo (remplacée par le serveur plus tard) */
  App.partie = {
    cle: (id) => `vimasquest.partie.${id}`,
    get(id) {
      let p;
      try { p = JSON.parse(localStorage.getItem(this.cle(id))); } catch (e) { p = null; }
      return { ...this.vide(), ...(p || {}), collection: { ...this.vide().collection, ...((p && p.collection) || {}) } };
    },
    set(id, partie) {
      try { localStorage.setItem(this.cle(id), JSON.stringify(partie)); } catch (e) { /* ignore */ }
    },
    vide: () => ({ scans: {}, progression: {}, terminees: {}, activite: [], amis: [], tirages: [], bons: null, collection: { badges: {}, artistes: {}, stands: {}, reliques: {} } })
  };

  /* Démo : le joueur existant j1 a déjà joué ; tout nouveau profil part de zéro */
  const etatDeBase = (joueur, etats) => (joueur.id === "j1" ? etats.confirme : etats.debutant);

  /* Fusion de la progression de base (serveur simulé) et de la partie locale */
  const fusion = (base, partie) => ({
    collection: {
      badges: { ...base.collection.badges, ...partie.collection.badges },
      artistes: { ...base.collection.artistes, ...partie.collection.artistes },
      stands: { ...base.collection.stands, ...partie.collection.stands },
      reliques: { ...(base.collection.reliques || {}), ...partie.collection.reliques }
    },
    progression: { ...base.progression, ...partie.progression },
    terminees: { ...(base.terminees || {}), ...(partie.terminees || {}) }
  });

  /* Disponibilité d'une mission dans le temps et selon le rang */
  const disponibilite = (m, maintenant, jours, rangJoueur, rangs, xpJoueur = 0) => {
    if (m.rangMin) {
      const requis = rangs.findIndex((r) => r.nom === m.rangMin);
      if (rangJoueur.index < requis) return { etat: "verrouillee", reste: rangs[requis].xp - xpJoueur };
    }
    if (m.finHeure) {
      const jour = jours.find((j) => j.id === m.jour);
      const fin = App.dateFestival(jour.date, m.finHeure);
      if (App.jourFestival(maintenant) < jour.date) return { etat: "a-venir" };
      if (maintenant >= fin) return { etat: "expiree" };
      return { etat: "ouverte", fin: fin.getTime() };
    }
    return { etat: "ouverte" };
  };

  /* ---------- Classement simulé ---------- */
  const xpAuRang = (r, c) => Math.round(c.xpPremier * Math.pow(r, -c.pente));
  const rangPourXp = (xp, c) => Math.min(c.total, Math.max(1, Math.round(Math.pow(c.xpPremier / Math.max(xp, 1), 1 / c.pente))));
  const graine = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };

  /* Joueurs fictifs déterministes (même rang = même pseudo), légèrement mouvants dans le temps */
  const fabriqueFictifs = ({ noms, avatars, rangs, c, periode, tranche }) => {
    const decalage = periode === "jour" ? 7 : 3;
    return (rang) => {
      const g = graine(rang * decalage + 1);
      const pseudo = noms.debut[Math.floor(g * noms.debut.length)] + noms.fin[Math.floor(graine(rang + 99) * noms.fin.length)] +
        (graine(rang + 7) > 0.55 ? Math.floor(graine(rang + 3) * 90 + 10) : "");
      const bonus = rang <= 20 ? Math.floor(graine(rang + tranche) * 12) * 5 : 0;
      const xp = xpAuRang(rang, c) + bonus;
      const ev = Math.round((graine(rang + tranche * 3) - 0.45) * 8);
      return {
        rang, pseudo, xp, evolution: ev,
        avatar: avatars[Math.floor(graine(rang + 13) * avatars.length)],
        rangNom: App.rang(periode === "general" ? xp : xp * 4, rangs).actuel.nom
      };
    };
  };

  /* Blind test : 24 joueurs simulés, réponses et temps déterministes */
  const simulationBlind = (D, noms, avatars) => {
    const NB = 24;
    const joueurs = Array.from({ length: NB }, (_, k) => ({
      pseudo: noms.debut[Math.floor(graine(k * 5 + 1) * noms.debut.length)] + noms.fin[Math.floor(graine(k * 7 + 2) * noms.fin.length)] +
        (graine(k + 40) > 0.5 ? Math.floor(graine(k + 41) * 90 + 10) : ""),
      avatar: avatars[Math.floor(graine(k + 60) * avatars.length)],
      niveau: 0.35 + graine(k + 80) * 0.6
    }));
    const reponse = (k, i) => {
      const juste = graine(k * 31 + i * 7 + 3) < joueurs[k].niveau;
      const temps = 1 + graine(k * 13 + i * 11 + 5) * (D.question - 3);
      return { juste, temps, points: pointsBlind(juste, temps, D) };
    };
    const scores = (jusqua) => joueurs.map((j, k) => {
      let total = 0;
      for (let i = 0; i <= jusqua; i++) total += reponse(k, i).points;
      return { ...j, points: total };
    }).sort((x, y) => y.points - x.points).map((j, r) => ({ ...j, rang: r + 1 }));
    return { joueurs, reponse, scores };
  };
  /* Barème : 1000 points pour une réponse immédiate, 500 au gong */
  const pointsBlind = (juste, temps, D) => (juste ? Math.round(1000 - 500 * Math.min(1, temps / D.question)) : 0);
  const PARTICIPANTS_BLIND = 1240;

  /* Horloge de manche partagée (écran géant, téléphones, régie).
     En démo, elle vit dans le localStorage : deux onglets du même navigateur restent synchronisés.
     En production : fournie par le serveur. */
  const CLE_BLIND = "vimasquest.blind.horloge";
  App.blindHorloge = {
    prevue(cfg) {
      const prevu = App.dateFestival(App.jourFestival(), cfg.horaire).getTime();
      return Date.now() + (prevu - App.maintenant().getTime());
    },
    lire() {
      try { return JSON.parse(localStorage.getItem(CLE_BLIND)); } catch (e) { return null; }
    },
    ecrire(h) {
      try { localStorage.setItem(CLE_BLIND, JSON.stringify(h)); } catch (e) { /* ignore */ }
    },
    effacer() {
      try { localStorage.removeItem(CLE_BLIND); } catch (e) { /* ignore */ }
    },
    etat(cfg) {
      const h = this.lire() || { ancre: this.prevue(cfg), pauseDepuis: null, id: `prevue-${App.jourFestival()}` };
      return { ...h, ecoule: (h.pauseDepuis ?? Date.now()) - h.ancre };
    },
    demarrer(delai = 5000) {
      this.ecrire({ ancre: Date.now() + delai, pauseDepuis: null, id: `m${Date.now()}` });
    },
    pause(cfg) {
      const h = this.etat(cfg);
      if (h.pauseDepuis === null) this.ecrire({ ancre: h.ancre, id: h.id, pauseDepuis: Date.now() });
    },
    reprendre(cfg) {
      const h = this.etat(cfg);
      if (h.pauseDepuis !== null) this.ecrire({ ancre: h.ancre + (Date.now() - h.pauseDepuis), id: h.id, pauseDepuis: null });
    },
    avancer(cfg, ms) {
      const h = this.etat(cfg);
      this.ecrire({ ancre: h.ancre - ms, id: h.id, pauseDepuis: h.pauseDepuis });
    }
  };

  /* Code ami stable dérivé du joueur */
  const codeAmi = (joueur) => {
    const connu = (window.MOCK.joueursConnus || []).find((j) => j.joueur === joueur.id);
    if (connu) return connu.code;
    const base = (joueur.pseudo.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase() + "XXXX").slice(0, 4);
    let h = 0;
    for (const c of joueur.id) h = (h * 31 + c.charCodeAt(0)) % 10000;
    return `${base}-${String(h).padStart(4, "0")}`;
  };
  App.codeAmi = codeAmi;

  /* ---------- Collecte (6.3 bis) : fiche fan et coffre du scan ----------
     Mêmes règles que la base (sources/92_collecte.sql) : la fiche d'abord,
     puis (le soir) les questions du soir, puis la banque. */
  const erreurMetier = (code) => Object.assign(new Error(code), { code });

  /* Ordre d'affichage des réponses : mélangé (biais du premier bouton), sauf
     les échelles ; « bas » (Autre, Aucune…) reste toujours en dernier. */
  App.ordreReponses = (options, ordreFixe) => {
    if (ordreFixe) return options.slice();
    const bas = options.filter((o) => o.bas || o.valeur === "autre");
    const reste = options.filter((o) => !bas.includes(o));
    for (let i = reste.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [reste[i], reste[j]] = [reste[j], reste[i]];
    }
    return reste.concat(bas);
  };

  /* Une question en un tapotement : boutons data-choix="valeur". Libellés
     courts et nombreux (0 à 10) : grille ; courts : deux colonnes. */
  App.questionHTML = (q, { titreId = "" } = {}) => {
    const options = App.ordreReponses(q.options || [], q.ordre_fixe);
    const court = options.every((o) => o.libelle.length <= 14);
    const genre = options.length > 6 && options.every((o) => /^[0-9]{1,2}$/.test(o.libelle)) ? " choix--echelle"
      : court && options.length >= 4 ? " choix--deux" : "";
    return `
      <div class="question" data-question="${esc(q.cle || "")}">
        <p class="question__texte"${titreId ? ` id="${titreId}"` : ""}>${esc(q.texte)}</p>
        <div class="choix${genre}" role="group" aria-label="${esc(q.texte)}">
          ${options.map((o) => `<button class="choix__btn" type="button" data-choix="${esc(o.valeur)}">${esc(o.libelle)}</button>`).join("")}
        </div>
      </div>`;
  };

  /* Copie du coffre fermé sur le téléphone (mode serveur) : la page de scan
     la montre sans requête ; player_home et scan_qr la tiennent à jour. */
  App.coffreLocal = {
    cle: () => `vimasquest.coffre.${(App.session.get() || {}).id || "?"}`,
    lire() { try { return JSON.parse(localStorage.getItem(this.cle())); } catch (e) { return null; } },
    ecrire(c) {
      try { if (c) localStorage.setItem(this.cle(), JSON.stringify(c)); else localStorage.removeItem(this.cle()); } catch (e) { /* ignore */ }
    },
    effacer() { this.ecrire(null); }
  };

  const ficheEtat = async (partie) => {
    const cfg = await App.data.get("fiche");
    const fiche = partie.fiche || {};
    const manquants = cfg.champs.filter((c) => !fiche[c.id]).map((c) => c.id);
    return {
      faits: cfg.champs.length - manquants.length, total: cfg.champs.length, manquants,
      majeur: cfg.majeurs.includes(fiche.tranche_age), telephone: !!partie.contact,
      xpParReponse: cfg.xpParReponse, bonusComplet: cfg.bonusComplet
    };
  };

  /* Journée de jeu : 6 h → 6 h, comme public.jour_jeu() */
  const jourDeJeu = (d = App.maintenant()) => App.jourFestival(new Date(d.getTime() - 6 * 3600000));

  const prochaineQuestion = async (partie) => {
    const [cfg, banque, cc, artistes, jours] =
      await Promise.all(["fiche", "banqueQuestions", "coffreConfig", "artistes", "jours"].map(App.data.get));
    const fiche = partie.fiche || {};
    const champ = cfg.champs.find((c) => !fiche[c.id]);
    if (champ) return { cle: `profil:${champ.id}`, texte: champ.titre, options: champ.options, ordre_fixe: !!champ.ordreFixe };

    const maintenant = App.maintenant();
    const hm = App.heureFestival(maintenant).replace("h", ":").padStart(5, "0");
    const soir = hm >= cc.soirDebut || hm < "06:00";
    const jour = jourDeJeu(maintenant);
    const rep = partie.reponses || {};
    const repondu = (q) => (rep[q.id] || []).some((r) => !q.chaqueJour || r.jour === jour);
    const candidates = banque
      .filter((q) => (q.moment === "toujours" || soir) && !repondu(q))
      .sort((a, b) => (b.moment === "soir") - (a.moment === "soir") || a.id - b.id);
    for (const q of candidates) {
      let options = q.options;
      if (q.type === "artiste") {
        const j = jours.find((x) => x.date === jour);
        options = artistes
          .filter((a) => j && a.jour === j.id && App.dateConcert(a, jours) <= maintenant)
          .map((a) => ({ valeur: a.id, libelle: a.nom }));
        if (options.length < 2) continue;
      }
      return { cle: `micro:${q.id}`, texte: q.question, options, ordre_fixe: !!q.ordreFixe || q.type === "artiste" };
    }
    return null;
  };

  const coffreJson = (c) => c && ({ ...c, xp_reponse: c.question.cle.startsWith("profil:") ? 20 : 10 });

  App.api = {
    /* Accueil : line-up (une entrée par concert) et lots physiques de la roue.
       Serveur : programme_public (copie « programme » partagée) + roulette_prizes. */
    async vitrine() {
      const [artistes, scenes, lots] = await Promise.all(["artistes", "scenes", "lots"].map(App.data.get));
      const sceneParId = Object.fromEntries(scenes.map((x) => [x.id, x]));
      // Les concerts après minuit sont classés en fin de soirée
      const ordre = (h) => { const [hh, mm] = h.split(":").map(Number); return (hh < 8 ? hh + 24 : hh) * 60 + mm; };
      return {
        concerts: artistes.map((a) => ({
          jour: a.jour, ordre: ordre(a.debut), heure: App.fmt.heure(a.debut), nom: a.nom, genre: a.genre || "",
          tete: !!a.tete, scene: sceneParId[a.scene] || { nom: "", couleur: "nuit" }
        })),
        lots: lots.map((l) => ({ nom: l.nom, rarete: l.rarete, stock: l.stock }))
      };
    },

    /* La billetterie est-elle ouverte ? (faut-il un ticket papier pour jouer ?)
       Serveur : table billetterie_config. */
    async billetterie() {
      const b = await App.data.get("billetterieDemo");
      return { actif: !!b.actif, prix: b.prix, message: b.message || "" };
    },

    /* Ticket papier de la billetterie vendeur — RPC ticket_verifier */
    async verifierBillet(code) {
      await attendre();
      const tickets = await App.data.get("tickets");
      const t = tickets.find((x) => x.code === String(code).toUpperCase());
      if (!t) return { statut: "inconnu" };
      if (t.etat !== "libre") return { statut: t.etat };
      return { statut: "nouveau", billet: { code: t.code, type: "Ticket" } };
    },

    /* En mode serveur, le pseudo n'est jamais vérifié au fil de la frappe : c'est
       create_player qui tranche. La démo garde la vérification pour montrer l'écran. */
    async pseudoDisponible(pseudo) {
      await attendre(250);
      const pris = await App.data.get("pseudosPris");
      return !pris.includes(normaliser(pseudo));
    },

    /* Reprise de partie avec le code secret — RPC login_with_code */
    async reprendre(code) {
      await attendre();
      const propre = String(code || "").trim().toUpperCase();
      const joueurs = await App.data.get("joueurs");
      const j = joueurs.find((x) => x.code === propre);
      if (!j) { const e = new Error("CODE_INCONNU"); e.code = "CODE_INCONNU"; throw e; }
      const session = { ...j, connecteLe: new Date().toISOString() };
      App.session.set(session);
      return session;
    },

    /* GET /api/joueurs/moi/carte */
    async carte() {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const etats = await App.data.get("etatsJoueur");
      const base = etatDeBase(joueur, etats);
      const partie = App.partie.get(joueur.id);
      const missions = await App.data.get("missions");
      const { progression, collection } = fusion(base, partie);
      const catalogueBadges = await App.data.get("badges");
      const enCours = Object.entries(progression).map(([id, fait]) => ({ ...missions.find((x) => x.id === id), fait }));
      const scansDuJour = partie.activite.filter((a) => a.type === "scan" && a.jour === App.jourFestival());

      /* Même forme que la version serveur (player_home) : la page ne lit
         plus le programme ni les annonces elle-même. */
      const [artistes, scenes, jours, roue, roi, annonces] = await Promise.all([
        ...["artistes", "scenes", "jours", "roue", "roiVeille"].map(App.data.get), this.annonces()]);
      const favoris = partie.favoris || base.favoris;
      const maintenant = App.maintenant().getTime();
      const concerts = artistes
        .map((a) => {
          const debutMs = App.dateConcert(a, jours).getTime();
          return { ...a, debutMs, finMs: debutMs + (a.duree || 60) * 60000, favori: favoris.includes(a.id) };
        })
        .filter((a) => a.finMs > maintenant)
        .sort((a, b) => a.debutMs - b.debutMs);
      const c = concerts.find((x) => x.favori) || concerts[0];
      const urgente = annonces.find((a) => a.niveau === "urgent" && !a.lu && !a.expiree);
      return {
        joueur,
        ...base,
        favoris: partie.favoris || base.favoris,
        badges: { obtenus: Object.keys(collection.badges).length, total: catalogueBadges.length },
        jour: {
          scans: base.jour.scans + scansDuJour.length,
          xp: base.jour.xp + partie.activite.filter((a) => a.jour === App.jourFestival()).reduce((t, a) => t + a.xp, 0)
        },
        activite: [...partie.activite, ...base.activite].slice(0, 6),
        missions: enCours,
        concert: c ? {
          id: c.id, nom: c.nom, genre: c.genre, photo: c.photo, debutMs: c.debutMs, finMs: c.finMs,
          favori: c.favori, scene: scenes.find((s) => s.id === c.scene)
        } : null,
        annonce: urgente ? { id: urgente.id, titre: urgente.titre, texte: urgente.texte } : null,
        roue: { cout: roue.coutTirage },
        roi: App.jourFestival() > jours[0].date ? roi : null,
        pass: { actif: true, prix: 500 },
        fiche: await ficheEtat(partie),
        coffre: coffreJson(partie.coffre) || null
      };
    },

    /* Ce qui manque à la fiche (inscription.html?fiche=1) — serveur : la carte */
    async ficheEtat() {
      const joueur = App.session.get();
      return joueur ? ficheEtat(App.partie.get(joueur.id)) : null;
    },

    /* POST /api/scans  { code }
       Statuts : ok | deja | inactif | inconnu | billet */
    async scanner(contenu) {
      await attendre(400);
      const joueur = App.session.get();
      if (!joueur) return { statut: "session" };

      const brut = String(contenu || "").trim();
      if (/^RSN-AMI:/i.test(brut)) {
        const r = await this.ajouterAmi(brut);
        return r.ok ? { statut: "ami", ami: r.ami } : { statut: "ami-" + r.erreur, ami: r.ami };
      }
      if (/RSN[-\s]?[A-Z0-9]{4}[-\s]?[A-Z0-9]{4}/i.test(brut)) return { statut: "billet" };
      let direct = null;
      try { direct = new URL(brut).searchParams.get("code"); } catch (e) { /* code seul */ }
      const cle = (direct || brut.split(/[/?#]/).filter(Boolean).pop() || "").toUpperCase();
      const qrs = await App.data.get("qrcodes");
      const qr = qrs.find((q) => q.code === cle || q.court === cle);
      if (!qr) return { statut: "inconnu" };

      const maintenant = App.maintenant();
      const jour = App.jourFestival(maintenant);
      if (qr.actifDes && maintenant < App.dateFestival(jour, qr.actifDes)) {
        return { statut: "inactif", qr, depuis: qr.actifDes };
      }

      const partie = App.partie.get(joueur.id);
      const precedent = partie.scans[qr.code];
      if (precedent && precedent.jour === jour) return { statut: "deja", qr, heure: precedent.heure };

      const [rangs, missions, etats, jours, stands, artistes] =
        await Promise.all(["rangs", "missions", "etatsJoueur", "jours", "stands", "artistes"].map(App.data.get));
      const base = etatDeBase(joueur, etats);
      const avant = App.rang(joueur.xp, rangs);
      const heure = App.heureFestival(maintenant).replace("h", ":");
      const detail = [{ libelle: qr.nom, xp: qr.xp, jetons: qr.jetons }];

      // Missions liées
      const { progression, collection } = fusion(base, partie);
      const quand = () => ({ jour, heure });
      const debloques = [];

      // Stand ou food-truck débloqué
      const stand = stands.find((x) => x.qr === qr.code);
      if (stand && !collection.stands[stand.id]) {
        partie.collection.stands[stand.id] = quand();
        debloques.push({ type: "stand", nom: stand.nom });
      }
      // Relique trouvée
      if (qr.type === "relique" && !collection.reliques[qr.code]) {
        partie.collection.reliques[qr.code] = quand();
        debloques.push({ type: "relique", nom: qr.nom });
      }
      // Artiste débloqué : dédicace, ou scan de sa scène pendant son concert
      const enConcert = qr.lieu && artistes.find((a) => {
        if (a.scene !== qr.lieu) return false;
        const debut = App.dateConcert(a, jours).getTime();
        return maintenant >= debut && maintenant < debut + 60 * 60000;
      });
      const artiste = qr.artiste ? artistes.find((a) => a.id === qr.artiste) : enConcert;
      if (artiste) {
        const deja = collection.artistes[artiste.id];
        if (!deja || (qr.artiste && !deja.dedicace)) {
          partie.collection.artistes[artiste.id] = { ...(deja || quand()), ...(qr.artiste ? { dedicace: true } : {}) };
          debloques.push({ type: "artiste", nom: artiste.nom, dedicace: !!qr.artiste });
        }
      }

      const missionsTouchees = (qr.missions || []).map((id) => {
        const m = missions.find((x) => x.id === id);
        const fait = progression[id] || 0;
        if (fait >= m.objectif) return null;
        if (disponibilite(m, maintenant, jours, avant, rangs, joueur.xp).etat !== "ouverte") return null;
        const nouveau = fait + 1;
        partie.progression[id] = nouveau;
        const terminee = nouveau >= m.objectif;
        if (terminee) partie.terminees[id] = { heure };
        if (terminee) detail.push({ libelle: `Mission «\u00A0${m.titre}\u00A0»`, xp: m.xp, jetons: m.jetons });
        return { id, titre: m.titre, objectif: m.objectif, avant: fait, fait: nouveau, terminee };
      }).filter(Boolean);

      // Badge
      let badge = null;
      if (qr.badge && !collection.badges[qr.badge.id]) {
        partie.collection.badges[qr.badge.id] = quand();
        badge = qr.badge;
        detail.push({ libelle: `Badge «\u00A0${badge.nom}\u00A0»`, xp: 50, jetons: 0 });
      }

      const gains = detail.reduce((t, d) => ({ xp: t.xp + d.xp, jetons: t.jetons + d.jetons }), { xp: 0, jetons: 0 });

      // 6.3 bis : l'XP part dans le coffre, versée à la réponse (un seul coffre à la fois)
      if (partie.coffre) {
        Object.assign(partie.coffre, { xp: partie.coffre.xp + gains.xp, jetons: partie.coffre.jetons + gains.jetons, scans: partie.coffre.scans + 1 });
      } else {
        const question = await prochaineQuestion(partie);
        if (question) partie.coffre = { xp: gains.xp, jetons: gains.jetons, scans: 1, question };
      }
      const coffre = coffreJson(partie.coffre);
      const credit = coffre ? { xp: 0, jetons: 0 } : gains;
      const maj = { ...joueur, xp: joueur.xp + credit.xp, jetons: joueur.jetons + credit.jetons };
      const apres = App.rang(maj.xp, rangs);
      maj.rang = apres.actuel.nom;

      partie.scans[qr.code] = { jour, heure };
      partie.activite.unshift({ heure, jour, type: "scan", texte: qr.nom, xp: credit.xp });
      App.partie.set(joueur.id, partie);
      App.session.set(maj);

      return {
        statut: "ok", qr, gains, detail, missions: missionsTouchees, badge, debloques, coffre,
        rang: { avant: avant.actuel, apres: apres.actuel, monte: apres.index > avant.index, suivant: apres.suivant, reste: apres.reste },
        joueur: maj, avantJoueur: joueur
      };
    },

    /* POST /api/coffre { cle, valeur, duree } — serveur : coffre_ouvrir (rejouable) */
    async ouvrirCoffre({ cle, valeur, duree = null }) {
      await attendre(400);
      const joueur = App.session.get();
      const partie = App.partie.get(joueur.id);
      const c = partie.coffre;
      if (!c) return { statut: "deja", joueur };
      if (c.question.cle !== cle) return { statut: "perimee", coffre: coffreJson(c) };
      if (!c.question.options.some((o) => o.valeur === valeur)) throw erreurMetier("VALEUR_INVALIDE");
      const [cfg, cc, rangs] = await Promise.all(["fiche", "coffreConfig", "rangs"].map(App.data.get));
      let reponse = 0, bonus = 0;
      if (cle.startsWith("profil:")) {
        const champ = cle.slice(7);
        partie.fiche = partie.fiche || {};
        if (!partie.fiche[champ]) {
          partie.fiche[champ] = valeur;
          reponse = cfg.xpParReponse;
          if (!partie.ficheBonus && cfg.champs.every((x) => partie.fiche[x.id])) { bonus = cfg.bonusComplet; partie.ficheBonus = true; }
        }
      } else {
        const id = Number(cle.slice(6));
        partie.reponses = partie.reponses || {};
        (partie.reponses[id] = partie.reponses[id] || []).push({ jour: jourDeJeu(), valeur, duree });
        reponse = cc.xpParReponse;
      }
      delete partie.coffre;
      const gains = { xp: c.xp + reponse + bonus, jetons: c.jetons + Math.floor((reponse + bonus) / 10) };
      partie.activite.unshift({ heure: App.heureFestival().replace("h", ":"), jour: App.jourFestival(), type: "scan", texte: "Coffre ouvert", xp: gains.xp });
      App.partie.set(joueur.id, partie);
      const avant = App.rang(joueur.xp, rangs);
      const maj = { ...joueur, xp: joueur.xp + gains.xp, jetons: joueur.jetons + gains.jetons };
      const apres = App.rang(maj.xp, rangs);
      maj.rang = apres.actuel.nom;
      App.session.set(maj);
      return {
        statut: "ok", gains,
        detail: { coffre: c.xp, coffreJetons: c.jetons, scans: c.scans, reponse, bonus },
        rang: { monte: apres.index > avant.index, apres: apres.actuel },
        joueur: maj, avantJoueur: joueur
      };
    },

    /* Le coffre resté fermé (page de scan, carte) — serveur : copie locale */
    async coffreEnAttente() {
      const joueur = App.session.get();
      return joueur ? coffreJson(App.partie.get(joueur.id).coffre) || null : null;
    },

    /* POST /api/fiche — serveur : fiche_enregistrer (fiche + téléphone en un appel).
       Les champs absents sont « passés » ; un champ déjà rempli n'est pas réécrit. */
    async enregistrerFiche({ fiche = {}, telephone = null, domaf = false, partenaires = false }) {
      await attendre(500);
      const joueur = App.session.get();
      const [cfg, rangs] = await Promise.all(["fiche", "rangs"].map(App.data.get));
      const partie = App.partie.get(joueur.id);
      partie.fiche = partie.fiche || {};
      for (const c of cfg.champs) {
        if (fiche[c.id] && !c.options.some((o) => o.valeur === fiche[c.id])) throw erreurMetier("VALEUR_INVALIDE");
      }
      let n = 0;
      for (const c of cfg.champs) {
        if (fiche[c.id] && !partie.fiche[c.id]) { partie.fiche[c.id] = fiche[c.id]; n++; }
      }
      let tour = 0;
      if (telephone) {
        if (!cfg.majeurs.includes(partie.fiche.tranche_age)) throw erreurMetier("RESERVE_MAJEURS");
        let t = String(telephone).replace(/[^0-9]/g, "");
        if (t.length === 12 && t.startsWith("237")) t = t.slice(3);
        if (!/^6[0-9]{8}$/.test(t)) throw erreurMetier("NUMERO_INVALIDE");
        if (!partie.contact) tour = cfg.tourOffert;
        partie.contact = { telephone: t, domaf: !!domaf, partenaires: !!partenaires };
      }
      const etat = await ficheEtat(partie);
      let bonus = 0;
      if (etat.faits === etat.total && !partie.ficheBonus) { bonus = cfg.bonusComplet; partie.ficheBonus = true; }
      if (partie.coffre && n && partie.coffre.question.cle.startsWith("profil:")) {
        partie.coffre.question = (await prochaineQuestion(partie)) || partie.coffre.question;
      }
      const xp = n * cfg.xpParReponse + bonus;
      const jetons = Math.floor(xp / 10) + tour;
      if (xp) partie.activite.unshift({ heure: App.heureFestival().replace("h", ":"), jour: App.jourFestival(), type: "profil", texte: "Fiche de fan", xp });
      App.partie.set(joueur.id, partie);
      const maj = { ...joueur, xp: joueur.xp + xp, jetons: joueur.jetons + jetons };
      maj.rang = App.rang(maj.xp, rangs).actuel.nom;
      App.session.set(maj);
      return { joueur: maj, xp, bonus, jetons, tourOffert: tour > 0, ...etat };
    },

    /* GET /api/joueurs/moi/missions */
    async missions() {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [catalogue, etats, rangs, jours] = await Promise.all(["missions", "etatsJoueur", "rangs", "jours"].map(App.data.get));
      const base = etatDeBase(joueur, etats);
      const partie = App.partie.get(joueur.id);
      const { progression, terminees } = fusion(base, partie);
      const rang = App.rang(joueur.xp, rangs);
      const maintenant = App.maintenant();

      const liste = catalogue.map((m) => {
        const fait = Math.min(progression[m.id] || 0, m.objectif);
        const dispo = disponibilite(m, maintenant, jours, rang, rangs, joueur.xp);
        let statut;
        if (fait >= m.objectif) statut = "terminee";
        else if (dispo.etat !== "ouverte") statut = dispo.etat;
        else statut = fait > 0 ? "en-cours" : "a-faire";
        return {
          ...m, fait, statut,
          finMs: dispo.fin || null,
          xpRequis: dispo.reste || 0,
          terminee: terminees[m.id] || null
        };
      });
      return { joueur, rang, missions: liste };
    },


    /* GET /api/joueurs/moi/collection */
    async collection() {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [badges, artistes, stands, scenes, jours, etats, qrcodes] =
        await Promise.all(["badges", "artistes", "stands", "scenes", "jours", "etatsJoueur", "qrcodes"].map(App.data.get));
      const { collection } = fusion(etatDeBase(joueur, etats), App.partie.get(joueur.id));
      const sceneParId = Object.fromEntries(scenes.map((x) => [x.id, x]));
      const jourParId = Object.fromEntries(jours.map((x) => [x.id, x]));
      return {
        badges: badges.map((b) => ({ ...b, obtenu: collection.badges[b.id] || null })),
        artistes: artistes.map((a) => ({ ...a, scene: sceneParId[a.scene], jourInfo: jourParId[a.jour], obtenu: collection.artistes[a.id] || null })),
        stands: stands.map((x) => ({ ...x, obtenu: collection.stands[x.id] || null })),
        reliques: qrcodes.filter((q) => q.type === "relique").map((q) => {
          const obtenu = collection.reliques[q.code] || null;
          // Rareté des reliques en base : commune / rare / legendaire (celle des badges : commun…)
          return { id: q.code, nom: obtenu ? q.nom : null, rarete: q.rarete === "commune" ? "commun" : q.rarete, indice: q.indice, obtenu };
        })
      };
    },

    /* GET /api/classement?periode=general|jour
       Renvoie le top, les voisins du joueur et sa position. */
    async classement(periode = "general") {
      await attendre(350);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [cfg, noms, avatars, rangs] = await Promise.all(["classementConfig", "motsPseudo", "avatars", "rangs"].map(App.data.get));
      const c = cfg[periode];
      const carte = await this.carte();
      const monXp = periode === "general" ? joueur.xp : carte.jour.xp;
      const tranche = Math.floor(Date.now() / 30000); // le classement « bouge » toutes les 30 s

      const fictif = fabriqueFictifs({ noms, avatars, rangs, c, periode, tranche });

      const monRang = rangPourXp(monXp, c);
      const moi = {
        rang: monRang, pseudo: joueur.pseudo, xp: monXp, estMoi: true,
        avatar: avatars.find((a) => a.id === joueur.avatar) || avatars[0],
        evolution: Math.round((graine(tranche + monRang) - 0.3) * 6),
        rangNom: App.rang(joueur.xp, rangs).actuel.nom
      };

      const top = [];
      for (let r = 1; r <= Math.min(cfg.tailleTop, c.total); r++) top.push(r === monRang ? moi : fictif(r));
      const autour = [];
      if (monRang > cfg.tailleTop) {
        for (let r = Math.max(cfg.tailleTop + 1, monRang - cfg.voisins); r <= Math.min(c.total, monRang + cfg.voisins); r++) {
          autour.push(r === monRang ? moi : { ...fictif(r), xp: r < monRang ? Math.max(monXp + (monRang - r) * 6, xpAuRang(r, c)) : Math.min(monXp - (r - monRang) * 5, xpAuRang(r, c)) });
        }
      }
      const devant = monRang > 1 ? (monRang <= cfg.tailleTop ? top[monRang - 2] : autour.find((x) => x.rang === monRang - 1)) : null;
      moi.prochain = devant ? { pseudo: devant.pseudo, ecart: Math.max(1, devant.xp - monXp + 1) } : null;

      return { periode, total: c.total, maj: Date.now(), top, autour, moi };
    },

    /* GET /api/classement/recherche?pseudo=&periode= */
    async chercherJoueur(pseudo, periode = "general") {
      await attendre(300);
      const cible = normaliser(pseudo).trim();
      if (cible.length < 3) return { statut: "court" };
      const [connus, cfg, avatars] = await Promise.all(["joueursConnus", "classementConfig", "avatars"].map(App.data.get));
      const joueur = App.session.get();
      const liste = connus.filter((j) => j.joueur !== joueur.id && normaliser(j.pseudo).includes(cible));
      return {
        statut: liste.length ? "ok" : "aucun",
        resultats: liste.map((j) => {
          const xp = periode === "jour" ? j.xpJour : j.xp;
          return { pseudo: j.pseudo, xp, rang: rangPourXp(xp, cfg[periode]), avatar: avatars.find((a) => a.id === j.avatar) || avatars[0] };
        })
      };
    },

    /* GET /api/amis?periode=general|jour */
    async amis(periode = "general") {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [connus, deBase, avatars, rangs] = await Promise.all(["joueursConnus", "amisDeBase", "avatars", "rangs"].map(App.data.get));
      const carte = await this.carte();
      const partie = App.partie.get(joueur.id);
      const codes = [...new Set([...(deBase[joueur.id] || []), ...partie.amis])];
      const tranche = Math.floor(Date.now() / 30000);
      const liste = codes.map((code) => connus.find((j) => j.code === code)).filter(Boolean).map((j, i) => ({
        pseudo: j.pseudo, code: j.code,
        xp: periode === "general" ? j.xp : j.xpJour + Math.floor(graine(i + tranche) * 3) * 10,
        avatar: avatars.find((a) => a.id === j.avatar) || avatars[0],
        rangNom: App.rang(j.xp, rangs).actuel.nom
      }));
      liste.push({
        pseudo: joueur.pseudo, code: codeAmi(joueur), estMoi: true,
        xp: periode === "general" ? joueur.xp : carte.jour.xp,
        avatar: avatars.find((a) => a.id === joueur.avatar) || avatars[0],
        rangNom: App.rang(joueur.xp, rangs).actuel.nom
      });
      liste.sort((a, b) => b.xp - a.xp);
      // Ex æquo : même rang
      liste.forEach((x, i) => { x.rang = i > 0 && x.xp === liste[i - 1].xp ? liste[i - 1].rang : i + 1; });
      const moi = liste.find((x) => x.estMoi);
      const idx = liste.indexOf(moi);
      const devant = idx > 0 ? liste[idx - 1] : null;
      moi.prochain = devant ? { pseudo: devant.pseudo, ecart: Math.max(1, devant.xp - moi.xp + 1) } : null;
      return { periode, liste, moi, total: liste.length, codeAmi: codeAmi(joueur), maj: Date.now() };
    },

    /* POST /api/amis { code } */
    async ajouterAmi(saisie) {
      await attendre(400);
      const joueur = App.session.get();
      // Ajout par pseudo exact, la casse ne compte pas (décision du 18/09/2026)
      const pseudo = normaliser(String(saisie || "").trim());
      if (pseudo === normaliser(joueur.pseudo)) return { ok: false, erreur: "soi" };
      const connus = await App.data.get("joueursConnus");
      const ami = connus.find((j) => normaliser(j.pseudo) === pseudo);
      if (!ami) return { ok: false, erreur: "inconnu" };
      const code = ami.code;
      const deBase = (await App.data.get("amisDeBase"))[joueur.id] || [];
      const partie = App.partie.get(joueur.id);
      if (deBase.includes(code) || partie.amis.includes(code)) return { ok: false, erreur: "deja", ami };
      partie.amis.push(code);
      App.partie.set(joueur.id, partie);
      return { ok: true, ami };
    },

    /* GET /api/joueurs/moi/passeport — résumé partageable */
    async passeport() {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [cfg, rangs, etats, badges, artistes, stands, missions, festival, jours, raretes, avatars] = await Promise.all(
        ["classementConfig", "rangs", "etatsJoueur", "badges", "artistes", "stands", "missions", "festival", "jours", "raretes", "avatars"].map(App.data.get));
      const base = etatDeBase(joueur, etats);
      const partie = App.partie.get(joueur.id);
      const { collection, progression } = fusion(base, partie);
      const ordreRarete = { legendaire: 0, epique: 1, rare: 2, commun: 3 };

      const badgesObtenus = badges.filter((b) => collection.badges[b.id])
        .sort((a, b) => ordreRarete[a.rarete] - ordreRarete[b.rarete]);
      const artistesVus = artistes.filter((a) => collection.artistes[a.id])
        .map((a) => ({ ...a, dedicace: !!collection.artistes[a.id].dedicace }));
      const joursPresents = new Set([
        ...Object.values(collection.badges), ...Object.values(collection.artistes), ...Object.values(collection.stands),
        ...partie.activite.filter((x) => x.jour).map((x) => ({ jour: x.jour }))
      ].map((x) => x.jour).filter((d) => jours.some((j) => j.date === d)));
      const code = codeAmi(joueur);

      return {
        festival,
        joueur,
        avatar: avatars.find((a) => a.id === joueur.avatar) || avatars[0],
        rang: App.rang(joueur.xp, rangs),
        place: rangPourXp(joueur.xp, cfg.general),
        totalJoueurs: cfg.general.total,
        badges: { liste: badgesObtenus, total: badges.length },
        raretes,
        artistes: { liste: artistesVus, total: artistes.length },
        stands: { nombre: stands.filter((x) => collection.stands[x.id]).length, total: stands.length },
        missions: { terminees: missions.filter((m) => (progression[m.id] || 0) >= m.objectif).length, total: missions.length },
        jours: { presents: joursPresents.size || 1, total: jours.length },
        codeAmi: code,
        // Pas de passeport public ni de parrainage (décision du 18/09/2026) : l'adresse du jeu
        lienPublic: new URL("index.html", location.href).href,
        lienInvitation: new URL("index.html", location.href).href
      };
    },

    /* ---------- Écran géant (aucune session joueur) ---------- */

    /* Mur de l'écran géant : tout en un appel (serveur : mur_direct).
       Tournoi du jour, compteurs, 8 derniers exploits (relique, badge, mission,
       roue, rang), annonces en cours. Démo : classement et exploits fabriqués,
       qui bougent toutes les 15 s / 7 s. */
    async mur() {
      await attendre(200);
      const [cfg, noms, avatars, rangs, badges, qrs, missions, lots, annonces] = await Promise.all(
        ["classementConfig", "motsPseudo", "avatars", "rangs", "badges", "qrcodes", "missions", "lots"]
          .map(App.data.get).concat(this.annonces()));
      const c = cfg.jour;
      const tranche = Math.floor(Date.now() / 15000);
      const fictif = fabriqueFictifs({ noms, avatars, rangs, c, periode: "jour", tranche });
      const top = Array.from({ length: 12 }, (_, i) => fictif(i + 1))
        .sort((a, b) => b.xp - a.xp).slice(0, 10)
        .map((j, i) => ({ pseudo: j.pseudo, avatar: j.avatar, points: j.xp, place: i + 1 }));
      const minutes = Math.max(0, Math.floor((App.maintenant() - App.dateFestival(App.jourFestival(), "16:00")) / 60000));

      const PAS = 7000;   // un exploit toutes les 7 s environ
      const maintenant = Date.now();
      const exploits = [];
      for (let t = Math.floor(maintenant / PAS) * PAS; exploits.length < 8; t -= PAS) {
        const k = t / PAS;
        const pick = (l, o) => l[Math.floor(graine(k + o) * l.length)];
        const pseudo = pick(noms.debut, 1) + pick(noms.fin, 2) + (graine(k + 3) > 0.5 ? Math.floor(graine(k + 4) * 90 + 10) : "");
        const genre = Math.floor(graine(k + 5) * 5);
        let e;
        if (genre === 0) { const q = pick(qrs.filter((x) => x.type === "relique"), 6); e = { type: "relique", nom: q.nom, detail: q.rarete }; }
        else if (genre === 1) { const b = pick(badges, 6); e = { type: "badge", nom: b.secret ? null : b.nom, detail: b.rarete }; }
        else if (genre === 2) { const m = pick(missions, 7); e = { type: "mission", nom: m.titre, detail: String(m.xp) }; }
        else if (genre === 3) { const l = pick(lots, 8); e = { type: "roue", nom: l.nom, detail: "objet" }; }
        else e = { type: "rang", nom: pick(rangs.slice(1), 9).nom, detail: null };
        exploits.push({ id: `e${k}`, pseudo, avatar: pick(avatars, 10), dateMs: t, ...e });
      }

      return {
        phase: "EXPLORATION",
        top,
        roi: { pseudo: noms.debut[2] + noms.fin[5], points: 1620 },
        joueurs: cfg.general.total + Math.floor(minutes / 2),
        joueursJour: c.total + Math.floor(minutes / 3),
        scansJour: 21400 + minutes * 37 + Math.floor(graine(tranche) * 30),
        exploits,
        annonces: annonces.filter((a) => !a.expiree)
      };
    },

    /* GET /api/blind-test/direct — état de la manche en cours, calculé depuis une heure de départ.
       Tous les écrans (géant, téléphones, régie) lisent le même état : ils restent synchronisés.
       « ancre » : horodatage du début de la manche ; « ecoule » peut être fourni (pause de la régie). */
    async blindTestDirect({ ancre, ecoule } = {}) {
      const [cfg, questions, noms, avatars] = await Promise.all(["blindTest", "blindQuestions", "motsPseudo", "avatars"].map(App.data.get));
      const D = cfg.durees;
      const t = (ecoule !== undefined ? ecoule : Date.now() - ancre) / 1000;
      const n = questions.length;

      // Planning de la manche
      const segments = [];
      let c = 0;
      questions.forEach((q, i) => {
        segments.push({ phase: "intro", index: i, debut: c, duree: D.intro }); c += D.intro;
        segments.push({ phase: "question", index: i, debut: c, duree: D.question }); c += D.question;
        segments.push({ phase: "revelation", index: i, debut: c, duree: D.revelation }); c += D.revelation;
        if ((i + 1) % cfg.classementToutesLes === 0 && i < n - 1) {
          segments.push({ phase: "classement", index: i, debut: c, duree: D.classement }); c += D.classement;
        }
      });
      segments.push({ phase: "fin", index: n - 1, debut: c, duree: D.fin });
      const dureeTotale = c + D.fin;

      let seg;
      if (t < 0) seg = { phase: "attente", index: -1, debut: t, duree: -t };
      else seg = segments.find((x) => t >= x.debut && t < x.debut + x.duree) || { phase: "termine", index: n - 1, debut: dureeTotale, duree: 0 };
      const restant = Math.max(0, seg.phase === "attente" ? -t : seg.debut + seg.duree - t);

      const { joueurs, reponse, scores } = simulationBlind(D, noms, avatars);

      const base = 1240;
      const connectes = seg.phase === "attente"
        ? Math.round(base * Math.max(0.25, 1 - restant / 900))
        : base + Math.floor(graine(Math.floor(t / 10)) * 40);

      const etat = {
        phase: seg.phase, index: seg.index, total: n,
        restant: restant * 1000, duree: seg.duree * 1000,
        connectes, lienJeu: cfg.lienJeu, horaire: cfg.horaire
      };

      if (seg.index >= 0 && seg.phase !== "termine") {
        const q = questions[seg.index];
        // La bonne réponse n'est jamais exposée pendant la question
        etat.question = { numero: seg.index + 1, categorie: q.categorie, question: q.question, choix: q.choix, motif: q.motif, onde: q.onde, tempo: q.tempo };
      }
      if (seg.phase === "question") {
        const f = 1 - restant / D.question;
        etat.reponsesRecues = Math.round(connectes * Math.min(0.94, f * 1.7));
      }
      if (seg.phase === "revelation" || seg.phase === "classement") {
        const q = questions[seg.index];
        const pBonne = 0.35 + graine(seg.index + 90) * 0.4;
        const reste = [0, 1, 2, 3].filter((x) => x !== q.bonne).map((x) => graine(seg.index * 3 + x + 7) + 0.2);
        const somme = reste.reduce((a, b) => a + b, 0);
        let k = 0;
        const stats = [0, 1, 2, 3].map((x) => x === q.bonne ? pBonne : (reste[k++] / somme) * (1 - pBonne));
        const rapides = joueurs.map((j, kk) => ({ ...j, ...reponse(kk, seg.index) }))
          .filter((x) => x.juste).sort((a, b) => a.temps - b.temps).slice(0, 3);
        etat.revelation = {
          bonne: q.bonne, reponse: q.reponse, anecdote: q.anecdote,
          stats: stats.map((x) => Math.round(x * 100)),
          rapides: rapides.map((x) => ({ pseudo: x.pseudo, avatar: x.avatar, temps: x.temps }))
        };
      }
      if (seg.phase === "classement") {
        etat.classement = scores(seg.index).slice(0, 5);
        etat.classementPrecedent = seg.index >= cfg.classementToutesLes ? scores(seg.index - cfg.classementToutesLes).slice(0, 8) : [];
      }
      if (seg.phase === "fin" || seg.phase === "termine") etat.podium = scores(n - 1).slice(0, 10);
      return etat;
    },

    /* POST /api/blind-test/reponses { manche, index, choix, temps }
       Le serveur horodate lui-même la réponse ; le temps local ne sert qu'en démo. */
    async blindRepondre({ manche, index, choix, temps }) {
      await attendre(120);
      const joueur = App.session.get();
      if (!joueur) return { ok: false, erreur: "session" };
      const partie = App.partie.get(joueur.id);
      partie.blind = partie.blind || {};
      const m = (partie.blind[manche] = partie.blind[manche] || { reponses: {}, recap: null });
      if (m.reponses[index]) return { ok: false, erreur: "deja" };
      m.reponses[index] = { choix, temps };
      App.partie.set(joueur.id, partie);
      return { ok: true };
    },

    /* GET /api/blind-test/moi?manche=&jusqua= — disponible après la révélation de la question */
    async blindMonScore({ manche, jusqua }) {
      await attendre(150);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [cfg, questions, noms, avatars] = await Promise.all(["blindTest", "blindQuestions", "motsPseudo", "avatars"].map(App.data.get));
      const D = cfg.durees;
      const partie = App.partie.get(joueur.id);
      const m = (partie.blind || {})[manche] || { reponses: {} };
      let total = 0, bonnes = 0, serie = 0, derniere = null;
      for (let i = 0; i <= jusqua; i++) {
        const r = m.reponses[i];
        const juste = !!r && r.choix === questions[i].bonne;
        const points = r ? pointsBlind(juste, r.temps / 1000, D) : 0;
        serie = juste ? serie + 1 : 0;
        total += points;
        if (juste) bonnes++;
        if (i === jusqua) derniere = { repondu: !!r, juste, points, choix: r ? r.choix : null, temps: r ? r.temps : null, bonne: questions[i].bonne };
      }
      const sims = simulationBlind(D, noms, avatars).scores(jusqua);
      const devant = sims.filter((x) => x.points > total).length;
      const rang = devant === 0 ? 1 : Math.max(2, Math.round((devant / sims.length) * PARTICIPANTS_BLIND));
      return { derniere, total, bonnes, serie, rang, participants: PARTICIPANTS_BLIND, total_questions: questions.length };
    },

    /* POST /api/blind-test/terminer { manche } — crédite XP, jetons, badge et mission (une seule fois) */
    async blindTerminer({ manche }) {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const questions = await App.data.get("blindQuestions");
      const partie = App.partie.get(joueur.id);
      const m = (partie.blind || {})[manche];
      if (!m) return { participe: false };
      if (m.recap) return m.recap;
      const score = await this.blindMonScore({ manche, jusqua: questions.length - 1 });
      const [missions, rangs, etats] = await Promise.all(["missions", "rangs", "etatsJoueur"].map(App.data.get));
      const partieMaj = App.partie.get(joueur.id);
      const mm = partieMaj.blind[manche];

      const xp = Math.round(score.total / 25);
      const jetons = score.rang <= 3 ? 5 : score.rang <= 10 ? 2 : score.bonnes >= 10 ? 1 : 0;
      let badge = null;
      const { collection, progression } = fusion(etatDeBase(joueur, etats), partieMaj);
      if (score.rang <= 10 && !collection.badges["b-oreille-or"]) {
        partieMaj.collection.badges["b-oreille-or"] = { jour: App.jourFestival(), heure: App.heureFestival().replace("h", ":") };
        badge = "Oreille d'or";
      }
      // Mission « Oreille absolue » : bonnes réponses cumulées (si elle est débloquée)
      const mission = missions.find((x) => x.action === "blind-test");
      let missionMaj = null;
      if (mission) {
        const requis = rangs.findIndex((r) => r.nom === mission.rangMin);
        const ok = !mission.rangMin || App.rang(joueur.xp, rangs).index >= requis;
        const avant = progression[mission.id] || 0;
        if (ok && avant < mission.objectif) {
          const apres = Math.min(mission.objectif, avant + score.bonnes);
          partieMaj.progression[mission.id] = apres;
          if (apres >= mission.objectif) partieMaj.terminees[mission.id] = { heure: App.heureFestival().replace("h", ":") };
          missionMaj = { titre: mission.titre, avant, apres, objectif: mission.objectif };
        }
      }
      const maj = { ...joueur, xp: joueur.xp + xp, jetons: joueur.jetons + jetons };
      maj.rang = App.rang(maj.xp, rangs).actuel.nom;
      partieMaj.activite.unshift({ heure: App.heureFestival().replace("h", ":"), jour: App.jourFestival(), type: "mission", texte: `Blind test : ${score.rang}e place`, xp });
      mm.recap = { participe: true, ...score, xp, jetons, badge, mission: missionMaj };
      App.partie.set(joueur.id, partieMaj);
      App.session.set(maj);
      return mm.recap;
    },

    /* GET /api/votes — mes cœurs, ce qui est votable et les tendances */
    async coupsDeCoeur() {
      await attendre(300);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [cfg, tendances, deBase, artistes, stands, scenes, jours, etats] = await Promise.all(
        ["votesConfig", "votesTendances", "votesDeBase", "artistes", "stands", "scenes", "jours", "etatsJoueur"].map(App.data.get));
      const partie = App.partie.get(joueur.id);
      const mesVotes = partie.votes || deBase[joueur.id] || { artistes: [], stands: [] };
      const { collection } = fusion(etatDeBase(joueur, etats), partie);
      const maintenant = App.maintenant();
      const jourCloture = jours.find((j) => j.id === cfg.cloture.jour);
      const cloture = App.dateFestival(jourCloture.date, cfg.cloture.heure);
      const sceneParId = Object.fromEntries(scenes.map((x) => [x.id, x]));
      const jourParId = Object.fromEntries(jours.map((x) => [x.id, x]));

      const avecStats = (liste, cat) => {
        const compte = (id) => (tendances[cat][id] || 0) + (mesVotes[cat].includes(id) ? 1 : 0);
        const total = liste.reduce((t, x) => t + compte(x.id), 0) || 1;
        const tri = [...liste].sort((a, b) => compte(b.id) - compte(a.id));
        return liste.map((x) => ({
          ...x,
          votes: compte(x.id),
          pct: Math.round((compte(x.id) / total) * 1000) / 10,
          tendance: compte(x.id) ? tri.findIndex((y) => y.id === x.id) + 1 : null,
          vote: mesVotes[cat].includes(x.id)
        }));
      };

      return {
        // Comme la base : 10 XP par cœur, versés 3 fois au plus sur la partie
        coeurs: cfg.coeurs, xp: 10, xpRestants: Math.max(0, cfg.coeurs - (partie.coeursPayes || 0)),
        jury: !!collection.badges["b-jury"],
        resultats: cfg.resultats,
        cloture: { ms: cloture.getTime(), passee: maintenant >= cloture, libelle: `${jourCloture.long.split(" ")[0].toLowerCase()} ${cfg.cloture.heure.replace(":", "h")}` },
        mesVotes,
        artistes: avecStats(artistes.map((a) => {
          // Comme la base : il faut l'avoir vu (scène scannée pendant le concert, dédicace)
          const debut = App.dateConcert(a, jours);
          const votable = !!collection.artistes[a.id];
          return {
            ...a, scene: sceneParId[a.scene], jourInfo: jourParId[a.jour], vu: votable,
            votable, raison: votable ? null : maintenant < debut
              ? `Votable après son concert (${jourParId[a.jour].court.split(" ")[0].toLowerCase()} à ${a.debut.replace(":", "h")}) : scanne la scène sur place`
              : "Scanne la scène pendant un de ses concerts pour voter"
          };
        }), "artistes"),
        stands: avecStats(stands.map((x) => {
          const votable = !!collection.stands[x.id];
          return { ...x, votable, raison: votable ? null : "Scanne son QR sur place pour pouvoir voter" };
        }), "stands")
      };
    },

    /* POST /api/votes { categorie, id, actif } */
    async voter({ categorie, id, actif }) {
      await attendre(250);
      const joueur = App.session.get();
      const etat = await this.coupsDeCoeur();
      if (etat.cloture.passee) return { ok: false, erreur: "cloture" };
      const cible = etat[categorie].find((x) => x.id === id);
      if (!cible) return { ok: false, erreur: "introuvable" };
      const liste = [...etat.mesVotes[categorie]];
      if (actif) {
        if (liste.includes(id)) return { ok: true, mesVotes: etat.mesVotes };
        if (!cible.votable) return { ok: false, erreur: "non-votable", raison: cible.raison };
        if (liste.length >= etat.coeurs) return { ok: false, erreur: "plus-de-coeurs" };
        liste.push(id);
      } else {
        const i = liste.indexOf(id);
        if (i < 0) return { ok: true, mesVotes: etat.mesVotes };
        liste.splice(i, 1);
      }
      const partie = App.partie.get(joueur.id);
      partie.votes = { ...etat.mesVotes, [categorie]: liste };
      let gain = 0;
      if (actif && (partie.coeursPayes || 0) < etat.coeurs) {
        partie.coeursPayes = (partie.coeursPayes || 0) + 1;
        gain = etat.xp;
        const j = App.session.get();
        App.session.set({ ...j, xp: j.xp + gain, jetons: j.jetons + 1 });
      }

      // Mission « Jury du festival » et badge « Jury » : 3 stands votés
      let mission = null, badge = null;
      if (categorie === "stands") {
        const [missions, etats] = await Promise.all(["missions", "etatsJoueur"].map(App.data.get));
        const m = missions.find((x) => x.action === "votes");
        const { progression, collection } = fusion(etatDeBase(joueur, etats), partie);
        if (m && (progression[m.id] || 0) < m.objectif && liste.length > (progression[m.id] || 0)) {
          partie.progression[m.id] = Math.min(m.objectif, liste.length);
          mission = { titre: m.titre, fait: partie.progression[m.id], objectif: m.objectif, terminee: partie.progression[m.id] >= m.objectif, xp: m.xp, jetons: m.jetons };
          if (mission.terminee) {
            partie.terminees[m.id] = { heure: App.heureFestival().replace("h", ":") };
            const j = App.session.get();   // XP du cœur déjà comptée
            const maj = { ...j, xp: j.xp + m.xp, jetons: j.jetons + m.jetons };
            maj.rang = App.rang(maj.xp, await App.data.get("rangs")).actuel.nom;
            App.session.set(maj);
          }
        }
        if (liste.length >= 3 && !collection.badges["b-jury"]) {
          partie.collection.badges["b-jury"] = { jour: App.jourFestival(), heure: App.heureFestival().replace("h", ":") };
          badge = "Jury";
        }
      }
      App.partie.set(joueur.id, partie);
      return { ok: true, mesVotes: partie.votes, mission, badge, gain };
    },

    /* GET /api/roue — segments, stocks, jetons, limites et bons de retrait */
    async roue() {
      await attendre(250);
      const joueur = App.session.get();
      if (!joueur) return null;
      const [cfg, lots, bonsBase, jours] = await Promise.all(["roue", "lots", "bonsDeBase", "jours"].map(App.data.get));
      const partie = App.partie.get(joueur.id);
      const lotParId = Object.fromEntries(lots.map((l) => [l.id, l]));
      const bons = (partie.bons || bonsBase[joueur.id] || []).map((b) => ({ ...b, lotInfo: lotParId[b.lot] }));
      const segments = cfg.segments.map((sg) => {
        const lot = sg.lot ? lotParId[sg.lot] : null;
        return { ...sg, lotInfo: lot, epuise: !!lot && lot.stock <= 0 };
      });
      const actifs = segments.filter((x) => !x.epuise);
      const totalPoids = actifs.reduce((t, x) => t + x.poids, 0);
      segments.forEach((x) => { x.chance = x.epuise ? 0 : Math.round((x.poids / totalPoids) * 1000) / 10; });

      const aujourdhui = App.jourFestival();
      const tiragesJour = partie.tirages.filter((t) => t.jour === aujourdhui);
      const jourLimite = jours.find((j) => j.id === cfg.retrait.limite.jour);
      return {
        jetons: joueur.jetons, cout: cfg.coutTirage, segments,
        tiragesJour: tiragesJour.length, maxParJour: cfg.maxParJour, pass: true,
        retrait: { ...cfg.retrait, limiteTexte: `${jourLimite.long.split(" ")[0].toLowerCase()} ${cfg.retrait.limite.heure.replace(":", "h")}` },
        bons: bons.sort((a, b) => `${b.creeLe.jour}${b.creeLe.heure}`.localeCompare(`${a.creeLe.jour}${a.creeLe.heure}`))
      };
    },

    /* POST /api/roue/tirages — le résultat est décidé ici, jamais par le téléphone */
    async tirer() {
      await attendre(400);
      const joueur = App.session.get();
      const r = await this.roue();
      if (r.jetons < r.cout) return { ok: false, erreur: "jetons", manque: r.cout - r.jetons };
      if (r.maxParJour > 0 && r.tiragesJour >= r.maxParJour) return { ok: false, erreur: "limite" };

      const actifs = r.segments.map((x, i) => ({ ...x, i })).filter((x) => !x.epuise);
      let tirage = Math.random() * actifs.reduce((t, x) => t + x.poids, 0);
      const gagne = actifs.find((x) => (tirage -= x.poids) < 0) || actifs[0];

      const partie = App.partie.get(joueur.id);
      if (!partie.bons) partie.bons = ((await App.data.get("bonsDeBase"))[joueur.id] || []).map((b) => ({ ...b }));
      const maj = { ...joueur, jetons: joueur.jetons - r.cout };
      const quand = { jour: App.jourFestival(), heure: App.heureFestival().replace("h", ":") };
      let bon = null;
      if (gagne.type === "xp") maj.xp += gagne.valeur;
      if (gagne.type === "jetons") maj.jetons += gagne.valeur;
      if (gagne.type === "lot") {
        const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const code = "BON-" + Array.from({ length: 4 }, () => alpha[Math.floor(Math.random() * alpha.length)]).join("") + "-" + String(Math.floor(Math.random() * 90) + 10);
        bon = { code, lot: gagne.lot, statut: "a-retirer", creeLe: quand };
        partie.bons.push(bon);
        window.MOCK.lots.find((l) => l.id === gagne.lot).stock -= 1; // démo : le serveur gère le stock
      }
      maj.rang = App.rang(maj.xp, await App.data.get("rangs")).actuel.nom;
      partie.tirages.push({ ...quand, ms: Date.now(), segment: gagne.id });
      partie.activite.unshift({ ...quand, type: "roue", texte: `Roue : ${gagne.lotInfo ? gagne.lotInfo.nom : gagne.court}`, xp: gagne.type === "xp" ? gagne.valeur : 0 });
      App.partie.set(joueur.id, partie);
      App.session.set(maj);
      return { ok: true, index: gagne.i, segment: gagne, bon: bon && { ...bon, lotInfo: gagne.lotInfo }, joueur: maj };
    },

    /* DÉMO UNIQUEMENT : le staff scanne le bon au stand (console, page 25) */
    async demoRetirerBon(code) {
      await attendre(500);
      const joueur = App.session.get();
      const partie = App.partie.get(joueur.id);
      if (!partie.bons) partie.bons = ((await App.data.get("bonsDeBase"))[joueur.id] || []).map((b) => ({ ...b }));
      const bon = partie.bons.find((b) => b.code === code);
      if (!bon || bon.statut !== "a-retirer") return { ok: false };
      bon.statut = "retire";
      bon.retireLe = { jour: App.jourFestival(), heure: App.heureFestival().replace("h", ":") };
      bon.par = "Awa";
      App.partie.set(joueur.id, partie);
      return { ok: true, bon };
    },

    /* GET /api/programme — public ; enrichi (favoris, vus, rappels) si un joueur est connecté.
       Une entrée par CONCERT (en base : un créneau, un artiste peut en avoir plusieurs).
       En démo, un artiste = un concert : l'identifiant du concert est celui de l'artiste. */
    async programme() {
      await attendre(250);
      const [jours, scenes, artistes, dedicaces, cfg, etats] = await Promise.all(
        ["jours", "scenes", "artistes", "dedicaces", "programmeConfig", "etatsJoueur"].map(App.data.get));
      const joueur = App.session.get();
      let favoris = [], desactives = [], collection = { artistes: {} };
      if (joueur) {
        const partie = App.partie.get(joueur.id);
        const base = etatDeBase(joueur, etats);
        favoris = partie.favoris || base.favoris;
        desactives = (partie.rappels && partie.rappels.desactives) || [];
        collection = fusion(base, partie).collection;
      }
      const maintenant = App.maintenant().getTime();
      const sceneParId = Object.fromEntries(scenes.map((x) => [x.id, x]));
      const jourParId = Object.fromEntries(jours.map((j) => [j.id, j]));
      const concerts = artistes.map((a) => {
        const debutMs = App.dateConcert(a, jours).getTime();
        const finMs = debutMs + (a.duree || 60) * 60000;
        return {
          id: a.id, artisteId: a.id, nom: a.nom, genre: a.genre, bio: a.bio, photo: a.photo, tete: !!a.tete,
          scene: sceneParId[a.scene], jour: a.jour, debutMs, finMs,
          statut: App.statutConcert(debutMs, finMs, maintenant),
          favori: favoris.includes(a.id), rappel: !desactives.includes(a.id),
          vu: !!collection.artistes[a.id]
        };
      });
      const seances = dedicaces.map((d) => ({
        artisteId: d.artiste, nom: (artistes.find((a) => a.id === d.artiste) || {}).nom || "",
        jour: d.jour, lieu: d.lieu, lieuId: d.lieuId || null,
        debutMs: App.dateFestival(jourParId[d.jour].date, d.debut).getTime(),
        finMs: App.dateFestival(jourParId[d.jour].date, d.fin).getTime()
      }));
      return {
        jours, scenes, concerts, dedicaces: seances, config: cfg, connecte: !!joueur, favoris,
        maintenant, jourActuel: App.jourActuel(jours, maintenant), ceSoir: App.ceSoir(jours, maintenant)
      };
    },

    /* POST /api/joueurs/moi/favoris { id } — bascule et signale les chevauchements */
    async basculerFavori(id) {
      await attendre(200);
      const joueur = App.session.get();
      if (!joueur) return { ok: false, erreur: "session" };
      const p = await this.programme();
      const partie = App.partie.get(joueur.id);
      const favoris = [...p.favoris];
      const i = favoris.indexOf(id);
      if (i >= 0) favoris.splice(i, 1); else favoris.push(id);
      partie.favoris = favoris;
      App.partie.set(joueur.id, partie);
      const cible = p.concerts.find((a) => a.id === id);
      const conflits = i >= 0 ? [] : p.concerts
        .filter((a) => a.id !== id && favoris.includes(a.id) && a.debutMs < cible.finMs && cible.debutMs < a.finMs)
        .map((a) => a.nom);
      return { ok: true, favori: i < 0, conflits };
    },

    /* GET /api/joueurs/moi/programme — favoris, conflits, trajets, rappels, suggestions */
    async monProgramme() {
      const joueur = App.session.get();
      if (!joueur) return null;
      const [p, lieux, plan, rappelsDefaut, genres] = await Promise.all([
        this.programme(), App.data.get("lieux"), App.data.get("planConfig"), App.data.get("rappelsParDefaut"), App.data.get("genres")]);
      const lieuParId = Object.fromEntries(lieux.map((l) => [l.id, l]));
      const partie = App.partie.get(joueur.id);
      // Le joueur n'a plus qu'UN style préféré (genre_prefere en base) ; l'ancien
      // tableau `genres` reste accepté pour les sessions créées avant l'étape 4.1.
      return App.calculerMonProgramme(p, {
        rappels: { ...rappelsDefaut, ...(partie.rappels || {}) },
        acceptes: partie.conflitsAcceptes || [],
        styles: App.stylesDuJoueur(joueur.genres || [joueur.genre], genres),
        minutesMarche: (a, b) => (a === b ? 0 : App.minutesMarche(lieuParId[a], lieuParId[b], plan))
      });
    },

    /* PUT /api/joueurs/moi/rappels { actif } ou { avance } */
    async reglerRappels(maj) {
      await attendre(150);
      const joueur = App.session.get();
      const partie = App.partie.get(joueur.id);
      const defaut = await App.data.get("rappelsParDefaut");
      partie.rappels = { ...defaut, ...(partie.rappels || {}), ...maj };
      App.partie.set(joueur.id, partie);
      return { ok: true };
    },

    /* PUT /api/joueurs/moi/favoris/:id/rappel — rappel d'un seul concert */
    async basculerRappel(id, actif) {
      await attendre(150);
      const joueur = App.session.get();
      const partie = App.partie.get(joueur.id);
      const r = partie.rappels || {};
      const desactives = (r.desactives || []).filter((x) => x !== id);
      if (!actif) desactives.push(id);
      partie.rappels = { ...r, desactives };
      App.partie.set(joueur.id, partie);
      return { ok: true };
    },

    /* POST /api/joueurs/moi/conflits { cle, garder } — garder : id à conserver, "tous" ou "revoir" */
    async resoudreConflit({ cle, garder }) {
      await attendre(200);
      const joueur = App.session.get();
      const partie = App.partie.get(joueur.id);
      if (garder === "tous") {
        partie.conflitsAcceptes = [...new Set([...(partie.conflitsAcceptes || []), cle])];
      } else if (garder === "revoir") {
        partie.conflitsAcceptes = (partie.conflitsAcceptes || []).filter((c) => c !== cle);
      } else {
        const p = await this.programme();
        const retirer = cle.split("+").filter((id) => id !== garder);
        partie.favoris = p.favoris.filter((id) => !retirer.includes(id));
      }
      App.partie.set(joueur.id, partie);
      return { ok: true };
    },

    /* GET /api/plan — public ; ajoute l'état des stands pour un joueur connecté */
    async plan() {
      await attendre(200);
      const [lieux, categories, cfg, prog, annonces] = await Promise.all([
        App.data.get("lieux"), App.data.get("categoriesLieux"), App.data.get("planConfig"), this.programme(), this.annonces()
      ]);
      const joueur = App.session.get();
      let stands = {};
      if (joueur) {
        const etats = await App.data.get("etatsJoueur");
        stands = fusion(etatDeBase(joueur, etats), App.partie.get(joueur.id)).collection.stands;
      }
      const maintenant = prog.maintenant;
      const enrichis = lieux.map((l) => {
        const x = { ...l, tamponne: l.id.startsWith("st-") ? !!stands[l.id] : null, dedicaces: prog.dedicaces.some((d) => d.lieuId === l.id) };
        if (l.cat === "scene") {
          const concerts = prog.concerts.filter((a) => a.scene.id === l.id).sort((a, b) => a.debutMs - b.debutMs);
          x.enCours = concerts.find((a) => a.statut === "en-cours") || null;
          x.prochain = concerts.find((a) => a.statut === "a-venir") || null;
          x.couleurScene = concerts[0] ? concerts[0].scene.couleur : "nuit";
        }
        return x;
      });
      const alerte = annonces.find((a) => a.niveau === "urgent" && !a.expiree && /orage|abri/i.test(`${a.titre} ${a.texte}`)) || null;
      return { lieux: enrichis, categories, config: cfg, connecte: !!joueur, maintenant, alerteAbris: alerte, jours: prog.jours };
    },

    /* GET /api/infos — public */
    async infos() {
      await attendre(150);
      const [infos, jours, rangs, roue, qrcodes, festival, typesQR, blind] = await Promise.all(
        ["infos", "jours", "rangs", "roue", "qrcodes", "festival", "typesQR", "blindTest"].map(App.data.get));
      const maintenant = App.maintenant().getTime();
      const horaires = infos.horaires.map((h) => {
        const jour = jours.find((j) => j.id === h.jour);
        const ouverture = App.dateFestival(jour.date, h.portes).getTime();
        const fin = App.dateFestival(jour.date, h.fin).getTime() + (Number(h.fin.slice(0, 2)) < 8 ? 24 * 3600000 : 0);
        return { ...h, jourInfo: jour, ouverture, fin, ouvert: maintenant >= ouverture && maintenant < fin };
      });
      // Barème indicatif, calculé à partir des vrais QR
      const bareme = Object.entries(typesQR).map(([type, t]) => {
        const xp = qrcodes.filter((q) => q.type === type).map((q) => q.xp);
        return xp.length ? { type, nom: t.nom, min: Math.min(...xp), max: Math.max(...xp) } : null;
      }).filter(Boolean);
      return { ...infos, festival, horaires, rangs, coutTirage: roue.coutTirage, maxTirages: roue.maxParJour, bareme, blind, maintenant };
    },

    /* Déconnecte ce téléphone. La partie reste enregistrée (en base, et ici en
       démo) : on la reprend avec le code secret. Pas d'effacement côté joueur
       (décision du 18/09) : il se demande au stand. */
    async deconnecter() {
      App.session.clear();
      return { ok: true };
    },

    /* GET /api/joueurs/moi/code-validation
       Code personnel renouvelé toutes les 5 minutes, scanné par le staff (console, page 22). */
    async codeValidation() {
      await attendre(150);
      const joueur = App.session.get();
      const PERIODE = 5 * 60000;
      const creneau = Math.floor(Date.now() / PERIODE);
      let h = 7;
      for (const c of `${joueur.id}:${creneau}`) h = (h * 31 + c.charCodeAt(0)) % 10000;
      const code = String(h).padStart(4, "0");
      return {
        code,
        contenu: `RSN-VAL:${joueur.id}:${code}`,
        expire: (creneau + 1) * PERIODE
      };
    },

    /* DÉMO UNIQUEMENT : simule la validation faite par un membre du staff.
       En production, la console admin valide, et le téléphone le découvre via GET /api/joueurs/moi/missions. */
    async demoValidationStaff(id) {
      await attendre(700);
      const joueur = App.session.get();
      const m = (await App.data.get("missions")).find((x) => x.id === id);
      const partie = App.partie.get(joueur.id);
      partie.progression[id] = m.objectif;
      partie.terminees[id] = { heure: App.heureFestival().replace("h", ":"), par: "Awa, équipe Vimas Quest" };
      partie.activite.unshift({ heure: partie.terminees[id].heure, jour: App.jourFestival(), type: "mission", texte: `Mission ${m.titre} validée`, xp: m.xp });
      App.partie.set(joueur.id, partie);
      const maj = { ...joueur, xp: joueur.xp + m.xp, jetons: joueur.jetons + m.jetons };
      maj.rang = App.rang(maj.xp, await App.data.get("rangs")).actuel.nom;
      App.session.set(maj);
      return { ok: true, mission: m, joueur: maj };
    },

    /* GET /api/annonces */
    async annonces() {
      await attendre(150);
      const [liste, jours, types] = await Promise.all(["annonces", "jours", "typesAnnonces"].map(App.data.get));
      const lues = App.annoncesLues.get();
      const maintenant = App.maintenant().getTime();
      const dateDe = (jourId, hhmm) => {
        const j = jours.find((x) => x.id === jourId);
        const d = App.dateFestival(j.date, hhmm);
        if (Number(hhmm.slice(0, 2)) < 8) d.setDate(d.getDate() + 1);
        return d.getTime();
      };
      return liste
        .map((a) => {
          const dateMs = a.dateMs || dateDe(a.jour, a.heure);
          let finMs = a.finMs || (a.fin ? dateDe(a.jour, a.fin) : null);
          if (finMs && finMs < dateMs) finMs += 24 * 3600000;
          const expiree = !!finMs && maintenant >= finMs;
          return {
            ...a, dateMs, finMs, expiree,
            publiee: dateMs <= maintenant,
            typeInfo: types[a.type] || types.pratique,
            // Une annonce expirée ne compte plus comme « non lue »
            lu: expiree || a.lu || lues.has(a.id)
          };
        })
        .filter((a) => a.publiee)
        .sort((x, y) => y.dateMs - x.dateMs);
    },

    /* POST /api/annonces/lues { ids } */
    async marquerLues(ids) {
      const lues = App.annoncesLues.get();
      ids.forEach((id) => lues.add(id));
      App.annoncesLues.set(lues);
      App.majCompteurAnnonces();
      return { ok: true };
    },

    /* DÉMO UNIQUEMENT : la console (page 27) publiera les vraies annonces */
    async demoNouvelleAnnonce() {
      await attendre(200);
      const exemples = [
        { niveau: "info", type: "surprise", titre: "Jam session au Kiosque", texte: "Des musiciens du festival improvisent ensemble pendant 30 minutes.", lien: { href: "plan.html?lieu=kiosque", libelle: "Voir le Kiosque" } },
        { niveau: "important", type: "horaire", titre: "Changement d'horaire", texte: "Le set de Sœur Vinyle commence 15 minutes plus tôt.", lien: { href: "programme.html#a8", libelle: "Voir le concert" } },
        { niveau: "urgent", type: "securite", titre: "Accès Dock fermé", texte: "L'accès au Dock par l'allée des artisans est fermé. Passe par le Kiosque.", lien: { href: "plan.html?lieu=dock", libelle: "Voir le plan" } }
      ];
      const n = (window.MOCK.annonces.filter((a) => a.id.startsWith("demo")).length) % exemples.length;
      const maintenant = App.maintenant().getTime();
      const annonce = { ...exemples[n], id: `demo${Date.now()}`, dateMs: maintenant - 1000, finMs: maintenant + 3600000, lu: false };
      window.MOCK.annonces.push(annonce);
      return annonce;
    },

    /* Création de la carte — RPC create_player.
       Renvoie le code secret : c'est la seule fois où il est affiché. */
    async creerProfil({ pseudo, avatar, ticket, genre }) {
      await attendre();
      if (!(await this.pseudoDisponible(pseudo))) return { ok: false, erreur: "pseudo_pris" };
      const bonus = await App.data.get("bonusBienvenue");
      window.MOCK.pseudosPris.push(normaliser(pseudo));
      const mots = ["KORA", "BALAFO", "MAKOSA", "MVET", "SANZA", "VIMAS", "SOLEIL", "ETOILE"];
      const code = mots[Math.floor(Math.random() * mots.length)] +
        "-" + String(Math.floor(Math.random() * 100000)).padStart(5, "0");
      const joueur = {
        id: "j" + Date.now().toString(36),
        pseudo, avatar, code, genre: genre || null,
        xp: bonus.xp, jetons: bonus.jetons, rang: bonus.rang, ticket: ticket || null
      };
      App.session.set({ ...joueur, connecteLe: new Date().toISOString() });
      return { ok: true, joueur, code, bonus };
    }
  };

  /* ---------- Horloge ----------
     En démo, on simule une soirée du festival pour que le tableau de bord ait du sens.
     La simulation avance en temps réel à partir du chargement de la page. */
  App.config.horlogeDemo = "2026-11-28T20:25:00+01:00";
  App.config.fuseau = "Africa/Douala"; /* fuseau du festival (UTC+1), indépendant du téléphone */
  const chargement = Date.now();
  App.maintenant = () => (App.config.demo && App.config.horlogeDemo
    ? new Date(new Date(App.config.horlogeDemo).getTime() + (Date.now() - chargement))
    : new Date());

  /* Date du jour (AAAA-MM-JJ) et heure (20h25) dans le fuseau du festival */
  App.jourFestival = (d = App.maintenant()) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: App.config.fuseau, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  App.heureFestival = (d = App.maintenant()) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: App.config.fuseau, hour: "2-digit", minute: "2-digit" }).format(d).replace(":", "h");
  /* Construit une date à partir d'un jour AAAA-MM-JJ et d'une heure HH:MM du festival */
  App.dateFestival = (jour, hhmm) => new Date(`${jour}T${hhmm}:00+01:00`);

  /* Date réelle d'un concert : un horaire avant 8h appartient à la nuit du jour indiqué */
  App.dateConcert = (artiste, jours) => {
    const jour = jours.find((j) => j.id === artiste.jour);
    const d = App.dateFestival(jour.date, artiste.debut);
    if (Number(artiste.debut.slice(0, 2)) < 8) d.setDate(d.getDate() + 1);
    return d;
  };

  /* Durée lisible : « 35 min », « 1 h 05 », « 2 j » */
  App.duree = (ms) => {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 60) return `${min} min`;
    if (min < 1440) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
    return `${Math.round(min / 1440)} j`;
  };

  /* ---------- Programme (démo et serveur) ----------
     Journée de jeu : de 6 h à 6 h, heure de Douala (public.jour_jeu() en base). */
  App.jourActuel = (jours, maintenant = App.maintenant().getTime()) => {
    const date = App.jourFestival(new Date(maintenant - 6 * 3600000));
    return (jours.find((j) => j.date === date) || (date > jours[jours.length - 1].date ? jours[jours.length - 1] : jours[0])).id;
  };
  /* Le jour du festival en cours (« ce soir »), ou null avant et après le festival */
  App.ceSoir = (jours, maintenant = App.maintenant().getTime()) =>
    (jours.find((j) => j.date === App.jourFestival(new Date(maintenant - 6 * 3600000))) || {}).id || null;
  App.statutConcert = (debutMs, finMs, maintenant) =>
    maintenant >= finMs ? "termine" : maintenant >= debutMs ? "en-cours" : "a-venir";

  /* Minutes à pied entre deux lieux du plan (x / y en unités du plan), ou null si
     l'un n'est pas placé. La ligne droite est majorée de 30 % : allées, foule. */
  App.minutesMarche = (la, lb, plan) => {
    if (!la || !lb || la.x == null || la.y == null || lb.x == null || lb.y == null) return null;
    if (la === lb || (la.x === lb.x && la.y === lb.y)) return 0;
    const metres = Math.hypot(la.x - lb.x, la.y - lb.y) * plan.metresParUnite * 1.3;
    return Math.max(1, Math.round(metres / plan.metresParMinute));
  };

  /* Mots qui reconnaissent le style préféré du joueur dans le genre d'un artiste :
     la valeur (« coupe-decale ») et chaque morceau du libellé (« R&B / Soul »). */
  const sansAccent = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  App.stylesDuJoueur = (valeurs, genres = []) => valeurs.filter((v) => v && v !== "autre").flatMap((v) => {
    const g = genres.find((x) => x.valeur === v);
    return [v, ...(g ? g.libelle.split("/") : [])].map((t) => sansAccent(t).trim()).filter((t) => t.length >= 3);
  });

  /* Mon programme, calculé sur le téléphone à partir de api.programme() :
     conflits, trajets entre deux concerts, suggestions. Rien n'est demandé à la base.
     minutesMarche(sceneA, sceneB) → minutes à pied, ou null si on ne sait pas. */
  App.calculerMonProgramme = (p, { rappels, acceptes = [], styles = [], minutesMarche }) => {
    const favoris = p.concerts.filter((a) => a.favori).sort((a, b) => a.debutMs - b.debutMs)
      .map((a) => ({ ...a, rappel: rappels.actif && a.rappel }));
    const chevauche = (a, b) => a.debutMs < b.finMs && b.debutMs < a.finMs;

    // Groupes de concerts qui se chevauchent
    const groupes = [];
    favoris.forEach((a) => {
      const groupe = groupes.find((g) => g.some((x) => chevauche(x, a)));
      if (groupe) groupe.push(a);
      else if (favoris.some((x) => x.id !== a.id && chevauche(x, a))) groupes.push([a]);
    });
    const conflits = groupes.map((g) => {
      const ids = g.map((x) => x.id).sort();
      const cle = ids.join("+");
      const commun = Math.max(0, Math.min(...g.map((x) => x.finMs)) - Math.max(...g.map((x) => x.debutMs)));
      const [premier, second] = [...g].sort((x, y) => x.debutMs - y.debutMs);
      const marche = minutesMarche(premier.scene.id, second.scene.id);
      return {
        cle, ids, jour: g[0].jour, communMin: Math.round(commun / 60000), accepte: acceptes.includes(cle),
        plan: { quitter: premier, rejoindre: second, marche, departMs: second.debutMs - (marche || 0) * 60000 }
      };
    });

    // Trajets entre deux concerts successifs sans chevauchement
    const trajets = [];
    for (let i = 1; i < favoris.length; i++) {
      const a = favoris[i - 1], b = favoris[i];
      if (a.jour !== b.jour || b.debutMs < a.finMs) continue;
      const marche = minutesMarche(a.scene.id, b.scene.id);
      const marge = Math.round((b.debutMs - a.finMs) / 60000);
      trajets.push({ de: a.id, vers: b.id, marche, marge, retard: marche == null ? 0 : Math.max(0, marche - marge) });
    }

    // Suggestions : style préféré, têtes d'affiche, créneaux libres
    const suggestions = p.concerts
      .filter((a) => !a.favori && a.statut === "a-venir" && !favoris.some((f) => f.artisteId === a.artisteId))
      .filter((a) => !favoris.some((f) => chevauche(f, a)))
      .map((a) => {
        const style = styles.some((t) => sansAccent(a.genre).includes(t));
        return { ...a, raison: style ? `Dans ton style : ${a.genre}` : a.tete ? "Tête d'affiche, créneau libre" : "Créneau libre dans ton programme", score: (style ? 2 : 0) + (a.tete ? 1 : 0) };
      })
      .sort((a, b) => b.score - a.score || a.debutMs - b.debutMs)
      .filter((a, i, l) => l.findIndex((x) => x.artisteId === a.artisteId) === i)
      .slice(0, 3);

    return {
      jours: p.jours, maintenant: p.maintenant, jourActuel: p.jourActuel, ceSoir: p.ceSoir,
      favoris, conflits, trajets, suggestions, rappels: { actif: rappels.actif, avance: rappels.avance }
    };
  };

  /* Rang actuel, rang suivant et progression */
  App.rang = (xp, rangs) => {
    let i = 0;
    rangs.forEach((r, k) => { if (xp >= r.xp) i = k; });
    const actuel = rangs[i];
    const suivant = rangs[i + 1] || null;
    const progression = suivant ? (xp - actuel.xp) / (suivant.xp - actuel.xp) : 1;
    return { actuel, suivant, index: i, progression, reste: suivant ? suivant.xp - xp : 0 };
  };

  /* ---------- Génération de QR en SVG (nécessite assets/js/vendor/qrcode-generator.min.js) ---------- */
  App.qrSvg = (texte, { niveau = "M", marge = 2, encre = "#3B0A12", fond = "#FFFFFF", titre = "" } = {}) => {
    if (typeof window.qrcode !== "function") throw new Error("qrcode-generator n'est pas chargé sur cette page");
    const qr = window.qrcode(0, niveau);
    qr.addData(texte);
    qr.make();
    const n = qr.getModuleCount();
    const taille = n + marge * 2;
    let chemin = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (qr.isDark(y, x)) chemin += `M${x + marge} ${y + marge}h1v1h-1z`;
    }
    return `<svg class="qr" viewBox="0 0 ${taille} ${taille}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(titre || "QR code")}" shape-rendering="crispEdges">
      <rect width="${taille}" height="${taille}" fill="${fond}"/><path d="${chemin}" fill="${encre}"/></svg>`;
  };

  /* ---------- Avatar « pochette de disque » (réutilisé partout) ---------- */
  App.avatar = (av, pseudo = "", taille = "md") => {
    const initiale = (pseudo.trim()[0] || "?").toUpperCase();
    return `<span class="pochette pochette--${taille} pochette--${esc(av.motif)}"
      style="--fond:var(--${esc(av.fond)});--encre:var(--${esc(av.encre)})" aria-hidden="true">
      <span class="pochette__initiale">${esc(initiale)}</span></span>`;
  };

  /* ---------- Photo d'artiste, en sérigraphie deux encres ----------
     Les fichiers sont préparés hors ligne par outils/photos.py : aplatis en
     six tons de deux encres de la palette, 3 à 4 Ko pièce. La trame de points
     n'est PAS dans l'image, elle est posée en CSS (voir « Photos »).

     Sans photo — et il en manquera toujours, jusqu'au dernier jour — on
     retombe sur une pochette dessinée, tirée du nom pour qu'un même artiste
     garde toujours la même. Aucun trou, aucune image cassée. */
  const POCHETTES_SECOURS = [
    { motif: "soleil",  fond: "sodium", encre: "nuit" },
    { motif: "ondes",   fond: "bleu",   encre: "sodium" },
    { motif: "vinyle",  fond: "rose",   encre: "nuit" },
    { motif: "rayures", fond: "papier", encre: "bleu" },
    { motif: "damier",  fond: "vert",   encre: "nuit" },
    { motif: "demi",    fond: "nuit",   encre: "rose" },
    { motif: "points",  fond: "sodium", encre: "bleu" },
    { motif: "grille",  fond: "nuit",   encre: "vert" }
  ];
  const empreinte = (txt) => {
    let h = 0;
    for (const c of String(txt || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
  };

  App.photo = (sujet, taille = "md") => {
    const nom = (sujet && sujet.nom) || "";
    const src = sujet && (sujet.photo || sujet.photo_url);
    if (!src) {
      const p = POCHETTES_SECOURS[empreinte(nom) % POCHETTES_SECOURS.length];
      return App.avatar(p, nom, taille);
    }
    /* alt vide : le nom de l'artiste est toujours écrit juste à côté. Le
       répéter ferait dire deux fois la même chose au lecteur d'écran. */
    return `<span class="pochette pochette--${taille} pochette--photo" aria-hidden="true">
      <img class="pochette__img" src="${esc(src)}" alt="" width="480" height="480"
        loading="lazy" decoding="async"></span>`;
  };

  /* Une photo qui ne se charge pas (réseau coupé, fichier absent) laisse voir
     le cadre au lieu d'une image brisée. L'événement « error » ne remonte pas :
     il faut l'attraper à la descente, une fois pour toute la page. */
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.classList && img.classList.contains("pochette__img")) {
      img.closest(".pochette").classList.add("is-sans-photo");
    }
  }, true);

  /* ---------- Éléments déjà vus par le joueur (pastilles « Nouveau ») ---------- */
  App.vus = {
    cle: (id) => `vimasquest.vus.${id}`,
    get(id) {
      try { const v = JSON.parse(localStorage.getItem(this.cle(id))); return v ? new Set(v) : null; } catch (e) { return null; }
    },
    set(id, ensemble) {
      try { localStorage.setItem(this.cle(id), JSON.stringify([...ensemble])); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- Annonces lues (valable aussi pour les visiteurs) ---------- */
  App.annoncesLues = {
    cle: "vimasquest.annonces.lues",
    get() {
      try { return new Set(JSON.parse(localStorage.getItem(this.cle)) || []); } catch (e) { return new Set(); }
    },
    set(ensemble) {
      try { localStorage.setItem(this.cle, JSON.stringify([...ensemble])); } catch (e) { /* ignore */ }
    }
  };

  /* Met à jour tous les compteurs d'annonces non lues de la page */
  App.majCompteurAnnonces = async () => {
    try {
      const liste = await App.api.annonces();
      const n = liste.filter((a) => !a.lu).length;
      App.$$("[data-non-lues]").forEach((el) => (el.hidden = n === 0));
      App.$$("[data-non-lues-txt]").forEach((el) => { el.hidden = n === 0; el.textContent = `${n} nouvelle${n > 1 ? "s" : ""}`; });
      App.$$("[data-cloche-compteur]").forEach((el) => { el.hidden = n === 0; el.textContent = n; });
      return n;
    } catch (e) { return 0; }
  };

  /* ---------- Session (joueur connecté) ---------- */
  /* Une session par mode : une partie de démo ne se mélange jamais à une vraie */
  const SESSION_KEY = App.mock ? "vimasquest.demo.session" : "vimasquest.session";
  App.session = {
    get() {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
    },
    set(obj) {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(obj)); } catch (e) { /* stockage indisponible */ }
    },
    clear() {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    },
    isLoggedIn() { return !!this.get(); },
    /* À appeler en haut des pages réservées aux joueurs */
    requireAuth(redirect = "inscription.html") {
      if (!this.isLoggedIn()) window.location.replace(redirect);
    }
  };

  /* ---------- Navigation du joueur (barre du bas + feuille « Plus ») ---------- */
  App.pagesJoueur = [
    { href: "mon-programme.html",  icone: "calendrier", nom: "Mon programme" },
    { href: "plan.html",           icone: "plan",       nom: "Plan du festival" },
    { href: "collection.html",     icone: "etoile",     nom: "Collection" },
    { href: "classement.html",     icone: "trophee",    nom: "Classement" },
    { href: "roue.html",           icone: "roue",       nom: "Roue des récompenses" },
    { href: "blind-test.html",     icone: "micro",      nom: "Blind test" },
    { href: "coups-de-coeur.html", icone: "coeur",      nom: "Coups de cœur" },
    { href: "passeport.html",      icone: "passeport",  nom: "Passeport" },
    { href: "annonces.html",       icone: "cloche",     nom: "Annonces" },
    { href: "infos.html",          icone: "info",       nom: "Infos pratiques" }
  ];

  /* À appeler au début de chaque page joueur. Renvoie false si la page doit s'arrêter. */
  App.initJoueur = ({ actif } = {}) => {
    if (!App.session.isLoggedIn()) { window.location.replace("inscription.html"); return false; }
    document.body.classList.add("avec-tabbar");

    const onglets = [
      { id: "carte",      href: "tableau-de-bord.html", icone: "carte",      nom: "Ma carte" },
      { id: "programme",  href: "programme.html",       icone: "calendrier", nom: "Programme" },
      { id: "scanner",    href: "scanner.html",         icone: "qr",         nom: "Scanner", centre: true },
      { id: "missions",   href: "missions.html",        icone: "cible",      nom: "Missions" }
    ];
    const nav = document.createElement("nav");
    nav.className = "tabbar";
    nav.setAttribute("aria-label", "Navigation du jeu");
    nav.innerHTML = onglets.map((o) => `
      <a class="tabbar__lien${o.centre ? " tabbar__lien--scan" : ""}" href="${o.href}" ${o.id === actif ? 'aria-current="page"' : ""}>
        <span class="tabbar__icone">${App.icon(o.icone)}</span><span class="tabbar__nom">${o.nom}</span>
      </a>`).join("") + `
      <button class="tabbar__lien" type="button" aria-haspopup="dialog" aria-controls="feuille-plus" data-plus ${actif === "plus" ? 'aria-current="page"' : ""}>
        <span class="tabbar__icone">${App.icon("plus")}<span class="tabbar__pastille" data-non-lues hidden></span></span><span class="tabbar__nom">Plus</span>
      </button>`;
    document.body.append(nav);

    const joueur = App.session.get();
    const feuille = document.createElement("dialog");
    feuille.className = "feuille";
    feuille.id = "feuille-plus";
    feuille.setAttribute("aria-labelledby", "feuille-titre");
    feuille.innerHTML = `
      <div class="feuille__entete">
        <h2 class="affiche feuille__titre" id="feuille-titre">Tout le jeu</h2>
        <button class="icone-btn" type="button" aria-label="Fermer" data-fermer>${App.icon("fermer")}</button>
      </div>
      <ul class="feuille__liens">
        ${App.pagesJoueur.map((p) => `<li><a href="${p.href}">${App.icon(p.icone)}<span>${p.nom}</span>${p.href === "annonces.html" ? '<span class="pastille pastille--rose" data-non-lues-txt hidden></span>' : ""}</a></li>`).join("")}
      </ul>
      <div class="feuille__pied">
        <span>Connecté en tant que <strong>${esc(joueur.pseudo)}</strong></span>
        <button class="btn btn--contour btn--sm" type="button" data-deconnexion>${App.icon("sortie")} Se déconnecter</button>
      </div>`;
    document.body.append(feuille);

    const ouvrir = () => (feuille.showModal ? feuille.showModal() : feuille.setAttribute("open", ""));
    const fermer = () => (feuille.close ? feuille.close() : feuille.removeAttribute("open"));
    nav.querySelector("[data-plus]").addEventListener("click", ouvrir);
    feuille.querySelector("[data-fermer]").addEventListener("click", fermer);
    feuille.addEventListener("click", (e) => { if (e.target === feuille) fermer(); });
    feuille.querySelector("[data-deconnexion]").addEventListener("click", () => {
      if (!window.confirm("Te déconnecter de ce téléphone ? Il te faudra ton code secret pour revenir.")) return;
      App.session.clear();
      window.location.href = "index.html";
    });

    App.majCompteurAnnonces();
    return true;
  };

  /* ---------- Formats ---------- */
  const nf = new Intl.NumberFormat("fr-FR");
  App.fmt = {
    /* Espace fine insécable remplacée : la police Anton n'a pas ce caractère */
    nombre: (n) => nf.format(n).replace(/\u202F/g, "\u00A0"),
    heure: (hhmm) => hhmm.replace(":", "h")
  };

  /* ---------- Navigation : barre du haut + menu mobile ---------- */
  function initTopbar() {
    const bar = App.$("[data-topbar]");
    if (!bar) return;
    const toggle = App.$("[data-menu-toggle]", bar);
    const menu = App.$("[data-menu]", bar);

    const setOpen = (open) => {
      bar.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      App.$("use", toggle).setAttribute("href", open ? "#i-fermer" : "#i-menu");
    };

    toggle && toggle.addEventListener("click", () => setOpen(!bar.classList.contains("is-open")));
    menu && menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

    const onScroll = () => bar.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* Le bouton « Jouer » devient « Ma carte » si le joueur est déjà connecté */
    const play = App.$("[data-play-link]", bar);
    if (play && App.session.isLoggedIn()) {
      play.href = "tableau-de-bord.html";
      play.textContent = "Ma carte";
    }
  }

  /* ---------- Égaliseur décoratif ---------- */
  App.eq = (el, count = 24) => {
    if (!el) return;
    const bars = [];
    for (let i = 0; i < count; i++) {
      const h = 25 + Math.round(Math.abs(Math.sin(i * 1.7)) * 75);
      const d = ((i * 137) % 900) / 1000;
      const s = 0.7 + ((i * 53) % 60) / 100;
      bars.push(`<span style="--h:${h}%;--d:-${d}s;--s:${s}s"></span>`);
    }
    el.innerHTML = bars.join("");
    el.setAttribute("aria-hidden", "true");
  };

  /* ---------- Compte à rebours ---------- */
  App.countdown = (el, iso, { done = "C'est parti !" } = {}) => {
    if (!el) return;
    const target = new Date(iso).getTime();
    const parts = { j: App.$("[data-j]", el), h: App.$("[data-h]", el), m: App.$("[data-m]", el) };
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { el.innerHTML = `<p class="countdown__done">${App.esc(done)}</p>`; return false; }
      const j = Math.floor(diff / 864e5);
      const h = Math.floor((diff % 864e5) / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4);
      parts.j.textContent = j;
      parts.h.textContent = String(h).padStart(2, "0");
      parts.m.textContent = String(m).padStart(2, "0");
      return true;
    };
    if (tick()) { const id = setInterval(() => { if (!tick()) clearInterval(id); }, 30000); }
  };

  /* ---------- Compteurs animés (une seule fois, à l'apparition) ---------- */
  App.countUp = (el) => {
    const end = Number(el.dataset.count);
    if (reduceMotion || !("IntersectionObserver" in window)) { el.textContent = App.fmt.nombre(end); return; }
    el.textContent = "0";
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = App.fmt.nombre(Math.round(end * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
  };

  /* ---------- Toast ---------- */
  App.toast = (message, { duree = 3200 } = {}) => {
    let zone = App.$("#toast-zone");
    if (!zone) {
      zone = document.createElement("div");
      zone.id = "toast-zone";
      zone.className = "toast-zone";
      zone.setAttribute("role", "status");
      zone.setAttribute("aria-live", "polite");
      document.body.append(zone);
    }
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    zone.append(t);
    setTimeout(() => { t.classList.add("is-leaving"); setTimeout(() => t.remove(), 300); }, duree);
  };

  /* ---------- Réseau : bandeau hors connexion + service worker ---------- */
  function initReseau() {
    const bandeau = document.createElement("div");
    bandeau.className = "bandeau-reseau";
    bandeau.setAttribute("role", "status");
    bandeau.hidden = true;
    const topbar = document.querySelector("[data-topbar]");
    if (topbar) topbar.after(bandeau); else document.body.prepend(bandeau);
    let minuteur;
    const maj = (enLigne, annoncer) => {
      clearTimeout(minuteur);
      bandeau.classList.toggle("is-ok", enLigne);
      if (!enLigne) {
        bandeau.innerHTML = `${App.icon("alerte")}<span><strong>Hors connexion.</strong> Tu vois les dernières données enregistrées. Scans et votes reprendront avec le réseau.</span>`;
        bandeau.hidden = false;
      } else if (annoncer) {
        bandeau.innerHTML = `${App.icon("valide")}<span><strong>Connexion rétablie.</strong></span>`;
        bandeau.hidden = false;
        minuteur = setTimeout(() => { bandeau.hidden = true; }, 3000);
      } else {
        bandeau.hidden = true;
      }
    };
    window.addEventListener("offline", () => maj(false));
    window.addEventListener("online", () => maj(true, true));
    if (!navigator.onLine && !document.body.classList.contains("page-hors-ligne")) maj(false);

    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !document.body.classList.contains("sans-sw")) {
      navigator.serviceWorker.register(new URL("sw.js", RACINE).href, { scope: RACINE }).catch((e) => console.warn("Service worker non enregistré", e));
    }
  }

  /* ---------- Bandeau « maquette » ----------
     Tant que Vimas Production n'a pas validé le jeu, chaque page du téléphone le dit.
     Passer à false (étape 13) pour le retirer. Pas sur les écrans géants ni la console. */
  App.config.maquette = true;
  function initMaquette() {
    if (!App.config.maquette || /\/(ecran|admin)\//.test(location.pathname)) return;
    const b = document.createElement("p");
    b.className = "bandeau-maquette";
    b.textContent = "Maquette de démonstration · contenu fictif";
    document.body.prepend(b);
  }

  /* ---------- Démarrage ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    injectSprite();
    initMaquette();
    hydrateIcons();
    initTopbar();
    initReseau();
    App.$$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
    document.dispatchEvent(new CustomEvent("app:ready"));
  });

  window.App = App;
})();
