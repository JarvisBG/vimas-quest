/* ==========================================================================
   Page 2 — Créer sa carte / reprendre sa partie (système de code d'Otaku)

   Il n'y a PAS de billet du festival dans le jeu. Le joueur n'a ni mot de
   passe ni adresse e-mail : il choisit un pseudo, reçoit un code secret
   (« KORA-40912 ») et c'est ce code qui lui rend sa partie sur n'importe
   quel téléphone.

   Le ticket papier de la billetterie vendeur n'apparaît QUE si le GM a
   ouvert la billetterie (billetterie_config.actif).

   Écrans : deja | accueil | ticket | ticket-code | profil | code | fiche
            | bienvenue | retour | retrouve
   Fiche de fan (étape 6.3 bis) : après le code, une question par écran,
   « Passer » toujours présent, téléphone en dernier (19 ans et plus). Aussi
   ouverte depuis la carte : inscription.html?fiche=1 (ce qui manque seulement).

   Requêtes envoyées à Supabase (règle de sobriété, voir data/PERFORMANCE.md) :
     - réglage de la billetterie : gardé 5 min sur le téléphone, souvent 0 appel
     - création de la carte      : 1 appel (create_player)
     - fiche de fan              : 1 appel à la fin (fiche_enregistrer), aucun pendant
     - reprise de partie         : 1 appel (login_with_code)
     - le pseudo n'est JAMAIS vérifié au fil de la frappe en mode serveur
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api, session } = App;

  const etat = { ticket: null, lecteur: null, lampe: false, billetterie: { actif: false } };
  let avatars, mots, cfgFiche;
  try {
    [avatars, mots, cfgFiche] = await Promise.all(["avatars", "motsPseudo", "fiche"].map(App.data.get));
  } catch (e) {
    afficherErreur("Impossible de charger la page. Vérifie ta connexion puis recharge.");
    return;
  }
  const avatarParId = Object.fromEntries(avatars.map((a) => [a.id, a]));

  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  /* ======================================================================
     Navigation entre écrans (avec prise en charge du bouton retour Android)
     ====================================================================== */
  const ecrans = $$("[data-ecran]");
  let ecranCourant = null;

  function afficher(nom, { historique = true } = {}) {
    if (ecranCourant === "ticket" && nom !== "ticket") arreterCamera();
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
    if (nom === "ticket") demarrerCamera();
    if (nom === "ticket-code") setTimeout(() => $("#code-ticket").focus(), 50);
    if (nom === "retour") setTimeout(() => $("#code-joueur").focus(), 50);
    if (nom === "profil" && !$("#pseudo").value) proposerPseudo();
  }

  window.addEventListener("popstate", (e) => {
    const cible = (e.state && e.state.ecran) || ecranDepart();
    // Une fois la carte créée, le bouton retour ne ramène jamais en arrière :
    // le joueur perdrait l'écran de son code secret.
    if (["code", "fiche", "bienvenue", "retrouve"].includes(ecranCourant)) {
      history.pushState({ ecran: ecranCourant }, "", "");
      return;
    }
    afficher(cible, { historique: false });
  });

  $("[data-retour]").addEventListener("click", () => {
    if (ecranCourant === "fiche" && fiche.retour === "carte") window.location.href = "tableau-de-bord.html";
    else if (["accueil", "deja", "code", "fiche", "bienvenue", "retrouve"].includes(ecranCourant)) window.location.href = "index.html";
    else history.back();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-aller]");
    if (!btn) return;
    // « Créer ma carte » passe par le ticket quand la billetterie est ouverte
    if (btn.dataset.aller === "profil" && etat.billetterie.actif && !etat.ticket) afficher("ticket");
    else afficher(btn.dataset.aller);
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

  /* Un seul endroit traduit les erreurs : serveur.js les connaît déjà toutes. */
  const dire = (err, secours) => {
    console.error(err);
    afficherErreur((App.messageErreur && err && err.code) ? App.messageErreur(err) : secours);
  };

  /* Un bouton occupé est VERROUILLÉ, pas seulement grisé.
     Sur le réseau du festival la réponse met plusieurs secondes : sans ça, le
     joueur tape deux fois et crée deux cartes (deux create_player pour rien). */
  function occuper(bouton) {
    if (!bouton) return () => {};
    if (bouton.disabled) return null;          // déjà en cours : on ignore l'appui
    bouton.disabled = true;
    bouton.setAttribute("aria-busy", "true");
    return () => { bouton.disabled = false; bouton.removeAttribute("aria-busy"); };
  }

  /* ======================================================================
     Billetterie : faut-il un ticket papier ? (réponse gardée sur le téléphone)
     ====================================================================== */
  try {
    etat.billetterie = await api.billetterie();
  } catch (e) { /* on n'exige pas de ticket si on ne sait pas : create_player tranchera */ }

  if (etat.billetterie.actif) {
    const note = $("[data-note-ticket]");
    $("[data-note-ticket-txt]").textContent = etat.billetterie.message ||
      `Il te faut un ticket de jeu (${etat.billetterie.prix} FCFA) auprès de l'équipe.`;
    note.hidden = false;
  }

  /* ======================================================================
     Ticket papier (billetterie vendeur)
     ====================================================================== */
  /* Accepte un code brut, sans tirets, ou une URL contenant ?ticket= */
  function extraireTicket(brut) {
    let txt = String(brut || "").trim();
    try {
      const url = new URL(txt);
      txt = url.searchParams.get("ticket") || url.searchParams.get("t") || url.pathname.split("/").pop() || txt;
    } catch (e) { /* ce n'est pas une URL */ }
    return txt.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
  }

  const champTicket = $("#code-ticket");
  champTicket.addEventListener("input", () => {
    champTicket.value = extraireTicket(champTicket.value);
    $("[data-champ-ticket]").classList.remove("is-invalide");
    champTicket.removeAttribute("aria-invalid");
  });

  $("[data-form-ticket]").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = extraireTicket(champTicket.value);
    if (code.length < 4) {
      $("[data-champ-ticket]").classList.add("is-invalide");
      champTicket.setAttribute("aria-invalid", "true");
      afficherErreur("Recopie le code imprimé sous le QR de ton ticket.");
      champTicket.focus();
      return;
    }
    verifierTicket(code, e.submitter || $("[type=submit]", e.target));
  });

  const MESSAGES_TICKET = {
    inconnu: "Ce ticket n'existe pas. Vérifie le code, ou demande à l'équipe.",
    utilise: "Ce ticket a déjà servi : un ticket ne s'utilise qu'une fois.",
    rendu: "Ce ticket a été rendu invendu : il ne vaut plus rien. Prends-en un neuf auprès de l'équipe.",
    annule: "Ce carnet de tickets a été annulé. Va voir l'équipe Vimas Quest."
  };

  async function verifierTicket(code, bouton) {
    masquerErreur();
    const liberer = occuper(bouton);
    if (liberer === null) return;              // appui en double
    try {
      const res = await api.verifierBillet(code);
      if (res.statut === "nouveau") {
        etat.ticket = res.billet;
        $("[data-ticket-txt]").textContent = "Ticket validé";
        $("[data-ticket-ok]").hidden = false;
        afficher("profil");
      } else {
        if (ecranCourant !== "ticket-code") afficher("ticket-code");
        champTicket.value = code;
        afficherErreur(MESSAGES_TICKET[res.statut] || MESSAGES_TICKET.inconnu);
      }
    } catch (err) {
      dire(err, "Le réseau ne répond pas. Rapproche-toi d'une borne Wi-Fi du festival puis réessaie.");
    } finally {
      liberer();
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
      if (ecranCourant !== "ticket") { lecteur.arreter(); return; }
      etat.lecteur = lecteur;
      btnLampe.hidden = !lecteur.aLampe;
      etatCamera.textContent = "Place le QR dans le cadre, il sera lu automatiquement.";
    } catch (err) {
      console.warn(err);
      afficher("ticket-code", { historique: false });
      afficherErreur(
        err.code === "refus" ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou saisis le code ci-dessous."
        : err.code === "non-supporte" ? "La lecture de QR n'est pas possible sur ce navigateur. Saisis le code imprimé sous le QR."
        : "Impossible d'ouvrir la caméra. Saisis le code imprimé sous le QR.");
    }
  }

  function codeLu(texte) {
    const code = extraireTicket(texte);
    if (code.length < 4) {
      etatCamera.textContent = "Ce QR n'est pas celui d'un ticket Vimas Quest.";
      return;
    }
    $("[data-viseur]").classList.add("is-trouve");
    etatCamera.textContent = "QR lu, vérification du ticket…";
    if (navigator.vibrate) navigator.vibrate(60);
    arreterCamera();
    verifierTicket(code, null);
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
    if (document.hidden && ecranCourant === "ticket") arreterCamera();
    else if (!document.hidden && ecranCourant === "ticket" && !etat.lecteur) demarrerCamera();
  });

  /* ======================================================================
     Profil
     ====================================================================== */
  const champPseudo = $("#pseudo");
  const etatPseudo = $("[data-pseudo-etat]");
  /* Même règle que create_player : 2 à 16 caractères. */
  const reglePseudo = /^[\p{L}\p{N}_-]{2,16}$/u;
  let pseudoValide = false;
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

  function avatarChoisi() {
    return avatarParId[$("input[name=avatar]:checked").value];
  }

  function majApercu() {
    const pseudo = champPseudo.value.trim();
    $("[data-apercu-avatar]").innerHTML = App.avatar(avatarChoisi(), pseudo, "md");
    const cible = $("[data-apercu-pseudo]");
    cible.textContent = pseudo || "Ton pseudo";
    cible.classList.toggle("is-vide", !pseudo);
    $$(".avatar-choix .pochette__initiale").forEach((el) => (el.textContent = (pseudo[0] || "?").toUpperCase()));
  }

  function marquerPseudo(ok, texte) {
    pseudoValide = ok === true;
    etatPseudo.className = "champ__etat" + (ok === true ? " is-ok" : ok === false ? " is-ko" : "");
    etatPseudo.innerHTML = texte ? (ok === true ? icon("coche") : ok === false ? icon("alerte") : "") + esc(texte) : "";
    $("[data-champ-pseudo]").classList.toggle("is-invalide", ok === false);
    if (ok === false) champPseudo.setAttribute("aria-invalid", "true"); else champPseudo.removeAttribute("aria-invalid");
  }

  /* Vérification de FORME seulement (aucune requête).
     En démo on interroge en plus la liste des pseudos pris, pour montrer l'écran ;
     en mode serveur c'est create_player qui répond PSEUDO_DEJA_PRIS. */
  async function verifierPseudo() {
    const p = champPseudo.value.trim();
    if (!p) return marquerPseudo(null, "");
    if (p.length < 2) return marquerPseudo(false, "Encore un caractère au minimum.");
    if (!reglePseudo.test(p)) return marquerPseudo(false, "Utilise seulement des lettres, des chiffres, - et _.");
    if (!App.mock) return marquerPseudo(true, "");
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
    if (bouton.disabled) return;               // création déjà en cours

    await verifierPseudo();
    if (!pseudoValide) {
      afficherErreur("Choisis un pseudo valide.");
      champPseudo.focus();
      return;
    }
    if (!$("[data-regles]").checked) {
      afficherErreur("Accepte les règles du jeu pour créer ta carte.");
      $("[data-regles]").focus();
      return;
    }

    const liberer = occuper(bouton);
    if (liberer === null) return;
    try {
      const res = await api.creerProfil({
        pseudo: champPseudo.value.trim(),
        avatar: avatarChoisi().id,
        ticket: etat.ticket ? etat.ticket.code : null
      });
      if (!res.ok) {
        marquerPseudo(false, "Ce pseudo vient d'être pris. Choisis-en un autre.");
        afficherErreur("Ce pseudo vient d'être pris. Choisis-en un autre.");
        champPseudo.focus();
        return;
      }
      afficherCode(res.joueur, res.code);
    } catch (err) {
      dire(err, "Le réseau ne répond pas. Rapproche-toi d'une borne Wi-Fi du festival puis réessaie.");
    } finally {
      liberer();
    }
  });

  /* ======================================================================
     L'écran du code secret
     ====================================================================== */
  let joueurCree = null;

  function afficherCode(joueur, code) {
    joueurCree = joueur;
    $("[data-code-valeur]").textContent = code;
    $("[data-code-valeur]").setAttribute("aria-label", "Ton code secret : " + code.split("").join(" "));
    $("[data-rappel-code]").textContent = code;
    $("[data-code-note]").checked = false;
    $("[data-suite-code]").disabled = true;
    afficher("code");
    history.replaceState({ ecran: "code" }, "", "inscription.html");
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  }

  $("[data-code-note]").addEventListener("change", (e) => {
    $("[data-suite-code]").disabled = !e.target.checked;
  });

  $("[data-copier]").addEventListener("click", async () => {
    const code = $("[data-code-valeur]").textContent;
    const dit = (txt) => {
      $("[data-copier-txt]").textContent = txt;
      setTimeout(() => ($("[data-copier-txt]").textContent = "Copier le code"), 2500);
    };
    try {
      await navigator.clipboard.writeText(code);
      dit("Copié !");
    } catch (e) {
      // Navigateur ancien ou page non sécurisée : on sélectionne, le joueur copie
      const sel = window.getSelection(), plage = document.createRange();
      plage.selectNodeContents($("[data-code-valeur]"));
      sel.removeAllRanges(); sel.addRange(plage);
      dit("Copie-le à la main");
    }
  });

  $("[data-suite-code]").addEventListener("click", () => {
    demarrerFiche({ manquants: cfgFiche.champs.map((c) => c.id), telephone: false, majeur: false, retour: "bienvenue" });
  });

  /* ======================================================================
     Fiche de fan : une question par écran, un tapotement, « Passer »
     toujours là. Les réponses restent sur le téléphone jusqu'à la fin, puis
     partent en UN appel (enregistrerFiche). Ce qui est passé reviendra dans
     le coffre du scan (sauf le téléphone).
     ====================================================================== */
  const fiche = { etapes: [], i: 0, reponses: {}, telDeja: false, majeur: false, retour: "bienvenue", tel: null };
  const zoneQuestion = $("[data-fiche-question]");
  const formTel = $("[data-fiche-tel]");
  const btnPasser = $("[data-fiche-passer]");
  const blocEnvoi = $("[data-fiche-envoi]");

  const champFiche = (id) => cfgFiche.champs.find((c) => c.id === id);
  // Le téléphone : jamais s'il est déjà donné, jamais sous 19 ans (ni si l'âge est passé)
  const telPossible = () => !fiche.telDeja &&
    (fiche.majeur || cfgFiche.majeurs.includes(fiche.reponses.tranche_age));
  const telPeutVenir = () => !fiche.telDeja &&
    (fiche.majeur || (fiche.etapes.includes("tranche_age") && !("tranche_age" in fiche.reponses) &&
      fiche.i <= fiche.etapes.indexOf("tranche_age")) || cfgFiche.majeurs.includes(fiche.reponses.tranche_age));

  function demarrerFiche({ manquants = [], telephone = false, majeur = false, retour = "bienvenue" }) {
    Object.assign(fiche, {
      etapes: cfgFiche.champs.filter((c) => manquants.includes(c.id)).map((c) => c.id),
      i: 0, reponses: {}, telDeja: !!telephone, majeur: !!majeur, retour, tel: null
    });
    if (!fiche.etapes.length && !telPossible()) { quitterFiche(null); return; }
    afficher("fiche");
    history.replaceState({ ecran: "fiche" }, "", "inscription.html");
    montrerEtape();
  }

  function montrerEtape() {
    blocEnvoi.hidden = true;
    const total = fiche.etapes.length + (telPeutVenir() ? 1 : 0);
    $("[data-fiche-rang]").textContent = `${Math.min(fiche.i + 1, total)}/${total}`;
    $("[data-fiche-barre]").style.setProperty("--p", `${Math.round((fiche.i / Math.max(total, 1)) * 100)}%`);

    if (fiche.i < fiche.etapes.length) {
      const c = champFiche(fiche.etapes[fiche.i]);
      formTel.hidden = true;
      btnPasser.hidden = false;
      $("[data-fiche-gain]").textContent = `+${cfgFiche.xpParReponse} XP par réponse, +${cfgFiche.bonusComplet} XP si ta carte est complète.`;
      zoneQuestion.innerHTML = App.questionHTML({ cle: c.id, texte: c.titre, options: c.options, ordre_fixe: !!c.ordreFixe });
      return;
    }
    if (telPossible()) {
      zoneQuestion.innerHTML = "";
      formTel.hidden = false;
      btnPasser.hidden = false;
      $("[data-fiche-gain]").textContent = "Dernière étape, et la plus utile.";
      return;
    }
    finirFiche();
  }

  zoneQuestion.addEventListener("click", (e) => {
    const b = e.target.closest("[data-choix]");
    if (!b || b.disabled) return;
    $$("[data-choix]", zoneQuestion).forEach((x) => (x.disabled = true));
    b.classList.add("is-choisi");
    fiche.reponses[fiche.etapes[fiche.i]] = b.dataset.choix;
    if (navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => { fiche.i++; montrerEtape(); }, 220);
  });

  btnPasser.addEventListener("click", () => {
    if (btnPasser.disabled) return;
    if (fiche.i < fiche.etapes.length) { fiche.i++; montrerEtape(); }
    else { fiche.tel = null; finirFiche(); }   // téléphone passé : on enregistre le reste
  });

  const champTel = $("#telephone");
  champTel.addEventListener("input", () => {
    // « 699 12 34 56 » : les espaces se posent tout seuls
    const n = champTel.value.replace(/[^0-9]/g, "").replace(/^237(?=[0-9]{9})/, "").slice(0, 9);
    champTel.value = [n.slice(0, 3), n.slice(3, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean).join(" ");
    $("[data-champ-tel]").classList.remove("is-invalide");
  });

  formTel.addEventListener("submit", (e) => {
    e.preventDefault();
    masquerErreur();
    const n = champTel.value.replace(/[^0-9]/g, "");
    if (!/^6[0-9]{8}$/.test(n)) {
      $("[data-champ-tel]").classList.add("is-invalide");
      afficherErreur("Ce numéro ne ressemble pas à un numéro camerounais : 9 chiffres, commence par 6.");
      champTel.focus();
      return;
    }
    fiche.tel = n;
    finirFiche();
  });

  async function finirFiche() {
    if (!Object.keys(fiche.reponses).length && !fiche.tel) { quitterFiche(null); return; }
    const bouton = !blocEnvoi.hidden ? $("[data-fiche-reessayer]") : fiche.tel ? $("[data-fiche-valider]") : btnPasser;
    const liberer = occuper(bouton);
    if (liberer === null) return;
    masquerErreur();
    try {
      const r = await api.enregistrerFiche({
        fiche: fiche.reponses, telephone: fiche.tel,
        domaf: !!fiche.tel && $("[data-consent-orga]").checked,
        partenaires: !!fiche.tel && $("[data-consent-partenaires]").checked
      });
      quitterFiche(r);
    } catch (err) {
      if (err.code === "NUMERO_INVALIDE" || err.code === "RESERVE_MAJEURS") {
        $("[data-champ-tel]").classList.add("is-invalide");
        dire(err, "Numéro refusé.");
        return;
      }
      dire(err, "Le réseau ne répond pas. Rapproche-toi d'une borne Wi-Fi du festival puis réessaie.");
      zoneQuestion.innerHTML = "";
      formTel.hidden = true;
      btnPasser.hidden = true;
      blocEnvoi.hidden = false;
    } finally {
      liberer();
    }
  }

  $("[data-fiche-reessayer]").addEventListener("click", finirFiche);
  $("[data-fiche-plus-tard]").addEventListener("click", () => quitterFiche(null));

  function quitterFiche(r) {
    if (r && r.xp + r.jetons > 0) {
      App.toast(`Carte ${r.faits === r.total ? "complète" : "mise à jour"} : +${r.xp} XP` +
        (r.tourOffert ? ", et un tour de roue offert !" : "."));
    }
    if (fiche.retour === "carte") { window.location.href = "tableau-de-bord.html"; return; }
    afficherBienvenue(r ? r.joueur : joueurCree);
  }

  /* ======================================================================
     Fin de parcours
     ====================================================================== */
  async function afficherBienvenue(joueur) {
    $("[data-bienvenue-avatar]").innerHTML = App.avatar(avatarParId[joueur.avatar] || avatars[0], joueur.pseudo, "lg");
    $("[data-bienvenue-pseudo]").textContent = joueur.pseudo;
    afficher("bienvenue");
    history.replaceState({ ecran: "bienvenue" }, "", "inscription.html");
    // La première mission est un texte d'accueil : si elle manque, l'écran reste bon.
    try {
      const bonus = await App.data.get("bonusBienvenue");
      $("[data-premiere-mission]").textContent = bonus.premiereMission;
    } catch (e) {
      $(".mission-une").hidden = true;
    }
  }

  const gain = (valeur, libelle) => `<li><strong class="chiffres">${valeur}</strong><span>${esc(libelle)}</span></li>`;

  function afficherRetrouve(joueur) {
    $("[data-retrouve-avatar]").innerHTML = App.avatar(avatarParId[joueur.avatar] || avatars[0], joueur.pseudo, "lg");
    $("[data-retrouve-pseudo]").textContent = joueur.pseudo;
    $("[data-retrouve-stats]").innerHTML =
      gain(fmt.nombre(joueur.xp || 0), "XP") + gain(joueur.jetons || 0, "jetons") + gain(esc(joueur.rang || "—"), "rang");
    afficher("retrouve");
    history.replaceState({ ecran: "retrouve" }, "", "inscription.html");
  }

  /* ======================================================================
     Reprise de partie par le code secret
     ====================================================================== */
  const champConnexion = $("#code-joueur");
  /* MOT-00000 : le tiret se pose tout seul, les minuscules deviennent majuscules. */
  function formaterCodeJoueur(brut) {
    const txt = String(brut || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const mot = txt.replace(/[0-9].*$/, "").slice(0, 6);
    const chiffres = txt.slice(mot.length).replace(/[^0-9]/g, "").slice(0, 5);
    return chiffres ? `${mot}-${chiffres}` : mot;
  }

  champConnexion.addEventListener("input", () => {
    const pos = champConnexion.selectionStart === champConnexion.value.length;
    champConnexion.value = formaterCodeJoueur(champConnexion.value);
    if (pos) champConnexion.setSelectionRange(champConnexion.value.length, champConnexion.value.length);
    $("[data-champ-connexion]").classList.remove("is-invalide");
    champConnexion.removeAttribute("aria-invalid");
  });

  $("[data-form-connexion]").addEventListener("submit", async (e) => {
    e.preventDefault();
    masquerErreur();
    const code = formaterCodeJoueur(champConnexion.value);
    if (!/^[A-Z]{3,6}-[0-9]{5}$/.test(code)) {
      $("[data-champ-connexion]").classList.add("is-invalide");
      champConnexion.setAttribute("aria-invalid", "true");
      afficherErreur("Le code s'écrit un mot, un tiret, cinq chiffres. Exemple : KORA-40912.");
      champConnexion.focus();
      return;
    }
    const liberer = occuper($("[data-connecter]"));
    if (liberer === null) return;
    try {
      const joueur = await api.reprendre(code);
      afficherRetrouve(joueur);
    } catch (err) {
      dire(err, "Code inconnu : vérifie l'orthographe, ou passe au stand Vimas Quest.");
      champConnexion.focus();
      champConnexion.select();
    } finally {
      liberer();
    }
  });

  /* ---------- Changer de profil ---------- */
  $("[data-changer-compte]").addEventListener("click", () => {
    if (!window.confirm("Quitter ce profil sur ce téléphone ? Il te faudra ton code secret pour y revenir.")) return;
    session.clear();
    App.toast("Profil déconnecté de ce téléphone.");
    afficher("accueil");
  });

  /* ======================================================================
     Écran de départ
     ====================================================================== */
  function ecranDepart() { return session.isLoggedIn() ? "deja" : "accueil"; }

  const joueur = session.get();
  if (joueur) {
    $("[data-deja-profil]").innerHTML =
      App.avatar(avatarParId[joueur.avatar] || avatars[0], joueur.pseudo, "md") + `<span>${esc(joueur.pseudo)}</span>`;
  }

  // Depuis la carte : compléter la fiche (ce qui manque seulement)
  if (joueur && new URLSearchParams(location.search).get("fiche")) {
    try {
      const etat = await api.ficheEtat();
      if (etat) { demarrerFiche({ ...etat, retour: "carte" }); return; }
    } catch (e) { /* on retombe sur l'écran « déjà connecté » */ }
  }

  afficher(ecranDepart(), { historique: false });
  history.replaceState({ ecran: ecranDepart() }, "", "");

  // Arrivée depuis le QR d'un ticket lu avec l'appareil photo : inscription.html?ticket=DQ-XXXX
  const param = new URLSearchParams(location.search).get("ticket");
  if (param && !joueur) {
    history.replaceState({ ecran: "accueil" }, "", "inscription.html");
    const code = extraireTicket(param);
    if (code.length >= 4) verifierTicket(code, null);
  }
});
