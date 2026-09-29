/* ==========================================================================
   Page 10 — Classement : général, du jour, entre amis
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, $$, esc, icon, fmt, api, session } = App;

  const PERIODES = ["general", "jour", "amis"];
  const etat = { periode: "general", donnees: null, dernierRang: {}, observateur: null };

  const rangTxt = (r) => `${fmt.nombre(r)}<small>${r === 1 ? "er" : "e"}</small>`;
  const rangLabel = (r) => `${r === 1 ? "premier" : `${r}e`}`;

  /* ---------- Onglets ---------- */
  const onglets = $$("[data-periode]");
  function choisir(periode, { focus = false, charge = true } = {}) {
    etat.periode = periode;
    onglets.forEach((o) => {
      const actif = o.dataset.periode === periode;
      o.setAttribute("aria-selected", String(actif));
      o.tabIndex = actif ? 0 : -1;
      if (actif && focus) o.focus();
    });
    $("[data-panneau]").setAttribute("aria-labelledby", `onglet-${periode}`);
    $("[data-recherche]").hidden = periode === "amis";
    $("[data-resultat-recherche]").hidden = true;
    $("[data-amis-outils]").hidden = periode !== "amis";
    history.replaceState(null, "", periode === "general" ? location.pathname : `#${periode}`);
    if (charge) charger({ squelette: true });
  }
  $("[data-onglets]").addEventListener("click", (e) => {
    const o = e.target.closest("[data-periode]");
    if (o && o.dataset.periode !== etat.periode) choisir(o.dataset.periode);
  });
  $("[data-onglets]").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = PERIODES.indexOf(etat.periode);
    choisir(PERIODES[(i + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3], { focus: true });
  });

  /* ======================================================================
     Chargement
     ====================================================================== */
  let requete = 0;
  async function charger({ squelette = false } = {}) {
    const n = ++requete;
    const liste = $("[data-liste]");
    liste.setAttribute("aria-busy", "true");
    if (squelette) {
      liste.innerHTML = '<li class="squelette" style="height:60px"></li>'.repeat(4);
      $("[data-podium]").innerHTML = "";
    }
    try {
      const periode = etat.periode;
      const d = periode === "amis" ? await api.amis("general") : await api.classement(periode);
      if (n !== requete) return; // un autre onglet a été choisi entre-temps
      if (!d) { window.location.replace("inscription.html"); return; }
      etat.donnees = d;
      rendre(d);
      signalerChangement(d);
    } catch (e) {
      console.error(e);
      App.toast("Le classement n'a pas pu être mis à jour.");
    } finally {
      liste.setAttribute("aria-busy", "false");
    }
  }

  function rendre(d) {
    const amis = etat.periode === "amis";
    const tous = amis ? d.liste : [...d.top, ...d.autour];
    const podium = amis ? d.liste.slice(0, 3) : d.top.slice(0, 3);

    $("[data-sous-titre]").textContent = amis
      ? `${d.total} joueur${d.total > 1 ? "s" : ""} dans ta bande, classés à l'XP total`
      : etat.periode === "jour"
        ? `${fmt.nombre(d.total)} joueur${d.total > 1 ? "s" : ""} actif${d.total > 1 ? "s" : ""} aujourd'hui, XP gagnés depuis l'ouverture`
        : `${fmt.nombre(d.total)} joueur${d.total > 1 ? "s" : ""} depuis samedi`;

    rendrePodium(podium);
    rendreListe(d, amis);
    rendrePosition(d, amis);

    const vide = $("[data-vide]");
    vide.hidden = !(amis && d.liste.length <= 1);

    $("[data-maj]").textContent = `Mis à jour à ${App.heureFestival()}, actualisation chaque minute.`;
    const direct = $("[data-direct]");
    direct.classList.add("is-maj");
    setTimeout(() => direct.classList.remove("is-maj"), 600);
  }

  /* ---------- Podium ---------- */
  function rendrePodium(liste) {
    const zone = $("[data-podium]");
    if (!liste.length) {
      zone.className = "podium podium--vide";
      zone.innerHTML = "<li>Pas encore de classement.</li>";
      return;
    }
    zone.className = "podium";
    zone.innerHTML = liste.map((j, i) => `
      <li class="marche marche--${i + 1}${j.estMoi ? " is-moi" : ""}" aria-label="${rangLabel(j.rang)} : ${esc(j.pseudo)}${j.estMoi ? " (toi)" : ""}, ${fmt.nombre(j.xp)} XP">
        <span class="marche__avatar">
          ${i === 0 ? '<span class="couronne" aria-hidden="true"></span>' : ""}
          ${App.avatar(j.avatar, j.pseudo, "md")}
        </span>
        <span class="marche__pseudo">${esc(j.pseudo)}${j.estMoi ? " (toi)" : ""}</span>
        <span class="marche__xp">${fmt.nombre(j.xp)} XP</span>
        <span class="marche__bloc" aria-hidden="true">${j.rang}</span>
      </li>`).join("");
  }

  /* ---------- Liste ---------- */
  function evolution(ev) {
    if (!ev) return `<span class="evo evo--stable" aria-label="Position stable"></span>`;
    const monte = ev > 0;
    return `<span class="evo evo--${monte ? "monte" : "descend"}" aria-label="${monte ? "Gagne" : "Perd"} ${Math.abs(ev)} place${Math.abs(ev) > 1 ? "s" : ""}">
      ${icon("fleche")}${Math.abs(ev)}</span>`;
  }

  const ligne = (j) => `
    <li class="ligne-cl${j.estMoi ? " is-moi" : ""}" ${j.estMoi ? "data-moi" : ""} data-pseudo="${esc(j.pseudo)}">
      <span class="ligne-cl__place">
        <span class="ligne-cl__rang">${rangTxt(j.rang)}</span>
        ${j.evolution !== undefined ? evolution(j.evolution) : ""}
      </span>
      ${App.avatar(j.avatar, j.pseudo, "sm")}
      <span class="ligne-cl__nom"><strong>${esc(j.pseudo)}${j.estMoi ? " (toi)" : ""}</strong><span>${esc(j.rangNom || "")}</span></span>
      <span class="ligne-cl__xp">${fmt.nombre(j.xp)} <small>XP</small></span>
    </li>`;

  const ellipse = (n) => n > 0
    ? `<li class="ellipse-cl" aria-label="${fmt.nombre(n)} joueurs non affichés">${fmt.nombre(n)} joueur${n > 1 ? "s" : ""}</li>` : "";

  function rendreListe(d, amis) {
    let html = "";
    if (amis) {
      html = d.liste.slice(3).map(ligne).join("");
    } else {
      html = d.top.slice(3).map(ligne).join("");
      if (d.autour.length) {
        const dernierTop = d.top[d.top.length - 1].rang;
        html += ellipse(d.autour[0].rang - dernierTop - 1);
        html += d.autour.map(ligne).join("");
        html += ellipse(d.total - d.autour[d.autour.length - 1].rang);
      } else if (d.top.length) {
        html += ellipse(d.total - d.top[d.top.length - 1].rang);
      }
    }
    $("[data-liste]").innerHTML = html;
    observerMaLigne();
  }

  /* ---------- Ma position ---------- */
  function rendrePosition(d, amis) {
    const moi = d.moi;
    $("[data-mon-rang]").innerHTML = rangTxt(moi.rang);
    $("[data-mon-titre]").textContent = amis
      ? `Sur ${d.total} dans ta bande`
      : `Sur ${fmt.nombre(d.total)} joueur${d.total > 1 ? "s" : ""}`;
    $("[data-mon-ecart]").textContent = moi.prochain
      ? `Encore ${fmt.nombre(moi.prochain.ecart)} XP pour dépasser ${moi.prochain.pseudo}`
      : amis ? "Tu mènes la bande !" : "Tu es en tête, garde ta place !";
  }

  function observerMaLigne() {
    const barre = $("[data-ma-position]");
    if (etat.observateur) etat.observateur.disconnect();
    const cibles = [$("[data-moi]"), $(".marche.is-moi")].filter(Boolean);
    if (!cibles.length || !("IntersectionObserver" in window)) { barre.classList.remove("is-cachee"); return; }
    const visibles = new Set();
    etat.observateur = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visibles.add(e.target) : visibles.delete(e.target)));
      barre.classList.toggle("is-cachee", visibles.size > 0);
    }, { rootMargin: "0px 0px -140px 0px" });
    cibles.forEach((c) => etat.observateur.observe(c));
  }

  function signalerChangement(d) {
    const cle = etat.periode;
    const avant = etat.dernierRang[cle];
    etat.dernierRang[cle] = d.moi.rang;
    if (avant === undefined || avant === d.moi.rang) return;
    const barre = $("[data-ma-position]");
    barre.classList.remove("is-change"); void barre.offsetWidth; barre.classList.add("is-change");
    if (d.moi.rang < avant) App.toast(`Tu gagnes ${avant - d.moi.rang} place${avant - d.moi.rang > 1 ? "s" : ""} !`);
  }

  /* ======================================================================
     Recherche
     ====================================================================== */
  $("[data-recherche]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const champ = $("#chercher");
    const zone = $("[data-resultat-recherche]");
    const texte = champ.value.trim();
    if (!texte) { zone.hidden = true; return; }

    // D'abord dans ce qui est affiché
    const visible = $$("[data-pseudo]").find((li) => li.dataset.pseudo.toLowerCase().includes(texte.toLowerCase()));
    if (visible) {
      zone.hidden = true;
      visible.scrollIntoView({ block: "center", behavior: App.reduceMotion ? "auto" : "smooth" });
      visible.classList.remove("is-trouve"); void visible.offsetWidth; visible.classList.add("is-trouve");
      return;
    }
    const bouton = $("[type=submit]", e.target);
    if (bouton.getAttribute("aria-busy") === "true") return;   // une recherche à la fois
    bouton.setAttribute("aria-busy", "true");
    let res;
    try { res = await api.chercherJoueur(texte, etat.periode); }
    catch (err) { App.toast("La recherche n'a pas abouti. Réessaie."); return; }
    finally { bouton.removeAttribute("aria-busy"); }
    zone.hidden = false;
    if (res.statut === "court") {
      zone.innerHTML = `<p class="message message--info">${icon("info")}<span>Tape au moins 3 lettres.</span></p>`;
    } else if (res.statut === "aucun") {
      zone.innerHTML = `<p class="message message--info">${icon("info")}<span>Aucun joueur trouvé pour « ${esc(texte)} ».</span></p>`;
    } else {
      zone.innerHTML = `<ol class="rangs-cl">${res.resultats.map((r) => ligne({ ...r, rangNom: "Résultat de recherche" })).join("")}</ol>`;
    }
  });
  $("#chercher").addEventListener("input", (e) => { if (!e.target.value) $("[data-resultat-recherche]").hidden = true; });

  /* ======================================================================
     Ajout d'ami
     ====================================================================== */
  const dialogue = $("[data-dialogue-ami]");
  const champAmi = $("#code-ami");
  const etatAmi = $("[data-ami-etat]");

  $("[data-ouvrir-ami]").addEventListener("click", () => {
    $("[data-mon-code]").textContent = session.get().pseudo;
    $("[data-demo-ami]").hidden = !App.mock;
    etatAmi.textContent = "";
    etatAmi.className = "champ__etat";
    dialogue.showModal();
  });
  $("[data-fermer-ami]").addEventListener("click", () => dialogue.close());
  dialogue.addEventListener("click", (e) => { if (e.target === dialogue) dialogue.close(); });

  champAmi.addEventListener("input", () => {
    $("[data-champ-ami]").classList.remove("is-invalide");
    etatAmi.textContent = "";
  });
  $$("[data-code-demo]").forEach((b) => b.addEventListener("click", () => {
    champAmi.value = b.dataset.codeDemo;
    $("[data-champ-ami]").classList.remove("is-invalide");
    etatAmi.textContent = "";
    champAmi.focus();
  }));

  const ERREURS_AMI = {
    inconnu: "Aucun joueur avec ce pseudo. Vérifie l'orthographe exacte.",
    deja: "Il est déjà dans ta bande.",
    soi: "C'est ton propre pseudo !",
    plein: "Ta bande est complète (30 amis)."
  };

  $("[data-form-ami]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const bouton = $("[type=submit]", e.target);
    if (bouton.getAttribute("aria-busy") === "true") return;
    if (champAmi.value.trim().length < 2) {
      $("[data-champ-ami]").classList.add("is-invalide");
      etatAmi.className = "champ__etat is-ko";
      etatAmi.innerHTML = `${icon("alerte")} Tape le pseudo de ton ami.`;
      champAmi.focus();
      return;
    }
    bouton.setAttribute("aria-busy", "true");
    let res;
    try { res = await api.ajouterAmi(champAmi.value); }
    catch (err) { res = { ok: false, erreur: "reseau" }; }
    finally { bouton.removeAttribute("aria-busy"); }
    if (res.erreur === "reseau") {
      etatAmi.className = "champ__etat is-ko";
      etatAmi.innerHTML = `${icon("alerte")} Réseau saturé, réessaie dans un instant.`;
      return;
    }
    if (!res.ok) {
      $("[data-champ-ami]").classList.toggle("is-invalide", res.erreur === "inconnu");
      etatAmi.className = "champ__etat is-ko";
      etatAmi.innerHTML = `${icon("alerte")} ${ERREURS_AMI[res.erreur]}`;
      return;
    }
    dialogue.close();
    champAmi.value = "";
    App.toast(`${res.ami.pseudo} fait maintenant partie de ta bande.`);
    await charger();
    const li = $(`[data-pseudo="${CSS.escape(res.ami.pseudo)}"]`);
    if (li) { li.scrollIntoView({ block: "center" }); li.classList.add("is-trouve"); }
  });

  /* ======================================================================
     Démarrage et actualisation en direct
     ====================================================================== */
  const depart = location.hash.slice(1);
  choisir(PERIODES.includes(depart) ? depart : "general", { charge: false });
  await charger({ squelette: true });

  // Rien quand l'écran est éteint ; 1 / 60 s sinon (voir data/PERFORMANCE.md)
  const sonde = App.sonder(() => (dialogue.open ? null : charger()), { toutesLes: 60000, immediat: false });
  window.addEventListener("pagehide", () => sonde.arreter());
});
