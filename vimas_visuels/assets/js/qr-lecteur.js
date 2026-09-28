/* ==========================================================================
   Vimas Fest — qr-lecteur.js (commun)
   Lecture de QR codes par la caméra, sans dépendance externe :
   1. BarcodeDetector natif (Chrome Android, rapide, 0 Ko) ;
   2. sinon jsQR hébergé localement (Safari iOS…), chargé seulement si nécessaire.

   Utilisation :
     const lecteur = await App.lecteurQR.demarrer(video, { onCode: (texte) => {…} });
     lecteur.pause(); lecteur.reprendre(); lecteur.lampe(true); lecteur.arreter();
   Erreurs possibles (err.code) : "non-supporte", "refus", "indisponible".
   ========================================================================== */
(function () {
  "use strict";

  const CHEMIN_JSQR = "assets/js/vendor/jsQR.min.js";
  const INTERVALLE = 200;   // ms entre deux analyses
  const ANTI_DOUBLON = 2500; // ms pendant lesquels un même contenu est ignoré
  let chargementJsQR = null;

  function erreur(code, message) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  function chargerJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (!chargementJsQR) {
      chargementJsQR = new Promise((ok, ko) => {
        const s = document.createElement("script");
        s.src = CHEMIN_JSQR;
        s.onload = ok;
        s.onerror = () => { chargementJsQR = null; ko(erreur("non-supporte", "jsQR introuvable")); };
        document.head.append(s);
      });
    }
    return chargementJsQR;
  }

  async function creerMoteur() {
    if ("BarcodeDetector" in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes("qr_code")) {
          const det = new window.BarcodeDetector({ formats: ["qr_code"] });
          return {
            nom: "natif",
            async lire(video) {
              const res = await det.detect(video);
              return res.length ? res[0].rawValue : null;
            }
          };
        }
      } catch (e) { /* on passe au moteur de secours */ }
    }
    await chargerJsQR();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return {
      nom: "jsqr",
      async lire(video) {
        const w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return null;
        const echelle = Math.min(1, 640 / Math.max(w, h)); // image réduite = analyse plus rapide
        canvas.width = Math.round(w * echelle);
        canvas.height = Math.round(h * echelle);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const res = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        return res ? res.data : null;
      }
    };
  }

  async function demarrer(video, { onCode } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw erreur("non-supporte", "Caméra inaccessible (page non sécurisée ou navigateur trop ancien).");
    }
    const moteur = await creerMoteur();

    let flux;
    try {
      flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (e) {
      if (e.name === "NotAllowedError" || e.name === "SecurityError") throw erreur("refus", "Accès à la caméra refusé.");
      throw erreur("indisponible", "Caméra indisponible.");
    }

    video.setAttribute("playsinline", "");
    video.muted = true;
    video.srcObject = flux;
    await video.play().catch(() => {});

    const piste = flux.getVideoTracks()[0];
    const capacites = piste.getCapabilities ? piste.getCapabilities() : {};
    let actif = true, arrete = false, boucle = null, dernier = 0;
    let dernierTexte = "", dernierMoment = 0, enCours = false;

    const tour = async (t) => {
      if (arrete) return;
      if (actif && !enCours && t - dernier > INTERVALLE && video.readyState >= 2) {
        dernier = t;
        enCours = true;
        try {
          const texte = await moteur.lire(video);
          const now = Date.now();
          if (texte && actif && !(texte === dernierTexte && now - dernierMoment < ANTI_DOUBLON)) {
            dernierTexte = texte;
            dernierMoment = now;
            if (onCode) onCode(texte);
          }
        } catch (e) { /* image illisible : on continue */ }
        enCours = false;
      }
      boucle = requestAnimationFrame(tour);
    };
    boucle = requestAnimationFrame(tour);

    return {
      moteur: moteur.nom,
      aLampe: !!capacites.torch,
      pause() { actif = false; },
      reprendre() { actif = true; dernierTexte = ""; },
      async lampe(allumee) {
        await piste.applyConstraints({ advanced: [{ torch: !!allumee }] });
      },
      arreter() {
        arrete = true;
        cancelAnimationFrame(boucle);
        flux.getTracks().forEach((p) => p.stop());
        video.srcObject = null;
      }
    };
  }

  window.App = window.App || {};
  window.App.lecteurQR = { demarrer };
})();
