/* ==========================================================================
   Page 16 — Sondage du soir
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  if (!App.initJoueur({ actif: "plus" })) return;
  const { $, $$, esc, icon, fmt, api } = App;

  const ecran = $("[data-ecran]");
  const etat = { s: null, index: -1, reponses: {}, forcer: false, envoi: false };
  let minuteurBrouillon;

  try {
    etat.s = await api.sondage();
    if (!etat.s) { location.replace("inscription.html"); return; }
    etat.reponses = { ...etat.s.brouillon };
  } catch (e) {
    ecran.innerHTML = `<p>Impossible de charger le sondage. Vérifie ta connexion.</p>`;
    return;
  }
  const Q = etat.s.questions;

  /* ---------- Outils ---------- */
  function afficher(html, retour = false) {
    ecran.classList.remove("is-retour");
    void ecran.offsetWidth;
    ecran.classList.toggle("is-retour", retour);
    ecran.innerHTML = html;
    window.scrollTo(0, 0);
    const titre = $("[data-titre]", ecran);
    if (titre) titre.focus({ preventScroll: true });
    majProgression();
  }

  function majProgression() {
    const enQuestion = etat.index >= 0 && etat.index < Q.length;
    const crans = $("[data-crans]");
    crans.hidden = !enQuestion;
    $("[data-compteur]").textContent = enQuestion ? `${etat.index + 1}/${Q.length}` : "";
    if (enQuestion) {
      crans.innerHTML = Q.map((_, i) => `<i class="${i < etat.index ? "is-fait" : i === etat.index ? "is-actuel" : ""}"></i>`).join("");
    }
  }

  const sauver = () => {
    clearTimeout(minuteurBrouillon);
    minuteurBrouillon = setTimeout(() => api.sauverBrouillon(etat.s.nuit, etat.reponses), 300);
  };
  // Sauvegarde immédiate si le joueur quitte la page ou change d'application
  const sauverMaintenant = () => { clearTimeout(minuteurBrouillon); if (etat.index >= 0 && etat.index < Q.length) api.sauverBrouillon(etat.s.nuit, etat.reponses); };
  window.addEventListener("pagehide", sauverMaintenant);
  document.addEventListener("visibilitychange", () => { if (document.hidden) sauverMaintenant(); });

  const aRepondu = (q) => {
    const v = etat.reponses[q.id];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  };

  /* ======================================================================
     Écrans hors questions
     ====================================================================== */
  function ecranAccueil() {
    etat.index = -1;
    const s = etat.s;
    const r = s.recompense;
    const recompense = `<p class="recompense-s"><span>${icon("eclair")} +${r.xp} XP</span><span><span class="jeton" aria-hidden="true"></span> +${r.jetons} jetons</span></p>`;
    const anonyme = `<p class="anonyme-s">${icon("valide")} Tes réponses sont enregistrées sans ton pseudo : elles servent seulement à améliorer le festival.</p>`;

    if (s.dejaRepondu) {
      afficher(`
        <div class="fin-s">
          <span class="fin-s__coche">${icon("coche")}</span>
          <h2 class="affiche fin-s__titre" tabindex="-1" data-titre>Déjà répondu</h2>
          <p>Merci, ton avis de ce soir est bien arrivé. Le prochain sondage ouvre demain à ${App.heureFestival(new Date(s.ouvertureMs))}.</p>
          <div class="actions-s" style="grid-template-columns:1fr"><a class="btn btn--sodium btn--bloc" href="tableau-de-bord.html">Retour à ma carte</a></div>
        </div>`);
      return;
    }
    if (!s.ouvert && !etat.forcer) {
      const avant = App.maintenant().getTime() < s.ouvertureMs;
      afficher(`
        <div class="intro-s">
          <span class="intro-s__lune" aria-hidden="true"></span>
          <h2 class="affiche intro-s__titre" tabindex="-1" data-titre>Ta soirée en une minute</h2>
          <div class="ferme-s">
            <p class="texte-clair">${avant ? "Le sondage ouvre à" : "Le sondage de cette nuit est fermé. Rendez-vous demain à"}</p>
            <p class="ferme-s__heure">${App.heureFestival(new Date(s.ouvertureMs))}</p>
            ${avant ? `<p class="texte-clair">dans ${App.duree(s.ouvertureMs - App.maintenant().getTime())}. Profite des concerts d'ici là !</p>` : ""}
          </div>
          ${recompense}
          ${App.config.demo ? `<button class="btn btn--contour btn--bloc" type="button" data-forcer>Démo : ouvrir le sondage maintenant</button>` : ""}
        </div>`);
      return;
    }
    const dejaCommence = Object.keys(etat.reponses).length > 0;
    afficher(`
      <div class="intro-s">
        <span class="intro-s__lune" aria-hidden="true"></span>
        <h2 class="affiche intro-s__titre" tabindex="-1" data-titre>Ta soirée en une minute</h2>
        <p>${Q.length} questions rapides sur ta journée${s.jour ? ` du ${esc(s.jour.long.toLowerCase())}` : ""}. Tu gagnes :</p>
        ${recompense}
        ${anonyme}
        <button class="btn btn--sodium btn--lg btn--bloc" type="submit">${dejaCommence ? "Reprendre" : "Commencer"}</button>
      </div>`);
  }

  function ecranFin(res) {
    etat.index = Q.length;
    afficher(`
      <div class="fin-s">
        <span class="fin-s__coche">${icon("coche")}</span>
        <h2 class="affiche fin-s__titre" tabindex="-1" data-titre>Merci !</h2>
        <p>Ton avis aide l'équipe à préparer la suite. Belle nuit et à demain !</p>
        <p class="recompense-s"><span>${icon("eclair")} +${res.recompense.xp} XP</span><span><span class="jeton" aria-hidden="true"></span> +${res.recompense.jetons} jetons</span></p>
        <div class="actions-s" style="grid-template-columns:1fr">
          <a class="btn btn--sodium btn--bloc" href="tableau-de-bord.html">Voir ma carte</a>
          <a class="btn btn--contour btn--bloc" href="passeport.html">Partager mon passeport</a>
        </div>
      </div>`);
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
  }

  /* ======================================================================
     Questions
     ====================================================================== */
  function champ(q) {
    const v = etat.reponses[q.id];
    switch (q.type) {
      case "echelle": return `
        <div class="vumetre-s" role="radiogroup" aria-labelledby="titre-${q.id}" ${v ? `data-valeur="${v}"` : ""} data-vumetre>
          ${q.libelles.map((lib, i) => `
            <label class="niveau-s${v && i < v ? " is-allume" : ""}" style="--n:${i}">
              <input type="radio" name="${q.id}" value="${i + 1}" ${Number(v) === i + 1 ? "checked" : ""}>
              <span class="niveau-s__barre" aria-hidden="true"></span>
              <span class="niveau-s__lib">${esc(lib)}</span>
            </label>`).join("")}
        </div>
        <p class="vumetre-s__resume" aria-hidden="true" data-resume>${v ? esc(q.libelles[v - 1]) : ""}</p>`;

      case "artiste": return q.choix.length ? `
        <div class="options-s" role="radiogroup" aria-labelledby="titre-${q.id}">
          ${[...q.choix, { id: "aucun", nom: "Je n'ai pas de préféré", scene: "" }].map((a) => `
            <label class="option-s">
              <input type="radio" name="${q.id}" value="${esc(a.id)}" ${v === a.id ? "checked" : ""}>
              <span class="option-s__corps"><span class="option-s__marque" aria-hidden="true"></span>
                <span>${esc(a.nom)}${a.scene ? `<small>${esc(a.scene)}</small>` : ""}</span>
                ${a.vu ? `<span class="vu-s">Vu</span>` : ""}</span>
            </label>`).join("")}
        </div>` : `<p class="texte-clair">Aucun concert n'a encore eu lieu ce jour-là. Tu peux passer cette question.</p>`;

      case "multi": {
        const choisis = Array.isArray(v) ? v : [];
        return `
          <div class="options-s options-s--multi" role="group" aria-labelledby="titre-${q.id}">
            ${q.choix.map((c) => `
              <label class="option-s">
                <input type="checkbox" name="${q.id}" value="${esc(c)}" ${choisis.includes(c) ? "checked" : ""}
                  ${!choisis.includes(c) && choisis.length >= q.max ? "disabled" : ""}>
                <span class="option-s__corps"><span class="option-s__marque" aria-hidden="true"></span>${esc(c)}</span>
              </label>`).join("")}
          </div>
          <p class="options-s__note" data-note>${choisis.length}/${q.max} choix</p>`;
      }

      case "attente": {
        const val = v && typeof v === "object" ? v : {};
        return `
          <div class="attente-s">
            ${q.points.map((p, i) => `
              <fieldset class="attente-s__ligne">
                <legend>${esc(p)}</legend>
                <div class="attente-s__choix">
                  ${q.niveaux.map((n, k) => `
                    <label class="puce-s puce-s--${k}"><input type="radio" name="att-${i}" value="${k}" data-point="${esc(p)}" ${val[p] === k ? "checked" : ""}><span>${esc(n)}</span></label>`).join("")}
                  <label class="puce-s puce-s--na"><input type="radio" name="att-${i}" value="na" data-point="${esc(p)}" ${val[p] === "na" ? "checked" : ""}><span>Pas utilisé</span></label>
                </div>
              </fieldset>`).join("")}
          </div>`;
      }

      case "nps": return `
        <div class="nps-s" role="radiogroup" aria-labelledby="titre-${q.id}">
          ${Array.from({ length: 11 }, (_, n) => `
            <label class="puce-s"><input type="radio" name="${q.id}" value="${n}" ${v === n ? "checked" : ""} aria-label="${n} sur 10"><span>${n}</span></label>`).join("")}
        </div>
        <p class="nps-s__bornes"><span>0 : ${esc(q.bornes[0])}</span><span>10 : ${esc(q.bornes[1])}</span></p>`;

      case "texte": return `
        <label class="sr-only" for="champ-${q.id}">${esc(q.titre)}</label>
        <textarea class="texte-s" id="champ-${q.id}" name="${q.id}" maxlength="${q.max}" aria-describedby="aide-${q.id} compteur-${q.id}">${esc(v || "")}</textarea>
        <p class="texte-s__compteur" id="compteur-${q.id}" data-compteur-texte>${(v || "").length}/${q.max}</p>`;
    }
    return "";
  }

  function ecranQuestion(i, retour = false) {
    etat.index = i;
    const q = Q[i];
    const dernier = i === Q.length - 1;
    afficher(`
      <fieldset class="question-s">
        <legend class="question-s__legende" tabindex="-1" data-titre>
          <span class="question-s__num">Question ${i + 1} sur ${Q.length}${q.obligatoire ? "" : ` <span class="question-s__optionnel">(facultative)</span>`}</span>
          <span class="affiche question-s__titre" id="titre-${q.id}">${esc(q.titre)}</span>
        </legend>
        ${q.aide ? `<p class="question-s__aide" id="aide-${q.id}">${esc(q.aide)}</p>` : ""}
        ${champ(q)}
      </fieldset>
      <p class="erreur-s" role="alert" data-erreur></p>
      <div class="actions-s">
        <button class="btn btn--contour" type="button" data-precedent aria-label="Question précédente">${icon("retour")}</button>
        <button class="btn btn--sodium btn--lg" type="submit" ${etat.envoi ? "aria-busy=\"true\"" : ""}>${dernier ? "Envoyer" : "Suivant"}</button>
        ${!q.obligatoire && !aRepondu(q) ? `<button class="lien-fort passer-s" type="button" data-passer>Passer cette question</button>` : ""}
      </div>`, retour);
  }

  /* ---------- Saisie ---------- */
  ecran.addEventListener("change", (e) => {
    const q = Q[etat.index];
    if (!q) return;
    const t = e.target;
    if (q.type === "echelle") {
      const val = Number(t.value);
      etat.reponses[q.id] = val;
      const zone = $("[data-vumetre]");
      zone.dataset.valeur = val;
      $$(".niveau-s", zone).forEach((n, k) => n.classList.toggle("is-allume", k < val));
      $("[data-resume]").textContent = q.libelles[val - 1];
      if (navigator.vibrate) navigator.vibrate(15);
    } else if (q.type === "artiste") {
      etat.reponses[q.id] = t.value;
    } else if (q.type === "multi") {
      const choisis = $$(`input[name="${q.id}"]:checked`).map((c) => c.value);
      etat.reponses[q.id] = choisis;
      $$(`input[name="${q.id}"]`).forEach((c) => (c.disabled = !c.checked && choisis.length >= q.max));
      $("[data-note]").textContent = `${choisis.length}/${q.max} choix${choisis.length >= q.max ? ", maximum atteint" : ""}`;
    } else if (q.type === "attente") {
      const val = { ...(etat.reponses[q.id] || {}) };
      val[t.dataset.point] = t.value === "na" ? "na" : Number(t.value);
      etat.reponses[q.id] = val;
    } else if (q.type === "nps") {
      etat.reponses[q.id] = Number(t.value);
    }
    $("[data-erreur]").textContent = "";
    const passer = $("[data-passer]");
    if (passer && aRepondu(q)) passer.remove();
    sauver();
  });

  ecran.addEventListener("input", (e) => {
    const q = Q[etat.index];
    if (!q || q.type !== "texte") return;
    etat.reponses[q.id] = e.target.value;
    const c = $("[data-compteur-texte]");
    c.textContent = `${e.target.value.length}/${q.max}`;
    c.classList.toggle("is-limite", e.target.value.length >= q.max - 20);
    sauver();
  });

  /* ---------- Navigation ---------- */
  async function suivant() {
    if (etat.index === -1) { ecranQuestion(0); return; }
    const q = Q[etat.index];
    if (q.obligatoire && !aRepondu(q)) {
      $("[data-erreur]").innerHTML = `${icon("alerte")} Choisis une réponse pour continuer.`;
      return;
    }
    if (etat.index < Q.length - 1) { ecranQuestion(etat.index + 1); return; }
    await envoyer();
  }

  async function envoyer() {
    if (etat.envoi) return;
    etat.envoi = true;
    const bouton = $("[type=submit]", ecran);
    bouton?.setAttribute("aria-busy", "true");
    let res;
    try {
      res = await api.envoyerSondage({ nuit: etat.s.nuit, reponses: etat.reponses, forcer: etat.forcer });
    } catch (e) {
      res = { ok: false, erreur: "reseau" };
    }
    etat.envoi = false;
    bouton?.removeAttribute("aria-busy");
    if (res.ok) { ecranFin(res); return; }
    if (res.erreur === "incomplet") {
      ecranQuestion(Q.findIndex((x) => x.id === res.question), true);
      $("[data-erreur]").innerHTML = `${icon("alerte")} Il manque une réponse ici.`;
      return;
    }
    const messages = {
      reseau: "Envoi impossible pour l'instant. Tes réponses sont gardées : réessaie dans un moment.",
      ferme: "Le sondage est fermé pour cette nuit.",
      deja: "Tu as déjà répondu ce soir.",
      perime: "La soirée a changé, recharge la page."
    };
    $("[data-erreur]").innerHTML = `${icon("alerte")} ${messages[res.erreur] || "Envoi impossible."}`;
  }

  ecran.addEventListener("submit", (e) => { e.preventDefault(); suivant(); });
  ecran.addEventListener("click", (e) => {
    if (e.target.closest("[data-precedent]")) {
      etat.index > 0 ? ecranQuestion(etat.index - 1, true) : ecranAccueil();
    } else if (e.target.closest("[data-passer]")) {
      delete etat.reponses[Q[etat.index].id];
      sauver();
      suivant();
    } else if (e.target.closest("[data-forcer]")) {
      etat.forcer = true;
      ecranAccueil();
    }
  });
  // Entrée dans la zone de texte = retour à la ligne, pas envoi
  ecran.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "TEXTAREA") e.stopPropagation();
  });

  ecranAccueil();
});
