/* ==========================================================================
   Console — écran Missions (étape 6.3), style Game Master d'Otaku
   Lecture : console_missions (missions + terminées aujourd'hui / au total +
   liste des badges) en UN appel au chargement, puis seulement après une
   écriture. Recherche et filtres : sur la liste déjà chargée, sans requête.
   Écritures (bouton verrouillé, jamais réessayées) :
   console_mission_enregistrer (tous les champs d'un coup),
   console_activer('mission'), console_mission_supprimer (refusée dès qu'un
   joueur l'a terminée : on l'éteint à la place).
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    TITRE_MANQUANT: "Donne un titre à la mission (80 caractères au plus).",
    CONSIGNE_TROP_LONGUE: "La consigne fait 400 caractères au plus.",
    TYPE_INVALIDE: "Type de mission inconnu.",
    CATEGORIE_INVALIDE: "Catégorie inconnue.",
    COMPTEUR_INVALIDE: "Choisis ce qui fait avancer la mission.",
    OBJECTIF_INVALIDE: "L'objectif va de 1 à 1 000.",
    XP_INVALIDE: "Les XP vont de 0 à 5 000.",
    PRIORITE_INVALIDE: "La priorité va de −9 à 9.",
    BADGE_INCONNU: "Ce badge n'existe plus : recharge la page.",
    QUETE_INCONNUE: "Cette mission n'existe plus : recharge la page.",
    MISSION_DEJA_FAITE: "Des joueurs l'ont déjà terminée : la supprimer effacerait leur historique. Éteins-la plutôt."
  });

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;
  /* Mêmes clés que quests.categorie et que categoriesMissions (mock.js) */
  const CATEGORIES = {
    exploration: { nom: "Exploration", icone: "plan" },
    musique: { nom: "Musique", icone: "onde" },
    gourmand: { nom: "Gourmand", icone: "couverts" },
    social: { nom: "Social", icone: "coeur" },
    defi: { nom: "Défi", icone: "eclair" }
  };
  /* Mêmes clés que _compteurs_mission() en base */
  const COMPTEURS = [
    ["scan_any", "Tout scan de QR", "Chaque QR différent scanné dans la journée compte une fois."],
    ["scan_scene", "Scans de scènes", "Chaque scène différente scannée dans la journée."],
    ["scan_stand", "Scans de stands", "Chaque stand différent scanné dans la journée."],
    ["scan_foodtruck", "Scans de food-trucks", "Chaque food-truck différent scanné dans la journée."],
    ["scan_service", "Scans de points pratiques", "Point info, eau, secours… (QR de type service)."],
    ["scan_relique", "Reliques trouvées", "Chaque relique trouvée dans la journée."],
    ["scan_dedicace", "Dédicaces", "Chaque QR de séance de dédicaces scanné."],
    ["scan_surprise", "QR événement", "Les QR de type « événement » (surprise)."],
    ["qr", "QR reliés à cette mission", "Seulement les QR reliés à cette mission (écran QR codes, champ « Mission »)."],
    ["manuel", "Validée au stand", "Le staff la valide en scannant la carte du joueur (écran Joueurs). La consigne dit ce qu'il doit vérifier."],
    ["blind", "Manches de blind test", "Compte à la fin d'une manche jouée (le joueur doit avoir son ticket du jour)."],
    ["coeur", "Coups de cœur donnés", "Chaque cœur donné à un artiste ou à un stand."]
  ];
  const NOM_COMPTEUR = Object.fromEntries(COMPTEURS.map(([k, nom]) => [k, nom]));

  const lignes = $("[data-lignes]");
  const filtres = $("[data-filtres]");
  const boite = $("[data-boite]");
  const form = $("[data-form]");
  let donnees = null;
  let courante = null;   // mission ouverte dans la boîte (null = nouvelle)

  /* Menus fixes du formulaire et du filtre */
  const optionsCategories = Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${esc(c.nom)}</option>`).join("");
  $("[data-categories]").insertAdjacentHTML("beforeend", optionsCategories);
  $("#f-categorie").insertAdjacentHTML("beforeend", optionsCategories + '<option value="-">Sans catégorie</option>');
  $("[data-compteurs]").innerHTML = COMPTEURS.map(([k, nom]) => `<option value="${k}">${esc(nom)}</option>`).join("");

  async function charger() {
    try {
      donnees = await C.appel("console_missions");
      rendre();
    } catch (e) {
      lignes.innerHTML = `<tr><td colspan="6"><p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p></td></tr>`;
      $("[data-resume]").textContent = "";
    }
  }

  function visibles() {
    const f = new FormData(filtres);
    const texte = String(f.get("texte") || "").trim().toLowerCase();
    const etat = f.get("etat");
    const cat = f.get("categorie");
    return donnees.missions.filter((m) =>
      (!texte || m.titre.toLowerCase().includes(texte) || (m.consigne || "").toLowerCase().includes(texte)) &&
      (!etat || (etat === "actives" && m.active) || (etat === "eteintes" && !m.active) ||
        (etat === "staff" && m.compteur === "manuel") || (etat === "secretes" && m.type === "secrete")) &&
      (!cat || (cat === "-" ? !m.categorie : m.categorie === cat)));
  }

  function rendre() {
    const ms = donnees.missions;
    const actives = ms.filter((m) => m.active).length;
    const faitesJour = ms.reduce((s, m) => s + m.faites_jour, 0);
    $("[data-resume]").textContent = ms.length
      ? `${n(actives)} active${actives > 1 ? "s" : ""} sur ${n(ms.length)} · ${n(faitesJour)} terminée${faitesJour > 1 ? "s" : ""} aujourd'hui`
      : "Aucune mission pour l'instant";

    const liste = visibles();
    if (!liste.length) {
      lignes.innerHTML = `<tr><td colspan="6" class="cvide">${ms.length ? "Aucune mission ne correspond." : "Aucune mission. « Nouvelle mission » pour commencer."}</td></tr>`;
      return;
    }
    lignes.innerHTML = liste.map((m) => {
      const cat = CATEGORIES[m.categorie];
      const puces = [
        cat ? `<span class="cpuce">${App.icon(cat.icone)} ${esc(cat.nom)}</span>` : "",
        m.compteur === "manuel" ? `<span class="cpuce cpuce--alerte">${App.icon("valide")} Au stand</span>` : "",
        m.type === "secrete" ? `<span class="cpuce cpuce--epique">${App.icon("cadenas")} Secrète</span>` : "",
        m.badge ? `<span class="cpuce">${App.icon("etoile")} ${esc(m.badge)}</span>` : "",
        m.priorite ? `<span class="cpuce">Priorité ${m.priorite > 0 ? "+" : "−"}${Math.abs(m.priorite)}</span>` : "",
        m.compteur === "qr" && !m.qr ? `<span class="cpuce cpuce--danger">${App.icon("alerte")} Aucun QR relié</span>` : ""
      ].join("");
      const avance = m.compteur === "manuel" ? NOM_COMPTEUR.manuel
        : `${esc(NOM_COMPTEUR[m.compteur] || m.compteur)} × ${n(m.objectif)}`;
      return `<tr data-id="${esc(m.id)}" class="${m.active ? "" : "is-eteint"}">
        <td><div class="cligne"><strong>${esc(m.titre)}</strong>${m.consigne ? `<small>${esc(m.consigne)}</small>` : ""}
          ${puces ? `<div class="cpuces">${puces}</div>` : ""}</div></td>
        <td class="ctable__large">${avance}${m.compteur === "qr" ? `<span class="ctable__sous">${n(m.qr)} QR relié${m.qr > 1 ? "s" : ""}</span>` : ""}</td>
        <td class="ctable__nb"><strong>+${n(m.xp)}</strong></td>
        <td class="ctable__nb">${n(m.faites_jour)}<span class="ctable__sous">${n(m.faites)} au total</span></td>
        <td class="ctable__bascule">${C.interrupteur(m.active, `data-activer="${esc(m.id)}"`, `Mission « ${m.titre} » active`)}</td>
        <td class="ctable__actions"><button class="cbtn" type="button" data-modifier="${esc(m.id)}">Modifier</button></td>
      </tr>`;
    }).join("");
  }

  filtres.addEventListener("input", () => donnees && rendre());
  filtres.addEventListener("submit", (e) => e.preventDefault());

  /* ---------- Allumer / éteindre, depuis la liste ---------- */
  lignes.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-activer]");
    if (!input) return;
    const m = donnees.missions.find((x) => x.id === input.dataset.activer);
    if (!m) return;
    input.disabled = true;
    try {
      await C.appel("console_activer", { p_quoi: "mission", p_id: m.id, p_actif: input.checked });
      m.active = input.checked;
      C.dire(`« ${m.titre} » ${m.active ? "activée" : "éteinte"}`);
      rendre();
    } catch (err) {
      input.checked = m.active;
      C.dire(C.message(err));
    } finally {
      input.disabled = false;
    }
  });

  lignes.addEventListener("click", (e) => {
    if (e.target.closest(".cinter")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrir(donnees.missions.find((m) => m.id === tr.dataset.id));
  });

  /* ---------- La boîte ---------- */
  function ajuster() {
    const compteur = form.elements.compteur.value;
    const manuel = compteur === "manuel";
    $("[data-champ-objectif]").hidden = manuel;
    $("[data-aide-compteur]").textContent = (COMPTEURS.find(([k]) => k === compteur) || [])[2] || "";
    $("[data-aide-consigne]").textContent = manuel
      ? "Ce que le joueur lit, et ce que le staff doit vérifier avant de valider (affiché dans sa fiche)."
      : "Ce que le joueur lit sur son téléphone.";
  }
  form.elements.compteur.addEventListener("change", ajuster);

  function ouvrir(m) {
    courante = m || null;
    form.reset();
    $("[data-badges]").innerHTML = '<option value="">Aucun</option>' +
      donnees.badges.map((b) => `<option value="${esc(b.id)}">${esc(b.nom)}</option>`).join("");
    const el = form.elements;
    if (m) {
      el.titre.value = m.titre;
      el.consigne.value = m.consigne || "";
      el.compteur.value = m.compteur;
      if (el.compteur.value !== m.compteur) {   // compteur d'avant 6.3 : on le montre tel quel
        el.compteur.insertAdjacentHTML("beforeend", `<option value="${esc(m.compteur)}">${esc(m.compteur)} (ancien)</option>`);
        el.compteur.value = m.compteur;
      }
      el.objectif.value = m.objectif;
      el.xp.value = m.xp;
      el.categorie.value = m.categorie || "";
      el.priorite.value = m.priorite;
      el.badge_id.value = m.badge_id || "";
      el.secrete.checked = m.type === "secrete";
      el.active.checked = m.active;
    } else {
      el.compteur.value = "scan_any";
    }
    $("[data-b-titre]").textContent = m ? "Modifier la mission" : "Nouvelle mission";
    $("[data-b-sous]").textContent = m
      ? `Terminée ${n(m.faites_jour)} fois aujourd'hui · ${n(m.faites)} au total`
      : "Elle apparaît sur les téléphones dès qu'elle est active.";
    $("[data-supprimer]").hidden = !m;
    $("[data-erreur]").hidden = true;
    ajuster();
    boite.showModal();
    el.titre.focus();
  }

  function erreur(texte) {
    const zone = $("[data-erreur]");
    zone.innerHTML = `${App.icon("alerte")}<span>${esc(texte)}</span>`;
    zone.hidden = false;
    zone.scrollIntoView({ block: "nearest" });
  }

  $("[data-nouvelle]").addEventListener("click", () => donnees && ouvrir(null));
  boite.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boite.close(); });

  $("[data-enregistrer]").addEventListener("click", async (e) => {
    const el = form.elements;
    if (!el.titre.value.trim()) { erreur(C.messages.TITRE_MANQUANT); el.titre.focus(); return; }
    // Le type d'Otaku (boss, collection) n'a plus d'effet : on le garde tel quel s'il n'est pas « secrète »
    const typeAvant = courante && courante.type !== "secrete" ? courante.type : "standard";
    const mission = {
      titre: el.titre.value.trim(), consigne: el.consigne.value.trim(),
      compteur: el.compteur.value, objectif: el.objectif.value || 1, xp: el.xp.value,
      categorie: el.categorie.value, priorite: el.priorite.value || 0, badge_id: el.badge_id.value,
      type: el.secrete.checked ? "secrete" : typeAvant, active: el.active.checked
    };
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try {
      await C.appel("console_mission_enregistrer", { p_id: courante ? courante.id : null, p_mission: mission });
      boite.close();
      C.dire(courante ? "Mission enregistrée" : "Mission créée");
      await charger();
    } catch (err) {
      erreur(C.message(err));
    } finally {
      liberer();
    }
  });

  $("[data-supprimer]").addEventListener("click", async (e) => {
    if (!courante) return;
    const m = courante;
    if (m.faites) { erreur(C.messages.MISSION_DEJA_FAITE); return; }
    const bouton = e.currentTarget;
    const ok = await C.confirmer({
      titre: `Supprimer « ${m.titre} » ?`,
      texte: "Personne ne l'a encore terminée. Les avancées en cours sont effacées, les QR reliés sont déliés.",
      oui: "Supprimer", danger: true
    });
    if (!ok) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("console_mission_supprimer", { p_id: m.id });
      boite.close();
      C.dire("Mission supprimée");
      await charger();
    } catch (err) {
      erreur(C.message(err));
    } finally {
      liberer();
    }
  });

  await charger();
});
