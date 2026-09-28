/* ==========================================================================
   DOMAF Quest — console.js : socle de la console d'administration (étape 6)
   Ordre de chargement : config.js, app.js, vendor/supabase.min.js, serveur.js,
   console.js, page.

   - La console parle TOUJOURS à la base (jamais la démo de mock.js).
   - Connexion : e-mail + mot de passe Supabase Auth ; le rôle vient de la table
     staff par mon_acces() (gm, staff, vendeur). La sécurité reste dans chaque
     fonction SQL : ce fichier ne fait que choisir quoi montrer.
   - Temps réel autorisé (un canal par page) : C.suivre() relit la base au plus
     une fois toutes les 5 s sur signal, filet de 60 s (20 s canal coupé),
     rien quand l'onglet est caché.
   ========================================================================== */
(function () {
  "use strict";
  const App = window.App;
  if (!App) return;

  const C = {};
  App.console = C;
  const CLE_ACCES = "domafquest.console.acces";
  const PAGE = location.pathname.split("/").pop() || "index.html";

  /* ---------- Menu : une ligne par écran, « bientôt » tant qu'il n'existe pas ---------- */
  C.MENU = [
    { groupe: "Pilotage", liens: [
      { page: "index.html", nom: "Tableau de bord", icone: "eclair" },
      { lien: "../ecran/mur.html", nom: "Écran : mur", icone: "cadre", dehors: true },
      { lien: "../ecran/blind-test.html", nom: "Écran : blind test", icone: "cadre", dehors: true }
    ] },
    { groupe: "Joueurs", liens: [
      { page: "joueurs.html", nom: "Joueurs", icone: "passeport" }
    ] },
    { groupe: "Le jeu", liens: [
      { page: "missions.html", nom: "Missions", icone: "cible" },
      { page: "badges.html", nom: "Badges", icone: "etoile" },
      { page: "qr.html", nom: "QR et reliques", icone: "qr" }
    ] },
    { groupe: "Le festival", liens: [
      { page: "programme.html", nom: "Programme, lieux", icone: "calendrier" }
    ] },
    { groupe: "Animation", liens: [
      { page: "blind-test.html", nom: "Régie blind test", icone: "micro", etape: "6.6" },
      { page: "roue.html", nom: "Roue et lots", icone: "roue", etape: "6.5" },
      { page: "annonces.html", nom: "Annonces", icone: "cloche", etape: "6.5" },
      { page: "coups-de-coeur.html", nom: "Coups de cœur", icone: "coeur", etape: "6.5" }
    ] },
    { groupe: "Billetterie", liens: [
      { page: "carnets.html", nom: "Carnets", icone: "billet", etape: "6.7", gm: true }
    ] },
    { groupe: "Bilan", liens: [
      { page: "statistiques.html", nom: "Statistiques", icone: "onde", etape: "6.8" }
    ] }
  ];

  const ROLES = { gm: "Game Master", staff: "Équipe", vendeur: "Vendeur" };

  /* ---------- Base : toujours supabase-js (la session du compte voyage avec) ---------- */
  C.sb = () => App.clientSupabase();

  const CODES_METIER = /^[A-Z][A-Z0-9_]{2,}$/;
  function traduire(err) {
    const msg = (err && err.message) || "";
    let code = "ERREUR";
    if (CODES_METIER.test(msg)) code = msg;
    else if (/JWT|Auth session missing|refresh token/i.test(msg) || err.code === "PGRST301") code = "SESSION_EXPIREE";
    else if (err.code === "42501" || /permission denied/i.test(msg)) code = "ACCES_REFUSE";
    else if (err.code === "PGRST202") code = "FONCTION_ABSENTE";
    else if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) code = "RESEAU";
    else if (/Invalid login credentials/i.test(msg)) code = "IDENTIFIANTS";
    else if (/Email not confirmed/i.test(msg)) code = "EMAIL_NON_CONFIRME";
    const e = new App.ErreurServeur(code, msg, err.status || 0);
    e.detail = err.details || "";   // DETAIL de la base (ex. le concert qui chevauche)
    return e;
  }

  /* Fonction SQL. Jamais réessayée : la console écrit, un doublon compterait deux fois. */
  C.appel = async (nom, params = {}) => {
    let r;
    try { r = await C.sb().rpc(nom, params); }
    catch (e) { throw new App.ErreurServeur("RESEAU", e.message); }
    if (r.error) {
      const e = traduire(r.error);
      if (e.code === "SESSION_EXPIREE") C.versConnexion();
      throw e;
    }
    return r.data;
  };

  /* ---------- Messages d'erreur en français (les pages en ajoutent) ---------- */
  C.messages = {
    RESEAU: "Connexion impossible : vérifie le réseau, puis réessaie.",
    SESSION_EXPIREE: "Ta session a expiré : reconnecte-toi.",
    ACCES_REFUSE: "Ce compte n'a pas les droits pour cette action.",
    IDENTIFIANTS: "E-mail ou mot de passe incorrect.",
    EMAIL_NON_CONFIRME: "Cette adresse e-mail n'est pas encore confirmée dans Supabase.",
    PAS_DANS_EQUIPE: "Ce compte existe, mais il ne fait pas partie de l'équipe (table staff).",
    FONCTION_ABSENTE: "La base n'est pas à jour : un correctif SQL n'a pas encore été appliqué.",
    PHASE_INVALIDE: "Phase inconnue.",
    MESSAGE_VIDE: "Écris le message de l'annonce.",
    TYPE_INVALIDE: "Niveau d'annonce inconnu.",
    FIN_PASSEE: "La fin de validité est déjà passée."
  };
  C.message = (e) => C.messages[e && e.code] || "Une erreur est survenue. Réessaie.";

  /* ---------- Qui est connecté (gardé 10 min dans l'onglet) ---------- */
  function accesConnu(uid) {
    try {
      const m = JSON.parse(sessionStorage.getItem(CLE_ACCES));
      return m && m.uid === uid && Date.now() - m.t < 600000 ? m.acces : null;
    } catch (e) { return null; }
  }
  C.retenirAcces = (acces, uid) => {
    try { sessionStorage.setItem(CLE_ACCES, JSON.stringify({ uid, t: Date.now(), acces })); } catch (e) { /* ignore */ }
  };
  const oublierAcces = () => { try { sessionStorage.removeItem(CLE_ACCES); } catch (e) { /* ignore */ } };

  async function sessionActuelle() {
    const { data } = await C.sb().auth.getSession();
    return data && data.session;
  }

  /* Page d'arrivée selon le rôle. Vendeur : son espace arrive à l'étape 6.7 ;
     d'ici là, la page de connexion le lui dit. */
  C.destination = (acces) => (acces && acces.vendeur ? "connexion.html?vendeur=1" : "index.html");

  C.connecter = async (email, motDePasse) => {
    const { data, error } = await C.sb().auth.signInWithPassword({ email, password: motDePasse });
    if (error) throw traduire(error);
    const acces = await C.appel("mon_acces");
    if (!acces || !acces.membre) {
      await C.sb().auth.signOut();
      throw new App.ErreurServeur("PAS_DANS_EQUIPE");
    }
    C.retenirAcces(acces, data.user.id);
    return acces;
  };

  C.deconnecter = async () => {
    oublierAcces();
    try { await C.sb().auth.signOut(); } catch (e) { /* hors ligne : la session locale part quand même */ }
    location.replace("connexion.html");
  };

  C.versConnexion = () => {
    if (PAGE === "connexion.html") return;
    oublierAcces();
    location.replace(`connexion.html?retour=${encodeURIComponent(PAGE)}`);
  };

  /* Garde d'entrée : renvoie l'accès, ou null si la page a été quittée.
     options.gm : écran réservé au Game Master. */
  C.garde = async ({ gm = false } = {}) => {
    const session = await sessionActuelle();
    if (!session) { C.versConnexion(); return null; }
    let acces = accesConnu(session.user.id);
    if (!acces) {
      try { acces = await C.appel("mon_acces"); }
      catch (e) { if (e.code === "SESSION_EXPIREE") return null; throw e; }
      if (acces && acces.membre) C.retenirAcces(acces, session.user.id);
    }
    if (!acces || !acces.membre) { await C.deconnecter(); return null; }
    if (acces.vendeur) { location.replace(C.destination(acces)); return null; }
    C.menu(acces);
    if (gm && !acces.gm) {
      const main = App.$("[data-console-contenu]");
      if (main) main.innerHTML = `<p class="message">${App.icon("cadenas")}<span>Cet écran est réservé au Game Master.</span></p>`;
      return null;
    }
    return acces;
  };

  /* ---------- Menu latéral (tiroir sur petit écran) ---------- */
  C.menu = (acces) => {
    const nav = App.$("[data-console-nav]");
    if (!nav) return;
    nav.innerHTML = C.MENU.map((g) => {
      const liens = g.liens.filter((l) => !l.gm || acces.gm);
      if (!liens.length) return "";
      return `<p class="cnav__groupe">${App.esc(g.groupe)}</p><ul class="cnav__liste">${liens.map((l) => {
        const icone = App.icon(l.icone);
        if (l.etape) {
          return `<li><span class="cnav__lien is-bientot" aria-disabled="true">${icone}<span>${App.esc(l.nom)}</span><small>${l.etape}</small></span></li>`;
        }
        const href = l.lien || l.page;
        const actif = l.page === PAGE ? ' aria-current="page"' : "";
        const dehors = l.dehors ? ' target="_blank" rel="noopener"' : "";
        return `<li><a class="cnav__lien" href="${href}"${actif}${dehors}>${icone}<span>${App.esc(l.nom)}</span></a></li>`;
      }).join("")}</ul>`;
    }).join("");

    const role = ROLES[acces.role] || acces.role || "";
    const qui = App.$("[data-console-qui]");
    if (qui) qui.innerHTML = `<strong>${App.esc(acces.nom || "Équipe")}</strong><span>${App.esc(role)}</span>`;
    const tag = App.$("[data-console-tag]");
    if (tag) tag.textContent = role;
    const nom = App.$("[data-console-nom]");
    if (nom) nom.textContent = `${acces.gm ? "GM" : "Équipe"} · ${acces.nom || "?"}`;
    App.$$("[data-console-sortir]").forEach((b) => b.addEventListener("click", C.deconnecter));

    const corps = document.body;
    const bouton = App.$("[data-console-menu]");
    const voile = App.$("[data-console-voile]");
    const ouvrir = (oui) => {
      corps.classList.toggle("is-menu-ouvert", oui);
      if (bouton) {
        bouton.setAttribute("aria-expanded", String(oui));
        bouton.innerHTML = App.icon(oui ? "fermer" : "menu") + `<span class="sr-only">${oui ? "Fermer" : "Ouvrir"} le menu</span>`;
      }
    };
    if (bouton) bouton.addEventListener("click", () => ouvrir(!corps.classList.contains("is-menu-ouvert")));
    if (voile) voile.addEventListener("click", () => ouvrir(false));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) ouvrir(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") ouvrir(false); });
  };

  /* ---------- Bouton verrouillé pendant l'appel (règle 5) ---------- */
  C.occuper = (bouton) => {
    if (!bouton) return () => {};
    if (bouton.disabled) return null;
    bouton.disabled = true;
    bouton.setAttribute("aria-busy", "true");
    return () => { bouton.disabled = false; bouton.removeAttribute("aria-busy"); };
  };

  /* ---------- Confirmation (boîte de la page, jamais window.confirm) ---------- */
  C.confirmer = ({ titre, texte = "", oui = "Confirmer", non = "Annuler", danger = false }) => new Promise((resoudre) => {
    const d = document.createElement("dialog");
    d.className = "cboite";
    d.innerHTML = `<form method="dialog" class="cboite__corps">
      <h2 class="cboite__titre">${App.esc(titre)}</h2>
      ${texte ? `<p>${App.esc(texte)}</p>` : ""}
      <div class="cboite__actions">
        <button class="cbtn" value="non">${App.esc(non)}</button>
        <button class="cbtn ${danger ? "cbtn--danger" : "cbtn--primaire"}" value="oui">${App.esc(oui)}</button>
      </div></form>`;
    document.body.appendChild(d);
    d.addEventListener("close", () => { resoudre(d.returnValue === "oui"); d.remove(); });
    d.showModal();
    App.$('[value="oui"]', d).focus();
  });

  /* ---------- Temps réel : relire la base sur signal ----------
     abonnements : [["INSERT", "events"], ["*", "announcements"], …]
     relire()    : la lecture complète de la page (un appel). */
  C.suivre = (nom, abonnements, relire, { min = 5000, filet = 60000, filetCoupe = 20000 } = {}) => {
    let dernier = 0, prevue = null, canalOk = false, echec = false;
    const puce = App.$("[data-console-direct]");
    const marquer = () => {
      if (!puce) return;
      const etat = echec ? "coupe" : canalOk ? "ok" : "lent";
      puce.dataset.etat = etat;
      App.$("[data-console-direct-texte]", puce).textContent =
        etat === "ok" ? "En direct" : etat === "lent" ? "Relu toutes les 20 s" : "Hors connexion";
    };
    const lire = async () => {
      dernier = Date.now();
      try { await relire(); echec = false; }
      catch (e) { echec = e.code === "RESEAU"; if (!echec) console.warn(e); }
      marquer();
    };
    const programmer = (delai = 1500) => {
      if (prevue) return;
      const attente = Math.max(delai, min - (Date.now() - dernier));
      prevue = setTimeout(() => {
        prevue = null;
        if (!document.hidden) lire();
      }, attente);
    };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) programmer(0); });
    try {
      App.direct(nom, (c) => abonnements.reduce(
        (canal, [event, table]) => canal.on("postgres_changes", { event, schema: "public", table }, () => programmer()), c),
      (statut) => {
        canalOk = statut === "SUBSCRIBED";
        marquer();
        if (canalOk) programmer(0);   // un signal a pu être manqué pendant la coupure
      });
    } catch (e) { console.warn(e); }
    setInterval(() => {
      if (Date.now() - dernier > (canalOk ? filet : filetCoupe)) programmer(0);
    }, 5000);
    programmer(0);
    return { maintenant: () => programmer(0) };
  };

  /* ---------- Message passager ----------
     Une boîte ouverte est au premier plan et voile le reste de la page : la
     zone des messages la suit dedans. */
  C.dire = (texte) => {
    App.toast(texte, { duree: 4500 });
    const zone = App.$("#toast-zone");
    const hote = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
    if (zone && zone.parentNode !== hote) hote.append(zone);
  };

  /* Interrupteur actif / éteint d'une ligne de liste */
  C.interrupteur = (actif, attributs, libelle) =>
    `<label class="cinter"><input type="checkbox" ${attributs}${actif ? " checked" : ""}><span class="cinter__piste"></span><span class="sr-only">${App.esc(libelle)}</span></label>`;

  /* ---------- Formats ---------- */
  C.nombre = (n) => Number(n || 0).toLocaleString("fr-FR");
  C.ilYa = (iso) => {
    const min = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000));
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h ${String(min % 60).padStart(2, "0")}`;
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  /* Session perdue en cours de route (onglet resté ouvert la nuit) */
  document.addEventListener("DOMContentLoaded", () => {
    try {
      C.sb().auth.onAuthStateChange((evenement) => { if (evenement === "SIGNED_OUT") C.versConnexion(); });
    } catch (e) { /* supabase-js absent : la page le dira */ }
  });
})();
