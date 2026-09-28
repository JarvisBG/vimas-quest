/* ==========================================================================
   Page 1 — Accueil / vitrine
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, data, api } = App;

  // Contenu du site (mock.js) ; line-up et lots : api.vitrine() (base en mode serveur)
  let d;
  try {
    const cles = ["festival", "jours", "etapes", "rangs", "blindTest", "quizDemo", "partenaires", "bandeau"];
    const valeurs = await Promise.all(cles.map((c) => data.get(c)));
    d = Object.fromEntries(cles.map((c, i) => [c, valeurs[i]]));
  } catch (err) {
    console.error(err);
    App.toast("La page n'a pas pu être chargée. Recharge-la.");
    return;
  }
  let v;
  try {
    v = await api.vitrine();
  } catch (err) {
    v = { concerts: [], lots: [], erreur: true };
  }

  /* ---------- Égaliseurs ---------- */
  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  /* ---------- Hero ---------- */
  $("[data-edition]").textContent = `${d.festival.edition}${d.festival.edition === 1 ? "re" : "e"} édition`;
  $("[data-dates]").textContent = d.festival.dates;
  $("[data-lieu]").textContent = d.festival.lieu;
  App.countdown($("[data-countdown] .countdown"), d.festival.ouverture, {
    done: "Le festival est ouvert"
  });

  // Un artiste qui joue deux fois n'apparaît qu'une fois sur l'affiche
  const noms = new Map();
  v.concerts.forEach((c) => noms.set(c.nom, (noms.get(c.nom) || false) || c.tete));
  const tetes = [...noms].filter(([, t]) => t).map(([n]) => n);
  const autres = [...noms].filter(([, t]) => !t).map(([n]) => n);
  $("[data-tetes]").innerHTML = noms.size
    ? tetes.map((n) => `<li>${esc(n)}</li>`).join("")
    : `<li>Line-up</li><li>bientôt</li><li>annoncé</li>`;
  $("[data-autres]").innerHTML = autres.map((n) => `<span>${esc(n)}</span>`).join("");

  /* ---------- Bandeau (contenu doublé pour une boucle continue) ---------- */
  const items = d.bandeau.map((t) => `<li>${esc(t)} ${icon("onde")}</li>`).join("");
  $("[data-bandeau]").innerHTML = `<ul>${items}</ul><ul>${items}</ul>`;

  /* ---------- Étapes ---------- */
  $("[data-etapes]").innerHTML = d.etapes.map((e) => `
    <li class="setlist__piste">
      <h3 class="setlist__titre">${esc(e.titre)}</h3>
      <p class="setlist__texte">${esc(e.texte)}</p>
      <span class="pastille pastille--sodium setlist__gain">${esc(e.gain)}</span>
    </li>`).join("");


  /* ---------- Line-up par jour (onglets accessibles) ---------- */
  const onglets = $("[data-onglets]");
  const panneau = $("[data-programme]");

  onglets.innerHTML = d.jours.map((j, i) => `
    <button class="onglet" type="button" role="tab" id="onglet-${j.id}"
      aria-controls="panneau-jour" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
      data-jour="${j.id}" aria-label="${esc(j.long)}">${esc(j.court)}</button>`).join("");

  function afficherJour(id) {
    const liste = v.concerts.filter((c) => c.jour === id).sort((x, y) => x.ordre - y.ordre);
    panneau.setAttribute("aria-labelledby", `onglet-${id}`);
    if (!liste.length) {
      panneau.innerHTML = `<p class="programme__vide">${v.concerts.length ? "Pas de concert annoncé ce jour-là pour l'instant."
        : v.erreur ? "Le programme n'a pas pu être chargé. Réessaie dans un instant." : "Programme bientôt annoncé : repasse vite !"}</p>`;
      return;
    }
    panneau.innerHTML = `<ul>${liste.map((c) => `
      <li class="concert${c.tete ? " concert--tete" : ""}">
        <span class="concert__heure">${esc(c.heure)}</span>
        <span class="concert__nom">${esc(c.nom)}</span>
        <span class="concert__meta">
          <span class="pastille pastille--${esc(c.scene.couleur)}">${esc(c.scene.nom)}</span>
          <span>${esc(c.genre)}</span>
        </span>
      </li>`).join("")}</ul>`;
  }

  function choisirOnglet(btn) {
    $$(".onglet", onglets).forEach((o) => {
      const actif = o === btn;
      o.setAttribute("aria-selected", String(actif));
      o.tabIndex = actif ? 0 : -1;
    });
    afficherJour(btn.dataset.jour);
  }

  onglets.addEventListener("click", (e) => {
    const btn = e.target.closest(".onglet");
    if (btn) choisirOnglet(btn);
  });
  onglets.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tous = $$(".onglet", onglets);
    let i = tous.indexOf(document.activeElement);
    if (e.key === "ArrowRight") i = (i + 1) % tous.length;
    if (e.key === "ArrowLeft") i = (i - 1 + tous.length) % tous.length;
    if (e.key === "Home") i = 0;
    if (e.key === "End") i = tous.length - 1;
    e.preventDefault();
    tous[i].focus();
    choisirOnglet(tous[i]);
  });
  // Onglet ouvert : aujourd'hui pendant le festival, sinon le premier jour qui a des concerts
  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: App.config.fuseau }).format(new Date());
  const premier = d.jours.find((j) => j.date === aujourdhui && v.concerts.some((c) => c.jour === j.id))
    || d.jours.find((j) => v.concerts.some((c) => c.jour === j.id)) || d.jours[0];
  choisirOnglet($(`[data-jour="${premier.id}"]`, onglets));

  /* ---------- Blind test : question d'essai ---------- */
  const bt = d.blindTest;
  $("[data-blind-infos]").innerHTML = `
    <li>${icon("horloge")} Chaque jour à ${fmt.heure(bt.horaire)}</li>
    <li>${icon("lieu")} ${esc(bt.lieu)}</li>
    <li>${icon("micro")} ${bt.questions} extraits par manche</li>`;

  const q = d.quizDemo;
  const quiz = $("[data-quiz]");
  $("[data-quiz-question]").textContent = q.question;
  const zoneChoix = $("[data-quiz-choix]");
  zoneChoix.innerHTML = q.choix.map((c, i) => `
    <button class="choix" type="button" data-i="${i}">
      <span class="choix__lettre" aria-hidden="true">${"ABCD"[i]}</span>${esc(c)}
    </button>`).join("");

  zoneChoix.addEventListener("click", (e) => {
    const btn = e.target.closest(".choix");
    if (!btn || quiz.hasAttribute("data-joue")) return;
    quiz.setAttribute("data-joue", "");
    const choisi = Number(btn.dataset.i);
    $$(".choix", zoneChoix).forEach((c, i) => {
      c.classList.add(i === q.bonne ? "is-bon" : "is-faux");
      c.setAttribute("aria-disabled", "true");
    });
    App.toast(choisi === q.bonne
      ? "Bonne réponse. Pendant le festival, elle t'aurait rapporté jusqu'à 1 000 points (40 XP)."
      : `Raté\u00A0: c'était «\u00A0${q.choix[q.bonne]}\u00A0». Rendez-vous au blind test pour la revanche.`);
  });

  /* ---------- Roue (démo) ---------- */
  const roue = $("[data-roue]");
  let angle = 0;
  $("[data-roue-btn]").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const tours = App.reduceMotion ? 0 : 5;
    angle += tours * 360 + 45 * Math.floor(Math.random() * 8) + 22.5;
    roue.style.transform = `rotate(${angle}deg)`;
    const delai = App.reduceMotion ? 50 : 3300;
    setTimeout(() => {
      btn.disabled = false;
      App.toast("Belle tentative. Crée ta carte pour jouer avec de vrais jetons.");
    }, delai);
  });

  /* ---------- Lots et rangs ---------- */
  const libRarete = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
  // stock null = sans limite
  $("[data-lots]").innerHTML = v.lots.length ? v.lots.map((l) => `
    <li class="lot">
      <div>
        <span class="lot__nom">${esc(l.nom)}</span>
        <span class="lot__stock chiffres">${l.stock == null ? "" : l.stock > 0 ? `${fmt.nombre(l.stock)} en stock` : "Épuisé, bravo aux gagnants"}</span>
      </div>
      <span class="pastille pastille--${esc(l.rarete)}">${libRarete[l.rarete] || ""}</span>
    </li>`).join("") : `<li class="lot"><span class="lot__nom">Les lots seront annoncés très bientôt.</span></li>`;

  $("[data-rangs]").innerHTML = d.rangs.map((r, i) => `
    <li style="--i:${i}">
      <span>${esc(r.nom)}</span>
      <small class="chiffres">${r.xp === 0 ? "Dès l'inscription" : `${fmt.nombre(r.xp)} XP`}</small>
    </li>`).join("");

  /* ---------- Partenaires : section masquée tant que la vraie liste est vide ---------- */
  if (d.partenaires.length) {
    $("#partenaires").hidden = false;
    $$("[data-lien-partenaires]").forEach((l) => { l.hidden = false; });
    $("[data-partenaires]").innerHTML = d.partenaires.map((p) => `
      <li class="partenaire">
        <span class="partenaire__nom">${esc(p.nom)}</span>
        <span class="partenaire__role">${esc(p.role)}</span>
      </li>`).join("");
    const contact = $("[data-contact]");
    if (d.festival.contactPartenaires) contact.href = `mailto:${d.festival.contactPartenaires}`;
    else contact.hidden = true;
  }
});
