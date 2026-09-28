/* ==========================================================================
   Vimas Quest — console-theme.js : clair / sombre (repris d'Otaku, theme.js)
   Chargé TÔT dans <head>, sans defer : le thème mémorisé s'applique avant
   la première peinture. Sombre par défaut ; le clair sert en plein soleil
   (le festival est en plein air). Mémorisé sur l'appareil.
   ========================================================================== */
(function () {
  "use strict";
  var CLE = "domafquest.console.theme";
  var racine = document.documentElement;
  var lire = function () { try { return localStorage.getItem(CLE) === "clair" ? "clair" : "sombre"; } catch (e) { return "sombre"; } };
  var appliquer = function (t) { racine.setAttribute("data-theme", t === "clair" ? "light" : "dark"); };
  appliquer(lire());

  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ctheme";
    var peindre = function () {
      var clair = lire() === "clair";
      b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-' + (clair ? "etoile" : "ampoule") + '"></use></svg>';
      b.setAttribute("aria-label", clair ? "Passer en mode sombre" : "Passer en mode clair (plein soleil)");
      b.title = b.getAttribute("aria-label");
    };
    peindre();
    b.addEventListener("click", function () {
      var suivant = lire() === "clair" ? "sombre" : "clair";
      try { localStorage.setItem(CLE, suivant); } catch (e) { /* ignore */ }
      appliquer(suivant);
      peindre();
    });
    document.body.appendChild(b);
  });
})();
