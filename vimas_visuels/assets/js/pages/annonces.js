/* ==========================================================================
   Page 15 — Annonces (publique)
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, api, session } = App;

  const connecte = session.isLoggedIn();
  if (connecte) {
    App.initJoueur({ actif: "plus" });
    $("[data-retour]").href = "tableau-de-bord.html";
  }
  $("[data-demo]").hidden = !App.config.demo;

  const etat = { liste: [], filtre: "toutes", connus: null, observateur: null };
  const HEURE = (ms) => App.heureFestival(new Date(ms));

  function ilYa(ms) {
    const ecart = App.maintenant().getTime() - ms;
    if (ecart < 60000) return "à l'instant";
    if (ecart < 24 * 3600000) return `il y a ${App.duree(ecart)}`;
    return `le ${new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: App.config.fuseau }).format(new Date(ms))}`;
  }

  /* ======================================================================
     Chargement et rendu
     ====================================================================== */
  async function charger({ signaler = false } = {}) {
    let liste;
    try {
      liste = await api.annonces();
    } catch (e) {
      App.toast("Impossible de charger les annonces.");
      return;
    }
    const nouvelles = etat.connus ? liste.filter((a) => !etat.connus.has(a.id)) : [];
    etat.connus = new Set(liste.map((a) => a.id));
    etat.liste = liste;
    rendre(new Set(nouvelles.map((a) => a.id)));
    if (signaler && nouvelles.length) signalerNouvelles(nouvelles);
  }

  function rendre(nouvelles = new Set()) {
    const actives = etat.liste.filter((a) => !a.expiree);
    const anciennes = etat.liste.filter((a) => a.expiree);
    const nonLues = actives.filter((a) => !a.lu);

    $("[data-resume]").innerHTML = nonLues.length
      ? `<strong class="chiffres">${nonLues.length}</strong> nouvelle${nonLues.length > 1 ? "s" : ""} annonce${nonLues.length > 1 ? "s" : ""}`
      : "Tu es à jour. Les nouvelles annonces apparaîtront ici en direct.";
    $("[data-nb-non-lues]").textContent = nonLues.length || "";
    $("[data-tout-lire]").hidden = nonLues.length === 0;

    // Urgentes encore valables : épinglées en tête
    const epinglees = actives.filter((a) => a.niveau === "urgent");
    const filtre = (a) => {
      switch (etat.filtre) {
        case "non-lues": return !a.lu;
        case "urgent": return a.niveau === "urgent";
        case "horaire": return a.type === "horaire";
        case "surprise": return a.type === "surprise";
        default: return true;
      }
    };
    const epVisibles = epinglees.filter(filtre);
    $("[data-epinglees]").innerHTML = epVisibles.map((a) => `
      <article class="epinglee" id="${esc(a.id)}" data-annonce="${esc(a.id)}" aria-labelledby="t-${esc(a.id)}">
        <div class="epinglee__haut">
          <span class="epinglee__lib">${icon("alerte")} Alerte ${esc(a.typeInfo.nom.toLowerCase())}</span>
          <span class="epinglee__meta">${esc(ilYa(a.dateMs))}, ${HEURE(a.dateMs)}</span>
        </div>
        <h2 class="affiche epinglee__titre" id="t-${esc(a.id)}">${esc(a.titre)}</h2>
        <p class="epinglee__texte">${esc(a.texte)}</p>
        ${a.finMs ? `<p class="epinglee__meta">Valable jusqu'à ${HEURE(a.finMs)}</p>` : ""}
        ${a.lien ? `<a class="btn btn--nuit" href="${esc(a.lien.href)}">${icon("plan")} ${esc(a.lien.libelle)}</a>` : ""}
      </article>`).join("");

    const fil = actives.filter((a) => a.niveau !== "urgent").filter(filtre);
    $("[data-fil]").innerHTML = fil.map((a) => carte(a, nouvelles.has(a.id))).join("");
    $("[data-vide]").hidden = fil.length + epVisibles.length > 0;

    const blocAnciennes = $("[data-anciennes]");
    blocAnciennes.hidden = !anciennes.length || etat.filtre !== "toutes";
    $("[data-nb-anciennes]").textContent = anciennes.length;
    $("[data-fil-anciennes]").innerHTML = anciennes.map((a) => carte(a)).join("");

    observerLecture();
  }

  function carte(a, nouvelle = false) {
    return `
      <li class="annonce ty-${esc(a.type)}${a.lu ? "" : " is-non-lue"}${nouvelle ? " is-nouvelle" : ""}" id="${esc(a.id)}" data-annonce="${esc(a.id)}">
        <span class="annonce__icone" aria-hidden="true">${icon(a.typeInfo.icone)}</span>
        <div class="annonce__corps">
          <p class="annonce__haut">
            ${a.lu ? "" : `<span class="annonce__nouveau">Nouveau</span>`}
            ${a.niveau === "important" ? `<span class="annonce__niveau">Important</span>` : ""}
            <span>${esc(a.typeInfo.nom)}</span>
            <span>${a.expiree ? HEURE(a.dateMs) : `${esc(ilYa(a.dateMs))}, ${HEURE(a.dateMs)}`}</span>
          </p>
          <h2 class="annonce__titre">${esc(a.titre)}</h2>
          <p>${esc(a.texte)}</p>
          ${a.finMs && !a.expiree ? `<p class="annonce__validite">Jusqu'à ${HEURE(a.finMs)}</p>` : ""}
          ${a.lien && !a.expiree ? `<a class="lien-fort annonce__lien" href="${esc(a.lien.href)}">${esc(a.lien.libelle)}</a>` : ""}
        </div>
      </li>`;
  }

  /* ======================================================================
     Lecture : une annonce vue à l'écran pendant 1,5 s est marquée lue
     ====================================================================== */
  const aMarquer = new Set();
  let minuteurLecture = null;
  function observerLecture() {
    if (etat.observateur) etat.observateur.disconnect();
    if (!("IntersectionObserver" in window)) return;
    const minuteurs = new Map();
    etat.observateur = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const id = en.target.dataset.annonce;
        const a = etat.liste.find((x) => x.id === id);
        if (!a || a.lu) return;
        if (en.isIntersecting) {
          minuteurs.set(id, setTimeout(() => { aMarquer.add(id); planifierMarquage(); }, 1500));
        } else {
          clearTimeout(minuteurs.get(id));
        }
      });
    }, { threshold: 0.6 });
    $$("[data-annonce]").forEach((el) => etat.observateur.observe(el));
  }
  function planifierMarquage() {
    clearTimeout(minuteurLecture);
    minuteurLecture = setTimeout(async () => {
      if (!aMarquer.size || document.hidden) return;
      const ids = [...aMarquer];
      aMarquer.clear();
      await api.marquerLues(ids);
      // On garde la pastille « Nouveau » visible jusqu'au prochain rendu, sans faire sauter la page
      ids.forEach((id) => { const a = etat.liste.find((x) => x.id === id); if (a) a.lu = true; });
      $("[data-nb-non-lues]").textContent = etat.liste.filter((a) => !a.lu && !a.expiree).length || "";
    }, 400);
  }

  $("[data-tout-lire]").addEventListener("click", async () => {
    await api.marquerLues(etat.liste.filter((a) => !a.lu).map((a) => a.id));
    await charger();
    App.toast("Toutes les annonces sont marquées comme lues.");
  });

  $("[data-filtres]").addEventListener("change", (e) => {
    etat.filtre = e.target.value;
    rendre();
  });

  /* ======================================================================
     Nouvelles annonces en direct
     ====================================================================== */
  function signalerNouvelles(nouvelles) {
    const urgente = nouvelles.find((a) => a.niveau === "urgent");
    if (navigator.vibrate) navigator.vibrate(urgente ? [200, 100, 200, 100, 200] : [60]);
    const a = urgente || nouvelles[0];
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(a.titre, { body: a.texte, tag: a.id, requireInteraction: !!urgente }); } catch (e) { /* ignore */ }
    } else {
      App.toast(`${urgente ? "Alerte" : "Nouvelle annonce"} : ${a.titre}`);
    }
    if (urgente) window.scrollTo({ top: 0, behavior: App.reduceMotion ? "auto" : "smooth" });
  }

  $("[data-demo]").addEventListener("click", async () => {
    await api.demoNouvelleAnnonce();
    await charger({ signaler: true });
    App.majCompteurAnnonces();
  });

  /* ---------- Notifications ---------- */
  function rendreNotif() {
    const zone = $("[data-notif-etat]");
    if (!("Notification" in window)) {
      zone.textContent = "Ton navigateur n'affiche pas de notifications : garde cette page ouverte pendant les alertes.";
    } else if (Notification.permission === "granted") {
      zone.innerHTML = `${icon("valide")} Notifications autorisées : tu seras prévenu même si le jeu est en arrière-plan.`;
    } else if (Notification.permission === "denied") {
      zone.textContent = "Notifications bloquées dans les réglages du navigateur.";
    } else {
      zone.innerHTML = `<button class="btn btn--contour btn--sm" type="button" data-autoriser>${icon("cloche")} Autoriser les notifications</button>`;
    }
  }
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-autoriser]")) return;
    try { await Notification.requestPermission(); } catch (err) { /* ignore */ }
    rendreNotif();
  });
  rendreNotif();

  /* ---------- Démarrage ---------- */
  await charger();
  const cible = decodeURIComponent(location.hash.slice(1));
  if (cible && document.getElementById(cible)) {
    const el = document.getElementById(cible);
    el.closest("details")?.setAttribute("open", "");
    el.scrollIntoView({ block: "center" });
    el.classList.add("is-cible");
  }
  setInterval(() => { if (!document.hidden) charger({ signaler: true }); }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { charger({ signaler: true }); planifierMarquage(); }
  });
});
