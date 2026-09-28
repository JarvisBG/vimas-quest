/* ==========================================================================
   Vimas Quest — serveur.js : accès à la base Supabase
   Ordre de chargement : config.js, [mock.js], app.js, serveur.js, page.
   Écran géant / console : charger aussi vendor/supabase.min.js avant (temps réel).

   Règles (héritées d'Otaku, forfait gratuit) :
   - Les téléphones n'ouvrent AUCUNE connexion temps réel (200 max sur le forfait) :
     ils interrogent la base (App.sonder) et n'ont pas besoin de supabase-js (207 Ko).
   - Le joueur prouve son identité par son code secret, envoyé à chaque RPC.
   - Le client n'écrit jamais XP ni jetons : tout passe par des fonctions SQL.

   SOBRIÉTÉ — à respecter sur CHAQUE page (voir data/PERFORMANCE.md) :
   1. Une page ne demande jamais deux fois la même chose : App.cache (durée de vie).
   2. Deux demandes simultanées de la même donnée = une seule requête (mutualisation).
   3. Ce qui bouge rarement est gardé sur le téléphone et resservi tout de suite,
      la base n'étant relue qu'en arrière-plan (« resservir puis rafraîchir »).
   4. Aucune requête pendant que l'écran est éteint ou l'onglet caché (App.sonder).
   5. Aucune requête déclenchée par la frappe au clavier.
   ========================================================================== */
(function () {
  "use strict";
  const App = window.App;
  if (!App) return;

  const BASE = typeof SUPABASE_URL === "string" ? SUPABASE_URL.replace(/\/$/, "") : "";
  const CLE = typeof SUPABASE_ANON_KEY === "string" ? SUPABASE_ANON_KEY : "";

  /* ---------- Erreurs ----------
     err.code = le code métier levé par la base (SESSION_INVALIDE, DEJA_SCANNE…),
     « RESEAU » si la requête n'a pas abouti, « HTTP_<statut> » sinon. */
  class ErreurServeur extends Error {
    constructor(code, message, statut = 0) {
      super(message || code);
      this.name = "ErreurServeur";
      this.code = code;
      this.statut = statut;
    }
  }
  App.ErreurServeur = ErreurServeur;

  const CODES_METIER = /^[A-Z][A-Z0-9_]{2,}$/;

  async function appeler(chemin, { methode = "GET", corps, delai = 12000, essais = 1 } = {}) {
    if (!BASE) throw new ErreurServeur("SANS_SERVEUR", "config.js absent");
    let derniere;
    for (let essai = 1; essai <= essais; essai++) {
      const ctrl = new AbortController();
      const minuteur = setTimeout(() => ctrl.abort(), delai);
      try {
        const rep = await fetch(`${BASE}/rest/v1/${chemin}`, {
          method: methode,
          headers: { apikey: CLE, "Content-Type": "application/json", Accept: "application/json" },
          body: corps === undefined ? undefined : JSON.stringify(corps),
          signal: ctrl.signal,
          cache: "no-store"
        });
        const texte = await rep.text();
        const json = texte ? JSON.parse(texte) : null;
        if (rep.ok) return json;
        const msg = (json && json.message) || rep.statusText;
        throw new ErreurServeur(CODES_METIER.test(msg) ? msg : `HTTP_${rep.status}`, msg, rep.status);
      } catch (e) {
        if (e instanceof ErreurServeur) throw e;           // réponse du serveur : on ne réessaie pas
        derniere = new ErreurServeur("RESEAU", e.name === "AbortError" ? "délai dépassé" : e.message);
        if (essai < essais) await new Promise((r) => setTimeout(r, 600 * essai + Math.random() * 400));
      } finally {
        clearTimeout(minuteur);
      }
    }
    throw derniere;
  }

  /* Dernière réponse connue, pour afficher quelque chose quand le réseau sature */
  const memoire = {
    lire(cle) { try { return JSON.parse(localStorage.getItem(`vimasquest.memo.${cle}`)); } catch (e) { return null; } },
    ecrire(cle, valeur) {
      try { localStorage.setItem(`vimasquest.memo.${cle}`, JSON.stringify({ t: Date.now(), v: valeur })); } catch (e) { /* plein */ }
    }
  };

  /* ======================================================================
     CACHE — la pièce qui décide du nombre de requêtes envoyées à Supabase.

     Trois protections, dans cet ordre :
       1. « en vol » : si la même donnée est déjà demandée, on attend cette
          requête-là au lieu d'en lancer une deuxième. Une page qui affiche
          le programme à trois endroits ne fait qu'un appel.
       2. « vif » : gardé en mémoire le temps de la page. Coût nul.
       3. « garde » : gardé sur le téléphone (localStorage), donc conservé
          d'une page à l'autre et d'une visite à l'autre. Réservé à ce qui
          bouge rarement (liste des scènes, réglages, lots de la roue).

     `resservir: true` = on affiche tout de suite ce qu'on a, même périmé,
     et on relit la base en arrière-plan. L'écran ne clignote pas et le
     joueur ne regarde jamais un écran vide sur le réseau du festival.
     ====================================================================== */
  const PREFIXE = "vimasquest.cache.";
  const vif = new Map();     // cle -> { t, v }
  const enVol = new Map();   // cle -> Promise

  const lireGarde = (cle) => {
    try { return JSON.parse(localStorage.getItem(PREFIXE + cle)); } catch (e) { return null; }
  };
  const ecrireGarde = (cle, v) => {
    try { localStorage.setItem(PREFIXE + cle, JSON.stringify({ t: Date.now(), v })); }
    catch (e) { App.cache.vider(); }   // stockage plein : on repart à zéro
  };

  App.cache = {
    /* Ce qu'on a déjà, sans rien demander. null si on n'a rien. */
    connu(cle, { garde = false } = {}) {
      const m = vif.get(cle) || (garde ? lireGarde(cle) : null);
      return m ? { valeur: m.v, age: Date.now() - m.t } : null;
    },

    ecrire(cle, valeur, { garde = false } = {}) {
      vif.set(cle, { t: Date.now(), v: valeur });
      if (garde) ecrireGarde(cle, valeur);
      return valeur;
    },

    /* Après une écriture qui change la donnée (un vote, un favori…) */
    oublier(cle) {
      vif.delete(cle);
      try { localStorage.removeItem(PREFIXE + cle); } catch (e) { /* ignore */ }
    },

    vider() {
      vif.clear();
      try {
        Object.keys(localStorage).forEach((k) => { if (k.startsWith(PREFIXE)) localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }
    },

    /* Le point d'entrée : « donne-moi cette donnée, en faisant le moins de
       requêtes possible ». produire() n'est appelée que si c'est nécessaire. */
    async prendre(cle, produire, { duree = 30000, garde = false, resservir = false } = {}) {
      const connu = this.connu(cle, { garde });
      if (connu && connu.age < duree) return connu.valeur;

      if (connu && resservir) {
        if (!enVol.has(cle)) rafraichir(cle, produire, garde);   // en arrière-plan
        return connu.valeur;
      }
      if (enVol.has(cle)) return enVol.get(cle);
      return rafraichir(cle, produire, garde);
    }
  };

  function rafraichir(cle, produire, garde) {
    const p = Promise.resolve()
      .then(produire)
      .then((v) => App.cache.ecrire(cle, v, { garde }))
      .finally(() => enVol.delete(cle));
    enVol.set(cle, p);
    p.catch(() => { /* l'appelant gère ; ici on évite juste « unhandled » */ });
    return p;
  }

  /* Fonction SQL.
     lecture: true → réessaie en cas de coupure (à réserver aux fonctions sans effet).
     memo: "cle"   → garde la réponse ; si le réseau manque, renvoie la dernière connue
                     (le résultat porte alors horsLigne = date de cette réponse).
     cache: "cle"  → ne redemande pas avant `duree` ms (+ garde / resservir : voir App.cache).
                     À N'UTILISER QUE sur des fonctions sans effet de bord. */
  App.rpc = async (nom, params = {}, options = {}) => {
    const { lecture = false, memo = null, delai, cache = null, duree, garde, resservir } = options;
    if (cache) {
      return App.cache.prendre(cache, () => brut(nom, params, { lecture, memo, delai }),
        { duree, garde, resservir });
    }
    return brut(nom, params, { lecture, memo, delai });
  };

  const brut = async (nom, params, { lecture, memo, delai }) => {
    try {
      const v = await appeler(`rpc/${nom}`, { methode: "POST", corps: params, essais: lecture ? 3 : 1, delai });
      if (memo) memoire.ecrire(memo, v);
      return v;
    } catch (e) {
      const ancien = memo && e.code === "RESEAU" ? memoire.lire(memo) : null;
      if (!ancien) throw e;
      const v = ancien.v;
      if (v && typeof v === "object") Object.defineProperty(v, "horsLigne", { value: ancien.t });
      return v;
    }
  };

  /* Lecture d'une table publique (politiques RLS « lecture publique »).
     requete : syntaxe PostgREST, ex. "select=id,pseudo&status=eq.actif&order=xp.desc&limit=10"
     Toujours nommer les colonnes utiles : « select=* » transporte des octets pour rien.
     cache / duree / garde / resservir : voir App.cache. */
  App.lire = (table, requete = "select=*", options = {}) => {
    const { cache, duree, garde, resservir, ...reste } = options;
    const tirer = () => appeler(`${table}?${requete}`, { essais: 3, ...reste });
    if (!cache) return tirer();
    return App.cache.prendre(cache === true ? `${table}?${requete}` : cache, tirer,
      { duree, garde, resservir });
  };

  /* ---------- Messages lisibles ---------- */
  const MESSAGES = {
    RESEAU: "Connexion impossible : vérifie ton réseau et réessaie.",
    SANS_SERVEUR: "Le jeu n'est pas relié à sa base pour le moment.",
    SESSION_INVALIDE: "Session expirée : reconnecte-toi avec ton code secret.",
    CODE_INCONNU: "Code inconnu : vérifie l'orthographe (ex. KORA-12345).",
    JOUEUR_EXCLU: "Ce profil a été exclu du jeu.",
    PSEUDO_DEJA_PRIS: "Ce pseudo est déjà pris, choisis-en un autre.",
    PSEUDO_INVALIDE: "Le pseudo doit faire entre 2 et 16 caractères.",
    QR_INCONNU: "Ce code n'existe pas : vérifie le QR ou la saisie.",
    QR_INACTIF: "Ce QR code a été désactivé par l'organisation.",
    DEJA_SCANNE: "Tu as déjà scanné ce code !",
    JETONS_INSUFFISANTS: "Pas assez de jetons : scanne des QR codes pour en gagner.",
    PLAFOND_JOUR: "Tu as fait tous tes tirages du jour : la roue rouvre demain à 6 h.",
    TICKET_REQUIS: "Il te faut un ticket pour créer ta carte. Prends-en un auprès de l'équipe Vimas Quest, puis scanne son QR code.",
    TICKET_INCONNU: "Ce ticket n'existe pas. Vérifie le code, ou demande à l'équipe.",
    TICKET_UTILISE: "Ce ticket a déjà servi : un ticket ne s'utilise qu'une fois.",
    TICKET_ANNULE: "Ce carnet de tickets a été annulé. Va voir l'équipe Vimas Quest.",
    TICKET_RENDU: "Ce ticket a été rendu invendu : il ne vaut plus rien. Prends-en un neuf auprès de l'équipe.",
    PASS_REQUIS: "Ta journée de jeu n'est pas ouverte. Prends un ticket auprès de l'équipe, puis scanne son QR code.",
    NUMERO_INVALIDE: "Ce numéro ne ressemble pas à un numéro camerounais (9 chiffres, commence par 6).",
    RESERVE_MAJEURS: "Le numéro n'est demandé qu'à partir de 19 ans.",
    CONTACT_DESACTIVE: "L'enregistrement des numéros est fermé pour le moment.",
    FICHE_INVALIDE: "Ta fiche n'a pas été reconnue : recharge la page.",
    QUESTION_INCONNUE: "Cette question n'existe plus : recharge la page.",
    VALEUR_INVALIDE: "Ce choix n'existe pas : recharge la page et réessaie.",
    VALEUR_VIDE: "Choisis une réponse avant de valider.",
    CHAMP_INCONNU: "Cette question n'existe pas : recharge la page.",
    PLUS_DE_COEURS: "Tes coups de cœur sont tous placés : retires-en un pour le donner ailleurs.",
    PAS_SCANNE: "Tu ne peux voter que pour ce que tu as vu sur place : scanne son QR code (la scène pendant le concert, ou le stand).",
    VOTES_CLOS: "Les votes sont clos : les résultats arrivent sur l'écran géant.",
    CATEGORIE_INVALIDE: "Catégorie de vote inconnue.",
    DEJA_VOTE: "Tu as déjà donné ton cœur à celui-là !",
    COEUR_DESACTIVE: "Les coups de cœur sont fermés pour le moment.",
    TROP_RAPIDE: "Doucement ! Attends quelques secondes avant de réessayer.",
    QUIZ_INACTIF: "Aucun blind test en cours pour le moment.",
    QUESTION_FERMEE: "Cette question est passée : attends la suivante !",
    TROP_TARD: "Trop tard, le chrono est écoulé !",
    DEJA_REPONDU: "Réponse déjà verrouillée pour cette question.",
    REPONSE_INVALIDE: "Choix invalide : réessaie.",
    PHASE_RAID: "Blind test en cours : les missions sont en pause, rejoins la partie !",
    PHASE_CLOTURE: "Le jeu est terminé : regarde le podium sur l'écran géant !",
    CRENEAU_INCONNU: "Ce concert n'est plus au programme.",
    TROP_DE_FAVORIS: "Ton programme est plein : retire un concert pour en ajouter un.",
    PAS_FAVORI: "Ce concert n'est pas dans ton programme.",
    ACCES_REFUSE: "Accès réservé à l'équipe."
  };
  App.messageErreur = (e) =>
    (e && MESSAGES[e.code]) || (e && e.code === "HTTP_401" && MESSAGES.ACCES_REFUSE) ||
    "Une erreur est survenue : réessaie dans un instant.";

  /* ---------- Interrogation régulière (téléphones) ----------
     fn est appelée tout de suite, puis toutes les « toutesLes » ms (± 20 %, pour que
     tous les téléphones ne frappent pas en même temps). Rien quand l'écran est caché ;
     rattrapage immédiat au retour. En cas d'échec, l'intervalle double (5 min max). */
  App.sonder = (fn, { toutesLes = 20000, immediat = true } = {}) => {
    let minuteur = null, attente = toutesLes, arrete = false, enCours = false;
    const planifier = () => {
      clearTimeout(minuteur);
      if (!arrete) minuteur = setTimeout(tour, attente * (0.8 + Math.random() * 0.4));
    };
    async function tour() {
      if (arrete || enCours) return;
      if (document.hidden) { planifier(); return; }
      enCours = true;
      try { await fn(); attente = toutesLes; }
      catch (e) { attente = Math.min(attente * 2, 300000); }
      finally { enCours = false; planifier(); }
    }
    const auRetour = () => { if (!document.hidden) { attente = toutesLes; tour(); } };
    document.addEventListener("visibilitychange", auRetour);
    if (immediat) tour(); else planifier();
    return {
      maintenant: tour,
      arreter() { arrete = true; clearTimeout(minuteur); document.removeEventListener("visibilitychange", auRetour); }
    };
  };

  /* ---------- État du jeu (phase, coût de la roue), partagé par la page ---------- */
  let etatJeu = null;
  App.etatJeu = async ({ frais = false } = {}) => {
    if (!frais && etatJeu && Date.now() - etatJeu.t < 15000) return etatJeu.v;
    const lignes = await App.lire("game_state", "select=phase,roulette_cost,updated_at&id=eq.1");
    etatJeu = { t: Date.now(), v: lignes[0] || null };
    return etatJeu.v;
  };

  /* ---------- Joueur connecté (mécanisme Otaku : code secret) ---------- */
  const versSession = (p, code, precedente = {}) => ({
    ...precedente,
    id: p.id, pseudo: p.pseudo, avatar: p.archetype, xp: p.xp, jetons: p.jetons,
    niveau: p.level, rang: p.rank, statut: p.status, code
  });

  App.joueur = {
    code: () => (App.session.get() || {}).code || null,

    /* Inscription. Le ticket n'est envoyé que s'il y en a un (comme Otaku). */
    async creer(pseudo, archetype, ticket) {
      const params = { p_pseudo: pseudo, p_archetype: archetype };
      if (ticket) params.p_ticket = ticket;
      const r = await App.rpc("create_player", params);
      App.session.set(versSession(r.player, r.secret_code));
      return r;
    },

    /* Reprise de partie sur un autre téléphone, avec le code secret */
    async connecter(code) {
      const propre = String(code || "").trim().toUpperCase();
      const p = await App.rpc("login_with_code", { p_code: propre });
      App.session.set(versSession(p, propre));
      return p;
    },

    deconnecter() { App.session.clear(); },

    /* Relit le profil (public) ; verrouille si exclu, déconnecte s'il a disparu */
    async rafraichir() {
      const s = App.session.get();
      if (!s || !s.code) return null;
      const lignes = await App.lire("players", `select=id,pseudo,archetype,xp,jetons,level,rank,status&id=eq.${encodeURIComponent(s.id)}`);
      if (!lignes.length) { App.session.clear(); location.replace("inscription.html"); return null; }
      App.session.set(versSession(lignes[0], s.code, s));
      if (lignes[0].status === "exclu") verrouiller();
      return lignes[0];
    },

    /* Surveillance du statut, une fois par page (toutes les 60 s environ) */
    surveiller() {
      if (this._veille) return;
      this._veille = App.sonder(() => this.rafraichir(), { toutesLes: 60000 });
    }
  };

  /* ---------- Billetterie : faut-il un ticket papier pour créer sa carte ? ----------
     Réglage du GM, il change au plus une fois par jour : gardé sur le téléphone et
     resservi tout de suite. La base n'est relue qu'en arrière-plan. */
  const BILLETTERIE_FERMEE = { actif: false, prix_journee: 500, message: "" };
  App.billetterie = async () => {
    try {
      const lignes = await App.lire("billetterie_config", "select=actif,prix_journee,message&id=eq.1",
        { cache: "billetterie", duree: 300000, garde: true, resservir: true });
      return lignes[0] || BILLETTERIE_FERMEE;
    } catch (e) {
      /* Réseau coupé pendant la toute première visite : on n'exige pas de ticket
         plutôt que de bloquer le joueur ; create_player tranchera de toute façon. */
      const connu = App.cache.connu("billetterie", { garde: true });
      return (connu && connu.valeur && connu.valeur[0]) || BILLETTERIE_FERMEE;
    }
  };

  /* Écran « profil suspendu » : autonome (styles en ligne, aucune ressource supposée) */
  let verrouille = false;
  function verrouiller() {
    if (verrouille) return;
    verrouille = true;
    document.body.innerHTML =
      '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:#3B0A12;color:#fff;text-align:center;padding:24px;font-family:system-ui,sans-serif">' +
      '<div style="max-width:420px"><h1 style="font-size:1.6rem;margin:0 0 12px">Profil suspendu</h1>' +
      '<p style="line-height:1.6;opacity:.85">Ton profil a été suspendu par l\'organisation. ' +
      'Passe au stand Vimas Quest pour en discuter.</p>' +
      '<button onclick="location.reload()" style="margin-top:24px;padding:14px 26px;border-radius:6px;' +
      'border:2px solid #fff;background:transparent;color:#fff;font:inherit;font-weight:700">Vérifier à nouveau</button>' +
      '</div></div>';
  }
  App.verrouiller = verrouiller;

  /* Pages joueur : en mode serveur, une session sans code secret ne vaut rien */
  const initJoueurDemo = App.initJoueur;
  App.initJoueur = (options) => {
    if (!App.mock) {
      const s = App.session.get();
      if (!s || !s.code) { App.session.clear(); location.replace("inscription.html"); return false; }
      if (s.statut === "exclu") { verrouiller(); return false; }
    }
    const ok = initJoueurDemo(options);
    /* surveiller: false quand la page relit déjà le joueur elle-même */
    if (ok && !App.mock && (options || {}).surveiller !== false) App.joueur.surveiller();
    return ok;
  };

  /* ---------- Temps réel : écran géant et console UNIQUEMENT ----------
     Un seul canal par page. Le signal ne transporte rien de sensible : à sa
     réception, la page relit l'état réel en base. */
  let client = null;
  App.clientSupabase = () => {
    if (!client) {
      if (!window.supabase || !BASE) throw new ErreurServeur("SANS_TEMPS_REEL", "supabase-js non chargé sur cette page");
      client = window.supabase.createClient(BASE, CLE);
    }
    return client;
  };
  /* surEtat(statut) : à chaque (re)connexion (« SUBSCRIBED »), relire la base :
     un signal a pu être manqué pendant la coupure. */
  App.direct = (nom, abonner, surEtat) => {
    const canal = abonner(App.clientSupabase().channel(nom));
    canal.subscribe((statut) => { if (surEtat) surEtat(statut); });
    return canal;
  };

  /* ---------- Bascule démo / serveur des actions ----------
     app.js garde les versions démo (App.api) ; l'étape 4 ajoute dans App.serveurApi
     la version serveur de chaque action. Tant qu'une action n'a pas sa version
     serveur, la version démo répond, même en mode serveur. */
  App.serveurApi = App.serveurApi || {};

  /* Le style d'un artiste est un CODE en base (« rnb-soul », valeur de
     profil_options) ; les pages affichent le libellé du site (« R&B / Soul »).
     La liste vient de mock.js et ne bouge pas : lue une fois. */
  let genresParValeur = null;
  async function libellesGenres() {
    if (!genresParValeur) {
      const liste = await App.data.get("genres");
      genresParValeur = Object.fromEntries((liste || []).map((g) => [g.valeur, g.libelle]));
    }
    return genresParValeur;
  }
  const nomGenre = (valeur, table) => (table && table[valeur]) || valeur || "";

  /* ======================================================================
     ÉTAPE 4.1 — Inscription (système de code d'Otaku)

     Le joueur n'a PAS de mot de passe : il reçoit à l'inscription un code
     secret (« KORA-12345 ») qui est sa seule preuve d'identité. Il est
     affiché une fois, en grand, et gardé sur ce téléphone.

     Coût en requêtes, volontairement réduit au minimum :
       nouveau joueur ................ 1 (create_player)
       + billetterie ouverte ......... 2 (ticket_verifier, puis create_player)
       reprise sur un autre téléphone. 1 (login_with_code)
       réglage de la billetterie ..... 0 la plupart du temps (gardé 5 min)
     Le pseudo n'est PAS vérifié au fil de la frappe : c'est create_player
     qui tranche (PSEUDO_DEJA_PRIS). Sinon chaque lettre tapée par chaque
     festivalier deviendrait une requête.
     ====================================================================== */
  Object.assign(App.serveurApi, {
    /* Ticket papier. Le « billet » des visuels d'origine n'existe plus :
       ici c'est le ticket de la billetterie vendeur, et seulement si le GM
       l'a activée. */
    async verifierBillet(code) {
      const r = await App.rpc("ticket_verifier", { p_code: code });
      if (r.etat === "libre") return { statut: "nouveau", billet: { code, type: "Ticket", prix: r.prix } };
      return { statut: { utilise: "utilise", rendu: "rendu", annule: "annule", inconnu: "inconnu" }[r.etat] || "inconnu" };
    },

    /* Aucune pré-vérification en base : voir le commentaire ci-dessus. */
    async pseudoDisponible() { return true; },

    /* Création du profil. Renvoie le code secret à faire noter au joueur. */
    /* Le style musical et le reste de la fiche partent ensuite en UN appel
       (enregistrerFiche, étape 6.3 bis). */
    async creerProfil({ pseudo, avatar, ticket }) {
      try {
        const r = await App.joueur.creer(pseudo, avatar, ticket);
        return { ok: true, joueur: App.session.get(), code: r.secret_code };
      } catch (e) {
        if (e.code === "PSEUDO_DEJA_PRIS") return { ok: false, erreur: "pseudo_pris" };
        throw e;
      }
    },

    /* Reprise de partie sur un autre téléphone, avec le code secret */
    async reprendre(code) {
      await App.joueur.connecter(code);
      return App.session.get();
    },

    /* Réglages de la billetterie (faut-il un ticket ?) */
    async billetterie() {
      const b = await App.billetterie();
      return { actif: !!b.actif, prix: b.prix_journee, message: b.message || "" };
    }
  });

  /* ======================================================================
     ÉTAPE 4.2 — Tableau de bord (player_home)

     Toute la carte en UN appel : player_home a été complétée en base
     (correctif 2026-09-18_etape-4.2.sql) avec le prochain concert, l'alerte
     en cours, le rang général, les scans du jour et le coût de la roue.
     Il n'y a donc ni programme, ni annonces, ni game_state à lire ici.

     Coût : 1 appel au chargement (0 si la carte a moins de 20 s, par exemple
     aller-retour vers le programme), puis 1 toutes les 30 s écran allumé.
     La réponse porte aussi le statut du joueur : la page n'a pas besoin de la
     surveillance séparée (initJoueur({ surveiller: false })).
     Après une action qui change la carte (scan, roue, vote…) :
     App.cache.oublier(App.cleCarte()).
     ====================================================================== */
  App.cleCarte = () => `carte.${(App.session.get() || {}).id || "?"}`;

  /* Texte court d'un événement, vu par le joueur lui-même (ceux de la base
     sont écrits pour l'écran géant : « Kiki a trouvé… »). */
  function activiteDe(e) {
    const p = e.payload || {};
    const textes = {
      scan: () => p.label || "QR code trouvé",
      quete: () => `Mission « ${p.quest || "?"} » terminée`,
      badge: () => `Badge ${p.badge || ""} débloqué`,
      level_up: () => `Niveau ${p.level} atteint`,
      roulette: () => `Roue : ${p.prize || "lot gagné"}`,
      quiz: () => "Meilleure oreille du blind test",
      profil: () => "Profil de festivalier complété",
      bonus: () => "Bonus de l'équipe Vimas Quest"
    };
    return {
      type: { quete: "mission" }[e.type] || e.type,
      heure: App.heureFestival(new Date(e.created_at)).replace("h", ":"),
      texte: (textes[e.type] || (() => p.message || "Activité"))(),
      xp: Number(p.xp) || 0
    };
  }

  /* player_home, partagée par la carte et les missions : aller de l'une à
     l'autre en moins de 20 s ne coûte aucune requête. null = plus de session. */
  async function lireAccueil() {
    const s = App.session.get();
    if (!s || !s.code) return null;
    let h;
    try {
      h = await App.rpc("player_home", { p_secret_code: s.code },
        { cache: App.cleCarte(), duree: 20000, garde: true, lecture: true, memo: "carte" });
    } catch (e) {
      if (e.code === "SESSION_INVALIDE") { App.session.clear(); return null; }
      throw e;
    }
    App.session.set(versSession(h.player, s.code, s));
    if (h.player.status === "exclu") verrouiller();
    return h;
  }

  Object.assign(App.serveurApi, {
    async carte() {
      const h = await lireAccueil();
      if (!h) return null;
      if (!h.horsLigne) App.coffreLocal.ecrire(h.coffre || null);   // la page de scan le montrera

      const pc = h.prochain_concert;
      const badges = h.badges || [];
      const genres = pc ? await libellesGenres() : null;
      return {
        joueur: { ...App.session.get(), billet: "" },
        classement: { general: h.classement_general, jour: h.position },
        badges: { obtenus: badges.filter((b) => b.owned).length, total: badges.length },
        jour: { scans: h.scans_jour, xp: h.points_jour },
        missions: (h.quests || [])
          .filter((q) => !q.completed && q.type !== "secrete")
          .map((q) => ({
            id: q.id, titre: q.title, texte: q.description || "",
            fait: Math.min(q.progress, q.goal_count), objectif: q.goal_count,
            xp: q.xp_reward, validation: q.requires_staff ? "staff" : "auto"
          })),
        activite: (h.events || []).map(activiteDe),
        concert: pc && {
          id: pc.artiste.id, nom: pc.artiste.nom, genre: nomGenre(pc.artiste.genre, genres),
          photo_url: pc.artiste.photo_url,
          debutMs: Date.parse(pc.debut), finMs: Date.parse(pc.fin), favori: pc.favori,
          scene: pc.scene
        },
        annonce: h.annonce && {
          id: h.annonce.id, titre: h.annonce.titre || (h.annonce.type === "danger" ? "Urgent" : "Alerte"),
          texte: h.annonce.message
        },
        roue: { cout: h.roulette_cost },
        roi: h.roi_veille && { pseudo: h.roi_veille.pseudo, points: h.roi_veille.points, jour: h.roi_veille.jour_label },
        pass: { actif: h.pass_actif !== false, prix: h.pass_prix },
        fiche: versFiche(h.fiche),
        coffre: h.coffre || null,
        horsLigne: h.horsLigne || null
      };
    }
  });

  /* ======================================================================
     ÉTAPE 4.3 — Scanner (scan_qr, ticket_utiliser)

     Ce que contient un QR imprimé (format Otaku) :
       QR du jeu  → …/scanner.html?code=DQ-7K3M9P   (ou le code seul)
       ticket     → …/inscription.html?t=AB3KX9QZ   (ou les 8 caractères seuls)
     Aucune liste de QR n'est envoyée au téléphone : c'est la base qui dit
     « inconnu », « éteint » ou « déjà scanné ».

     Coût : 1 appel par scan, jamais de nouvel essai automatique (un second
     envoi d'un scan qui avait abouti serait refusé comme doublon et le joueur
     verrait « déjà scanné » au lieu de ses gains). Après un scan ou un ticket
     accepté, la carte est oubliée du cache : elle se relit à l'affichage.
     ====================================================================== */
  function lireQR(contenu) {
    let txt = String(contenu || "").trim();
    try {
      const url = new URL(txt);
      const ticket = url.searchParams.get("t") || url.searchParams.get("ticket");
      if (ticket) return { ticket };
      txt = url.searchParams.get("code") || url.pathname.split("/").filter(Boolean).pop() || "";
    } catch (e) { /* pas une adresse : le code seul */ }
    const code = txt.toUpperCase().replace(/\s+/g, "");
    const jeu = code.match(/^DQ-?([A-Z0-9]{6})$/);
    if (jeu) return { qr: `DQ-${jeu[1]}` };
    if (/^[A-Z0-9]{8}$/.test(code.replace(/-/g, ""))) return { ticket: code };
    return { qr: code };
  }

  const ECHECS_SCAN = {
    DEJA_SCANNE: "deja", QR_INCONNU: "inconnu", QR_INACTIF: "inactif",
    PASS_REQUIS: "pass", PHASE_RAID: "raid", PHASE_CLOTURE: "cloture",
    SESSION_INVALIDE: "session"
  };
  const ECHECS_TICKET = {
    TICKET_INCONNU: "inconnu", TICKET_UTILISE: "utilise", TICKET_RENDU: "rendu", TICKET_ANNULE: "annule"
  };

  Object.assign(App.serveurApi, {
    async scanner(contenu) {
      const s = App.session.get();
      if (!s || !s.code) return { statut: "session" };
      const lu = lireQR(contenu);
      if (!lu.qr && !lu.ticket) return { statut: "inconnu" };

      /* ---- Ticket papier : ouvre la journée de jeu ---- */
      if (lu.ticket) {
        try {
          const r = await App.rpc("ticket_utiliser", { p_secret_code: s.code, p_code: lu.ticket });
          App.cache.oublier(App.cleCarte());
          App.cache.oublier(App.cleCollection());
          return { statut: r.gratuit ? "ticket-gratuit" : r.deja ? "ticket-deja" : "ticket-ok", prix: r.prix };
        } catch (e) {
          if (e.code === "JOUEUR_EXCLU") { verrouiller(); return { statut: "session" }; }
          if (ECHECS_TICKET[e.code]) return { statut: "ticket-refuse", raison: ECHECS_TICKET[e.code] };
          if (e.code === "SESSION_INVALIDE") return { statut: "session" };
          throw e;
        }
      }

      /* ---- QR du jeu ---- */
      let r;
      try {
        r = await App.rpc("scan_qr", { p_secret_code: s.code, p_code: lu.qr });
      } catch (e) {
        if (e.code === "JOUEUR_EXCLU") { verrouiller(); return { statut: "session" }; }
        if (ECHECS_SCAN[e.code]) return { statut: ECHECS_SCAN[e.code] };
        throw e;   // réseau : la page affiche « Réseau saturé »
      }

      const avant = App.session.get();
      App.session.set(versSession(r.player, s.code, s));
      App.cache.oublier(App.cleCarte());
      App.cache.oublier(App.cleCollection());
      App.cache.oublier(App.cleFavoris());   // un artiste peut devenir « vu »

      App.coffreLocal.ecrire(r.coffre || null);
      const quetes = r.quetes || [];
      const faites = quetes.filter((q) => q.terminee);
      const xpMissions = faites.reduce((t, q) => t + q.xp, 0);
      const badges = r.nouveaux_badges || [];
      const type = r.qr.type;
      return {
        statut: "ok",
        qr: { nom: r.qr.label, type },
        gains: { xp: r.xp_gagne, jetons: r.jetons_gagnes },
        detail: faites.length ? [
          { libelle: r.qr.label, xp: r.xp_gagne - xpMissions },
          ...faites.map((q) => ({ libelle: `Mission « ${q.titre} »`, xp: q.xp }))
        ] : [],
        missions: quetes.map((q) => ({
          titre: q.titre, fait: q.fait, objectif: q.objectif, avant: q.fait - 1, terminee: q.terminee
        })),
        /* Ce que le scan ajoute à la collection : l'artiste du concert en cours
           (ou de la dédicace), un stand, une relique — la première fois seulement. */
        debloques: r.artiste && r.artiste.nouveau
          ? [{ nom: r.artiste.nom, type: "artiste", dedicace: !!r.artiste.dedicace }]
          : !r.deja_collection && ["stand", "foodtruck", "relique"].includes(type)
            ? [{ nom: r.qr.label, type: type === "relique" ? "relique" : "stand" }]
            : [],
        badge: badges.length ? {
          nom: badges[0],
          texte: badges.length > 1 ? `Et aussi : ${badges.slice(1).join(", ")}.` : "Il rejoint ta collection."
        } : null,
        /* 6.3 bis : avec un coffre, l'XP n'est pas encore versée (coffre_ouvrir) */
        coffre: r.coffre || null,
        rang: { monte: r.player.rank !== avant.rang, apres: { nom: r.player.rank } },
        avantJoueur: { xp: r.coffre ? r.player.xp : r.player.xp - r.xp_gagne },
        joueur: App.session.get()
      };
    }
  });

  /* ======================================================================
     ÉTAPE 4.4 — Missions (player_home, même cache que la carte)

     Ce qui existe en base : missions du jour avec avancée, catégorie
     (console_mission_enregistrer), validation par le staff. Ce qui n'existe PAS
     (maquettes d'origine) : missions verrouillées par rang, missions à
     horaire, défi éclair, indices payants (retirés le 18/09/2026). Les
     onglets correspondants restent simplement vides.
     Une mission secrète n'apparaît qu'une fois terminée.
     ====================================================================== */
  function actionDe(q) {
    if (q.requires_staff) return "staff";
    if (q.counter === "coeur") return "votes";
    if (String(q.counter).startsWith("scan")) return "scanner";
    return null;
  }

  Object.assign(App.serveurApi, {
    async missions() {
      const h = await lireAccueil();
      if (!h) return null;
      const missions = (h.quests || [])
        .filter((q) => q.completed || q.type !== "secrete")
        .map((q) => ({
          id: q.id, titre: q.title, texte: q.description || "", categorie: q.categorie,
          objectif: q.goal_count, fait: Math.min(q.progress, q.goal_count),
          xp: q.xp_reward, jetons: Math.floor(q.xp_reward / 10),   // règle de la base : 1 jeton pour 10 XP
          statut: q.completed ? "terminee" : q.progress > 0 ? "en-cours" : "a-faire",
          action: actionDe(q),
          terminee: q.completed ? { heure: q.completed_at ? App.heureFestival(new Date(q.completed_at)).replace("h", ":") : null } : null,
          finMs: null
        }));
      return { joueur: App.session.get(), missions, horsLigne: h.horsLigne || null };
    },

    /* Ce que le staff scanne pour valider une mission : l'identifiant PUBLIC
       du joueur (admin_validate_quest prend un player_id), jamais son code
       secret, qui permettrait de se connecter à sa place. Le code de secours
       est le pseudo, que la console retrouve par recherche. */
    async codeValidation() {
      const j = App.session.get();
      return { code: j.pseudo, contenu: `DQ-JOUEUR:${j.id}`, expire: null };
    }
  });

  /* ======================================================================
     ÉTAPE 4.5 — Collection (player_collection)

     Un appel, gardé 2 min sur le téléphone : la collection ne change qu'avec
     un scan (qui l'oublie du cache), un badge remis par l'équipe ou gagné au
     blind test. Pas d'interrogation régulière sur cette page.
     Rayons : badges, artistes vus (scène scannée pendant le concert, ou
     dédicace), stands et food-trucks, reliques (indice seulement tant
     qu'elles ne sont pas trouvées). Les dates arrivent en horodatage : le
     jour affiché est la journée de jeu (6 h → 6 h).
     ====================================================================== */
  App.cleCollection = () => `collection.${(App.session.get() || {}).id || "?"}`;

  const SIX_HEURES = 6 * 3600 * 1000;
  const moment = (horodatage) => {
    if (!horodatage) return null;
    const d = new Date(horodatage);
    return {
      jour: App.jourFestival(new Date(d.getTime() - SIX_HEURES)),
      heure: App.heureFestival(d).replace("h", ":")
    };
  };
  const RARETE_RELIQUE = { commune: "commun", rare: "rare", legendaire: "legendaire" };

  Object.assign(App.serveurApi, {
    async collection() {
      const s = App.session.get();
      if (!s || !s.code) return null;
      let c;
      try {
        c = await App.rpc("player_collection", { p_secret_code: s.code },
          { cache: App.cleCollection(), duree: 120000, garde: true, lecture: true, memo: App.cleCollection() });
      } catch (e) {
        if (e.code === "SESSION_INVALIDE") { App.session.clear(); return null; }
        throw e;
      }
      const jours = await App.data.get("jours").catch(() => []);
      const jourParDate = Object.fromEntries(jours.map((j) => [j.date, j]));
      const genres = await libellesGenres();

      return {
        badges: c.badges.map((b) => ({
          id: b.id, nom: b.nom || "Badge secret", texte: b.texte || "", icone: b.icone || "info",
          rarete: b.rarete, forme: b.forme, secret: b.secret, lien: b.lien,
          pctJoueurs: b.pct, obtenu: moment(b.obtenu)
        })),
        artistes: c.artistes.map((a) => {
          const debut = a.concert && moment(a.concert.debut);
          const vu = moment(a.vu);
          return {
            id: a.id, nom: a.nom, genre: nomGenre(a.genre, genres), photo_url: a.photo_url,
            scene: a.concert && a.concert.scene,
            jourInfo: debut && jourParDate[debut.jour], debut: debut ? debut.heure : "",
            obtenu: vu && { ...vu, dedicace: a.dedicace }
          };
        }),
        stands: c.stands.map((x) => ({
          id: x.id, nom: x.nom, type: x.categorie === "food" ? "foodtruck" : "stand",
          zone: x.zone || "", obtenu: moment(x.vu)
        })),
        reliques: c.reliques.map((r) => ({
          id: r.id, nom: r.nom, rarete: RARETE_RELIQUE[r.rarete] || "commun",
          indice: r.indice || "", obtenu: moment(r.vu)
        })),
        joueurs: c.joueurs, joursPresents: c.jours_presents, missionsTerminees: c.missions,
        horsLigne: c.horsLigne || null
      };
    }
  });

  /* ======================================================================
     ÉTAPE 4.6 — Passeport (player_home + player_collection)

     Aucune fonction propre : la carte et la collection, déjà en cache sur le
     téléphone quand on vient de l'une ou de l'autre (0 à 2 requêtes).
     Décisions du 18/09/2026 : pas de passeport public (le lien et le QR
     mènent à l'adresse du jeu, sans code d'ami), missions = toutes celles
     terminées pendant le festival (pas de « sur N » : elles se refont
     chaque jour).
     ====================================================================== */
  const ORDRE_RARETE = { legendaire: 0, epique: 1, rare: 2, commun: 3 };

  Object.assign(App.serveurApi, {
    async passeport() {
      const [h, c] = await Promise.all([lireAccueil(), App.serveurApi.collection()]);
      if (!h || !c) return null;
      const [rangs, festival, jours, raretes, avatars] =
        await Promise.all(["rangs", "festival", "jours", "raretes", "avatars"].map(App.data.get));
      const joueur = App.session.get();
      const lien = new URL("index.html", location.href).href;
      return {
        festival, joueur,
        avatar: avatars.find((a) => a.id === joueur.avatar) || avatars[0],
        rang: App.rang(joueur.xp, rangs),
        place: h.classement_general, totalJoueurs: c.joueurs,
        badges: {
          liste: c.badges.filter((b) => b.obtenu).sort((a, b) => ORDRE_RARETE[a.rarete] - ORDRE_RARETE[b.rarete]),
          total: c.badges.length
        },
        raretes,
        artistes: {
          liste: c.artistes.filter((a) => a.obtenu).map((a) => ({ ...a, dedicace: !!a.obtenu.dedicace })),
          total: c.artistes.length
        },
        stands: { nombre: c.stands.filter((x) => x.obtenu).length, total: c.stands.length },
        missions: { terminees: c.missionsTerminees, total: null },
        jours: { presents: Math.max(1, c.joursPresents || 0), total: jours.length },
        lienPublic: lien, lienInvitation: lien,
        horsLigne: h.horsLigne || c.horsLigne || null
      };
    }
  });

  /* ======================================================================
     ÉTAPE 4.7 — Classement (classement_joueur / _chercher / _amis)

     Décisions du 18/09/2026 :
       · général (XP total) et du jour : classement_joueur, qui ne lit que des
         index (6 ms / 2 ms au banc sur 5 000 joueurs) ; leaderboard_view reste
         celle de l'écran géant ;
       · amis GARDÉS SUR LE TÉLÉPHONE (liste de pseudos, 30 au plus), ajoutés par
         pseudo exact ; un appel renvoie leurs scores ;
       · recherche sur validation seulement, 3 lettres minimum ;
       · flèche de progression pour le joueur seulement (place précédente
         retenue sur le téléphone).
     Coût : 1 appel par onglet affiché, gardé 30 s (changer d'onglet et revenir
     ne coûte rien), puis 1 / 60 s écran allumé.
     ====================================================================== */
  const cleAmis = () => `vimasquest.amis.${(App.session.get() || {}).id || "?"}`;
  const lireAmis = () => {
    try { return JSON.parse(localStorage.getItem(cleAmis())) || []; } catch (e) { return []; }
  };
  const ecrireAmis = (l) => { try { localStorage.setItem(cleAmis(), JSON.stringify(l)); } catch (e) { /* plein */ } };
  const MAX_AMIS = 30;

  /* Place précédente du joueur, pour sa flèche (+3 places) */
  function evolutionDe(periode, place) {
    const cle = `vimasquest.place.${(App.session.get() || {}).id || "?"}.${periode}`;
    let avant = null;
    try { avant = JSON.parse(localStorage.getItem(cle)); } catch (e) { /* rien */ }
    try { localStorage.setItem(cle, JSON.stringify(place)); } catch (e) { /* plein */ }
    return typeof avant === "number" ? avant - place : 0;
  }

  async function referentiel() {
    const [avatars, rangs] = await Promise.all(["avatars", "rangs"].map(App.data.get));
    return {
      avatar: (id) => avatars.find((a) => a.id === id) || avatars[0],
      rangNom: (xp) => App.rang(xp, rangs).actuel.nom
    };
  }

  const appelJoueur = async (nom, params, options) => {
    const s = App.session.get();
    if (!s || !s.code) return null;
    try {
      return await App.rpc(nom, { p_secret_code: s.code, ...params }, options);
    } catch (e) {
      if (e.code === "SESSION_INVALIDE") { App.session.clear(); return null; }
      if (e.code === "JOUEUR_EXCLU") { verrouiller(); return null; }
      throw e;
    }
  };

  Object.assign(App.serveurApi, {
    async classement(periode = "general") {
      const s = App.session.get();
      const c = await appelJoueur("classement_joueur", { p_periode: periode },
        { cache: `classement.${periode}.${s && s.id}`, duree: 30000, lecture: true });
      if (!c) return null;
      const r = await referentiel();
      const joueur = (j) => ({
        rang: j.place, pseudo: j.pseudo, xp: j.score, estMoi: !!j.moi,
        avatar: r.avatar(j.avatar), rangNom: r.rangNom(j.xp)
      });
      const moiLigne = { ...joueur({ ...c.moi, pseudo: s.pseudo, avatar: s.avatar, xp: s.xp, moi: true }) };
      moiLigne.evolution = evolutionDe(periode, c.moi.place);
      const avecMoi = (j) => (j.moi ? moiLigne : joueur(j));
      return {
        periode, total: c.total, maj: Date.now(),
        top: c.top.map(avecMoi),
        autour: c.autour.map(avecMoi),
        moi: { ...moiLigne, prochain: c.moi.devant && { pseudo: c.moi.devant.pseudo, ecart: c.moi.devant.ecart } }
      };
    },

    /* Sur validation seulement ; jamais pendant la frappe */
    async chercherJoueur(texte, periode = "general") {
      if (String(texte || "").trim().length < 3) return { statut: "court" };
      let l;
      try {
        l = await appelJoueur("classement_chercher", { p_texte: texte.trim(), p_periode: periode });
      } catch (e) {
        if (e.code === "RECHERCHE_TROP_COURTE") return { statut: "court" };
        throw e;
      }
      if (!l || !l.length) return { statut: "aucun" };
      const r = await referentiel();
      return {
        statut: "ok",
        resultats: l.map((j) => ({ pseudo: j.pseudo, xp: j.score, rang: j.place, avatar: r.avatar(j.avatar) }))
      };
    },

    /* La bande : classée entre amis à l'XP total */
    async amis(periode = "general") {
      const s = App.session.get();
      const liste = await appelJoueur("classement_amis", { p_pseudos: lireAmis(), p_periode: periode },
        { cache: `classement.amis.${s && s.id}`, duree: 30000, lecture: true });
      if (!liste) return null;
      const r = await referentiel();
      const l = liste.map((j) => ({
        pseudo: j.pseudo, xp: j.score, estMoi: !!j.moi,
        avatar: r.avatar(j.avatar), rangNom: r.rangNom(j.xp)
      }));
      l.sort((a, b) => b.xp - a.xp);
      l.forEach((x, i) => { x.rang = i > 0 && x.xp === l[i - 1].xp ? l[i - 1].rang : i + 1; });
      const moi = l.find((x) => x.estMoi);
      const devant = l.filter((x) => x.xp > moi.xp).pop();
      moi.prochain = devant ? { pseudo: devant.pseudo, ecart: devant.xp - moi.xp + 1 } : null;
      return { periode, liste: l, moi, total: l.length, maj: Date.now() };
    },

    /* Ajout par pseudo exact (la casse ne compte pas) */
    async ajouterAmi(saisie) {
      const s = App.session.get();
      const pseudo = String(saisie || "").trim();
      if (pseudo.toLowerCase() === (s.pseudo || "").toLowerCase()) return { ok: false, erreur: "soi" };
      const amis = lireAmis();
      if (amis.some((p) => p.toLowerCase() === pseudo.toLowerCase())) return { ok: false, erreur: "deja", ami: { pseudo } };
      if (amis.length >= MAX_AMIS) return { ok: false, erreur: "plein" };
      const l = await appelJoueur("classement_amis", { p_pseudos: [pseudo], p_periode: "general" });
      const ami = (l || []).find((j) => !j.moi);
      if (!ami) return { ok: false, erreur: "inconnu" };
      ecrireAmis([...amis, ami.pseudo]);
      App.cache.oublier(`classement.amis.${s.id}`);
      return { ok: true, ami: { pseudo: ami.pseudo } };
    }
  });

  /* ======================================================================
     ÉTAPE 4.8 — Roue (roulette_joueur, spin_roulette)

     Coût : 1 appel au chargement (roulette_joueur : coût, plafond, tirages du
     jour, lots avec leur stock, bons de retrait), 0 si la page a été vue il y a
     moins de 20 s ; 1 appel par tirage, jamais réessayé (un second envoi
     dépenserait des jetons une seconde fois). Pas d'interrogation régulière.
     Le serveur tire le lot ; la roue ne fait que tourner jusqu'à sa case.
     Lieu, horaires et date limite de retrait : dans le site (mock.js, roue.retrait).
     ====================================================================== */
  const cleRoue = () => `roue.${(App.session.get() || {}).id || "?"}`;
  const TYPE_LOT = { objet: "lot", badge: "badge", xp: "xp", jetons: "jetons", rien: "rien" };

  function segmentDe(l) {
    const type = TYPE_LOT[l.genre] || "lot";
    const court = l.court || (type === "xp" ? `+${l.valeur} XP` : type === "jetons" ? `+${l.valeur} jetons` : String(l.nom).slice(0, 12));
    const defaut = { lot: "cadeau", badge: "etoile", rien: "fermer", xp: "eclair", jetons: "roue" }[type];
    return {
      id: l.id, type, valeur: l.valeur, court, poids: l.poids,
      lotInfo: { nom: l.nom, rarete: l.rarete || "commun", icone: App.iconeBrute(l.icone) ? l.icone : defaut, stock: l.stock },
      epuise: l.stock !== null && l.stock !== undefined && l.stock <= 0
    };
  }

  async function retraitDuSite() {
    const [cfg, jours] = await Promise.all(["roue", "jours"].map(App.data.get));
    const jourLimite = jours.find((j) => j.id === cfg.retrait.limite.jour);
    return { ...cfg.retrait, limiteTexte: `${jourLimite.long.split(" ")[0].toLowerCase()} ${cfg.retrait.limite.heure.replace(":", "h")}` };
  }

  const ECHECS_TIRAGE = { JETONS_INSUFFISANTS: "jetons", PLAFOND_JOUR: "limite", PASS_REQUIS: "pass", RESEAU: "reseau" };

  Object.assign(App.serveurApi, {
    async roue() {
      const r = await appelJoueur("roulette_joueur", {}, { cache: cleRoue(), duree: 20000, lecture: true });
      if (!r) return null;
      App.session.set({ ...App.session.get(), jetons: r.jetons });
      const segments = r.lots.map(segmentDe);
      const total = segments.filter((x) => !x.epuise).reduce((t, x) => t + x.poids, 0);
      segments.forEach((x) => { x.chance = x.epuise || !total ? 0 : Math.round((x.poids / total) * 1000) / 10; });
      return {
        jetons: r.jetons, cout: r.cout, segments,
        tiragesJour: r.tirages_jour, maxParJour: r.max_jour, pass: r.pass_actif !== false,
        retrait: await retraitDuSite(),
        bons: r.bons.map((b) => ({
          code: b.code, lot: b.lot, statut: b.retire_le ? "retire" : "a-retirer",
          lotInfo: { nom: b.nom || "Lot", rarete: b.rarete || "commun", icone: App.iconeBrute(b.icone) ? b.icone : "cadeau" },
          creeLe: moment(b.cree_le), retireLe: moment(b.retire_le), par: b.par
        }))
      };
    },

    /* Jamais réessayé, jamais mis en cache : chaque appel dépense des jetons */
    async tirer() {
      const s = App.session.get();
      let v;
      try {
        v = await App.rpc("spin_roulette", { p_secret_code: s.code });
      } catch (e) {
        if (e.code === "SESSION_INVALIDE") { App.session.clear(); location.replace("inscription.html"); }
        if (e.code === "JOUEUR_EXCLU") verrouiller();
        return { ok: false, erreur: ECHECS_TIRAGE[e.code] || "autre", message: App.messageErreur(e) };
      } finally {
        App.cache.oublier(cleRoue());
      }
      App.cache.oublier(App.cleCarte());
      const maj = { ...s, jetons: v.jetons_restants };
      if (v.xp !== undefined) Object.assign(maj, { xp: v.xp, niveau: v.level, rang: v.rank });
      App.session.set(maj);
      const p = v.prize;
      // Lot épuisé par un autre joueur pendant le tirage : jetons dépensés, rien gagné
      if (!p) return { ok: true, perdu: true, joueur: maj };
      if (p.kind === "badge") App.cache.oublier(App.cleCollection());
      const segment = segmentDe({ id: p.id, genre: p.kind, nom: p.name, icone: p.icon, valeur: p.value, stock: null });
      segment.badge = p.badge && { nom: p.badge.name, deja: !!p.deja };
      return {
        ok: true, lotId: p.id, segment, joueur: maj,
        bon: p.redeem && { code: p.redeem, lot: p.id, statut: "a-retirer", creeLe: moment(Date.now()), lotInfo: segment.lotInfo }
      };
    }
  });

  /* ======================================================================
     ÉTAPE 4.9 — Coups de cœur (coeur_liste, coeur_donner, coeur_retirer)

     Coût : 1 appel au chargement (coeur_liste : réglages, mes cœurs, artistes
     et stands avec leur total), 0 si la page a été vue il y a moins de 30 s ;
     1 appel par cœur donné ou repris, jamais réessayé. La réponse du vote
     corrige la copie en cache : la page se redessine sans relire la base.
     On ne vote que pour ce qu'on a vu sur place (scène scannée pendant le
     concert, dédicace, QR du stand) : la base le vérifie.
     Texte des résultats : dans le site (mock.js, votesConfig.resultats).
     ====================================================================== */
  const cleCoeurs = () => `coeurs.${(App.session.get() || {}).id || "?"}`;
  const jourCourt = (d) => new Intl.DateTimeFormat("fr-FR", { timeZone: App.config.fuseau, weekday: "short" }).format(d);
  const jourLong = (d) => new Intl.DateTimeFormat("fr-FR", { timeZone: App.config.fuseau, weekday: "long" }).format(d);

  /* Même calcul que la démo : total, part et place de chaque candidat */
  function avecTotaux(liste, mes) {
    const total = liste.reduce((t, x) => t + x.votes, 0) || 1;
    const tri = [...liste].sort((a, b) => b.votes - a.votes);
    return liste.map((x) => ({
      ...x,
      pct: Math.round((x.votes / total) * 1000) / 10,
      tendance: x.votes ? tri.findIndex((y) => y.id === x.id) + 1 : null,
      vote: mes.includes(x.id)
    }));
  }

  Object.assign(App.serveurApi, {
    async coupsDeCoeur() {
      const [r, cfg] = await Promise.all([
        appelJoueur("coeur_liste", {}, { cache: cleCoeurs(), duree: 30000, lecture: true }),
        App.data.get("votesConfig")
      ]);
      if (!r) return null;
      const cloture = new Date(r.cloture);
      const maintenant = Date.now();
      const genres = await libellesGenres();
      return {
        coeurs: r.max, xp: r.xp, xpRestants: r.xp_restants, jury: r.jury,
        resultats: cfg.resultats,
        cloture: { ms: cloture.getTime(), passee: r.clos || !r.actif, libelle: `${jourLong(cloture)} ${App.heureFestival(cloture)}` },
        mesVotes: { artistes: r.mes.artistes, stands: r.mes.stands },
        artistes: avecTotaux(r.artistes.map((a) => {
          const debut = new Date(a.concert.debut);
          return {
            id: a.id, nom: a.nom, genre: nomGenre(a.genre, genres), photo: a.photo_url, scene: a.concert.scene,
            vu: a.vu, votable: a.vu, votes: a.coeurs,
            raison: a.vu ? null : debut.getTime() > maintenant
              ? `Votable après son concert (${jourCourt(debut)} à ${App.heureFestival(debut)}) : scanne la scène sur place`
              : "Scanne la scène pendant un de ses concerts pour voter"
          };
        }), r.mes.artistes),
        stands: avecTotaux(r.stands.map((x) => ({
          id: x.id, nom: x.nom, type: x.categorie === "food" ? "foodtruck" : "stand", zone: x.zone,
          vu: x.vu, votable: x.vu, votes: x.coeurs,
          raison: x.vu ? null : "Scanne son QR sur place pour pouvoir voter"
        })), r.mes.stands)
      };
    },

    /* Jamais réessayé : un second envoi serait refusé (DEJA_VOTE) */
    async voter({ categorie, id, actif }) {
      const s = App.session.get();
      let v;
      try {
        v = await App.rpc(actif ? "coeur_donner" : "coeur_retirer", { p_secret_code: s.code, p_categorie: categorie, p_cible: id });
      } catch (e) {
        if (e.code === "SESSION_INVALIDE") { App.session.clear(); location.replace("inscription.html"); }
        if (e.code === "JOUEUR_EXCLU") verrouiller();
        // Votes clos, stand éteint… : la page relira la base
        if (e.code !== "RESEAU") App.cache.oublier(cleCoeurs());
        return { ok: false, erreur: e.code, raison: App.messageErreur(e) };
      }
      // La copie en cache suit la réponse : pas de nouvelle lecture
      const connu = App.cache.connu(cleCoeurs());
      const badges = v.badges || [];
      if (connu) {
        const r = connu.valeur;
        r.mes[categorie] = v.mes || [];
        const cible = r[categorie].find((x) => x.id === id);
        if (cible) cible.coeurs = v.coeurs;
        if (actif && r.xp_restants > 0) r.xp_restants -= 1;
        if (badges.includes("Jury")) r.jury = true;
        App.cache.ecrire(cleCoeurs(), r);
      } else {
        App.cache.oublier(cleCoeurs());
      }
      if (actif) {
        App.cache.oublier(App.cleCarte());
        if (badges.length) App.cache.oublier(App.cleCollection());
        App.session.set({ ...s, xp: v.xp, jetons: v.jetons, niveau: v.level, rang: v.rank });
      }
      return { ok: true, gain: v.gain || 0, badge: badges[0] || null, quetes: v.quetes || [] };
    }
  });

  /* ======================================================================
     ÉTAPE 4.10 — Annonces (table announcements, lecture publique)

     Coût : 1 lecture par minute au plus, sur tout le site. Copie gardée sur
     le téléphone (cache « annonces », 60 s, resservie tout de suite) : les
     compteurs de la cloche et de « Plus » ne relancent rien d'une page à
     l'autre. La page Annonces relit la base 1 fois par minute (App.sonder).
     Lecture sans code secret : les visiteurs sans carte les voient aussi.
     « Lue » : sur le téléphone (App.annoncesLues), rien n'est envoyé.
     Niveau = type : danger → urgent (épinglée), alerte → important.
     ====================================================================== */
  const NIVEAU_ANNONCE = { danger: "urgent", alerte: "important" };

  Object.assign(App.serveurApi, {
    async annonces({ frais = false } = {}) {
      if (frais) App.cache.oublier("annonces");
      const depuis = new Date(Date.now() - 48 * 3600000).toISOString();
      const [lignes, types] = await Promise.all([
        App.lire("announcements",
          `select=id,titre,message,type,categorie,lien,lien_libelle,fin,created_at&created_at=gte.${depuis}&order=created_at.desc&limit=30`,
          { cache: "annonces", duree: 60000, garde: true, resservir: !frais }),
        App.data.get("typesAnnonces")
      ]);
      const lues = App.annoncesLues.get();
      const maintenant = Date.now();
      return lignes.map((a) => {
        const typeInfo = types[a.categorie] || types.pratique;
        const finMs = a.fin ? Date.parse(a.fin) : null;
        const expiree = !!finMs && maintenant >= finMs;
        return {
          id: a.id, niveau: NIVEAU_ANNONCE[a.type] || "info", type: a.categorie, typeInfo,
          titre: a.titre || typeInfo.nom, texte: a.message,
          lien: a.lien ? { href: a.lien, libelle: a.lien_libelle || "Voir" } : null,
          dateMs: Date.parse(a.created_at), finMs, expiree, publiee: true,
          // Une annonce expirée ne compte plus comme « non lue »
          lu: expiree || lues.has(a.id)
        };
      });
    }
  });

  /* ======================================================================
     ÉTAPE 6.3 bis — Collecte : fiche fan, coffre du scan
     (fiche_enregistrer, coffre_ouvrir ; le coffre arrive avec scan_qr et
     player_home)

     Coût : la fiche = 1 appel à la fin (téléphone compris), jamais pendant
     la saisie ; ouvrir le coffre = 1 appel, réessayé en cas de coupure (la
     base ne paie jamais deux fois : le second envoi trouve le coffre vide).
     Le coffre fermé est copié sur le téléphone : la page de scan le montre
     sans requête. Le sondage du soir (4.11) est fondu dans le coffre.
     ====================================================================== */
  const versFiche = (f) => f && {
    faits: f.faits, total: f.total, manquants: f.manquants || [], majeur: !!f.majeur,
    telephone: !!f.telephone, xpParReponse: f.xp_par_reponse, bonusComplet: f.xp_bonus_complet
  };

  Object.assign(App.serveurApi, {
    async ouvrirCoffre({ cle, valeur, duree = null }) {
      const s = App.session.get();
      const avant = { ...s };
      let r;
      try {
        r = await App.rpc("coffre_ouvrir", { p_secret_code: s.code, p_cle: cle, p_valeur: valeur, p_duree_ms: duree },
          { lecture: true });   // rejouable : voir plus haut
      } catch (e) {
        if (e.code === "JOUEUR_EXCLU") verrouiller();
        throw e;
      }
      if (r.perimee) { App.coffreLocal.ecrire(r.coffre); return { statut: "perimee", coffre: r.coffre }; }
      App.coffreLocal.effacer();
      App.session.set(versSession(r.player, s.code, s));
      App.cache.oublier(App.cleCarte());
      if (r.deja) return { statut: "deja", joueur: App.session.get() };
      return {
        statut: "ok",
        gains: { xp: r.xp_gagne, jetons: r.jetons_gagnes },
        detail: { coffre: r.xp_coffre, coffreJetons: r.jetons_coffre, reponse: r.xp_reponse, bonus: r.bonus_fiche },
        rang: { monte: r.player.rank !== avant.rang, apres: { nom: r.player.rank } },
        joueur: App.session.get(), avantJoueur: { xp: r.player.xp - r.xp_gagne }
      };
    },

    async coffreEnAttente() { return App.coffreLocal.lire(); },

    /* La carte (gardée 20 s) dit ce qui manque : souvent 0 appel */
    async ficheEtat() {
      const c = await this.carte();
      return c && c.fiche;
    },

    /* Jamais réessayé automatiquement (le joueur relance s'il le faut : un
       champ déjà rempli n'est ni réécrit ni repayé, le numéro ne rapporte
       qu'une fois). */
    async enregistrerFiche({ fiche = {}, telephone = null, domaf = false, partenaires = false }) {
      const s = App.session.get();
      const r = await App.rpc("fiche_enregistrer", {
        p_secret_code: s.code, p_fiche: fiche, p_telephone: telephone || null,
        p_domaf: !!domaf, p_partenaires: !!partenaires
      });
      App.session.set(versSession(r.player, s.code, s));
      App.cache.oublier(App.cleCarte());
      return {
        joueur: App.session.get(), xp: r.xp_gagne, bonus: r.bonus_fiche, jetons: r.jetons_gagnes,
        tourOffert: !!r.tour_offert, faits: r.faits, total: r.total, telephone: !!r.telephone
      };
    }
  });

  /* ======================================================================
     ÉTAPE 4.12 — Programme et mon programme

     programme_public : TOUT le programme en une requête (scènes, artistes,
     concerts, dédicaces, lieux), sans code secret. Gardé sur le téléphone
     5 min et resservi tout de suite : programme, mon programme (et le plan
     en 4.13) se le partagent. ~100 Ko, ~12 Ko compressés pour 200 concerts.
     programme_favoris : favoris + rappel de chacun, artistes vus, style
     préféré. Cache `favoris.<id>` gardé 5 min, CORRIGÉ par les réponses de
     programme_basculer_favori / programme_rappel (pas de relecture), oublié
     après un scan (un artiste peut devenir « vu »).
     Un favori = un CONCERT (créneau), pas un artiste.
     Sur le téléphone seulement (décision du 18/09) : l'interrupteur et le
     délai des rappels, les conflits acceptés (« je fais les deux »).
     ====================================================================== */
  App.cleFavoris = () => `favoris.${(App.session.get() || {}).id || "?"}`;
  const cleRappels = () => `vimasquest.rappels.${(App.session.get() || {}).id || "?"}`;
  const cleConflits = () => `vimasquest.conflits.${(App.session.get() || {}).id || "?"}`;
  const lireLocal = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) || defaut; } catch (e) { return defaut; } };
  const ecrireLocal = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* plein */ } };
  const lireProgramme = () => App.rpc("programme_public", {},
    { cache: "programme", duree: 300000, garde: true, resservir: true, lecture: true });
  const lireFavoris = () => appelJoueur("programme_favoris", {},
    { cache: App.cleFavoris(), duree: 300000, garde: true, resservir: true, lecture: true });

  /* Corrige la copie en cache des favoris après une écriture */
  function corrigerFavoris(changer) {
    const connu = App.cache.connu(App.cleFavoris(), { garde: true });
    if (!connu) return;
    changer(connu.valeur);
    App.cache.ecrire(App.cleFavoris(), connu.valeur, { garde: true });
  }

  function erreurProgramme(e) {
    if (e.code === "SESSION_INVALIDE") { App.session.clear(); location.replace("inscription.html"); }
    if (e.code === "JOUEUR_EXCLU") verrouiller();
    if (e.code !== "RESEAU") App.cache.oublier(App.cleFavoris());   // la page relira la base
    return { ok: false, erreur: e.code, raison: App.messageErreur(e) };
  }

  Object.assign(App.serveurApi, {
    /* joueur: false → sans les favoris (le plan n'en a pas besoin : pas de requête) */
    async programme({ joueur = true } = {}) {
      const [b, perso, jours, cfg, genres] = await Promise.all([
        lireProgramme(), joueur && App.session.isLoggedIn() ? lireFavoris() : null,
        App.data.get("jours"), App.data.get("programmeConfig"), libellesGenres()]);
      const maintenant = Date.now();
      const jourParDate = Object.fromEntries(jours.map((j) => [j.date, j]));
      const artistes = Object.fromEntries(b.artistes.map((a) => [a.id, a]));
      const lieux = Object.fromEntries(b.lieux.map((l) => [l.id, l]));
      const scenes = b.scenes.map((s) => ({ id: s.id, nom: s.nom, couleur: s.couleur }));
      const sceneParId = Object.fromEntries(scenes.map((s) => [s.id, s]));
      const favoris = new Map(((perso && perso.favoris) || []).map((f) => [f.creneau_id, f.rappel]));
      const vus = new Set((perso && perso.vus) || []);

      // Un concert hors des 4 jours du festival ou sans artiste annoncé n'est pas affiché
      const concerts = b.creneaux.filter((c) => artistes[c.artiste_id] && sceneParId[c.scene_id] && jourParDate[c.jour])
        .map((c) => {
          const a = artistes[c.artiste_id];
          const debutMs = Date.parse(c.debut), finMs = Date.parse(c.fin);
          return {
            id: c.id, artisteId: a.id, nom: a.nom, genre: nomGenre(a.genre, genres), bio: a.bio || "", photo_url: a.photo_url, tete: a.tete_affiche,
            scene: sceneParId[c.scene_id], jour: jourParDate[c.jour].id, debutMs, finMs,
            statut: App.statutConcert(debutMs, finMs, maintenant),
            favori: favoris.has(c.id), rappel: favoris.get(c.id) !== false, vu: vus.has(a.id)
          };
        });
      const dedicaces = b.dedicaces.filter((d) => artistes[d.artiste_id] && jourParDate[d.jour]).map((d) => ({
        artisteId: d.artiste_id, nom: artistes[d.artiste_id].nom, jour: jourParDate[d.jour].id,
        lieu: (lieux[d.lieu_id] || {}).nom || "Lieu à préciser", lieuId: d.lieu_id,
        debutMs: Date.parse(d.debut), finMs: Date.parse(d.fin)
      }));
      return {
        jours, scenes, concerts, dedicaces, config: cfg, connecte: !!perso,
        favoris: [...favoris.keys()], genre: perso ? perso.genre : null, lieux,
        maintenant, jourActuel: App.jourActuel(jours, maintenant), ceSoir: App.ceSoir(jours, maintenant)
      };
    },

    /* Bascule : jamais réessayé (un second envoi retirerait le concert) */
    async basculerFavori(id) {
      const s = App.session.get();
      if (!s || !s.code) return { ok: false, erreur: "session" };
      let v;
      try {
        v = await App.rpc("programme_basculer_favori", { p_secret_code: s.code, p_creneau_id: id });
      } catch (e) { return erreurProgramme(e); }
      corrigerFavoris((r) => {
        r.favoris = r.favoris.filter((f) => f.creneau_id !== id);
        if (v.favori) r.favoris.push({ creneau_id: id, rappel: true });
      });
      App.cache.oublier(App.cleCarte());   // le prochain concert de la carte suit les favoris
      const b = (App.cache.connu("programme", { garde: true }) || {}).valeur;
      const noms = b ? v.chevauchements.map((cid) => {
        const c = b.creneaux.find((x) => x.id === cid);
        const a = c && b.artistes.find((x) => x.id === c.artiste_id);
        return a ? a.nom : "un autre concert";
      }) : [];
      return { ok: true, favori: v.favori, conflits: noms };
    },

    async monProgramme() {
      if (!App.session.isLoggedIn()) return null;
      const [p, plan, genres] = await Promise.all([this.programme(), App.data.get("planConfig"), App.data.get("genres")]);
      if (!p.connecte) return null;
      const r = lireLocal(cleRappels(), {});
      const defaut = await App.data.get("rappelsParDefaut");
      const minutesMarche = (a, b) => (a === b ? 0 : App.minutesMarche(p.lieux[a], p.lieux[b], plan));
      return App.calculerMonProgramme(p, {
        rappels: { ...defaut, ...r },
        acceptes: lireLocal(cleConflits(), []),
        styles: App.stylesDuJoueur([p.genre], genres),
        minutesMarche
      });
    },

    async reglerRappels(maj) {
      const r = lireLocal(cleRappels(), {});
      if ("actif" in maj) r.actif = !!maj.actif;
      if ("avance" in maj) r.avance = Number(maj.avance);
      ecrireLocal(cleRappels(), r);
      return { ok: true };
    },

    async basculerRappel(id, actif) {
      const s = App.session.get();
      try {
        await App.rpc("programme_rappel", { p_secret_code: s.code, p_creneau_id: id, p_rappel: !!actif });
      } catch (e) { return erreurProgramme(e); }
      corrigerFavoris((r) => { const f = r.favoris.find((x) => x.creneau_id === id); if (f) f.rappel = !!actif; });
      return { ok: true };
    },

    /* « Garder X » retire les autres concerts du conflit, un appel chacun */
    async resoudreConflit({ cle, garder }) {
      const acceptes = lireLocal(cleConflits(), []);
      if (garder === "tous") { ecrireLocal(cleConflits(), [...new Set([...acceptes, cle])]); return { ok: true }; }
      if (garder === "revoir") { ecrireLocal(cleConflits(), acceptes.filter((c) => c !== cle)); return { ok: true }; }
      for (const id of cle.split("+").filter((x) => x !== garder)) {
        const r = await this.basculerFavori(id);
        if (!r.ok) return r;
        if (r.favori) return this.basculerFavori(id);   // il n'y était plus : on remet comme avant
      }
      return { ok: true };
    }
  });

  /* ======================================================================
     ÉTAPE 4.13 — Plan et infos

     Plan : les lieux viennent de la copie « programme » (programme_public),
     déjà gardée sur le téléphone par le programme : 0 requête en venant du
     programme. Stands scannés : la collection (player_collection, copie de
     2 min partagée avec la page Collection) ; visiteurs : rien. Alerte abris :
     la copie « annonces ». Le fond (Stade de Bonamoussadi) est un fichier du
     site (assets/js/plan-fond.js, OpenStreetMap), rien ne vient de la base.
     Un lieu sans position (x / y vides) n'est pas dessiné : il reste dans la
     liste.
     Infos : tout est du contenu du site, sauf regles_jeu() (barème des XP par
     type de QR, coût et plafond de la roue), gardée 10 min sur le téléphone.
     Pas de formulaire de contact ni d'effacement côté joueur (décision du
     18/09) : e-mail + Point info, et « Déconnecter ce téléphone ».
     ====================================================================== */
  Object.assign(App.serveurApi, {
    async plan() {
      const connecte = App.session.isLoggedIn();
      const [p, categories, cfg, annonces, collection] = await Promise.all([
        this.programme({ joueur: false }), App.data.get("categoriesLieux"), App.data.get("planConfig"),
        this.annonces().catch(() => []),
        connecte ? this.collection().catch(() => null) : null
      ]);
      const vus = new Set(((collection && collection.stands) || []).filter((x) => x.obtenu).map((x) => x.id));
      const couleurs = Object.fromEntries(p.scenes.map((x) => [x.id, x.couleur]));
      const lieux = Object.values(p.lieux).filter((l) => categories[l.categorie]).map((l) => {
        const x = {
          id: l.id, cat: l.categorie, nom: l.nom, desc: l.description || "", horaires: l.horaires || "",
          x: l.x, y: l.y, pmr: l.pmr, place: l.x != null && l.y != null,
          // null : pas de QR à scanner ici ; false / true : scanné ou non (joueur)
          tamponne: l.qr_code_id ? vus.has(l.id) : null,
          dedicaces: p.dedicaces.some((d) => d.lieuId === l.id)
        };
        if (l.categorie === "scene") {
          const concerts = p.concerts.filter((a) => a.scene.id === l.id).sort((a, b) => a.debutMs - b.debutMs);
          x.enCours = concerts.find((a) => a.statut === "en-cours") || null;
          x.prochain = concerts.find((a) => a.statut === "a-venir") || null;
          x.couleurScene = couleurs[l.id] || "nuit";
        }
        return x;
      });
      const alerte = annonces.find((a) => a.niveau === "urgent" && !a.expiree && /orage|abri/i.test(`${a.titre} ${a.texte}`)) || null;
      return { lieux, categories, config: cfg, connecte, maintenant: p.maintenant, alerteAbris: alerte, jours: p.jours };
    },

    async infos() {
      const [r, infos, jours, rangs, festival, typesQR, blind] = await Promise.all([
        App.rpc("regles_jeu", {}, { cache: "regles", duree: 600000, garde: true, resservir: true, lecture: true }),
        ...["infos", "jours", "rangs", "festival", "typesQR", "blindTest"].map(App.data.get)]);
      const maintenant = Date.now();
      const horaires = infos.horaires.map((h) => {
        const jour = jours.find((j) => j.id === h.jour);
        const ouverture = App.dateFestival(jour.date, h.portes).getTime();
        const fin = App.dateFestival(jour.date, h.fin).getTime() + (Number(h.fin.slice(0, 2)) < 8 ? 24 * 3600000 : 0);
        return { ...h, jourInfo: jour, ouverture, fin, ouvert: maintenant >= ouverture && maintenant < fin };
      });
      const bareme = r.bareme.filter((b) => typesQR[b.type])
        .map((b) => ({ type: b.type, nom: typesQR[b.type].nom, min: b.min, max: b.max }));
      return {
        ...infos, festival, horaires, rangs, bareme, blind, maintenant,
        coutTirage: r.roue ? r.roue.cout : null, maxTirages: r.roue ? r.roue.max_jour : null
      };
    },

    async deconnecter() {
      App.cache.oublier(App.cleCarte());
      App.cache.oublier(App.cleCollection());
      App.cache.oublier(App.cleFavoris());
      App.session.clear();
      return { ok: true };
    }
  });

  /* ======================================================================
     ÉTAPE 4.14 — Blind test côté joueur

     La régie mène la manche (une question après l'autre) ; le téléphone n'a
     pas le temps réel : il lit quiz_state (un appel = tout son écran). Le
     rythme est décidé par la page (pages/blind-test.js) : rien pendant une
     question ouverte (le chrono du serveur suffit), une lecture à la
     fermeture, puis ~3 s en attendant la suivante, 1 / min hors manche.
     Les réponses : quiz_answer, renvoyée tant que le réseau manque (une
     réponse ne compte qu'une fois : un doublon revient DEJA_REPONDU).
     Ces deux fonctions n'existent qu'en mode serveur (la démo garde son
     horloge locale : blindTestDirect, blindRepondre…).
     ====================================================================== */
  const versBlind = (v, lu) => {
    if (!v.session) return { phase: "attente", lu };
    const S = v.session, q = v.question, moi = v.moi || {};
    const phase = S.status === "terminee" ? "fin"
      : !q || S.current_question < 1 ? "salle"
      : q.closed ? "revelation" : "question";
    const duree = q ? q.duration_seconds * 1000 : 0;
    const ecoule = q ? q.elapsed_ms || 0 : 0;
    return {
      phase, lu, manche: S.id, titre: S.title, total: S.total_questions, index: S.current_question - 1,
      duree,
      // Heures locales : fin du chrono affiché, puis fermeture par le serveur (+2 s)
      fin: lu + Math.max(0, duree - ecoule),
      fermeture: lu + Math.max(0, duree + 2000 - ecoule),
      question: q && {
        id: q.id, numero: S.current_question, categorie: q.categorie || "Blind test",
        question: q.question, choix: q.choices
      },
      maReponse: v.my_answer && {
        choix: v.my_answer.answer_index, juste: v.my_answer.is_correct,
        points: v.my_answer.points, temps: v.my_answer.response_ms
      },
      revelation: q && q.closed && q.correct_index != null
        ? { bonne: q.correct_index, reponse: q.reponse || "", anecdote: q.anecdote || "" } : null,
      moi: { total: moi.points || 0, bonnes: moi.bonnes || 0, serie: moi.serie || 0,
             rang: moi.rang || null, participants: moi.participants || 0 },
      tete: (v.tete || []).map((j, i) => ({ rang: i + 1, pseudo: j.pseudo, avatar: j.archetype, points: j.points })),
      boss: v.raid && v.raid.boss_name ? {
        nom: v.raid.boss_name, pvMax: v.raid.hp_max, degats: v.raid.damage,
        restants: v.raid.hp_left, vaincu: v.raid.defeated
      } : null,
      recap: v.recap || null
    };
  };

  Object.assign(App.serveurApi, {
    /* null : plus de session sur ce téléphone */
    async blindEtat() {
      const v = await appelJoueur("quiz_state", {}, { lecture: true });
      return v ? versBlind(v, Date.now()) : null;
    },

    /* { ok } ou { ok: false, erreur: "deja" | "tard" | "pass" | "reseau" | "session" | "autre", message } */
    async blindEnvoyer({ questionId, choix }) {
      const s = App.session.get();
      if (!s || !s.code) return { ok: false, erreur: "session" };
      try {
        await App.rpc("quiz_answer", { p_secret_code: s.code, p_question_id: questionId, p_answer_index: choix });
        return { ok: true };
      } catch (e) {
        const erreur = { DEJA_REPONDU: "deja", TROP_TARD: "tard", QUESTION_FERMEE: "tard", QUIZ_INACTIF: "tard",
          PASS_REQUIS: "pass", RESEAU: "reseau", SESSION_INVALIDE: "session" }[e.code] || "autre";
        if (erreur === "deja") return { ok: true };
        return { ok: false, erreur, message: App.messageErreur(e) };
      }
    }
  });

  /* ======================================================================
     ÉTAPE 4.15 — Accueil (vitrine)
     Line-up : la copie « programme » (programme_public, gardée, partagée avec
     le programme et le plan : 0 requête si déjà lue). Lots : roulette_prizes
     (lecture publique), seulement les objets à retirer au stand, gardés 5 min.
     ====================================================================== */
  const RARETES = ["legendaire", "epique", "rare", "commun"];
  Object.assign(App.serveurApi, {
    async vitrine() {
      const [p, lots] = await Promise.all([
        this.programme({ joueur: false }),
        App.lire("roulette_prizes", "select=name,rarete,stock&active=eq.true&kind=eq.objet",
          { cache: "lots", duree: 300000, garde: true, resservir: true }).catch(() => [])
      ]);
      return {
        concerts: p.concerts.map((c) => ({
          jour: c.jour, ordre: c.debutMs, heure: App.heureFestival(new Date(c.debutMs)), nom: c.nom,
          genre: c.genre, tete: !!c.tete, scene: c.scene
        })),
        lots: lots.map((l) => ({ nom: l.name, rarete: l.rarete, stock: l.stock }))
          .sort((a, b) => RARETES.indexOf(a.rarete) - RARETES.indexOf(b.rarete) || a.nom.localeCompare(b.nom))
      };
    }
  });

  /* ======================================================================
     ÉTAPE 5.1 — Mur de l'écran géant (mur_direct)
     Tout le mur en UN appel : tournoi du jour, compteurs, 8 derniers exploits,
     annonces en cours, phase du jeu. Pas de cache : la page ne relit qu'au
     signal du temps réel (au plus 1 fois / 5 s) et toutes les 60 s par
     sécurité. Lecture seule, sans session (aucun code secret sur l'écran).
     ====================================================================== */
  Object.assign(App.serveurApi, {
    async mur() {
      const [m, types] = await Promise.all([App.rpc("mur_direct", {}, { lecture: true }), App.data.get("typesAnnonces")]);
      const roi = m.roi_veille && m.roi_veille.pseudo ? { pseudo: m.roi_veille.pseudo, points: m.roi_veille.points } : null;
      return {
        phase: m.phase, top: m.top, roi,
        joueurs: m.joueurs, joueursJour: m.joueurs_jour, scansJour: m.scans_jour,
        exploits: m.exploits.map((e) => ({ ...e, dateMs: Date.parse(e.at) })),
        annonces: m.annonces.map((a) => {
          const typeInfo = types[a.categorie] || types.pratique;
          return {
            id: a.id, niveau: NIVEAU_ANNONCE[a.type] || "info", titre: a.titre || typeInfo.nom, texte: a.message,
            dateMs: Date.parse(a.created_at), finMs: a.fin ? Date.parse(a.fin) : null
          };
        })
      };
    }
  });

  /* ======================================================================
     ÉTAPE 5.2 — Plateau du blind test sur l'écran géant (quiz_board)
     Tout le plateau en UN appel, sans session. La page ne fait que le
     remettre à l'heure localement (chrono) : elle relit au signal du temps
     réel (game_state : question lancée, manche lancée ; events raid / quiz :
     manche close), à la fin du chrono, toutes les 4 s pendant une question
     ouverte (compteur de réponses) et toutes les 60 s sinon.
     Rien ne sort avant la fin du chrono (+2 s) : c'est la base qui tranche.
     ====================================================================== */
  const adresse = (u) => (u ? new URL(u, App.racine).href : null);
  const pourcents = (liste) => {
    const total = (liste || []).reduce((a, n) => a + n, 0);
    return (liste || []).map((n) => (total ? Math.round((n / total) * 100) : 0));
  };
  /* Ex æquo : même place */
  const classer = (liste) => {
    let rang = 0, precedent = null;
    return (liste || []).map((j, i) => {
      if (j.points !== precedent) { rang = i + 1; precedent = j.points; }
      return { pseudo: j.pseudo, avatar: j.avatar, points: j.points, rang };
    });
  };

  Object.assign(App.serveurApi, {
    async blindPlateau() {
      const b = await App.rpc("quiz_board", {}, { lecture: true });
      const lu = Date.now();
      if (!b.session) return { lu, session: null };
      const s = b.session, q = b.question, r = b.raid;
      return {
        lu,
        session: { id: s.id, titre: s.title, statut: s.status, index: s.current_question - 1, total: s.total_questions, participants: s.participants },
        boss: r ? { nom: r.boss_name || "Le boss", photo: adresse(r.boss_image), pvMax: r.hp_max, pvRestants: r.hp_left, vaincu: r.defeated } : null,
        question: q ? {
          numero: q.numero, categorie: q.categorie || "", question: q.question, choix: q.choices,
          duree: q.duration_seconds * 1000, ecoule: q.elapsed_ms || 0, fermee: q.closed,
          audio: adresse(q.audio_url), audioDebut: q.audio_debut || 0, recues: q.answers_count,
          revelation: q.closed ? {
            bonne: q.correct_index, stats: pourcents(q.distribution),
            reponse: q.reponse || q.choices[q.correct_index] || "", anecdote: q.anecdote || "",
            pochette: adresse(q.pochette_url),
            rapides: (q.rapides || []).map((x) => ({ pseudo: x.pseudo, avatar: x.avatar, temps: x.ms / 1000 }))
          } : null
        } : null,
        classement: b.top ? classer(b.top) : null
      };
    }
  });

  const apiDemo = { ...App.api };
  Object.keys(apiDemo).forEach((nom) => {
    App.api[nom] = function (...args) {
      const f = !App.mock && App.serveurApi[nom];
      return f ? f.apply(App.serveurApi, args) : apiDemo[nom].apply(apiDemo, args);
    };
  });
  App.apiDemo = apiDemo;
})();
