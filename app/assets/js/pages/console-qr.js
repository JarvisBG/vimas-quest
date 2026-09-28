/* ==========================================================================
   Console — écran QR codes et reliques (étape 6.3), style Game Master d'Otaku
   Lecture : console_qr (QR + scans du jour / au total + lieux, séances de
   dédicaces, missions, badges, barème) en UN appel au chargement, puis
   seulement après une écriture. Recherche et filtres : sur la liste
   chargée, sans requête. Historique d'un QR : console_qr_scans, à la demande.
   Écritures (bouton verrouillé, jamais réessayées) : console_qr_enregistrer
   (tous les champs, lien au lieu ou à la séance compris), console_activer('qr'),
   console_qr_supprimer (refusée dès qu'un joueur l'a scanné : on l'éteint).
   Étiquettes : console-etiquettes.js, rien n'est envoyé à la base.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const E = App.etiquettes;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    LABEL_MANQUANT: "Donne un nom au QR (80 caractères au plus).",
    INDICE_TROP_LONG: "L'indice fait 200 caractères au plus.",
    TYPE_INVALIDE: "Choisis un type de QR.",
    RARETE_MANQUANTE: "Choisis la rareté de la relique.",
    XP_INVALIDE: "Les XP vont de 0 à 1 000.",
    BADGE_INCONNU: "Ce badge n'existe plus : recharge la page.",
    QUETE_INCONNUE: "Cette mission n'existe plus : recharge la page.",
    LIEU_INCONNU: "Ce lieu n'existe plus : recharge la page.",
    LIEU_INCOMPATIBLE: "Ce lieu ne correspond pas au type du QR.",
    LIEU_DEJA_RELIE: "Ce lieu a déjà son QR : délie-le d'abord de l'autre QR.",
    DEDICACE_INCONNUE: "Cette séance n'existe plus : recharge la page.",
    DEDICACE_INCOMPATIBLE: "Seul un QR de dédicace se relie à une séance.",
    DEDICACE_DEJA_RELIEE: "Cette séance a déjà son QR.",
    QR_INCONNU: "Ce QR n'existe plus : recharge la page.",
    QR_DEJA_SCANNE: "Des joueurs l'ont déjà scanné : le supprimer effacerait leur collection. Éteins-le plutôt."
  });

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;
  const TYPES = E.TYPES;
  const ORDRE_TYPES = ["scene", "stand", "foodtruck", "service", "relique", "dedicace", "surprise"];
  /* Lieux qu'un type peut désigner (même règle que _qr_lieu_compatible) */
  const LIEUX_DU_TYPE = {
    scene: ["scene"], stand: ["stand"], foodtruck: ["food"],
    service: ["service", "eau", "toilettes", "secours", "abri", "entree"]
  };
  const LIEU_LABEL = { scene: "Scène du plan", stand: "Stand du plan", foodtruck: "Food-truck du plan", service: "Point pratique du plan" };
  const AIDE_TYPE = {
    scene: "À l'entrée de la scène. Relié à sa scène : un scan par concert, l'artiste entre dans la collection.",
    stand: "Le tampon du stand : collection (rayon Stands) et vote des coups de cœur.",
    foodtruck: "Le tampon du food-truck : collection (rayon Stands) et vote des coups de cœur.",
    service: "Point info, eau, secours… : quelques XP pour faire connaître le lieu.",
    relique: "Objet caché : indice public, nom révélé une fois trouvée. Naît éteinte.",
    dedicace: "Tenu par l'artiste pendant sa séance : l'artiste entre dans la collection.",
    surprise: "Événement ponctuel (flash-mob, apparition) : à allumer au bon moment."
  };
  const RARETES = { commune: "Commune", rare: "Rare", legendaire: "Légendaire" };
  const quand = (iso) => new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Africa/Douala", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).replace(":", " h ");

  const lignes = $("[data-lignes]");
  const filtres = $("[data-filtres]");
  const boite = $("[data-boite]");
  const form = $("[data-form]");
  let donnees = null;
  let courant = null;

  const optionsTypes = ORDRE_TYPES.map((t) => `<option value="${t}">${esc(TYPES[t].nom)}</option>`).join("");
  $("#f-type").insertAdjacentHTML("beforeend", optionsTypes);
  $("[data-types]").innerHTML = optionsTypes;

  const aRelier = (q) => (LIEUX_DU_TYPE[q.type] && !q.lieu) || (q.type === "dedicace" && !q.dedicace);

  async function charger() {
    try {
      donnees = await C.appel("console_qr");
      rendre();
    } catch (e) {
      lignes.innerHTML = `<tr><td colspan="6"><p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p></td></tr>`;
      $("[data-resume]").textContent = "";
    }
  }

  function visibles() {
    const f = new FormData(filtres);
    const texte = String(f.get("texte") || "").trim().toLowerCase();
    const type = f.get("type");
    const etat = f.get("etat");
    return donnees.qr.filter((q) =>
      (!texte || q.nom.toLowerCase().includes(texte) || q.code.toLowerCase().includes(texte) ||
        (q.lieu && q.lieu.nom.toLowerCase().includes(texte)) || (q.dedicace && q.dedicace.artiste.toLowerCase().includes(texte))) &&
      (!type || q.type === type) &&
      (!etat || (etat === "actifs" && q.actif) || (etat === "eteints" && !q.actif) ||
        (etat === "a-relier" && aRelier(q)) || (etat === "jamais" && !q.scans)));
  }

  function relie(q) {
    const p = [];
    if (q.lieu) p.push(`<span class="cpuce cpuce--ok">${App.icon("lieu")} ${esc(q.lieu.nom)}</span>`);
    if (q.dedicace) p.push(`<span class="cpuce cpuce--ok">${App.icon("etoile")} ${esc(q.dedicace.artiste)} · ${esc(quand(q.dedicace.debut))}</span>`);
    if (LIEUX_DU_TYPE[q.type] && !q.lieu) {
      p.push(`<span class="cpuce ${q.type === "scene" ? "cpuce--danger" : "cpuce--alerte"}">${App.icon("alerte")} ${q.type === "scene" ? "Sans scène : concert non reconnu" : "À relier à un lieu"}</span>`);
    }
    if (q.type === "dedicace" && !q.dedicace) p.push(`<span class="cpuce cpuce--alerte">${App.icon("alerte")} À relier à une séance</span>`);
    if (q.mission) p.push(`<span class="cpuce">${App.icon("cible")} ${esc(q.mission)}${q.mission_active ? "" : " (éteinte)"}</span>`);
    if (q.badge) p.push(`<span class="cpuce">${App.icon("etoile")} ${esc(q.badge)}</span>`);
    return p.length ? `<div class="cpuces">${p.join("")}</div>` : '<span class="ctable__sous">—</span>';
  }

  function rendre() {
    const qs = donnees.qr;
    const actifs = qs.filter((q) => q.actif).length;
    const scansJour = qs.reduce((s, q) => s + q.scans_jour, 0);
    const arelier = qs.filter(aRelier).length;
    $("[data-resume]").textContent = qs.length
      ? [`${n(actifs)} actif${actifs > 1 ? "s" : ""} sur ${n(qs.length)}`, `${n(scansJour)} scan${scansJour > 1 ? "s" : ""} aujourd'hui`,
        arelier ? `${n(arelier)} à relier` : ""].filter(Boolean).join(" · ")
      : "Aucun QR pour l'instant";

    const liste = visibles();
    if (!liste.length) {
      lignes.innerHTML = `<tr><td colspan="6" class="cvide">${qs.length ? "Aucun QR ne correspond." : "Aucun QR. « Nouveau QR » pour commencer."}</td></tr>`;
      return;
    }
    lignes.innerHTML = liste.map((q) => {
      const t = TYPES[q.type] || { nom: q.type };
      const puces = [
        `<span class="cpuce">${esc(t.nom)}${q.type === "relique" && q.rarete ? ` · ${esc(RARETES[q.rarete] || q.rarete)}` : ""}</span>`,
        q.type === "relique" && !q.actif ? `<span class="cpuce cpuce--epique">${App.icon("cadenas")} Indice caché</span>` : ""
      ].join("");
      return `<tr data-id="${esc(q.id)}" class="${q.actif ? "" : "is-eteint"}">
        <td><div class="cligne"><strong>${esc(q.nom)}</strong><span class="ctable__code">${esc(q.code)}</span>
          <div class="cpuces">${puces}</div></div></td>
        <td class="ctable__large">${relie(q)}</td>
        <td class="ctable__nb"><strong>+${n(q.xp)}</strong></td>
        <td class="ctable__nb">${n(q.scans_jour)}<span class="ctable__sous">${n(q.scans)} au total</span></td>
        <td class="ctable__bascule">${C.interrupteur(q.actif, `data-activer="${esc(q.id)}"`, `QR « ${q.nom} » actif`)}</td>
        <td class="ctable__actions">${q.scans ? `<button class="cbtn" type="button" data-historique-de="${esc(q.id)}">Historique</button>` : ""}<button class="cbtn" type="button">Modifier</button></td>
      </tr>`;
    }).join("");
  }

  filtres.addEventListener("input", () => donnees && rendre());
  filtres.addEventListener("submit", (e) => e.preventDefault());

  /* ---------- Allumer / éteindre ---------- */
  lignes.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-activer]");
    if (!input) return;
    const q = donnees.qr.find((x) => x.id === input.dataset.activer);
    if (!q) return;
    const actif = input.checked;
    if (actif && q.type === "relique") {
      const ok = await C.confirmer({
        titre: `Allumer « ${q.nom} » ?`,
        texte: q.indice ? `L'indice devient visible par tous les joueurs : « ${q.indice} ». La relique est bien cachée ?` : "Son indice (vide) et sa rareté deviennent visibles par tous. La relique est bien cachée ?",
        oui: "Allumer"
      });
      if (!ok) { input.checked = false; return; }
    }
    input.disabled = true;
    try {
      await C.appel("console_activer", { p_quoi: "qr", p_id: q.id, p_actif: actif });
      q.actif = actif;
      C.dire(`« ${q.nom} » ${actif ? "allumé" : "éteint"}`);
      rendre();
    } catch (err) {
      input.checked = q.actif;
      C.dire(C.message(err));
    } finally {
      input.disabled = false;
    }
  });

  lignes.addEventListener("click", (e) => {
    if (e.target.closest(".cinter")) return;
    const h = e.target.closest("[data-historique-de]");
    if (h) { historique(donnees.qr.find((q) => q.id === h.dataset.historiqueDe)); return; }
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrir(donnees.qr.find((q) => q.id === tr.dataset.id));
  });

  /* ---------- La boîte ---------- */
  const nomDuQr = (id) => ((donnees.qr.find((q) => q.id === id) || {}).nom || "un autre QR");

  function remplirLieux(type, choisi) {
    const cats = LIEUX_DU_TYPE[type];
    $("[data-champ-lieu]").hidden = !cats;
    if (!cats) return;
    $("[data-lieu-label]").textContent = LIEU_LABEL[type];
    const lieux = donnees.lieux.filter((l) => cats.includes(l.categorie));
    const monId = courant ? courant.id : null;
    $("[data-lieux]").innerHTML = `<option value="">${lieux.length ? "Aucun (à relier plus tard)" : "Aucun lieu de ce genre dans le plan"}</option>` +
      lieux.map((l) => {
        const pris = l.qr_id && l.qr_id !== monId;
        return `<option value="${esc(l.id)}"${pris ? " disabled" : ""}>${esc(l.nom)}${pris ? ` — déjà : ${esc(nomDuQr(l.qr_id))}` : ""}</option>`;
      }).join("");
    $("[data-lieux]").value = choisi || "";
    $("[data-aide-lieu]").textContent = lieux.length
      ? (type === "scene" ? "Sans scène reliée, le scan rapporte des XP mais aucun concert n'est reconnu." : "Le lieu garde un seul QR.")
      : "Les lieux se saisissent dans l'écran « Programme, lieux » (étape 6.4). Tu pourras relier ce QR ensuite.";
  }

  function remplirDedicaces(type, choisie) {
    const ok = type === "dedicace";
    $("[data-champ-dedicace]").hidden = !ok;
    if (!ok) return;
    const monId = courant ? courant.id : null;
    const ds = donnees.dedicaces;
    $("[data-dedicaces]").innerHTML = `<option value="">${ds.length ? "Aucune (à relier plus tard)" : "Aucune séance au programme"}</option>` +
      ds.map((d) => {
        const pris = d.qr_id && d.qr_id !== monId;
        return `<option value="${esc(d.id)}"${pris ? " disabled" : ""}>${esc(d.artiste)} — ${esc(quand(d.debut))}${pris ? ` (déjà : ${esc(nomDuQr(d.qr_id))})` : ""}</option>`;
      }).join("");
    $("[data-dedicaces]").value = choisie || "";
    $("[data-aide-dedicace]").textContent = ds.length ? "" : "Les séances se saisissent dans l'écran « Programme, lieux » (étape 6.4).";
  }

  function ajuster({ changementDeType = false } = {}) {
    const el = form.elements;
    const type = el.type.value;
    const relique = type === "relique";
    $("[data-champ-rarete]").hidden = !relique;
    $("[data-champ-indice]").hidden = !relique;
    $("[data-aide-type]").textContent = AIDE_TYPE[type] || "";
    const cle = relique ? el.rarete.value : type;
    const bareme = donnees.bareme[cle];
    el.xp.placeholder = bareme != null ? String(bareme) : "";
    $("[data-aide-xp]").textContent = bareme != null ? `Vide = barème : ${bareme} XP.` : "";
    $("[data-aide-actif]").textContent = relique
      ? "Une relique active montre son indice à tous : ne l'allume qu'une fois cachée."
      : "Éteint : le scan est refusé (« pas encore actif »).";
    if (changementDeType) {
      el.actif.checked = !relique;
      remplirLieux(type, "");
      remplirDedicaces(type, "");
    }
  }
  form.elements.type.addEventListener("change", () => ajuster({ changementDeType: true }));
  form.elements.rarete.addEventListener("change", () => ajuster());

  function apercu(q) {
    const zone = $("[data-apercu]");
    zone.hidden = !q;
    if (!q) { zone.innerHTML = ""; return; }
    zone.innerHTML = `${App.qrSvg(E.adresse(q.code), { niveau: "Q", titre: q.code })}
      <div class="cqr__texte">
        <span class="cqr__code">${esc(q.code)}</span>
        <span class="cqr__lien">${esc(E.adresse(q.code))}</span>
        <span><button class="cbtn" type="button" data-imprimer-un>${App.icon("billet")} Imprimer son étiquette</button></span>
      </div>`;
  }

  function ouvrir(q) {
    courant = q || null;
    form.reset();
    const el = form.elements;
    $("[data-badges]").innerHTML = '<option value="">Aucun</option>' +
      donnees.badges.map((b) => `<option value="${esc(b.id)}">${esc(b.nom)}</option>`).join("");
    $("[data-missions]").innerHTML = '<option value="">Aucune</option>' +
      donnees.missions.map((m) => `<option value="${esc(m.id)}">${esc(m.titre)}${m.active ? "" : " (éteinte)"}</option>`).join("");
    el.type.disabled = !!q;
    el.rarete.disabled = !!q;
    if (q) {
      el.type.value = q.type;
      if (q.rarete) el.rarete.value = q.rarete;
      el.nom.value = q.nom;
      el.indice.value = q.indice || "";
      el.xp.value = q.xp;
      el.badge_id.value = q.badge_id || "";
      el.mission_id.value = q.mission_id || "";
      el.actif.checked = q.actif;
    } else {
      el.type.value = "scene";
      el.actif.checked = true;
    }
    ajuster();
    remplirLieux(el.type.value, q && q.lieu ? q.lieu.id : "");
    remplirDedicaces(el.type.value, q && q.dedicace ? q.dedicace.id : "");
    apercu(q);
    $("[data-b-titre]").textContent = q ? "Modifier le QR" : "Nouveau QR";
    $("[data-b-sous]").textContent = q
      ? `${TYPES[q.type] ? TYPES[q.type].nom : q.type} · scanné ${n(q.scans_jour)} fois aujourd'hui, ${n(q.scans)} au total · le type et la rareté ne changent plus`
      : "Le code imprimé (DQ-…) est tiré par la base à l'enregistrement.";
    $("[data-supprimer]").hidden = !q;
    $("[data-erreur]").hidden = true;
    boite.showModal();
    (q ? el.nom : el.type).focus();
  }

  function erreur(texte) {
    const zone = $("[data-erreur]");
    zone.innerHTML = `${App.icon("alerte")}<span>${esc(texte)}</span>`;
    zone.hidden = false;
    zone.scrollIntoView({ block: "nearest" });
  }

  $("[data-nouveau]").addEventListener("click", () => donnees && ouvrir(null));
  boite.addEventListener("click", (e) => {
    if (e.target.closest("[data-fermer]")) boite.close();
    if (e.target.closest("[data-imprimer-un]") && courant) { boite.close(); imprimer(courant); }
  });

  $("[data-enregistrer]").addEventListener("click", async (e) => {
    const el = form.elements;
    if (!el.nom.value.trim()) { erreur(C.messages.LABEL_MANQUANT); el.nom.focus(); return; }
    const type = el.type.value;
    const qr = {
      nom: el.nom.value.trim(), type, rarete: type === "relique" ? el.rarete.value : "",
      indice: type === "relique" ? el.indice.value.trim() : "", xp: el.xp.value,
      badge_id: el.badge_id.value, mission_id: el.mission_id.value,
      lieu_id: LIEUX_DU_TYPE[type] ? el.lieu_id.value : "", dedicace_id: type === "dedicace" ? el.dedicace_id.value : "",
      actif: el.actif.checked
    };
    if (courant && qr.actif && !courant.actif && type === "relique") {
      const ok = await C.confirmer({ titre: "Allumer la relique ?", texte: "Son indice devient visible par tous les joueurs. Elle est bien cachée ?", oui: "Allumer" });
      if (!ok) return;
    }
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try {
      const r = await C.appel("console_qr_enregistrer", { p_id: courant ? courant.id : null, p_qr: qr });
      const nouveau = !courant;
      boite.close();
      await charger();
      if (nouveau) {
        C.dire(`QR créé : ${r.code}`);
        const q = donnees && donnees.qr.find((x) => x.id === r.id);
        if (q) ouvrir(q);   // pour voir son code et imprimer son étiquette
      } else {
        C.dire("QR enregistré");
      }
    } catch (err) {
      erreur(C.message(err));
    } finally {
      liberer();
    }
  });

  $("[data-supprimer]").addEventListener("click", async (e) => {
    if (!courant) return;
    const q = courant;
    if (q.scans) { erreur(C.messages.QR_DEJA_SCANNE); return; }
    const bouton = e.currentTarget;
    const ok = await C.confirmer({
      titre: `Supprimer « ${q.nom} » (${q.code}) ?`,
      texte: "Personne ne l'a encore scanné. Une étiquette déjà imprimée ne marchera plus.",
      oui: "Supprimer", danger: true
    });
    if (!ok) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("console_qr_supprimer", { p_id: q.id });
      boite.close();
      C.dire("QR supprimé");
      await charger();
    } catch (err) {
      erreur(C.message(err));
    } finally {
      liberer();
    }
  });

  /* ---------- Historique ---------- */
  const boiteH = $("[data-historique]");
  boiteH.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteH.close(); });
  async function historique(q) {
    if (!q) return;
    $("[data-h-titre]").textContent = q.nom;
    $("[data-h-sous]").textContent = q.code;
    const corps = $("[data-h-corps]");
    corps.innerHTML = '<p class="cvide">Chargement…</p>';
    boiteH.showModal();
    try {
      const h = await C.appel("console_qr_scans", { p_id: q.id });
      corps.innerHTML = `<div class="cfiche__stats" style="grid-template-columns:repeat(2,1fr)">
          <div class="cfiche__stat"><strong>${n(h.jour)}</strong><span>Aujourd'hui</span></div>
          <div class="cfiche__stat"><strong>${n(h.total)}</strong><span>Au total</span></div></div>
        ${h.derniers.length ? `<div class="cfiche__bloc"><p class="csous-titre">Derniers scans${h.total > h.derniers.length ? ` (${h.derniers.length} sur ${n(h.total)})` : ""}</p>
        <ul class="cliste">${h.derniers.map((s) => `<li><span class="cliste__point"></span>
          <span class="cliste__texte"><a href="joueurs.html#${esc(s.joueur_id)}"><strong>${esc(s.pseudo)}</strong></a>${s.artiste ? ` · concert de ${esc(s.artiste)}` : ""}</span>
          <span class="cliste__quand">${esc(quand(s.at))}</span></li>`).join("")}</ul></div>` : '<p class="cvide">Pas encore scanné.</p>'}`;
    } catch (err) {
      corps.innerHTML = `<p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(err))}</span></p>`;
    }
  }

  /* ---------- Étiquettes ---------- */
  const boiteI = $("[data-impression]");
  const formI = $("[data-i-form]");
  const cadre = $("[data-i-apercu]");
  let seul = null;   // QR imprimé seul (depuis sa fiche)
  boiteI.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteI.close(); });

  const trier = (liste) => liste.slice().sort((a, b) =>
    ORDRE_TYPES.indexOf(a.type) - ORDRE_TYPES.indexOf(b.type) || a.nom.localeCompare(b.nom, "fr"));

  function aImprimer() {
    const portee = formI.elements.portee.value;
    if (portee === "un" && seul) return [seul];
    if (portee === "actifs") return trier(donnees.qr.filter((q) => q.actif));
    if (portee === "tous") return trier(donnees.qr);
    return trier(visibles());
  }

  async function majApercu() {
    const liste = aImprimer();
    const format = Number(formI.elements.format.value);
    const parPage = { 6: 6, 12: 12, 1: 1 }[format];
    const pages = Math.ceil(liste.length / parPage);
    $("[data-i-sous]").textContent = liste.length
      ? `${n(liste.length)} étiquette${liste.length > 1 ? "s" : ""} · ${n(pages)} page${pages > 1 ? "s" : ""} A4`
      : "Rien à imprimer avec ce choix";
    $("[data-i-lancer]").disabled = !liste.length;
    await E.afficher(cadre, E.document(liste, format));
  }
  formI.addEventListener("change", majApercu);

  function imprimer(q) {
    if (!donnees) return;
    seul = q || null;
    $("[data-i-un]").hidden = !seul;
    if (seul) $("[data-i-un-nom]").textContent = `Seulement « ${seul.nom} »`;
    formI.elements.portee.value = seul ? "un" : "filtre";
    const essai = $("[data-i-essai]");
    essai.hidden = !E.essai();
    essai.innerHTML = `${App.icon("alerte")}<span>Poste d'essai (${esc(E.site() || "fichier local")}) : les QR mènent à cette adresse, pas au vrai site. Chaque étiquette porte « ESSAI ». Imprime les vraies depuis le site en ligne.</span>`;
    boiteI.showModal();
    majApercu();
  }
  $("[data-imprimer]").addEventListener("click", () => imprimer(null));

  $("[data-i-lancer]").addEventListener("click", (e) => {
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try {
      cadre.contentWindow.focus();
      cadre.contentWindow.print();
    } catch (err) {
      C.dire("Impossible de lancer l'impression depuis ce navigateur.");
    } finally {
      liberer();
    }
  });

  await charger();
});
