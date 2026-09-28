/* ==========================================================================
   Page 13 — Coups de cœur : voter pour ses artistes et ses stands préférés
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, $$, esc, icon, fmt, api } = App;

  const etat = { cat: "artistes", vue: "voter", d: null, anime: null };
  const NOMS = { artistes: ["artiste", "artistes"], stands: ["stand", "stands"] };
  let avatars = [];
  try { avatars = await App.data.get("avatars"); } catch (e) { /* visuel simple */ }
  const hash = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  /* ---------- Chargement ---------- */
  async function charger() {
    try {
      etat.d = await api.coupsDeCoeur();
      if (!etat.d) { location.replace("inscription.html"); return; }
      rendre();
    } catch (e) {
      console.error(e);
      App.toast("Impossible de charger les votes. Vérifie ta connexion.");
    }
  }

  function rendre() {
    const d = etat.d;
    $("[data-cloture]").textContent = d.cloture.passee
      ? "Les votes sont clos. Voici les résultats."
      : `Tu peux changer d'avis jusqu'à ${d.cloture.libelle} (encore ${App.duree(d.cloture.ms - App.maintenant().getTime())}).`
        + (d.xpRestants > 0 ? ` Chaque cœur donné rapporte ${d.xp} XP (encore ${d.xpRestants} fois).` : "");
    $("[data-resultats]").textContent = `Résultats : ${d.resultats}.`;
    rendreReserve();
    rendreMission();
    etat.vue === "voter" ? rendreVote() : rendreTendances();
  }

  /* ---------- Réserve ---------- */
  function rendreReserve() {
    const d = etat.d, cat = etat.cat;
    const utilises = d.mesVotes[cat].length;
    const restants = d.coeurs - utilises;
    $("[data-coeurs]").innerHTML = Array.from({ length: d.coeurs }, (_, i) => {
      const plein = i < restants;
      const anime = etat.anime !== null && i === etat.anime;
      return `<span class="coeur-r ${plein ? "is-plein" : "is-vide"}${anime ? " is-anime" : ""}">${icon("coeur")}</span>`;
    }).join("");
    etat.anime = null;
    const [un, plusieurs] = NOMS[cat];
    $("[data-reserve]").classList.toggle("is-cloture", d.cloture.passee);
    $("[data-reserve-texte]").textContent = d.cloture.passee
      ? `Tu as voté pour ${utilises} ${utilises > 1 ? plusieurs : un}.`
      : restants > 0
        ? `Il te reste ${restants} cœur${restants > 1 ? "s" : ""} pour les ${plusieurs}`
        : `Tes ${d.coeurs} cœurs sont donnés. Retire-en un pour changer d'avis.`;
  }

  // Badge « Jury » : donné par la base au 3e stand voté, gardé ensuite
  function rendreMission() {
    const zone = $("[data-mission]");
    if (etat.cat !== "stands") { zone.hidden = true; return; }
    const n = etat.d.jury ? 3 : Math.min(3, etat.d.mesVotes.stands.length);
    zone.hidden = false;
    zone.innerHTML = `
      <span><strong>Badge Jury</strong><br>${etat.d.jury ? "Obtenu : merci pour tes votes !" : "Vote pour 3 stands"}</span>
      <a href="collection.html">${n}/3</a>
      <div class="crans" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < n ? "is-fait" : ""}"></i>`).join("")}</div>`;
  }

  /* ---------- Vue « Voter » ---------- */
  function visuel(x) {
    if (etat.cat === "stands") {
      return `<span class="carte-cdc__visuel carte-cdc__visuel--stand">${icon(x.type === "foodtruck" ? "couverts" : "billet")}</span>`;
    }
    if (!x.votable) return `<span class="carte-cdc__visuel">${icon("cadenas")}</span>`;
    const av = avatars.length ? avatars[hash(x.id) % avatars.length] : { motif: "rayures", fond: "bleu", encre: "sodium" };
    return `<span class="carte-cdc__visuel pochette--${esc(av.motif)}" style="--fond:var(--${av.fond});--encre:var(--${av.encre});background-color:var(--fond)"></span>`;
  }

  function carte(x) {
    const d = etat.d;
    const plein = d.mesVotes[etat.cat].length >= d.coeurs;
    const desactive = d.cloture.passee || (!x.vote && !x.votable);
    const meta = (etat.cat === "artistes"
      ? [x.genre, x.scene && x.scene.nom, x.vu ? "vu" : null]
      : [x.type === "foodtruck" ? "Food-truck" : "Stand", x.zone]).filter(Boolean).map(esc).join(", ");
    const libelle = x.vote ? `Retirer mon cœur à ${x.nom}` : `Donner un cœur à ${x.nom}`;
    return `
      <li class="carte-cdc${x.vote ? " is-vote" : ""}${x.votable || x.vote ? "" : " is-bloque"}" id="${esc(x.id)}">
        ${visuel(x)}
        <span class="carte-cdc__txt">
          <span class="carte-cdc__nom">${esc(x.nom)}</span>
          <span class="carte-cdc__meta">${meta}</span>
          ${!x.votable && !x.vote ? `<span class="carte-cdc__raison">${icon(etat.cat === "stands" ? "qr" : "horloge")}${esc(x.raison)}</span>` : ""}
          ${x.votable && !x.vote && plein && !d.cloture.passee ? `<span class="carte-cdc__raison">Retire un cœur pour voter ici</span>` : ""}
        </span>
        <button class="btn-coeur" type="button" aria-pressed="${x.vote}" aria-label="${esc(libelle)}"
          data-voter="${esc(x.id)}" ${desactive ? "disabled" : ""}>${icon("coeur")}</button>
      </li>`;
  }

  function rendreVote() {
    const liste = etat.d[etat.cat];
    if (!liste.length) {
      $("[data-contenu]").innerHTML = `<p>${etat.cat === "stands"
        ? "Les stands n'ont pas encore été ajoutés au jeu. Reviens pendant le festival !"
        : "Le programme n'est pas encore publié : les artistes arrivent bientôt."}</p>`;
      return;
    }
    const votes = liste.filter((x) => x.vote);
    const votables = liste.filter((x) => !x.vote && x.votable).sort((a, b) => (b.vu ? 1 : 0) - (a.vu ? 1 : 0) || a.nom.localeCompare(b.nom));
    const bloques = liste.filter((x) => !x.vote && !x.votable);
    const [un, plusieurs] = NOMS[etat.cat];
    const groupe = (titre, items) => items.length
      ? `<div class="groupe-cdc"><p class="groupe-cdc__titre">${titre}</p><ul class="groupe-cdc" style="margin:0">${items.map(carte).join("")}</ul></div>` : "";
    $("[data-contenu]").innerHTML =
      groupe("Tes coups de cœur", votes) +
      groupe(`Tu peux voter pour ${votables.length} ${votables.length > 1 ? plusieurs : un}`, votables) +
      groupe(etat.cat === "stands" ? "Pas encore visités" : "Pas encore vus sur scène", bloques) +
      (etat.cat === "stands" && bloques.length ? `<p class="lien-cdc"><a class="lien-fort" href="plan.html">Trouver les stands sur le plan</a></p>` : "");
  }

  /* ---------- Vue « Tendances » ---------- */
  function rendreTendances() {
    const liste = etat.d[etat.cat].filter((x) => x.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, 10);
    const max = liste.length ? liste[0].pct : 1;
    $("[data-contenu]").innerHTML = liste.length ? `
      <ol class="tendances">
        ${liste.map((x, i) => `
          <li class="barre-t" aria-label="${i + 1}e : ${esc(x.nom)}, ${x.pct} % des votes${x.vote ? ", ton coup de cœur" : ""}">
            <span class="barre-t__fond" data-largeur="${Math.round((x.pct / max) * 100)}"></span>
            <span class="barre-t__rang">${i + 1}</span>
            <span class="barre-t__nom">${esc(x.nom)} ${x.vote ? icon("coeur", "icon--plein") : ""}</span>
            <span class="barre-t__pct">${String(x.pct).replace(".", ",")} %</span>
          </li>`).join("")}
      </ol>
      <p class="tendances__note">Part des cœurs reçus, relue à l'ouverture de la page. ${etat.d.cloture.passee ? "Résultats définitifs." : "Les résultats peuvent encore changer."}</p>`
      : `<p>Pas encore de votes dans cette catégorie.</p>`;
    requestAnimationFrame(() => $$("[data-largeur]").forEach((b) => (b.style.width = `${b.dataset.largeur}%`)));
  }

  /* ---------- Vote ---------- */
  function eclats(depuis) {
    if (App.reduceMotion) return;
    const r = depuis.getBoundingClientRect();
    const zone = $("[data-eclats]");
    zone.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return `<span class="eclat" style="left:${r.left + r.width / 2 - 9}px;top:${r.top + r.height / 2 - 9}px;--dx:${Math.cos(a) * 60}px;--dy:${Math.sin(a) * 60}px;--rot:${i * 45}deg">${icon("coeur")}</span>`;
    }).join("");
    setTimeout(() => (zone.innerHTML = ""), 900);
  }

  const ERREURS = {
    "plus-de-coeurs": "Tu n'as plus de cœur : retire-en un d'abord.",
    cloture: "Les votes sont clos.",
    introuvable: "Élément introuvable."
  };

  $("[data-contenu]").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-voter]");
    if (!b || b.getAttribute("aria-busy") === "true") return;
    const id = b.dataset.voter;
    const actif = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-busy", "true");
    const utilisesAvant = etat.d.mesVotes[etat.cat].length;
    try {
      const res = await api.voter({ categorie: etat.cat, id, actif });
      if (!res.ok) {
        App.toast(res.raison || ERREURS[res.erreur] || "Vote impossible.");
        b.removeAttribute("aria-busy");
        return;
      }
      if (actif) {
        eclats(b);
        if (navigator.vibrate) navigator.vibrate(40);
      }
      // Le cœur qui part (ou revient) dans la réserve s'anime
      etat.anime = etat.d.coeurs - (actif ? utilisesAvant : utilisesAvant - 1) - 1;
      await charger();
      const nouveau = $(`[data-voter="${CSS.escape(id)}"]`);
      if (nouveau) { nouveau.focus({ preventScroll: true }); nouveau.classList.add("is-anime"); }
      if (res.mission && res.mission.terminee) App.toast(`Mission ${res.mission.titre} terminée : +${res.mission.xp} XP et ${res.mission.jetons} jetons\u00A0!`);
      else if (res.quetes && res.quetes.length) App.toast(`Mission ${res.quetes[0]} terminée ! +${res.gain} XP`);
      else if (res.badge) App.toast(`Nouveau badge : ${res.badge}.`);
      else if (res.gain > 0) App.toast(`Cœur donné ! +${res.gain} XP`);
      else App.toast(actif ? "Cœur donné\u00A0!" : "Cœur repris.");
    } catch (e) {
      console.error(e);
      App.toast("Le vote n'a pas été enregistré. Réessaie.");
      b.removeAttribute("aria-busy");
    }
  });

  /* ---------- Onglets, vue ---------- */
  const onglets = $$("[data-cat]");
  function choisir(cat, focus = false) {
    etat.cat = cat;
    onglets.forEach((o) => {
      const actif = o.dataset.cat === cat;
      o.setAttribute("aria-selected", String(actif));
      o.tabIndex = actif ? 0 : -1;
      if (actif && focus) o.focus();
    });
    $("[data-panneau]").setAttribute("aria-labelledby", `onglet-${cat}`);
    if (etat.d) rendre();
  }
  $("[data-onglets]").addEventListener("click", (e) => { const o = e.target.closest("[data-cat]"); if (o) choisir(o.dataset.cat); });
  $("[data-onglets]").addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) choisir(etat.cat === "artistes" ? "stands" : "artistes", true);
  });
  $(".vue-cdc").addEventListener("change", (e) => { etat.vue = e.target.value; rendre(); });

  /* ---------- Lien direct : coups-de-coeur.html#st-kora ou #a5 ---------- */
  await charger();
  const cible = decodeURIComponent(location.hash.slice(1));
  if (cible) {
    const cat = etat.d.stands.some((x) => x.id === cible) ? "stands" : etat.d.artistes.some((x) => x.id === cible) ? "artistes" : null;
    if (cat) {
      choisir(cat);
      const el = document.getElementById(cible);
      if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("is-cible"); }
    }
  }
});
