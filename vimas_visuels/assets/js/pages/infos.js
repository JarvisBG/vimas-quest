/* ==========================================================================
   Page 17 — Infos pratiques (publique)
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const { $, $$, esc, icon, fmt, api, session } = App;

  const connecte = session.isLoggedIn();
  if (connecte) {
    App.initJoueur({ actif: "plus" });
    $("[data-retour]").href = "tableau-de-bord.html";
    $("[data-donnees]").hidden = false;
  } else {
    $("[data-jouer]").hidden = false;
  }

  let d;
  try {
    d = await api.infos();
  } catch (e) {
    App.toast("Certaines informations n'ont pas pu être chargées.");
    return;
  }
  const HEURE = (ms) => App.heureFestival(new Date(ms));

  /* ---------- L'essentiel ---------- */
  const actuel = d.horaires.find((h) => h.ouvert);
  const prochain = d.horaires.find((h) => h.ouverture > d.maintenant);
  const etat = $("[data-etat-site]");
  etat.classList.toggle("is-ouvert", !!actuel);
  etat.innerHTML = `<span class="etat-site__point" aria-hidden="true"></span><span>${
    actuel ? `Le site est ouvert jusqu'à ${HEURE(actuel.fin)}`
    : prochain ? `Ouverture des portes ${prochain.jourInfo.long.toLowerCase()} à ${HEURE(prochain.ouverture)}`
    : "Le festival est terminé. Merci et à l'année prochaine !"}</span>`;
  $("[data-horaires]").innerHTML = d.horaires.map((h) => `
    <div class="billet horaire${h === actuel ? " is-actuel" : ""}">
      <span class="horaire__jour">${esc(h.jourInfo.court)}</span>
      <span class="horaire__heures">${HEURE(h.ouverture)}</span>
      <span class="horaire__lib">à ${HEURE(h.fin)}</span>
    </div>`).join("");
  $("[data-adresse]").textContent = `${d.adresse}. ${d.festival.dates}.`;

  /* ---------- Accès ---------- */
  $("[data-acces]").innerHTML = d.acces.map((a) => `
    <li><span class="cartes-i__icone">${icon(a.icone)}</span><span><strong>${esc(a.titre)}</strong>${esc(a.texte)}</span></li>`).join("");
  $("[data-accessibilite]").innerHTML = d.accessibilite.map((t) => `<li>${esc(t)}</li>`).join("");

  /* ---------- Règles du jeu ---------- */
  $("[data-bareme]").innerHTML = d.bareme.map((b) =>
    `<tr><td>${esc(b.nom)}</td><td>${b.min === b.max ? `+${b.min}` : `+${b.min} à +${b.max}`} XP</td></tr>`).join("") +
    `<tr><td>Blind test</td><td>tes points ÷ 25</td></tr>`;
  $("[data-rangs]").innerHTML = d.rangs.map((r, i) => `
    <li style="--i:${i}"><span>${esc(r.nom)}</span><small>${r.xp ? `${fmt.nombre(r.xp)} XP` : "Dès l'inscription"}</small></li>`).join("");
  $("[data-roue-regles]").innerHTML = [
    `Un tour de roue coûte ${d.coutTirage} jetons, ${d.maxTirages} tours maximum par jour.`,
    "Le résultat est tiré au sort par le serveur ; les chances et les stocks sont affichés sur la page de la roue.",
    "Chaque lot gagné crée un bon de retrait avec un QR, à présenter au Stand Vimas Fest avec ton billet avant dimanche 23h.",
    `Blind test chaque soir à ${fmt.heure(d.blind.horaire)} : le podium gagne un lot, le top 10 le badge Oreille d'or.`
  ].map((t) => `<li>${esc(t)}</li>`).join("");

  /* ---------- Sécurité ---------- */
  $("[data-refuge-titre]").textContent = d.refuge;
  $("[data-refuge-texte]").innerHTML = `Harcèlement, malaise, situation qui te met mal à l'aise : dis <strong>« ${esc(d.refuge)} »</strong> à un bénévole ou au bar. Une personne formée t'accompagne, sans jugement.`;
  $("[data-interdits]").innerHTML = d.interdits.map((t) => `<li>${esc(t)}</li>`).join("");

  /* ---------- FAQ avec recherche ---------- */
  const normaliser = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const surligner = (texte, q) => {
    if (!q) return esc(texte);
    const n = normaliser(texte);
    const i = n.indexOf(q);
    if (i < 0) return esc(texte);
    return `${esc(texte.slice(0, i))}<mark>${esc(texte.slice(i, i + q.length))}</mark>${esc(texte.slice(i + q.length))}`;
  };
  function rendreFaq() {
    const q = normaliser($("[data-chercher-faq]").value.trim());
    const liste = d.faq.filter((f) => !q || normaliser(`${f.q} ${f.r}`).includes(q));
    $("[data-faq]").innerHTML = liste.map((f) => `
      <details id="faq-${esc(f.id)}" ${q ? "open" : ""}>
        <summary>${surligner(f.q, q)}</summary>
        <div class="faq__reponse"><p>${surligner(f.r, q)}</p></div>
      </details>`).join("");
    $("[data-faq-vide]").hidden = liste.length > 0;
  }
  let minuteurFaq;
  $("[data-chercher-faq]").addEventListener("input", () => { clearTimeout(minuteurFaq); minuteurFaq = setTimeout(rendreFaq, 150); });
  rendreFaq();

  /* ---------- Contact ---------- */
  $("[data-sujets]").innerHTML = `<option value="">Choisis un sujet</option>` +
    d.contact.sujets.map((s) => `<option>${esc(s)}</option>`).join("");
  const lienEmail = $("[data-email]");
  lienEmail.href = `mailto:${d.contact.email}`;
  lienEmail.textContent = d.contact.email;
  $("[data-delai]").textContent = d.contact.delai;

  const form = $("[data-form-contact]");
  const message = $("#message");
  message.addEventListener("input", () => {
    $("[data-message-compteur]").textContent = message.value.length;
    $("[data-champ-message]").classList.remove("is-invalide");
  });
  $("#email").addEventListener("input", () => $("[data-champ-email]").classList.remove("is-invalide"));

  function erreurContact(texte, champ) {
    const zone = $("[data-contact-erreur]");
    zone.hidden = false;
    zone.innerHTML = `${icon("alerte")}<span>${esc(texte)}</span>`;
    if (champ) champ.focus();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("[data-contact-erreur]").hidden = true;
    const sujet = form.sujet.value;
    const texte = message.value.trim();
    const email = form.email.value.trim();
    if (!sujet) return erreurContact("Choisis un sujet.", form.sujet);
    if (texte.length < 10) {
      $("[data-champ-message]").classList.add("is-invalide");
      return erreurContact("Ton message doit faire au moins 10 caractères.", message);
    }
    if (email && !form.email.checkValidity()) {
      $("[data-champ-email]").classList.add("is-invalide");
      return erreurContact("Cette adresse e-mail ne semble pas valide.", form.email);
    }
    const bouton = $("[type=submit]", form);
    bouton.setAttribute("aria-busy", "true");
    let res;
    try {
      res = await api.envoyerContact({ sujet, message: texte, email });
    } catch (err) {
      res = { ok: false, erreur: "reseau" };
    }
    bouton.removeAttribute("aria-busy");
    if (!res.ok) {
      return erreurContact(res.erreur === "email" ? "Cette adresse e-mail ne semble pas valide."
        : res.erreur === "reseau" ? "Envoi impossible pour l'instant. Réessaie, ou passe au Point info."
        : "Complète le formulaire.");
    }
    form.hidden = true;
    const ok = $("[data-contact-ok]");
    ok.hidden = false;
    ok.innerHTML = `
      <strong>Message envoyé</strong>
      <span>Référence ${esc(res.reference)}. ${email ? "On te répond par e-mail." : "Sans adresse e-mail, passe au Point info avec cette référence pour avoir la réponse."}</span>
      <button class="lien-fort" type="button" data-nouveau-message style="background:none;border:0;padding:0;cursor:pointer;justify-self:start">Écrire un autre message</button>`;
    ok.focus();
  });

  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-nouveau-message]")) {
      form.reset();
      $("[data-message-compteur]").textContent = "0";
      form.hidden = false;
      $("[data-contact-ok]").hidden = true;
      form.sujet.focus();
    }
    if (e.target.closest("[data-supprimer]")) {
      const pseudo = session.get()?.pseudo || "";
      const saisie = window.prompt(`Cette action est définitive. Pour confirmer, tape ton pseudo : ${pseudo}`);
      if (saisie === null) return;
      if (saisie.trim() !== pseudo) { App.toast("Le pseudo ne correspond pas, rien n'a été supprimé."); return; }
      const res = await api.supprimerPartie();
      if (res.ok) {
        App.toast("Ta partie a été supprimée.");
        setTimeout(() => location.replace("index.html"), 1200);
      }
    }
  });

  /* ---------- Sommaire : section en cours ---------- */
  const liens = $$(".sommaire__liste a");
  const sections = $$(".section-i");
  let dernierActif = null;
  function majSommaire() {
    const seuil = $(".sommaire").getBoundingClientRect().bottom + 24;
    let actif = sections[0].id;
    sections.forEach((sec) => { if (sec.getBoundingClientRect().top <= seuil) actif = sec.id; });
    // En bas de page, la dernière section est active
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) actif = sections[sections.length - 1].id;
    if (actif === dernierActif) return;
    dernierActif = actif;
    liens.forEach((l) => {
      const oui = l.hash.slice(1) === actif;
      if (oui) {
        l.setAttribute("aria-current", "true");
        const liste = l.closest(".sommaire__liste");
        liste.scrollTo({ left: l.offsetLeft - 16, behavior: App.reduceMotion ? "auto" : "smooth" });
      } else l.removeAttribute("aria-current");
    });
  }
  let rafSommaire = 0;
  window.addEventListener("scroll", () => {
    cancelAnimationFrame(rafSommaire);
    rafSommaire = requestAnimationFrame(majSommaire);
  }, { passive: true });

  /* ---------- Liens directs : #regles, #securite, #faq-billet-perdu… ---------- */
  function suivreAncre() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const cible = document.getElementById(id);
    if (!cible) return;
    if (cible.tagName === "DETAILS") {
      cible.open = true;
      cible.classList.add("is-cible");
    }
    cible.scrollIntoView({ block: "start", behavior: "instant" });
  }
  window.addEventListener("hashchange", suivreAncre);
  suivreAncre();
  majSommaire();
});
