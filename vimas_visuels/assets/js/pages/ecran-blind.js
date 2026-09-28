/* ==========================================================================
   Page 30 — Écran géant : plateau du blind test
   L'état vient de App.api.blindTestDirect() (même source que les téléphones et la régie).
   Cet écran ne fait qu'afficher cet état et jouer l'extrait.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api } = App;

  const scene = $("[data-scene]");
  const plateau = $("[data-plateau]");
  App.ecran.echelle(scene);
  App.ecran.curseurAuto();

  const cfg = await App.data.get("blindTest");

  /* ======================================================================
     Horloge de la manche : ancre (début), pause, saut
     ====================================================================== */
  const params = new URLSearchParams(location.search);
  const H = App.blindHorloge;
  const DUREE_MANCHE = 12 * 60000;
  // ?demo=1 : nouvelle manche 20 s après l'ouverture, sauf si une manche de démo est déjà en cours
  if (params.get("demo")) {
    const h = H.lire();
    if (!h || H.etat(cfg).ecoule > DUREE_MANCHE) H.demarrer(20000);
  }
  const horloge = () => H.etat(cfg);

  const regie = {
    demarrer() { H.demarrer(5000); vueCle = ""; },
    pause() { H.pause(cfg); majPause(); },
    reprendre() { H.reprendre(cfg); majPause(); },
    basculerPause() { horloge().pauseDepuis === null ? regie.pause() : regie.reprendre(); },
    suivant() {
      if (etat && etat.phase !== "attente") H.avancer(cfg, etat.restant + 30);
      else H.avancer(cfg, Math.max(0, -horloge().ecoule));
    },
    recommencer() { H.effacer(); vueCle = ""; majPause(); }
  };
  function majPause() {
    const enPause = horloge().pauseDepuis !== null;
    $("[data-pause]").hidden = !enPause;
    scene.classList.toggle("is-pause", enPause);
    if (enPause) audio.stop();
  }

  // Commandes venant de la console de régie (page 24) sur le même poste
  App.ecran.canal("blind-test", (msg) => {
    const actions = { demarrer: regie.demarrer, pause: regie.pause, reprendre: regie.reprendre, suivant: regie.suivant, recommencer: regie.recommencer };
    if (msg && actions[msg.type]) actions[msg.type]();
  });

  /* ======================================================================
     Son : extraits synthétisés en démo (remplacés par de vrais fichiers ensuite)
     ====================================================================== */
  const audio = {
    ctx: null, analyseur: null, sortie: null, boucle: null, actif: true, cle: null,
    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sortie = this.ctx.createGain();
        this.sortie.gain.value = 0.35;
        this.analyseur = this.ctx.createAnalyser();
        this.analyseur.fftSize = 64;
        this.sortie.connect(this.analyseur).connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    note(freq, t, duree, onde, volume = 0.5) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = onde; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree * 0.95);
      o.connect(g).connect(this.sortie);
      o.start(t); o.stop(t + duree);
    },
    extrait(q, cle) {
      if (!this.ctx || !this.actif || this.cle === cle) return;
      this.stop();
      this.cle = cle;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
      const temps = 60 / q.tempo / 2;
      let debut = this.ctx.currentTime + 0.05;
      const jouerMesure = () => {
        q.motif.forEach((m, i) => {
          this.note(midi(m), debut + i * temps, temps, q.onde, 0.45);
          if (i % 2 === 0) this.note(midi(m - 24), debut + i * temps, temps * 1.8, "sine", 0.35);
        });
        debut += q.motif.length * temps;
      };
      jouerMesure();
      this.boucle = setInterval(() => {
        while (debut < this.ctx.currentTime + 1) jouerMesure();
      }, 400);
    },
    stop() { clearInterval(this.boucle); this.boucle = null; this.cle = null; },
    signal(type) {
      if (!this.ctx || !this.actif) return;
      const t = this.ctx.currentTime + 0.02;
      if (type === "tic") this.note(1320, t, 0.06, "square", 0.25);
      if (type === "bonne") [523, 659, 784, 1047].forEach((f, i) => this.note(f, t + i * 0.08, 0.3, "triangle", 0.5));
      if (type === "intro") [392, 523].forEach((f, i) => this.note(f, t + i * 0.12, 0.25, "square", 0.3));
      if (type === "fin") [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.note(f, t + i * 0.14, 0.4, "triangle", 0.5));
    }
  };

  App.ecran.boutonDemarrer($("[data-demarrer]"), () => audio.init());

  /* ======================================================================
     En-tête et QR
     ====================================================================== */
  const lienCourt = cfg.lienJeu.replace(/^https?:\/\//, "");
  try { $("[data-mini-qr]").innerHTML = App.qrSvg(cfg.lienJeu, { titre: "Rejoindre le blind test" }); } catch (e) { /* librairie absente */ }

  function majTete(e) {
    $("[data-connectes]").textContent = fmt.nombre(e.connectes);
    const enJeu = !["attente", "fin", "termine"].includes(e.phase);
    $("[data-progres]").hidden = !enJeu;
    if (enJeu) {
      $("[data-num]").textContent = `Question ${e.index + 1} / ${e.total}`;
      $("[data-pastilles]").innerHTML = Array.from({ length: e.total }, (_, i) =>
        `<i class="${i < e.index || (i === e.index && e.phase !== "question" && e.phase !== "intro") ? "is-fait" : i === e.index ? "is-actuel" : ""}"></i>`).join("");
    }
  }

  /* ======================================================================
     Vues
     ====================================================================== */
  const COULEURS_CONFETTIS = ["var(--sodium)", "var(--rose)", "var(--vert)", "var(--papier)", "#8FA6FF"];
  const mmss = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  function vueAttente(e) {
    let qr = "";
    try { qr = App.qrSvg(cfg.lienJeu, { niveau: "Q", titre: "QR pour jouer au blind test" }); } catch (err) { /* absent */ }
    plateau.innerHTML = `
      <div class="bt-vue vue-attente">
        <div>
          <h1 class="affiche vue-attente__titre">Blind<br>test</h1>
          <p class="vue-attente__heure">Ce soir à ${esc(fmt.heure(cfg.horaire))}, départ dans</p>
          <p class="vue-attente__compte" data-compte>${mmss(e.restant)}</p>
          <ol class="etapes-bt">
            <li><b>1</b> Ouvre le jeu</li>
            <li><b>2</b> Écoute l'extrait</li>
            <li><b>3</b> Réponds vite</li>
          </ol>
        </div>
        <div class="carte-qr">
          <p class="affiche carte-qr__titre">Joue avec ton téléphone</p>
          <div class="carte-qr__qr">${qr}</div>
          <p class="carte-qr__url">${esc(lienCourt)}</p>
        </div>
        <div class="eq vue-attente__eq" data-eq-attente></div>
      </div>`;
    App.eq($("[data-eq-attente]"), 90);
  }

  function vueIntro(e) {
    plateau.innerHTML = `
      <div class="bt-vue vue-intro">
        <p class="affiche vue-intro__num"><small>Question</small>${e.question.numero}</p>
        <p class="vue-intro__cat">${esc(e.question.categorie)}</p>
      </div>`;
    audio.signal("intro");
  }

  function vueQuestion(e) {
    const q = e.question;
    plateau.innerHTML = `
      <div class="bt-vue vue-question" data-vue-question>
        <div class="colonne-son">
          <div class="chrono" data-chrono role="timer" aria-label="Temps restant"><span class="chrono__s" data-chrono-s></span></div>
          <div class="platine" aria-hidden="true">
            <span class="platine__disque"></span>
            <canvas class="platine__visu" width="170" height="150" data-visu></canvas>
          </div>
        </div>
        <div class="colonne-jeu">
          <h1 class="question-texte"><small>${esc(q.categorie)}</small>${esc(q.question)}</h1>
          <ol class="reponses">
            ${q.choix.map((c, i) => `
              <li class="reponse" data-reponse="${i}">
                <span class="reponse__barre" data-barre></span>
                <span class="reponse__lettre" aria-hidden="true">${"ABCD"[i]}</span>
                <span class="reponse__texte">${esc(c)}</span>
                <span class="reponse__coche">${icon("coche")}</span>
                <span class="reponse__pct chiffres" data-pct></span>
              </li>`).join("")}
          </ol>
          <div class="jeu-pied" data-pied></div>
        </div>
      </div>`;
  }

  function piedQuestion() {
    $("[data-pied]").innerHTML = `
      <div class="recues">
        <p class="recues__txt"><strong class="chiffres" data-recues>0</strong> réponses reçues</p>
        <div class="recues__barre"><i data-recues-barre></i></div>
      </div>`;
  }

  function appliquerRevelation(e) {
    const vue = $("[data-vue-question]");
    if (!vue || vue.classList.contains("is-revelation")) return;
    const r = e.revelation;
    vue.classList.add("is-revelation");
    $$("[data-reponse]", vue).forEach((li, i) => {
      li.classList.toggle("is-bonne", i === r.bonne);
      $("[data-pct]", li).textContent = `${r.stats[i]} %`;
      requestAnimationFrame(() => { $("[data-barre]", li).style.width = `${r.stats[i]}%`; });
      if (i === r.bonne) li.setAttribute("aria-label", `Bonne réponse : ${e.question.choix[i]}, ${r.stats[i]} % du public`);
    });
    const chrono = $("[data-chrono]");
    chrono.classList.remove("is-urgent");
    chrono.classList.add("is-fini");
    $("[data-chrono-s]").innerHTML = icon("coche");
    $("[data-pied]").innerHTML = `
      <div class="solution">
        <p class="solution__lib">C'était</p>
        <p class="solution__titre">${esc(r.reponse)}</p>
        <p class="solution__anecdote">${esc(r.anecdote)}</p>
      </div>
      ${r.rapides.length ? `
      <div class="rapides">
        <span class="rapides__titre">Les plus rapides</span>
        ${r.rapides.map((p) => `
          <div class="rapide">${App.avatar(p.avatar, p.pseudo, "md")}
            <span class="rapide__pseudo">${esc(p.pseudo)}</span>
            <span class="rapide__temps">${p.temps.toFixed(1).replace(".", ",")} s</span>
          </div>`).join("")}
      </div>` : ""}`;
    audio.stop();
    audio.signal("bonne");
  }

  function vueClassement(e) {
    const avant = new Map((e.classementPrecedent || []).map((j) => [j.pseudo, j.rang]));
    plateau.innerHTML = `
      <div class="bt-vue vue-classement">
        <h1 class="affiche vue-classement__titre">Classement <span>après ${e.index + 1} questions</span></h1>
        <ol class="lignes-bt">
          ${e.classement.map((j) => {
            const a = avant.get(j.pseudo);
            const evo = !avant.size ? "" : a === undefined ? "is-nouveau" : a > j.rang ? "is-monte" : a < j.rang ? "is-descend" : "";
            return `
              <li class="ligne-bt">
                <span class="ligne-bt__rang">${j.rang}</span>
                ${App.avatar(j.avatar, j.pseudo, "md")}
                <span class="ligne-bt__pseudo">${esc(j.pseudo)}</span>
                <span class="ligne-bt__points chiffres">${fmt.nombre(j.points)} <small>pts</small></span>
                <span class="ligne-bt__evo ${evo}">${evo === "is-nouveau" ? "Nouveau" : ""}</span>
              </li>`;
          }).join("")}
        </ol>
      </div>`;
  }

  function vueFin(e) {
    const [p1, p2, p3] = e.podium;
    const marche = (j, n) => j ? `
      <li class="marche-bt marche-bt--${n}">
        ${n === 1 ? '<span class="couronne-bt" aria-hidden="true"></span>' : ""}
        ${App.avatar(j.avatar, j.pseudo, "lg")}
        <span class="marche-bt__pseudo">${esc(j.pseudo)}</span>
        <span class="marche-bt__points chiffres">${fmt.nombre(j.points)} pts</span>
        <span class="marche-bt__bloc" aria-hidden="true">${n}</span>
      </li>` : "";
    plateau.innerHTML = `
      <div class="bt-vue vue-fin">
        <div>
          <h1 class="affiche vue-fin__titre">Bravo à tous !</h1>
          <ol class="podium-bt" aria-label="Podium">${marche(p1, 1)}${marche(p2, 2)}${marche(p3, 3)}</ol>
        </div>
        <div class="fin-cote">
          <p class="affiche fin-cote__titre">Top 10</p>
          <ol class="suite-bt">
            ${e.podium.slice(3).map((j) => `<li><b>${j.rang}</b><span>${esc(j.pseudo)}</span><span class="chiffres">${fmt.nombre(j.points)}</span></li>`).join("")}
          </ol>
          <p class="fin-lots">Le podium retire son lot au stand Vimas Fest. Le top 10 gagne le badge Oreille d'or.</p>
        </div>
      </div>`;
    confettis();
    audio.stop();
    audio.signal("fin");
  }

  function confettis() {
    if (App.reduceMotion) return;
    const pluie = $("[data-pluie]");
    pluie.innerHTML = Array.from({ length: 90 }, (_, i) =>
      `<i style="--x:${Math.random() * 100}%;--c:${COULEURS_CONFETTIS[i % 5]};--r:${Math.random() * 2.5}s;--d:${3 + Math.random() * 3}s;--dx:${(Math.random() - 0.5) * 300}px;--rot:${360 + Math.random() * 900}deg"></i>`).join("");
    setTimeout(() => { pluie.innerHTML = ""; }, 9000);
  }

  /* ======================================================================
     Visualiseur audio (ou égaliseur simulé si le son est coupé)
     ====================================================================== */
  function dessinerVisu() {
    const c = $("[data-visu]");
    if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    const n = 14, larg = c.width / n;
    let valeurs;
    if (audio.analyseur && audio.boucle && horloge().pauseDepuis === null) {
      const data = new Uint8Array(audio.analyseur.frequencyBinCount);
      audio.analyseur.getByteFrequencyData(data);
      valeurs = Array.from({ length: n }, (_, i) => data[i + 1] / 255);
    } else {
      const t = Date.now() / 180;
      valeurs = Array.from({ length: n }, (_, i) => horloge().pauseDepuis !== null || etat?.phase !== "question" ? 0.08 : 0.25 + 0.7 * Math.abs(Math.sin(t + i * 0.9) * Math.cos(t / 3 + i)));
    }
    g.fillStyle = "#F9A209";
    valeurs.forEach((v, i) => {
      const h = Math.max(6, v * c.height);
      g.fillRect(i * larg + 2, c.height - h, larg - 4, h);
    });
  }

  /* ======================================================================
     Boucle principale
     ====================================================================== */
  let etat = null, vueCle = "", dernierTic = null, derniereReussite = Date.now();
  let dernierId = horloge().id;

  async function tick() {
    let e;
    try {
      const h = horloge();
      e = await api.blindTestDirect({ ecoule: h.ecoule });
      derniereReussite = Date.now();
    } catch (err) {
      console.warn(err);
    }
    const horsLigne = Date.now() - derniereReussite > 10000;
    $("[data-etat]").classList.toggle("is-horsligne", horsLigne);
    $("[data-etat-texte]").textContent = horsLigne ? "Connexion perdue" : horloge().pauseDepuis !== null ? "En pause" : "En direct";
    if (!e) return;
    majPause();
    if (horloge().id !== dernierId) { dernierId = horloge().id; vueCle = ""; }
    etat = e;
    scene.dataset.phase = e.phase;
    majTete(e);

    // Changement de vue seulement quand la phase ou la question change
    const cle = e.phase === "revelation" ? `question-${e.index}` : `${e.phase}-${e.index}`;
    if (cle !== vueCle) {
      const ancienne = vueCle;
      vueCle = cle;
      if (e.phase === "attente") { audio.stop(); vueAttente(e); }
      else if (e.phase === "intro") { audio.stop(); vueIntro(e); }
      else if (e.phase === "question") { vueQuestion(e); piedQuestion(); }
      else if (e.phase === "revelation" && !ancienne.startsWith("question")) { vueQuestion(e); }
      else if (e.phase === "classement") vueClassement(e);
      else if (e.phase === "fin" || e.phase === "termine") vueFin(e);
    }

    // Mises à jour fines
    if (e.phase === "attente") {
      const el = $("[data-compte]");
      if (el) el.textContent = e.restant > 3600000 ? App.duree(e.restant) : mmss(e.restant);
    }
    if (e.phase === "question") {
      if (horloge().pauseDepuis === null) audio.extrait(e.question, `q${e.index}`);
      const chrono = $("[data-chrono]");
      const s = Math.ceil(e.restant / 1000);
      chrono.style.setProperty("--p", (e.restant / e.duree).toFixed(3));
      chrono.classList.toggle("is-urgent", s <= 5);
      $("[data-chrono-s]").textContent = s;
      if (s <= 5 && s !== dernierTic && horloge().pauseDepuis === null) { dernierTic = s; audio.signal("tic"); }
      $("[data-recues]").textContent = fmt.nombre(e.reponsesRecues);
      $("[data-recues-barre]").style.width = `${Math.round((e.reponsesRecues / e.connectes) * 100)}%`;
    }
    if (e.phase === "revelation") appliquerRevelation(e);
  }

  /* ---------- Clavier régie ---------- */
  document.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    if (k === " ") { ev.preventDefault(); regie.basculerPause(); }
    else if (ev.key === "ArrowRight") regie.suivant();
    else if (k === "d") regie.demarrer();
    else if (k === "r") regie.recommencer();
    else if (k === "f") App.ecran.pleinEcran();
    else if (k === "h") $("[data-aide]").hidden = !$("[data-aide]").hidden;
    else if (k === "m") {
      audio.actif = !audio.actif;
      if (!audio.actif) audio.stop();
      App.toast(audio.actif ? "Son activé" : "Son coupé");
    }
    else if (ev.key === "Escape") $("[data-aide]").hidden = true;
    tick();
  });

  await tick();
  setInterval(tick, 250);
  (function anime() { dessinerVisu(); requestAnimationFrame(anime); })();
});
