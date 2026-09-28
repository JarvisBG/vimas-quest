/* ==========================================================================
   Console — écran Badges (étape 6.3), style Game Master d'Otaku
   Lecture : console_badges (badges + nombre de gagnants + missions, QR et
   lots qui les donnent) en UN appel au chargement, puis seulement après une
   écriture. Recherche et filtres : sur la liste chargée, sans requête.
   Écritures (bouton verrouillé, jamais réessayées) :
   console_badge_enregistrer (nom, icône du sprite DOMAF, texte, rareté,
   forme, secret, page « où l'obtenir »), console_badge_supprimer (refusée
   pour un badge système, déjà gagné, ou donné par une mission / un QR / un lot).
   La remise à un joueur se fait dans sa fiche (écran Joueurs).
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    NOM_BADGE_MANQUANT: "Donne un nom au badge (40 caractères au plus).",
    ICONE_INVALIDE: "Choisis une icône.",
    DESCRIPTION_TROP_LONGUE: "Le texte fait 200 caractères au plus.",
    RARETE_INVALIDE: "Rareté inconnue.",
    FORME_INVALIDE: "Forme inconnue.",
    LIEN_INVALIDE: "Page inconnue.",
    BADGE_NOM_PRIS: "Un badge porte déjà ce nom.",
    BADGE_INCONNU: "Ce badge n'existe plus : recharge la page.",
    BADGE_SYSTEME_NOM: "C'est un badge système : son nom ne change pas (le jeu le donne par son nom).",
    BADGE_SYSTEME_SUPPRESSION: "C'est un badge système : il ne se supprime pas.",
    BADGE_DEJA_GAGNE: "Des joueurs l'ont déjà gagné : il reste dans leur collection.",
    BADGE_UTILISE: "Une mission, un QR ou un lot de la roue le donne encore : retire-le d'abord de là."
  });

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;
  const RARETES = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
  const FORMES = { rond: "Rond", etoile: "Étoile", hexa: "Hexagone", ecusson: "Écusson" };
  /* Règles des badges système (même liste que _is_system_badge en base) */
  const REGLES = {
    "Première note": "Premier QR scanné",
    "Curieux": "5 stands différents scannés",
    "Fouineur": "Première relique trouvée",
    "Autographe": "Première séance de dédicaces",
    "Jury": "3e stand dans les coups de cœur",
    "Oreille d'or": "Top 10 d'une manche de blind test",
    "Lève-tôt": "Un scan entre 6 h et 17 h (heure du Cameroun)",
    "Noctambule": "Une scène scannée pendant un concert, entre minuit et 6 h",
    "Marathonien": "Au moins un scan chacune des 4 journées",
    "Podium": "Top 3 de la journée à la clôture (phase « Clôture »)"
  };
  /* Pages du site joueur (contrainte badges.lien : « page.html ») */
  const PAGES = [
    ["", "Aucune"], ["scanner.html", "Scanner"], ["missions.html", "Missions"], ["collection.html", "Collection"],
    ["programme.html", "Programme"], ["plan.html", "Plan"], ["coups-de-coeur.html", "Coups de cœur"],
    ["blind-test.html", "Blind test"], ["classement.html", "Classement"], ["roue.html", "Roue"]
  ];
  /* Icônes du sprite proposées (les icônes d'interface sont écartées) */
  const PAS_POUR_UN_BADGE = new Set(["fleche", "menu", "fermer", "retour", "clavier", "sortie", "plus", "zoomplus", "zoommoins", "camera", "croix"]);
  const icones = App.$$("#app-sprite symbol").map((s) => s.id.replace(/^i-/, "")).filter((i) => !PAS_POUR_UN_BADGE.has(i));

  const lignes = $("[data-lignes]");
  const filtres = $("[data-filtres]");
  const boite = $("[data-boite]");
  const form = $("[data-form]");
  let donnees = null;
  let courant = null;

  $("[data-liens]").innerHTML = PAGES.map(([v, nom]) => `<option value="${v}">${esc(nom)}</option>`).join("");
  $("[data-icones]").innerHTML = icones.map((i) =>
    `<label title="${esc(i)}"><input type="radio" name="icone" value="${esc(i)}">${App.icon(i)}<span class="sr-only">${esc(i)}</span></label>`).join("");

  const medaille = (b, grand = false) =>
    `<span class="cmedaille cmedaille--${esc(b.forme || "rond")} cmedaille--${esc(b.rarete || "commun")}${grand ? " cmedaille--grand" : ""}" aria-hidden="true">${App.icon(b.icone || "etoile")}</span>`;

  function obtention(b) {
    const parts = [];
    if (b.systeme) parts.push(`<span class="cpuce cpuce--ok">${App.icon("eclair")} ${esc(REGLES[b.nom] || "Automatique")}</span>`);
    if (b.missions) parts.push(`<span class="cpuce">${App.icon("cible")} ${n(b.missions)} mission${b.missions > 1 ? "s" : ""}</span>`);
    if (b.qr) parts.push(`<span class="cpuce">${App.icon("qr")} ${n(b.qr)} QR</span>`);
    if (b.lots) parts.push(`<span class="cpuce">${App.icon("roue")} ${n(b.lots)} lot${b.lots > 1 ? "s" : ""} de la roue</span>`);
    if (!parts.length) parts.push(`<span class="cpuce cpuce--alerte">${App.icon("passeport")} Remis par l'équipe</span>`);
    return `<div class="cpuces">${parts.join("")}</div>`;
  }

  async function charger() {
    try {
      donnees = await C.appel("console_badges");
      rendre();
    } catch (e) {
      lignes.innerHTML = `<tr><td colspan="4"><p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p></td></tr>`;
      $("[data-resume]").textContent = "";
    }
  }

  function visibles() {
    const f = new FormData(filtres);
    const texte = String(f.get("texte") || "").trim().toLowerCase();
    const origine = f.get("origine");
    const rarete = f.get("rarete");
    return donnees.badges.filter((b) =>
      (!texte || b.nom.toLowerCase().includes(texte) || (b.description || "").toLowerCase().includes(texte)) &&
      (!rarete || b.rarete === rarete) &&
      (!origine || (origine === "systeme" && b.systeme) || (origine === "secret" && b.secret) ||
        (origine === "lie" && (b.missions || b.qr || b.lots)) ||
        (origine === "main" && !b.systeme && !b.missions && !b.qr && !b.lots)));
  }

  function rendre() {
    const bs = donnees.badges;
    const auto = bs.filter((b) => b.systeme).length;
    const gagnes = bs.reduce((s, b) => s + b.gagnes, 0);
    $("[data-resume]").textContent = `${n(bs.length)} badges dont ${n(auto)} automatiques · ${n(gagnes)} remis au total`;
    const liste = visibles();
    if (!liste.length) {
      lignes.innerHTML = `<tr><td colspan="4" class="cvide">${bs.length ? "Aucun badge ne correspond." : "Aucun badge."}</td></tr>`;
      return;
    }
    const joueurs = donnees.joueurs || 0;
    lignes.innerHTML = liste.map((b) => `<tr data-id="${esc(b.id)}">
      <td><div class="cavec-medaille">${medaille(b)}<div class="cligne">
        <strong>${esc(b.nom)}</strong>${b.description ? `<small>${esc(b.description)}</small>` : ""}
        <div class="cpuces"><span class="cpuce cpuce--${esc(b.rarete)}">${esc(RARETES[b.rarete] || b.rarete)}</span>
          ${b.secret ? `<span class="cpuce cpuce--epique">${App.icon("cadenas")} Secret</span>` : ""}</div></div></div></td>
      <td class="ctable__large">${obtention(b)}</td>
      <td class="ctable__nb">${n(b.gagnes)}<span class="ctable__sous">${joueurs ? `${Math.round((b.gagnes / joueurs) * 100)} % des joueurs` : "joueur"}</span></td>
      <td class="ctable__actions"><button class="cbtn" type="button">Modifier</button></td>
    </tr>`).join("");
  }

  filtres.addEventListener("input", () => donnees && rendre());
  filtres.addEventListener("submit", (e) => e.preventDefault());
  lignes.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrir(donnees.badges.find((b) => b.id === tr.dataset.id));
  });

  /* ---------- La boîte ---------- */
  function apercu() {
    const el = form.elements;
    const b = { forme: el.forme.value, rarete: el.rarete.value, icone: (form.querySelector('[name="icone"]:checked') || {}).value };
    const zone = $("[data-apercu]");
    zone.className = `cmedaille cmedaille--grand cmedaille--${b.forme} cmedaille--${b.rarete}`;
    zone.innerHTML = App.icon(b.icone || "etoile");
    $("[data-apercu-nom]").textContent = el.nom.value.trim() || "Nom du badge";
    $("[data-apercu-texte]").textContent = `${RARETES[b.rarete]} · ${FORMES[b.forme]}${el.secret.checked ? " · secret" : ""}`;
  }
  form.addEventListener("input", apercu);
  form.addEventListener("change", apercu);

  function ouvrir(b) {
    courant = b || null;
    form.reset();
    const el = form.elements;
    if (b) {
      el.nom.value = b.nom;
      el.description.value = b.description || "";
      el.rarete.value = b.rarete;
      el.forme.value = b.forme;
      el.lien.value = b.lien || "";
      if (el.lien.value !== (b.lien || "")) {   // lien avec ancre (#…) : gardé tel quel
        el.lien.insertAdjacentHTML("beforeend", `<option value="${esc(b.lien)}">${esc(b.lien)}</option>`);
        el.lien.value = b.lien;
      }
      el.secret.checked = b.secret;
    }
    const icone = (b && b.icone) || "etoile";
    const radio = form.querySelector(`[name="icone"][value="${CSS.escape(icone)}"]`);
    if (radio) radio.checked = true;
    const systeme = !!(b && b.systeme);
    el.nom.disabled = systeme;
    $("[data-aide-nom]").hidden = !systeme;
    $("[data-b-titre]").textContent = b ? "Modifier le badge" : "Nouveau badge";
    $("[data-b-sous]").textContent = b
      ? `${b.systeme ? `Automatique : ${REGLES[b.nom] || "donné par le jeu"} · ` : ""}gagné par ${n(b.gagnes)} joueur${b.gagnes > 1 ? "s" : ""}`
      : "Il se gagne par une mission ou un QR qui le donne, ou remis par l'équipe.";
    const supprimable = b && !b.systeme;
    $("[data-supprimer]").hidden = !supprimable;
    $("[data-erreur]").hidden = true;
    apercu();
    boite.showModal();
    (systeme ? el.description : el.nom).focus();
  }

  function erreur(texte) {
    const zone = $("[data-erreur]");
    zone.innerHTML = `${App.icon("alerte")}<span>${esc(texte)}</span>`;
    zone.hidden = false;
    zone.scrollIntoView({ block: "nearest" });
  }

  $("[data-nouveau]").addEventListener("click", () => donnees && ouvrir(null));
  boite.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boite.close(); });

  $("[data-enregistrer]").addEventListener("click", async (e) => {
    const el = form.elements;
    const nom = courant && courant.systeme ? courant.nom : el.nom.value.trim();
    if (!nom) { erreur(C.messages.NOM_BADGE_MANQUANT); el.nom.focus(); return; }
    const badge = {
      nom, description: el.description.value.trim(),
      icone: (form.querySelector('[name="icone"]:checked') || {}).value || "etoile",
      rarete: el.rarete.value, forme: el.forme.value, secret: el.secret.checked, lien: el.lien.value
    };
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try {
      await C.appel("console_badge_enregistrer", { p_id: courant ? courant.id : null, p_badge: badge });
      boite.close();
      C.dire(courant ? "Badge enregistré" : "Badge créé");
      await charger();
    } catch (err) {
      erreur(C.message(err));
    } finally {
      liberer();
    }
  });

  $("[data-supprimer]").addEventListener("click", async (e) => {
    if (!courant) return;
    const b = courant;
    if (b.gagnes) { erreur(C.messages.BADGE_DEJA_GAGNE); return; }
    if (b.missions || b.qr || b.lots) { erreur(C.messages.BADGE_UTILISE); return; }
    const bouton = e.currentTarget;
    const ok = await C.confirmer({ titre: `Supprimer « ${b.nom} » ?`, texte: "Personne ne l'a encore gagné.", oui: "Supprimer", danger: true });
    if (!ok) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("console_badge_supprimer", { p_id: b.id });
      boite.close();
      C.dire("Badge supprimé");
      await charger();
    } catch (err) {
      erreur(C.message(err));
    } finally {
      liberer();
    }
  });

  await charger();
});
