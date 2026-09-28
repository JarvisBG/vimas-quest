/* ==========================================================================
   Console — écran Roue et lots (étape 5.1 Vimas), style Game Master d'Otaku
   Lecture (au chargement, puis après une écriture ; temps réel sur les lots
   et les tirages) : roulette_prizes et game_state (lecture publique, comme
   les téléphones), badges (pour les lots « badge »), admin_recent_spins (30
   derniers bons) et le nombre de bons à retirer (roulette_spins, lecture
   staff) — quatre requêtes en parallèle.
   Écritures (bouton verrouillé, jamais réessayées) :
   admin_create_prize / admin_update_prize (+ admin_prize_affichage pour la
   rareté et le libellé court), admin_delete_prize (refusée par la base dès
   qu'un joueur l'a gagné : l'éteindre), admin_set_roulette_cost,
   admin_set_roulette_plafond, admin_redeem (remise d'un objet au stand).
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    NOM_MANQUANT: "Donne un nom au lot.",
    GENRE_INCONNU: "Genre de lot inconnu.",
    BADGE_MANQUANT: "Choisis le badge que ce lot donne.",
    LOT_INCONNU: "Ce lot n'existe plus : recharge la page.",
    RARETE_INVALIDE: "Rareté inconnue.",
    LIBELLE_TROP_LONG: "Le libellé sur la roue fait 12 caractères au plus.",
    COUT_INVALIDE: "Le coût va de 1 à 100 000 jetons.",
    VALEUR_INVALIDE: "Le nombre de tirages par jour va de 0 à 1 000.",
    BON_INCONNU: "Aucun bon ne porte ce code. Vérifie-le sur le téléphone du joueur.",
    DEJA_RETIRE: "Ce lot a déjà été remis.",
    LOT_DEJA_GAGNE: "Des joueurs ont déjà gagné ce lot : il ne se supprime plus. Éteins-le pour le retirer de la roue."
  });

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;
  const RARETES = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
  const GENRES = {
    objet: (l) => "Objet à retirer au stand",
    xp: (l) => `${n(l.value)} XP`,
    jetons: (l) => `${n(l.value)} jetons`,
    badge: (l) => `Badge « ${(badges.find((b) => b.id === l.badge_id) || {}).name || "?"} »${l.value ? ` + ${n(l.value)} XP` : ""}`,
    rien: () => "Case vide"
  };
  const ICONES = ["cadeau", "etoile", "trophee", "gemme", "billet", "eclair", "coeur", "micro", "couverts", "goutte", "ampoule", "roue", "des", "carte", "passeport", "valide"];

  const lignes = $("[data-lots]");
  const boite = $("[data-boite]");
  const form = $("[data-form]");
  const reglages = $("[data-reglages]");
  const retrait = $("[data-retrait]");
  let lots = null, badges = [], etat = null, courant = null, reglagesModifies = false;
  reglages.addEventListener("input", () => { reglagesModifies = true; });

  $("[data-icones]").innerHTML = ICONES.map((i) =>
    `<label title="${esc(i)}"><input type="radio" name="icone" value="${esc(i)}">${App.icon(i)}<span class="sr-only">${esc(i)}</span></label>`).join("");

  const erreurTable = (r) => new App.ErreurServeur(/fetch/i.test(r.error.message) ? "RESEAU" : "ERREUR", r.error.message);
  const enJeu = (l) => l.active && l.weight > 0 && (l.stock === null || l.stock > 0);

  /* ---------- Lecture ---------- */
  async function charger() {
    const sb = C.sb();
    const [rl, rg, rb, bons, aRetirer] = await Promise.all([
      sb.from("roulette_prizes").select("*").order("created_at"),
      sb.from("game_state").select("roulette_cost, roulette_max_jour").eq("id", 1).single(),
      sb.from("badges").select("id, name").order("name"),
      C.appel("admin_recent_spins", { p_limit: 30 }),
      sb.from("roulette_spins").select("id", { count: "exact", head: true }).not("redeem_code", "is", null).is("redeemed_at", null)
    ]);
    for (const r of [rl, rg, rb]) if (r.error) throw erreurTable(r);
    lots = rl.data;
    etat = rg.data;
    badges = rb.data;
    rendre(bons || [], aRetirer.count);
  }

  function rendre(bons, aRetirer) {
    const total = lots.filter(enJeu).reduce((s, l) => s + l.weight, 0);
    const allumes = lots.filter(enJeu).length;
    $("[data-resume]").textContent = `${n(allumes)} lot${allumes > 1 ? "s" : ""} en jeu sur ${n(lots.length)} · ${n(etat.roulette_cost)} jetons le tirage · ${etat.roulette_max_jour ? `${n(etat.roulette_max_jour)} tirages par jour` : "tirages sans limite"}`;

    if (!reglagesModifies) {   // une saisie en cours n'est jamais écrasée par une relecture
      reglages.cout.value = etat.roulette_cost;
      reglages.plafond.value = etat.roulette_max_jour;
    }

    lignes.innerHTML = lots.length ? lots.map((l) => {
      const chance = enJeu(l) && total ? (l.weight / total) * 100 : 0;
      const epuise = l.stock !== null && l.stock <= 0;
      return `<tr data-id="${esc(l.id)}">
        <td><div class="cavec-medaille"><span class="cmedaille cmedaille--rond cmedaille--${esc(l.rarete)}" aria-hidden="true">${App.icon(l.icon || "cadeau")}</span>
          <div class="cligne"><strong>${esc(l.name)}</strong><small>${esc(GENRES[l.kind] ? GENRES[l.kind](l) : l.kind)}${l.court ? ` · « ${esc(l.court)} » sur la roue` : ""}</small>
          <div class="cpuces"><span class="cpuce cpuce--${esc(l.rarete)}">${esc(RARETES[l.rarete] || l.rarete)}</span>
            ${epuise ? `<span class="cpuce cpuce--alerte">Épuisé</span>` : ""}</div></div></div></td>
        <td class="ctable__nb">${enJeu(l) ? `${chance < 1 ? chance.toFixed(1) : Math.round(chance)} %` : "—"}<span class="ctable__sous">poids ${n(l.weight)}</span></td>
        <td class="ctable__nb">${l.stock === null ? "∞" : n(l.stock)}</td>
        <td class="ctable__bascule">${C.interrupteur(l.active, `data-bascule="${esc(l.id)}"`, `${l.name} sur la roue`)}</td>
        <td class="ctable__actions"><button class="cbtn" type="button" data-modifier>Modifier</button></td></tr>`;
    }).join("") : `<tr><td colspan="5" class="cvide">Aucun lot : la roue des téléphones affiche « la roue ouvre bientôt ». Crée le premier avec « Nouveau lot ».</td></tr>`;

    $("[data-bons-note]").textContent = aRetirer === null || aRetirer === undefined ? "" : `${n(aRetirer)} à retirer`;
    $("[data-bons]").innerHTML = bons.length ? bons.map((b) => `<li>
        <span class="cliste__quand">${esc(C.ilYa(b.created_at))}</span>
        <span class="cliste__texte"><strong>${esc(b.pseudo)}</strong> · ${esc(b.prize_name || "lot supprimé")}<time class="ctable__code">${esc(b.redeem_code)}</time></span>
        <span class="cbadge${b.redeemed_at ? " cbadge--succes" : " cbadge--alerte"}">${b.redeemed_at ? "Remis" : "À retirer"}</span></li>`).join("")
      : '<li class="cvide">Aucun objet gagné pour l\'instant.</li>';
  }

  const zone = $("[data-console-contenu]");
  const direct = C.suivre("console-roue", [["*", "roulette_prizes"], ["*", "roulette_spins"], ["UPDATE", "game_state"]], async () => {
    try { await charger(); $("[data-erreur-lecture]")?.remove(); }
    catch (e) {
      if (!lots && !$("[data-erreur-lecture]")) {
        zone.insertAdjacentHTML("afterbegin", `<p class="message" role="alert" data-erreur-lecture>${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`);
      }
      throw e;
    }
  });

  /* ---------- Écriture d'un lot : tous les champs ---------- */
  const champsDe = (l, change = {}) => Object.assign({
    p_name: l.name, p_icon: l.icon, p_weight: l.weight, p_stock: l.stock, p_active: l.active,
    p_kind: l.kind, p_value: l.value, p_badge_id: l.badge_id
  }, change);

  lignes.addEventListener("change", async (e) => {
    const box = e.target.closest("[data-bascule]");
    if (!box) return;
    const l = lots.find((x) => x.id === box.dataset.bascule);
    box.disabled = true;
    try {
      await C.appel("admin_update_prize", champsDe(l, { p_id: l.id, p_active: box.checked }));
      l.active = box.checked;
      C.dire(box.checked ? `« ${l.name} » est sur la roue` : `« ${l.name} » est retiré de la roue`);
      direct.maintenant();
    } catch (err) {
      box.checked = !box.checked;
      C.dire(C.message(err));
    } finally { box.disabled = false; }
  });

  lignes.addEventListener("click", (e) => {
    if (!e.target.closest("[data-modifier]")) return;
    ouvrir(lots.find((x) => x.id === e.target.closest("tr").dataset.id));
  });

  /* ---------- La boîte ---------- */
  function adapter() {
    const genre = form.genre.value;
    $("[data-champ-badge]").hidden = genre !== "badge";
    $("[data-champ-valeur]").hidden = genre === "objet" || genre === "rien";
    $("[data-valeur-label]").textContent = genre === "xp" ? "XP gagnés" : genre === "jetons" ? "Jetons gagnés" : "XP en plus (facultatif)";
    const total = lots.filter((l) => enJeu(l) && (!courant || l.id !== courant.id)).reduce((s, l) => s + l.weight, 0);
    const p = Math.max(0, Number(form.poids.value) || 0);
    $("[data-aide-poids]").textContent = p && form.actif.checked
      ? `Environ ${Math.round((p / (total + p)) * 1000) / 10} % des tirages avec les lots actuels.`
      : "0 = ne sort jamais. Plus il est lourd, plus il sort souvent.";
  }
  form.addEventListener("input", adapter);
  form.addEventListener("change", adapter);

  function ouvrir(l) {
    courant = l || null;
    form.reset();
    $("[data-badges]").innerHTML = badges.length
      ? badges.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join("")
      : `<option value="">Aucun badge : crée-le dans l'écran Badges</option>`;
    const el = form.elements;
    if (l) {
      el.nom.value = l.name;
      el.court.value = l.court || "";
      el.genre.value = l.kind;
      el.valeur.value = l.value || "";
      if (l.badge_id) el.badge.value = l.badge_id;
      el.rarete.value = l.rarete;
      el.poids.value = l.weight;
      el.stock.value = l.stock === null ? "" : l.stock;
      el.actif.checked = l.active;
    } else {
      el.poids.value = 10;
    }
    const radio = form.querySelector(`[name="icone"][value="${CSS.escape((l && l.icon) || "cadeau")}"]`);
    if (radio) radio.checked = true;
    $("[data-b-titre]").textContent = l ? "Modifier le lot" : "Nouveau lot";
    $("[data-b-sous]").textContent = l ? GENRES[l.kind] ? GENRES[l.kind](l) : "" : "Il apparaît sur la roue des téléphones dès qu'il est allumé.";
    $("[data-supprimer]").hidden = !l;
    $("[data-erreur]").hidden = true;
    adapter();
    boite.showModal();
    el.nom.focus();
  }

  function erreur(texte) {
    const z = $("[data-erreur]");
    z.innerHTML = `${App.icon("alerte")}<span>${esc(texte)}</span>`;
    z.hidden = false;
    z.scrollIntoView({ block: "nearest" });
  }

  $("[data-nouveau]").addEventListener("click", () => lots && ouvrir(null));
  boite.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boite.close(); });

  $("[data-enregistrer]").addEventListener("click", async (e) => {
    const el = form.elements;
    const nom = el.nom.value.trim();
    if (!nom) { erreur(C.messages.NOM_MANQUANT); el.nom.focus(); return; }
    const genre = el.genre.value;
    if (genre === "badge" && !el.badge.value) { erreur(C.messages.BADGE_MANQUANT); return; }
    if ((genre === "xp" || genre === "jetons") && !(Number(el.valeur.value) > 0)) {
      erreur(genre === "xp" ? "Indique combien d'XP ce lot rapporte." : "Indique combien de jetons ce lot rapporte."); el.valeur.focus(); return;
    }
    const params = {
      p_name: nom,
      p_icon: (form.querySelector('[name="icone"]:checked') || {}).value || "cadeau",
      p_weight: Math.max(0, Math.round(Number(el.poids.value) || 0)),
      p_stock: el.stock.value === "" ? null : Math.max(0, Math.round(Number(el.stock.value))),
      p_active: el.actif.checked,
      p_kind: genre,
      p_value: genre === "objet" || genre === "rien" ? 0 : Math.max(0, Math.round(Number(el.valeur.value) || 0)),
      p_badge_id: genre === "badge" ? el.badge.value : null
    };
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try {
      const lot = courant
        ? await C.appel("admin_update_prize", Object.assign({ p_id: courant.id }, params))
        : await C.appel("admin_create_prize", params);
      await C.appel("admin_prize_affichage", { p_id: lot.id, p_rarete: el.rarete.value, p_court: el.court.value.trim() || null });
      boite.close();
      C.dire(courant ? "Lot enregistré" : "Lot créé");
      await charger();
    } catch (err) {
      erreur(C.message(err));
    } finally { liberer(); }
  });

  $("[data-supprimer]").addEventListener("click", async (e) => {
    if (!courant) return;
    const l = courant;
    const bouton = e.currentTarget;
    const ok = await C.confirmer({ titre: `Supprimer « ${l.name} » ?`, texte: "Possible seulement si personne ne l'a encore gagné. Sinon, éteins-le.", oui: "Supprimer", danger: true });
    if (!ok) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("admin_delete_prize", { p_id: l.id });
      boite.close();
      C.dire("Lot supprimé");
      await charger();
    } catch (err) {
      /* Clé étrangère roulette_spins → roulette_prizes : déjà gagné */
      erreur(/foreign key|violates/i.test(err.message || "") ? C.messages.LOT_DEJA_GAGNE : C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Réglages ---------- */
  reglages.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneErr = $("[data-reglages-erreur]");
    zoneErr.hidden = true;
    const cout = Math.round(Number(reglages.cout.value));
    const plafond = Math.round(Number(reglages.plafond.value));
    const liberer = C.occuper(reglages.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      if (cout !== etat.roulette_cost) await C.appel("admin_set_roulette_cost", { p_cost: cout });
      if (plafond !== etat.roulette_max_jour) await C.appel("admin_set_roulette_plafond", { p_max: plafond });
      C.dire("Réglages de la roue enregistrés");
      reglagesModifies = false;
      await charger();
    } catch (err) {
      zoneErr.innerHTML = `${App.icon("alerte")}<span>${esc(C.message(err))}</span>`;
      zoneErr.hidden = false;
    } finally { liberer(); }
  });

  /* ---------- Remise d'un objet ---------- */
  retrait.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMsg = $("[data-retrait-message]");
    const code = retrait.code.value.replace(/\s+/g, "").toUpperCase();
    const dire = (texte, ok) => {
      zoneMsg.className = ok ? "message message--info" : "message";
      zoneMsg.innerHTML = `${App.icon(ok ? "valide" : "alerte")}<span>${texte}</span>`;
      zoneMsg.hidden = false;
    };
    if (!code) { dire(esc("Tape le code affiché sur le téléphone du joueur."), false); return; }
    const liberer = C.occuper(retrait.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      const r = await C.appel("admin_redeem", { p_code: code });
      dire(`Remets <strong>${esc(r.prize)}</strong> à <strong>${esc(r.player)}</strong>. C'est noté.`, true);
      retrait.reset();
      direct.maintenant();
    } catch (err) {
      dire(esc(C.message(err)), false);
    } finally { liberer(); retrait.code.focus(); }
  });
});
