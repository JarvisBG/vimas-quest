/* ==========================================================================
   Page 3 — Tableau de bord / carte du festivalier
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "carte" })) return;
  const { $, $$, esc, icon, fmt, api } = App;

  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  let statique;
  try {
    const cles = ["festival", "rangs", "avatars", "artistes", "scenes", "jours", "blindTest", "roue"];
    const vals = await Promise.all(cles.map(App.data.get));
    statique = Object.fromEntries(cles.map((c, i) => [c, vals[i]]));
  } catch (e) {
    App.toast("Impossible de charger ta carte. Vérifie ta connexion.");
    return;
  }
  const sceneParId = Object.fromEntries(statique.scenes.map((s) => [s.id, s]));
  const avatarParId = Object.fromEntries(statique.avatars.map((a) => [a.id, a]));

  /* ---------------------------------------------------------------------- */
  async function charger() {
    try {
      const [carte, annonces] = await Promise.all([api.carte(), api.annonces()]);
      if (!carte) { window.location.replace("inscription.html"); return; }
      rendrePass(carte);
      rendreAlerte(annonces);
      rendreConcert(carte);
      rendreMissions(carte);
      rendreSoir(carte);
      rendreJournee(carte);
      $("[data-maj]").textContent = `Mis à jour à ${App.heureFestival()}`;
    } catch (e) {
      console.error(e);
      App.toast("La mise à jour a échoué. Nouvel essai dans une minute.");
    }
  }

  /* ---------- Pass ---------- */
  function rendrePass({ joueur, classement, badges }) {
    const r = App.rang(joueur.xp, statique.rangs);
    const pass = $("[data-pass]");
    pass.dataset.rang = r.index;

    $("[data-pass-edition]").textContent = `Édition ${statique.festival.edition}`;
    const av = avatarParId[joueur.avatar] || statique.avatars[0];
    const cible = $("[data-pass-avatar]");
    cible.outerHTML = `<span data-pass-avatar>${App.avatar(av, joueur.pseudo, "lg")}</span>`;
    const pseudo = $("[data-pass-pseudo]");
    pseudo.textContent = joueur.pseudo;
    pseudo.classList.toggle("pass__pseudo--long", joueur.pseudo.length > 10);
    $("[data-pass-rang]").textContent = r.actuel.nom;
    $("[data-pass-code]").textContent = joueur.billet || "";

    // Vumètre : 20 barres, hauteur croissante
    const nb = 20, pleines = Math.round(r.progression * nb);
    const vu = $("[data-vumetre]");
    vu.innerHTML = Array.from({ length: nb }, (_, i) =>
      `<i style="--h:${30 + Math.round((i / (nb - 1)) * 70)}%" class="${i < pleines ? "is-plein" : ""}"></i>`).join("");
    const pct = Math.round(r.progression * 100);
    if (r.suivant) {
      vu.setAttribute("aria-label", `Progression vers le rang ${r.suivant.nom} : ${pct} %`);
      $("[data-niveau-txt]").innerHTML =
        `Encore <strong class="chiffres">${fmt.nombre(r.reste)} XP</strong> pour devenir ${esc(r.suivant.nom)}`;
    } else {
      vu.setAttribute("aria-label", "Rang maximum atteint");
      $("[data-niveau-txt]").textContent = "Rang maximum atteint. Reste en tête du classement !";
    }

    $("[data-stat-xp]").textContent = fmt.nombre(joueur.xp);
    $("[data-stat-jetons]").textContent = joueur.jetons;
    $("[data-stat-badges]").textContent = `${badges.obtenus}/${badges.total}`;
    $("[data-stat-classement]").textContent = `${fmt.nombre(classement.general)}e`;

    const haut = $("[data-jetons-haut]");
    haut.hidden = false;
    haut.innerHTML = `<span class="jeton" aria-hidden="true"></span><span class="chiffres">${joueur.jetons}</span><span class="sr-only"> jetons</span>`;
  }

  /* ---------- Alerte urgente ---------- */
  function rendreAlerte(annonces) {
    const urgente = annonces.find((a) => a.niveau === "urgent" && !a.lu && !a.expiree);
    const bloc = $("[data-alerte]");
    bloc.hidden = !urgente;
    if (!urgente) return;
    $("[data-alerte-titre]").textContent = urgente.titre;
    $("[data-alerte-texte]").textContent = urgente.texte;
  }

  /* ---------- Prochain concert ---------- */
  function rendreConcert({ favoris }) {
    const maintenant = App.maintenant().getTime();
    const DUREE = 60 * 60000;
    const concerts = statique.artistes
      .map((a) => ({ ...a, debutMs: App.dateConcert(a, statique.jours).getTime(), favori: favoris.includes(a.id) }))
      .filter((a) => a.debutMs + DUREE > maintenant)
      .sort((a, b) => a.debutMs - b.debutMs);

    const choix = concerts.find((c) => c.favori) || concerts[0];
    const zone = $("[data-concert]");

    if (!choix) {
      $("[data-concert-titre]").textContent = "Prochain concert";
      zone.innerHTML = `<p class="concert-carte__vide">Plus aucun concert au programme. Merci d'avoir joué avec nous !</p>`;
      return;
    }

    const enCours = choix.debutMs <= maintenant;
    const scene = sceneParId[choix.scene];
    $("[data-concert-titre]").textContent = enCours ? "Sur scène maintenant" : "Prochain concert";
    const compte = enCours
      ? `<span class="compte compte--direct">En cours depuis ${App.duree(maintenant - choix.debutMs)}</span>`
      : `<span class="compte">${icon("horloge")} Dans ${App.duree(choix.debutMs - maintenant)}</span>`;

    zone.innerHTML = `
      <div class="concert-carte__haut">
        ${compte}
        ${choix.favori
          ? `<span class="pastille pastille--sodium">${icon("etoile")} Dans ton programme</span>`
          : `<span class="pastille">Suggestion</span>`}
      </div>
      <p class="concert-carte__nom affiche">${esc(choix.nom)}</p>
      <p class="concert-carte__detail">
        <span class="pastille pastille--${scene.couleur}">${esc(scene.nom)}</span>
        <span class="chiffres">${fmt.heure(choix.debut)}</span>
        <span>${esc(choix.genre)}</span>
      </p>
      <div class="concert-carte__actions">
        <a class="lien-fort" href="plan.html?lieu=${encodeURIComponent(scene.id)}">${icon("plan")} Y aller</a>
        <a class="lien-fort" href="programme.html#${encodeURIComponent(choix.id)}">Fiche artiste</a>
      </div>`;
  }

  /* ---------- Missions ---------- */
  function rendreMissions({ missions }) {
    const enCours = missions.filter((m) => m.fait < m.objectif);
    const zone = $("[data-mission-principale]");
    $("[data-missions-lien]").textContent = enCours.length ? `Toutes (${enCours.length})` : "Toutes";

    if (!enCours.length) {
      zone.innerHTML = `<p>Toutes tes missions sont terminées. De nouvelles arrivent chaque jour à 16h.</p>`;
      $("[data-missions-autres]").innerHTML = "";
      return;
    }
    const tri = [...enCours].sort((a, b) => b.fait / b.objectif - a.fait / a.objectif);
    const m = tri[0];
    zone.innerHTML = `
      <a class="mission" href="missions.html#${encodeURIComponent(m.id)}">
        <p class="mission__titre affiche">${esc(m.titre)}</p>
        <p class="mission__texte">${esc(m.texte)}</p>
        <div class="crans" role="img" aria-label="${m.fait} sur ${m.objectif}">
          ${Array.from({ length: m.objectif }, (_, i) => `<i class="${i < m.fait ? "is-fait" : ""}"></i>`).join("")}
        </div>
        <div class="mission__bas">
          <span class="mission__avancee chiffres">${m.fait} / ${m.objectif}</span>
          <span class="recompenses">
            <span class="pastille pastille--sodium">+${m.xp} XP</span>
            <span class="pastille">${m.jetons} jeton${m.jetons > 1 ? "s" : ""}</span>
            ${m.validation === "staff" ? `<span class="pastille pastille--rose">Validée par le staff</span>` : ""}
          </span>
        </div>
      </a>`;

    $("[data-missions-autres]").innerHTML = tri.slice(1, 3).map((x) => `
      <li><a href="missions.html#${encodeURIComponent(x.id)}">
        <span>${esc(x.titre)}</span><small class="chiffres">${x.fait}/${x.objectif}, +${x.xp} XP</small>
      </a></li>`).join("");
  }

  /* ---------- Ce soir ---------- */
  function rendreSoir({ joueur }) {
    const bt = statique.blindTest;
    const maintenant = App.maintenant();
    const debut = App.dateFestival(App.jourFestival(maintenant), bt.horaire);
    const ecart = debut - maintenant;
    $("[data-blind]").textContent =
      ecart > 0 ? `Dans ${App.duree(ecart)}, écran géant`
      : ecart > -30 * 60000 ? "En direct, rejoins la partie"
      : "Terminé, prochaine manche demain";

    const cout = statique.roue.coutTirage;
    const tirages = Math.floor(joueur.jetons / cout);
    $("[data-roue]").textContent = tirages > 0
      ? `${tirages} tirage${tirages > 1 ? "s" : ""} possible${tirages > 1 ? "s" : ""}`
      : `Encore ${cout - joueur.jetons} jeton${cout - joueur.jetons > 1 ? "s" : ""} pour un tirage`;
  }

  /* ---------- Journée ---------- */
  function rendreJournee({ jour, classement, activite }) {
    $("[data-journee]").innerHTML = jour.scans > 0
      ? `Aujourd'hui : <strong class="chiffres">${jour.scans}</strong> scans, <strong class="chiffres">${fmt.nombre(jour.xp)}</strong> XP gagnés, <strong class="chiffres">${fmt.nombre(classement.jour)}e</strong> du jour.`
      : `Ton premier scan t'attend. Commence par le QR de la Grande Scène.`;

    $("[data-activite]").innerHTML = activite.map((a) => `
      <li data-type="${esc(a.type)}">
        <span class="activite__heure">${a.heure ? esc(fmt.heure(a.heure)) : "À l'instant"}</span>
        <span>${esc(a.texte)}</span>
        <span class="activite__xp chiffres">+${a.xp} XP</span>
      </li>`).join("");
  }

  await charger();
  setInterval(charger, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) charger(); });
});
