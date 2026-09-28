/* ==========================================================================
   Page 4 — Scanner QR
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "scanner" })) return;
  const { $, $$, esc, icon, fmt, api, session } = App;

  const camera = $("[data-camera]");
  const video = $("[data-video]");
  const resultat = $("[data-resultat]");
  const contenu = $("[data-resultat-contenu]");
  const btnLampe = $("[data-lampe]");
  const btnSon = $("[data-son]");
  const feuilleCode = $("[data-feuille-code]");

  let lecteur = null;
  let occupe = false;
  let lampe = false;
  let typesQR = {}, rangs = [];

  try {
    [typesQR, rangs] = await Promise.all(["typesQR", "rangs"].map(App.data.get));
  } catch (e) { /* les libellés de type seront simplement absents */ }

  if (App.config.demo) $("[data-demo]").hidden = false;
  majJetons(false);

  /* ======================================================================
     Caméra
     ====================================================================== */
  function etatCamera(titre, texte, { relancer = false } = {}) {
    const bloc = $("[data-etat]");
    bloc.hidden = !titre;
    camera.classList.toggle("is-arret", !!titre);
    if (!titre) return;
    $("[data-etat-titre]").textContent = titre;
    $("[data-etat-texte]").textContent = texte;
    $("[data-etat-actions]").hidden = !relancer;
  }

  async function demarrer() {
    if (lecteur) return;
    etatCamera("Ouverture de la caméra", "Autorise l'accès si ton téléphone le demande.");
    try {
      lecteur = await App.lecteurQR.demarrer(video, { onCode: traiter });
      if (document.hidden) { arreter(); return; }
      etatCamera(null);
      btnLampe.hidden = !lecteur.aLampe;
      if (occupe || !resultat.hidden) lecteur.pause();
    } catch (err) {
      lecteur = null;
      const messages = {
        refus: ["Caméra bloquée", "Autorise la caméra dans les réglages du navigateur pour ce site, puis réessaie. Tu peux aussi saisir le code imprimé sous le QR."],
        "non-supporte": ["Scan impossible ici", "Ce navigateur ne permet pas de lire les QR. Saisis le code imprimé sous le QR, ou ouvre la page dans Chrome ou Safari."],
        indisponible: ["Caméra occupée", "Une autre application utilise peut-être la caméra. Ferme-la puis réessaie."]
      };
      const [t, x] = messages[err.code] || messages.indisponible;
      etatCamera(t, x, { relancer: err.code !== "non-supporte" });
    }
  }

  function arreter() {
    if (lecteur) lecteur.arreter();
    lecteur = null;
    lampe = false;
    btnLampe.setAttribute("aria-pressed", "false");
  }

  $("[data-relancer]").addEventListener("click", demarrer);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) arreter();
    else demarrer();
  });
  window.addEventListener("pagehide", arreter);

  btnLampe.addEventListener("click", async () => {
    if (!lecteur) return;
    lampe = !lampe;
    try {
      await lecteur.lampe(lampe);
      btnLampe.setAttribute("aria-pressed", String(lampe));
    } catch (e) { btnLampe.hidden = true; }
  });

  /* ======================================================================
     Son (généré, aucun fichier audio)
     ====================================================================== */
  const CLE_SON = "vimas.son";
  let sonActif = localStorage.getItem(CLE_SON) !== "off";
  let audio = null;

  function majSon() {
    btnSon.setAttribute("aria-pressed", String(sonActif));
    $("[data-son-lib]").textContent = sonActif ? "Son activé" : "Son coupé";
  }
  btnSon.addEventListener("click", () => {
    sonActif = !sonActif;
    try { localStorage.setItem(CLE_SON, sonActif ? "on" : "off"); } catch (e) { /* ignore */ }
    majSon();
    if (sonActif) jouer("ok");
  });
  majSon();

  function jouer(type) {
    if (!sonActif) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const notes = type === "ok" ? [523, 659, 784, 1047] : type === "info" ? [440, 440] : [220, 165];
      notes.forEach((f, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = audio.currentTime + i * 0.09;
        osc.type = type === "ok" ? "triangle" : "square";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch (e) { /* audio indisponible */ }
  }

  /* ======================================================================
     Traitement d'un scan
     ====================================================================== */
  async function traiter(texte) {
    if (occupe) return;
    occupe = true;
    if (lecteur) lecteur.pause();
    camera.classList.add("is-lecture");
    $("[data-lecture]").hidden = false;
    if (navigator.vibrate) navigator.vibrate(40);

    try {
      const res = await api.scanner(texte);
      afficherResultat(res);
    } catch (e) {
      console.error(e);
      afficherResultat({ statut: "reseau" });
    } finally {
      camera.classList.remove("is-lecture");
      $("[data-lecture]").hidden = true;
    }
  }

  $$("[data-simuler]").forEach((b) => b.addEventListener("click", () => traiter(b.dataset.simuler)));

  $("[data-reinitialiser]").addEventListener("click", () => {
    const j = session.get();
    localStorage.removeItem(App.partie.cle(j.id));
    App.toast("Tes scans de démo sont effacés. Les XP déjà gagnés restent sur ta carte.");
  });

  /* ======================================================================
     Écrans de résultat
     ====================================================================== */
  function afficherResultat(res) {
    resultat.className = "resultat";
    const pluie = $("[data-pluie]");
    pluie.innerHTML = "";

    if (res.statut === "ok") {
      resultat.classList.add("resultat--ok");
      contenu.innerHTML = gabaritSucces(res);
      lancerPluie(res);
      jouer("ok");
      if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
      majJetons(true);
    } else {
      const g = gabaritsEchec(res);
      resultat.classList.add(`resultat--${g.ton}`);
      contenu.innerHTML = `
        <span class="resultat__icone">${icon(g.icone)}</span>
        <h2 class="affiche resultat__titre" id="resultat-titre" tabindex="-1">${esc(g.titre)}</h2>
        <p class="resultat__texte">${g.texte}</p>
        <div class="resultat__actions">
          <button class="btn ${g.ton === "attente" ? "btn--sodium" : "btn--nuit"} btn--lg btn--bloc" type="button" data-encore>
            ${icon("qr")} Scanner un autre QR
          </button>
          ${g.lien || ""}
        </div>`;
      jouer(g.ton === "ko" ? "ko" : "info");
      if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
    }

    resultat.hidden = false;
    resultat.scrollTop = 0;
    document.body.style.overflow = "hidden";
    const titre = $("#resultat-titre", resultat);
    if (titre) titre.focus({ preventScroll: true });
  }

  function fermerResultat() {
    resultat.hidden = true;
    document.body.style.overflow = "";
    $("[data-pluie]").innerHTML = "";
    occupe = false;
    if (lecteur) lecteur.reprendre();
    else demarrer();
  }

  resultat.addEventListener("click", (e) => { if (e.target.closest("[data-encore]")) fermerResultat(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !resultat.hidden) fermerResultat(); });

  function gabaritSucces(res) {
    const { qr, gains, detail, missions, badge, rang, joueur } = res;
    const type = typesQR[qr.type] || { nom: "QR", couleur: "papier" };
    const cartes = [];

    if (detail.length > 1) {
      cartes.push(`
        <div class="carte-res">
          <p class="carte-res__lib">Détail des gains</p>
          ${detail.map((d) => `
            <p class="carte-res__ligne carte-res__ligne--gain"><span>${esc(d.libelle)}</span>
            <span class="carte-res__valeur"><strong class="chiffres">+${d.xp} XP</strong>${d.jetons
              ? `<small class="chiffres">+${d.jetons} jeton${d.jetons > 1 ? "s" : ""}</small>` : ""}</span></p>`).join("")}
        </div>`);
    }

    missions.forEach((m) => {
      cartes.push(`
        <div class="carte-res carte-res--mission${m.terminee ? " is-terminee" : ""}">
          <p class="carte-res__lib">${m.terminee ? "Mission terminée" : "Mission en cours"}</p>
          <p class="carte-res__ligne"><span class="carte-res__titre">${esc(m.titre)}</span><strong class="chiffres">${m.fait}/${m.objectif}</strong></p>
          <div class="crans" role="img" aria-label="${m.fait} sur ${m.objectif}">
            ${Array.from({ length: m.objectif }, (_, i) =>
              `<i class="${i < m.fait ? "is-fait" : ""}${i >= m.avant && i < m.fait ? " is-nouveau" : ""}"></i>`).join("")}
          </div>
        </div>`);
    });

    if (res.debloques && res.debloques.length) {
      cartes.push(`
        <a class="carte-res carte-res--collection" href="collection.html">
          <p class="carte-res__lib">Ajouté à ta collection</p>
          ${res.debloques.map((d) => `
            <p class="carte-res__ligne"><span class="carte-res__titre">${esc(d.nom)}</span>
            <span class="pastille ${d.dedicace ? "pastille--sodium" : ""}">${d.type === "artiste" ? (d.dedicace ? "Dédicace" : "Artiste") : "Stand"}</span></p>`).join("")}
        </a>`);
    }

    if (badge) {
      cartes.push(`
        <div class="carte-res badge-res">
          <span class="sticker">${icon("etoile")}</span>
          <div>
            <p class="carte-res__lib">Nouveau badge</p>
            <p class="carte-res__titre">${esc(badge.nom)}</p>
            <p>${esc(badge.texte)}</p>
          </div>
        </div>`);
    }

    if (rang.monte) {
      cartes.push(`
        <div class="rang-res">
          <p class="rang-res__lib">Tu passes au rang</p>
          <p class="rang-res__nom affiche">${esc(rang.apres.nom)}</p>
        </div>`);
    }

    // Progression vers le rang suivant, avec les barres gagnées mises en évidence
    const avant = App.rang(res.avantJoueur.xp, rangs);
    const apres = App.rang(joueur.xp, rangs);
    const nb = 20;
    const pleinesAvant = rang.monte ? 0 : Math.round(avant.progression * nb);
    const pleines = Math.round(apres.progression * nb);
    cartes.push(`
      <div class="carte-res carte-res--progression">
        <p class="carte-res__ligne">
          <span class="carte-res__lib">Total</span>
          <strong class="chiffres">${fmt.nombre(res.avantJoueur.xp)} → ${fmt.nombre(joueur.xp)} XP</strong>
        </p>
        <div class="vumetre" role="img" aria-label="Progression : ${Math.round(apres.progression * 100)} %">
          ${Array.from({ length: nb }, (_, i) => {
            const cls = [i < pleines ? "is-plein" : "", i >= pleinesAvant && i < pleines ? "is-nouveau" : ""].join(" ");
            return `<i class="${cls}" style="--h:${30 + Math.round((i / (nb - 1)) * 70)}%;--k:${i - pleinesAvant}"></i>`;
          }).join("")}
        </div>
        <p>${apres.suivant
          ? `Encore <strong class="chiffres">${fmt.nombre(apres.reste)} XP</strong> pour devenir ${esc(apres.suivant.nom)}.`
          : "Rang maximum atteint."}</p>
      </div>`);

    return `
      <span class="pastille pastille--${type.couleur} resultat__type">${esc(type.nom)}</span>
      <h2 class="affiche resultat__lieu" id="resultat-titre" tabindex="-1">${esc(qr.nom)}</h2>
      <p class="resultat__gain" aria-label="${gains.xp} XP gagnés"><span class="chiffres">+${gains.xp}</span><small>XP</small></p>
      ${gains.jetons > 0
        ? `<p class="resultat__jetons"><span class="jeton" aria-hidden="true"></span>+${gains.jetons} jeton${gains.jetons > 1 ? "s" : ""}</p>`
        : ""}
      <div class="resultat__cartes">${cartes.join("")}</div>
      <div class="resultat__actions">
        <button class="btn btn--sodium btn--lg btn--bloc" type="button" data-encore>${icon("qr")} Scanner encore</button>
        ${qr.type === "cache" || missions.some((m) => m.terminee)
          ? `<a class="btn btn--contour btn--bloc" href="missions.html">Voir mes missions</a>`
          : `<a class="btn btn--contour btn--bloc" href="tableau-de-bord.html">Voir ma carte</a>`}
      </div>`;
  }

  function gabaritsEchec(res) {
    switch (res.statut) {
      case "deja":
        return {
          ton: "info", icone: "horloge", titre: "Déjà scanné aujourd'hui",
          texte: `Tu as scanné <strong>${esc(res.qr.nom)}</strong> à ${esc(fmt.heure(res.heure))}. Ce QR rapportera à nouveau des XP demain.`,
          lien: `<a class="btn btn--contour btn--bloc" href="missions.html">Trouver d'autres QR avec les missions</a>`
        };
      case "inactif":
        return {
          ton: "attente", icone: "horloge", titre: "Pas encore actif",
          texte: `<strong>${esc(res.qr.nom)}</strong> s'active à ${esc(fmt.heure(res.depuis))}. Reviens le scanner à ce moment-là.`
        };
      case "ami":
        return {
          ton: "info", icone: "coeur", titre: "Ami ajouté",
          texte: `<strong>${esc(res.ami.pseudo)}</strong> apparaît maintenant dans ton classement entre amis.`,
          lien: `<a class="btn btn--contour btn--bloc" href="classement.html#amis">Voir le classement des amis</a>`
        };
      case "ami-deja":
        return { ton: "info", icone: "coeur", titre: "Déjà ami", texte: `<strong>${esc(res.ami.pseudo)}</strong> fait déjà partie de tes amis.` };
      case "ami-soi":
        return { ton: "info", icone: "coeur", titre: "C'est ton code", texte: "Fais scanner ce QR par tes amis pour qu'ils t'ajoutent." };
      case "ami-inconnu":
        return { ton: "ko", icone: "alerte", titre: "Code ami inconnu", texte: "Ce code ami ne correspond à aucun joueur." };
      case "billet":
        return {
          ton: "info", icone: "billet", titre: "C'est un billet",
          texte: "Ce QR sert à créer un profil. Pour gagner des XP, scanne les QR affichés sur le site du festival."
        };
      case "reseau":
        return {
          ton: "ko", icone: "alerte", titre: "Réseau saturé",
          texte: "Le scan n'a pas pu être envoyé. Rapproche-toi d'une borne Wi-Fi du festival puis scanne à nouveau."
        };
      case "session":
        return {
          ton: "ko", icone: "alerte", titre: "Session expirée",
          texte: "Reconnecte-toi en scannant ton billet.",
          lien: `<a class="btn btn--contour btn--bloc" href="inscription.html">Scanner mon billet</a>`
        };
      default:
        return {
          ton: "ko", icone: "alerte", titre: "QR inconnu",
          texte: "Ce QR ne fait pas partie du jeu. Cherche le logo Vimas Fest sur les affiches, les stands et les scènes."
        };
    }
  }

  /* Pluie de jetons (un par jeton gagné, 12 max) et confettis pour les QR rares */
  function lancerPluie({ gains, qr, badge, rang }) {
    if (App.reduceMotion) return;
    const pluie = $("[data-pluie]");
    const morceaux = [];
    const nbJetons = Math.min(gains.jetons * 2, 12);
    for (let i = 0; i < nbJetons; i++) {
      morceaux.push(`<i class="p-jeton" style="--x:${5 + Math.random() * 90}%;--r:${0.5 + i * 0.07}s;--d:${1.3 + Math.random() * 0.6}s;--dx:${(Math.random() - 0.5) * 60}px;--rot:${Math.random() > 0.5 ? 360 : -360}deg"></i>`);
    }
    if (qr.type === "cache" || badge || rang.monte) {
      const couleurs = ["var(--sodium)", "var(--rose)", "var(--vert)", "var(--papier)"];
      for (let i = 0; i < 36; i++) {
        morceaux.push(`<i class="p-confetti" style="--x:${Math.random() * 100}%;--c:${couleurs[i % 4]};--r:${0.2 + Math.random() * 0.8}s;--d:${1.8 + Math.random() * 1.2}s;--dx:${(Math.random() - 0.5) * 160}px;--rot:${360 + Math.random() * 720}deg"></i>`);
      }
    }
    pluie.innerHTML = morceaux.join("");
    setTimeout(() => { pluie.innerHTML = ""; }, 3500);
  }

  function majJetons(anime) {
    const j = session.get();
    const el = $("[data-jetons]");
    el.innerHTML = `<span class="jeton" aria-hidden="true"></span><span class="chiffres">${j.jetons}</span><span class="sr-only"> jetons</span>`;
    if (anime) { el.classList.remove("is-gagne"); void el.offsetWidth; el.classList.add("is-gagne"); }
  }

  /* ======================================================================
     Saisie manuelle
     ====================================================================== */
  const champ = $("#code-qr");
  $("[data-ouvrir-code]").addEventListener("click", () => {
    feuilleCode.showModal();
    if (lecteur) lecteur.pause();
    setTimeout(() => champ.focus(), 50);
  });
  const fermerCode = () => { feuilleCode.close(); };
  $("[data-fermer-code]").addEventListener("click", fermerCode);
  feuilleCode.addEventListener("click", (e) => { if (e.target === feuilleCode) fermerCode(); });
  feuilleCode.addEventListener("close", () => { if (lecteur && !occupe) lecteur.reprendre(); });

  champ.addEventListener("input", () => {
    const brut = champ.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    champ.value = brut.length > 3 ? `${brut.slice(0, 3)}-${brut.slice(3)}` : brut;
    $("[data-champ-code]").classList.remove("is-invalide");
  });

  $("[data-form-code]").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!/^[A-Z]{3}-\d{4}$/.test(champ.value)) {
      $("[data-champ-code]").classList.add("is-invalide");
      App.toast("Le code doit avoir la forme ABC-1234.");
      champ.focus();
      return;
    }
    const code = champ.value;
    fermerCode();
    champ.value = "";
    traiter(code);
  });

  /* ---------- Démarrage ---------- */
  demarrer();
});
