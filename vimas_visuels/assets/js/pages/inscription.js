/* ==========================================================================
   Page 2 — Inscription / connexion par le QR du billet
   Écrans : deja | accueil | camera | code | profil | bienvenue | retour
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api, session } = App;

  const etat = { billet: null, lecteur: null, lampe: false };
  let avatars, genres, mots;
  try {
    [avatars, genres, mots] = await Promise.all(["avatars", "genres", "motsPseudo"].map(App.data.get));
  } catch (e) {
    afficherErreur("Impossible de charger la page. Vérifie ta connexion puis recharge.");
    return;
  }
  const avatarParId = Object.fromEntries(avatars.map((a) => [a.id, a]));

  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));
  if (App.config.demo) $("[data-demo]").hidden = false;

  /* ======================================================================
     Navigation entre écrans (avec prise en charge du bouton retour Android)
     ====================================================================== */
  const ecrans = $$("[data-ecran]");
  let ecranCourant = null;

  function afficher(nom, { historique = true } = {}) {
    if (ecranCourant === "camera" && nom !== "camera") arreterCamera();
    masquerErreur();
    ecrans.forEach((e) => (e.hidden = e.dataset.ecran !== nom));
    const ecran = $(`[data-ecran="${nom}"]`);
    const num = Number(ecran.dataset.etapeNum);
    $$("[data-etape]").forEach((li) => {
      const n = Number(li.dataset.etape);
      li.classList.toggle("is-faite", n < num);
      if (n === num) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    if (historique && ecranCourant) history.pushState({ ecran: nom }, "", "");
    ecranCourant = nom;
    window.scrollTo(0, 0);
    const titre = $("h1", ecran);
    if (titre) titre.focus({ preventScroll: true });
    if (nom === "camera") demarrerCamera();
    if (nom === "code") setTimeout(() => $("#code-billet").focus(), 50);
  }

  window.addEventListener("popstate", (e) => {
    const cible = (e.state && e.state.ecran) || ecranDepart();
    // On ne revient pas sur un écran de fin ni sur le profil une fois créé
    if (["bienvenue", "retour"].includes(ecranCourant)) { history.pushState({ ecran: ecranCourant }, "", ""); return; }
    afficher(cible, { historique: false });
  });

  $("[data-retour]").addEventListener("click", () => {
    if (["accueil", "deja", "bienvenue", "retour"].includes(ecranCourant)) window.location.href = "index.html";
    else history.back();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-aller]");
    if (btn) afficher(btn.dataset.aller);
  });

  /* ======================================================================
     Messages d'erreur
     ====================================================================== */
  function afficherErreur(texte) {
    $("[data-erreur-texte]").textContent = texte;
    $("[data-erreur]").hidden = false;
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  }
  function masquerErreur() { $("[data-erreur]").hidden = true; }

  /* ======================================================================
     Code du billet
     ====================================================================== */
  /* Accepte un code brut, un code sans tirets ou une URL contenant ?billet= */
  function extraireCode(brut) {
    let txt = String(brut || "").trim();
    try {
      const url = new URL(txt);
      txt = url.searchParams.get("billet") || url.pathname.split("/").pop() || txt;
    } catch (e) { /* ce n'est pas une URL */ }
    let alnum = txt.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Le préfixe VMS n'est retiré que s'il s'ajoute aux 8 caractères (code collé ou lu par QR)
    if (alnum.length > 8 && alnum.startsWith("VMS")) alnum = alnum.slice(3);
    return alnum.slice(0, 8);
  }
  const formaterSaisie = (alnum) => alnum.slice(0, 4) + (alnum.length > 4 ? "-" + alnum.slice(4) : "");
  const formaterCode = (alnum) => "VMS-" + formaterSaisie(alnum);

  const champCode = $("#code-billet");
  champCode.addEventListener("input", () => {
    const alnum = extraireCode(champCode.value);
    champCode.value = formaterSaisie(alnum);
    $("[data-champ-code]").classList.remove("is-invalide");
    champCode.removeAttribute("aria-invalid");
  });

  $("[data-form-code]").addEventListener("submit", (e) => {
    e.preventDefault();
    const alnum = extraireCode(champCode.value);
    if (alnum.length !== 8) {
      $("[data-champ-code]").classList.add("is-invalide");
      champCode.setAttribute("aria-invalid", "true");
      afficherErreur("Le code doit contenir 8 lettres ou chiffres après VMS-. Exemple : 7K4P-2QX9.");
      champCode.focus();
      return;
    }
    verifier(formaterCode(alnum), e.submitter || $("[type=submit]", e.target));
  });

  $$("[data-demo-code]").forEach((b) =>
    b.addEventListener("click", () => verifier(b.dataset.demoCode, null)));

  const MESSAGES = {
    inconnu: "Ce code ne correspond à aucun billet. Vérifie les caractères (0 et O, 1 et I) ou passe au stand Vimas Fest.",
    bloque: "Ce billet est bloqué pour le jeu. Présente-toi au stand Vimas Fest avec ton billet pour le débloquer.",
    reseau: "Le réseau ne répond pas. Rapproche-toi d'une borne Wi-Fi du festival puis réessaie."
  };

  async function verifier(code, bouton) {
    masquerErreur();
    if (bouton) bouton.setAttribute("aria-busy", "true");
    try {
      const res = await api.verifierBillet(code);
      if (res.statut === "nouveau") {
        etat.billet = res.billet;
        $("[data-billet-type]").textContent = `${res.billet.type} validé`;
        afficher("profil");
        if (!$("#pseudo").value) proposerPseudo();
      } else if (res.statut === "existant") {
        connecter(res.joueur, res.billet.code);
        afficherRetour(res.joueur);
      } else {
        if (ecranCourant !== "code") afficher("code");
        champCode.value = formaterSaisie(extraireCode(code));
        afficherErreur(MESSAGES[res.statut]);
      }
    } catch (err) {
      console.error(err);
      afficherErreur(MESSAGES.reseau);
    } finally {
      if (bouton) bouton.removeAttribute("aria-busy");
    }
  }

  /* ======================================================================
     Caméra + lecture QR (module commun assets/js/qr-lecteur.js)
     ====================================================================== */
  const video = $("[data-video]");
  const etatCamera = $("[data-camera-etat]");
  const btnLampe = $("[data-lampe]");

  async function demarrerCamera() {
    $("[data-viseur]").classList.remove("is-trouve");
    etatCamera.textContent = "Démarrage de la caméra…";
    try {
      const lecteur = await App.lecteurQR.demarrer(video, { onCode: codeLu });
      if (ecranCourant !== "camera") { lecteur.arreter(); return; }
      etat.lecteur = lecteur;
      btnLampe.hidden = !lecteur.aLampe;
      etatCamera.textContent = "Place le QR dans le cadre, il sera lu automatiquement.";
    } catch (err) {
      console.warn(err);
      afficher("code", { historique: false });
      afficherErreur(
        err.code === "refus" ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou saisis le code ci-dessous."
        : err.code === "non-supporte" ? "La lecture de QR n'est pas possible sur ce navigateur. Saisis le code imprimé sous le QR."
        : "Impossible d'ouvrir la caméra. Saisis le code imprimé sous le QR.");
    }
  }

  function codeLu(texte) {
    const alnum = extraireCode(texte);
    if (!/VMS/i.test(texte) || alnum.length !== 8) {
      etatCamera.textContent = "Ce QR n'est pas celui d'un billet Vimas Fest.";
      return;
    }
    $("[data-viseur]").classList.add("is-trouve");
    etatCamera.textContent = "QR lu, vérification du billet…";
    if (navigator.vibrate) navigator.vibrate(60);
    arreterCamera();
    verifier(formaterCode(alnum), null);
  }

  function arreterCamera() {
    if (etat.lecteur) etat.lecteur.arreter();
    etat.lecteur = null;
    etat.lampe = false;
    btnLampe.setAttribute("aria-pressed", "false");
  }

  btnLampe.addEventListener("click", async () => {
    if (!etat.lecteur) return;
    etat.lampe = !etat.lampe;
    try {
      await etat.lecteur.lampe(etat.lampe);
      btnLampe.setAttribute("aria-pressed", String(etat.lampe));
    } catch (e) { btnLampe.hidden = true; }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ecranCourant === "camera") arreterCamera();
    else if (!document.hidden && ecranCourant === "camera" && !etat.lecteur) demarrerCamera();
  });

  /* ======================================================================
     Profil
     ====================================================================== */
  const champPseudo = $("#pseudo");
  const etatPseudo = $("[data-pseudo-etat]");
  const reglePseudo = /^[\p{L}\p{N}_-]{3,16}$/u;
  let pseudoOk = false;
  let minuteur;

  // Pochettes
  $("[data-avatars]").innerHTML = avatars.map((a, i) => `
    <label class="avatar-choix">
      <input type="radio" name="avatar" value="${esc(a.id)}" ${i === 0 ? "checked" : ""}>
      <span data-pochette="${esc(a.id)}">${App.avatar(a, "", "md")}</span>
      <span class="avatar-choix__nom">${esc(a.nom)}</span>
    </label>`).join("");
  // Le sélecteur CSS « input:checked ~ .pochette » vise la pochette directe
  $$("[data-pochette]").forEach((s) => s.replaceWith(s.firstElementChild));

  // Styles musicaux (3 maximum)
  const zoneGenres = $("[data-genres]");
  zoneGenres.innerHTML = genres.map((g) => `
    <label class="puce"><input type="checkbox" name="genres" value="${esc(g)}"><span>${esc(g)}</span></label>`).join("");
  zoneGenres.addEventListener("change", () => {
    const coches = $$("input:checked", zoneGenres).length;
    $$("input", zoneGenres).forEach((c) => (c.disabled = !c.checked && coches >= 3));
  });

  function avatarChoisi() {
    return avatarParId[$("input[name=avatar]:checked").value];
  }

  function majApercu() {
    const pseudo = champPseudo.value.trim();
    $("[data-apercu-avatar]").innerHTML = App.avatar(avatarChoisi(), pseudo, "md");
    const cible = $("[data-apercu-pseudo]");
    cible.textContent = pseudo || "Ton pseudo";
    cible.classList.toggle("is-vide", !pseudo);
    // L'initiale apparaît aussi sur les pochettes du choix
    $$(".avatar-choix .pochette__initiale").forEach((el) => (el.textContent = (pseudo[0] || "?").toUpperCase()));
  }

  function marquerPseudo(ok, texte) {
    pseudoOk = ok === true;
    etatPseudo.className = "champ__etat" + (ok === true ? " is-ok" : ok === false ? " is-ko" : "");
    etatPseudo.innerHTML = texte ? (ok === true ? icon("coche") : ok === false ? icon("alerte") : "") + esc(texte) : "";
    $("[data-champ-pseudo]").classList.toggle("is-invalide", ok === false);
    if (ok === false) champPseudo.setAttribute("aria-invalid", "true"); else champPseudo.removeAttribute("aria-invalid");
  }

  async function verifierPseudo() {
    const p = champPseudo.value.trim();
    if (!p) return marquerPseudo(null, "");
    if (p.length < 3) return marquerPseudo(false, "Encore " + (3 - p.length) + " caractère" + (p.length === 2 ? "" : "s") + " au minimum.");
    if (!reglePseudo.test(p)) return marquerPseudo(false, "Utilise seulement des lettres, des chiffres, - et _.");
    marquerPseudo(null, "Vérification…");
    const dispo = await api.pseudoDisponible(p);
    if (champPseudo.value.trim() !== p) return; // l'utilisateur a continué à taper
    marquerPseudo(dispo, dispo ? "Disponible" : "Déjà pris, essaie une variante ou lance le dé.");
  }

  champPseudo.addEventListener("input", () => {
    majApercu();
    clearTimeout(minuteur);
    marquerPseudo(null, "");
    minuteur = setTimeout(verifierPseudo, 400);
  });

  function proposerPseudo() {
    const tire = (liste) => liste[Math.floor(Math.random() * liste.length)];
    const nombre = Math.random() < 0.5 ? String(Math.floor(Math.random() * 90) + 10) : "";
    champPseudo.value = (tire(mots.debut) + tire(mots.fin) + nombre).slice(0, 16);
    majApercu();
    verifierPseudo();
  }

  const de = $("[data-pseudo-hasard]");
  de.addEventListener("click", () => {
    de.classList.remove("is-lance"); void de.offsetWidth; de.classList.add("is-lance");
    proposerPseudo();
  });

  $("[data-avatars]").addEventListener("change", majApercu);
  majApercu();

  $("[data-form-profil]").addEventListener("submit", async (e) => {
    e.preventDefault();
    masquerErreur();
    const bouton = $("[data-creer]");
    const form = e.target;

    await verifierPseudo();
    if (!pseudoOk) {
      afficherErreur("Choisis un pseudo valide et disponible.");
      champPseudo.focus();
      return;
    }
    if (!$("[data-regles]").checked) {
      afficherErreur("Accepte les règles du jeu pour créer ton profil.");
      $("[data-regles]").focus();
      return;
    }
    if (!etat.billet) { afficher("accueil"); return; }

    bouton.setAttribute("aria-busy", "true");
    try {
      const res = await api.creerProfil({
        code: etat.billet.code,
        pseudo: champPseudo.value.trim(),
        avatar: avatarChoisi().id,
        genres: $$("input[name=genres]:checked", form).map((c) => c.value),
        alertes: form.alertes.checked
      });
      if (!res.ok) {
        marquerPseudo(false, "Ce pseudo vient d'être pris. Choisis-en un autre.");
        afficherErreur("Ce pseudo vient d'être pris. Choisis-en un autre.");
        champPseudo.focus();
        return;
      }
      connecter(res.joueur, etat.billet.code);
      afficherBienvenue(res.joueur, res.bonus);
    } catch (err) {
      console.error(err);
      afficherErreur(MESSAGES.reseau);
    } finally {
      bouton.removeAttribute("aria-busy");
    }
  });

  /* ======================================================================
     Fin de parcours
     ====================================================================== */
  function connecter(joueur, code) {
    session.set({ ...joueur, billet: code, connecteLe: new Date().toISOString() });
  }

  const gain = (valeur, libelle) => `<li><strong class="chiffres">${valeur}</strong><span>${esc(libelle)}</span></li>`;

  function afficherBienvenue(joueur, bonus) {
    $("[data-bienvenue-avatar]").innerHTML = App.avatar(avatarParId[joueur.avatar], joueur.pseudo, "lg");
    $("[data-bienvenue-pseudo]").textContent = joueur.pseudo;
    $("[data-gains]").innerHTML =
      gain(`+${bonus.xp}`, "XP de bienvenue") + gain(bonus.jetons, "jetons offerts") + gain(esc(bonus.rang), "ton rang");
    $("[data-premiere-mission]").textContent = bonus.premiereMission;
    afficher("bienvenue");
    history.replaceState({ ecran: "bienvenue" }, "", "inscription.html");
  }

  function afficherRetour(joueur) {
    $("[data-retour-avatar]").innerHTML = App.avatar(avatarParId[joueur.avatar] || avatars[0], joueur.pseudo, "lg");
    $("[data-retour-pseudo]").textContent = joueur.pseudo;
    $("[data-retour-stats]").innerHTML =
      gain(fmt.nombre(joueur.xp), "XP") + gain(joueur.jetons, "jetons") + gain(esc(joueur.rang), "rang");
    afficher("retour");
    history.replaceState({ ecran: "retour" }, "", "inscription.html");
  }

  /* ---------- Changer de compte ---------- */
  $("[data-changer-compte]").addEventListener("click", () => {
    session.clear();
    App.toast("Profil déconnecté de ce téléphone.");
    afficher("accueil");
  });

  /* ======================================================================
     Faux QR décoratif (motif déterministe, 21 × 21)
     ====================================================================== */
  (function dessinerQR() {
    const n = 21, cases = [];
    const repere = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([a, b]) => {
      const dx = x - a, dy = y - b;
      if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
      return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    });
    const dansRepere = (x, y) => [[0, 0], [n - 8, 0], [0, n - 8]].some(([a, b]) => x >= a && x < a + 8 && y >= b && y < b + 8);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const plein = dansRepere(x, y) ? repere(x, y) : ((x * 7 + y * 13 + x * y) % 5) < 2;
      cases.push(plein ? "<i></i>" : "<span></span>");
    }
    $("[data-faux-qr]").innerHTML = cases.join("");
  })();

  /* ======================================================================
     Écran de départ
     ====================================================================== */
  function ecranDepart() { return session.isLoggedIn() ? "deja" : "accueil"; }

  const joueur = session.get();
  if (joueur) {
    $("[data-deja-profil]").innerHTML =
      App.avatar(avatarParId[joueur.avatar] || avatars[0], joueur.pseudo, "md") + `<span>${esc(joueur.pseudo)}</span>`;
  }

  // Arrivée depuis le QR du billet scanné avec l'appareil photo du téléphone : inscription.html?billet=VMS-XXXX-XXXX
  const param = new URLSearchParams(location.search).get("billet");
  afficher(ecranDepart(), { historique: false });
  history.replaceState({ ecran: ecranDepart() }, "", "");
  if (param && !joueur) {
    history.replaceState({ ecran: "accueil" }, "", "inscription.html");
    const alnum = extraireCode(param);
    if (alnum.length === 8) verifier(formaterCode(alnum), null);
  }
});
