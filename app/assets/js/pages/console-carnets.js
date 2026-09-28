/* ==========================================================================
   Console — Carnets de tickets (étape 5.3 Vimas), réservé au Game Master
   Modèle d'Otaku (REGLES §15) : un ticket papier prépayé = une journée de
   jeu ; le vendeur doit (remis − rendus) × prix ; les tickets activés sont
   l'argent prouvé. Aucune fonction SQL nouvelle :
   · lecture : billetterie_stats (chiffres, par vendeur) + carnet_liste
     (carnets) + billetterie_config (lecture publique), en parallèle ;
     carnet_etat à l'ouverture d'un carnet (ses tickets) ;
   · écriture : carnet_creer (tickets générés en base), carnet_attribuer
     (compte vendeur par e-mail), carnet_rendre / carnet_reprendre
     (invendus), carnet_pointer (désactiver / réactiver), billetterie_config
     (politique « ecriture gm » : prix, jeu payant, message).
   Impression : console-etiquettes.js (E.tickets), rien n'est envoyé.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const E = App.etiquettes;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    VENDEUR_MANQUANT: "Écris le nom du vendeur (2 lettres au moins).",
    NOMBRE_INVALIDE: "De 1 à 500 tickets par carnet.",
    CODE_GENERATION: "La base n'a pas réussi à fabriquer des codes uniques : réessaie.",
    CARNET_INCONNU: "Ce carnet n'existe plus : recharge la page.",
    COMPTE_INCONNU: "Aucun compte ne porte cet e-mail. Crée-le d'abord dans Supabase (Authentication).",
    PAS_DANS_LE_STAFF: "Ce compte existe mais n'est pas dans l'équipe : ajoute-le à la table staff avec le rôle « vendeur ».",
    RENDUS_INVALIDE: "Nombre de tickets rendus impossible."
  });

  const acces = await C.garde({ gm: true });
  if (!acces) return;

  const n = C.nombre;
  const fcfa = (v) => `${n(v)} FCFA`;
  const erreurTable = (r) => new App.ErreurServeur(/fetch/i.test(r.error.message) ? "RESEAU" : "ERREUR", r.error.message);
  const ETATS = { libre: ["", "Libre"], utilise: ["is-bonne", "Activé"], rendu: ["", "Rendu"], annule: ["", "Annulé"] };

  const reglages = $("[data-reglages]");
  let stats = null, liste = null, cfg = null, ouvert = null, reglagesModifies = false;
  reglages.addEventListener("input", () => { reglagesModifies = true; });

  /* ---------- Lecture ---------- */
  async function charger() {
    const [s, l, rc] = await Promise.all([
      C.appel("billetterie_stats"),
      C.appel("carnet_liste"),
      C.sb().from("billetterie_config").select("*").eq("id", 1).single()
    ]);
    if (rc.error) throw erreurTable(rc);
    stats = s; liste = l.carnets || []; cfg = rc.data;
    rendre();
  }

  function chiffre(val, nom, icone, teinte, plus = "") {
    return `<div class="cchiffre"><span class="cchiffre__icone cchiffre__icone--${teinte}">${App.icon(icone)}</span>
      <span class="cchiffre__val">${val}</span><span class="cchiffre__nom">${esc(nom)}</span>${plus ? `<span class="cchiffre__plus">${esc(plus)}</span>` : ""}</div>`;
  }

  function rendre() {
    const t = stats.total;
    $("[data-resume]").textContent = `${cfg.actif ? `Jeu payant · ${fcfa(cfg.prix_journee)} la journée` : "Jeu gratuit (billetterie coupée)"} · ${n(t.carnets)} carnet${t.carnets > 1 ? "s" : ""}, ${n(t.remis)} tickets remis`;
    $("[data-chiffres]").innerHTML = [
      chiffre(fcfa(t.encaisse_jour), "Encaissé aujourd'hui", "billet", "vert", `${n(t.actives_aujourdhui)} tickets activés depuis 6 h`),
      chiffre(fcfa(t.encaisse), "Encaissé en tout", "valide", "cyan", `${n(t.actives)} tickets activés`),
      chiffre(fcfa(t.du), "À rapporter", "trophee", "or", "(remis − rendus) × prix"),
      chiffre(n(t.en_main), "Papier en main", "passeport", "violet", "vendus ou pas encore, non activés"),
      chiffre(n(t.libres), "Tickets libres", "qr", "bleu", `${n(t.rendus_reels)} rendus`),
      chiffre(cfg.actif ? "Payant" : "Gratuit", "Le jeu", "cadenas", cfg.actif ? "rouge" : "vert", cfg.actif ? "ticket du jour exigé" : "tickets inutiles")
    ].join("");

    if (!reglagesModifies) {
      reglages.actif.checked = cfg.actif;
      reglages.prix.value = cfg.prix_journee;
      reglages.message.value = cfg.message || "";
    }

    const corps = $("[data-carnets]");
    corps.innerHTML = liste.length ? liste.map((c) => `<tr data-id="${esc(c.id)}">
      <td><div class="cligne"><strong>N° ${esc(c.numero)} · ${esc(c.vendeur_nom)}</strong>
        <small>${n(c.nb_tickets)} tickets${c.note ? ` · ${esc(c.note)}` : ""}</small>
        <div class="cpuces">${c.actif ? "" : '<span class="cpuce cpuce--danger">Désactivé</span>'}
          ${c.actives_aujourdhui ? `<span class="cpuce cpuce--ok">${n(c.actives_aujourdhui)} aujourd'hui</span>` : ""}
          <span class="cpuce">${n(c.libres)} libre${c.libres > 1 ? "s" : ""}</span></div></div></td>
      <td class="ctable__nb">${n(c.actives)}<span class="ctable__sous">sur ${n(c.nb_tickets)}${c.rendus ? ` · ${n(c.rendus)} rendu${c.rendus > 1 ? "s" : ""}` : ""}</span></td>
      <td class="ctable__nb">${fcfa(c.du)}</td>
      <td class="ctable__actions"><button class="cbtn cbtn--icone" type="button" data-imprimer title="Imprimer les tickets">${App.icon("billet")}<span class="sr-only">Imprimer les tickets</span></button><button class="cbtn" type="button" data-gerer>Gérer</button></td></tr>`).join("")
      : `<tr><td colspan="4" class="cvide">Aucun carnet. « Nouveau carnet » fabrique les tickets d'un vendeur et ouvre l'impression.</td></tr>`;

    const v = stats.vendeurs || [];
    $("[data-vendeurs]").innerHTML = v.length ? v.map((x) => `<li>
        <span class="cliste__texte"><strong>${esc(x.vendeur_nom)}</strong> · ${n(x.carnets)} carnet${x.carnets > 1 ? "s" : ""}, ${n(x.actives)} activés, ${n(x.en_main)} en main
          <time>aujourd'hui : ${fcfa(x.encaisse_jour)} encaissés</time></span>
        <span class="cliste__val">${fcfa(x.du)}</span></li>`).join("")
      : '<li class="cvide">Aucun vendeur pour l\'instant.</li>';
  }

  const zone = $("[data-console-contenu]");
  C.suivre("console-carnets", [["UPDATE", "billetterie_config"]], async () => {
    try { await charger(); $("[data-erreur-lecture]")?.remove(); }
    catch (e) {
      if (!stats && !$("[data-erreur-lecture]")) zone.insertAdjacentHTML("afterbegin", `<p class="message" role="alert" data-erreur-lecture>${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`);
      throw e;
    }
  });

  const direErreur = (sel, texte) => { const z = $(sel); z.innerHTML = texte ? `${App.icon("alerte")}<span>${esc(texte)}</span>` : ""; z.hidden = !texte; };

  /* ---------- Réglages : jeu payant, prix, message ---------- */
  reglages.addEventListener("submit", async (e) => {
    e.preventDefault();
    direErreur("[data-reglages-erreur]", "");
    const prix = Math.round(Number(reglages.prix.value));
    if (!(prix >= 0 && prix <= 1000000)) { direErreur("[data-reglages-erreur]", "Prix entre 0 et 1 000 000 FCFA."); return; }
    const valeurs = { actif: reglages.actif.checked, prix_journee: prix, message: reglages.message.value.trim() || cfg.message };
    if (valeurs.actif && !cfg.actif) {
      const ok = await C.confirmer({ titre: "Rendre le jeu payant ?", oui: "Rendre payant", danger: true,
        texte: "Dès maintenant, un joueur sans ticket du jour ne gagne plus aucun point (scans, missions, roue, blind test). Assure-toi que les vendeurs ont leurs carnets." });
      if (!ok) return;
    }
    const liberer = C.occuper(reglages.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      const r = await C.sb().from("billetterie_config").update(valeurs).eq("id", 1).select().single();
      if (r.error) { const err = erreurTable(r); if (r.error.code === "PGRST116") err.code = "ACCES_REFUSE"; throw err; }
      reglagesModifies = false;
      C.dire("Réglages de la billetterie enregistrés");
      await charger();
    } catch (err) {
      direErreur("[data-reglages-erreur]", C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Impression ---------- */
  const boiteI = $("[data-impression]");
  const cadre = $("[data-i-apercu]");
  boiteI.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteI.close(); });

  async function imprimer(carnet, tickets) {
    const aImprimer = tickets.filter((t) => !t.etat || t.etat === "libre");
    $("[data-i-sous]").textContent = `Carnet ${carnet.numero} · ${carnet.vendeur_nom} · ${n(aImprimer.length)} ticket${aImprimer.length > 1 ? "s" : ""}, ${n(Math.ceil(aImprimer.length / 15))} page${aImprimer.length > 15 ? "s" : ""} A4${aImprimer.length < tickets.length ? " (les tickets activés ou rendus ne sont pas réimprimés)" : ""}`;
    const essai = $("[data-i-essai]");
    essai.hidden = !E.essai();
    essai.innerHTML = `${App.icon("alerte")}<span>Poste d'essai (${esc(E.site() || "fichier local")}) : les QR mènent à cette adresse, pas au vrai site. Chaque ticket porte « ESSAI ». Imprime les vrais depuis le site en ligne.</span>`;
    $("[data-i-lancer]").disabled = !aImprimer.length;
    boiteI.showModal();
    await E.afficher(cadre, E.tickets(carnet, aImprimer, cfg ? cfg.prix_journee : 0));
  }

  $("[data-i-lancer]").addEventListener("click", () => {
    try { cadre.contentWindow.focus(); cadre.contentWindow.print(); }
    catch (err) { C.dire("Impossible de lancer l'impression depuis ce navigateur."); }
  });

  /* ---------- Nouveau carnet ---------- */
  const boiteN = $("[data-boite-nouveau]");
  const formN = $("[data-form-nouveau]");
  $("[data-nouveau]").addEventListener("click", () => {
    formN.reset();
    direErreur("[data-nouveau-erreur]", "");
    boiteN.showModal();
    formN.vendeur.focus();
  });
  boiteN.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteN.close(); });

  formN.addEventListener("submit", async (e) => {
    e.preventDefault();
    direErreur("[data-nouveau-erreur]", "");
    const vendeur = formN.vendeur.value.trim();
    const nb = Math.round(Number(formN.nb.value));
    if (vendeur.length < 2) { direErreur("[data-nouveau-erreur]", C.messages.VENDEUR_MANQUANT); return; }
    if (!(nb >= 1 && nb <= 500)) { direErreur("[data-nouveau-erreur]", C.messages.NOMBRE_INVALIDE); return; }
    const liberer = C.occuper(formN.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      const r = await C.appel("carnet_creer", { p_vendeur_nom: vendeur, p_nb_tickets: nb, p_note: formN.note.value.trim() || null });
      boiteN.close();
      C.dire(`Carnet ${r.carnet.numero} créé : ${n(r.tickets.length)} tickets`);
      await charger();
      await imprimer(r.carnet, r.tickets);
    } catch (err) {
      direErreur("[data-nouveau-erreur]", C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Gérer un carnet ---------- */
  const boiteC = $("[data-boite-carnet]");
  boiteC.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteC.close(); });

  const stat = (val, nom) => `<div class="cfiche__stat"><strong>${val}</strong><span>${esc(nom)}</span></div>`;

  function rendreCarnet() {
    const c = ouvert.carnet;
    const tk = ouvert.tickets;
    const compte = (etat) => tk.filter((t) => t.etat === etat).length;
    $("[data-c-titre]").textContent = `Carnet ${c.numero} · ${c.vendeur_nom}`;
    $("[data-c-sous]").textContent = `${n(c.nb_tickets)} tickets${c.note ? ` · ${c.note}` : ""}${c.actif ? "" : " · désactivé"}`;
    $("[data-c-stats]").innerHTML = [stat(n(compte("utilise")), "activés"), stat(n(compte("libre")), "libres"), stat(n(compte("rendu")), "rendus"), stat(fcfa(ouvert.du), "dû")].join("");
    $("[data-c-compte]").textContent = c.vendeur_user
      ? "Un compte vendeur est rattaché : il voit ce carnet dans son espace. Tu peux le remplacer par un autre."
      : "Aucun compte rattaché : le vendeur ne voit pas ce carnet dans son espace. Crée son compte dans Supabase (rôle « vendeur » dans la table staff), puis rattache-le ici.";
    $("[data-c-tickets]").innerHTML = tk.map((t) => {
      const [cls, nom] = ETATS[t.etat] || ["", t.etat];
      return `<span class="${cls}" title="${esc(nom)}${t.jour ? ` le ${esc(t.jour)}` : ""}">${esc(t.rang)} · ${esc(t.code)} · ${esc(nom)}</span>`;
    }).join("");
    const b = $("[data-desactiver]");
    b.innerHTML = c.actif ? `${App.icon("croix")} Désactiver` : `${App.icon("valide")} Réactiver`;
    b.classList.toggle("cbtn--danger", c.actif);
  }

  async function ouvrir(id) {
    direErreur("[data-c-erreur]", "");
    ouvert = await C.appel("carnet_etat", { p_carnet_id: id });
    rendreCarnet();
    if (!boiteC.open) boiteC.showModal();
  }

  $("[data-carnets]").addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    try {
      if (e.target.closest("[data-gerer]")) await ouvrir(tr.dataset.id);
      else if (e.target.closest("[data-imprimer]")) {
        const et = await C.appel("carnet_etat", { p_carnet_id: tr.dataset.id });
        await imprimer(et.carnet, et.tickets);
      }
    } catch (err) { C.dire(C.message(err)); }
  });

  $("[data-imprimer-carnet]").addEventListener("click", () => { boiteC.close(); imprimer(ouvert.carnet, ouvert.tickets); });

  async function action(bouton, fn, message) {
    direErreur("[data-c-erreur]", "");
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      const r = await fn();
      C.dire(typeof message === "function" ? message(r) : message);
      await ouvrir(ouvert.carnet.id);
      await charger();
    } catch (err) {
      direErreur("[data-c-erreur]", C.message(err));
    } finally { liberer(); }
  }

  $("[data-form-compte]").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = e.currentTarget.email.value.trim();
    if (!email) { direErreur("[data-c-erreur]", "Écris l'e-mail du compte vendeur."); return; }
    action(e.currentTarget.querySelector("button"), () => C.appel("carnet_attribuer", { p_carnet_id: ouvert.carnet.id, p_email: email }), "Compte rattaché au carnet");
  });

  const codesSaisis = () => $("[data-c-codes]").value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => { try { const u = new URL(s); return u.searchParams.get("ticket") || u.searchParams.get("t") || s; } catch (e) { return s; } });

  $("[data-rendre]").addEventListener("click", (e) => {
    const codes = codesSaisis();
    if (!codes.length) { direErreur("[data-c-erreur]", "Tape au moins un code de ticket."); return; }
    action(e.currentTarget, () => C.appel("carnet_rendre", { p_carnet_id: ouvert.carnet.id, p_codes: codes }),
      (r) => { $("[data-c-codes]").value = ""; return `${n(r.rendus_maintenant)} ticket${r.rendus_maintenant > 1 ? "s" : ""} rendu${r.rendus_maintenant > 1 ? "s" : ""} (sur ${n(codes.length)} saisi${codes.length > 1 ? "s" : ""})`; });
  });

  $("[data-rendre-tous]").addEventListener("click", async (e) => {
    /* « annulé » = libre dans un carnet désactivé : la base le rend aussi */
    const libres = ouvert.tickets.filter((t) => t.etat === "libre" || t.etat === "annule").length;
    if (!libres) { direErreur("[data-c-erreur]", "Aucun ticket libre dans ce carnet."); return; }
    const bouton = e.currentTarget;
    if (!(await C.confirmer({ titre: `Rendre les ${libres} tickets libres ?`, texte: "À faire quand le vendeur rapporte sa liasse : ces tickets ne pourront plus être activés, et le dû baisse d'autant.", oui: "Rendre tout" }))) return;
    action(bouton, () => C.appel("carnet_rendre", { p_carnet_id: ouvert.carnet.id, p_codes: null }), (r) => `${n(r.rendus_maintenant)} tickets rendus`);
  });

  $("[data-reprendre]").addEventListener("click", (e) => {
    const codes = codesSaisis();
    if (!codes.length) { direErreur("[data-c-erreur]", "Tape les codes rendus par erreur."); return; }
    action(e.currentTarget, () => C.appel("carnet_reprendre", { p_carnet_id: ouvert.carnet.id, p_codes: codes }),
      (r) => { $("[data-c-codes]").value = ""; return `${n(r.reprises)} ticket${r.reprises > 1 ? "s" : ""} redevenu${r.reprises > 1 ? "s" : ""} libre${r.reprises > 1 ? "s" : ""}`; });
  });

  $("[data-desactiver]").addEventListener("click", async (e) => {
    const c = ouvert.carnet;
    const bouton = e.currentTarget;
    if (c.actif && !(await C.confirmer({ titre: `Désactiver le carnet ${c.numero} ?`, danger: true, oui: "Désactiver",
      texte: "Ses tickets encore libres ne s'activent plus (carnet perdu, volé…). Les journées déjà activées restent valables." }))) return;
    action(bouton, () => C.appel("carnet_pointer", { p_carnet_id: c.id, p_actif: !c.actif }), c.actif ? "Carnet désactivé" : "Carnet réactivé");
  });
});
