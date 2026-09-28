/* ==========================================================================
   Page 3 — Tableau de bord / carte du festivalier
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  /* player_home renvoie déjà le statut du joueur : pas de surveillance séparée */
  if (!App.initJoueur({ actif: "carte", surveiller: false })) return;
  const { $, $$, esc, icon, fmt, api } = App;

  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  let statique;
  try {
    // Configuration du site uniquement (aucune requête) : le reste vient de api.carte()
    const cles = ["festival", "rangs", "avatars", "blindTest"];
    const vals = await Promise.all(cles.map(App.data.get));
    statique = Object.fromEntries(cles.map((c, i) => [c, vals[i]]));
  } catch (e) {
    App.toast("Impossible de charger ta carte. Vérifie ta connexion.");
    return;
  }
  const avatarParId = Object.fromEntries(statique.avatars.map((a) => [a.id, a]));

  /* ----------------------------------------------------------------------
     UN appel (api.carte = player_home en mode serveur), puis toutes les 30 s
     écran allumé seulement (App.sonder). Voir data/PERFORMANCE.md.
     ---------------------------------------------------------------------- */
  let echecs = 0;
  async function charger() {
    let carte;
    try {
      carte = await api.carte();
    } catch (e) {
      console.error(e);
      // Un seul message, pas un toutes les 30 s pendant une coupure
      if (echecs++ === 0) App.toast(App.messageErreur ? App.messageErreur(e) : "La mise à jour a échoué.");
      throw e;   // App.sonder espace alors les essais
    }
    echecs = 0;
    if (!carte) { window.location.replace("inscription.html"); return; }
    rendrePass(carte);
    rendreAlerte(carte);
    rendreCollecte(carte);
    rendreConcert(carte);
    rendreMissions(carte);
    rendreSoir(carte);
    rendreJournee(carte);
    $("[data-maj]").textContent = carte.horsLigne
      ? `Hors ligne : carte de ${App.heureFestival(new Date(carte.horsLigne))}`
      : `Mis à jour à ${App.heureFestival()}`;
  }

  /* ---------- Pass ---------- */
  function rendrePass({ joueur, classement, badges, pass: ticket }) {
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
    $("[data-pass-manquant]").hidden = ticket.actif;
    if (!ticket.actif && ticket.prix) {
      $("[data-pass-manquant-txt]").textContent =
        `Prends un ticket (${fmt.nombre(ticket.prix)} FCFA) auprès de l'équipe, puis scanne son QR code.`;
    }

    const haut = $("[data-jetons-haut]");
    haut.hidden = false;
    haut.innerHTML = `<span class="jeton" aria-hidden="true"></span><span class="chiffres">${joueur.jetons}</span><span class="sr-only"> jetons</span>`;
  }

  /* ---------- Collecte (6.3 bis) ----------
     Un coffre resté fermé passe avant tout ; sinon la fiche incomplète, puis
     le numéro (19 ans et plus) pour le tirage final. Aucune requête en plus :
     tout vient de la carte. */
  function rendreCollecte({ coffre, fiche }) {
    const bCoffre = $("[data-rappel-coffre]");
    bCoffre.hidden = !coffre;
    if (coffre) {
      $("[data-rappel-coffre-titre]").textContent =
        `Un coffre t'attend : +${fmt.nombre(coffre.xp)} XP`;
    }
    const bFiche = $("[data-rappel-fiche]");
    const manque = fiche ? fiche.total - fiche.faits : 0;
    const tel = fiche && !fiche.telephone && fiche.majeur;
    bFiche.hidden = !!coffre || !fiche || (!manque && !tel);
    if (bFiche.hidden) return;
    if (manque) {
      $("[data-rappel-fiche-titre]").textContent = `Complète ta carte : +${fmt.nombre(manque * fiche.xpParReponse + fiche.bonusComplet)} XP`;
      $("[data-rappel-fiche-txt]").textContent = manque > 1 ? `${manque} questions, un tapotement chacune.` : "Une seule question, un tapotement.";
    } else {
      $("[data-rappel-fiche-titre]").textContent = "Tu n'es pas inscrit au tirage final";
      $("[data-rappel-fiche-txt]").textContent = "Laisse ton numéro : on t'appelle si tu gagnes, et un tour de roue t'est offert.";
    }
  }

  /* ---------- Alerte urgente ---------- */
  function rendreAlerte({ annonce }) {
    const urgente = annonce && !App.annoncesLues.get().has(annonce.id) ? annonce : null;
    const bloc = $("[data-alerte]");
    bloc.hidden = !urgente;
    if (!urgente) return;
    $("[data-alerte-titre]").textContent = urgente.titre;
    $("[data-alerte-texte]").textContent = urgente.texte;
  }

  /* ---------- Prochain concert ---------- */
  function rendreConcert({ concert: choix }) {
    const maintenant = App.maintenant().getTime();
    const zone = $("[data-concert]");

    if (!choix) {
      $("[data-concert-titre]").textContent = "Prochain concert";
      // Avant l'ouverture, le programme n'est peut-être pas encore publié
      const avant = App.maintenant() < new Date(statique.festival.ouverture);
      zone.innerHTML = `<p class="concert-carte__vide">${avant
        ? `Le programme arrive bientôt. Rendez-vous le ${esc(statique.festival.dates)}.`
        : "Plus aucun concert au programme. Merci d'avoir joué avec nous !"}</p>`;
      return;
    }

    const enCours = choix.debutMs <= maintenant;
    const scene = choix.scene;
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
      <div class="concert-carte__corps">
        ${App.photo(choix)}
        <div>
          <p class="concert-carte__nom affiche">${esc(choix.nom)}</p>
          <p class="concert-carte__detail">
            <span class="pastille pastille--${esc(scene.couleur)}">${esc(scene.nom)}</span>
            <span class="chiffres">${App.heureFestival(new Date(choix.debutMs))}</span>
            ${choix.genre ? `<span>${esc(choix.genre)}</span>` : ""}
          </p>
        </div>
      </div>
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
      zone.innerHTML = `<p>Aucune mission en cours. De nouvelles arrivent chaque jour du festival.</p>`;
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
            ${m.jetons ? `<span class="pastille">${m.jetons} jeton${m.jetons > 1 ? "s" : ""}</span>` : ""}
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
  function rendreSoir({ joueur, roue }) {
    const bt = statique.blindTest;
    const maintenant = App.maintenant();
    const debut = App.dateFestival(App.jourFestival(maintenant), bt.horaire);
    const ecart = debut - maintenant;
    $("[data-blind]").textContent =
      ecart > 0 ? `Dans ${App.duree(ecart)}, écran géant`
      : ecart > -30 * 60000 ? "En direct, rejoins la partie"
      : "Terminé, prochaine manche demain";

    const cout = roue.cout;
    const tirages = Math.floor(joueur.jetons / cout);
    $("[data-roue]").textContent = tirages > 0
      ? `${tirages} tirage${tirages > 1 ? "s" : ""} possible${tirages > 1 ? "s" : ""}`
      : `Encore ${cout - joueur.jetons} jeton${cout - joueur.jetons > 1 ? "s" : ""} pour un tirage`;
  }

  /* ---------- Journée ---------- */
  function rendreJournee({ jour, classement, activite, roi }) {
    const r = $("[data-roi]");
    r.hidden = !roi;
    if (roi) {
      r.innerHTML = `${icon("trophee")}<span>Roi de ${esc(roi.jour)} : <strong>${esc(roi.pseudo)}</strong>, ${fmt.nombre(roi.points)} XP. Détrône-le aujourd'hui !</span>`;
    }

    $("[data-journee]").innerHTML = jour.scans > 0
      ? `Aujourd'hui : <strong class="chiffres">${jour.scans}</strong> scans, <strong class="chiffres">${fmt.nombre(jour.xp)}</strong> XP gagnés, <strong class="chiffres">${fmt.nombre(classement.jour)}e</strong> du jour.`
      : `Ton premier scan t'attend. Commence par le QR d'une scène ou d'un stand.`;

    $("[data-activite]").innerHTML = activite.map((a) => `
      <li data-type="${esc(a.type)}">
        <span class="activite__heure">${a.heure ? esc(fmt.heure(a.heure)) : "À l'instant"}</span>
        <span>${esc(a.texte)}</span>
        <span class="activite__xp chiffres">${a.xp ? `+${a.xp} XP` : ""}</span>
      </li>`).join("");
  }

  App.sonder(charger, { toutesLes: 30000 });
});
