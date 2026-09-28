/* ==========================================================================
   Page 30 — Écran géant : plateau du blind test

   Démo (?mock=1) : l'état vient de App.api.blindTestDirect() (horloge locale,
   la régie se fait au clavier : D, Espace, →, R).

   Serveur (étape 5.2) : c'est la RÉGIE (console, étape 6) qui lance la manche
   et chaque question ; cet écran ne pilote rien. Il lit quiz_board (un appel,
   App.serveurApi.blindPlateau) et remet le chrono à l'heure localement :
     · au signal du temps réel : game_state (manche lancée, question lancée par
       admin_quiz_next), events raid / quiz (manche close) ;
     · une fois à la fin du chrono (+2,5 s), pour la révélation ;
     · toutes les 4 s pendant une question ouverte (réponses reçues) ;
     · toutes les 60 s sinon (20 s si le canal est coupé), rien onglet caché.
   Après la révélation (10 s), le top 10 de la manche jusqu'à la question
   suivante. Le boss (une figure de la musique) : ses PV ne bougent qu'une fois
   le chrono fini, comme sur les téléphones.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api } = App;
  const SERVEUR = !App.mock;

  const scene = $("[data-scene]");
  const plateau = $("[data-plateau]");
  App.ecran.echelle(scene);
  App.$$("[data-eq]").forEach((el) => App.eq(el, Number(el.dataset.eq)));
  App.ecran.curseurAuto();

  const cfg = await App.data.get("blindTest");
  const lienJeu = new URL("../blind-test.html", location.href).href;
  const lienCourt = lienJeu.replace(/^https?:\/\//, "");
  $$("[data-demo]").forEach((el) => { el.hidden = SERVEUR; });

  /* ======================================================================
     Démo : horloge de la manche (ancre, pause, saut)
     ====================================================================== */
  const params = new URLSearchParams(location.search);
  const H = App.blindHorloge;
  const DUREE_MANCHE = 12 * 60000;
  // ?demo=1 : nouvelle manche 20 s après l'ouverture, sauf si une manche de démo est déjà en cours
  if (!SERVEUR && params.get("demo")) {
    const h = H.lire();
    if (!h || H.etat(cfg).ecoule > DUREE_MANCHE) H.demarrer(20000);
  }
  const horloge = () => H.etat(cfg);
  const enPause = () => !SERVEUR && horloge().pauseDepuis !== null;

  const regie = {
    demarrer() { H.demarrer(5000); vueCle = ""; },
    pause() { H.pause(cfg); majPause(); },
    reprendre() { H.reprendre(cfg); majPause(); },
    basculerPause() { enPause() ? regie.reprendre() : regie.pause(); },
    suivant() {
      if (etat && etat.phase !== "attente") H.avancer(cfg, etat.restant + 30);
      else H.avancer(cfg, Math.max(0, -horloge().ecoule));
    },
    recommencer() { H.effacer(); vueCle = ""; majPause(); }
  };
  function majPause() {
    const p = enPause();
    $("[data-pause]").hidden = !p;
    scene.classList.toggle("is-pause", p);
    if (p) audio.stop();
  }

  // Démo : commandes de la console de régie du même poste
  if (!SERVEUR) {
    App.ecran.canal("blind-test", (msg) => {
      const actions = { demarrer: regie.demarrer, pause: regie.pause, reprendre: regie.reprendre, suivant: regie.suivant, recommencer: regie.recommencer };
      if (msg && actions[msg.type]) actions[msg.type]();
    });
  }

  /* ======================================================================
     Son : extraits synthétisés en démo, vrai fichier (audio_url) en serveur
     ====================================================================== */
  const audio = {
    ctx: null, analyseur: null, sortie: null, boucle: null, actif: true, cle: null, el: null,
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
    /* Serveur : l'extrait de la base, repris là où en est la question (un
       écran rechargé en pleine question retombe au bon endroit) */
    fichier(url, debutS, ecouleMs, cle) {
      if (!this.actif || !url || this.cle === cle) return;
      this.stop();
      this.cle = cle;
      const a = this.el || (this.el = new Audio());
      a.preload = "auto";
      a.src = url;
      const depart = Date.now();
      const aller = () => {
        try { a.currentTime = debutS + (ecouleMs + Date.now() - depart) / 1000; } catch (e) { /* pas encore prêt */ }
        a.play().catch(() => { /* son bloqué : bouton « Lancer » pas encore cliqué */ });
      };
      if (a.readyState >= 1) aller(); else a.addEventListener("loadedmetadata", aller, { once: true });
    },
    stop() {
      clearInterval(this.boucle); this.boucle = null; this.cle = null;
      if (this.el) this.el.pause();
    },
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
  try { $("[data-mini-qr]").innerHTML = App.qrSvg(lienJeu, { titre: "Rejoindre le blind test" }); } catch (e) { /* librairie absente */ }

  function majTete(e) {
    $("[data-connectes]").textContent = fmt.nombre(e.connectes || 0);
    $("[data-connectes-lib]").textContent = e.connectes > 1 ? "joueurs" : "joueur";
    const enJeu = !["attente", "salle", "fin", "termine"].includes(e.phase);
    $("[data-progres]").hidden = !enJeu;
    if (enJeu) {
      $("[data-num]").textContent = `Question ${e.index + 1} / ${e.total}`;
      $("[data-pastilles]").innerHTML = Array.from({ length: e.total }, (_, i) =>
        `<i class="${i < e.index || (i === e.index && e.phase !== "question" && e.phase !== "intro") ? "is-fait" : i === e.index ? "is-actuel" : ""}"></i>`).join("");
    }
  }

  /* ======================================================================
     Le boss : PV connus = dernière valeur donnée chrono fini
     ====================================================================== */
  let pvConnus = null;
  function noterBoss(boss) {
    if (boss && boss.pvRestants !== null && boss.pvRestants !== undefined) pvConnus = { restants: boss.pvRestants, vaincu: boss.vaincu };
  }
  function carteBoss(boss, grand = false) {
    if (!boss) return "";
    const pv = pvConnus || { restants: boss.pvMax, vaincu: false };
    const part = boss.pvMax ? Math.max(0, Math.min(1, pv.restants / boss.pvMax)) : 1;
    return `
      <div class="boss-bt${grand ? " boss-bt--grand" : ""}${pv.vaincu ? " is-vaincu" : ""}" data-boss>
        ${App.photo({ nom: boss.nom, photo: boss.photo }, grand ? "lg" : "md")}
        <div class="boss-bt__corps">
          <p class="boss-bt__lib">${pv.vaincu ? "Conquis par le public !" : "Le boss de la manche"}</p>
          <p class="affiche boss-bt__nom">${esc(boss.nom)}</p>
          <div class="boss-bt__barre" role="img" aria-label="${fmt.nombre(pv.restants)} points de vie sur ${fmt.nombre(boss.pvMax)}"><i style="width:${(part * 100).toFixed(1)}%"></i></div>
          <p class="boss-bt__pv chiffres">${fmt.nombre(pv.restants)} / ${fmt.nombre(boss.pvMax)} PV</p>
        </div>
      </div>`;
  }
  function majBoss(e) {
    const el = $("[data-boss]", plateau);
    if (el && e.boss) el.outerHTML = carteBoss(e.boss, el.classList.contains("boss-bt--grand"));
  }

  /* ======================================================================
     Vues
     ====================================================================== */
  const COULEURS_CONFETTIS = ["var(--sodium)", "var(--rose)", "var(--vert)", "var(--papier)", "#FF9A85"];
  const mmss = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const compte = (ms) => (ms > 3600000 ? App.duree(ms) : mmss(ms));

  function carteQr() {
    let qr = "";
    try { qr = App.qrSvg(lienJeu, { niveau: "Q", titre: "QR pour jouer au blind test" }); } catch (err) { /* absent */ }
    return `
      <div class="carte-qr">
        <p class="affiche carte-qr__titre">Joue avec ton téléphone</p>
        <div class="carte-qr__qr">${qr}</div>
        <p class="carte-qr__url">${esc(lienCourt)}</p>
      </div>`;
  }

  function vueAttente(e) {
    // Serveur : restant nul = l'heure du site est passée et la régie n'a pas encore lancé
    const aHeure = e.restant !== null && e.restant !== undefined;
    plateau.innerHTML = `
      <div class="bt-vue vue-attente">
        <div>
          <h1 class="affiche vue-attente__titre">Blind<br>test</h1>
          <p class="vue-attente__heure">${aHeure ? `Aujourd'hui à ${esc(fmt.heure(cfg.horaire))}, départ dans` : "Prochaine manche très bientôt"}</p>
          <p class="vue-attente__compte" data-compte>${aHeure ? compte(e.restant) : ""}</p>
          <ol class="etapes-bt">
            <li><b>1</b> Ouvre le jeu</li>
            <li><b>2</b> Écoute l'extrait</li>
            <li><b>3</b> Réponds vite</li>
          </ol>
        </div>
        ${carteQr()}
        <div class="eq vue-attente__eq" data-eq-attente></div>
      </div>`;
    App.eq($("[data-eq-attente]"), 90);
  }

  /* Serveur : la régie a lancé la manche, la 1re question n'est pas encore partie */
  function vueSalle(e) {
    plateau.innerHTML = `
      <div class="bt-vue vue-attente vue-salle">
        <div>
          <h1 class="affiche vue-attente__titre">Ça<br>commence !</h1>
          <p class="vue-attente__heure">Sors ton téléphone, la première question arrive.</p>
          ${carteBoss(e.boss, true)}
        </div>
        ${carteQr()}
        <div class="eq vue-attente__eq" data-eq-attente></div>
      </div>`;
    App.eq($("[data-eq-attente]"), 90);
    audio.signal("intro");
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
      <div class="bt-vue vue-question${e.boss ? " avec-boss" : ""}" data-vue-question>
        <div class="colonne-son">
          <div class="chrono" data-chrono role="timer" aria-label="Temps restant"><span class="chrono__s" data-chrono-s></span></div>
          <canvas class="visu" width="400" height="120" data-visu aria-hidden="true"></canvas>
          ${carteBoss(e.boss)}
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
        <p class="recues__txt"><strong class="chiffres" data-recues>0</strong> <span data-recues-lib>réponse reçue</span></p>
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
      $("[data-pct]", li).textContent = `${r.stats[i] || 0} %`;
      requestAnimationFrame(() => { $("[data-barre]", li).style.width = `${r.stats[i] || 0}%`; });
      if (i === r.bonne) li.setAttribute("aria-label", `Bonne réponse : ${e.question.choix[i]}, ${r.stats[i] || 0} % du public`);
    });
    const chrono = $("[data-chrono]");
    chrono.classList.remove("is-urgent");
    chrono.classList.add("is-fini");
    $("[data-chrono-s]").innerHTML = icon("coche");
    $("[data-pied]").innerHTML = `
      <div class="solution${r.pochette ? " solution--pochette" : ""}">
        ${r.pochette ? App.photo({ nom: r.reponse, photo: r.pochette }, "lg") : ""}
        <div>
          <p class="solution__lib">C'était</p>
          <p class="solution__titre">${esc(r.reponse)}</p>
          ${r.anecdote ? `<p class="solution__anecdote">${esc(r.anecdote)}</p>` : ""}
        </div>
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
    majBoss(e);
    audio.stop();
    audio.signal("bonne");
  }

  let dernierClassement = [];
  function vueClassement(e) {
    const precedent = e.classementPrecedent || dernierClassement;
    const avant = new Map(precedent.map((j) => [j.pseudo, j.rang]));
    plateau.innerHTML = `
      <div class="bt-vue vue-classement">
        <h1 class="affiche vue-classement__titre">Classement <span>après ${e.index + 1} question${e.index ? "s" : ""}</span></h1>
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
    dernierClassement = e.classement;
  }

  function vueFin(e) {
    const [p1, p2, p3] = e.podium;
    const pv = pvConnus || {};
    const titre = e.boss ? (pv.vaincu ? `${esc(e.boss.nom)} conquis !` : `${esc(e.boss.nom)} résiste !`) : "Bravo à tous !";
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
          <h1 class="affiche vue-fin__titre">${titre}</h1>
          ${e.podium.length ? `<ol class="podium-bt" aria-label="Podium">${marche(p1, 1)}${marche(p2, 2)}${marche(p3, 3)}</ol>`
            : `<p class="vue-attente__heure">Personne n'a répondu cette fois. Rendez-vous à la prochaine manche !</p>`}
        </div>
        <div class="fin-cote">
          <p class="affiche fin-cote__titre">Top 10</p>
          <ol class="suite-bt">
            ${e.podium.slice(3).map((j) => `<li><b>${j.rang}</b><span>${esc(j.pseudo)}</span><span class="chiffres">${fmt.nombre(j.points)}</span></li>`).join("")}
          </ol>
          <p class="fin-lots">Le podium retire son lot au stand Vimas Quest. Le top 10 gagne le badge Oreille d'or.</p>
        </div>
      </div>`;
    // La fête seulement pour une manche vue en direct (pas pour un écran rallumé après)
    if (vueEnDirect) confettis();
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
     Visualiseur audio (ou égaliseur simulé : fichier, son coupé)
     ====================================================================== */
  function dessinerVisu() {
    const c = $("[data-visu]");
    if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    const n = 24, larg = c.width / n;
    let valeurs;
    if (audio.analyseur && audio.boucle && !enPause()) {
      const data = new Uint8Array(audio.analyseur.frequencyBinCount);
      audio.analyseur.getByteFrequencyData(data);
      valeurs = Array.from({ length: n }, (_, i) => data[i + 1] / 255);
    } else {
      const t = Date.now() / 180;
      valeurs = Array.from({ length: n }, (_, i) => enPause() || etat?.phase !== "question" ? 0.08 : 0.25 + 0.7 * Math.abs(Math.sin(t + i * 0.9) * Math.cos(t / 3 + i)));
    }
    g.fillStyle = "#FFC72C";
    valeurs.forEach((v, i) => {
      const h = Math.max(6, v * c.height);
      g.fillRect(i * larg + 2, c.height - h, larg - 4, h);
    });
  }

  /* ======================================================================
     Serveur : le plateau lu en base, remis à l'heure localement
     ====================================================================== */
  const REVELATION_MS = 10000;   // puis le classement, jusqu'à la question suivante
  let lu = null, vueEnDirect = !SERVEUR;   // démo : toujours la fête

  function etatServeur() {
    if (!lu) return null;
    if (!lu.session) {
      const reste = App.dateFestival(App.jourFestival(), cfg.horaire).getTime() - App.maintenant().getTime();
      return { phase: "attente", index: -1, total: 0, connectes: 0, restant: reste > 0 ? reste : null };
    }
    const s = lu.session;
    const e = { index: s.index, total: s.total, connectes: s.participants, boss: lu.boss };
    if (s.statut === "terminee") return { ...e, phase: "fin", podium: lu.classement || [] };
    const q = lu.question;
    if (!q) return { ...e, phase: "salle" };
    const ecoule = q.ecoule + (Date.now() - lu.lu);
    e.question = { numero: q.numero, categorie: q.categorie, question: q.question, choix: q.choix };
    e.duree = q.duree;
    if (!q.fermee) {
      return { ...e, phase: "question", restant: Math.max(0, q.duree - ecoule), ecoule, reponsesRecues: q.recues, audio: q.audio, audioDebut: q.audioDebut };
    }
    e.revelation = q.revelation;
    if (ecoule < q.duree + 2000 + REVELATION_MS || !(lu.classement && lu.classement.length)) return { ...e, phase: "revelation" };
    return { ...e, phase: "classement", classement: lu.classement };
  }

  let enLecture = false, derniereLecture = 0, lectureProgrammee = null, canalOk = false;
  async function relire() {
    if (enLecture) return;
    enLecture = true;
    try {
      lu = await App.serveurApi.blindPlateau();
      derniereLecture = Date.now();
      derniereReussite = Date.now();
      noterBoss(lu.boss);
      if (lu.session && lu.session.statut === "en_cours") vueEnDirect = true;
    } catch (err) {
      console.warn(err);
    } finally {
      enLecture = false;
    }
  }
  /* Signal : une relecture, au plus une par seconde */
  function programmer(delai = 300) {
    if (lectureProgrammee) return;
    const attente = Math.max(delai, 1000 - (Date.now() - derniereLecture));
    lectureProgrammee = setTimeout(async () => {
      lectureProgrammee = null;
      if (document.hidden) return;
      await relire();
      tick();
    }, attente);
  }
  /* Cadence selon ce qui est à l'écran (appelée à chaque tick) */
  let lectureFin = { index: -1, a: 0 };
  function cadence(e) {
    const depuis = Date.now() - derniereLecture;
    if (!e || document.hidden) return;
    if (e.phase === "question") {
      // Fin du chrono : on relit pour la révélation (la base ferme à +2 s)
      if (e.ecoule > e.duree + 2500) {
        if (lectureFin.index !== e.index || Date.now() - lectureFin.a > 1500) {
          lectureFin = { index: e.index, a: Date.now() };
          programmer(0);
        }
      } else if (depuis > 4000) programmer(0);   // réponses reçues
      return;
    }
    if (depuis > (canalOk ? 60000 : 20000)) programmer(0);
  }

  /* ======================================================================
     Boucle principale (4 fois par seconde, sans requête en mode serveur)
     ====================================================================== */
  let etat = null, vueCle = "", dernierTic = null, derniereReussite = Date.now();
  let dernierId = SERVEUR ? null : horloge().id;

  async function tick() {
    let e;
    if (SERVEUR) {
      e = etatServeur();
    } else {
      try {
        e = await api.blindTestDirect({ ecoule: horloge().ecoule });
        derniereReussite = Date.now();
      } catch (err) {
        console.warn(err);
      }
    }
    // Serveur : un plateau calme ne relit qu'une fois par minute, il n'est pas hors ligne pour autant
    const horsLigne = Date.now() - derniereReussite > (SERVEUR ? (canalOk ? 90000 : 30000) : 10000);
    $("[data-etat]").classList.toggle("is-horsligne", horsLigne);
    $("[data-etat-texte]").textContent = horsLigne ? "Connexion perdue" : enPause() ? "En pause" : "En direct";
    if (SERVEUR) cadence(e);
    if (!e) return;
    majPause();
    if (!SERVEUR && horloge().id !== dernierId) { dernierId = horloge().id; vueCle = ""; }
    if (SERVEUR && lu.session && lu.session.id !== dernierId) { dernierId = lu.session.id; vueCle = ""; pvConnus = null; noterBoss(lu.boss); dernierClassement = []; }
    etat = e;
    scene.dataset.phase = e.phase === "salle" ? "attente" : e.phase;
    majTete(e);

    // Changement de vue seulement quand la phase ou la question change
    const cle = e.phase === "revelation" ? `question-${e.index}` : `${e.phase}-${e.index}`;
    if (cle !== vueCle) {
      const ancienne = vueCle;
      vueCle = cle;
      if (e.phase === "attente") { audio.stop(); vueAttente(e); }
      else if (e.phase === "salle") { audio.stop(); vueSalle(e); }
      else if (e.phase === "intro") { audio.stop(); vueIntro(e); }
      else if (e.phase === "question") { vueQuestion(e); piedQuestion(); }
      else if (e.phase === "revelation" && !ancienne.startsWith("question")) { vueQuestion(e); }
      else if (e.phase === "classement") vueClassement(e);
      else if (e.phase === "fin" || e.phase === "termine") vueFin(e);
    }

    // Mises à jour fines
    if (e.phase === "attente") {
      const el = $("[data-compte]");
      if (el && e.restant !== null && e.restant !== undefined) el.textContent = compte(e.restant);
      else if (el && SERVEUR && e.restant === null && el.textContent) vueCle = "";   // l'heure est passée : on redessine
    }
    if (e.phase === "question") {
      if (!enPause()) {
        if (SERVEUR) audio.fichier(e.audio, e.audioDebut, e.ecoule, `q${e.index}`);
        else audio.extrait(e.question, `q${e.index}`);
      }
      const chrono = $("[data-chrono]");
      const s = Math.ceil(e.restant / 1000);
      chrono.style.setProperty("--p", (e.restant / e.duree).toFixed(3));
      chrono.classList.toggle("is-urgent", s <= 5);
      $("[data-chrono-s]").textContent = s;
      if (s <= 5 && s > 0 && s !== dernierTic && !enPause()) { dernierTic = s; audio.signal("tic"); }
      $("[data-recues]").textContent = fmt.nombre(e.reponsesRecues);
      $("[data-recues-lib]").textContent = e.reponsesRecues > 1 ? "réponses reçues" : "réponse reçue";
      $("[data-recues-barre]").style.width = `${e.connectes ? Math.min(100, Math.round((e.reponsesRecues / e.connectes) * 100)) : 0}%`;
    }
    if (e.phase === "revelation") appliquerRevelation(e);
  }

  /* ---------- Clavier régie (démo seulement pour la manche) ---------- */
  document.addEventListener("keydown", (ev) => {
    const k = ev.key.toLowerCase();
    if (!SERVEUR && k === " ") { ev.preventDefault(); regie.basculerPause(); }
    else if (!SERVEUR && ev.key === "ArrowRight") regie.suivant();
    else if (!SERVEUR && k === "d") regie.demarrer();
    else if (!SERVEUR && k === "r") regie.recommencer();
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

  /* ---------- Démarrage ---------- */
  if (SERVEUR) {
    await relire();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) programmer(0); });
    /* Temps réel : écran géant seulement (forfait gratuit : 200 connexions) */
    try {
      App.direct("plateau", (c) => c
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_state" }, () => programmer())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: "type=in.(raid,quiz)" }, () => programmer()),
      (statut) => {
        canalOk = statut === "SUBSCRIBED";
        if (canalOk) programmer(0);   // un signal a pu être manqué pendant la coupure
      });
    } catch (err) { console.warn(err); }
  }
  await tick();
  setInterval(tick, 250);
  (function anime() { dessinerVisu(); requestAnimationFrame(anime); })();
});
