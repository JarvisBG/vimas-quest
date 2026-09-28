/* ==========================================================================
   Console — écran Coups de cœur (étape 5.1 Vimas), style Game Master d'Otaku
   Lecture : coeur_config et game_state (lecture publique), coeur_palmares
   par catégorie (le même que l'écran géant, 20 premiers), nombre de cœurs
   donnés (coeurs, lecture staff) — en parallèle, relu au signal du temps
   réel (au plus 1 / 5 s, filet 60 s).
   Écriture : la ligne coeur_config (politique « ecriture staff » d'Otaku :
   gm et staff) — ouverture, clôture datée, cœurs par catégorie, XP par cœur.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;
  /* Journées du festival (même repère que la grille du programme) */
  const FESTIVAL = { debut: Date.parse("2026-12-26T06:00:00+01:00"), fin: Date.parse("2026-12-28T06:00:00+01:00") };
  const form = $("[data-reglages]");
  let cfg = null, phase = null, modifie = false;
  form.addEventListener("input", () => { modifie = true; });

  const heureCameroun = (iso) => new Date(Date.parse(iso) + 3600e3).toISOString().slice(0, 16);   // → datetime-local
  const quand = (iso) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Douala", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const erreurTable = (r) => new App.ErreurServeur(/fetch/i.test(r.error.message) ? "RESEAU" : "ERREUR", r.error.message);

  async function charger() {
    const sb = C.sb();
    const [rc, rg, artistes, stands, rn] = await Promise.all([
      sb.from("coeur_config").select("*").eq("id", 1).single(),
      sb.from("game_state").select("phase").eq("id", 1).single(),
      C.appel("coeur_palmares", { p_categorie: "artistes", p_limite: 20 }),
      C.appel("coeur_palmares", { p_categorie: "stands", p_limite: 20 }),
      sb.from("coeurs").select("player_id", { count: "exact", head: true })
    ]);
    for (const r of [rc, rg]) if (r.error) throw erreurTable(r);
    cfg = rc.data;
    phase = rg.data.phase;
    rendre(artistes || [], stands || [], rn.count);
  }

  function rendre(artistes, stands, total) {
    const clos = Date.now() >= Date.parse(cfg.cloture) || phase === "CLOTURE";
    const etat = !cfg.actif ? "Votes fermés (désactivés)"
      : clos ? (phase === "CLOTURE" ? "Votes clos (jeu terminé)" : `Votes clos depuis ${quand(cfg.cloture)}`)
      : `Votes ouverts jusqu'au ${quand(cfg.cloture)}`;
    $("[data-resume]").textContent = `${etat}${total !== null && total !== undefined ? ` · ${n(total)} cœur${total > 1 ? "s" : ""} donnés` : ""}`;

    const c = Date.parse(cfg.cloture);
    const alerte = $("[data-alerte-date]");
    alerte.hidden = c > FESTIVAL.debut && c <= FESTIVAL.fin;
    if (!alerte.hidden) alerte.innerHTML = `${App.icon("alerte")}<span>La clôture (${esc(quand(cfg.cloture))}) tombe en dehors du VIMAS FEST (26 et 27 décembre). Règle-la ci-contre, par exemple le dimanche 27 à 20 h.</span>`;

    if (!modifie) {   // une saisie en cours n'est jamais écrasée par une relecture
      form.actif.checked = cfg.actif;
      form.cloture.value = heureCameroun(cfg.cloture);
      form.max.value = cfg.max_coeurs;
      form.xp.value = cfg.xp_par_coeur;
    }

    for (const [cat, liste] of [["artistes", artistes], ["stands", stands]]) {
      const somme = liste.reduce((s, x) => s + x.coeurs, 0);
      $(`[data-note-${cat}]`).textContent = liste.length ? `${n(somme)} cœurs sur les ${liste.length} premiers` : "";
      $(`[data-palmares="${cat}"]`).innerHTML = liste.length ? liste.map((x, i) => `<li>
          <span class="cliste__place cliste__place--${i + 1}">${i + 1}</span>
          <span class="cliste__texte"><strong>${esc(x.nom)}</strong></span>
          <span class="cliste__val">${App.icon("coeur")} ${n(x.coeurs)}</span></li>`).join("")
        : `<li class="cvide">Aucun cœur pour l'instant.</li>`;
    }
  }

  const zone = $("[data-console-contenu]");
  C.suivre("console-coeurs", [["*", "coeurs"], ["UPDATE", "coeur_config"], ["UPDATE", "game_state"]], async () => {
    try { await charger(); $("[data-erreur-lecture]")?.remove(); }
    catch (e) {
      if (!cfg && !$("[data-erreur-lecture]")) {
        zone.insertAdjacentHTML("afterbegin", `<p class="message" role="alert" data-erreur-lecture>${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`);
      }
      throw e;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneErr = $("[data-erreur]");
    const dire = (t) => { zoneErr.innerHTML = t ? `${App.icon("alerte")}<span>${esc(t)}</span>` : ""; zoneErr.hidden = !t; };
    dire("");
    if (!form.cloture.value) { dire("Indique la date et l'heure de clôture."); form.cloture.focus(); return; }
    const max = Math.round(Number(form.max.value));
    const xp = Math.round(Number(form.xp.value));
    if (!(max >= 1 && max <= 10)) { dire("De 1 à 10 cœurs par catégorie."); form.max.focus(); return; }
    if (!(xp >= 0 && xp <= 1000)) { dire("De 0 à 1 000 XP par cœur."); form.xp.focus(); return; }
    const valeurs = { actif: form.actif.checked, cloture: `${form.cloture.value}:00+01:00`, max_coeurs: max, xp_par_coeur: xp };
    if (cfg && max < cfg.max_coeurs) {
      const ok = await C.confirmer({ titre: `Passer à ${max} cœur${max > 1 ? "s" : ""} par catégorie ?`, texte: "Les joueurs qui en ont déjà donné plus les gardent ; ils ne pourront simplement plus en ajouter.", oui: "Enregistrer" });
      if (!ok) return;
    }
    const liberer = C.occuper(form.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      const r = await C.sb().from("coeur_config").update(valeurs).eq("id", 1).select().single();
      if (r.error) {
        const err = erreurTable(r);
        if (r.error.code === "PGRST116") err.code = "ACCES_REFUSE";   // aucune ligne modifiée : pas les droits
        throw err;
      }
      C.dire("Réglages des coups de cœur enregistrés");
      modifie = false;
      await charger();
    } catch (err) {
      dire(C.message(err));
    } finally { liberer(); }
  });
});
