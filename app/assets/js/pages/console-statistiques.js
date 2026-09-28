/* ==========================================================================
   Console — écran Statistiques (étape 5.4 Vimas), modèle d'Otaku (admin/statistiques.html)
   Lecture seule, GM et staff. Aucun nom, aucun numéro : que des comptages.
     profil_stats()    → fiche fan, contacts consentis, questions du coffre, cœurs
     stats_parcours()  → jours, retour au lendemain, temps passé, heures, profondeur, QR
     admin_stats()     → joueurs qui ont vraiment joué, scans
     profil_options()  → libellés de la fiche (la base stocke « 19-24 », l'écran lit « 19 - 24 ans »)
     micro_questions, artistes (lecture publique) → ordre des réponses, noms des artistes
   Relu à la demande (bouton) : ces calculs parcourent tout le journal, pas de temps réel.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;
  const n = C.nombre;

  const acces = await C.garde();
  if (!acces) return;

  let DERNIER = null;   // tout ce qui a été chargé, gardé pour l'export CSV

  const FICHE = [
    { cle: "tranche_age", titre: "Quel âge ils ont", echelle: true },
    { cle: "sexe", titre: "Hommes et femmes", echelle: true },
    { cle: "quartier", titre: "D'où ils viennent", echelle: false },
    { cle: "genre_prefere", titre: "Leur musique préférée", echelle: false },
    { cle: "situation", titre: "Ce qu'ils font dans la vie", echelle: false },
    { cle: "concerts_an", titre: "Concerts par an", echelle: true }
  ];
  const THEMES = { profil: "Le profil", venue: "La venue", ecoute: "L'écoute", gouts: "Les goûts", sorties: "Les sorties", partenaires: "Les partenaires", soir: "Fin de journée" };

  const pct = (x, total) => (total ? Math.round((x / total) * 100) : 0);
  const pluriel = (x, mot) => `${n(x)} ${mot}${x > 1 ? "s" : ""}`;
  const duree = (minutes) => {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
  };
  const jourLong = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "—");
  const hh = (h) => `${String(h).padStart(2, "0")} h`;

  /* Libellés d'un champ : valeur → { libelle, rang } (le rang garde l'ordre d'une échelle) */
  const dico = (options) => {
    const m = new Map();
    (options || []).forEach((o, i) => {
      const v = typeof o === "string" ? o : o.valeur;
      m.set(v, { libelle: typeof o === "string" ? o.replace(/\*$/, "") : o.libelle, rang: i });
    });
    return m;
  };
  /* [{valeur, n}] → [{libelle, n}] ; une échelle garde l'ordre du barème, le reste est trié par effectif */
  const lignesDe = (brut, map, echelle) => {
    const l = (brut || []).map((r) => ({ valeur: r.valeur, libelle: (map && map.get(r.valeur)?.libelle) || r.valeur || "—", n: Number(r.n || 0) }));
    if (echelle && map) l.sort((a, b) => (map.get(a.valeur)?.rang ?? 999) - (map.get(b.valeur)?.rang ?? 999));
    else l.sort((a, b) => b.n - a.n);
    return l;
  };

  /* Un panneau = un titre, le nombre de réponses, des barres mesurées sur la plus grande */
  function panneau(titre, lignes, { vide = "Personne n'a encore répondu.", unite = "réponse", note = "" } = {}) {
    const total = lignes.reduce((s, l) => s + l.n, 0);
    const maxi = Math.max(0, ...lignes.map((l) => l.n));
    const corps = !lignes.length || !total
      ? `<p class="cvide">${esc(vide)}</p>`
      : `<ul class="cbarres">${lignes.map((l) => {
          const dit = `${l.libelle} : ${pluriel(l.n, unite)}, ${pct(l.n, total)} %`;
          return `<li class="cbarres__ligne" title="${esc(dit)}">
            <span class="cbarres__nom">${esc(l.libelle)}</span>
            <span class="cbarres__val"><b>${n(l.n)}</b> · ${pct(l.n, total)} %</span>
            <span class="cbarres__piste" aria-hidden="true"><span style="width:${(maxi ? (l.n / maxi) * 100 : 0).toFixed(1)}%"></span></span>
          </li>`;
        }).join("")}</ul>`;
    return `<article class="cpanneau">
      <div class="cpanneau__tete"><h3 class="cpanneau__titre">${esc(titre)}</h3><span class="cpanneau__note">${esc(pluriel(total, unite))}</span></div>
      ${corps}${note ? `<p class="cstats__note">${note}</p>` : ""}
    </article>`;
  }

  function chiffre(val, nom, icone, teinte, plus = "") {
    return `<div class="cchiffre"><span class="cchiffre__icone cchiffre__icone--${teinte}">${App.icon(icone)}</span>
      <span class="cchiffre__val">${val}</span><span class="cchiffre__nom">${esc(nom)}</span>${plus ? `<span class="cchiffre__plus">${esc(plus)}</span>` : ""}</div>`;
  }

  function hero(titre, val, texte, teinte) {
    return `<div class="cstats__hero${val === null ? " is-vide" : ""}">
      <span class="cstats__hero-nom">${esc(titre)}</span>
      <span class="cstats__hero-val"${teinte ? ` style="color:var(--${teinte})"` : ""}>${val === null ? "—" : val}</span>
      <span class="cstats__hero-texte">${texte}</span>
    </div>`;
  }

  /* ---------- Les chiffres du haut ---------- */
  function rendreChiffres(p, jeu) {
    const joueurs = Number(p.joueurs || 0);
    const joue = jeu ? Number(jeu.players_engaged || 0) : null;
    const part = (x) => (joueurs ? `${pct(x, joueurs)} % des inscrits` : "");
    const ct = p.contacts || {};
    $("[data-chiffres]").innerHTML = [
      chiffre(n(joueurs), "Joueurs inscrits", "passeport", "violet"),
      chiffre(joue === null ? "—" : n(joue), "Ont vraiment joué", "eclair", "cyan", joue === null ? "" : `${part(joue)} · au moins un scan`),
      chiffre(jeu ? n(jeu.scans_total) : "—", "QR scannés", "qr", "bleu"),
      chiffre(n(p.fiches_completes), "Fiches complètes", "sondage", "or", part(Number(p.fiches_completes || 0))),
      chiffre(n(ct.domaf), "Contacts Vimas", "telephone", "vert", `${n(ct.total)} numéros laissés`),
      chiffre(n(ct.partenaires), "Contacts partenaires", "partage", "rouge", "accord séparé pour les partenaires")
    ].join("");
    $("[data-resume]").textContent = `${pluriel(joueurs, "joueur")} · ${joue === null ? "" : `${n(joue)} actifs · `}relu à ${new Date().toLocaleTimeString("fr-FR", { timeZone: "Africa/Douala", hour: "2-digit", minute: "2-digit" })}`;
  }

  /* ---------- Le parcours ---------- */
  function rendreParcours(pc, erreur) {
    if (!pc) {
      $("[data-heros]").innerHTML = hero("Le parcours", null, esc(erreur ? C.message(erreur) : "Indisponible."));
      $("[data-jours-heures]").innerHTML = "";
      $("[data-engagement]").innerHTML = "";
      return;
    }
    const att = pc.attention || {};
    const der = (pc.retours || []).slice(-1)[0];   // sur deux jours : une seule paire, samedi → dimanche
    const mesures = Number(att.passages_mesures || 0), simples = Number(att.passages_simples || 0);
    $("[data-heros]").innerHTML = [
      der && Number(der.presents)
        ? hero("Le retour au lendemain", `${pct(Number(der.revenus || 0), Number(der.presents))}<small>%</small>`,
            `<strong>${n(der.revenus)}</strong> des <strong>${n(der.presents)}</strong> joueurs du ${esc(jourLong(der.jour1))} ont rejoué le ${esc(jourLong(der.jour2))}.`, "cyan")
        : hero("Le retour au lendemain", null, "Il faut <strong>deux journées de jeu</strong> pour que ce chiffre existe : il apparaîtra le dimanche."),
      mesures
        ? hero("Heures passées à jouer", `${n(Math.round(Number(att.minutes_totales || 0) / 60))}<small>h</small>`,
            `Cumulées sur <strong>${pluriel(mesures, "passage")}</strong> (un joueur, un jour), du premier au dernier geste. C'est un <em>plancher</em>.`, "gold")
        : hero("Heures passées à jouer", null, "Aucun joueur n'a encore fait deux gestes dans la même journée : sans deux points, pas de durée."),
      mesures
        ? hero("Durée médiane d'un passage", esc(duree(att.minutes_medianes)),
            `La moitié des joueurs sont restés <em>plus</em> longtemps.${simples ? ` ${pluriel(simples, "passage")} à un seul geste mis à part.` : ""}`, "violet")
        : hero("Durée médiane d'un passage", null, "Elle apparaîtra dès les premiers scans.")
    ].join("");

    /* Par journée */
    const jours = pc.jours || [];
    const tableJours = `<article class="cpanneau">
      <div class="cpanneau__tete"><h3 class="cpanneau__titre">Journée par journée</h3></div>
      ${jours.length ? `<div class="ctable-defile"><table class="ctable cstats__table"><thead><tr><th scope="col">Jour</th><th scope="col">Joueurs</th><th scope="col">Scans</th><th scope="col">Gestes</th><th scope="col">Tickets</th></tr></thead>
        <tbody>${jours.map((j) => `<tr><th scope="row">${esc(jourLong(j.jour))}</th><td>${n(j.joueurs)}</td><td>${n(j.scans)}</td><td>${n(j.actions)}</td><td>${n(j.journees_vendues)}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="cvide">Aucune journée de jeu pour l'instant.</p>`}
      <p class="cstats__note">Un « geste » : scan, coffre, roue, réponse au blind test, cœur… Tickets = journées activées.</p>
    </article>`;

    /* La courbe des heures (heure du Cameroun), trous compris */
    const liste = (pc.heures || []).map((h) => ({ heure: Number(h.heure), n: Number(h.scans || 0) })).filter((h) => h.n > 0);
    let courbe;
    if (!liste.length) {
      courbe = `<article class="cpanneau"><div class="cpanneau__tete"><h3 class="cpanneau__titre">À quelle heure ils jouent</h3></div><p class="cvide">La courbe se dessine pendant le festival.</p></article>`;
    } else {
      const par = new Map(liste.map((h) => [h.heure, h.n]));
      const plage = [];
      for (let h = Math.min(...liste.map((x) => x.heure)); h <= Math.max(...liste.map((x) => x.heure)); h++) plage.push({ heure: h, n: par.get(h) || 0 });
      const maxi = Math.max(...plage.map((h) => h.n));
      const pic = plage.find((h) => h.n === maxi);
      courbe = `<article class="cpanneau">
        <div class="cpanneau__tete"><h3 class="cpanneau__titre">À quelle heure ils jouent</h3><span class="cpanneau__note">${pluriel(plage.reduce((s, h) => s + h.n, 0), "geste")} · heure du Cameroun</span></div>
        <div class="ccolonnes" role="img" aria-label="${esc(`Gestes par heure, pic à ${hh(pic.heure)}`)}">${plage.map((h) => `<span class="ccolonnes__col${h === pic ? " is-pic" : ""}" title="${esc(`${hh(h.heure)} : ${pluriel(h.n, "geste")}`)}">
          ${h === pic ? `<b>${n(h.n)}</b>` : ""}<span style="height:${h.n ? Math.max(3, (h.n / maxi) * 100) : 1}%"></span><small>${String(h.heure).padStart(2, "0")}</small></span>`).join("")}</div>
        <p class="cstats__note">Le pic est à <strong>${hh(pic.heure)}</strong> : l'heure où un stand a le plus de monde devant lui.</p>
      </article>`;
    }
    $("[data-jours-heures]").innerHTML = courbe + tableJours;

    $("[data-engagement]").innerHTML =
      panneau("Combien de QR chacun a scanné", (pc.profondeur || []).map((r) => ({ libelle: r.tranche, n: Number(r.n || 0) })), { unite: "joueur", vide: "Aucun joueur pour l'instant." }) +
      panneau("Les QR les plus scannés", (pc.qr || []).slice(0, 12).map((r) => ({ libelle: r.label, n: Number(r.scans || 0) })), { unite: "scan", vide: "Aucun scan pour l'instant." });
  }

  /* ---------- Qui est venu, les cœurs, le coffre ---------- */
  function rendreProfil(p, options) {
    const fiche = p.fiche || {};
    $("[data-profil]").innerHTML = FICHE.map((f) => panneau(f.titre, lignesDe(fiche[f.cle], dico(options[f.cle]), f.echelle))).join("");

    const coeurs = p.coeurs || [];
    const parCat = (cat) => coeurs.filter((c) => c.categorie === cat).map((c) => ({ libelle: c.nom, n: Number(c.coeurs || 0) }));
    $("[data-coeurs]").innerHTML =
      panneau("Les artistes les plus aimés", parCat("artistes"), { unite: "cœur", vide: "Aucun cœur donné à un artiste pour l'instant." }) +
      panneau("Les stands les plus aimés", parCat("stands"), { unite: "cœur", vide: "Aucun cœur donné à un stand pour l'instant." });
  }

  function questionsCoffre(p, micro, artistes) {
    const infos = new Map((micro || []).map((q) => [q.code, q]));
    return (p.questions || []).map((q) => {
      const ref = infos.get(q.code) || {};
      const map = ref.type === "artiste" ? artistes : dico(ref.options);
      return { ...q, lignes: lignesDe(q.valeurs, map, !!ref.ordre_fixe) };
    });
  }

  function rendreCoffre(qs) {
    if (!qs.length) { $("[data-coffre]").innerHTML = `<p class="cvide">Aucune question dans le coffre.</p>`; return; }
    const groupes = new Map();
    qs.forEach((q) => { const t = q.theme || "autre"; if (!groupes.has(t)) groupes.set(t, []); groupes.get(t).push(q); });
    $("[data-coffre]").innerHTML = [...groupes].map(([theme, liste]) =>
      `<h3 class="cstats__theme">${esc(THEMES[theme] || theme)}</h3>` +
      liste.map((q) => panneau(q.question, q.lignes, {
        vide: "Personne n'a encore répondu à cette question.",
        note: Number(q.rapides) ? `${pluriel(Number(q.rapides), "réponse")} en moins d'une seconde (probablement au hasard).` : ""
      })).join("")).join("");
  }

  /* ---------- Chargement ---------- */
  async function charger() {
    const bouton = $("[data-relire]");
    const liberer = C.occuper(bouton);
    const zoneErr = $("[data-erreur]");
    zoneErr.hidden = true;
    try {
      const sb = C.sb();
      let erreurParcours = null;
      const [p, pc, jeu, options, rm, ra] = await Promise.all([
        C.appel("profil_stats"),
        C.appel("stats_parcours").catch((e) => { erreurParcours = e; return null; }),
        C.appel("admin_stats").catch(() => null),
        C.appel("profil_options").catch(() => ({})),
        sb.from("micro_questions").select("code, type, ordre_fixe, options"),
        sb.from("artistes").select("id, nom")
      ]);
      const artistes = new Map((ra.data || []).map((a) => [String(a.id), { libelle: a.nom, rang: 0 }]));
      const coffre = questionsCoffre(p || {}, rm.data, artistes);
      rendreChiffres(p || {}, jeu);
      rendreParcours(pc, erreurParcours);
      rendreProfil(p || {}, options || {});
      rendreCoffre(coffre);
      DERNIER = { p: p || {}, pc, jeu, options: options || {}, coffre };
      $("[data-csv]").disabled = false;
    } catch (e) {
      zoneErr.innerHTML = `${App.icon("alerte")}<span>${esc(C.message(e))}</span>`;
      zoneErr.hidden = false;
      if (!DERNIER) $("[data-resume]").textContent = "Lecture impossible";
    } finally { if (liberer) liberer(); }
  }

  /* ---------- Export CSV (séparateur « ; » + BOM : Excel en français ouvre droit) ---------- */
  function versCsv() {
    if (!DERNIER) return;
    const { p, pc, jeu, options, coffre } = DERNIER;
    const lignes = [["section", "question", "reponse", "nombre", "pourcentage"]];
    const pousser = (section, question, l) => {
      const total = l.reduce((s, x) => s + x.n, 0);
      l.forEach((x) => lignes.push([section, question, x.libelle, x.n, pct(x.n, total)]));
    };
    const ct = p.contacts || {};
    lignes.push(["Chiffres", "Joueurs inscrits", "", Number(p.joueurs || 0), ""]);
    if (jeu) {
      lignes.push(["Chiffres", "Ont vraiment joué", "", Number(jeu.players_engaged || 0), ""]);
      lignes.push(["Chiffres", "QR scannés", "", Number(jeu.scans_total || 0), ""]);
    }
    lignes.push(["Chiffres", "Fiches complètes", "", Number(p.fiches_completes || 0), ""]);
    lignes.push(["Chiffres", "Numéros laissés", "", Number(ct.total || 0), ""]);
    lignes.push(["Chiffres", "Contacts Vimas (accord)", "", Number(ct.domaf || 0), ""]);
    lignes.push(["Chiffres", "Contacts partenaires (accord)", "", Number(ct.partenaires || 0), ""]);

    if (pc) {   // jamais de colonne vide présentée comme un zéro
      const att = pc.attention || {};
      const der = (pc.retours || []).slice(-1)[0];
      if (der && Number(der.presents)) {
        lignes.push(["Parcours", `Joueurs du ${der.jour1}`, "", Number(der.presents), ""]);
        lignes.push(["Parcours", `Revenus le ${der.jour2}`, "", Number(der.revenus || 0), pct(Number(der.revenus || 0), Number(der.presents))]);
      }
      lignes.push(["Parcours", "Heures passées à jouer (cumul)", "", Math.round(Number(att.minutes_totales || 0) / 60), ""]);
      lignes.push(["Parcours", "Durée médiane d'un passage (min)", "", Number(att.minutes_medianes || 0), ""]);
      lignes.push(["Parcours", "Durée moyenne d'un passage (min)", "", Number(att.minutes_moyennes || 0), ""]);
      lignes.push(["Parcours", "Passages mesurés (2 gestes ou plus)", "", Number(att.passages_mesures || 0), ""]);
      lignes.push(["Parcours", "Passages à un seul geste", "", Number(att.passages_simples || 0), ""]);
      (pc.jours || []).forEach((j) => {
        lignes.push(["Par journée", `Joueurs le ${j.jour}`, "", Number(j.joueurs || 0), ""]);
        lignes.push(["Par journée", `Scans le ${j.jour}`, "", Number(j.scans || 0), ""]);
        lignes.push(["Par journée", `Gestes le ${j.jour}`, "", Number(j.actions || 0), ""]);
        lignes.push(["Par journée", `Tickets activés le ${j.jour}`, "", Number(j.journees_vendues || 0), ""]);
      });
      pousser("Heures (Cameroun)", "Gestes par heure", (pc.heures || []).map((h) => ({ libelle: hh(h.heure), n: Number(h.scans || 0) })));
      pousser("Engagement", "Combien de QR chacun a scanné", (pc.profondeur || []).map((r) => ({ libelle: r.tranche, n: Number(r.n || 0) })));
      pousser("Trafic", "Les QR les plus scannés", (pc.qr || []).map((r) => ({ libelle: r.label, n: Number(r.scans || 0) })));
    }
    FICHE.forEach((f) => pousser("Qui est venu", f.titre, lignesDe((p.fiche || {})[f.cle], dico(options[f.cle]), f.echelle)));
    const coeurs = p.coeurs || [];
    pousser("Coups de coeur", "Artistes", coeurs.filter((c) => c.categorie === "artistes").map((c) => ({ libelle: c.nom, n: Number(c.coeurs || 0) })));
    pousser("Coups de coeur", "Stands", coeurs.filter((c) => c.categorie === "stands").map((c) => ({ libelle: c.nom, n: Number(c.coeurs || 0) })));
    coffre.forEach((q) => pousser(`Coffre · ${THEMES[q.theme] || q.theme || ""}`, q.question, q.lignes));

    const csv = "﻿" + lignes.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\r\n");
    const jour = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vimas-quest-statistiques-${jour}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  $("[data-relire]").addEventListener("click", charger);
  $("[data-csv]").addEventListener("click", versCsv);
  $("[data-imprimer]").addEventListener("click", () => window.print());
  await charger();
});
