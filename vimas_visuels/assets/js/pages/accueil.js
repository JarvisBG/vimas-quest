/* ==========================================================================
   Page 1 — Accueil / vitrine
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, data } = App;

  let d;
  try {
    const cles = ["festival", "jours", "scenes", "artistes", "bilan", "etapes", "rangs", "lots", "blindTest", "quizDemo", "partenaires", "bandeau"];
    const valeurs = await Promise.all(cles.map((c) => data.get(c)));
    d = Object.fromEntries(cles.map((c, i) => [c, valeurs[i]]));
  } catch (err) {
    console.error(err);
    App.toast("Le programme n'a pas pu être chargé. Rechargez la page.");
    return;
  }

  const sceneParId = Object.fromEntries(d.scenes.map((s) => [s.id, s]));

  /* ---------- Égaliseurs ---------- */
  $$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));

  /* ---------- Hero ---------- */
  $("[data-edition]").textContent = `${d.festival.edition}${d.festival.edition === 1 ? "re" : "e"} édition`;
  $("[data-dates]").textContent = d.festival.dates;
  $("[data-lieu]").textContent = d.festival.lieu;
  App.countdown($("[data-countdown] .countdown"), d.festival.ouverture, {
    done: "Le festival est ouvert"
  });

  const tetes = d.artistes.filter((a) => a.tete);
  const autres = d.artistes.filter((a) => !a.tete);
  $("[data-tetes]").innerHTML = tetes.map((a) => `<li>${esc(a.nom)}</li>`).join("");
  $("[data-autres]").innerHTML = autres.map((a) => `<span>${esc(a.nom)}</span>`).join("");

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

  const b = d.bilan;
  $("[data-bilan]").innerHTML =
    `Pour cette 1re édition : <strong class="chiffres" data-count="${b.qrCaches}">${b.qrCaches}</strong> QR cachés, ` +
    `<strong class="chiffres" data-count="${b.lotsRemis}">${b.lotsRemis}</strong> lots à gagner et ` +
    `<strong class="chiffres" data-count="${b.joueurs}">${fmt.nombre(b.joueurs)}</strong> joueurs attendus.`;
  $$("[data-bilan] [data-count]").forEach(App.countUp);

  /* ---------- Line-up par jour (onglets accessibles) ---------- */
  const onglets = $("[data-onglets]");
  const panneau = $("[data-programme]");

  onglets.innerHTML = d.jours.map((j, i) => `
    <button class="onglet" type="button" role="tab" id="onglet-${j.id}"
      aria-controls="panneau-jour" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
      data-jour="${j.id}" aria-label="${esc(j.long)}">${esc(j.court)}</button>`).join("");

  /* Les concerts après minuit sont classés en fin de soirée */
  const ordre = (h) => { const [hh, mm] = h.split(":").map(Number); return (hh < 8 ? hh + 24 : hh) * 60 + mm; };

  function afficherJour(id) {
    const liste = d.artistes.filter((a) => a.jour === id).sort((x, y) => ordre(x.debut) - ordre(y.debut));
    panneau.setAttribute("aria-labelledby", `onglet-${id}`);
    panneau.innerHTML = `<ul>${liste.map((a) => {
      const s = sceneParId[a.scene];
      return `
      <li class="concert${a.tete ? " concert--tete" : ""}">
        <span class="concert__heure">${fmt.heure(a.debut)}</span>
        <span class="concert__nom">${esc(a.nom)}</span>
        <span class="concert__meta">
          <span class="pastille pastille--${s.couleur}">${esc(s.nom)}</span>
          <span>${esc(a.genre)}</span>
        </span>
      </li>`;
    }).join("")}</ul>`;
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
  afficherJour(d.jours[0].id);

  /* ---------- Blind test : question d'essai ---------- */
  const bt = d.blindTest;
  $("[data-blind-infos]").innerHTML = `
    <li>${icon("horloge")} Chaque soir à ${fmt.heure(bt.horaire)}</li>
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
      ? "Bonne réponse. Pendant le festival, elle t'aurait rapporté 30 XP."
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
      App.toast("Belle tentative. Scanne ton billet pour jouer avec de vrais jetons.");
    }, delai);
  });

  /* ---------- Lots et rangs ---------- */
  const libRarete = { commun: "Commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
  $("[data-lots]").innerHTML = d.lots.map((l) => `
    <li class="lot">
      <div>
        <span class="lot__nom">${esc(l.nom)}</span>
        <span class="lot__stock chiffres">${l.stock > 0 ? `${fmt.nombre(l.stock)} en stock` : "Épuisé, bravo aux gagnants"}</span>
      </div>
      <span class="pastille pastille--${l.rarete}">${libRarete[l.rarete]}</span>
    </li>`).join("");

  $("[data-rangs]").innerHTML = d.rangs.map((r, i) => `
    <li style="--i:${i}">
      <span>${esc(r.nom)}</span>
      <small class="chiffres">${r.xp === 0 ? "Dès l'inscription" : `${fmt.nombre(r.xp)} XP`}</small>
    </li>`).join("");

  /* ---------- Partenaires ---------- */
  $("[data-partenaires]").innerHTML = d.partenaires.map((p) => `
    <li class="partenaire">
      <span class="partenaire__nom">${esc(p.nom)}</span>
      <span class="partenaire__role">${esc(p.role)}</span>
    </li>`).join("");
  $("[data-contact]").href = `mailto:${d.festival.contactPartenaires}`;
});
