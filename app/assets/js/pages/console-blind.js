/* ==========================================================================
   Console — Régie du blind test (étape 5.2 Vimas), style Game Master d'Otaku
   Une manche = quiz_sessions de type « raid » (moteur d'Otaku) : un boss, des
   questions lancées une à une par la régie, les points des joueurs retirent
   des PV au boss. Aucune fonction SQL nouvelle :
   · lecture : admin_list_quiz_sessions (toutes les manches), puis pour la
     manche ouverte admin_list_quiz_questions + admin_quiz_live (relue toutes
     les secondes pendant le direct, onglet visible seulement) ; game_state
     (lecture publique) pour savoir si le jeu est resté en phase blind test ;
   · préparation : admin_create_quiz_session, admin_rename_quiz_session,
     admin_update_raid_params, admin_duplicate_quiz_session,
     admin_delete_quiz_session, admin_create/update/delete_quiz_question,
     admin_move_quiz_question, admin_blind_question (extrait, pochette…) ;
   · direct : admin_quiz_start (phase RAID), admin_quiz_next (l'écran géant
     suit par game_state), admin_quiz_end (récompenses, une fois), puis
     admin_set_phase('EXPLORATION') pour rouvrir le jeu.
   Toutes les écritures : bouton verrouillé, jamais réessayées.
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    QUIZ_INCONNU: "Cette manche n'existe plus : recharge la page.",
    QUIZ_VIDE: "Ajoute au moins une question avant de lancer la manche.",
    QUIZ_INACTIF: "La manche n'est pas en direct.",
    PLUS_DE_QUESTIONS: "C'était la dernière question : termine la manche.",
    QUIZ_VERROUILLE: "Des joueurs ont déjà répondu : la manche ne se modifie plus.",
    QUIZ_DEJA_LANCE: "La manche est lancée : son titre et ses questions sont figés.",
    QUESTION_VERROUILLEE: "Des joueurs ont déjà répondu à cette question : elle ne se modifie plus.",
    QUESTION_INCONNUE: "Cette question n'existe plus : recharge la page.",
    QUESTION_MANQUANTE: "Écris la question.",
    CHOIX_INVALIDES: "Propose de 2 à 4 réponses.",
    BONNE_REPONSE_INVALIDE: "Coche la bonne réponse.",
    DUREE_INVALIDE: "Le chrono va de 5 à 120 secondes.",
    DEBUT_INVALIDE: "Le départ de l'extrait va de 0 à 3 600 secondes.",
    TEXTE_TROP_LONG: "Un texte est trop long (catégorie 40, révélation 160, anecdote 400 caractères).",
    ADRESSE_INVALIDE: "Adresse de l'extrait ou de la pochette invalide : un chemin du site (bt/q01.mp3) ou https://…",
    TITRE_VIDE: "Donne un titre à la manche.",
    TITRE_MANQUANT: "Donne un titre à la manche.",
    TITRE_TROP_LONG: "Le titre fait 80 caractères au plus.",
    BOSS_MANQUANT: "Donne un nom au boss.",
    PV_INVALIDES: "Les points de vie vont de 1 à 100 000 000.",
    RAID_TERMINE: "La manche est terminée : le boss ne se modifie plus."
  });

  const acces = await C.garde();
  if (!acces) return;

  const n = C.nombre;
  const STATUTS = { preparee: ["", "En préparation"], en_cours: ["danger", "En direct"], terminee: ["succes", "Terminée"] };
  const LETTRES = ["A", "B", "C", "D"];

  const vueListe = $("[data-liste]");
  const vueManche = $("[data-manche]");
  const formManche = $("[data-form-manche]");
  const boiteQ = $("[data-boite-question]");
  const formQ = $("[data-form-question]");
  let manches = null, courante = null, questions = [], live = null, phase = null, luA = 0;
  let mancheModifiee = false;
  formManche.addEventListener("input", () => { mancheModifiee = true; });

  const trouver = (id) => (manches || []).find((m) => m.id === id) || null;
  const statut = (m) => (m ? m.status : null);

  /* ---------- Lecture ---------- */
  async function lirePhase() {
    const r = await C.sb().from("game_state").select("phase").eq("id", 1).single();
    if (!r.error) phase = r.data.phase;
  }

  async function chargerListe() {
    manches = await C.appel("admin_list_quiz_sessions");
    await lirePhase();
    rendreListe();
  }

  async function chargerManche() {
    if (!courante) return;
    const [qs, l] = await Promise.all([
      C.appel("admin_list_quiz_questions", { p_session_id: courante }),
      C.appel("admin_quiz_live", { p_session_id: courante })
    ]);
    questions = qs || [];
    live = l;
    luA = Date.now();
    rendreManche();
  }

  async function toutRelire() {
    await chargerListe();
    if (courante && !trouver(courante)) fermer();
    else if (courante) await chargerManche();
  }

  /* ---------- Liste des manches ---------- */
  function rendreListe() {
    const direct = manches.find((m) => m.status === "en_cours");
    $("[data-resume]").textContent = direct
      ? `En direct : « ${direct.title} » · ${n(manches.length)} manche${manches.length > 1 ? "s" : ""}`
      : `${n(manches.length)} manche${manches.length > 1 ? "s" : ""} · aucune en direct${phase === "RAID" ? " (le jeu est encore en phase blind test)" : ""}`;
    const corps = $("[data-manches]");
    if (!manches.length) {
      corps.innerHTML = `<tr><td colspan="5" class="cvide">Aucune manche. Crée la première avec « Nouvelle manche » : un boss, puis ses questions.</td></tr>`;
      return;
    }
    corps.innerHTML = manches.map((m) => {
      const [cls, nom] = STATUTS[m.status] || ["", m.status];
      const pv = m.kind === "raid" && m.boss_hp_max ? `${Math.min(100, Math.round(((m.damage || 0) / m.boss_hp_max) * 100))} % des PV retirés` : "";
      return `<tr data-id="${esc(m.id)}"${m.status === "en_cours" ? ' class="is-en-cours"' : ""}>
        <td><div class="cligne"><strong>${esc(m.title)}</strong>
          <small>${m.kind === "raid" ? `Boss : ${esc(m.boss_name || "?")} · ${n(m.boss_hp_max)} PV` : "Quiz sans boss"}</small></div></td>
        <td class="ctable__nb">${n(m.questions)}</td>
        <td class="ctable__nb">${n(m.participants)}${pv ? `<span class="ctable__sous">${esc(pv)}</span>` : ""}</td>
        <td><span class="cbadge${cls ? ` cbadge--${cls}` : ""}">${esc(nom)}</span></td>
        <td class="ctable__actions"><button class="cbtn" type="button">${m.status === "en_cours" ? "Piloter" : "Ouvrir"}</button></td></tr>`;
    }).join("");
  }

  $("[data-manches]").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) ouvrir(tr.dataset.id);
  });

  async function ouvrir(id) {
    courante = id;
    mancheModifiee = false;
    if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
    vueListe.hidden = true;
    vueManche.hidden = false;
    $("[data-direct-corps]").innerHTML = `<p class="cvide">Chargement…</p>`;
    $("[data-actions]").innerHTML = "";
    $("[data-questions]").innerHTML = "";
    try { await chargerManche(); }
    catch (e) { $("[data-direct-corps]").innerHTML = `<p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`; }
    window.scrollTo({ top: 0 });
  }

  function fermer() {
    courante = null;
    live = null;
    history.replaceState(null, "", location.pathname);
    vueManche.hidden = true;
    vueListe.hidden = false;
    if (manches) rendreListe();
  }
  $("[data-retour]").addEventListener("click", fermer);

  /* ---------- La manche ouverte ---------- */
  function rendreManche() {
    const s = live.session;
    const [cls, nom] = STATUTS[s.status] || ["", s.status];
    $("[data-m-titre]").textContent = s.title;
    const badge = $("[data-m-statut]");
    badge.className = `cbadge${cls ? ` cbadge--${cls}` : ""}`;
    badge.textContent = nom;
    rendreDirect();
    rendreQuestions();
    rendreFormManche();
  }

  function restantMs() {
    const q = live && live.question;
    if (!q || q.elapsed_ms === null || q.elapsed_ms === undefined) return 0;
    return q.duration_seconds * 1000 - (q.elapsed_ms + (Date.now() - luA));
  }

  function pvHtml() {
    const s = live.session, r = live.raid;
    if (!r) return "";
    const part = s.boss_hp_max ? Math.max(0, Math.min(100, (r.hp_left / s.boss_hp_max) * 100)) : 0;
    return `<div class="cregie__pv">
      <div class="cregie__ligne"><strong>${esc(s.boss_name || "Boss")}</strong><span class="cregie__num">${r.defeated ? "Conquis !" : `${n(r.hp_left)} / ${n(s.boss_hp_max)} PV`}</span></div>
      <div class="cregie__barre"><span style="--pv:${part}%"></span></div>
      <small>${n(r.damage)} points marqués par le public</small></div>`;
  }

  function topHtml() {
    if (!live.top || !live.top.length) return "";
    return `<p class="csous-titre">Meilleures oreilles</p><ol class="cliste">${live.top.map((p, i) => `<li>
      <span class="cliste__place cliste__place--${i + 1}">${i + 1}</span>
      <span class="cliste__texte"><strong>${esc(p.pseudo)}</strong></span>
      <span class="cliste__val">${n(p.points)} pts</span></li>`).join("")}</ol>`;
  }

  function rendreDirect() {
    const s = live.session;
    const total = live.total_questions;
    const corps = $("[data-direct-corps]");
    const actions = [];

    if (s.status === "preparee") {
      corps.innerHTML = `<div class="cregie__etat">
        <p class="cvide">${total ? `${n(total)} question${total > 1 ? "s" : ""} prête${total > 1 ? "s" : ""}.` : "Aucune question : ajoute-les ci-dessous."}
        Lancer la manche met le jeu en phase « Blind test » (missions en pause) et prévient l'écran géant et les téléphones ; les questions partent ensuite une à une, depuis cette page.</p>
        ${pvHtml()}</div>`;
      actions.push(`<button class="cbtn cbtn--primaire" type="button" data-action="lancer"${total ? "" : " disabled"}>${App.icon("micro")} Lancer la manche</button>`);
    } else if (s.status === "en_cours") {
      const q = live.question;
      if (!q) {
        corps.innerHTML = `<div class="cregie__etat"><p class="cregie__question">La manche est lancée.</p>
          <p class="cvide">Les téléphones attendent la première question. Envoie-la quand la salle est prête.</p>${pvHtml()}</div>`;
        actions.push(`<button class="cbtn cbtn--primaire" type="button" data-action="suivante">${App.icon("fleche")} Première question</button>`);
      } else {
        const reste = restantMs();
        const dist = q.distribution || [];
        const totalRep = q.answers_count || 0;
        corps.innerHTML = `<div class="cregie__etat">
          <div class="cregie__ligne"><span class="cregie__num">Question ${n(s.current_question)} sur ${n(total)}${q.categorie ? ` · ${esc(q.categorie)}` : ""}</span>
            <span class="cregie__chrono${reste > 0 ? "" : " is-fini"}" data-chrono>${reste > 0 ? Math.ceil(reste / 1000) : "Chrono fini"}</span></div>
          <p class="cregie__question">${esc(q.question)}</p>
          <div class="cregie__reponses">${(q.choices || []).map((c, i) => {
            const k = dist[i] || 0;
            const part = totalRep ? Math.round((k / totalRep) * 100) : 0;
            return `<div class="cregie__rep${i === q.correct_index ? " is-bonne" : ""}" style="--part:${part}%">
              <span>${LETTRES[i]} · ${esc(c)}${i === q.correct_index ? " ✓" : ""}</span><span><b>${n(k)}</b> · ${part} %</span></div>`;
          }).join("")}</div>
          <p class="cregie__num">${n(totalRep)} réponse${totalRep > 1 ? "s" : ""} · ${n(q.correct_count)} bonne${q.correct_count > 1 ? "s" : ""}${q.reponse ? ` · révélation : ${esc(q.reponse)}` : ""}</p>
          ${pvHtml()}${topHtml()}</div>`;
        if (s.current_question < total) {
          actions.push(`<button class="cbtn cbtn--primaire" type="button" data-action="suivante">${App.icon("fleche")} Question suivante</button>`);
        }
      }
      actions.push(`<button class="cbtn${q && s.current_question >= total ? " cbtn--primaire" : " cbtn--danger"}" type="button" data-action="terminer">${App.icon("trophee")} Terminer la manche</button>`);
    } else {
      corps.innerHTML = `<div class="cregie__etat">
        <p class="cvide">Manche terminée : récompenses versées (jetons du classement, badge « Oreille d'or » au top 10, missions « blind »). Le récapitulatif s'affiche sur les téléphones.</p>
        ${pvHtml()}${topHtml()}</div>`;
      if (phase === "RAID") {
        actions.push(`<button class="cbtn cbtn--primaire" type="button" data-action="rouvrir">${App.icon("valide")} Rouvrir le jeu</button>`);
        corps.insertAdjacentHTML("afterbegin", `<p class="message">${App.icon("alerte")}<span>Le jeu est encore en phase « Blind test » : les missions restent en pause tant qu'il n'est pas rouvert.</span></p>`);
      }
    }
    $("[data-actions]").innerHTML = actions.join("");
  }

  /* Le chrono avance entre deux lectures */
  setInterval(() => {
    const el = $("[data-chrono]");
    if (!el || !live || !live.question) return;
    const reste = restantMs();
    el.textContent = reste > 0 ? Math.ceil(reste / 1000) : "Chrono fini";
    el.classList.toggle("is-fini", reste <= 0);
  }, 250);

  function rendreQuestions() {
    const prep = live.session.status === "preparee";
    $("[data-nouvelle-question]").hidden = !prep;
    const corps = $("[data-questions]");
    if (!questions.length) {
      corps.innerHTML = `<tr><td colspan="4" class="cvide">Aucune question.${prep ? " « Ajouter une question » pour commencer." : ""}</td></tr>`;
      return;
    }
    const encours = live.session.status === "en_cours" ? live.session.current_question : 0;
    corps.innerHTML = questions.map((q, i) => `<tr data-id="${esc(q.id)}"${q.question_order === encours ? ' class="is-en-cours"' : ""}>
      <td class="ctable__nb">${q.question_order}</td>
      <td><div class="cligne"><strong>${esc(q.question)}</strong>
        <div class="cq-choix">${(q.choices || []).map((c, k) => `<span${k === q.correct_index ? ' class="is-bonne"' : ""}>${LETTRES[k]} · ${esc(c)}</span>`).join("")}</div>
        <div class="cpuces">${q.categorie ? `<span class="cpuce">${esc(q.categorie)}</span>` : ""}
          ${q.audio_url ? `<span class="cpuce cpuce--ok">${App.icon("onde")} extrait</span>` : `<span class="cpuce cpuce--alerte">${App.icon("onde")} sans extrait</span>`}
          ${q.pochette_url ? `<span class="cpuce">pochette</span>` : ""}
          ${q.answers ? `<span class="cpuce">${n(q.answers)} réponse${q.answers > 1 ? "s" : ""}</span>` : ""}</div></div></td>
      <td class="ctable__nb">${q.duration_seconds} s</td>
      <td class="ctable__actions">${prep ? `
        <button class="cbtn cbtn--icone" type="button" data-monter title="Monter"${i ? "" : " disabled"}>↑<span class="sr-only">Monter</span></button>
        <button class="cbtn cbtn--icone" type="button" data-descendre title="Descendre"${i < questions.length - 1 ? "" : " disabled"}>↓<span class="sr-only">Descendre</span></button>
        <button class="cbtn" type="button" data-modifier>Modifier</button>` : ""}</td></tr>`).join("");
  }

  function rendreFormManche() {
    const s = live.session;
    if (!mancheModifiee) {
      formManche.titre.value = s.title;
      formManche.boss.value = s.boss_name || "";
      formManche.image.value = s.boss_image || "";
      formManche.pv.value = s.boss_hp_max || "";
    }
    formManche.titre.disabled = s.status !== "preparee";
    const fige = s.status === "terminee";
    [formManche.boss, formManche.image, formManche.pv].forEach((el) => { el.disabled = fige; });
    formManche.querySelector('[type="submit"]').hidden = fige;
    $("[data-supprimer-manche]").hidden = s.status !== "preparee";
    const q = Math.max(questions.length, 1);
    const repere = Math.round((100 * q * 0.6 * 750) / 1000) * 1000;
    $("[data-aide-pv]").textContent = `Chaque bonne réponse retire de 500 à 1 000 PV. Repère : 100 joueurs, ${q} question${q > 1 ? "s" : ""}, 60 % de bonnes réponses ≈ ${n(repere)} PV.`;
  }

  /* ---------- Direct ---------- */
  function erreurDirect(texte) {
    const z = $("[data-direct-erreur]");
    z.innerHTML = texte ? `${App.icon("alerte")}<span>${esc(texte)}</span>` : "";
    z.hidden = !texte;
  }

  $("[data-actions]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || b.disabled) return;
    const action = b.dataset.action;
    const s = live.session;
    erreurDirect("");
    let confirmation = null;
    if (action === "lancer") {
      const autre = manches.find((m) => m.status === "en_cours" && m.id !== s.id);
      confirmation = { titre: `Lancer « ${s.title} » ?`, oui: "Lancer",
        texte: `${autre ? `« ${autre.title} » est encore en direct : elle sera arrêtée sans récompenses. ` : ""}Le jeu passe en phase « Blind test » (missions en pause) ; l'écran géant et les téléphones l'annoncent tout de suite.` };
    } else if (action === "suivante" && live.question && restantMs() > 0) {
      confirmation = { titre: "Couper le chrono ?", texte: "La question en cours n'est pas finie : les joueurs qui n'ont pas encore répondu la perdent.", oui: "Question suivante" };
    } else if (action === "terminer") {
      confirmation = { titre: `Terminer « ${s.title} » ?`, oui: "Terminer et récompenser", danger: s.current_question < live.total_questions,
        texte: `${s.current_question < live.total_questions ? `Il reste ${live.total_questions - s.current_question} question(s) non posée(s). ` : ""}Les récompenses partent maintenant (une seule fois) et le résultat s'affiche sur l'écran géant.` };
    } else if (action === "rouvrir") {
      confirmation = { titre: "Rouvrir le jeu ?", texte: "Scans, missions, roue et votes reprennent pour tout le monde.", oui: "Rouvrir le jeu" };
    }
    if (confirmation && !(await C.confirmer(confirmation))) return;
    const liberer = C.occuper(b);
    if (!liberer) return;
    try {
      if (action === "lancer") { await C.appel("admin_quiz_start", { p_session_id: s.id }); C.dire("Manche lancée : envoie la première question."); }
      if (action === "suivante") await C.appel("admin_quiz_next", { p_session_id: s.id });
      if (action === "terminer") { await C.appel("admin_quiz_end", { p_session_id: s.id }); C.dire("Manche terminée, récompenses versées."); }
      if (action === "rouvrir") { await C.appel("admin_set_phase", { p_phase: "EXPLORATION" }); C.dire("Le jeu est rouvert."); }
      await toutRelire();
    } catch (err) {
      erreurDirect(C.message(err));
    } finally { liberer(); }
  });

  /* Pendant le direct : relecture chaque seconde (onglet visible, jamais deux à la fois) */
  let enLecture = false;
  setInterval(async () => {
    if (enLecture || document.hidden || !courante || !live || live.session.status !== "en_cours") return;
    enLecture = true;
    try {
      live = await C.appel("admin_quiz_live", { p_session_id: courante });
      luA = Date.now();
      if (live.session.status !== "en_cours") await toutRelire();
      else { rendreDirect(); rendreQuestions(); }
    } catch (e) { if (e.code !== "RESEAU") console.warn(e); }
    finally { enLecture = false; }
  }, 1000);

  /* ---------- Manche : création, réglages, copie, suppression ---------- */
  const boiteM = $("[data-boite-manche]");
  const formNouvelle = $("[data-form-nouvelle]");
  const direErreur = (sel, texte) => { const z = $(sel); z.innerHTML = texte ? `${App.icon("alerte")}<span>${esc(texte)}</span>` : ""; z.hidden = !texte; };

  $("[data-nouvelle]").addEventListener("click", () => {
    formNouvelle.reset();
    direErreur("[data-nouvelle-erreur]", "");
    boiteM.showModal();
    formNouvelle.titre.focus();
  });
  boiteM.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteM.close(); });

  formNouvelle.addEventListener("submit", async (e) => {
    e.preventDefault();
    direErreur("[data-nouvelle-erreur]", "");
    const titre = formNouvelle.titre.value.trim(), boss = formNouvelle.boss.value.trim();
    if (!titre) { direErreur("[data-nouvelle-erreur]", C.messages.TITRE_VIDE); return; }
    if (!boss) { direErreur("[data-nouvelle-erreur]", C.messages.BOSS_MANQUANT); return; }
    const liberer = C.occuper(formNouvelle.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      const m = await C.appel("admin_create_quiz_session", {
        p_title: titre, p_kind: "raid", p_boss_name: boss, p_boss_image: null,
        p_boss_hp: Math.round(Number(formNouvelle.pv.value)), p_bonus_xp: 0
      });
      boiteM.close();
      C.dire("Manche créée : ajoute ses questions.");
      await chargerListe();
      await ouvrir(m.id);
    } catch (err) {
      direErreur("[data-nouvelle-erreur]", C.message(err));
    } finally { liberer(); }
  });

  formManche.addEventListener("submit", async (e) => {
    e.preventDefault();
    direErreur("[data-manche-erreur]", "");
    const s = live.session;
    const liberer = C.occuper(formManche.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      const titre = formManche.titre.value.trim();
      if (s.status === "preparee" && titre !== s.title) await C.appel("admin_rename_quiz_session", { p_id: s.id, p_title: titre });
      if (s.kind === "raid") {
        await C.appel("admin_update_raid_params", {
          p_session_id: s.id, p_boss_name: formManche.boss.value.trim(), p_boss_image: formManche.image.value.trim() || null,
          p_boss_hp: Math.round(Number(formManche.pv.value)), p_bonus_xp: s.raid_bonus_xp || 0
        });
      }
      mancheModifiee = false;
      C.dire("Manche enregistrée");
      await toutRelire();
    } catch (err) {
      direErreur("[data-manche-erreur]", C.message(err));
    } finally { liberer(); }
  });

  $("[data-dupliquer]").addEventListener("click", async (e) => {
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    try {
      const m = await C.appel("admin_duplicate_quiz_session", { p_session_id: courante });
      C.dire("Copie créée, en préparation");
      await chargerListe();
      await ouvrir(m.id);
    } catch (err) {
      direErreur("[data-manche-erreur]", C.message(err));
    } finally { liberer(); }
  });

  $("[data-supprimer-manche]").addEventListener("click", async (e) => {
    const s = live.session;
    const bouton = e.currentTarget;
    if (!(await C.confirmer({ titre: `Supprimer « ${s.title} » ?`, texte: "La manche et ses questions sont effacées.", oui: "Supprimer", danger: true }))) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("admin_delete_quiz_session", { p_id: s.id });
      C.dire("Manche supprimée");
      fermer();
      await chargerListe();
    } catch (err) {
      direErreur("[data-manche-erreur]", C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Questions ---------- */
  let questionOuverte = null;
  $("[data-choix]").innerHTML = LETTRES.map((l, i) => `<label>
    <input type="radio" name="bonne" value="${i}"${i ? "" : " checked"}><span class="sr-only">Bonne réponse ${l}</span>
    <input class="saisie" name="choix${i}" maxlength="80" autocomplete="off" placeholder="Réponse ${l}${i > 1 ? " (facultative)" : ""}"></label>`).join("");

  function ouvrirQuestion(q) {
    questionOuverte = q || null;
    formQ.reset();
    const el = formQ.elements;
    if (q) {
      el.categorie.value = q.categorie || "";
      el.duree.value = q.duration_seconds;
      el.question.value = q.question;
      (q.choices || []).forEach((c, i) => { el[`choix${i}`].value = c; });
      formQ.querySelector(`[name="bonne"][value="${q.correct_index}"]`).checked = true;
      el.reponse.value = q.reponse || "";
      el.anecdote.value = q.anecdote || "";
      el.audio.value = q.audio_url || "";
      el.debut.value = q.audio_debut || 0;
      el.pochette.value = q.pochette_url || "";
    }
    $("[data-q-titre]").textContent = q ? `Question ${q.question_order}` : "Nouvelle question";
    $("[data-q-sous]").textContent = q ? "Modifiable tant que la manche n'est pas lancée." : `Elle arrive en position ${questions.length + 1}.`;
    $("[data-supprimer-question]").hidden = !q;
    direErreur("[data-q-erreur]", "");
    boiteQ.showModal();
    el.question.focus();
  }

  $("[data-nouvelle-question]").addEventListener("click", () => ouvrirQuestion(null));
  boiteQ.addEventListener("click", (e) => { if (e.target.closest("[data-fermer]")) boiteQ.close(); });

  $("[data-questions]").addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const q = questions.find((x) => x.id === tr.dataset.id);
    if (e.target.closest("[data-modifier]")) { ouvrirQuestion(q); return; }
    const sens = e.target.closest("[data-monter]") ? "haut" : e.target.closest("[data-descendre]") ? "bas" : null;
    if (!sens) return;
    const liberer = C.occuper(e.target.closest("button"));
    if (!liberer) return;
    try {
      await C.appel("admin_move_quiz_question", { p_id: q.id, p_direction: sens });
      await chargerManche();
    } catch (err) {
      erreurDirect(C.message(err));
    } finally { liberer(); }
  });

  $("[data-enregistrer-question]").addEventListener("click", async (e) => {
    const el = formQ.elements;
    const question = el.question.value.trim();
    if (!question) { direErreur("[data-q-erreur]", C.messages.QUESTION_MANQUANTE); el.question.focus(); return; }
    /* Les cases vides sont ignorées ; la bonne réponse suit sa case */
    const bonne = Number((formQ.querySelector('[name="bonne"]:checked') || {}).value);
    const choix = [];
    let correct = -1;
    LETTRES.forEach((_, i) => {
      const v = el[`choix${i}`].value.trim();
      if (!v) return;
      if (i === bonne) correct = choix.length;
      choix.push(v);
    });
    if (choix.length < 2) { direErreur("[data-q-erreur]", C.messages.CHOIX_INVALIDES); return; }
    if (correct < 0) { direErreur("[data-q-erreur]", "La réponse cochée est vide : coche une réponse remplie."); return; }
    const duree = Math.round(Number(el.duree.value));
    /* Même règle que la base (quiz_questions_audio_url / _pochette_url), vérifiée
       AVANT tout envoi : sinon une nouvelle question serait créée sans son extrait */
    const ADRESSE = /^(https:\/\/|[A-Za-z0-9_][A-Za-z0-9_./-]*$)/;
    for (const champ of [el.audio, el.pochette]) {
      if (champ.value.trim() && !ADRESSE.test(champ.value.trim())) { direErreur("[data-q-erreur]", C.messages.ADRESSE_INVALIDE); champ.focus(); return; }
    }
    const liberer = C.occuper(e.currentTarget);
    if (!liberer) return;
    const nouvelle = !questionOuverte;
    try {
      const q = questionOuverte
        ? await C.appel("admin_update_quiz_question", { p_id: questionOuverte.id, p_question: question, p_choices: choix, p_correct: correct, p_duration: duree })
        : await C.appel("admin_create_quiz_question", { p_session_id: courante, p_question: question, p_choices: choix, p_correct: correct, p_duration: duree });
      /* Créée : un nouvel essai (si la suite échoue) la modifie au lieu d'en créer une autre */
      if (!questionOuverte) questionOuverte = q;
      await C.appel("admin_blind_question", {
        p_id: q.id, p_categorie: el.categorie.value.trim(), p_reponse: el.reponse.value.trim(), p_anecdote: el.anecdote.value.trim(),
        p_audio_url: el.audio.value.trim(), p_audio_debut: Math.round(Number(el.debut.value) || 0), p_pochette_url: el.pochette.value.trim()
      });
      boiteQ.close();
      C.dire(nouvelle ? "Question ajoutée" : "Question enregistrée");
      await toutRelire();
    } catch (err) {
      direErreur("[data-q-erreur]", C.message(err));
      if (nouvelle && questionOuverte) {   // créée, mais la suite a échoué : elle existe déjà
        $("[data-q-titre]").textContent = `Question ${questionOuverte.question_order}`;
        $("[data-supprimer-question]").hidden = false;
        await chargerManche().catch(() => {});
      }
    } finally { liberer(); }
  });

  $("[data-supprimer-question]").addEventListener("click", async (e) => {
    const q = questionOuverte;
    const bouton = e.currentTarget;
    if (!q || !(await C.confirmer({ titre: `Supprimer la question ${q.question_order} ?`, texte: q.question, oui: "Supprimer", danger: true }))) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      await C.appel("admin_delete_quiz_question", { p_id: q.id });
      boiteQ.close();
      C.dire("Question supprimée");
      await toutRelire();
    } catch (err) {
      direErreur("[data-q-erreur]", C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Démarrage : liste, manche de l'adresse, puis signal du temps réel ---------- */
  try {
    await chargerListe();
    const id = location.hash.slice(1);
    if (id && trouver(id)) await ouvrir(id);
  } catch (e) {
    $("[data-manches]").innerHTML = `<tr><td colspan="5"><p class="message" role="alert">${App.icon("alerte")}<span>${esc(C.message(e))}</span></p></td></tr>`;
    $("[data-resume]").textContent = "";
  }
  C.suivre("console-blind", [["UPDATE", "game_state"]], async () => { if (manches) await toutRelire(); });
});
