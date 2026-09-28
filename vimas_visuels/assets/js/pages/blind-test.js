/* ==========================================================================
   Page 12 — Blind test côté joueur
   Lit le même état que l'écran géant (App.api.blindTestDirect) et envoie les réponses.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, esc, icon, fmt, api } = App;

  const cfg = await App.data.get("blindTest");
  const H = App.blindHorloge;
  const vue = $("[data-vue]");
  const main = $("main");
  const LETTRES = "ABCD";

  const etat = {
    phase: null, cle: "", manche: null,
    reponses: {},      // index → { choix, temps, envoye }
    scores: {},        // index → résultat renvoyé après la révélation
    recap: null,
    derniereReussite: Date.now(),
    verrouEcran: null
  };

  /* ---------- Utilitaires ---------- */
  const mmss = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const rangTxt = (r) => `${fmt.nombre(r)}<small>${r === 1 ? "er" : "e"}</small>`;
  const forme = (i) => `<span class="touche__forme forme-${i}" aria-hidden="true">${LETTRES[i]}</span>`;

  function majScore(total, anime = false) {
    const el = $("[data-score]");
    el.hidden = false;
    $("[data-score-val]").textContent = fmt.nombre(total);
    if (anime) { el.classList.remove("is-gagne"); void el.offsetWidth; el.classList.add("is-gagne"); }
  }

  async function garderEcranAllume(oui) {
    try {
      if (oui && !etat.verrouEcran && navigator.wakeLock) etat.verrouEcran = await navigator.wakeLock.request("screen");
      if (!oui && etat.verrouEcran) { await etat.verrouEcran.release(); etat.verrouEcran = null; }
    } catch (e) { /* non pris en charge */ }
  }

  /* ======================================================================
     Vues
     ====================================================================== */
  function vueAttente(e) {
    const loin = e.restant > 6 * 3600000;
    vue.innerHTML = `
      <div class="vue-j">
        <h2 class="affiche vue-j__titre">Blind test géant</h2>
        <div class="rdv">
          <p class="rdv__lib">${loin ? "Prochaine manche" : `Ce soir à ${esc(fmt.heure(cfg.horaire))}, ${esc(cfg.lieu)}`}</p>
          <p class="rdv__compte" data-compte>${loin ? esc(fmt.heure(cfg.horaire)) : mmss(e.restant)}</p>
          <p data-conseil>${e.restant < 10 * 60000 ? "Garde cette page ouverte : la manche démarre toute seule." : `${fmt.nombre(e.connectes)} joueurs déjà prêts.`}</p>
        </div>
        <ol class="regles-bt">
          <li><span>Regarde l'<strong>écran géant</strong> et écoute l'extrait joué sur la scène.</span></li>
          <li><span>Touche la bonne réponse sur ton téléphone. <strong>Un seul essai</strong> par question.</span></li>
          <li><span>Plus tu réponds vite, plus tu marques : jusqu'à <strong>1 000 points</strong>.</span></li>
        </ol>
        <div class="gains-bt">
          <p><span>Chaque manche</span><strong>tes points ÷ 25 en XP</strong></p>
          <p><span>Top 10</span><strong>badge Oreille d'or</strong></p>
          <p><span>Podium</span><strong>5 jetons et un lot</strong></p>
        </div>
        ${App.config.demo ? `
          <div class="demo-bt">
            <p>Démo : ouvre <code>ecran/blind-test.html</code> dans un autre onglet pour voir le plateau, ou lance une manche ici.</p>
            <button class="btn btn--contour btn--bloc" type="button" data-demo-lancer>Lancer une manche de démo</button>
          </div>` : ""}
      </div>`;
  }

  function vueIntro(e) {
    vue.innerHTML = `
      <div class="vue-j vue-j--intro">
        <p class="intro-num"><small>Question</small>${e.question.numero}</p>
        <p class="pastille pastille--sodium">${esc(e.question.categorie)}</p>
        <p class="texte-clair">Regarde l'écran géant et tends l'oreille.</p>
        <div class="eq intro-eq" data-eq-intro></div>
      </div>`;
    App.eq($("[data-eq-intro]"), 20);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function vueQuestion(e) {
    const q = e.question;
    const deja = etat.reponses[e.index];
    vue.innerHTML = `
      <div class="vue-j">
        <div class="q-tete">
          <p class="q-cat">${esc(q.categorie)}</p>
          <p class="q-texte">${esc(q.question)}</p>
          <div class="q-chrono" data-chrono>
            <div class="q-chrono__barre"><i data-chrono-barre></i></div>
            <span class="q-chrono__s" data-chrono-s></span>
          </div>
        </div>
        <div class="touches${deja ? " is-verrouille" : ""}" role="group" aria-label="Réponses" data-touches>
          ${q.choix.map((c, i) => `
            <button class="touche${deja && deja.choix === i ? " is-choisie" : ""}" type="button" data-choix="${i}"
              aria-label="Réponse ${LETTRES[i]} : ${esc(c)}" ${deja ? "disabled" : ""}>
              ${forme(i)}<span>${esc(c)}</span>
            </button>`).join("")}
        </div>
        <p class="envoi" data-envoi ${deja ? "" : "hidden"}></p>
      </div>`;
    if (deja) majEnvoi(deja);
  }

  function majEnvoi(r) {
    const el = $("[data-envoi]");
    if (!el) return;
    el.hidden = false;
    el.classList.toggle("is-attente", !r.envoye);
    el.innerHTML = r.envoye
      ? `${icon("coche")} Réponse ${LETTRES[r.choix]} envoyée en ${(r.temps / 1000).toFixed(1).replace(".", ",")} s`
      : `${icon("horloge")} Envoi de ta réponse…`;
  }

  async function repondre(e, choix) {
    if (etat.reponses[e.index] || e.phase !== "question") return;
    const temps = Math.max(0, e.duree - e.restant);
    const r = (etat.reponses[e.index] = { choix, temps, envoye: false, manche: etat.manche });
    if (navigator.vibrate) navigator.vibrate(50);
    const touches = $("[data-touches]");
    touches.classList.add("is-verrouille");
    touches.querySelectorAll("[data-choix]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("is-choisie", Number(b.dataset.choix) === choix);
    });
    majEnvoi(r);
    await envoyer(e.index);
  }

  /* Envoi avec nouvelle tentative : une réponse perdue par le réseau est renvoyée */
  async function envoyer(index) {
    const r = etat.reponses[index];
    if (!r || r.envoye || r.enCours) return;
    r.enCours = true;
    try {
      const res = await api.blindRepondre({ manche: r.manche, index, choix: r.choix, temps: r.temps });
      if (res.ok || res.erreur === "deja") { r.envoye = true; etat.derniereReussite = Date.now(); }
    } catch (err) { /* nouvel essai au prochain passage */ }
    r.enCours = false;
    majEnvoi(r);
  }

  async function vueRevelation(e) {
    const r = e.revelation;
    const q = e.question;
    // Affiche d'abord la bonne réponse, puis le résultat personnel
    let s = etat.scores[e.index];
    if (!s) {
      s = await api.blindMonScore({ manche: etat.manche, jusqua: e.index });
      etat.scores[e.index] = s;
    }
    if (!s) return;
    const d = s.derniere;
    const classe = !d.repondu ? "absent" : d.juste ? "juste" : "faux";
    const titre = !d.repondu ? "Trop tard" : d.juste ? "Bien joué !" : "Raté";
    vue.innerHTML = `
      <div class="vue-j">
        <div class="resultat-j resultat-j--${classe}">
          <p class="affiche resultat-j__titre">${titre}</p>
          <p class="resultat-j__points chiffres">+${fmt.nombre(d.points)}</p>
          ${d.repondu ? `<p>Répondu en ${(d.temps / 1000).toFixed(1).replace(".", ",")} s</p>` : "<p>Aucune réponse reçue pour cette question.</p>"}
          ${s.serie >= 2 ? `<p class="resultat-j__serie">Série de ${s.serie} bonnes réponses</p>` : ""}
        </div>
        <div class="bonne-rep" style="--c:${["var(--sodium)", "var(--rose)", "var(--vert)", "#8FA6FF"][r.bonne]}">
          ${forme(r.bonne)}
          <span><strong>${esc(q.choix[r.bonne])}</strong><span class="texte-clair">${esc(r.reponse)}</span></span>
        </div>
        <div class="position-j">
          <span>Ta place<br><span class="texte-clair">sur ${fmt.nombre(s.participants)} joueurs</span></span>
          <span class="position-j__rang chiffres">${rangTxt(s.rang)}</span>
        </div>
        <p class="texte-clair">${s.bonnes} bonne${s.bonnes > 1 ? "s" : ""} réponse${s.bonnes > 1 ? "s" : ""} sur ${e.index + 1}. ${esc(r.anecdote)}</p>
      </div>`;
    majScore(s.total, d.points > 0);
    if (navigator.vibrate) navigator.vibrate(d.juste ? [60, 40, 120] : [150]);
  }

  async function vueClassement(e) {
    const s = etat.scores[e.index] || (await api.blindMonScore({ manche: etat.manche, jusqua: e.index }));
    vue.innerHTML = `
      <div class="vue-j">
        <h2 class="affiche vue-j__titre">Après ${e.index + 1} questions</h2>
        <div class="position-j">
          <span>Ta place, ${fmt.nombre(s.total)} pts<br><span class="texte-clair">sur ${fmt.nombre(s.participants)} joueurs</span></span>
          <span class="position-j__rang chiffres">${rangTxt(s.rang)}</span>
        </div>
        <p class="texte-clair">En tête en ce moment :</p>
        <ol class="mini-top">
          ${e.classement.slice(0, 3).map((j) => `
            <li><b>${j.rang}</b>${App.avatar(j.avatar, j.pseudo, "sm")}<span>${esc(j.pseudo)}</span><span class="chiffres">${fmt.nombre(j.points)}</span></li>`).join("")}
        </ol>
        <p class="texte-clair">La suite dans quelques secondes, reste prêt.</p>
      </div>`;
  }

  async function vueFin(e) {
    const aJoue = Object.keys(etat.reponses).length > 0 || Object.keys(etat.scores).length > 0;
    if (!etat.recap) etat.recap = await api.blindTerminer({ manche: etat.manche });
    const rc = etat.recap;
    if (!rc || !rc.participe || !aJoue && !rc.total) {
      vue.innerHTML = `
        <div class="vue-j">
          <h2 class="affiche vue-j__titre">Manche terminée</h2>
          <p>Tu n'as pas joué cette manche. Rendez-vous demain à ${esc(fmt.heure(cfg.horaire))} devant l'écran géant !</p>
          <ol class="mini-top">
            ${e.podium.slice(0, 3).map((j) => `<li><b>${j.rang}</b>${App.avatar(j.avatar, j.pseudo, "sm")}<span>${esc(j.pseudo)}</span><span class="chiffres">${fmt.nombre(j.points)}</span></li>`).join("")}
          </ol>
          <a class="btn btn--sodium btn--bloc" href="tableau-de-bord.html">Retour à ma carte</a>
        </div>`;
      return;
    }
    const recompenses = [
      `<li>${icon("eclair")} +${fmt.nombre(rc.xp)} XP ajoutés à ta carte</li>`,
      rc.jetons ? `<li>${icon("roue")} +${rc.jetons} jeton${rc.jetons > 1 ? "s" : ""}</li>` : "",
      rc.badge ? `<li>${icon("etoile")} Nouveau badge : ${esc(rc.badge)}</li>` : "",
      rc.mission ? `<li>${icon("cible")} Mission ${esc(rc.mission.titre)} : ${rc.mission.apres}/${rc.mission.objectif}</li>` : ""
    ].join("");
    vue.innerHTML = `
      <div class="vue-j">
        <h2 class="affiche vue-j__titre">Manche terminée</h2>
        <div class="recap-j">
          <p>Ta place finale</p>
          <p class="recap-j__rang chiffres">${rangTxt(rc.rang)}</p>
          <p><strong class="chiffres">${fmt.nombre(rc.total)}</strong> points, ${rc.bonnes}/${rc.total_questions} bonnes réponses</p>
          ${rc.rang <= 3 ? "<p><strong>Tu es sur le podium ! Ton lot t'attend au stand Vimas Fest.</strong></p>" : ""}
        </div>
        <ul class="recompenses-j">${recompenses}</ul>
        <div class="actions-j">
          <a class="btn btn--sodium btn--bloc" href="tableau-de-bord.html">Voir ma carte</a>
          ${rc.badge ? `<a class="btn btn--contour btn--bloc" href="collection.html#b-oreille-or">Voir mon badge</a>` : ""}
          <a class="btn btn--contour btn--bloc" href="passeport.html">Partager mon passeport</a>
        </div>
      </div>`;
    majScore(rc.total);
    if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 200]);
  }

  /* ======================================================================
     Boucle
     ====================================================================== */
  function majEntete(e) {
    const enJeu = ["intro", "question", "revelation", "classement"].includes(e.phase);
    document.body.classList.toggle("is-en-jeu", enJeu);
    main.dataset.phase = e.phase;
    garderEcranAllume(enJeu);
    $("[data-progres]").hidden = !enJeu;
    if (enJeu) {
      $("[data-progres-txt]").textContent = `Question ${e.index + 1} sur ${e.total}`;
      $("[data-pastilles]").innerHTML = Array.from({ length: e.total }, (_, i) =>
        `<i class="${i < e.index || (i === e.index && ["revelation", "classement"].includes(e.phase)) ? "is-fait" : i === e.index ? "is-actuel" : ""}"></i>`).join("");
    }
  }

  let calculEnCours = false;
  async function tick() {
    const h = H.etat(cfg);
    let e;
    try {
      e = await api.blindTestDirect({ ecoule: h.ecoule });
      etat.derniereReussite = Date.now();
    } catch (err) { /* hors ligne */ }

    const ko = Date.now() - etat.derniereReussite > 8000;
    $("[data-etat]").classList.toggle("is-ko", ko);
    $("[data-etat-txt]").textContent = ko ? "Connexion perdue, tes réponses seront renvoyées"
      : h.pauseDepuis !== null ? "Manche en pause" : "Synchronisé avec l'écran géant";
    if (!e) return;

    // Nouvelle manche : on repart de zéro
    if (etat.manche !== h.id) {
      Object.assign(etat, { manche: h.id, reponses: {}, scores: {}, recap: null, cle: "" });
      $("[data-score]").hidden = true;
    }
    // Réponses en attente d'envoi
    Object.keys(etat.reponses).forEach((i) => envoyer(Number(i)));

    majEntete(e);
    const cle = `${e.phase}-${e.index}`;
    if (cle !== etat.cle && !calculEnCours) {
      etat.cle = cle;
      calculEnCours = true;
      try {
        if (e.phase === "attente") vueAttente(e);
        else if (e.phase === "intro") vueIntro(e);
        else if (e.phase === "question") vueQuestion(e);
        else if (e.phase === "revelation") await vueRevelation(e);
        else if (e.phase === "classement") await vueClassement(e);
        else await vueFin(e);
      } finally {
        calculEnCours = false;
      }
    }

    // Mises à jour fines
    if (e.phase === "attente") {
      const c = $("[data-compte]");
      if (c && e.restant <= 6 * 3600000) c.textContent = e.restant > 3600000 ? App.duree(e.restant) : mmss(e.restant);
    }
    if (e.phase === "question") {
      const s = Math.ceil(e.restant / 1000);
      const barre = $("[data-chrono-barre]");
      if (barre) {
        barre.style.transform = `scaleX(${(e.restant / e.duree).toFixed(3)})`;
        $("[data-chrono-s]").textContent = s;
        $("[data-chrono]").classList.toggle("is-urgent", s <= 5);
      }
      etat.dernierEtat = e;
    }
  }

  /* ---------- Interactions ---------- */
  vue.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-choix]");
    if (b && etat.dernierEtat) repondre(etat.dernierEtat, Number(b.dataset.choix));
    if (ev.target.closest("[data-demo-lancer]")) {
      H.demarrer(8000);
      App.toast("Manche de démo dans 8 secondes.");
      tick();
    }
  });
  // Clavier (ordinateur) : A/B/C/D ou 1/2/3/4
  document.addEventListener("keydown", (ev) => {
    const i = "abcd".indexOf(ev.key.toLowerCase()) >= 0 ? "abcd".indexOf(ev.key.toLowerCase()) : "1234".indexOf(ev.key);
    if (i >= 0 && etat.dernierEtat && etat.dernierEtat.phase === "question") repondre(etat.dernierEtat, i);
  });
  // Avertir avant de quitter en pleine manche
  window.addEventListener("beforeunload", (ev) => {
    if (document.body.classList.contains("is-en-jeu")) { ev.preventDefault(); ev.returnValue = ""; }
  });

  await tick();
  setInterval(tick, 250);
});
