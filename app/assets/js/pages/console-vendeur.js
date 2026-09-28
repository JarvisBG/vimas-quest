/* ==========================================================================
   Console — Espace vendeur (étape 5.3 Vimas), sur le modèle d'Otaku
   Page du rôle « vendeur » (le Game Master peut l'ouvrir pour la voir) ;
   une colonne, pensée pour le téléphone. Aucune fonction SQL nouvelle :
   · recette et carnet : carnet_liste (ses carnets seulement, filtré en
     base) puis carnet_etat par carnet (ses tickets) ; billetterie_config
     (lecture publique) pour savoir si le jeu est payant ;
   · mode sans papier : un code libre de son carnet montré en QR
     (inscription.html?ticket=CODE), les codes déjà montrés sont retenus
     sur ce téléphone pour ne pas montrer deux fois le même ;
   · récompenser un joueur : recherche par pseudo (table players, lecture
     publique, comme Otaku), vendeur_award_bonus (sans malus, annoncé à son
     nom), admin_manual_quests + admin_validate_quest.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const E = App.etiquettes;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    PASS_REQUIS: "Ce joueur n'a pas ouvert sa journée avec un ticket : il ne peut pas gagner de points aujourd'hui.",
    JOUEUR_EXCLU: "Ce joueur est exclu du jeu.",
    JOUEUR_INCONNU: "Ce joueur n'existe plus.",
    BONUS_INVALIDE: "Montant de points impossible.",
    QUETE_DEJA_VALIDEE: "Cette mission est déjà validée pour lui aujourd'hui.",
    QUETE_INACTIVE: "Cette mission est éteinte.",
    QUETE_INCONNUE: "Cette mission n'existe plus.",
    QUETE_NON_MANUELLE: "Cette mission se valide toute seule, pas par l'équipe.",
    CARNET_INCONNU: "Carnet introuvable : recharge la page."
  });

  const acces = await C.garde({ vendeur: true });
  if (!acces) return;

  const n = C.nombre;
  const fcfa = (v) => `${n(v)} FCFA`;
  const CLE_MONTRES = "vimasquest.vendeur.montres";

  $("[data-bonjour]").textContent = `Bonjour ${acces.nom || ""}`.trim();
  $("[data-vers-console]").hidden = acces.vendeur;
  $("[data-sortir]").addEventListener("click", C.deconnecter);

  let carnets = [], etats = {}, prix = 0, payant = true;

  /* ---------- Lecture ---------- */
  async function charger() {
    const [l, rc] = await Promise.all([
      C.appel("carnet_liste"),
      C.sb().from("billetterie_config").select("actif, prix_journee").eq("id", 1).single()
    ]);
    carnets = l.carnets || [];
    prix = l.prix || 0;
    if (!rc.error) payant = rc.data.actif;
    const details = await Promise.all(carnets.map((c) => C.appel("carnet_etat", { p_carnet_id: c.id })));
    etats = {};
    details.forEach((d) => { etats[d.carnet.id] = d; });
    rendre();
  }

  const stat = (val, nom) => `<div class="cfiche__stat"><strong>${val}</strong><span>${esc(nom)}</span></div>`;

  function rendre() {
    $("[data-gratuit]").hidden = payant;
    const somme = (k) => carnets.reduce((s, c) => s + (c[k] || 0), 0);
    const actives = somme("actives");
    const enMain = Math.max(0, carnets.reduce((s, c) => s + c.nb_tickets - c.rendus, 0) - actives);
    $("[data-recette]").innerHTML = carnets.length ? [
      stat(fcfa(somme("actives_aujourdhui") * prix), "aujourd'hui"),
      stat(n(actives), "activés en tout"),
      stat(n(enMain), "en main"),
      stat(fcfa(somme("du")), "à rapporter")
    ].join("") : `<p class="cvide">Aucun carnet ne t'est encore rattaché. Demande au Game Master de te le donner.</p>`;

    $("[data-carnets]").innerHTML = carnets.length ? carnets.map((c) => {
      const tk = (etats[c.id] || {}).tickets || [];
      return `<div class="cfiche__bloc">
        <div class="cregie__ligne"><strong>Carnet ${esc(c.numero)}</strong><span class="cregie__num">${n(c.nb_tickets)} tickets · ${fcfa(c.du)} à rapporter${c.actif ? "" : " · désactivé"}</span></div>
        <div class="cq-choix">${tk.map((t) => `<span class="${t.etat === "utilise" ? "is-bonne" : ""}" title="${t.etat === "utilise" ? "activé" : t.etat}">${esc(t.rang)} · ${esc(t.code)}${t.etat === "utilise" ? " ✓" : t.etat === "rendu" ? " (rendu)" : ""}</span>`).join("")}</div>
      </div>`;
    }).join("") : `<p class="cvide">Rien pour l'instant.</p>`;
  }

  $("[data-actualiser]").addEventListener("click", async (e) => {
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try { await charger(); C.dire("Recette à jour"); }
    catch (err) { C.dire(C.message(err)); }
    finally { liberer(); }
  });

  /* ---------- Mode sans papier ---------- */
  const lireMontres = () => { try { return JSON.parse(localStorage.getItem(CLE_MONTRES)) || []; } catch (e) { return []; } };
  const retenirMontre = (code) => { try { localStorage.setItem(CLE_MONTRES, JSON.stringify(lireMontres().concat(code).slice(-500))); } catch (e) { /* ignore */ } };

  function prochainLibre() {
    const montres = new Set(lireMontres());
    for (const c of carnets) {
      if (!c.actif) continue;
      const t = ((etats[c.id] || {}).tickets || []).find((x) => x.etat === "libre" && !montres.has(x.code));
      if (t) return { carnet: c, ticket: t };
    }
    return null;
  }

  function montrer() {
    const zone = $("[data-ticket]");
    const p = prochainLibre();
    if (!p) {
      zone.hidden = false;
      zone.innerHTML = `<small>Plus aucun ticket libre à montrer dans ton carnet. Demande un nouveau carnet au Game Master.</small>`;
      $("[data-suivant]").hidden = true;
      $("[data-cacher]").hidden = false;
      return;
    }
    retenirMontre(p.ticket.code);
    const code = p.ticket.code;
    zone.innerHTML = `${App.qrSvg(E.adresseTicket(code), { niveau: "Q", marge: 2, encre: "#3B0A12", fond: "#FFFFFF", titre: code })}
      <strong>${esc(code.slice(0, 4))} ${esc(code.slice(4))}</strong>
      <small>Carnet ${esc(p.carnet.numero)} · ticket n° ${esc(p.ticket.rang)} · 1 journée de jeu</small>`;
    zone.hidden = false;
    $("[data-suivant]").hidden = false;
    $("[data-cacher]").hidden = false;
  }
  $("[data-montrer]").addEventListener("click", montrer);
  $("[data-suivant]").addEventListener("click", montrer);
  $("[data-cacher]").addEventListener("click", () => {
    $("[data-ticket]").hidden = true;
    $("[data-suivant]").hidden = true;
    $("[data-cacher]").hidden = true;
  });

  /* ---------- Récompenser un joueur ---------- */
  const champ = $("[data-recherche]");
  const resultats = $("[data-resultats]");
  const zoneMsg = $("[data-joueur-message]");
  let joueur = null, attente = null, numero = 0;

  const dire = (texte, ok = false) => {
    zoneMsg.className = ok ? "message message--info" : "message";
    zoneMsg.innerHTML = texte ? `${App.icon(ok ? "valide" : "alerte")}<span>${texte}</span>` : "";
    zoneMsg.hidden = !texte;
  };

  champ.addEventListener("input", () => {
    clearTimeout(attente);
    const q = champ.value.trim();
    if (q.length < 2) { resultats.innerHTML = ""; return; }
    attente = setTimeout(async () => {
      const moi = ++numero;
      const motif = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const r = await C.sb().from("players").select("id, pseudo, level, status")
        .ilike("pseudo", motif).is("efface_le", null).order("pseudo").limit(8);
      if (moi !== numero) return;   // une frappe plus récente a déjà répondu
      if (r.error) { resultats.innerHTML = `<li class="cvide">${esc(C.message(new App.ErreurServeur("RESEAU")))}</li>`; return; }
      resultats.innerHTML = r.data.length ? r.data.map((j) => `<li>
          <button class="cliste__texte" type="button" data-choisir="${esc(j.id)}" data-pseudo="${esc(j.pseudo)}"><strong>${esc(j.pseudo)}</strong> · niveau ${esc(j.level)}${j.status === "exclu" ? " · exclu" : ""}</button></li>`).join("")
        : '<li class="cvide">Aucun joueur avec ce pseudo.</li>';
    }, 250);
  });

  resultats.addEventListener("click", (e) => {
    const b = e.target.closest("[data-choisir]");
    if (b) choisir({ id: b.dataset.choisir, pseudo: b.dataset.pseudo });
  });

  async function chargerMissions() {
    const liste = $("[data-missions]");
    liste.innerHTML = '<li class="cvide">Chargement…</li>';
    try {
      const ms = await C.appel("admin_manual_quests", { p_player_id: joueur.id });
      liste.innerHTML = ms.length ? ms.map((m) => `<li>
          <span class="cliste__texte"><strong>${esc(m.title)}</strong>${m.description ? `<time>${esc(m.description)}</time>` : ""}</span>
          ${m.completed_at ? '<span class="cbadge cbadge--succes">Validée</span>'
            : `<button class="cbtn" type="button" data-valider="${esc(m.id)}" data-titre="${esc(m.title)}">Valider · +${n(m.xp_reward)} XP</button>`}</li>`).join("")
        : '<li class="cvide">Aucune mission « validée par l\'équipe » en ce moment.</li>';
    } catch (err) { liste.innerHTML = `<li class="cvide">${esc(C.message(err))}</li>`; }
  }

  function choisir(j) {
    joueur = j;
    dire("");
    $("[data-recherche-zone]").hidden = true;
    $("[data-joueur]").hidden = false;
    $("[data-joueur-nom]").textContent = j.pseudo;
    $("[data-motif]").value = "";
    chargerMissions();
  }

  $("[data-changer]").addEventListener("click", () => {
    joueur = null;
    dire("");
    $("[data-joueur]").hidden = true;
    $("[data-recherche-zone]").hidden = false;
    champ.value = "";
    resultats.innerHTML = "";
    champ.focus();
  });

  $("[data-montants]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-xp]");
    if (!b || !joueur) return;
    const xp = Number(b.dataset.xp);
    const liberer = C.occuper(b);
    if (!liberer) return;
    try {
      const p = await C.appel("vendeur_award_bonus", { p_player_id: joueur.id, p_xp: xp, p_reason: $("[data-motif]").value.trim() || null });
      dire(`+${n(xp)} XP pour <strong>${esc(p.pseudo || joueur.pseudo)}</strong> (et ${n(Math.floor(xp / 10))} jetons). C'est annoncé sur l'écran géant.`, true);
    } catch (err) { dire(esc(C.message(err))); }
    finally { liberer(); }
  });

  $("[data-missions]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-valider]");
    if (!b || !joueur) return;
    if (!(await C.confirmer({ titre: `Valider « ${b.dataset.titre} » ?`, texte: `Pour ${joueur.pseudo}. Une mission ne se valide qu'une fois par jour.`, oui: "Valider" }))) return;
    const liberer = C.occuper(b);
    if (!liberer) return;
    try {
      const r = await C.appel("admin_validate_quest", { p_player_id: joueur.id, p_quest_id: b.dataset.valider });
      dire(`Mission « ${esc(r.quest)} » validée : +${n(r.xp)} XP pour <strong>${esc(joueur.pseudo)}</strong>${r.badge ? `, badge « ${esc(r.badge)} »` : ""}.`, true);
      await chargerMissions();
    } catch (err) { dire(esc(C.message(err))); liberer(); }
  });

  /* ---------- Démarrage : lecture, puis relecture toutes les minutes (onglet visible) ---------- */
  try { await charger(); }
  catch (e) { $("[data-recette]").innerHTML = `<p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`; }
  setInterval(() => { if (!document.hidden) charger().catch(() => {}); }, 60000);
});
