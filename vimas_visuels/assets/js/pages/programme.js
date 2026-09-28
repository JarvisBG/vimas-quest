/* ==========================================================================
   Page 5 — Programme / line-up
   Public : les curieux voient le programme ; les joueurs ajoutent des favoris.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api, session } = App;

  const connecte = session.isLoggedIn();
  if (connecte) {
    App.initJoueur({ actif: "programme" });
    $("[data-retour]").href = "tableau-de-bord.html";
    $("[data-retour]").setAttribute("aria-label", "Retour à ma carte");
  } else {
    $("[data-jouer]").hidden = false;
    $("[data-invite]").hidden = false;
  }

  const etat = { jour: null, vue: "liste", scenes: new Set(), recherche: "", d: null };
  let avatars = [];
  try { avatars = await App.data.get("avatars"); } catch (e) { /* motif par défaut */ }
  const hash = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const panneau = $("[data-panneau]");
  const HEURE = (ms) => App.heureFestival(new Date(ms));

  /* ---------- Chargement ---------- */
  async function charger() {
    try {
      etat.d = await api.programme();
    } catch (e) {
      console.error(e);
      App.toast("Impossible de charger le programme. Vérifie ta connexion.");
      return false;
    }
    if (!etat.jour) etat.jour = etat.d.jourActuel;
    rendreJours();
    rendreScenes();
    rendre();
    return true;
  }

  /* ---------- Jours ---------- */
  function rendreJours() {
    const { jours, jourActuel } = etat.d;
    $("[data-jours]").innerHTML = jours.map((j) => {
      const nb = etat.d.artistes.filter((a) => a.jour === j.id).length;
      return `
        <button class="jour-p" type="button" role="tab" id="jour-${j.id}" aria-controls="panneau-p"
          aria-selected="${j.id === etat.jour}" tabindex="${j.id === etat.jour ? 0 : -1}" data-jour="${j.id}" aria-label="${esc(j.long)}, ${nb} concerts">
          <span class="jour-p__nom">${esc(j.court)}</span>
          <span class="jour-p__info">${j.id === jourActuel ? "Ce soir" : `${nb} concerts`}</span>
        </button>`;
    }).join("");
    panneau.setAttribute("aria-labelledby", `jour-${etat.jour}`);
  }
  $("[data-jours]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-jour]");
    if (!b) return;
    etat.jour = b.dataset.jour;
    rendreJours();
    rendre();
  });
  $("[data-jours]").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const ids = etat.d.jours.map((j) => j.id);
    const i = ids.indexOf(etat.jour);
    etat.jour = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    rendreJours();
    rendre();
    $(`[data-jour="${etat.jour}"]`).focus();
  });

  /* ---------- Scènes ---------- */
  function rendreScenes() {
    if ($("[data-scenes]").children.length) return;
    $("[data-scenes]").innerHTML = etat.d.scenes.map((s) => `
      <label class="puce puce-scene sc-${s.couleur}">
        <input type="checkbox" value="${esc(s.id)}"><span>${esc(s.nom)}</span>
      </label>`).join("");
  }
  $("[data-scenes]").addEventListener("change", (e) => {
    e.target.checked ? etat.scenes.add(e.target.value) : etat.scenes.delete(e.target.value);
    rendre();
  });

  $$("input[name=affichage]").forEach((r) => r.addEventListener("change", () => { etat.vue = r.value; rendre(); }));
  let minuteurRecherche;
  $("[data-recherche]").addEventListener("input", (e) => {
    clearTimeout(minuteurRecherche);
    minuteurRecherche = setTimeout(() => { etat.recherche = e.target.value.trim(); rendre(); }, 200);
  });

  /* ======================================================================
     Rendu
     ====================================================================== */
  const normaliser = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function filtrer(liste) {
    return liste.filter((a) => {
      if (etat.scenes.size && !etat.scenes.has(a.scene.id)) return false;
      if (etat.recherche) {
        const q = normaliser(etat.recherche);
        return normaliser(`${a.nom} ${a.genre}`).includes(q);
      }
      return a.jour === etat.jour;
    });
  }

  function rendre() {
    if (!etat.d) return;
    const recherche = !!etat.recherche;
    $$("[data-jour]").forEach((b) => (b.style.opacity = recherche ? ".5" : ""));
    if (etat.vue === "grille" && !recherche) rendreGrille();
    else rendreListe();
  }

  function statutTexte(a) {
    const now = etat.d.maintenant;
    if (a.statut === "termine") return `<span class="statut-p">Terminé</span>`;
    if (a.statut === "en-cours") return `<span class="statut-p statut-p--en-cours">En ce moment</span>`;
    const dans = a.debutMs - now;
    return dans < 6 * 3600000 ? `<span class="statut-p">dans ${App.duree(dans)}</span>` : "";
  }

  function boutonEtoile(a) {
    return `<button class="etoile-p" type="button" aria-pressed="${a.favori}" data-favori="${esc(a.id)}"
      aria-label="${a.favori ? "Retirer" : "Ajouter"} ${esc(a.nom)} ${a.favori ? "de" : "à"} mon programme">${icon("etoile")}</button>`;
  }

  function rendreListe() {
    const liste = filtrer(etat.d.artistes).sort((a, b) => a.debutMs - b.debutMs);
    if (!liste.length) {
      panneau.innerHTML = `<div class="vide-p"><p class="affiche" style="font-size:1.5rem">Aucun concert</p>
        <p>${etat.recherche ? `Rien ne correspond à « ${esc(etat.recherche)} ».` : "Aucun concert pour ces scènes ce jour-là."}</p></div>`;
      return;
    }
    const jourParId = Object.fromEntries(etat.d.jours.map((j) => [j.id, j]));
    const now = etat.d.maintenant;
    let html = "", marqueur = false, jourCourant = null;
    liste.forEach((a) => {
      if (etat.recherche && a.jour !== jourCourant) {
        jourCourant = a.jour;
        html += `<li><p class="affiche" style="font-size:1.25rem;margin-top:.5rem">${esc(jourParId[a.jour].long)}</p></li>`;
      }
      if (!etat.recherche && !marqueur && a.jour === etat.d.jourActuel && a.debutMs > now && liste.some((x) => x.debutMs <= now)) {
        marqueur = true;
        html += `<li class="maintenant-p" aria-label="Il est ${HEURE(now)}">${HEURE(now)}</li>`;
      }
      html += `
        <li class="concert-p sc-${a.scene.couleur} is-${a.statut}${a.tete ? " is-tete" : ""}" id="${esc(a.id)}">
          <span class="concert-p__heure"><strong>${esc(fmt.heure(a.debut))}</strong><span>${HEURE(a.finMs)}</span></span>
          <button class="concert-p__ouvrir" type="button" data-ouvrir="${esc(a.id)}">
            <span class="concert-p__nom">${esc(a.nom)}</span>
            <span class="concert-p__meta">
              <span class="pastille pastille-sc">${esc(a.scene.nom)}</span>
              <span>${esc(a.genre)}</span>
              ${statutTexte(a)}
              ${a.vu ? `<span>${icon("valide")} Vu</span>` : ""}
            </span>
          </button>
          ${boutonEtoile(a)}
        </li>`;
    });
    // Séances de dédicaces du jour
    if (!etat.recherche && !etat.scenes.size) {
      const ded = etat.d.artistes.filter((a) => a.dedicace && a.dedicace.jour === etat.jour);
      if (ded.length) {
        html += `<li><p class="affiche" style="font-size:1.25rem;margin-top:.5rem">Dédicaces du jour</p></li>` + ded.map((a) => `
          <li class="concert-p" style="--sc:var(--papier-2);border-style:dashed">
            <span class="concert-p__heure"><strong>${esc(fmt.heure(a.dedicace.debut))}</strong><span>${esc(fmt.heure(a.dedicace.fin))}</span></span>
            <button class="concert-p__ouvrir" type="button" data-ouvrir="${esc(a.id)}">
              <span class="concert-p__nom">${esc(a.nom)}</span>
              <span class="concert-p__meta">${icon("etoile")} ${esc(a.dedicace.lieu)}</span>
            </button>
            <span></span>
          </li>`).join("");
      }
    }
    panneau.innerHTML = `<ol class="liste-p">${html}</ol>`;
  }

  function rendreGrille() {
    const { scenes, jours, config } = etat.d;
    const jour = jours.find((j) => j.id === etat.jour);
    const visibles = scenes.filter((s) => !etat.scenes.size || etat.scenes.has(s.id));
    const debutJour = App.dateFestival(jour.date, config.ouverture).getTime();
    const fin = App.dateFestival(jour.date, config.fermeture);
    fin.setDate(fin.getDate() + 1);
    const minutes = (fin.getTime() - debutJour) / 60000;
    const ppm = config.pixelsParMinute;
    const y = (ms) => ((ms - debutJour) / 60000) * ppm;

    const heures = [];
    for (let m = 0; m <= minutes; m += 60) {
      heures.push(`<span class="grille-p__heure" style="top:${m * ppm}px">${HEURE(debutJour + m * 60000)}</span>`);
    }
    const colonnes = visibles.map((s) => {
      const blocs = etat.d.artistes.filter((a) => a.jour === etat.jour && a.scene.id === s.id).map((a) => `
        <button class="bloc-p sc-${s.couleur} is-${a.statut}" type="button" data-ouvrir="${esc(a.id)}"
          style="--y:${y(a.debutMs)}px;--hauteur:${(a.finMs - a.debutMs) / 60000 * ppm - 4}px"
          aria-label="${esc(a.nom)}, ${HEURE(a.debutMs)} à ${HEURE(a.finMs)}, ${esc(s.nom)}${a.favori ? ", dans mon programme" : ""}">
          <span class="bloc-p__heure">${HEURE(a.debutMs)} à ${HEURE(a.finMs)}</span>
          <span class="bloc-p__nom">${esc(a.nom)}</span>
          <span class="bloc-p__genre">${esc(a.genre)}</span>
          ${a.favori ? `<span class="bloc-p__etoile">${icon("etoile")}</span>` : ""}
        </button>`).join("");
      return `<div class="grille-p__col" role="list" aria-label="${esc(s.nom)}">${blocs}</div>`;
    }).join("");

    const now = etat.d.maintenant;
    const ligneNow = now >= debutJour && now <= fin.getTime()
      ? `<div class="grille-p__maintenant" style="--y:${y(now)}px" aria-hidden="true"></div>` : "";

    panneau.innerHTML = `
      <div class="grille-p" style="--n:${visibles.length};--h:${minutes * ppm}px;--ppm:${ppm}px" data-grille tabindex="0" aria-label="Grille horaire, faire défiler dans les deux sens">
        <div class="grille-p__table">
          <div class="grille-p__coin"></div>
          ${visibles.map((s) => `<div class="grille-p__scene sc-${s.couleur}">${esc(s.nom)}</div>`).join("")}
          <div class="grille-p__rail">${heures.join("")}</div>
          ${colonnes}
          ${ligneNow}
        </div>
      </div>
      <p class="grille-p__note">Touche un concert pour ouvrir sa fiche. Fais glisser la grille pour voir toutes les scènes.</p>`;

    // Place la vue sur l'heure actuelle
    if (ligneNow) {
      const g = $("[data-grille]");
      g.scrollTop = Math.max(0, y(now) - 120);
    }
  }

  /* ======================================================================
     Fiche artiste
     ====================================================================== */
  const fiche = $("[data-fiche]");
  let ficheId = null;

  function ouvrirFiche(id) {
    const a = etat.d.artistes.find((x) => x.id === id);
    if (!a) return;
    ficheId = id;
    const av = avatars.length ? avatars[hash(a.id) % avatars.length] : { motif: "rayures", fond: "bleu", encre: "sodium" };
    const visuel = $("[data-fiche-visuel]");
    visuel.className = `fiche-a__visuel pochette--${av.motif}`;
    visuel.style.setProperty("--fond", `var(--${av.fond})`);
    visuel.style.setProperty("--encre", `var(--${av.encre})`);
    $("[data-fiche-nom]").textContent = a.nom;
    const jour = etat.d.jours.find((j) => j.id === a.jour);
    const votable = connecte && a.statut !== "a-venir";

    $("[data-fiche-corps]").innerHTML = `
      <div class="fiche-a__meta">
        <span class="pastille pastille-sc sc-${a.scene.couleur}">${esc(a.scene.nom)}</span>
        <span class="pastille">${esc(a.genre)}</span>
        ${a.tete ? `<span class="pastille pastille--sodium">Tête d'affiche</span>` : ""}
        ${a.vu ? `<span class="pastille pastille--vert">${icon("valide")} Vu</span>` : ""}
      </div>
      <p class="fiche-a__quand">${icon("horloge")} ${esc(jour.long)}, ${HEURE(a.debutMs)} à ${HEURE(a.finMs)}</p>
      <p>${statutTexte(a)}</p>
      <p>${esc(a.bio || "")}</p>
      ${a.dedicace ? `
        <div class="fiche-a__ded">
          <strong>${icon("etoile")} Séance de dédicaces</strong>
          <span>${esc(a.dedicace.jourInfo.long)}, ${esc(fmt.heure(a.dedicace.debut))} à ${esc(fmt.heure(a.dedicace.fin))}</span>
          <span class="texte-doux">${esc(a.dedicace.lieu)}. ${connecte ? "Fais-y valider la mission Chasseur de dédicaces." : ""}</span>
        </div>` : ""}
      ${connecte && a.statut !== "termine" ? `<p class="texte-doux">Scanne le QR de la scène pendant le concert pour l'ajouter à ta collection.</p>` : ""}
      <div class="fiche-a__actions">
        <button class="btn ${a.favori ? "btn--nuit" : "btn--sodium"} btn--bloc" type="button" data-favori="${esc(a.id)}" aria-pressed="${a.favori}">
          ${icon("etoile")} ${a.favori ? "Dans mon programme" : "Ajouter à mon programme"}
        </button>
        <div class="fiche-a__actions-ligne">
          <a class="btn btn--contour" href="plan.html?lieu=${encodeURIComponent(a.scene.id)}">${icon("plan")} Y aller</a>
          <button class="btn btn--contour" type="button" data-partager="${esc(a.id)}">${icon("partage")} Partager</button>
        </div>
        ${votable ? `<a class="btn btn--contour btn--bloc" href="coups-de-coeur.html#${encodeURIComponent(a.id)}">${icon("coeur")} Voter pour ${esc(a.nom)}</a>` : ""}
        ${a.vu ? `<a class="lien-fort" href="collection.html#${encodeURIComponent(a.id)}">Voir dans ma collection</a>` : ""}
      </div>`;
    if (!fiche.open) fiche.showModal();
    history.replaceState(null, "", `#${a.id}`);
  }

  $("[data-fermer-fiche]").addEventListener("click", () => fiche.close());
  fiche.addEventListener("click", (e) => { if (e.target === fiche) fiche.close(); });
  fiche.addEventListener("close", () => {
    history.replaceState(null, "", location.pathname);
    const b = $(`[data-ouvrir="${CSS.escape(ficheId || "")}"]`);
    if (b) b.focus({ preventScroll: true });
  });

  /* ---------- Favoris ---------- */
  async function basculer(id, bouton) {
    if (!connecte) {
      App.toast("Scanne ton billet pour créer ton programme.");
      $("[data-invite]").scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    bouton?.setAttribute("aria-busy", "true");
    const res = await api.basculerFavori(id);
    if (!res.ok) { App.toast("Impossible de modifier ton programme."); return; }
    if (navigator.vibrate) navigator.vibrate(30);
    await charger();
    if (fiche.open) ouvrirFiche(id);
    const nouveau = $(`.liste-p [data-favori="${CSS.escape(id)}"]`);
    if (nouveau) nouveau.classList.add("is-anime");
    const nom = etat.d.artistes.find((a) => a.id === id).nom;
    App.toast(res.favori
      ? res.conflits.length ? `Ajouté. Attention, il chevauche ${res.conflits.join(" et ")}.` : `${nom} est dans ton programme.`
      : `${nom} retiré de ton programme.`);
  }

  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-favori]");
    if (f) { basculer(f.dataset.favori, f); return; }
    const o = e.target.closest("[data-ouvrir]");
    if (o) { ouvrirFiche(o.dataset.ouvrir); return; }
    const p = e.target.closest("[data-partager]");
    if (p) partager(p.dataset.partager);
  });

  async function partager(id) {
    const a = etat.d.artistes.find((x) => x.id === id);
    const url = `${location.origin}${location.pathname}#${id}`;
    const texte = `${a.nom} à Vimas Fest, ${etat.d.jours.find((j) => j.id === a.jour).long} à ${HEURE(a.debutMs)}, ${a.scene.nom}`;
    try {
      if (navigator.share) await navigator.share({ title: a.nom, text: texte, url });
      else { await navigator.clipboard.writeText(`${texte} ${url}`); App.toast("Lien copié."); }
    } catch (e) { /* partage annulé */ }
  }

  /* ---------- Démarrage + lien direct programme.html#a5 ---------- */
  if (!(await charger())) return;
  const cible = decodeURIComponent(location.hash.slice(1));
  const artiste = cible && etat.d.artistes.find((a) => a.id === cible);
  if (artiste) {
    etat.jour = artiste.jour;
    rendreJours();
    rendre();
    const li = document.getElementById(artiste.id);
    if (li) { li.scrollIntoView({ block: "center" }); li.classList.add("is-cible"); }
    ouvrirFiche(artiste.id);
  }
  setInterval(() => { if (!document.hidden && !fiche.open) charger(); }, 60000);
});
