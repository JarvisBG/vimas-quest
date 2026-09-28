/* ==========================================================================
   Console — connexion de l'équipe (étape 6.1)
   Coût : 0 requête à l'ouverture sans session ; avec une session encore
   valable, 1 (mon_acces) puis départ vers la console. Connexion : 2 (Auth,
   puis mon_acces).
   ========================================================================== */
document.addEventListener("app:ready", async () => {
  "use strict";
  const App = window.App;
  const C = App.console;
  const $ = App.$;
  const form = $("[data-form]");
  const erreur = $("[data-erreur]");
  const params = new URLSearchParams(location.search);
  const retour = /^[a-z0-9-]+\.html$/.test(params.get("retour") || "") ? params.get("retour") : null;

  const montrerErreur = (texte) => {
    erreur.innerHTML = texte ? `${App.icon("alerte")}<span>${App.esc(texte)}</span>` : "";
    erreur.hidden = !texte;
  };

  /* Le vendeur va toujours à son espace (jamais à une page de la console) */
  const partir = (acces) => location.replace(acces.vendeur ? C.destination(acces) : (retour || C.destination(acces)));

  $("[data-sortir]").addEventListener("click", C.deconnecter);

  /* Déjà connecté dans ce navigateur ? */
  try {
    const { data } = await C.sb().auth.getSession();
    if (data && data.session) {
      const acces = await C.appel("mon_acces");
      if (acces && acces.membre) { C.retenirAcces(acces, data.session.user.id); partir(acces); return; }
      await C.sb().auth.signOut();
    }
  } catch (e) {
    if (e.code === "RESEAU") montrerErreur(C.message(e));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const mdp = form.mdp.value;
    if (!email || !mdp) { montrerErreur("Écris ton e-mail et ton mot de passe."); return; }
    const liberer = C.occuper(form.querySelector('[type="submit"]'));
    if (liberer === null) return;
    montrerErreur("");
    try {
      partir(await C.connecter(email, mdp));
    } catch (err) {
      montrerErreur(C.message(err));
      form.mdp.value = "";
      form.mdp.focus();
    } finally {
      liberer();
    }
  });
});
