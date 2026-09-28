/* ==========================================================================
   Page 6 — Mon programme : favoris, conflits, trajets, rappels, agenda
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "programme" })) return;
  const { $, $$, esc, icon, api, session } = App;

  const HEURE = (ms) => App.heureFestival(new Date(ms));
  const etat = { d: null, dernierRetire: null, minuteursRappel: [], minuteurAnnuler: null };
  let festival = {};
  try { festival = await App.data.get("festival"); } catch (e) { /* libellés simples */ }

  /* ======================================================================
     Chargement et rendu
     ====================================================================== */
  async function charger() {
    try {
      etat.d = await api.monProgramme();
      if (!etat.d) { location.replace("inscription.html"); return; }
      rendre();
      programmerRappels();
    } catch (e) {
      console.error(e);
      App.toast("Impossible de charger ton programme.");
    }
  }

  function rendre() {
    const d = etat.d;
    const aVenir = d.favoris.filter((a) => a.statut !== "termine");
    const passes = d.favoris.filter((a) => a.statut === "termine");
    rendreResume(aVenir);
    $("[data-bloc-rappels]").hidden = !aVenir.length;
    rendreRappels();
    rendreSuggestions();

    if (!d.favoris.length) {
      $("[data-contenu]").innerHTML = `
        <div class="vide-mp">
          <p class="affiche vide-mp__titre">Ton programme est vide</p>
          <p>Ajoute des concerts avec l'étoile du programme : on te préviendra avant chaque concert et on repérera les conflits d'horaires.</p>
          <a class="btn btn--sodium" href="programme.html">${icon("calendrier")} Voir le programme</a>
        </div>`;
      return;
    }

    const parJour = d.jours.map((j) => ({ jour: j, liste: aVenir.filter((a) => a.jour === j.id) })).filter((x) => x.liste.length);
    let html = parJour.map(({ jour, liste }) => `
      <section class="jour-mp" aria-labelledby="jour-${jour.id}">
        <h2 class="affiche jour-mp__titre" id="jour-${jour.id}">${esc(jour.long)}
          <small>${jour.id === d.ceSoir ? "Aujourd'hui, " : ""}${liste.length} concert${liste.length > 1 ? "s" : ""}</small></h2>
        <ol class="frise">${frise(liste)}</ol>
      </section>`).join("");

    if (!aVenir.length) {
      html += `<div class="vide-mp"><p class="affiche vide-mp__titre">Tous tes concerts sont passés</p>
        <p>Il reste peut-être de belles surprises au programme.</p>
        <a class="btn btn--sodium" href="programme.html">Voir le programme</a></div>`;
    }
    if (passes.length) {
      html += `
        <details class="passes-mp">
          <summary>Déjà passés (${passes.length})</summary>
          <ul>${passes.map((a) => `<li><span>${esc(a.nom)}${a.vu ? ` ${icon("valide")}` : ""}</span><span class="texte-doux">${esc(d.jours.find((j) => j.id === a.jour).court)}, ${HEURE(a.debutMs)}</span></li>`).join("")}</ul>
          <p class="texte-doux" style="margin-top:.5rem;font-size:.875rem"><a href="coups-de-coeur.html">Donne ton coup de cœur</a> à ceux que tu as aimés.</p>
        </details>`;
    }
    $("[data-contenu]").innerHTML = html;
  }

  function rendreResume(aVenir) {
    const d = etat.d;
    const enCours = aVenir.find((a) => a.statut === "en-cours");
    const prochain = aVenir.find((a) => a.statut === "a-venir");
    const conflitsOuverts = d.conflits.filter((c) => !c.accepte && c.ids.some((id) => aVenir.some((a) => a.id === id)));
    const serres = d.trajets.filter((t) => t.retard > 0 && aVenir.some((a) => a.id === t.vers));
    let tete;
    if (enCours) {
      tete = `<p class="resume-mp__lib">En ce moment</p><p class="affiche resume-mp__nom">${esc(enCours.nom)}</p>
        <p class="resume-mp__detail">${esc(enCours.scene.nom)}, jusqu'à ${HEURE(enCours.finMs)}</p>`;
    } else if (prochain) {
      tete = `<p class="resume-mp__lib">Prochain concert, dans ${App.duree(prochain.debutMs - d.maintenant)}</p>
        <p class="affiche resume-mp__nom">${esc(prochain.nom)}</p>
        <p class="resume-mp__detail">${esc(prochain.scene.nom)}, ${HEURE(prochain.debutMs)}. <a href="plan.html?lieu=${encodeURIComponent(prochain.scene.id)}">Y aller</a></p>`;
    } else {
      tete = `<p class="resume-mp__lib">Mon programme</p><p class="affiche resume-mp__nom">Rien de prévu</p>`;
    }
    $("[data-resume]").innerHTML = `${tete}
      <p class="resume-mp__compte">
        <span>${aVenir.length} concert${aVenir.length > 1 ? "s" : ""} à venir</span>
        ${conflitsOuverts.length ? `<span class="is-alerte">${conflitsOuverts.length} conflit${conflitsOuverts.length > 1 ? "s" : ""} à régler</span>` : ""}
        ${serres.length ? `<span class="is-alerte">${serres.length} trajet${serres.length > 1 ? "s" : ""} serré${serres.length > 1 ? "s" : ""}</span>` : ""}
      </p>`;
  }

  function carte(a) {
    const d = etat.d;
    const statut = a.statut === "en-cours" ? `<span class="statut-mp--en-cours">En ce moment</span>` : `<span>dans ${App.duree(a.debutMs - d.maintenant)}</span>`;
    return `
      <div class="carte-mp sc-${a.scene.couleur} is-${a.statut}">
        <a class="carte-mp__lien" href="programme.html#${encodeURIComponent(a.artisteId)}">
          <span class="carte-mp__nom">${esc(a.nom)}</span>
          <span class="carte-mp__meta"><span class="pastille pastille-sc">${esc(a.scene.nom)}</span><span>${esc(a.genre)}</span>${statut}</span>
        </a>
        <button class="icone-mp" type="button" aria-pressed="${a.rappel}" data-rappel="${esc(a.id)}" ${d.rappels.actif ? "" : "disabled"}
          aria-label="${a.rappel ? "Désactiver" : "Activer"} le rappel pour ${esc(a.nom)}">${icon("cloche")}</button>
        <button class="icone-mp icone-mp--retirer" type="button" data-retirer="${esc(a.id)}" aria-label="Retirer ${esc(a.nom)} de mon programme">${icon("fermer")}</button>
      </div>`;
  }

  const etape = (a) => `
    <li class="etape-mp sc-${a.scene.couleur}">
      <span class="etape-mp__heure"><strong>${HEURE(a.debutMs)}</strong><span>${HEURE(a.finMs)}</span></span>
      ${carte(a)}
    </li>`;

  function frise(liste) {
    const d = etat.d;
    const faits = new Set();
    let html = "";
    liste.forEach((a) => {
      if (faits.has(a.id)) return;
      const conflit = d.conflits.find((c) => c.ids.includes(a.id));
      if (conflit) {
        const membres = liste.filter((x) => conflit.ids.includes(x.id));
        membres.forEach((x) => faits.add(x.id));
        html += blocConflit(conflit, membres);
      } else {
        faits.add(a.id);
        html += etape(a);
      }
      const dernier = conflit ? liste.filter((x) => conflit.ids.includes(x.id)).pop() : a;
      const t = d.trajets.find((x) => x.de === dernier.id);
      if (t) html += trajet(t);
    });
    return html;
  }

  function trajet(t) {
    const serre = t.retard > 0;
    // marche = null : scènes pas encore placées sur le plan, on ne devine pas
    const texte = serre
      ? `${t.marche} min à pied pour ${t.marge} min de battement : tu arriveras environ ${t.retard} min après le début.`
      : t.marche == null ? `Changement de scène, ${t.marge} min de battement.`
      : `${t.marche ? `${t.marche} min à pied` : "Même scène"}, ${t.marge} min de battement.`;
    return `<li class="trajet-mp${serre ? " is-serre" : ""}" aria-label="Trajet : ${esc(texte)}">
      <span></span><span class="trajet-mp__txt">${icon(serre ? "alerte" : "plan")} ${esc(texte)}</span></li>`;
  }

  function blocConflit(c, membres) {
    const plan = c.plan;
    const duo = membres.map((a) => `
      <div class="duo-mp sc-${a.scene.couleur}">
        <strong>${esc(a.nom)}</strong>
        <span>${HEURE(a.debutMs)} à ${HEURE(a.finMs)}</span>
        <span>${esc(a.scene.nom)}</span>
      </div>`).join("");
    if (c.accepte) {
      return `
        <li class="conflit-mp is-accepte" id="conflit-${esc(c.cle)}">
          <p class="conflit-mp__tete">${icon("valide")} Tu fais les deux</p>
          <div class="conflit-mp__duo">${duo}</div>
          <p class="conflit-mp__plan">${plan.marche == null
            ? `Quitte ${esc(plan.quitter.nom)} un peu avant ${HEURE(plan.rejoindre.debutMs)} pour rejoindre ${esc(plan.rejoindre.nom)} (${esc(plan.rejoindre.scene.nom)}).`
            : `Quitte ${esc(plan.quitter.nom)} vers ${HEURE(plan.departMs)} : ${plan.marche} min à pied jusqu'à ${esc(plan.rejoindre.scene.nom)} pour ${esc(plan.rejoindre.nom)} à ${HEURE(plan.rejoindre.debutMs)}.`}</p>
          <button class="lien-fort" type="button" data-conflit="${esc(c.cle)}" data-garder="revoir">Revoir mon choix</button>
        </li>`;
    }
    return `
      <li class="conflit-mp" id="conflit-${esc(c.cle)}">
        <p class="conflit-mp__tete">${icon("alerte")} Conflit : ${c.communMin} min en commun</p>
        <div class="conflit-mp__duo">${duo}</div>
        <div class="conflit-mp__choix">
          ${membres.map((a) => `<button class="btn btn--contour" type="button" data-conflit="${esc(c.cle)}" data-garder="${esc(a.id)}">Garder ${esc(a.nom)}</button>`).join("")}
          <button class="btn btn--nuit conflit-mp__deux" type="button" data-conflit="${esc(c.cle)}" data-garder="tous">Je fais les deux</button>
        </div>
      </li>`;
  }

  /* ---------- Suggestions ---------- */
  function rendreSuggestions() {
    const s = etat.d.suggestions;
    $("[data-bloc-sugg]").hidden = !s.length;
    $("[data-suggestions]").innerHTML = s.map((a) => `
      <li class="sc-${a.scene.couleur}">
        <a href="programme.html#${encodeURIComponent(a.artisteId)}" style="text-decoration:none">
          <strong>${esc(a.nom)}</strong>
          <span>${esc(etat.d.jours.find((j) => j.id === a.jour).court)}, ${HEURE(a.debutMs)}, ${esc(a.scene.nom)}</span>
          <span class="raison">${esc(a.raison)}</span>
        </a>
        <button class="btn btn--sodium btn--sm" type="button" data-ajouter="${esc(a.id)}" aria-label="Ajouter ${esc(a.nom)}">${icon("etoile")}</button>
      </li>`).join("");
  }

  /* ======================================================================
     Rappels
     ====================================================================== */
  function rendreRappels() {
    const r = etat.d.rappels;
    $("[data-rappels-actif]").checked = r.actif;
    $$("input[name=avance]").forEach((i) => { i.checked = Number(i.value) === r.avance; i.disabled = !r.actif; });
    const zone = $("[data-notif]");
    if (!r.actif) { zone.innerHTML = ""; return; }
    if (!("Notification" in window)) {
      zone.innerHTML = `${icon("info")} Ce navigateur n'affiche pas de notifications : le rappel apparaîtra dans la page.`;
    } else if (Notification.permission === "granted") {
      zone.innerHTML = `${icon("valide")} Notifications autorisées.`;
    } else if (Notification.permission === "denied") {
      zone.innerHTML = `${icon("alerte")} Notifications bloquées dans les réglages du navigateur. Le rappel apparaîtra dans la page, ou utilise l'agenda.`;
    } else {
      zone.innerHTML = `<button class="btn btn--contour btn--sm" type="button" data-autoriser>${icon("cloche")} Autoriser les notifications</button>`;
    }
  }

  function programmerRappels() {
    etat.minuteursRappel.forEach(clearTimeout);
    etat.minuteursRappel = [];
    const d = etat.d;
    if (!d.rappels.actif) return;
    const maintenant = App.maintenant().getTime();
    d.favoris.filter((a) => a.rappel && a.statut === "a-venir").forEach((a) => {
      const delai = a.debutMs - d.rappels.avance * 60000 - maintenant;
      if (delai < 0 || delai > 12 * 3600000) return;
      etat.minuteursRappel.push(setTimeout(() => rappeler(a), delai));
    });
  }

  function rappeler(a) {
    const titre = `${a.nom} dans ${etat.d.rappels.avance} min`;
    const corps = `${a.scene.nom}, ${HEURE(a.debutMs)}. Pense à scanner le QR de la scène !`;
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try { new Notification(titre, { body: corps, tag: `rappel-${a.id}` }); return; } catch (e) { /* repli */ }
    }
    App.toast(`${titre}. ${corps}`, { duree: 8000 });
  }

  /* ---------- Agenda (.ics) ---------- */
  function exporterAgenda() {
    const d = etat.d;
    const aVenir = d.favoris.filter((a) => a.statut !== "termine");
    if (!aVenir.length) return;
    const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const echap = (t) => String(t).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
    const lieu = festival.lieu || "VIMAS FEST 2026";
    const lignes = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vimas Quest//Mon programme//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:VIMAS FEST, mon programme"
    ];
    aVenir.forEach((a) => {
      lignes.push(
        "BEGIN:VEVENT",
        `UID:${a.id}-${session.get().id}@vimasquest.example`,
        `DTSTAMP:${utc(Date.now())}`,
        `DTSTART:${utc(a.debutMs)}`,
        `DTEND:${utc(a.finMs)}`,
        `SUMMARY:${echap(`${a.nom} (${a.scene.nom})`)}`,
        `LOCATION:${echap(`${a.scene.nom}, ${lieu}`)}`,
        `DESCRIPTION:${echap(`${a.genre}. Scanne le QR de la scène pendant le concert pour gagner des XP.`)}`,
        `URL:https://vimasquest.example/programme.html#${a.artisteId}`
      );
      if (d.rappels.actif) {
        lignes.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${d.rappels.avance}M`, `DESCRIPTION:${echap(`${a.nom} commence bientôt`)}`, "END:VALARM");
      }
      lignes.push("END:VEVENT");
    });
    lignes.push("END:VCALENDAR");
    const blob = new Blob([lignes.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = "vimasquest-mon-programme.ics";
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    App.toast(`${aVenir.length} concert${aVenir.length > 1 ? "s" : ""} prêt${aVenir.length > 1 ? "s" : ""} pour ton agenda.`);
  }

  /* ======================================================================
     Interactions
     ====================================================================== */
  function proposerAnnulation(a) {
    etat.dernierRetire = a.id;
    $("[data-annuler-txt]").textContent = `${a.nom} retiré de ton programme.`;
    $("[data-annuler]").hidden = false;
    clearTimeout(etat.minuteurAnnuler);
    etat.minuteurAnnuler = setTimeout(() => { $("[data-annuler]").hidden = true; etat.dernierRetire = null; }, 7000);
  }

  /* Un bouton qui appelle la base se verrouille pendant l'appel ; un échec
     affiche la raison et relit l'état (sans requête si rien n'a changé). */
  async function agir(bouton, action) {
    if (bouton && bouton.getAttribute("aria-busy") === "true") return null;
    bouton?.setAttribute("aria-busy", "true");
    try {
      const res = await action();
      if (res && res.ok === false) { App.toast(res.raison || "Impossible de modifier ton programme."); await charger(); return null; }
      return res;
    } finally { bouton?.removeAttribute("aria-busy"); }
  }

  document.addEventListener("click", async (e) => {
    const retirer = e.target.closest("[data-retirer]");
    if (retirer) {
      const a = etat.d.favoris.find((x) => x.id === retirer.dataset.retirer);
      if (!(await agir(retirer, () => api.basculerFavori(a.id)))) return;
      await charger();
      proposerAnnulation(a);
      return;
    }
    const annuler = e.target.closest("[data-annuler-btn]");
    if (annuler) {
      if (!etat.dernierRetire) return;
      if (!(await agir(annuler, () => api.basculerFavori(etat.dernierRetire)))) return;
      etat.dernierRetire = null;
      $("[data-annuler]").hidden = true;
      await charger();
      App.toast("Concert remis dans ton programme.");
      return;
    }
    const ajouter = e.target.closest("[data-ajouter]");
    if (ajouter) {
      if (!(await agir(ajouter, () => api.basculerFavori(ajouter.dataset.ajouter)))) return;
      await charger();
      App.toast("Ajouté à ton programme.");
      return;
    }
    const rappel = e.target.closest("[data-rappel]");
    if (rappel) {
      const id = rappel.dataset.rappel;
      const a = etat.d.favoris.find((x) => x.id === id);
      if (!(await agir(rappel, () => api.basculerRappel(id, !a.rappel)))) return;
      await charger();
      $(`[data-rappel="${CSS.escape(id)}"]`)?.focus();
      return;
    }
    const conflit = e.target.closest("[data-conflit]");
    if (conflit) {
      const garder = conflit.dataset.garder;
      if (!(await agir(conflit, () => api.resoudreConflit({ cle: conflit.dataset.conflit, garder })))) return;
      await charger();
      if (garder === "tous") App.toast("C'est noté : on t'indique quand partir.");
      else if (garder !== "revoir") App.toast("Conflit réglé.");
      return;
    }
    if (e.target.closest("[data-autoriser]")) {
      try { await Notification.requestPermission(); } catch (err) { /* ignoré */ }
      rendreRappels();
      return;
    }
    if (e.target.closest("[data-agenda]")) exporterAgenda();
  });

  // Réglages des rappels : sur le téléphone, aucune requête
  $("[data-rappels-actif]").addEventListener("change", async (e) => {
    await api.reglerRappels({ actif: e.target.checked });
    await charger();
  });
  $("[data-avance]").addEventListener("change", async (e) => {
    await api.reglerRappels({ avance: Number(e.target.value) });
    await charger();
  });

  await charger();
  // Statuts et rappels remis à jour chaque minute. Programme et favoris viennent
  // du cache : au plus une relecture de chacun toutes les 5 minutes.
  App.sonder(charger, { toutesLes: 60000, immediat: false });
});
