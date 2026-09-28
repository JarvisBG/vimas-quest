/* ==========================================================================
   Page 5 — Programme / line-up
   Public : les curieux voient le programme ; les joueurs ajoutent des favoris.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, api, session } = App;

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
    const { jours, ceSoir } = etat.d;
    $("[data-jours]").innerHTML = jours.map((j) => {
      const nb = etat.d.concerts.filter((a) => a.jour === j.id).length;
      return `
        <button class="jour-p" type="button" role="tab" id="jour-${j.id}" aria-controls="panneau-p"
          aria-selected="${j.id === etat.jour}" tabindex="${j.id === etat.jour ? 0 : -1}" data-jour="${j.id}" aria-label="${esc(j.long)}, ${nb} concerts">
          <span class="jour-p__nom">${esc(j.court)}</span>
          <span class="jour-p__info">${j.id === ceSoir ? "Ce soir" : `${nb} concert${nb > 1 ? "s" : ""}`}</span>
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
    if (!etat.d.concerts.length) {
      panneau.innerHTML = `<div class="vide-p"><p class="affiche" style="font-size:1.5rem">Programme bientôt annoncé</p>
        <p>Les artistes et les horaires arrivent ici dès leur annonce. Repasse bientôt !</p></div>`;
      return;
    }
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
    const liste = filtrer(etat.d.concerts).sort((a, b) => a.debutMs - b.debutMs);
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
      if (!etat.recherche && !marqueur && a.jour === etat.d.ceSoir && a.debutMs > now && liste.some((x) => x.debutMs <= now)) {
        marqueur = true;
        html += `<li class="maintenant-p" aria-label="Il est ${HEURE(now)}">${HEURE(now)}</li>`;
      }
      html += `
        <li class="concert-p sc-${a.scene.couleur} is-${a.statut}${a.tete ? " is-tete" : ""}" data-artiste="${esc(a.artisteId)}">
          <span class="concert-p__heure"><strong>${HEURE(a.debutMs)}</strong><span>${HEURE(a.finMs)}</span></span>
          <button class="concert-p__ouvrir concert-p__ouvrir--photo" type="button" data-ouvrir="${esc(a.artisteId)}">
            ${App.photo(a)}
            <span class="concert-p__texte">
              <span class="concert-p__nom">${esc(a.nom)}</span>
              <span class="concert-p__meta">
                <span class="pastille pastille-sc">${esc(a.scene.nom)}</span>
                <span>${esc(a.genre)}</span>
                ${statutTexte(a)}
                ${a.vu ? `<span>${icon("valide")} Vu</span>` : ""}
              </span>
            </span>
          </button>
          ${boutonEtoile(a)}
        </li>`;
    });
    // Séances de dédicaces du jour
    if (!etat.recherche && !etat.scenes.size) {
      const ded = etat.d.dedicaces.filter((x) => x.jour === etat.jour).sort((x, y) => x.debutMs - y.debutMs);
      if (ded.length) {
        html += `<li><p class="affiche" style="font-size:1.25rem;margin-top:.5rem">Dédicaces du jour</p></li>` + ded.map((x) => `
          <li class="concert-p" style="--sc:var(--papier-2);border-style:dashed">
            <span class="concert-p__heure"><strong>${HEURE(x.debutMs)}</strong><span>${HEURE(x.finMs)}</span></span>
            <button class="concert-p__ouvrir" type="button" data-ouvrir="${esc(x.artisteId)}">
              <span class="concert-p__nom">${esc(x.nom)}</span>
              <span class="concert-p__meta">${icon("etoile")} ${esc(x.lieu)}</span>
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
      const blocs = etat.d.concerts.filter((a) => a.jour === etat.jour && a.scene.id === s.id).map((a) => `
        <button class="bloc-p sc-${s.couleur} is-${a.statut}" type="button" data-ouvrir="${esc(a.artisteId)}"
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

  /* Un artiste peut avoir plusieurs concerts : la fiche les liste tous, chacun
     avec son étoile (un favori = un concert). Le concert « principal » est le
     prochain (ou en cours), sinon le dernier. */
  function ouvrirFiche(id) {
    const concerts = etat.d.concerts.filter((x) => x.artisteId === id).sort((x, y) => x.debutMs - y.debutMs);
    if (!concerts.length) return;
    const a = concerts.find((x) => x.statut !== "termine") || concerts[concerts.length - 1];
    ficheId = id;
    const av = avatars.length ? avatars[hash(id) % avatars.length] : { motif: "rayures", fond: "bleu", encre: "sodium" };
    const visuel = $("[data-fiche-visuel]");
    visuel.className = `fiche-a__visuel pochette--${av.motif}`;
    visuel.style.setProperty("--fond", `var(--${av.fond})`);
    visuel.style.setProperty("--encre", `var(--${av.encre})`);
    // Photo en sérigraphie si l'artiste en a une ; sinon (ou si elle ne charge
    // pas) le motif de pochette reste visible dessous.
    const photo = $("[data-fiche-photo]");
    const src = a.photo || a.photo_url;
    visuel.classList.toggle("a-photo", !!src);
    photo.hidden = !src;
    if (src) {
      photo.onerror = () => { photo.hidden = true; visuel.classList.remove("a-photo"); };
      photo.src = src;
    } else photo.removeAttribute("src");
    $("[data-fiche-nom]").textContent = a.nom;
    const jourDe = (c) => etat.d.jours.find((j) => j.id === c.jour);
    const vu = concerts.some((c) => c.vu);
    const votable = connecte && concerts.some((c) => c.statut !== "a-venir");
    const seances = etat.d.dedicaces.filter((x) => x.artisteId === id).sort((x, y) => x.debutMs - y.debutMs);

    const quand = concerts.length === 1 ? `
      <p class="fiche-a__quand">${icon("horloge")} ${esc(jourDe(a).long)}, ${HEURE(a.debutMs)} à ${HEURE(a.finMs)}</p>
      <p>${statutTexte(a)}</p>` : `
      <ul class="fiche-a__concerts" aria-label="${concerts.length} concerts">${concerts.map((c) => `
        <li class="sc-${c.scene.couleur} is-${c.statut}">
          <span><strong>${esc(jourDe(c).court)}, ${HEURE(c.debutMs)} à ${HEURE(c.finMs)}</strong>
            <span class="pastille pastille-sc">${esc(c.scene.nom)}</span> ${statutTexte(c)}</span>
          ${boutonEtoile(c)}
        </li>`).join("")}
      </ul>`;

    $("[data-fiche-corps]").innerHTML = `
      <div class="fiche-a__meta">
        ${concerts.length === 1 ? `<span class="pastille pastille-sc sc-${a.scene.couleur}">${esc(a.scene.nom)}</span>` : ""}
        ${a.genre ? `<span class="pastille">${esc(a.genre)}</span>` : ""}
        ${a.tete ? `<span class="pastille pastille--sodium">Tête d'affiche</span>` : ""}
        ${vu ? `<span class="pastille pastille--vert">${icon("valide")} Vu</span>` : ""}
      </div>
      ${quand}
      <p>${esc(a.bio || "")}</p>
      ${seances.map((x) => `
        <div class="fiche-a__ded">
          <strong>${icon("etoile")} Séance de dédicaces</strong>
          <span>${esc((etat.d.jours.find((j) => j.id === x.jour) || {}).long || "")}, ${HEURE(x.debutMs)} à ${HEURE(x.finMs)}</span>
          <span class="texte-doux">${esc(x.lieu)}.${connecte ? " Scanne le QR de la séance : sa signature rejoint ta collection." : ""}</span>
        </div>`).join("")}
      ${connecte && a.statut !== "termine" ? `<p class="texte-doux">Scanne le QR de la scène pendant le concert pour l'ajouter à ta collection.</p>` : ""}
      <div class="fiche-a__actions">
        ${concerts.length === 1 ? `
        <button class="btn ${a.favori ? "btn--nuit" : "btn--sodium"} btn--bloc" type="button" data-favori="${esc(a.id)}" aria-pressed="${a.favori}">
          ${icon("etoile")} ${a.favori ? "Dans mon programme" : "Ajouter à mon programme"}
        </button>` : ""}
        <div class="fiche-a__actions-ligne">
          <a class="btn btn--contour" href="plan.html?lieu=${encodeURIComponent(a.scene.id)}">${icon("plan")} Y aller</a>
          <button class="btn btn--contour" type="button" data-partager="${esc(id)}">${icon("partage")} Partager</button>
        </div>
        ${votable ? `<a class="btn btn--contour btn--bloc" href="coups-de-coeur.html#${encodeURIComponent(id)}">${icon("coeur")} Voter pour ${esc(a.nom)}</a>` : ""}
        ${vu ? `<a class="lien-fort" href="collection.html#${encodeURIComponent(id)}">Voir dans ma collection</a>` : ""}
      </div>`;
    if (!fiche.open) fiche.showModal();
    history.replaceState(null, "", `#${id}`);
  }

  $("[data-fermer-fiche]").addEventListener("click", () => fiche.close());
  fiche.addEventListener("click", (e) => { if (e.target === fiche) fiche.close(); });
  fiche.addEventListener("close", () => {
    history.replaceState(null, "", location.pathname);
    const b = $(`[data-ouvrir="${CSS.escape(ficheId || "")}"]`);
    if (b) b.focus({ preventScroll: true });
  });

  /* ---------- Favoris ----------
     Un favori = un concert. Le bouton se verrouille pendant l'appel (jamais
     réessayé : un second envoi retirerait le concert). Le rechargement qui
     suit ne coûte aucune requête : les copies en cache sont corrigées. */
  async function basculer(id, bouton) {
    if (!connecte) {
      App.toast("Crée ta carte pour préparer ton programme.");
      $("[data-invite]").scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (bouton && bouton.getAttribute("aria-busy") === "true") return;
    bouton?.setAttribute("aria-busy", "true");
    const res = await api.basculerFavori(id);
    bouton?.removeAttribute("aria-busy");
    if (!res.ok) { App.toast(res.raison || "Impossible de modifier ton programme."); await charger(); return; }
    if (navigator.vibrate) navigator.vibrate(30);
    await charger();
    if (fiche.open) ouvrirFiche(ficheId);
    const nouveau = $(`.liste-p [data-favori="${CSS.escape(id)}"]`);
    if (nouveau) nouveau.classList.add("is-anime");
    const nom = (etat.d.concerts.find((a) => a.id === id) || {}).nom || "Le concert";
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

  // Le prochain concert de l'artiste (ou son dernier)
  const concertPrincipal = (id) => {
    const l = etat.d.concerts.filter((x) => x.artisteId === id).sort((x, y) => x.debutMs - y.debutMs);
    return l.find((x) => x.statut !== "termine") || l[l.length - 1];
  };

  async function partager(id) {
    const a = concertPrincipal(id);
    if (!a) return;
    const url = `${location.origin}${location.pathname}#${id}`;
    const texte = `${a.nom} au VIMAS FEST, ${etat.d.jours.find((j) => j.id === a.jour).long} à ${HEURE(a.debutMs)}, ${a.scene.nom}`;
    try {
      if (navigator.share) await navigator.share({ title: a.nom, text: texte, url });
      else { await navigator.clipboard.writeText(`${texte} ${url}`); App.toast("Lien copié."); }
    } catch (e) { /* partage annulé */ }
  }

  /* ---------- Démarrage + lien direct programme.html#<artiste> ---------- */
  if (!(await charger())) return;
  const cible = decodeURIComponent(location.hash.slice(1));
  const concert = cible && concertPrincipal(cible);
  if (concert) {
    etat.jour = concert.jour;
    rendreJours();
    rendre();
    const li = $(`.liste-p [data-artiste="${CSS.escape(cible)}"]`);
    if (li) { li.scrollIntoView({ block: "center" }); li.classList.add("is-cible"); }
    ouvrirFiche(cible);
  }
  // Statuts (« en ce moment ») remis à jour chaque minute. Le programme vient
  // du cache : au plus une relecture de la base toutes les 5 minutes.
  App.sonder(() => (fiche.open ? null : charger()), { toutesLes: 60000, immediat: false });
});
