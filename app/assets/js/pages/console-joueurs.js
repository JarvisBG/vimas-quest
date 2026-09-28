/* ==========================================================================
   Console — écran Joueurs (étape 6.2), style Game Master d'Otaku
   Lecture : console_joueurs (50 par page, triés par XP) au chargement, puis
   seulement quand on valide une recherche, change un filtre ou une page :
   jamais à la frappe, jamais d'interrogation régulière (la liste ne sert
   qu'à trouver quelqu'un). Fiche : console_joueur, un appel.
   Écritures (bouton verrouillé, jamais réessayées) : admin_validate_quest,
   admin_award_bonus, admin_award_badge, admin_rename_player,
   admin_set_status, admin_get_reconnect_code (tracé), admin_effacer_joueur
   (GM). Après une écriture, la fiche est relue (1 appel) et sa ligne de la
   liste corrigée sur place, sans relire la liste.
   Scan : QR « DQ-JOUEUR:<id> » du téléphone (page Missions) → fiche.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    FILTRE_INVALIDE: "Filtre inconnu.",
    JOUEUR_INCONNU: "Ce joueur n'existe pas (ou plus : effacé).",
    JOUEUR_EXCLU: "Ce joueur est exclu : réintègre-le d'abord.",
    BONUS_INVALIDE: "Le bonus va de 1 à 5 000 XP (jamais de malus).",
    PSEUDO_INVALIDE: "Le pseudo doit faire de 2 à 16 caractères.",
    PSEUDO_DEJA_PRIS: "Ce pseudo est déjà pris.",
    QUETE_DEJA_VALIDEE: "Mission déjà validée aujourd'hui pour ce joueur.",
    QUETE_INACTIVE: "Cette mission est désactivée.",
    QUETE_NON_MANUELLE: "Cette mission ne se valide pas au stand.",
    QUETE_INCONNUE: "Mission introuvable.",
    PASS_REQUIS: "Pas de ticket pour aujourd'hui : la mission ne peut pas être validée. Le joueur doit d'abord activer son ticket.",
    BADGE_DEJA_POSSEDE: "Il a déjà ce badge.",
    BADGE_INCONNU: "Badge introuvable.",
    CONFIRMATION_INVALIDE: "Le pseudo retapé ne correspond pas : rien n'a été effacé.",
    STATUT_INVALIDE: "Statut inconnu."
  });

  const acces = await C.garde();
  if (!acces) return;

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const n = C.nombre;
  const date = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const heure = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
  const initiale = (p) => esc((p || "?").trim().charAt(0).toUpperCase() || "?");
  const pluriel = (x, mot) => `${n(x)} ${mot}${x > 1 ? "s" : ""}`;

  /* Message passager. Une boîte ouverte (fiche) est au premier plan et voile
     le reste de la page : la zone des messages la suit dedans. */
  function dire(texte) {
    App.toast(texte, { duree: 4500 });
    const zone = $("#toast-zone");
    const hote = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
    if (zone && zone.parentNode !== hote) hote.append(zone);
  }

  /* ======================================================================
     La liste
     ====================================================================== */
  const form = $("[data-recherche]");
  const lignes = $("[data-lignes]");
  const q = { texte: "", filtre: "", rang: "", page: 0 };
  let liste = null;          // dernière réponse de console_joueurs
  let enCours = false, encore = false;

  async function charger() {
    if (enCours) { encore = true; return; }
    enCours = true;
    form.querySelector('[type="submit"]').setAttribute("aria-busy", "true");
    try {
      liste = await C.appel("console_joueurs", {
        p_recherche: q.texte || null, p_filtre: q.filtre || null, p_rang: q.rang || null, p_page: q.page
      });
      rendreListe();
    } catch (e) {
      lignes.innerHTML = `<tr><td colspan="7"><p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p></td></tr>`;
    } finally {
      enCours = false;
      form.querySelector('[type="submit"]').removeAttribute("aria-busy");
      if (encore) { encore = false; charger(); }
    }
  }

  function celluleJournee(j) {
    let pastille = "";
    if (liste.billetterie) {
      pastille = j.ticket_jour
        ? `<span class="cbadge cbadge--succes">${App.icon("billet")} Ticket du jour</span>`
        : `<span class="cbadge cbadge--danger">${App.icon("cadenas")} Sans ticket</span>`;
    }
    const sous = j.jours_joues >= 2 ? `<span class="ctable__sous is-revenu">Revenu · ${n(j.jours_joues)} journées</span>`
      : j.actions_jour ? `<span class="ctable__sous">${pluriel(j.actions_jour, "action")} aujourd'hui</span>`
      : `<span class="ctable__sous">Pas encore joué aujourd'hui</span>`;
    return pastille + sous;
  }

  function rendreListe() {
    const d = liste;
    const r = d.resume;
    $("[data-resume]").textContent = [
      pluriel(r.joueurs, "joueur"),
      `${n(r.joue_jour)} ${r.joue_jour > 1 ? "ont" : "a"} joué aujourd'hui`,
      d.billetterie ? `${n(r.tickets_jour)} ticket${r.tickets_jour > 1 ? "s" : ""} du jour` : "jeu gratuit (billetterie coupée)",
      r.exclus ? pluriel(r.exclus, "exclu") : ""
    ].filter(Boolean).join(" · ");
    form.querySelectorAll("[data-billet]").forEach((o) => { o.hidden = !d.billetterie; });

    if (!d.joueurs.length) {
      lignes.innerHTML = `<tr><td colspan="7" class="cvide">${d.total ? "Plus personne après cette page." : q.texte || q.filtre || q.rang ? "Aucun joueur ne correspond." : "Aucun joueur inscrit pour l'instant."}</td></tr>`;
    } else {
      lignes.innerHTML = d.joueurs.map((j) => `<tr data-id="${esc(j.id)}">
        <td><div class="cjoueur">
          <span class="cjoueur__avatar">${initiale(j.pseudo)}</span>
          <span class="cjoueur__nom"><strong>${esc(j.pseudo)}</strong>
            <small><span class="cjoueur__rang">${esc(j.rang)} · </span>niv. ${n(j.niveau)}</small></span></div></td>
        <td class="ctable__large">${esc(j.rang)}</td>
        <td class="ctable__nb"><strong>${n(j.xp)}</strong>${j.xp_jour ? `<span class="ctable__sous">+${n(j.xp_jour)} aujourd'hui</span>` : ""}</td>
        <td>${j.statut === "actif" ? '<span class="cbadge cbadge--succes">Actif</span>' : '<span class="cbadge cbadge--danger">Exclu</span>'}</td>
        <td class="ctable__large">${celluleJournee(j)}</td>
        <td class="ctable__large ctable__date">${esc(date(j.inscrit))}</td>
        <td class="ctable__action"><button class="cbtn" type="button" data-ouvrir="${esc(j.id)}">Fiche</button></td>
      </tr>`).join("");
    }

    const debut = d.page * d.par_page;
    $("[data-pages-texte]").textContent = d.total
      ? `${n(Math.min(debut + 1, d.total))} – ${n(Math.min(debut + d.joueurs.length, d.total))} sur ${n(d.total)} · triés par XP`
      : "";
    $('[data-page="-1"]').disabled = d.page === 0;
    $('[data-page="1"]').disabled = debut + d.joueurs.length >= d.total;
  }

  /* Recherche : seulement quand on valide (Entrée ou bouton) */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const texte = form.texte.value.trim();
    const m = texte.match(/^DQ-JOUEUR:(.+)$/i);         // code collé depuis un lecteur externe
    if (m && UUID.test(m[1])) { ouvrirFiche(m[1]); return; }
    q.texte = texte;
    q.page = 0;
    charger();
  });
  [form.filtre, form.rang].forEach((s) => s.addEventListener("change", () => {
    q.filtre = form.filtre.value;
    q.rang = form.rang.value;
    q.page = 0;
    charger();
  }));
  document.querySelectorAll("[data-page]").forEach((b) => b.addEventListener("click", () => {
    q.page = Math.max(0, q.page + Number(b.dataset.page));
    charger();
    $("[data-console-contenu]").scrollIntoView({ block: "start" });
  }));
  lignes.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ouvrir]");
    const tr = e.target.closest("tr[data-id]");
    if (b) ouvrirFiche(b.dataset.ouvrir);
    else if (tr && !window.getSelection().toString()) ouvrirFiche(tr.dataset.id);
  });

  /* ======================================================================
     La fiche
     ====================================================================== */
  const fiche = $("[data-fiche]");
  const corps = $("[data-f-corps]");
  let f = null;              // dernière réponse de console_joueur
  let ficheId = null;

  async function ouvrirFiche(id, { missions = false } = {}) {
    ficheId = id;
    f = null;
    $("[data-f-pseudo]").textContent = "…";
    $("[data-f-sous]").textContent = "";
    $("[data-f-initiale]").textContent = "?";
    corps.innerHTML = '<p class="cvide">Chargement…</p>';
    if (!fiche.open) fiche.showModal();
    try { history.replaceState(null, "", `#${id}`); } catch (e) { /* ignore */ }
    await relireFiche();
    if (missions && f) $("[data-f-missions]", corps)?.scrollIntoView({ block: "start" });
  }

  async function relireFiche() {
    const id = ficheId;
    try {
      const d = await C.appel("console_joueur", { p_player_id: id });
      if (id !== ficheId) return;
      f = d;
      rendreFiche();
      corrigerLigne(d);
    } catch (e) {
      if (id !== ficheId) return;
      corps.innerHTML = `<p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`;
    }
  }

  /* La ligne de la liste suit la fiche : pas besoin de relire la liste */
  function corrigerLigne(d) {
    if (!liste) return;
    const j = liste.joueurs.find((x) => x.id === d.joueur.id);
    if (!j) return;
    Object.assign(j, {
      pseudo: d.joueur.pseudo, xp: d.joueur.xp, jetons: d.joueur.jetons, niveau: d.joueur.niveau,
      rang: d.joueur.rang, statut: d.joueur.statut, xp_jour: d.joueur.xp_jour,
      ticket_jour: d.ticket_jour, actions_jour: d.actions_jour, jours_joues: d.jours_joues
    });
    rendreListe();
  }

  function stat(val, nom) {
    return `<div class="cfiche__stat"><strong>${val}</strong><span>${esc(nom)}</span></div>`;
  }

  function rendreFiche() {
    const d = f;
    const j = d.joueur;
    const exclu = j.statut !== "actif";
    $("[data-f-pseudo]").textContent = j.pseudo;
    $("[data-f-initiale]").textContent = (j.pseudo || "?").charAt(0).toUpperCase();
    $("[data-f-sous]").textContent = `${j.rang} · niveau ${j.niveau} · inscrit le ${date(j.inscrit)}${d.genre ? ` · aime : ${d.genre}` : ""}`;

    const ticket = !d.billetterie ? "Jeu gratuit" : d.ticket_jour ? "Oui" : "Non";
    const sansTicket = d.billetterie && !d.ticket_jour;

    const missions = d.missions.length ? `<ul class="cliste">${d.missions.map((m) => `<li class="cmission">
        <span class="cliste__texte"><strong>${esc(m.titre)}</strong> · +${n(m.xp)} XP${m.badge ? ` · badge « ${esc(m.badge)} »` : ""}
          <span class="cmission__consigne">${m.consigne ? esc(m.consigne) : "⚠ Aucune consigne écrite pour cette mission (à compléter, écran Missions 6.3)."}</span></span>
        ${m.validee
          ? `<span class="cbadge cbadge--succes">${App.icon("coche")} ${esc(heure(m.validee))}</span>`
          : `<button class="cbtn cbtn--primaire" type="button" data-valider="${esc(m.id)}"${exclu ? " disabled" : ""}>Valider</button>`}
      </li>`).join("")}</ul>`
      : '<p class="cvide">Aucune mission « validée par le staff » n\'est active. Elles se créent à l\'écran Missions (6.3).</p>';

    const possedes = d.badges.filter((b) => b.obtenu);
    const autres = d.badges.filter((b) => !b.obtenu);

    corps.innerHTML = `
      ${exclu ? `<p class="message" role="status">${App.icon("croix")}<span><strong>Joueur exclu</strong> : ses scans sont refusés et son écran est verrouillé. Sa progression est gardée.</span></p>` : ""}
      <div class="cfiche__stats">
        ${stat(n(j.xp), "XP")}
        ${stat(n(j.jetons), "jetons")}
        ${stat(`+${n(j.xp_jour)}`, "XP aujourd'hui")}
        ${stat(d.place ? `${n(d.place)}<sup>e</sup>` : "—", "au général")}
        ${stat(n(d.jours_joues), d.jours_joues > 1 ? "journées jouées" : "journée jouée")}
        ${stat(ticket, "ticket du jour")}
      </div>

      <section class="cfiche__bloc" data-f-missions>
        <h3 class="csous-titre">Missions validées au stand</h3>
        ${sansTicket && d.missions.length ? `<p class="message message--info">${App.icon("billet")}<span>Pas de ticket pour aujourd'hui : la base refusera la validation. Le bonus, lui, passe.</span></p>` : ""}
        ${missions}
      </section>

      <section class="cfiche__bloc">
        <h3 class="csous-titre">Bonus XP</h3>
        <form class="cform cform--ligne" data-bonus novalidate>
          <div class="champ">
            <label class="champ__label" for="b-xp">XP (1 à 5 000)</label>
            <input class="saisie" id="b-xp" name="xp" type="number" min="1" max="5000" step="10" value="50" inputmode="numeric">
          </div>
          <div class="champ champ--large">
            <label class="champ__label" for="b-motif">Motif (journal)</label>
            <input class="saisie" id="b-motif" name="motif" maxlength="80" autocomplete="off" placeholder="ex. Gagnant du concours de danse">
          </div>
          <button class="cbtn cbtn--primaire" type="submit"${exclu ? " disabled" : ""}>${App.icon("cadeau")} Accorder</button>
        </form>
        <p class="champ__aide">1 jeton pour 10 XP. Passe même sans ticket du jour. Chaque geste s'affiche au tableau de bord (points offerts).</p>
      </section>

      <section class="cfiche__bloc">
        <h3 class="csous-titre">Badges · ${n(possedes.length)} sur ${n(d.badges.length)}</h3>
        <p class="cpuces">${possedes.length ? possedes.map((b) => `<span class="cpuce cpuce--${esc(b.rarete || "commun")}" title="Obtenu le ${esc(date(b.obtenu))} à ${esc(heure(b.obtenu))}">${App.icon(b.icone || "etoile")} ${esc(b.nom)}</span>`).join("") : '<span class="cvide">Aucun badge pour l\'instant.</span>'}</p>
        ${autres.length ? `<form class="cform cform--ligne" data-badge>
          <div class="champ champ--large">
            <label class="champ__label" for="g-badge">Décerner un badge</label>
            <select class="saisie" id="g-badge" name="badge">${autres.map((b) => `<option value="${esc(b.id)}">${esc(b.nom)}${b.secret ? " (secret)" : ""}${b.systeme ? " · automatique" : ""}</option>`).join("")}</select>
          </div>
          <button class="cbtn" type="submit"${exclu ? " disabled" : ""}>${App.icon("etoile")} Décerner</button>
        </form>` : ""}
      </section>

      <section class="cfiche__bloc">
        <h3 class="csous-titre">Code de reprise</h3>
        <div class="ccode" data-code>
          <button class="cbtn" type="button" data-code-voir>${App.icon("cadenas")} Afficher le code</button>
          <span class="champ__aide">Téléphone perdu ou changé : le joueur reprend sa carte avec ce code. Chaque lecture est notée.</span>
        </div>
        ${d.codes_lus.length ? `<p class="champ__aide">Déjà lu par ${d.codes_lus.map((c) => `${esc(c.par)} (${esc(C.ilYa(c.at))})`).join(", ")}.</p>` : ""}
      </section>

      <section class="cfiche__bloc">
        <h3 class="csous-titre">Renommer</h3>
        <form class="cform cform--ligne" data-renommer novalidate>
          <div class="champ champ--large">
            <label class="champ__label" for="n-pseudo">Nouveau pseudo (2 à 16 caractères)</label>
            <input class="saisie" id="n-pseudo" name="pseudo" maxlength="16" autocomplete="off" value="${esc(j.pseudo)}">
          </div>
          <button class="cbtn" type="submit">Renommer</button>
        </form>
        <p class="champ__aide">Pour un pseudo déplacé : il garde toute sa progression et son code.</p>
      </section>

      <section class="cfiche__bloc">
        <h3 class="csous-titre">Derniers faits</h3>
        ${d.faits.length ? `<ul class="cliste">${d.faits.map((e) => `<li>
          <span class="cliste__quand">${esc(C.ilYa(e.at))}</span>
          <span class="cliste__texte">${esc(e.message || e.type)}</span></li>`).join("")}</ul>` : '<p class="cvide">Rien pour l\'instant.</p>'}
      </section>

      <section class="cfiche__bloc cfiche__sensible">
        <h3 class="csous-titre">Zone sensible</h3>
        <div class="cfiche__boutons">
          <button class="cbtn ${exclu ? "" : "cbtn--danger"}" type="button" data-statut>${exclu ? "Réintégrer le joueur" : `${App.icon("croix")} Exclure du jeu`}</button>
          ${acces.gm ? `<button class="cbtn cbtn--danger" type="button" data-effacer>${App.icon("alerte")} Effacer ses données</button>` : ""}
        </div>
        <p class="champ__aide">Exclure bloque ses scans tout de suite ; c'est réversible. ${acces.gm ? "Effacer (demande du joueur au stand) est définitif : pseudo, code et téléphone disparaissent, son historique devient anonyme." : "L'effacement des données est réservé au Game Master."}</p>
      </section>`;
  }

  /* Un bouton, un appel, puis la fiche relue */
  async function agir(bouton, appel, succes) {
    const liberer = C.occuper(bouton);
    if (liberer === null) return false;
    try {
      const r = await appel();
      if (succes) dire(typeof succes === "function" ? succes(r) : succes);
      await relireFiche();
      return true;
    } catch (e) {
      dire(C.message(e));
      return false;
    } finally { liberer(); }
  }

  corps.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fo = e.target;
    const bouton = fo.querySelector('[type="submit"]');
    const j = f && f.joueur;
    if (!j) return;

    if (fo.matches("[data-bonus]")) {
      const xp = Number(fo.xp.value);
      if (!Number.isInteger(xp) || xp < 1 || xp > 5000) { dire(C.messages.BONUS_INVALIDE); return; }
      await agir(bouton, () => C.appel("admin_award_bonus", { p_player_id: j.id, p_xp: xp, p_reason: fo.motif.value.trim() || null }),
        `+${n(xp)} XP accordés à ${j.pseudo}.`);
    }
    if (fo.matches("[data-badge]")) {
      const option = fo.badge.selectedOptions[0];
      await agir(bouton, () => C.appel("admin_award_badge", { p_player_id: j.id, p_badge_id: fo.badge.value }),
        `Badge « ${option ? option.textContent.replace(/ \(secret\)| · automatique/g, "") : ""} » décerné à ${j.pseudo}.`);
    }
    if (fo.matches("[data-renommer]")) {
      const pseudo = fo.pseudo.value.trim();
      if (pseudo === j.pseudo) return;
      if (pseudo.length < 2 || pseudo.length > 16) { dire(C.messages.PSEUDO_INVALIDE); return; }
      await agir(bouton, () => C.appel("admin_rename_player", { p_player_id: j.id, p_pseudo: pseudo }),
        `${j.pseudo} s'appelle désormais ${pseudo}.`);
    }
  });

  corps.addEventListener("click", async (e) => {
    const j = f && f.joueur;
    if (!j) return;

    const valider = e.target.closest("[data-valider]");
    if (valider) {
      const m = f.missions.find((x) => x.id === valider.dataset.valider);
      const ok = await C.confirmer({
        titre: `Valider « ${m.titre} » ?`,
        texte: `${m.consigne ? `Consigne : ${m.consigne} ` : ""}${j.pseudo} gagne ${n(m.xp)} XP${m.badge ? ` et le badge « ${m.badge} »` : ""}. Une fois par jour.`,
        oui: "Valider la mission"
      });
      if (!ok) return;
      await agir(valider, () => C.appel("admin_validate_quest", { p_player_id: j.id, p_quest_id: m.id }),
        (r) => `Mission « ${r.quest} » validée pour ${j.pseudo} (+${n(r.xp)} XP).`);
      return;
    }

    const voir = e.target.closest("[data-code-voir]");
    if (voir) {
      const liberer = C.occuper(voir);
      if (liberer === null) return;
      try {
        const code = await C.appel("admin_get_reconnect_code", { p_player_id: j.id });
        $("[data-code]", corps).innerHTML = `<strong class="ccode__valeur">${esc(code)}</strong>
          <span class="champ__aide">À dicter au joueur, jamais à envoyer par message. Lecture notée à ton nom.</span>`;
      } catch (err) {
        dire(C.message(err));
        liberer();
      }
      return;
    }

    const statut = e.target.closest("[data-statut]");
    if (statut) {
      const exclure = j.statut === "actif";
      const ok = await C.confirmer(exclure
        ? { titre: `Exclure ${j.pseudo} ?`, texte: "Ses scans sont refusés et son écran se verrouille (sous 1 min). Sa progression est gardée : l'exclusion est réversible.", oui: "Exclure", danger: true }
        : { titre: `Réintégrer ${j.pseudo} ?`, texte: "Il retrouve l'accès au jeu avec toute sa progression.", oui: "Réintégrer" });
      if (!ok) return;
      await agir(statut, () => C.appel("admin_set_status", { p_player_id: j.id, p_status: exclure ? "exclu" : "actif" }),
        exclure ? `${j.pseudo} est exclu du jeu.` : `${j.pseudo} est réintégré.`);
      return;
    }

    const effacer = e.target.closest("[data-effacer]");
    if (effacer) {
      const saisi = await demanderPseudo(j.pseudo);
      if (saisi === null) return;
      const liberer = C.occuper(effacer);
      if (liberer === null) return;
      try {
        const r = await C.appel("admin_effacer_joueur", { p_player_id: j.id, p_confirmation: saisi });
        dire(`Données effacées. Il reste une ligne anonyme (${r.pseudo}) pour les comptes.`);
        if (liste) {
          liste.joueurs = liste.joueurs.filter((x) => x.id !== j.id);
          liste.total = Math.max(0, liste.total - 1);
          liste.resume.joueurs = Math.max(0, liste.resume.joueurs - 1);
          if (j.statut !== "actif") liste.resume.exclus = Math.max(0, liste.resume.exclus - 1);
          rendreListe();
        }
        fiche.close();
      } catch (err) {
        dire(C.message(err));
      } finally { liberer(); }
    }
  });

  /* Effacement : le GM retape le pseudo (la base le vérifie aussi) */
  function demanderPseudo(pseudo) {
    return new Promise((resoudre) => {
      const d = document.createElement("dialog");
      d.className = "cboite";
      d.innerHTML = `<form method="dialog" class="cboite__corps">
        <h2 class="cboite__titre">Effacer les données de ${esc(pseudo)} ?</h2>
        <p>Définitif. Son pseudo, son code de reprise et son numéro de téléphone disparaissent ; ses scans, réponses et cœurs restent, anonymes. Son ticket reste compté comme payé.</p>
        <div class="champ">
          <label class="champ__label" for="e-pseudo">Retape son pseudo pour confirmer</label>
          <input class="saisie" id="e-pseudo" name="pseudo" autocomplete="off" maxlength="16">
        </div>
        <div class="cboite__actions">
          <button class="cbtn" value="non">Annuler</button>
          <button class="cbtn cbtn--danger" value="oui" disabled>Effacer définitivement</button>
        </div></form>`;
      document.body.appendChild(d);
      const champ = $("#e-pseudo", d);
      const oui = $('[value="oui"]', d);
      champ.addEventListener("input", () => { oui.disabled = champ.value.trim().toLowerCase() !== pseudo.toLowerCase(); });
      d.addEventListener("close", () => { resoudre(d.returnValue === "oui" ? champ.value.trim() : null); d.remove(); });
      d.showModal();
      champ.focus();
    });
  }

  function fermerFiche() {
    ficheId = null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  }
  $("[data-fermer]").addEventListener("click", () => fiche.close());
  fiche.addEventListener("close", fermerFiche);
  fiche.addEventListener("click", (e) => { if (e.target === fiche) fiche.close(); });

  /* ======================================================================
     Scan de la carte d'un joueur
     ====================================================================== */
  const scan = $("[data-scan]");
  const video = $("[data-scan-video]");
  const scanMessage = $("[data-scan-message]");
  let lecteur = null;

  const direScan = (texte) => {
    scanMessage.innerHTML = texte ? `${App.icon("alerte")}<span>${esc(texte)}</span>` : "";
    scanMessage.hidden = !texte;
  };

  function lu(texte) {
    const m = String(texte).trim().match(/^DQ-JOUEUR:(.+)$/i);
    if (m && UUID.test(m[1])) {
      scan.close();
      ouvrirFiche(m[1], { missions: true });
      return;
    }
    if (/^DQ-BON:/i.test(texte)) direScan("C'est un bon de la roue : le retrait se fait à l'écran Roue (6.5).");
    else if (/^DQ-[A-Z0-9]{4,}/i.test(texte) || /scanner\.html/i.test(texte)) direScan("C'est un QR du jeu (stand, scène…), pas la carte d'un joueur.");
    else direScan("Ce QR n'est pas la carte d'un joueur Vimas Quest.");
  }

  function arreterScan() {
    if (lecteur) lecteur.arreter();
    lecteur = null;
  }

  $("[data-scanner]").addEventListener("click", async () => {
    direScan("");
    scan.showModal();
    try {
      lecteur = await App.lecteurQR.demarrer(video, { onCode: lu });
      if (!scan.open) arreterScan();
    } catch (err) {
      lecteur = null;
      direScan({
        refus: "Caméra bloquée : autorise-la dans les réglages du navigateur pour ce site. Sinon, cherche le pseudo écrit sous son QR.",
        "non-supporte": "Ce navigateur ne lit pas les QR (ou la page n'est pas en https). Cherche le pseudo écrit sous son QR."
      }[err.code] || "Caméra indisponible : une autre application l'utilise peut-être.");
    }
  });
  $("[data-scan-fermer]").addEventListener("click", () => scan.close());
  scan.addEventListener("close", arreterScan);
  document.addEventListener("visibilitychange", () => { if (document.hidden && scan.open) scan.close(); });

  /* ======================================================================
     Démarrage : la liste, et la fiche si l'adresse en désigne une (#id)
     ====================================================================== */
  charger();
  const cible = decodeURIComponent(location.hash.slice(1));
  if (UUID.test(cible)) ouvrirFiche(cible);
});
