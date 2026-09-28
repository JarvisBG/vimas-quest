/* ==========================================================================
   Page 9 — Collection : badges, artistes, stands
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, $$, esc, icon, fmt, api, session } = App;

  const joueur = session.get();
  const etat = { rayon: "badges", filtre: "tout", donnees: null, vus: null };
  let jours = [], avatars = [], raretes = {};
  try {
    [jours, avatars, raretes] = await Promise.all(["jours", "avatars", "raretes"].map(App.data.get));
  } catch (e) { /* affichage dégradé */ }
  const jourParDate = Object.fromEntries(jours.map((j) => [j.date, j]));

  const RAYONS = {
    badges: {
      nom: "Badge",
      aide: "Touche un badge pour savoir comment l'obtenir. Les badges secrets se révèlent une fois gagnés.",
      vides: { obtenus: ["Aucun badge pour l'instant", "Scanne ton premier QR de scène pour décrocher « Première note »."], manquants: ["Collection complète", "Tu as tous les badges. Impressionnant."] }
    },
    artistes: {
      nom: "Artiste",
      aide: "Scanne le QR d'une scène pendant un concert pour ajouter l'artiste. Une dédicace ajoute sa signature.",
      vides: { obtenus: ["Aucun artiste pour l'instant", "Assiste à un concert et scanne le QR de la scène pendant le set."], manquants: ["Tous les artistes sont là", "Tu as vu tout le line-up."] }
    },
    stands: {
      nom: "Stand",
      aide: "Chaque stand ou food-truck scanné laisse son tampon dans ton album.",
      vides: { obtenus: ["Album vide", "Les stands et food-trucks ont tous un QR à scanner."], manquants: ["Album complet", "Tu as fait le tour de tous les stands."] }
    }
  };

  /* ---------- Utilitaires ---------- */
  const cleVu = (rayon, id) => `${rayon[0]}:${id}`;
  const quand = (o) => {
    if (!o) return "";
    const j = jourParDate[o.jour];
    return `${j ? j.court : o.jour}, ${fmt.heure(o.heure)}`;
  };
  const hash = (txt) => [...txt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const ENCRES = ["encre-rose", "encre-bleu", "encre-vert"];
  const ROTATIONS = [-5, 3, -2, 5, -4, 2];

  const SIGNATURE = `<svg class="signature" viewBox="0 0 100 40" aria-hidden="true"><path d="M4 30c6-14 10-22 14-20s-6 22 0 20 8-18 13-17-3 16 2 15 7-10 11-10 1 9 6 8 9-9 14-9 4 8 9 7 10-12 23-16"/></svg>`;

  /* ---------- Rendus d'éléments ---------- */
  function visuelBadge(b, { grand = false } = {}) {
    const cache = b.secret && !b.obtenu;
    return `
      <span class="autocollant forme-${esc(b.forme)} rarete-${esc(b.rarete)}${b.obtenu ? "" : " is-verrou"}${grand ? " is-nouveau-ouvert" : ""}"
        style="--rot:${ROTATIONS[hash(b.id) % ROTATIONS.length]}deg">
        <span class="autocollant__ombre"><span class="autocollant__decoupe"><span class="autocollant__fond">
          ${icon(b.obtenu ? b.icone : cache ? "info" : "cadenas")}
        </span></span></span>
        <span class="autocollant__nom">${cache ? "Badge secret" : esc(b.nom)}</span>
      </span>`;
  }

  function visuelArtiste(a) {
    const av = avatars.length ? avatars[hash(a.id) % avatars.length] : { motif: "rayures", fond: "bleu", encre: "sodium" };
    const obtenu = !!a.obtenu;
    return `
      <span class="pochette-a${obtenu ? "" : " is-verrou"}">
        <span class="pochette-a__disque" style="--fond:var(--${av.fond});--encre:var(--${av.encre})">
          <span class="pochette-a__art ${obtenu ? `pochette--${av.motif}` : ""}">${obtenu ? "" : icon("cadenas")}</span>
          ${obtenu && a.obtenu.dedicace ? SIGNATURE + `<span class="pastille pastille--sodium pastille-dedicace">Dédicacé</span>` : ""}
          <span class="pochette-a__titre">${esc(a.nom)}</span>
        </span>
        <span class="pochette-a__meta">${obtenu
          ? `Vu ${esc(quand(a.obtenu))}`
          : `${esc(a.jourInfo?.court || "")}, ${fmt.heure(a.debut)}, ${esc(a.scene?.nom || "")}`}</span>
      </span>`;
  }

  function visuelStand(s, index) {
    const obtenu = !!s.obtenu;
    return `
      <span class="tampon-s${obtenu ? "" : " is-verrou"}">
        <span class="tampon-s__cadre ${ENCRES[index % ENCRES.length]}" style="--rot:${ROTATIONS[index % ROTATIONS.length]}deg">
          ${icon(s.type === "foodtruck" ? "couverts" : "billet")}
          <span class="tampon-s__nom">${esc(s.nom)}</span>
          <span class="${obtenu ? "tampon-s__date" : "tampon-s__type"}">${obtenu
            ? esc(quand(s.obtenu)).toUpperCase()
            : s.type === "foodtruck" ? "Food-truck à trouver" : "Stand à trouver"}</span>
        </span>
      </span>`;
  }

  /* ---------- Chargement ---------- */
  async function charger() {
    try {
      etat.donnees = await api.collection();
      if (!etat.donnees) { window.location.replace("inscription.html"); return; }
    } catch (e) {
      console.error(e);
      App.toast("Impossible de charger ta collection. Vérifie ta connexion.");
      return;
    }
    // Premier passage : tout ce qui est déjà obtenu est considéré comme vu
    etat.vus = App.vus.get(joueur.id);
    if (!etat.vus) {
      etat.vus = new Set();
      Object.keys(RAYONS).forEach((r) => etat.donnees[r].forEach((x) => { if (x.obtenu) etat.vus.add(cleVu(r, x.id)); }));
      App.vus.set(joueur.id, etat.vus);
    }
    rendreEntete();
    rendreGrille();
  }

  function rendreEntete() {
    const d = etat.donnees;
    let total = 0, obtenus = 0;
    Object.keys(RAYONS).forEach((r) => {
      const n = d[r].length, o = d[r].filter((x) => x.obtenu).length;
      total += n; obtenus += o;
      $(`[data-compte="${r}"]`).textContent = `${o}/${n}`;
      $(`[data-barre="${r}"]`).style.setProperty("--p", `${Math.round((o / n) * 100)}%`);
      const nouveaux = d[r].filter((x) => x.obtenu && !etat.vus.has(cleVu(r, x.id))).length;
      $(`[data-rayon="${r}"]`).setAttribute("aria-label", `${r}, ${o} sur ${n}${nouveaux ? `, ${nouveaux} nouveau${nouveaux > 1 ? "x" : ""}` : ""}`);
    });
    $("[data-phrase]").innerHTML =
      `Tu as rassemblé <strong class="chiffres">${obtenus}</strong> pièces sur ${total}.` +
      (obtenus === total ? " Collection complète !" : ` Encore ${total - obtenus} à découvrir sur le site.`);
  }

  function rendreGrille() {
    const r = etat.rayon;
    $("[data-panneau]").dataset.rayonActif = r;
    $("[data-panneau]").setAttribute("aria-labelledby", `onglet-${r}`);
    $("[data-aide]").textContent = RAYONS[r].aide;

    let liste = etat.donnees[r].map((x, i) => ({ ...x, _i: i }));
    if (etat.filtre === "obtenus") liste = liste.filter((x) => x.obtenu);
    if (etat.filtre === "manquants") liste = liste.filter((x) => !x.obtenu);
    // Obtenus d'abord, les plus récents en tête
    liste.sort((a, b) => (!!b.obtenu - !!a.obtenu) ||
      `${b.obtenu?.jour}${b.obtenu?.heure}`.localeCompare(`${a.obtenu?.jour}${a.obtenu?.heure}`) || a._i - b._i);

    $("[data-grille]").innerHTML = liste.map((x) => {
      const nouveau = x.obtenu && !etat.vus.has(cleVu(r, x.id));
      const visuel = r === "badges" ? visuelBadge(x) : r === "artistes" ? visuelArtiste(x) : visuelStand(x, x._i);
      const nom = r === "badges" && x.secret && !x.obtenu ? "Badge secret" : x.nom;
      return `
        <li>
          <button class="element-c" type="button" data-ouvrir="${esc(x.id)}"
            aria-label="${esc(nom)}, ${x.obtenu ? "obtenu" : "à trouver"}${nouveau ? ", nouveau" : ""}">
            ${nouveau ? `<span class="nouveau-c" aria-hidden="true">Nouveau</span>` : ""}
            ${visuel}
          </button>
        </li>`;
    }).join("");

    const vide = $("[data-vide]");
    vide.hidden = liste.length > 0;
    if (!liste.length) {
      const [t, x] = RAYONS[r].vides[etat.filtre] || ["Rien ici", ""];
      $("[data-vide-titre]").textContent = t;
      $("[data-vide-texte]").textContent = x;
    }
  }

  /* ---------- Onglets et filtre ---------- */
  const onglets = $$("[data-rayon]");
  function choisirRayon(r, focus = false) {
    etat.rayon = r;
    onglets.forEach((o) => {
      const actif = o.dataset.rayon === r;
      o.setAttribute("aria-selected", String(actif));
      o.tabIndex = actif ? 0 : -1;
      if (actif && focus) o.focus();
    });
    rendreGrille();
  }
  $("[data-onglets]").addEventListener("click", (e) => {
    const o = e.target.closest("[data-rayon]");
    if (o) choisirRayon(o.dataset.rayon);
  });
  $("[data-onglets]").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = onglets.findIndex((o) => o.dataset.rayon === etat.rayon);
    choisirRayon(onglets[(i + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3].dataset.rayon, true);
  });
  $(".filtre-c").addEventListener("change", (e) => { etat.filtre = e.target.value; rendreGrille(); });

  /* ---------- Fiche détaillée ---------- */
  const fiche = $("[data-fiche]");
  let dernierDeclencheur = null;

  function ouvrirFiche(rayon, id) {
    const x = etat.donnees[rayon].find((y) => y.id === id);
    if (!x) return;
    const cle = cleVu(rayon, id);
    const etaitNouveau = x.obtenu && !etat.vus.has(cle);
    const cache = rayon === "badges" && x.secret && !x.obtenu;

    $("[data-fiche-rayon]").textContent = RAYONS[rayon].nom + (x.obtenu ? " obtenu" : " à trouver");
    $("[data-fiche-visuel]").innerHTML = rayon === "badges"
      ? visuelBadge(x, { grand: etaitNouveau })
      : rayon === "artistes" ? visuelArtiste(x) : visuelStand(x, etat.donnees.stands.indexOf(x));
    $("[data-fiche-titre]").textContent = cache ? "Badge secret" : x.nom;

    const infos = [];
    const actions = [];
    if (rayon === "badges") {
      const r = raretes[x.rarete]?.nom || x.rarete;
      infos.push(`<div class="fiche-c__meta">
        <span class="pastille pastille--${x.rarete}">${esc(r)}</span>
        <span class="pastille">${x.pctJoueurs} % des joueurs l'ont</span></div>`);
      infos.push(`<p>${x.obtenu ? esc(x.texte) : cache ? esc(x.texte) : `Pour l'obtenir : ${esc(x.texte.charAt(0).toLowerCase() + x.texte.slice(1))}`}</p>`);
      if (x.obtenu) {
        infos.push(`<p class="fiche-c__obtenu">${icon("valide")} Obtenu ${esc(quand(x.obtenu))}</p>`);
        actions.push(`<a class="btn btn--sodium btn--bloc" href="passeport.html">${icon("partage")} Le montrer dans mon passeport</a>`);
      } else if (x.lien) {
        const lib = x.lien.startsWith("missions") ? "Voir la mission"
          : x.lien.startsWith("scanner") ? "Ouvrir le scanner"
          : x.lien.startsWith("blind") ? "Aller au blind test"
          : x.lien.startsWith("classement") ? "Voir le classement"
          : x.lien.startsWith("coups") ? "Aller voter"
          : x.lien.startsWith("plan") ? "Ouvrir le plan" : "Voir le programme";
        actions.push(`<a class="btn btn--sodium btn--bloc" href="${esc(x.lien)}">${lib}</a>`);
      }
    } else if (rayon === "artistes") {
      infos.push(`<div class="fiche-c__meta">
        <span class="pastille pastille--${esc(x.scene?.couleur || "")}">${esc(x.scene?.nom || "")}</span>
        <span class="pastille">${esc(x.genre)}</span></div>`);
      infos.push(`<p>${esc(x.jourInfo?.long || "")}, ${fmt.heure(x.debut)}</p>`);
      if (x.obtenu) {
        infos.push(`<p class="fiche-c__obtenu">${icon("valide")} Vu ${esc(quand(x.obtenu))}${x.obtenu.dedicace ? ", avec dédicace" : ""}</p>`);
        if (!x.obtenu.dedicace) infos.push(`<p class="texte-doux">Passe à sa séance de dédicaces pour ajouter sa signature.</p>`);
      } else {
        infos.push(`<p>Scanne le QR de la scène pendant son concert pour l'ajouter.</p>`);
        actions.push(`<a class="btn btn--sodium btn--bloc" href="programme.html#${encodeURIComponent(x.id)}">${icon("calendrier")} Voir dans le programme</a>`);
        actions.push(`<a class="btn btn--contour btn--bloc" href="plan.html?lieu=${encodeURIComponent(x.scene?.id || "")}">${icon("plan")} Trouver la scène</a>`);
      }
    } else {
      infos.push(`<div class="fiche-c__meta"><span class="pastille">${x.type === "foodtruck" ? "Food-truck" : "Stand"}</span><span class="pastille">${esc(x.zone)}</span></div>`);
      if (x.obtenu) {
        infos.push(`<p class="fiche-c__obtenu">${icon("valide")} Tamponné ${esc(quand(x.obtenu))}</p>`);
        actions.push(`<a class="btn btn--sodium btn--bloc" href="coups-de-coeur.html">${icon("coeur")} Voter pour ce stand</a>`);
      } else {
        infos.push(`<p>Son QR est affiché sur le comptoir. Scanne-le pour gagner des XP et son tampon.</p>`);
        actions.push(`<a class="btn btn--sodium btn--bloc" href="plan.html?stand=${encodeURIComponent(x.id)}">${icon("plan")} Voir sur le plan</a>`);
      }
    }
    $("[data-fiche-infos]").innerHTML = infos.join("");
    $("[data-fiche-actions]").innerHTML = actions.join("");

    if (etaitNouveau) {
      etat.vus.add(cle);
      App.vus.set(joueur.id, etat.vus);
      if (navigator.vibrate) navigator.vibrate(30);
    }
    fiche.showModal();
  }

  fiche.addEventListener("close", () => {
    rendreEntete();
    rendreGrille();
    if (dernierDeclencheur) {
      const b = $(`[data-ouvrir="${dernierDeclencheur}"]`);
      if (b) b.focus();
    }
  });
  $("[data-fermer-fiche]").addEventListener("click", () => fiche.close());
  fiche.addEventListener("click", (e) => { if (e.target === fiche) fiche.close(); });

  $("[data-grille]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ouvrir]");
    if (!b) return;
    dernierDeclencheur = b.dataset.ouvrir;
    ouvrirFiche(etat.rayon, b.dataset.ouvrir);
  });

  /* ---------- Lien direct : collection.html#b-fouineur, #a5, #st-kora ---------- */
  function lienDirect() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || !etat.donnees) return;
    const rayon = Object.keys(RAYONS).find((r) => etat.donnees[r].some((x) => x.id === id));
    if (!rayon) return;
    choisirRayon(rayon);
    ouvrirFiche(rayon, id);
  }

  await charger();
  lienDirect();
  window.addEventListener("hashchange", lienDirect);
});
