/* ==========================================================================
   Console — écran Annonces (étape 5.1 Vimas), style Game Master d'Otaku
   Lecture : la table announcements (lecture publique, comme les téléphones),
   les 100 plus récentes en UN appel ; relue au signal du temps réel (au plus
   1 / 5 s, filet 60 s).
   Écritures (bouton verrouillé, jamais réessayées) :
   admin_publier_annonce (titre, message, niveau, catégorie, lien, fin),
   admin_fermer_annonce (fin tout de suite : « Anciennes » sur les téléphones),
   admin_delete_announcement (effacée partout, après confirmation).
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const esc = App.esc;

  Object.assign(C.messages, {
    ANNONCE_INCONNUE: "Cette annonce est déjà retirée : recharge la page.",
    FIN_PASSEE: "Le moment du retrait est déjà passé.",
    LIBELLE_SANS_LIEN: "Choisis d'abord la page du bouton."
  });

  const acces = await C.garde();
  if (!acces) return;

  const NIVEAUX = { danger: ["danger", "Urgent"], alerte: ["alerte", "Important"], succes: ["succes", "Info"], info: ["", "Info"] };
  const CATEGORIES = { pratique: "Pratique", horaire: "Horaires", meteo: "Météo", securite: "Sécurité", jeu: "Jeu", surprise: "Surprise" };
  /* Pages du site joueur (contrainte announcements.lien : « page.html ») */
  const PAGES = [
    ["", "Aucun bouton"], ["programme.html", "Programme"], ["plan.html", "Plan"], ["infos.html", "Infos pratiques"],
    ["missions.html", "Missions"], ["roue.html", "Roue"], ["blind-test.html", "Blind test"],
    ["coups-de-coeur.html", "Coups de cœur"], ["classement.html", "Classement"], ["scanner.html", "Scanner"]
  ];
  const H48 = 48 * 3600e3;

  const lignes = $("[data-lignes]");
  const form = $("[data-form]");
  const zoneErreur = $("[data-erreur]");
  let annonces = null;

  form.lien.innerHTML = PAGES.map(([v, nom]) => `<option value="${v}">${esc(nom)}</option>`).join("");
  form.lien.addEventListener("change", () => {
    form.lien_libelle.disabled = !form.lien.value;
    if (!form.lien.value) form.lien_libelle.value = "";
  });

  const quand = (iso) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Douala", weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  function etat(a) {
    const t = Date.now();
    if (a.fin && Date.parse(a.fin) <= t) return ["retiree", "Retirée", "cpuce"];
    if (t - Date.parse(a.created_at) > H48) return ["ancienne", "Plus affichée (48 h)", "cpuce"];
    return ["active", a.fin ? `En ligne jusqu'à ${quand(a.fin)}` : "En ligne", "cpuce cpuce--ok"];
  }

  /* ---------- Lecture ---------- */
  async function relire() {
    const r = await C.sb().from("announcements")
      .select("id, titre, message, type, categorie, lien, lien_libelle, fin, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (r.error) throw new App.ErreurServeur(/fetch/i.test(r.error.message) ? "RESEAU" : "ERREUR", r.error.message);
    annonces = r.data;
    rendre();
  }

  function rendre() {
    const actives = annonces.filter((a) => etat(a)[0] === "active");
    const urgentes = actives.filter((a) => a.type === "danger").length;
    $("[data-resume]").textContent = actives.length
      ? `${actives.length} en ligne${urgentes ? `, dont ${urgentes} urgente${urgentes > 1 ? "s" : ""} épinglée${urgentes > 1 ? "s" : ""}` : ""} · ${annonces.length} en tout`
      : `Aucune annonce en ligne · ${annonces.length} en tout`;
    if (!annonces.length) {
      lignes.innerHTML = `<tr><td colspan="4" class="cvide">Aucune annonce pour l'instant.</td></tr>`;
      return;
    }
    lignes.innerHTML = annonces.map((a) => {
      const [cls, niveau] = NIVEAUX[a.type] || NIVEAUX.info;
      const [cle, libelle, puce] = etat(a);
      return `<tr data-id="${esc(a.id)}">
        <td><div class="cligne">
          ${a.titre ? `<strong>${esc(a.titre)}</strong>` : ""}<small>${esc(a.message)}</small>
          <div class="cpuces"><span class="cbadge${cls ? ` cbadge--${cls}` : ""}">${niveau}</span>
            <span class="cpuce">${esc(CATEGORIES[a.categorie] || a.categorie)}</span>
            ${a.lien ? `<span class="cpuce">${App.icon("fleche")} ${esc(a.lien_libelle || a.lien)}</span>` : ""}</div></div></td>
        <td class="ctable__date">${esc(quand(a.created_at))}<span class="ctable__sous">${esc(C.ilYa(a.created_at))}</span></td>
        <td><span class="${puce}">${esc(libelle)}</span></td>
        <td class="ctable__actions">
          ${cle === "active" ? `<button class="cbtn" type="button" data-fermer>Retirer</button>` : ""}
          <button class="cbtn cbtn--icone cbtn--danger" type="button" data-effacer title="Effacer">${App.icon("fermer")}<span class="sr-only">Effacer</span></button>
        </td></tr>`;
    }).join("");
  }

  const zone = $("[data-console-contenu]");
  C.suivre("console-annonces", [["*", "announcements"]], async () => {
    try { await relire(); $("[data-erreur-lecture]")?.remove(); }
    catch (e) {
      if (!annonces && !$("[data-erreur-lecture]")) {
        zone.insertAdjacentHTML("afterbegin", `<p class="message" role="alert" data-erreur-lecture>${App.icon("alerte")}<span>${esc(C.message(e))}</span></p>`);
      }
      throw e;
    }
  });

  /* ---------- Retirer / effacer ---------- */
  lignes.addEventListener("click", async (e) => {
    const bouton = e.target.closest("[data-fermer], [data-effacer]");
    if (!bouton) return;
    const a = annonces.find((x) => x.id === bouton.closest("tr").dataset.id);
    if (!a) return;
    const nom = a.titre || a.message.slice(0, 60);
    const effacer = bouton.hasAttribute("data-effacer");
    const ok = await C.confirmer(effacer
      ? { titre: `Effacer « ${nom} » ?`, texte: "Elle disparaît de tous les téléphones, y compris des « Anciennes ». Pour une annonce simplement dépassée, « Retirer » suffit.", oui: "Effacer", danger: true }
      : { titre: `Retirer « ${nom} » ?`, texte: "Elle quitte le haut de la page Annonces et passe dans « Anciennes ».", oui: "Retirer" });
    if (!ok) return;
    const liberer = C.occuper(bouton);
    if (!liberer) return;
    try {
      if (effacer) await C.appel("admin_delete_announcement", { p_id: a.id });
      else await C.appel("admin_fermer_annonce", { p_id: a.id });
      C.dire(effacer ? "Annonce effacée" : "Annonce retirée");
      await relire();
    } catch (err) {
      C.dire(C.message(err));
    } finally { liberer(); }
  });

  /* ---------- Publier ---------- */
  function erreur(texte) {
    zoneErreur.innerHTML = texte ? `${App.icon("alerte")}<span>${esc(texte)}</span>` : "";
    zoneErreur.hidden = !texte;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erreur("");
    const message = form.message.value.trim();
    if (!message) { erreur(C.messages.MESSAGE_VIDE); form.message.focus(); return; }
    /* datetime-local = heure du Cameroun (UTC+1 toute l'année) */
    const fin = form.fin.value ? `${form.fin.value}:00+01:00` : null;
    if (fin && Date.parse(fin) <= Date.now()) { erreur(C.messages.FIN_PASSEE); form.fin.focus(); return; }
    const liberer = C.occuper(form.querySelector('[type="submit"]'));
    if (!liberer) return;
    try {
      await C.appel("admin_publier_annonce", {
        p_titre: form.titre.value.trim() || null, p_message: message,
        p_type: form.niveau.value, p_categorie: form.categorie.value,
        p_lien: form.lien.value || null, p_lien_libelle: (form.lien.value && form.lien_libelle.value.trim()) || null,
        p_fin: fin
      });
      form.reset();
      form.lien_libelle.disabled = true;
      C.dire("Annonce publiée");
      await relire();
    } catch (err) {
      erreur(C.message(err));
    } finally { liberer(); }
  });
});
