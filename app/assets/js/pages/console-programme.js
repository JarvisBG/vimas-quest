/* ==========================================================================
   Console — écran Programme et lieux (étape 6.4), style Game Master d'Otaku
   Lecture : console_programme (lieux et scènes, artistes, concerts,
   dédicaces, styles de la fiche fan) en UN appel au chargement, puis
   seulement après une écriture. Onglets, filtres, grille : sur la copie
   chargée, sans requête.
   Écritures (bouton verrouillé, jamais réessayées) : console_lieu_enregistrer,
   console_artiste_enregistrer, console_concert_enregistrer,
   console_dedicace_enregistrer (tous les champs d'un formulaire),
   console_programme_activer (lieu, artiste), console_programme_supprimer
   (refusée dès qu'il y a une trace : scan, cœur).
   Heures : saisies et affichées à l'heure de Douala (UTC+1 toute l'année, pas
   d'heure d'été au Cameroun) ; une journée de jeu va de 6 h à 6 h.
   Plan : le fond du site (plan-fond.js, 1000 × 700 unités), rien de la base.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const $$ = App.$$;
  const esc = App.esc;

  Object.assign(C.messages, {
    NOM_MANQUANT: "Donne un nom (80 caractères au plus).",
    ID_INVALIDE: "Identifiant : lettres minuscules sans accent, chiffres et tirets (« scene-soleil »).",
    ID_PRIS: "Cet identifiant est déjà pris : choisis-en un autre.",
    CATEGORIE_INVALIDE: "Choisis une catégorie.",
    CATEGORIE_SCENE_FIGEE: "Une scène reste une scène (ses concerts en dépendent), et un lieu ne devient pas une scène : crée un nouveau lieu.",
    CATEGORIE_QR_RELIE: "Ce lieu a son QR : délie-le d'abord dans l'écran « QR et reliques » pour changer de catégorie.",
    CATEGORIE_COEURS: "Des joueurs ont voté pour ce lieu : sa catégorie ne change plus.",
    POSITION_INVALIDE: "Place invalide sur le plan : clique à nouveau sur le plan.",
    ORDRE_INVALIDE: "L'ordre va de -999 à 999.",
    COULEUR_INVALIDE: "Choisis une couleur de scène.",
    DESCRIPTION_TROP_LONGUE: "La description fait 400 caractères au plus.",
    HORAIRES_TROP_LONGS: "Les horaires font 80 caractères au plus.",
    GENRE_INVALIDE: "Ce style n'est pas dans la liste : recharge la page.",
    BIO_TROP_LONGUE: "La présentation fait 600 caractères au plus.",
    PHOTO_INVALIDE: "Photo : un fichier « assets/photos/nom.webp » (ou .jpg, .png) ou une adresse https.",
    LIEU_INCONNU: "Ce lieu n'existe plus : recharge la page.",
    ARTISTE_INCONNU: "Choisis un artiste (ou recharge la page s'il a été supprimé).",
    SCENE_INCONNUE: "Choisis une scène.",
    CONCERT_INCONNU: "Ce concert n'existe plus : recharge la page.",
    DEDICACE_INCONNUE: "Cette séance n'existe plus : recharge la page.",
    HEURE_INVALIDE: "Indique l'heure de début et de fin.",
    DUREE_INVALIDE: "La fin doit venir après le début, 12 heures au plus.",
    CHEVAUCHEMENT: "Un autre concert occupe déjà la scène à ce moment-là.",
    CONCERT_DEJA_SCANNE: "Des joueurs ont scanné la scène pendant ce concert : il garde son artiste et sa scène et ne se supprime plus. Tu peux encore changer l'horaire.",
    DEDICACE_DEJA_SCANNEE: "Des joueurs ont scanné le QR de cette séance : elle garde son artiste et ne se supprime plus.",
    SCENE_A_DES_CONCERTS: "Cette scène a des concerts : déplace-les ou supprime-les d'abord, ou éteins la scène.",
    LIEU_DEJA_SCANNE: "Des joueurs ont scanné le QR de ce lieu (il est dans leur collection) : éteins-le plutôt.",
    LIEU_A_DES_COEURS: "Des joueurs ont voté pour ce lieu : éteins-le plutôt.",
    ARTISTE_DEJA_VU: "Des joueurs ont vu cet artiste (concert ou dédicace scanné) : éteins-le plutôt.",
    ARTISTE_A_DES_COEURS: "Des joueurs ont voté pour cet artiste : éteins-le plutôt.",
    QUOI_INVALIDE: "Action inconnue.",
    ETAT_INVALIDE: "État inconnu."
  });

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;

  /* ---------- Repères (= mock.js : jours, categoriesLieux ; couleurs de style.css) ---------- */
  const JOURS = [
    { date: "2026-12-26", court: "Sam. 26", long: "Samedi 26 décembre" },
    { date: "2026-12-27", court: "Dim. 27", long: "Dimanche 27 décembre" }
  ];
  const CATEGORIES = {
    scene: { nom: "Scène", icone: "micro" },
    stand: { nom: "Stand", icone: "billet" },
    food: { nom: "Food-truck", icone: "couverts" },
    eau: { nom: "Point d'eau", icone: "goutte" },
    toilettes: { nom: "Toilettes", icone: "wc" },
    secours: { nom: "Secours", icone: "croix" },
    abri: { nom: "Abri", icone: "tente" },
    service: { nom: "Service", icone: "info" },
    entree: { nom: "Entrée", icone: "entree" }
  };
  const AIDE_CATEGORIE = {
    scene: "Ses concerts se posent dans la grille. Son QR (écran QR) reconnaît le concert en cours.",
    stand: "Tampon du stand (collection, coups de cœur) une fois son QR relié.",
    food: "Tampon du food-truck (collection, coups de cœur) une fois son QR relié.",
    eau: "Point pratique du plan.", toilettes: "Point pratique du plan.", secours: "Point pratique du plan.",
    abri: "Montré aux joueurs en cas d'alerte météo.", service: "Point info, consigne, recharge…", entree: "Porte d'entrée du site."
  };
  const COULEURS = {
    sodium: { nom: "Sodium (jaune)", css: "#FFD23F" },
    rose: { nom: "Rose", css: "#FF5FA2" },
    vert: { nom: "Vert", css: "#2BB673" },
    bleu: { nom: "Bleu", css: "#1F3FD1" },
    rouge: { nom: "Rouge", css: "#E0413A" },
    nuit: { nom: "Nuit (bleu très foncé)", css: "#0A1440" },
    papier: { nom: "Papier (blanc)", css: "#FAFAF7" }
  };
  const couleurLieu = (l) => l.categorie === "scene" ? (COULEURS[l.couleur] || COULEURS.nuit).css : "var(--violet)";

  /* ---------- Heures de Douala (UTC+1 fixe) ---------- */
  const HEURE = 3600e3;
  const enDouala = (iso) => new Date(new Date(iso).getTime() + HEURE);
  const hhmm = (iso) => enDouala(iso).toISOString().slice(11, 16);
  const heure = (iso) => hhmm(iso).replace(":", " h ");
  const jourDe = (iso) => new Date(new Date(iso).getTime() + HEURE - 6 * HEURE).toISOString().slice(0, 10);
  const plusJours = (date, k) => new Date(Date.parse(`${date}T12:00:00Z`) + k * 24 * HEURE).toISOString().slice(0, 10);
  /* « 01:30 » le 27 → la nuit du 27 au 28 */
  const versIso = (jour, h) => `${Number(h.slice(0, 2)) < 6 ? plusJours(jour, 1) : jour}T${h}:00+01:00`;
  const debutJournee = (jour) => Date.parse(`${jour}T06:00:00+01:00`);
  const nomJour = (date, long = false) => {
    const j = JOURS.find((x) => x.date === date);
    if (j) return long ? j.long : j.court;
    return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", long
      ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" });
  };
  const plage = (x) => `${heure(x.debut)} – ${heure(x.fin)}`;

  /* Identifiant proposé à partir du nom : « Scène Soleil » → « scene-soleil » */
  const versId = (texte, max) => String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");

  const srcPhoto = (url) => (/^https:\/\//.test(url) ? url : App.racine + url);

  /* ---------- État ---------- */
  let donnees = null;
  let onglet = "concerts";
  let jourCourant = null;
  const index = { lieux: {}, artistes: {} };

  async function charger() {
    try {
      donnees = await C.appel("console_programme");
      index.lieux = Object.fromEntries(donnees.lieux.map((l) => [l.id, l]));
      index.artistes = Object.fromEntries(donnees.artistes.map((a) => [a.id, a]));
      rendre();
    } catch (e) {
      $("[data-resume]").textContent = "";
      const msg = `<p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`;
      $("[data-grille]").innerHTML = msg;
      ["artistes", "lieux", "dedicaces"].forEach((k) => {
        $(`[data-lignes-${k}]`).innerHTML = `<tr><td colspan="5">${msg}</td></tr>`;
      });
    }
  }

  const scenes = () => donnees.lieux.filter((l) => l.categorie === "scene");
  const concertsDe = (artisteId) => donnees.concerts.filter((c) => c.artiste_id === artisteId);
  const seancesDe = (artisteId) => donnees.dedicaces.filter((d) => d.artiste_id === artisteId);
  const artisteVu = (id) => concertsDe(id).some((c) => c.scanne) || seancesDe(id).some((d) => d.scanne);
  const genreNom = (v) => ((donnees.genres || []).find((g) => g.valeur === v) || {}).libelle || v;

  function rendre() {
    const sc = scenes();
    const annonces = donnees.artistes.filter((a) => a.actif).length;
    const nonPlaces = donnees.lieux.filter((l) => l.actif && l.x == null).length;
    $("[data-resume]").textContent = [
      `${n(sc.length)} scène${sc.length > 1 ? "s" : ""}`,
      `${n(donnees.artistes.length)} artiste${donnees.artistes.length > 1 ? "s" : ""} (${n(annonces)} annoncé${annonces > 1 ? "s" : ""})`,
      `${n(donnees.concerts.length)} concert${donnees.concerts.length > 1 ? "s" : ""}`,
      `${n(donnees.dedicaces.length)} séance${donnees.dedicaces.length > 1 ? "s" : ""} de dédicaces`,
      nonPlaces ? `${n(nonPlaces)} lieu${nonPlaces > 1 ? "x" : ""} pas sur le plan` : ""
    ].filter(Boolean).join(" · ");
    rendreConcerts();
    rendreArtistes();
    rendreLieux();
    rendreDedicaces();
  }

  /* ==========================================================================
     Onglets
     ========================================================================== */
  const NOUVEAU = { concerts: "Nouveau concert", artistes: "Nouvel artiste", lieux: "Nouveau lieu", dedicaces: "Nouvelle séance" };
  function montrer(nom, { focus = false } = {}) {
    if (!NOUVEAU[nom]) nom = "concerts";
    onglet = nom;
    $$("[data-onglet]").forEach((b) => {
      const oui = b.dataset.onglet === nom;
      b.setAttribute("aria-selected", String(oui));
      b.tabIndex = oui ? 0 : -1;
      if (oui && focus) b.focus();
    });
    $$("[data-panneau]").forEach((p) => { p.hidden = p.dataset.panneau !== nom; });
    $("[data-nouveau]").textContent = NOUVEAU[nom];
    try { history.replaceState(null, "", `#${nom}`); } catch (e) { /* file:// */ }
  }
  const barre = $("[data-onglets]");
  barre.addEventListener("click", (e) => {
    const b = e.target.closest("[data-onglet]");
    if (b) montrer(b.dataset.onglet);
  });
  barre.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const noms = Object.keys(NOUVEAU);
    let i = noms.indexOf(onglet);
    i = e.key === "Home" ? 0 : e.key === "End" ? noms.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + noms.length) % noms.length;
    e.preventDefault();
    montrer(noms[i], { focus: true });
  });
  montrer(location.hash.slice(1) || "concerts");

  $("[data-nouveau]").addEventListener("click", () => {
    if (!donnees) return;
    if (onglet === "concerts") ouvrirConcert(null, { jour: jourCourant });
    else if (onglet === "artistes") ouvrirArtiste(null);
    else if (onglet === "lieux") ouvrirLieu(null);
    else ouvrirDedicace(null);
  });

  /* ==========================================================================
     Concerts : grille jour × scène
     ========================================================================== */
  const PX_HEURE = 64;

  function joursAffiches() {
    const dates = new Set(JOURS.map((j) => j.date));
    donnees.concerts.forEach((c) => dates.add(jourDe(c.debut)));
    return [...dates].sort();
  }

  function rendreConcerts() {
    const jours = joursAffiches();
    if (!jourCourant || !jours.includes(jourCourant)) {
      const auj = jourDe(new Date().toISOString());
      jourCourant = jours.includes(auj) ? auj
        : (jours.find((d) => donnees.concerts.some((c) => jourDe(c.debut) === d)) || JOURS[0].date);
    }
    $("[data-jours]").innerHTML = jours.map((d) => {
      const k = donnees.concerts.filter((c) => jourDe(c.debut) === d).length;
      const hors = !JOURS.some((j) => j.date === d);
      return `<button type="button" class="cjour" data-jour="${d}" aria-pressed="${d === jourCourant}">
        <strong>${esc(nomJour(d))}</strong><small>${k ? `${n(k)} concert${k > 1 ? "s" : ""}` : "vide"}${hors ? " · hors festival" : ""}</small></button>`;
    }).join("");

    const zone = $("[data-grille]");
    const sc = scenes().slice().sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));
    if (!sc.length) {
      zone.innerHTML = `<p class="cvide">Aucune scène pour l'instant. Crée-les dans l'onglet « Lieux et scènes » (catégorie Scène), puis reviens poser les concerts.</p>`;
      return;
    }
    const t0 = debutJournee(jourCourant);
    const duJour = donnees.concerts.filter((c) => jourDe(c.debut) === jourCourant);
    /* Axe (en heures depuis 6 h) : les concerts du jour, une heure de marge de
       chaque côté, 6 heures au moins ; journée vide : 10 h → 22 h (festival de jour) */
    let de = 4, a = 16;
    if (duJour.length) {
      de = Math.min(...duJour.map((c) => Math.floor((Date.parse(c.debut) - t0) / HEURE))) - 1;
      a = Math.max(...duJour.map((c) => Math.ceil((Date.parse(c.fin) - t0) / HEURE))) + 1;
      if (a - de < 6) a = de + 6;
    }
    de = Math.max(0, de);
    a = Math.min(30, a);
    const hauteur = (a - de) * PX_HEURE;

    const heures = [];
    for (let h = de; h <= a; h++) {
      heures.push(`<span class="cgrille__heure" style="top:${(h - de) * PX_HEURE}px">${(6 + h) % 24} h</span>`);
    }
    const colonnes = sc.map((s) => {
      const blocs = duJour.filter((c) => c.scene_id === s.id).map((c) => {
        const art = index.artistes[c.artiste_id] || { nom: c.artiste_id, actif: false };
        const haut = (Date.parse(c.debut) - t0) / HEURE - de;
        const duree = (Date.parse(c.fin) - Date.parse(c.debut)) / HEURE;
        const infos = [
          c.scanne ? `<span title="Déjà scanné : artiste et scène figés">${App.icon("cadenas")}</span>` : "",
          c.favoris ? `<span title="Dans le programme de ${n(c.favoris)} joueur(s)">${App.icon("etoile")} ${n(c.favoris)}</span>` : "",
          art.actif ? "" : `<span class="cconcert__cache">pas annoncé</span>`
        ].join("");
        return `<button type="button" class="cconcert${art.actif ? "" : " is-cache"}" data-concert="${esc(c.id)}"
            style="top:${haut * PX_HEURE}px;height:${Math.max(duree * PX_HEURE, 22)}px;--scene:${couleurLieu(s)}">
          <strong>${esc(art.nom)}</strong><small>${esc(plage(c))}</small>${infos ? `<span class="cconcert__infos">${infos}</span>` : ""}
        </button>`;
      }).join("");
      return `<div class="cgrille__col${s.actif ? "" : " is-eteint"}">
        <div class="cgrille__tete"><span class="cpastille" style="--scene:${couleurLieu(s)}"></span><span>${esc(s.nom)}</span>${s.actif ? "" : "<small>éteinte</small>"}</div>
        <div class="cgrille__piste" data-piste="${esc(s.id)}" style="height:${hauteur}px;--px:${PX_HEURE}px" title="Clique pour ajouter un concert sur ${esc(s.nom)}">${blocs}</div>
      </div>`;
    }).join("");
    zone.innerHTML = `<div class="cgrille" style="--nb:${sc.length}" data-de="${de}">
      <div class="cgrille__axe"><div class="cgrille__tete"></div><div class="cgrille__heures" style="height:${hauteur}px">${heures.join("")}</div></div>
      ${colonnes}</div>`;
  }

  $("[data-jours]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-jour]");
    if (!b) return;
    jourCourant = b.dataset.jour;
    rendreConcerts();
  });

  $("[data-grille]").addEventListener("click", (e) => {
    const bloc = e.target.closest("[data-concert]");
    if (bloc) { ouvrirConcert(donnees.concerts.find((c) => c.id === bloc.dataset.concert)); return; }
    const piste = e.target.closest("[data-piste]");
    if (!piste) return;
    /* Case vide : l'heure cliquée, au quart d'heure, pour une heure */
    const de = Number($(".cgrille", $("[data-grille]")).dataset.de);
    const y = e.clientY - piste.getBoundingClientRect().top;
    const minutes = Math.round((de * 60 + (y / PX_HEURE) * 60) / 15) * 15;
    const debut = new Date(debutJournee(jourCourant) + minutes * 60000).toISOString();
    const fin = new Date(Date.parse(debut) + HEURE).toISOString();
    ouvrirConcert(null, { scene_id: piste.dataset.piste, jour: jourCourant, debut, fin });
  });

  /* ==========================================================================
     Artistes
     ========================================================================== */
  const filtresA = $("[data-filtres-artistes]");
  let genresRemplis = false;

  function rendreArtistes() {
    if (!genresRemplis) {
      $("#fa-genre").insertAdjacentHTML("beforeend", (donnees.genres || [])
        .map((g) => `<option value="${esc(g.valeur)}">${esc(g.libelle)}</option>`).join(""));
      genresRemplis = true;
    }
    const f = new FormData(filtresA);
    const texte = String(f.get("texte") || "").trim().toLowerCase();
    const genre = f.get("genre");
    const etat = f.get("etat");
    const liste = donnees.artistes.filter((a) =>
      (!texte || a.nom.toLowerCase().includes(texte) || a.id.includes(texte)) &&
      (!genre || a.genre === genre) &&
      (!etat || (etat === "annonces" && a.actif) || (etat === "caches" && !a.actif) ||
        (etat === "sans-concert" && !concertsDe(a.id).length) || (etat === "sans-photo" && !a.photo_url)));
    const corps = $("[data-lignes-artistes]");
    if (!liste.length) {
      corps.innerHTML = `<tr><td colspan="5" class="cvide">${donnees.artistes.length ? "Aucun artiste ne correspond." : "Aucun artiste. « Nouvel artiste » pour commencer."}</td></tr>`;
      return;
    }
    corps.innerHTML = liste.map((a) => {
      const cs = concertsDe(a.id);
      const ds = seancesDe(a.id);
      const puces = [
        a.genre ? `<span class="cpuce">${esc(genreNom(a.genre))}</span>` : "",
        a.tete_affiche ? `<span class="cpuce cpuce--legendaire">${App.icon("etoile")} Tête d'affiche</span>` : "",
        a.photo_url ? "" : `<span class="cpuce cpuce--alerte">Sans photo</span>`
      ].join("");
      const prog = cs.map((c) => `<span class="cpuce">${App.icon("micro")} ${esc(nomJour(jourDe(c.debut)))} · ${esc(heure(c.debut))} · ${esc((index.lieux[c.scene_id] || {}).nom || c.scene_id)}</span>`)
        .concat(ds.length ? [`<span class="cpuce">${App.icon("coeur")} ${n(ds.length)} dédicace${ds.length > 1 ? "s" : ""}</span>`] : []);
      return `<tr data-id="${esc(a.id)}" class="${a.actif ? "" : "is-eteint"}">
        <td><div class="cavec-medaille">${vignette(a)}<div class="cligne"><strong>${esc(a.nom)}</strong><span class="ctable__code">${esc(a.id)}</span>
          ${puces ? `<div class="cpuces">${puces}</div>` : ""}</div></div></td>
        <td class="ctable__large">${prog.length ? `<div class="cpuces">${prog.join("")}</div>` : '<span class="cpuce cpuce--alerte">Aucun concert</span>'}</td>
        <td class="ctable__nb">${n(a.coeurs)}</td>
        <td class="ctable__bascule">${C.interrupteur(a.actif, `data-activer-artiste="${esc(a.id)}"`, `« ${a.nom} » annoncé`)}</td>
        <td class="ctable__actions"><button class="cbtn" type="button">Modifier</button></td>
      </tr>`;
    }).join("");
  }

  function vignette(a) {
    if (!a.photo_url) return `<span class="cphoto cphoto--petit">${esc(a.nom.slice(0, 1).toUpperCase())}</span>`;
    return `<span class="cphoto cphoto--petit"><img src="${esc(srcPhoto(a.photo_url))}" alt="" loading="lazy" width="40" height="40"></span>`;
  }

  /* Photo introuvable (fichier pas encore mis en ligne) : l'initiale, avec l'alerte */
  document.addEventListener("error", (e) => {
    const img = e.target;
    const cadre = img && img.closest && img.closest(".cphoto--petit");
    if (!cadre) return;
    cadre.textContent = "!";
    cadre.title = "Photo introuvable";
    cadre.classList.add("is-absente");
  }, true);

  filtresA.addEventListener("input", () => donnees && rendreArtistes());
  filtresA.addEventListener("submit", (e) => e.preventDefault());
  $("[data-lignes-artistes]").addEventListener("click", (e) => {
    if (e.target.closest(".cinter")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrirArtiste(index.artistes[tr.dataset.id]);
  });

  /* ==========================================================================
     Lieux
     ========================================================================== */
  const filtresL = $("[data-filtres-lieux]");
  $("#fl-cat").insertAdjacentHTML("beforeend", Object.entries(CATEGORIES)
    .map(([k, c]) => `<option value="${k}">${esc(c.nom)}</option>`).join(""));

  /* Le fond du plan + les lieux placés. choisi : le lieu en cours d'édition */
  function planSvg(lieux, { choisi = null, xy = null } = {}) {
    const fond = App.planFond ? App.planFond.svg : '<rect width="1000" height="700" fill="#555"/>';
    const points = lieux.filter((l) => l.x != null && (!choisi || l.id !== choisi.id)).map((l) =>
      `<g class="cplan__point${choisi ? " is-autre" : ""}${l.actif ? "" : " is-eteint"}" data-lieu="${esc(l.id)}" transform="translate(${l.x} ${l.y})">
        <title>${esc(l.nom)} (${esc(CATEGORIES[l.categorie].nom)})</title>
        <circle r="${l.categorie === "scene" ? 15 : 10}" style="--c:${couleurLieu(l)}"/>
        ${l.categorie === "scene" && !choisi ? `<text y="-22">${esc(l.nom)}</text>` : ""}</g>`).join("");
    const moi = xy ? `<g class="cplan__point is-moi" transform="translate(${xy[0]} ${xy[1]})">
        <circle r="16"/><circle r="4" class="cplan__centre"/></g>` : "";
    return `<svg viewBox="0 0 1000 700" role="img" aria-label="Plan du site" preserveAspectRatio="xMidYMid meet">${fond}<g>${points}</g>${moi}</svg>`;
  }

  function rendreLieux() {
    $("[data-plan-general]").innerHTML = planSvg(donnees.lieux);
    const f = new FormData(filtresL);
    const texte = String(f.get("texte") || "").trim().toLowerCase();
    const cat = f.get("categorie");
    const etat = f.get("etat");
    const liste = donnees.lieux.filter((l) =>
      (!texte || l.nom.toLowerCase().includes(texte) || l.id.includes(texte)) &&
      (!cat || l.categorie === cat) &&
      (!etat || (etat === "non-places" && l.x == null) || (etat === "sans-qr" && !l.qr) || (etat === "eteints" && !l.actif)));
    const corps = $("[data-lignes-lieux]");
    if (!liste.length) {
      corps.innerHTML = `<tr><td colspan="4" class="cvide">${donnees.lieux.length ? "Aucun lieu ne correspond." : "Aucun lieu. « Nouveau lieu » pour commencer (les scènes d'abord)."}</td></tr>`;
      return;
    }
    corps.innerHTML = liste.map((l) => {
      const c = CATEGORIES[l.categorie];
      const puces = [
        `<span class="cpuce">${l.categorie === "scene" ? `<span class="cpastille" style="--scene:${couleurLieu(l)}"></span>` : App.icon(c.icone)} ${esc(c.nom)}</span>`,
        l.x == null ? `<span class="cpuce cpuce--alerte">${App.icon("alerte")} Pas sur le plan</span>` : "",
        l.pmr === true ? '<span class="cpuce cpuce--ok">PMR</span>' : l.pmr === false ? '<span class="cpuce">Pas d\'accès PMR</span>' : ""
      ].join("");
      const usage = [
        l.qr ? `<span class="cpuce cpuce--ok">${App.icon("qr")} ${esc(l.qr.code)}${l.qr.actif ? "" : " (éteint)"} · ${n(l.qr.scans)} scan${l.qr.scans > 1 ? "s" : ""}</span>`
          : `<a class="cpuce ${l.categorie === "scene" ? "cpuce--danger" : "cpuce--alerte"}" href="qr.html">${App.icon("qr")} Sans QR${l.categorie === "scene" ? " : concerts non reconnus" : ""}</a>`,
        l.categorie === "scene" ? `<span class="cpuce">${App.icon("micro")} ${n(l.concerts)} concert${l.concerts > 1 ? "s" : ""}</span>` : "",
        l.dedicaces ? `<span class="cpuce">${App.icon("coeur")} ${n(l.dedicaces)} dédicace${l.dedicaces > 1 ? "s" : ""}</span>` : "",
        l.coeurs ? `<span class="cpuce">${App.icon("coeur")} ${n(l.coeurs)} cœur${l.coeurs > 1 ? "s" : ""}</span>` : ""
      ].join("");
      return `<tr data-id="${esc(l.id)}" class="${l.actif ? "" : "is-eteint"}">
        <td><div class="cligne"><strong>${esc(l.nom)}</strong><span class="ctable__code">${esc(l.id)}</span><div class="cpuces">${puces}</div></div></td>
        <td class="ctable__large"><div class="cpuces">${usage}</div></td>
        <td class="ctable__bascule">${C.interrupteur(l.actif, `data-activer-lieu="${esc(l.id)}"`, `« ${l.nom} » actif`)}</td>
        <td class="ctable__actions"><button class="cbtn" type="button">Modifier</button></td>
      </tr>`;
    }).join("");
  }

  filtresL.addEventListener("input", () => donnees && rendreLieux());
  filtresL.addEventListener("submit", (e) => e.preventDefault());
  $("[data-lignes-lieux]").addEventListener("click", (e) => {
    if (e.target.closest(".cinter") || e.target.closest("a")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrirLieu(index.lieux[tr.dataset.id]);
  });
  $("[data-plan-general]").addEventListener("click", (e) => {
    const g = e.target.closest("[data-lieu]");
    if (g) ouvrirLieu(index.lieux[g.dataset.lieu]);
  });

  /* ==========================================================================
     Dédicaces
     ========================================================================== */
  function rendreDedicaces() {
    const corps = $("[data-lignes-dedicaces]");
    if (!donnees.dedicaces.length) {
      corps.innerHTML = `<tr><td colspan="4" class="cvide">Aucune séance. « Nouvelle séance » pour commencer.</td></tr>`;
      return;
    }
    corps.innerHTML = donnees.dedicaces.map((d) => {
      const a = index.artistes[d.artiste_id] || { nom: d.artiste_id, actif: false };
      const l = d.lieu_id && index.lieux[d.lieu_id];
      return `<tr data-id="${esc(d.id)}" class="${a.actif ? "" : "is-eteint"}">
        <td><div class="cligne"><strong>${esc(a.nom)}</strong><small>${esc(nomJour(jourDe(d.debut), true))} · ${esc(plage(d))}</small>
          ${a.actif ? "" : '<div class="cpuces"><span class="cpuce">Artiste pas encore annoncé</span></div>'}</div></td>
        <td class="ctable__large">${l ? esc(l.nom) : '<span class="cpuce cpuce--alerte">Lieu à préciser</span>'}</td>
        <td>${d.qr ? `<span class="cpuce cpuce--ok">${App.icon("qr")} ${esc(d.qr.code)}${d.scanne ? " · scanné" : ""}</span>`
          : `<a class="cpuce cpuce--alerte" href="qr.html">${App.icon("qr")} Sans QR</a>`}</td>
        <td class="ctable__actions"><button class="cbtn" type="button">Modifier</button></td>
      </tr>`;
    }).join("");
  }
  $("[data-lignes-dedicaces]").addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrirDedicace(donnees.dedicaces.find((d) => d.id === tr.dataset.id));
  });

  /* ==========================================================================
     Interrupteurs : artiste annoncé, lieu actif
     ========================================================================== */
  $("[data-console-contenu]").addEventListener("change", async (e) => {
    const input = e.target.closest("[data-activer-artiste], [data-activer-lieu]");
    if (!input) return;
    const quoi = input.dataset.activerArtiste ? "artiste" : "lieu";
    const obj = quoi === "artiste" ? index.artistes[input.dataset.activerArtiste] : index.lieux[input.dataset.activerLieu];
    if (!obj) return;
    const actif = input.checked;
    if (quoi === "artiste" && actif) {
      const k = concertsDe(obj.id).length;
      const ok = await C.confirmer({
        titre: `Annoncer « ${obj.nom} » ?`,
        texte: `Il apparaît tout de suite dans le programme des joueurs${k ? `, avec ${k} concert${k > 1 ? "s" : ""}` : ""} (les téléphones relisent le programme toutes les 5 minutes).`,
        oui: "Annoncer"
      });
      if (!ok) { input.checked = false; return; }
    }
    input.disabled = true;
    try {
      await C.appel("console_programme_activer", { p_quoi: quoi, p_id: obj.id, p_actif: actif });
      obj.actif = actif;
      C.dire(quoi === "artiste" ? `« ${obj.nom} » ${actif ? "annoncé" : "caché aux joueurs"}` : `« ${obj.nom} » ${actif ? "allumé" : "éteint"}`);
      rendre();
    } catch (err) {
      input.checked = obj.actif;
      C.dire(C.message(err));
    } finally {
      input.disabled = false;
    }
  });

  /* ==========================================================================
     Boîtes : outils communs
     ========================================================================== */
  const boites = {};
  ["concert", "artiste", "lieu", "dedicace"].forEach((k) => {
    const d = $(`[data-boite="${k}"]`);
    boites[k] = { d, form: $("[data-form]", d), courant: null };
    d.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) d.close(); });
  });
  const dans = (k, sel) => $(sel, boites[k].d);

  function erreur(k, texte) {
    const zone = dans(k, "[data-erreur]");
    zone.innerHTML = `${App.icon("alerte")}<span>${esc(texte)}</span>`;
    zone.hidden = false;
    zone.scrollIntoView({ block: "nearest" });
  }
  function preparer(k, objet, titres) {
    const b = boites[k];
    b.courant = objet || null;
    b.form.reset();
    dans(k, "[data-titre]").textContent = objet ? titres.modifier : titres.nouveau;
    dans(k, "[data-supprimer]").hidden = !objet;
    dans(k, "[data-erreur]").hidden = true;
    return b.form.elements;
  }
  function optionsJours(el, choisi) {
    const jours = joursAffiches();
    if (choisi && !jours.includes(choisi)) jours.push(choisi);
    el.innerHTML = jours.map((d) => `<option value="${d}">${esc(nomJour(d, true))}</option>`).join("");
    el.value = choisi || jourCourant || JOURS[0].date;
  }
  function optionsArtistes(el, choisi) {
    el.innerHTML = `<option value="">Choisir…</option>` + donnees.artistes.map((a) =>
      `<option value="${esc(a.id)}">${esc(a.nom)}${a.actif ? "" : " (pas annoncé)"}</option>`).join("");
    el.value = choisi || "";
  }
  /* Enregistrement commun : bouton verrouillé, relecture, message */
  async function enregistrer(k, bouton, nom, params, dire) {
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel(nom, params);
      boites[k].d.close();
      C.dire(dire);
      await charger();
    } catch (err) {
      erreur(k, err.code === "CHEVAUCHEMENT" ? messageChevauchement(err) : C.message(err));
    } finally {
      liberer();
    }
  }
  async function supprimer(k, bouton, quoi, id, confirmation, dire) {
    const ok = await C.confirmer({ ...confirmation, oui: "Supprimer", danger: true });
    if (!ok) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("console_programme_supprimer", { p_quoi: quoi, p_id: id });
      boites[k].d.close();
      C.dire(dire);
      await charger();
    } catch (err) {
      erreur(k, C.message(err));
    } finally {
      liberer();
    }
  }
  function messageChevauchement(err) {
    try {
      const g = JSON.parse(err.detail);
      return `La scène est déjà prise par ${g.artiste} (${plage(g)}). Décale l'un des deux concerts.`;
    } catch (e) {
      return C.messages.CHEVAUCHEMENT;
    }
  }
  /* Heures du formulaire → instants ; null si la fin ne suit pas le début */
  function lireHeures(el) {
    if (!el.debut.value || !el.fin.value) return null;
    const debut = versIso(el.jour.value, el.debut.value);
    let fin = versIso(el.jour.value, el.fin.value);
    /* 23 h → 5 h : déjà le lendemain (avant 6 h) ; 20 h → 7 h : 7 h du lendemain */
    if (Date.parse(fin) <= Date.parse(debut)) fin = `${plusJours(fin.slice(0, 10), 1)}${fin.slice(10)}`;
    return { debut, fin };
  }

  /* ==========================================================================
     Concert
     ========================================================================== */
  function ouvrirConcert(c, preset = {}) {
    if (!scenes().length) { C.dire("Crée d'abord une scène (onglet « Lieux et scènes »)."); montrer("lieux"); return; }
    const el = preparer("concert", c, { nouveau: "Nouveau concert", modifier: "Modifier le concert" });
    const src = c || preset;
    optionsArtistes(el.artiste_id, src.artiste_id);
    el.scene_id.innerHTML = scenes().map((s) => `<option value="${esc(s.id)}">${esc(s.nom)}${s.actif ? "" : " (éteinte)"}</option>`).join("");
    el.scene_id.value = src.scene_id || scenes()[0].id;
    optionsJours(el.jour, src.debut ? jourDe(src.debut) : preset.jour);
    el.debut.value = src.debut ? hhmm(src.debut) : "15:00";
    el.fin.value = src.fin ? hhmm(src.fin) : "16:00";
    el.artiste_id.disabled = el.scene_id.disabled = !!(c && c.scanne);
    dans("concert", "[data-sous]").textContent = c
      ? [c.scanne ? "Déjà scanné : l'artiste et la scène ne changent plus, l'horaire oui" : "",
         c.favoris ? `dans le programme de ${n(c.favoris)} joueur${c.favoris > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") || "Pas encore scanné"
      : "Deux concerts d'une même scène ne peuvent pas se chevaucher.";
    aideArtiste();
    boites.concert.d.showModal();
    (c ? el.debut : el.artiste_id).focus();
  }
  function aideArtiste() {
    const el = boites.concert.form.elements;
    const a = index.artistes[el.artiste_id.value];
    dans("concert", "[data-aide-artiste]").textContent = a && !a.actif
      ? "Pas encore annoncé : ce concert reste invisible des joueurs jusqu'à l'annonce." : "";
  }
  boites.concert.form.elements.artiste_id.addEventListener("change", aideArtiste);

  dans("concert", "[data-enregistrer]").addEventListener("click", (e) => {
    const el = boites.concert.form.elements;
    const c = boites.concert.courant;
    if (!el.artiste_id.value) { erreur("concert", C.messages.ARTISTE_INCONNU); el.artiste_id.focus(); return; }
    const h = lireHeures(el);
    if (!h) { erreur("concert", C.messages.HEURE_INVALIDE); return; }
    if (Date.parse(h.fin) - Date.parse(h.debut) > 12 * HEURE) { erreur("concert", C.messages.DUREE_INVALIDE); return; }
    jourCourant = el.jour.value;   // la grille rouvre sur la journée du concert
    enregistrer("concert", e.currentTarget, "console_concert_enregistrer", {
      p_id: c ? c.id : null,
      p_concert: { artiste_id: el.artiste_id.value, scene_id: el.scene_id.value, debut: h.debut, fin: h.fin }
    }, c ? "Concert enregistré" : "Concert ajouté");
  });

  dans("concert", "[data-supprimer]").addEventListener("click", (e) => {
    const c = boites.concert.courant;
    if (!c) return;
    if (c.scanne) { erreur("concert", C.messages.CONCERT_DEJA_SCANNE); return; }
    const a = index.artistes[c.artiste_id] || { nom: "?" };
    supprimer("concert", e.currentTarget, "concert", c.id, {
      titre: `Supprimer le concert de ${a.nom} ?`,
      texte: `${nomJour(jourDe(c.debut), true)}, ${plage(c)}.${c.favoris ? ` ${n(c.favoris)} joueur${c.favoris > 1 ? "s l'ont" : " l'a"} dans son programme : il en disparaîtra.` : ""}`
    }, "Concert supprimé");
  });

  /* ==========================================================================
     Artiste
     ========================================================================== */
  function ouvrirArtiste(a) {
    const el = preparer("artiste", a, { nouveau: "Nouvel artiste", modifier: "Modifier l'artiste" });
    el.genre.innerHTML = `<option value="">Non précisé</option>` + (donnees.genres || [])
      .map((g) => `<option value="${esc(g.valeur)}">${esc(g.libelle)}</option>`).join("");
    el.id.disabled = !!a;
    el.id.dataset.auto = a ? "" : "1";
    if (a) {
      el.nom.value = a.nom;
      el.id.value = a.id;
      el.genre.value = a.genre || "";
      el.bio.value = a.bio || "";
      el.photo_url.value = a.photo_url || "";
      el.tete_affiche.checked = a.tete_affiche;
      el.actif.checked = a.actif;
    }
    dans("artiste", "[data-aide-id]").textContent = a ? "Figé : il sert dans les liens et les votes." : "Proposé à partir du nom. Il sert dans les liens et ne changera plus.";
    const cs = a ? concertsDe(a.id).length : 0;
    const ds = a ? seancesDe(a.id).length : 0;
    dans("artiste", "[data-sous]").textContent = a
      ? `${n(cs)} concert${cs > 1 ? "s" : ""} · ${n(ds)} dédicace${ds > 1 ? "s" : ""} · ${n(a.coeurs)} cœur${a.coeurs > 1 ? "s" : ""}`
      : "Il naît « pas encore annoncé » : allume-le le jour de l'annonce.";
    apercuPhoto();
    boites.artiste.d.showModal();
    el.nom.focus();
  }
  function apercuPhoto() {
    const el = boites.artiste.form.elements;
    const url = el.photo_url.value.trim();
    const zone = dans("artiste", "[data-apercu-photo]");
    zone.innerHTML = url ? `<img src="${esc(srcPhoto(url))}" alt="Aperçu de la photo" width="72" height="72">` : App.icon("etoile");
    const img = $("img", zone);
    if (img) img.addEventListener("error", () => { zone.innerHTML = `<small>introuvable</small>`; }, { once: true });
  }
  (() => {
    const el = boites.artiste.form.elements;
    el.nom.addEventListener("input", () => { if (el.id.dataset.auto) el.id.value = versId(el.nom.value, 60); });
    el.id.addEventListener("input", () => { el.id.dataset.auto = ""; });
    el.photo_url.addEventListener("change", apercuPhoto);
  })();

  dans("artiste", "[data-enregistrer]").addEventListener("click", (e) => {
    const el = boites.artiste.form.elements;
    const a = boites.artiste.courant;
    if (!el.nom.value.trim()) { erreur("artiste", C.messages.NOM_MANQUANT); el.nom.focus(); return; }
    if (!a && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(el.id.value)) { erreur("artiste", C.messages.ID_INVALIDE); el.id.focus(); return; }
    enregistrer("artiste", e.currentTarget, "console_artiste_enregistrer", {
      p_id: a ? a.id : null,
      p_artiste: {
        id: el.id.value, nom: el.nom.value.trim(), genre: el.genre.value, bio: el.bio.value.trim(),
        photo_url: el.photo_url.value.trim(), tete_affiche: el.tete_affiche.checked, actif: el.actif.checked
      }
    }, a ? "Artiste enregistré" : "Artiste ajouté");
  });

  dans("artiste", "[data-supprimer]").addEventListener("click", (e) => {
    const a = boites.artiste.courant;
    if (!a) return;
    if (artisteVu(a.id)) { erreur("artiste", C.messages.ARTISTE_DEJA_VU); return; }
    if (a.coeurs) { erreur("artiste", C.messages.ARTISTE_A_DES_COEURS); return; }
    const cs = concertsDe(a.id);
    const ds = seancesDe(a.id);
    const fav = cs.reduce((s, c) => s + c.favoris, 0);
    const parts = [
      cs.length ? `${n(cs.length)} concert${cs.length > 1 ? "s" : ""}` : "",
      ds.length ? `${n(ds.length)} séance${ds.length > 1 ? "s" : ""} de dédicaces` : ""
    ].filter(Boolean);
    supprimer("artiste", e.currentTarget, "artiste", a.id, {
      titre: `Supprimer « ${a.nom} » ?`,
      texte: `${parts.length ? `Partent avec lui : ${parts.join(" et ")}.` : "Il n'a ni concert ni dédicace."}${fav ? ` ${n(fav)} favori${fav > 1 ? "s" : ""} de joueurs disparaî${fav > 1 ? "ssent" : "t"}.` : ""} Pour le retirer sans rien perdre, décoche plutôt « Annoncé ».`
    }, "Artiste supprimé");
  });

  /* ==========================================================================
     Lieu (et scène)
     ========================================================================== */
  const planChoix = dans("lieu", "[data-plan-choix]");
  function dessinerChoix() {
    const b = boites.lieu;
    const el = b.form.elements;
    const xy = el.x.value !== "" ? [Number(el.x.value), Number(el.y.value)] : null;
    planChoix.innerHTML = planSvg(donnees.lieux, { choisi: b.courant || { id: "\u0000" }, xy });
    dans("lieu", "[data-aide-place]").textContent = xy
      ? `Placé (${xy[0]} ; ${xy[1]}). Clique ailleurs pour le déplacer.` : "Pas encore placé : clique sur le plan (les autres lieux sont en gris).";
    dans("lieu", "[data-retirer-place]").hidden = !xy;
  }
  planChoix.addEventListener("click", (e) => {
    const svg = $("svg", planChoix);
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const el = boites.lieu.form.elements;
    el.x.value = String(Math.round(Math.min(1000, Math.max(0, p.x))));
    el.y.value = String(Math.round(Math.min(700, Math.max(0, p.y))));
    dessinerChoix();
  });
  dans("lieu", "[data-retirer-place]").addEventListener("click", () => {
    const el = boites.lieu.form.elements;
    el.x.value = el.y.value = "";
    dessinerChoix();
  });

  function ajusterLieu() {
    const el = boites.lieu.form.elements;
    const scene = el.categorie.value === "scene";
    dans("lieu", "[data-champ-couleur]").hidden = !scene;
    dans("lieu", "[data-aide-categorie]").textContent = AIDE_CATEGORIE[el.categorie.value] || "";
  }

  function ouvrirLieu(l) {
    const el = preparer("lieu", l, { nouveau: "Nouveau lieu", modifier: "Modifier le lieu" });
    el.categorie.innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${esc(c.nom)}</option>`).join("");
    el.couleur.innerHTML = Object.entries(COULEURS).map(([k, c]) => `<option value="${k}">${esc(c.nom)}</option>`).join("");
    el.id.disabled = !!l;
    el.id.dataset.auto = l ? "" : "1";
    if (l) {
      el.categorie.value = l.categorie;
      el.couleur.value = l.couleur || "nuit";
      el.nom.value = l.nom;
      el.id.value = l.id;
      el.description.value = l.description || "";
      el.horaires.value = l.horaires || "";
      el.pmr.value = l.pmr == null ? "" : String(l.pmr);
      el.ordre.value = l.ordre;
      el.x.value = l.x == null ? "" : l.x;
      el.y.value = l.y == null ? "" : l.y;
      el.actif.checked = l.actif;
    } else {
      el.categorie.value = "scene";
      el.couleur.value = "sodium";
      el.ordre.value = 0;
      el.x.value = el.y.value = "";
      el.actif.checked = true;
    }
    /* Catégorie figée : scène, QR relié, cœurs reçus (mêmes règles que la base) */
    let fige = "";
    if (l && l.categorie === "scene") fige = "Une scène reste une scène (ses concerts en dépendent).";
    else if (l && l.qr) fige = "Son QR est relié : délie-le dans l'écran QR pour changer de catégorie.";
    else if (l && l.coeurs) fige = "Des joueurs ont voté pour ce lieu : sa catégorie ne change plus.";
    if (l && !fige) {
      /* Un lieu ne devient pas une scène après coup */
      $('option[value="scene"]', el.categorie).disabled = true;
    }
    el.categorie.disabled = !!fige;
    dans("lieu", "[data-aide-id]").textContent = l ? "Figé : il sert dans les liens et les votes." : "Proposé à partir du nom. Il sert dans les liens et ne changera plus.";
    dans("lieu", "[data-sous]").textContent = fige || (l ? CATEGORIES[l.categorie].nom : "Une scène se crée ici, avec sa couleur.");
    const blocQr = dans("lieu", "[data-bloc-qr]");
    blocQr.hidden = !l;
    if (l) {
      blocQr.innerHTML = `<p class="csous-titre">QR du lieu</p>${l.qr
        ? `<p><span class="cpuce cpuce--ok">${App.icon("qr")} ${esc(l.qr.code)} · ${esc(l.qr.nom)}${l.qr.actif ? "" : " (éteint)"}</span> <span class="champ__aide">${n(l.qr.scans)} scan${l.qr.scans > 1 ? "s" : ""} au total. Se modifie dans <a href="qr.html">l'écran QR</a>.</span></p>`
        : `<p class="champ__aide">Aucun QR relié. ${l.categorie === "scene" ? "Sans lui, le scan d'un concert n'est pas reconnu. " : ""}Crée-le ou relie-le dans <a href="qr.html">l'écran QR</a>.</p>`}`;
    }
    ajusterLieu();
    dessinerChoix();
    boites.lieu.d.showModal();
    (l ? el.nom : el.categorie).focus();
  }
  (() => {
    const el = boites.lieu.form.elements;
    el.categorie.addEventListener("change", ajusterLieu);
    el.nom.addEventListener("input", () => { if (el.id.dataset.auto) el.id.value = versId(el.nom.value, 40); });
    el.id.addEventListener("input", () => { el.id.dataset.auto = ""; });
  })();

  dans("lieu", "[data-enregistrer]").addEventListener("click", (e) => {
    const el = boites.lieu.form.elements;
    const l = boites.lieu.courant;
    if (!el.nom.value.trim()) { erreur("lieu", C.messages.NOM_MANQUANT); el.nom.focus(); return; }
    if (!l && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(el.id.value)) { erreur("lieu", C.messages.ID_INVALIDE); el.id.focus(); return; }
    enregistrer("lieu", e.currentTarget, "console_lieu_enregistrer", {
      p_id: l ? l.id : null,
      p_lieu: {
        id: el.id.value, categorie: el.categorie.value, nom: el.nom.value.trim(), couleur: el.couleur.value,
        description: el.description.value.trim(), horaires: el.horaires.value.trim(), pmr: el.pmr.value,
        ordre: el.ordre.value, x: el.x.value, y: el.y.value, actif: el.actif.checked
      }
    }, l ? "Lieu enregistré" : "Lieu ajouté");
  });

  dans("lieu", "[data-supprimer]").addEventListener("click", (e) => {
    const l = boites.lieu.courant;
    if (!l) return;
    if (l.concerts) { erreur("lieu", C.messages.SCENE_A_DES_CONCERTS); return; }
    if (l.qr && l.qr.scans) { erreur("lieu", C.messages.LIEU_DEJA_SCANNE); return; }
    if (l.coeurs) { erreur("lieu", C.messages.LIEU_A_DES_COEURS); return; }
    supprimer("lieu", e.currentTarget, "lieu", l.id, {
      titre: `Supprimer « ${l.nom} » ?`,
      texte: [l.qr ? `Son QR (${l.qr.code}) restera, mais délié.` : "",
              l.dedicaces ? `${n(l.dedicaces)} séance${l.dedicaces > 1 ? "s" : ""} de dédicaces n'aur${l.dedicaces > 1 ? "ont" : "a"} plus de lieu.` : "",
              "Pour le retirer du plan sans le perdre, décoche plutôt « Actif »."].filter(Boolean).join(" ")
    }, "Lieu supprimé");
  });

  /* ==========================================================================
     Dédicace
     ========================================================================== */
  function ouvrirDedicace(d) {
    const el = preparer("dedicace", d, { nouveau: "Nouvelle séance", modifier: "Modifier la séance" });
    optionsArtistes(el.artiste_id, d && d.artiste_id);
    el.lieu_id.innerHTML = `<option value="">À préciser</option>` + donnees.lieux.map((l) =>
      `<option value="${esc(l.id)}">${esc(l.nom)} (${esc(CATEGORIES[l.categorie].nom)})${l.actif ? "" : " — éteint"}</option>`).join("");
    el.lieu_id.value = (d && d.lieu_id) || "";
    optionsJours(el.jour, d ? jourDe(d.debut) : jourCourant);
    el.debut.value = d ? hhmm(d.debut) : "16:00";
    el.fin.value = d ? hhmm(d.fin) : "17:00";
    el.artiste_id.disabled = !!(d && d.scanne);
    dans("dedicace", "[data-sous]").textContent = d && d.scanne
      ? "Son QR a été scanné : l'artiste ne change plus, l'horaire et le lieu oui."
      : "Le QR de la séance se crée dans l'écran QR.";
    const blocQr = dans("dedicace", "[data-bloc-qr]");
    blocQr.hidden = !d;
    if (d) {
      blocQr.innerHTML = `<p class="csous-titre">QR de la séance</p>${d.qr
        ? `<p><span class="cpuce cpuce--ok">${App.icon("qr")} ${esc(d.qr.code)} · ${esc(d.qr.nom)}${d.qr.actif ? "" : " (éteint)"}</span> <span class="champ__aide">Se modifie dans <a href="qr.html">l'écran QR</a>.</span></p>`
        : `<p class="champ__aide">Aucun QR : sans lui, la séance ne fait pas entrer l'artiste dans la collection. Crée-le dans <a href="qr.html">l'écran QR</a> (type Dédicace).</p>`}`;
    }
    boites.dedicace.d.showModal();
    (d ? el.debut : el.artiste_id).focus();
  }

  dans("dedicace", "[data-enregistrer]").addEventListener("click", (e) => {
    const el = boites.dedicace.form.elements;
    const d = boites.dedicace.courant;
    if (!el.artiste_id.value) { erreur("dedicace", C.messages.ARTISTE_INCONNU); el.artiste_id.focus(); return; }
    const h = lireHeures(el);
    if (!h) { erreur("dedicace", C.messages.HEURE_INVALIDE); return; }
    if (Date.parse(h.fin) - Date.parse(h.debut) > 12 * HEURE) { erreur("dedicace", C.messages.DUREE_INVALIDE); return; }
    enregistrer("dedicace", e.currentTarget, "console_dedicace_enregistrer", {
      p_id: d ? d.id : null,
      p_dedicace: { artiste_id: el.artiste_id.value, lieu_id: el.lieu_id.value, debut: h.debut, fin: h.fin }
    }, d ? "Séance enregistrée" : "Séance ajoutée");
  });

  dans("dedicace", "[data-supprimer]").addEventListener("click", (e) => {
    const d = boites.dedicace.courant;
    if (!d) return;
    if (d.scanne) { erreur("dedicace", C.messages.DEDICACE_DEJA_SCANNEE); return; }
    const a = index.artistes[d.artiste_id] || { nom: "?" };
    supprimer("dedicace", e.currentTarget, "dedicace", d.id, {
      titre: `Supprimer la séance de ${a.nom} ?`,
      texte: `${nomJour(jourDe(d.debut), true)}, ${plage(d)}.${d.qr ? ` Son QR (${d.qr.code}) restera, mais délié.` : ""}`
    }, "Séance supprimée");
  });

  await charger();
});
