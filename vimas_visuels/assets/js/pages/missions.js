/* ==========================================================================
   Page 8 — Missions
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "missions" })) return;
  const { $, $$, esc, icon, fmt, api, session } = App;

  const GROUPES = {
    afaire: ["en-cours", "a-faire"],
    verrou: ["verrouillee", "a-venir"],
    fini: ["terminee", "expiree"]
  };
  const VIDES = {
    afaire: ["Tout est fait", "Toutes les missions disponibles sont terminées. De nouvelles arrivent chaque jour à 16h.", true],
    verrou: ["Rien de verrouillé", "Toutes les missions sont accessibles avec ton rang actuel.", false],
    fini: ["Pas encore de mission terminée", "Scanne ton premier QR pour lancer la partie.", true]
  };
  const ACTIONS = {
    scanner:      { lib: "Ouvrir le scanner",        href: "scanner.html",        icone: "qr" },
    "blind-test": { lib: "Aller au blind test",      href: "blind-test.html",     icone: "micro" },
    votes:        { lib: "Voter dans Coups de cœur", href: "coups-de-coeur.html", icone: "coeur" }
  };

  const etat = { groupe: "afaire", categorie: "toutes", donnees: null, ouvertes: new Set(), nouvelle: null, eclair: null };
  let categories = {}, scenes = [], jours = [];
  try {
    [categories, scenes, jours] = await Promise.all(["categoriesMissions", "scenes", "jours"].map(App.data.get));
  } catch (e) { /* affichage dégradé */ }
  const sceneParId = Object.fromEntries(scenes.map((s) => [s.id, s]));

  /* ---------- Filtres de catégorie ---------- */
  $("[data-categories]").innerHTML = [["toutes", { nom: "Toutes" }], ...Object.entries(categories)].map(([id, c]) => `
    <label class="puce">
      <input type="radio" name="categorie" value="${esc(id)}" ${id === "toutes" ? "checked" : ""}>
      <span>${c.icone ? icon(c.icone) : ""}${esc(c.nom)}</span>
    </label>`).join("");
  $("[data-categories]").addEventListener("change", (e) => {
    etat.categorie = e.target.value;
    rendreListe();
  });

  /* ---------- Onglets ---------- */
  const onglets = $$("[data-groupe]");
  function choisirGroupe(groupe, { focus = false } = {}) {
    etat.groupe = groupe;
    onglets.forEach((o) => {
      const actif = o.dataset.groupe === groupe;
      o.setAttribute("aria-selected", String(actif));
      o.tabIndex = actif ? 0 : -1;
      if (actif && focus) o.focus();
    });
    $("[data-panneau]").setAttribute("aria-labelledby", `onglet-${groupe}`);
    rendreListe();
  }
  $("[data-onglets]").addEventListener("click", (e) => {
    const o = e.target.closest("[data-groupe]");
    if (o) choisirGroupe(o.dataset.groupe);
  });
  $("[data-onglets]").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = onglets.findIndex((o) => o.dataset.groupe === etat.groupe);
    const j = (i + (e.key === "ArrowRight" ? 1 : -1) + onglets.length) % onglets.length;
    choisirGroupe(onglets[j].dataset.groupe, { focus: true });
  });

  /* ======================================================================
     Chargement
     ====================================================================== */
  async function charger() {
    try {
      etat.donnees = await api.missions();
      if (!etat.donnees) { window.location.replace("inscription.html"); return; }
      rendreBilan();
      rendreEclair();
      rendreListe();
      majJetons();
    } catch (e) {
      console.error(e);
      App.toast("Impossible de charger les missions. Vérifie ta connexion.");
    }
  }

  function majJetons(anime = false) {
    const j = session.get();
    const el = $("[data-jetons]");
    el.hidden = false;
    el.innerHTML = `<span class="jeton" aria-hidden="true"></span><span class="chiffres">${j.jetons}</span><span class="sr-only"> jetons</span>`;
    if (anime) { el.classList.remove("is-gagne"); void el.offsetWidth; el.classList.add("is-gagne"); }
  }

  /* ---------- Bilan ---------- */
  function rendreBilan() {
    const ms = etat.donnees.missions;
    const finies = ms.filter((m) => m.statut === "terminee").length;
    const restantes = ms.filter((m) => ["en-cours", "a-faire", "verrouillee", "a-venir"].includes(m.statut));
    const xp = restantes.reduce((t, m) => t + m.xp, 0);
    const jetons = restantes.reduce((t, m) => t + m.jetons, 0);
    $("[data-bilan]").innerHTML =
      `<strong class="chiffres">${finies}</strong> mission${finies > 1 ? "s" : ""} terminée${finies > 1 ? "s" : ""} sur ${ms.length}. ` +
      `Encore <strong class="chiffres">${fmt.nombre(xp)}</strong> XP et <strong class="chiffres">${jetons}</strong> jetons à gagner.`;
    $("[data-crans-global]").innerHTML = ms.map((m) => `<i class="${m.statut === "terminee" ? "is-fait" : ""}"></i>`).join("");

    Object.entries(GROUPES).forEach(([g, statuts]) => {
      $(`[data-nb="${g}"]`).textContent = ms.filter((m) => statuts.includes(m.statut)).length;
    });
  }

  /* ---------- Défi éclair ---------- */
  let minuteurEclair = null;
  function rendreEclair() {
    clearInterval(minuteurEclair);
    const m = etat.donnees.missions.find((x) => x.finMs && ["a-faire", "en-cours"].includes(x.statut));
    const bloc = $("[data-eclair]");
    etat.eclair = m ? m.id : null;
    bloc.hidden = !m;
    if (!m) return;
    $("[data-eclair-titre]").textContent = m.titre;
    $("[data-eclair-texte]").textContent = m.texte;
    $("[data-eclair-gains]").innerHTML = gains(m);
    const chrono = $("[data-eclair-chrono]");
    const tic = () => {
      const reste = m.finMs - App.maintenant().getTime();
      if (reste <= 0) { clearInterval(minuteurEclair); charger(); return; }
      const min = Math.floor(reste / 60000), sec = Math.floor((reste % 60000) / 1000);
      chrono.textContent = min >= 60 ? App.duree(reste) : `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
      chrono.setAttribute("aria-label", `Temps restant : ${App.duree(reste)}`);
      chrono.classList.toggle("is-urgent", reste < 5 * 60000);
    };
    tic();
    minuteurEclair = setInterval(tic, 1000);
  }

  /* ---------- Liste ---------- */
  const ORDRE = { "en-cours": 0, "a-faire": 1, "a-venir": 2, verrouillee: 3, terminee: 4, expiree: 5 };

  function rendreListe() {
    if (!etat.donnees) return;
    const statuts = GROUPES[etat.groupe];
    const liste = etat.donnees.missions
      .filter((m) => statuts.includes(m.statut))
      .filter((m) => m.id !== etat.eclair) // déjà mis en avant au-dessus
      .filter((m) => etat.categorie === "toutes" || m.categorie === etat.categorie)
      .sort((a, b) =>
        (a.finMs ? -1 : 0) - (b.finMs ? -1 : 0) ||
        ORDRE[a.statut] - ORDRE[b.statut] ||
        b.fait / b.objectif - a.fait / a.objectif ||
        (b.terminee?.heure || "").localeCompare(a.terminee?.heure || ""));

    $("[data-liste]").innerHTML = liste.map(carte).join("");
    const vide = $("[data-vide]");
    vide.hidden = liste.length > 0;
    if (!liste.length) {
      const filtre = etat.categorie !== "toutes";
      const [t, x, action] = filtre
        ? ["Aucune mission ici", "Aucune mission de cette catégorie dans cet onglet.", false]
        : VIDES[etat.groupe];
      $("[data-vide-titre]").textContent = t;
      $("[data-vide-texte]").textContent = x;
      $("[data-vide-action]").hidden = !action;
    }
  }

  const gains = (m) => `
    <span class="pastille pastille--sodium">+${m.xp} XP</span>
    <span class="pastille">${m.jetons} jeton${m.jetons > 1 ? "s" : ""}</span>`;

  const PASTILLE_STATUT = {
    "en-cours": ["bleu", "En cours"],
    "a-faire": ["", "À commencer"],
    verrouillee: ["nuit", "Verrouillée"],
    "a-venir": ["nuit", "Bientôt"],
    terminee: ["vert", "Validée"],
    expiree: ["", "Manquée"]
  };

  function carte(m) {
    const cat = categories[m.categorie] || { nom: m.categorie, icone: "cible" };
    const [couleur, libStatut] = PASTILLE_STATUT[m.statut];
    const ouverte = etat.ouvertes.has(m.id);
    const actif = ["en-cours", "a-faire"].includes(m.statut);
    const idDetails = `details-${m.id}`;
    const jour = jours.find((j) => j.id === m.jour);

    let bas = "";
    if (m.statut === "terminee") {
      bas = `
        <div class="valide">
          <span class="tampon">Validée${m.terminee?.heure ? ` à ${esc(fmt.heure(m.terminee.heure))}` : ""}</span>
          ${m.terminee?.par ? `<span class="valide__par">par ${esc(m.terminee.par)}</span>` : ""}
        </div>`;
    } else if (m.statut === "verrouillee") {
      bas = `<p class="verrou">${icon("cadenas")} Débloquée au rang ${esc(m.rangMin)}, encore ${fmt.nombre(m.xpRequis)} XP.</p>`;
    } else if (m.statut === "a-venir") {
      bas = `<p class="verrou">${icon("horloge")} Disponible le ${esc(jour ? jour.long : "")}${m.finHeure ? `, jusqu'à ${fmt.heure(m.finHeure)}` : ""}.</p>`;
    } else if (m.statut === "expiree") {
      bas = `<p class="verrou">${icon("horloge")} Défi terminé à ${fmt.heure(m.finHeure)}.</p>`;
    }

    const progres = (m.objectif > 1 || m.statut === "en-cours") && m.statut !== "terminee" ? `
      <div class="mcarte__progres">
        <div class="crans" role="img" aria-label="${m.fait} sur ${m.objectif}">
          ${Array.from({ length: m.objectif }, (_, i) => `<i class="${i < m.fait ? "is-fait" : ""}"></i>`).join("")}
        </div>
        <strong>${m.fait}/${m.objectif}</strong>
      </div>` : "";

    return `
      <li>
        <article class="mcarte${etat.nouvelle === m.id ? " is-nouvelle" : ""}" id="${esc(m.id)}" data-statut="${m.statut}" aria-labelledby="titre-${esc(m.id)}">
          <div class="mcarte__tete">
            <span class="mcarte__cat">${icon(cat.icone)} ${esc(cat.nom)}</span>
            <span class="pastille ${couleur ? `pastille--${couleur}` : ""}">${libStatut}</span>
          </div>
          <h2 class="mcarte__titre affiche" id="titre-${esc(m.id)}">${esc(m.titre)}</h2>
          <p class="mcarte__texte">${esc(m.texte)}</p>
          ${progres}
          ${bas}
          <div class="mcarte__bas">
            <span class="recompenses">
              ${gains(m)}
              ${m.action === "staff" ? `<span class="pastille pastille--rose">Validation staff</span>` : ""}
            </span>
            ${actif ? `
              <button class="mcarte__toggle" type="button" aria-expanded="${ouverte}" aria-controls="${idDetails}" data-toggle="${esc(m.id)}">
                ${ouverte ? "Masquer" : "Comment faire"} ${icon("fleche")}
              </button>` : ""}
          </div>
          ${actif ? `<div class="mcarte__details" id="${idDetails}" ${ouverte ? "" : "hidden"}>${details(m)}</div>` : ""}
        </article>
      </li>`;
  }

  function details(m) {
    const blocs = [];
    if (m.aIndice) {
      blocs.push(m.indice
        ? `<div class="indice">${icon("ampoule")}<p><strong>Indice :</strong> ${esc(m.indice)}</p></div>`
        : `<div class="indice indice--cache">${icon("ampoule")}
            <p>Un indice est disponible.
            <button class="lien-fort" type="button" data-indice="${esc(m.id)}">Le révéler pour ${m.coutIndice} jeton${m.coutIndice > 1 ? "s" : ""}</button></p>
          </div>`);
    }
    if (m.action === "staff") {
      blocs.push(`<p class="mention-staff">${icon("valide")} Cette mission est validée par l'équipe : présente ton code de validation à un membre du staff sur place.</p>`);
    }
    const actions = [];
    if (m.action === "staff") {
      actions.push(`<button class="btn btn--sodium btn--bloc" type="button" data-valider="${esc(m.id)}">${icon("qr")} Montrer mon code au staff</button>`);
    } else if (ACTIONS[m.action]) {
      const a = ACTIONS[m.action];
      actions.push(`<a class="btn btn--sodium btn--bloc" href="${a.href}">${icon(a.icone)} ${a.lib}</a>`);
    }
    if (m.lieu && sceneParId[m.lieu]) {
      actions.push(`<a class="btn btn--contour btn--bloc" href="plan.html?lieu=${encodeURIComponent(m.lieu)}">${icon("plan")} Voir ${esc(sceneParId[m.lieu].nom)} sur le plan</a>`);
    }
    blocs.push(`<div class="mcarte__actions">${actions.join("")}</div>`);
    return blocs.join("");
  }

  /* ---------- Interactions dans la liste ---------- */
  $("[data-liste]").addEventListener("click", async (e) => {
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const id = toggle.dataset.toggle;
      const ouvrir = !etat.ouvertes.has(id);
      ouvrir ? etat.ouvertes.add(id) : etat.ouvertes.delete(id);
      toggle.setAttribute("aria-expanded", String(ouvrir));
      toggle.innerHTML = `${ouvrir ? "Masquer" : "Comment faire"} ${icon("fleche")}`;
      $(`#details-${id}`).hidden = !ouvrir;
      return;
    }

    const indice = e.target.closest("[data-indice]");
    if (indice) {
      const m = etat.donnees.missions.find((x) => x.id === indice.dataset.indice);
      if (!window.confirm(`Révéler l'indice pour ${m.coutIndice} jeton${m.coutIndice > 1 ? "s" : ""} ?`)) return;
      indice.setAttribute("aria-busy", "true");
      const res = await api.revelerIndice(m.id);
      if (!res.ok) {
        App.toast(res.erreur === "jetons" ? "Pas assez de jetons. Scanne des QR pour en gagner." : "Indice indisponible.");
        indice.removeAttribute("aria-busy");
        return;
      }
      await charger();
      majJetons(true);
      return;
    }

    const valider = e.target.closest("[data-valider]");
    if (valider) ouvrirValidation(valider.dataset.valider);
  });

  /* ======================================================================
     Validation par le staff
     ====================================================================== */
  const dialogue = $("[data-validation]");
  let validation = { id: null, minuteur: null, sondage: null, verrouEcran: null };

  async function afficherCode() {
    const c = await api.codeValidation();
    const joueur = session.get();
    $("[data-valid-qr]").innerHTML = App.qrSvg(c.contenu, { titre: `Code de validation de ${joueur.pseudo}` });
    $("[data-valid-code]").textContent = c.code;
    clearInterval(validation.minuteur);
    const tic = () => {
      const reste = c.expire - Date.now();
      if (reste <= 0) { afficherCode(); return; }
      const min = Math.floor(reste / 60000), sec = Math.floor((reste % 60000) / 1000);
      $("[data-valid-expire]").textContent = `Nouveau code dans ${min}:${String(sec).padStart(2, "0")}`;
    };
    tic();
    validation.minuteur = setInterval(tic, 1000);
  }

  async function ouvrirValidation(id) {
    const m = etat.donnees.missions.find((x) => x.id === id);
    validation.id = id;
    $("[data-valid-mission]").textContent = m.titre;
    $("[data-valid-demo]").hidden = !App.config.demo;
    try {
      await afficherCode();
    } catch (err) {
      console.error(err);
      App.toast("Le code n'a pas pu être généré. Recharge la page.");
      return;
    }
    dialogue.showModal();

    // Garde l'écran allumé pendant que le staff scanne
    try { validation.verrouEcran = await navigator.wakeLock?.request("screen"); } catch (e) { /* non pris en charge */ }

    // En production : le staff valide depuis la console, le téléphone le détecte ici
    clearInterval(validation.sondage);
    validation.sondage = setInterval(async () => {
      const d = await api.missions();
      const maj = d && d.missions.find((x) => x.id === id);
      if (maj && maj.statut === "terminee") missionValidee(maj);
    }, 10000);
  }

  function fermerValidation() {
    clearInterval(validation.minuteur);
    clearInterval(validation.sondage);
    validation.verrouEcran?.release?.().catch(() => {});
    validation.verrouEcran = null;
    if (dialogue.open) dialogue.close();
  }

  $("[data-fermer-validation]").addEventListener("click", fermerValidation);
  dialogue.addEventListener("click", (e) => { if (e.target === dialogue) fermerValidation(); });
  dialogue.addEventListener("close", fermerValidation);

  $("[data-valid-demo]").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.setAttribute("aria-busy", "true");
    $("[data-valid-attente]").textContent = "Validation en cours…";
    const res = await api.demoValidationStaff(validation.id);
    b.removeAttribute("aria-busy");
    $("[data-valid-attente]").innerHTML = `<span class="validation__point" aria-hidden="true"></span> En attente de la validation…`;
    if (res.ok) missionValidee(res.mission);
  });

  async function missionValidee(m) {
    fermerValidation();
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    etat.nouvelle = m.id;
    etat.ouvertes.delete(m.id);
    await charger();
    choisirGroupe("fini");
    majJetons(true);
    App.toast(`Mission validée : +${m.xp} XP et ${m.jetons} jeton${m.jetons > 1 ? "s" : ""}.`);
    const el = document.getElementById(m.id);
    if (el) el.scrollIntoView({ behavior: App.reduceMotion ? "auto" : "smooth", block: "center" });
    setTimeout(() => { etat.nouvelle = null; }, 1500);
  }

  /* ======================================================================
     Lien direct vers une mission : missions.html#m4
     ====================================================================== */
  function allerA(id) {
    const m = etat.donnees?.missions.find((x) => x.id === id);
    if (!m) return;
    const groupe = Object.keys(GROUPES).find((g) => GROUPES[g].includes(m.statut));
    etat.categorie = "toutes";
    $("input[name=categorie][value=toutes]").checked = true;
    if (["en-cours", "a-faire"].includes(m.statut)) etat.ouvertes.add(id);
    choisirGroupe(groupe);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("is-cible");
    setTimeout(() => el.classList.remove("is-cible"), 1700);
  }

  await charger();
  if (location.hash) allerA(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener("hashchange", () => allerA(decodeURIComponent(location.hash.slice(1))));
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !dialogue.open) charger(); });
});
