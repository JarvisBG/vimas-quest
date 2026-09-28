/* ==========================================================================
   Console — tableau de bord (étape 6.1), style Game Master d'Otaku
   Lecture : console_accueil() = tout l'écran en un appel. Relue au signal du
   temps réel (événement, annonce, phase), au plus 1 / 5 s ; filet 60 s
   (20 s canal coupé) ; rien quand l'onglet est caché.
   Écritures : admin_set_phase, admin_publier_annonce (bouton verrouillé,
   jamais réessayées).
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  const acces = await C.garde();
  if (!acces) return;

  /* Les trois phases. Le blind test ne se lance pas d'ici : c'est la régie
     (admin_quiz_start) qui bascule le jeu en phase RAID avec sa manche. */
  const PHASES = [
    { cle: "EXPLORATION", nom: "Jeu ouvert", icone: "valide", couleur: "var(--success)",
      aide: "Mode normal : scans, missions, roue et votes sont ouverts." },
    { cle: "RAID", nom: "Blind test", icone: "micro", couleur: "var(--violet)", regie: true,
      aide: "Une manche est en cours : les missions attendent la fin. Se lance depuis la régie (Animation → Régie blind test)." },
    { cle: "CLOTURE", nom: "Jeu terminé", icone: "cadenas", couleur: "var(--gold)",
      aide: "Jeu figé (plus de scans, votes ni tirages), podium sur l'écran géant. À la fin du festival." }
  ];
  const phaseDe = (p) => PHASES.find((x) => x.cle === (p === "QUIZ" ? "RAID" : p));

  /* Couleur du point du fil, comme la timeline d'Otaku */
  const COULEURS = {
    bonus: "var(--gold)", kill_switch: "var(--danger)", phase: "var(--blue)", badge: "var(--gold)",
    quete: "var(--success)", roulette: "var(--violet)", scan: "var(--violet)", raid: "var(--danger)",
    quiz: "var(--danger)", sondage: "var(--cyan)", profil: "var(--cyan)"
  };

  let etat = null;

  /* ---------- Rendu ---------- */
  function rendre(d) {
    etat = d;
    $("[data-erreur-lecture]")?.remove();
    const jour = d.jour ? new Date(`${d.jour}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "";
    $("[data-jour]").textContent = `Journée de jeu du ${jour} · depuis 6 h, heure du Cameroun`;
    rendreChiffres(d.chiffres);
    rendrePhase(d);
    rendreTop(d.top, d.roi_veille);
    rendreFil(d.fil);
    rendreAnnonces(d.annonces);
    rendreBonus(d.bonus);
    rendreContenu(d.contenu);
  }

  function chiffre(val, nom, icone, teinte, plus = "", alerte = false) {
    return `<div class="cchiffre${alerte ? " cchiffre--alerte" : ""}">
      <span class="cchiffre__icone cchiffre__icone--${teinte}">${App.icon(icone)}</span>
      <span class="cchiffre__val">${val}</span>
      <span class="cchiffre__nom">${esc(nom)}</span>${plus ? `<span class="cchiffre__plus">${esc(plus)}</span>` : ""}</div>`;
  }

  function rendreChiffres(c) {
    const n = C.nombre;
    $("[data-chiffres]").innerHTML = [
      chiffre(n(c.joueurs), "Joueurs inscrits", "passeport", "violet", `+ ${n(c.nouveaux_jour)} aujourd'hui`),
      chiffre(n(c.joueurs_jour), "Ont joué aujourd'hui", "eclair", "vert", "au moins 1 XP depuis 6 h"),
      chiffre(n(c.scans_jour), "Scans du jour", "qr", "bleu"),
      chiffre(n(c.xp_jour), "XP du jour", "etoile", "or"),
      c.billetterie ? chiffre(n(c.tickets_jour), "Journées ouvertes", "billet", "cyan", "tickets utilisés aujourd'hui") : "",
      chiffre(n(c.exclus), "Joueurs exclus", "croix", "rouge", "", c.exclus > 0)
    ].join("");
  }

  function rendrePhase(d) {
    const actuelle = phaseDe(d.phase);
    $("[data-phases]").innerHTML = PHASES.map((p) => {
      const on = actuelle && p.cle === actuelle.cle;
      return `<button class="cphase__btn" type="button" data-vers="${p.cle}" style="--phase:${p.couleur}"
        aria-pressed="${on}"${p.regie && !on ? " disabled" : ""}>
        ${App.icon(p.icone)}<span>${esc(p.nom)}${on ? "<small>PHASE ACTIVE</small>" : p.regie ? "<small>depuis la régie</small>" : ""}</span></button>`;
    }).join("");
    $("[data-phase-aide]").textContent = actuelle ? actuelle.aide : `Phase inconnue : ${d.phase}`;

    const m = d.manche;
    const bloc = $("[data-manche]");
    bloc.hidden = !m;
    if (m) {
      bloc.innerHTML = `${App.icon("micro")}<span>Manche en cours : <strong>${esc(m.titre)}</strong>${m.boss ? ` avec ${esc(m.boss)}` : ""}, question ${m.question} sur ${m.questions}. <a href="blind-test.html">Piloter depuis la régie</a>.</span>`;
    }
  }

  function rendreTop(top, roi) {
    const r = $("[data-roi]");
    r.hidden = !roi;
    if (roi) r.textContent = `Roi de ${roi.jour_label} : ${roi.pseudo} (${C.nombre(roi.points)} XP)`;
    const el = $("[data-top]");
    if (!top.length) { el.innerHTML = '<li class="cvide">Personne n\'a encore gagné d\'XP aujourd\'hui.</li>'; return; }
    el.innerHTML = top.map((p, i) => `<li>
      <span class="cliste__place cliste__place--${i + 1}">${i + 1}</span>
      <span class="cliste__texte"><strong>${esc(p.pseudo)}</strong></span>
      <span class="cliste__val">${C.nombre(p.points)} XP</span></li>`).join("");
  }

  function rendreFil(fil) {
    const el = $("[data-fil]");
    if (!fil.length) { el.innerHTML = '<li class="cvide">Aucune activité pour l\'instant : le fil démarre au premier badge, à la première mission ou au premier bonus.</li>'; return; }
    el.innerHTML = fil.map((e) => `<li>
      <span class="cliste__point" style="--c:${COULEURS[e.type] || "var(--cyan)"}"></span>
      <span class="cliste__texte">${esc(e.message || (e.pseudo ? `${e.pseudo} · ${e.type}` : e.type))}<time>${esc(C.ilYa(e.at))}</time></span></li>`).join("");
  }

  function rendreAnnonces(a) {
    $("[data-annonces-nb]").textContent = a.en_cours ? `${a.en_cours} en cours` : "aucune en cours";
    const niveaux = { danger: ["danger", "Urgent"], alerte: ["alerte", "Important"], succes: ["succes", "Info"], info: ["", "Info"] };
    $("[data-annonces]").innerHTML = a.dernieres.map((x) => {
      const [cls, nom] = niveaux[x.type] || niveaux.info;
      return `<li><span class="cbadge${cls ? ` cbadge--${cls}` : ""}">${nom}</span>
        <span class="cliste__texte">${x.titre ? `<strong>${esc(x.titre)}</strong> · ` : ""}${esc(x.message)}<time>${esc(C.ilYa(x.created_at))}</time></span></li>`;
    }).join("");
  }

  /* Le garde-fou des bonus sans plafond : le total par personne se lit d'un coup d'œil */
  function rendreBonus(b) {
    $("[data-bonus-total]").textContent = `${C.nombre(b.total)} XP · ${C.nombre(b.gestes)} geste${b.gestes > 1 ? "s" : ""}`;
    const el = $("[data-bonus]");
    if (!b.gestes) { el.innerHTML = '<p class="cvide">Aucun point offert aujourd\'hui.</p>'; return; }
    el.innerHTML = `<ul class="cliste">${b.par.map((p) => `<li>
        <span class="cliste__texte"><strong>${esc(p.par)}</strong> · ${p.gestes} geste${p.gestes > 1 ? "s" : ""}</span>
        <span class="cliste__val">${C.nombre(p.xp)} XP</span></li>`).join("")}</ul>
      <p class="csous-titre">Derniers gestes</p>
      <ul class="cliste">${b.derniers.map((g) => `<li>
        <span class="cliste__quand">${esc(C.ilYa(g.at))}</span>
        <span class="cliste__texte">${esc(g.par)} → <strong>${esc(g.joueur || "joueur effacé")}</strong>${g.motif ? ` · ${esc(g.motif)}` : ""}</span>
        <span class="cliste__val">+${C.nombre(g.xp)}</span></li>`).join("")}</ul>`;
  }

  function rendreContenu(c) {
    const cases = [
      [c.qr_actifs, "QR actifs", c.qr > c.qr_actifs ? `${c.qr} en tout` : ""],
      [c.missions, "missions actives"],
      [c.lots, "lots de la roue"],
      [c.artistes, "artistes"],
      [c.concerts, "concerts"],
      [c.lieux_places, "lieux placés", c.lieux > c.lieux_places ? `${c.lieux} en tout` : ""],
      [c.manches, "manches prêtes"]
    ];
    $("[data-contenu]").innerHTML = cases.map(([n, nom, plus]) => `<div class="cpret${n ? "" : " is-vide"}">
      <strong>${C.nombre(n)}</strong><span>${esc(nom)}${plus ? ` (${esc(plus)})` : ""}</span></div>`).join("");
  }

  /* ---------- Lecture + temps réel ---------- */
  const zone = $("[data-console-contenu]");
  async function relire() {
    try {
      rendre(await C.appel("console_accueil"));
    } catch (e) {
      if (!etat && !$("[data-erreur-lecture]")) {
        zone.insertAdjacentHTML("afterbegin", `<p class="message" role="alert" data-erreur-lecture>${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`);
      }
      throw e;
    }
  }
  const direct = C.suivre("console-accueil",
    [["INSERT", "events"], ["*", "announcements"], ["UPDATE", "game_state"]], relire);

  /* ---------- Phase ---------- */
  $("[data-phases]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-vers]");
    if (!b || b.disabled || b.getAttribute("aria-pressed") === "true") return;
    const vers = b.dataset.vers;
    const ok = await C.confirmer(vers === "CLOTURE"
      ? { titre: "Terminer le jeu ?", texte: "Plus aucun scan, vote ni tirage ne sera accepté, et le podium s'affiche sur l'écran géant. À faire à la fin du festival.", oui: "Terminer le jeu", danger: true }
      : { titre: "Rouvrir le jeu ?", texte: etat && etat.manche ? "Une manche de blind test est encore en cours : mieux vaut la terminer depuis la régie." : "Scans, missions, roue et votes reprennent pour tout le monde.", oui: "Rouvrir le jeu" });
    if (!ok) return;
    const liberer = C.occuper(b);
    if (liberer === null) return;
    try {
      await C.appel("admin_set_phase", { p_phase: vers });
      App.toast(vers === "CLOTURE" ? "Le jeu est terminé." : "Le jeu est rouvert.");
      direct.maintenant();
    } catch (err) {
      App.toast(C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Annonce rapide ---------- */
  const form = $("[data-alerte]");
  const erreur = $("[data-alerte-erreur]");
  const montrerErreur = (texte) => {
    erreur.innerHTML = texte ? `${App.icon("alerte")}<span>${esc(texte)}</span>` : "";
    erreur.hidden = !texte;
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = form.message.value.trim();
    montrerErreur("");
    if (!message) { montrerErreur(C.messages.MESSAGE_VIDE); return; }
    const liberer = C.occuper(form.querySelector('[type="submit"]'));
    if (liberer === null) return;
    try {
      await C.appel("admin_publier_annonce", {
        p_titre: form.titre.value.trim() || null, p_message: message,
        p_type: form.niveau.value, p_categorie: form.categorie.value
      });
      form.reset();
      App.toast("Annonce publiée.");
      direct.maintenant();
    } catch (err) {
      montrerErreur(C.message(err));
    } finally { liberer(); }
  });
});
