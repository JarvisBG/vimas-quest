/* ==========================================================================
   DOMAF Quest — ecran.js (commun aux écrans géants)
   Mise à l'échelle 1920 × 1080, plein écran, curseur masqué, verrou d'écran,
   canal de commandes de la régie.
   ========================================================================== */
(function () {
  "use strict";
  const App = window.App;

  App.ecran = {
    /* Adapte la scène 1920 × 1080 à la fenêtre (bandes noires si besoin) */
    echelle(scene) {
      const maj = () => {
        const e = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        scene.style.setProperty("--echelle", e.toFixed(4));
      };
      window.addEventListener("resize", maj);
      maj();
      return () => scene.getBoundingClientRect().height / 1080;
    },

    async pleinEcran() {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (e) { /* refusé par le navigateur */ }
    },

    /* Bouton « Lancer » : plein écran + écran toujours allumé ; le clic débloque aussi l'audio */
    boutonDemarrer(bouton, surDemarrage) {
      bouton.addEventListener("click", async () => {
        await App.ecran.pleinEcran();
        bouton.hidden = true;
        try { await navigator.wakeLock?.request("screen"); } catch (e) { /* non pris en charge */ }
        if (surDemarrage) surDemarrage();
      });
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && bouton.dataset.toujours === "1") bouton.hidden = false;
      });
    },

    /* Masque le curseur après 3 s d'immobilité */
    curseurAuto() {
      let t;
      document.addEventListener("mousemove", () => {
        document.body.classList.remove("is-curseur-cache");
        clearTimeout(t);
        t = setTimeout(() => document.body.classList.add("is-curseur-cache"), 3000);
      });
    },

    /* Canal local entre la console de régie (page 24) et les écrans du même poste.
       En production : remplacé par un WebSocket / SSE du serveur. */
    canal(nom, surMessage) {
      if (!("BroadcastChannel" in window)) return { envoyer() {} };
      const c = new BroadcastChannel(`domafquest-${nom}`);
      c.onmessage = (e) => surMessage && surMessage(e.data);
      return { envoyer: (msg) => c.postMessage(msg) };
    }
  };
})();
