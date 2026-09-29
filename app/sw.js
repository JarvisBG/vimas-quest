/* ==========================================================================
   Vimas Quest — service worker
   Objectif : que le jeu s'ouvre et reste utilisable quand le réseau du festival sature.
   - Pages : réseau d'abord (3 s max), puis cache, puis page « hors connexion ».
   - Fichiers statiques : cache d'abord, mise à jour en arrière-plan.
   - Données : Supabase est sur un autre domaine, le service worker n'y touche pas ;
     serveur.js garde lui-même la dernière réponse connue (App.cache, App.rpc memo).
   - Installation : seulement ce qu'un TÉLÉPHONE ouvre (~150 Ko compressés). Les
     écrans géants et supabase-js (écran, console) se mettent en cache à la demande.
   Changer VERSION à chaque mise en ligne pour renouveler le cache.
   ========================================================================== */
const VERSION = "vimasquest-v6";
const CACHE_APP = `${VERSION}-app`;
const DELAI_RESEAU = 3000;

const PAGES = [
  "./", "index.html", "inscription.html", "tableau-de-bord.html", "scanner.html",
  "programme.html", "mon-programme.html", "plan.html", "missions.html", "collection.html",
  "classement.html", "roue.html", "blind-test.html", "coups-de-coeur.html", "passeport.html",
  "annonces.html", "infos.html", "erreur.html", "hors-ligne.html"
];
const FICHIERS = [
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/css/pages/accueil.css", "assets/css/pages/inscription.css", "assets/css/pages/tableau-de-bord.css",
  "assets/css/pages/scanner.css", "assets/css/pages/programme.css", "assets/css/pages/mon-programme.css",
  "assets/css/pages/plan.css", "assets/css/pages/missions.css", "assets/css/pages/collection.css",
  "assets/css/pages/classement.css", "assets/css/pages/roue.css", "assets/css/pages/blind-test.css",
  "assets/css/pages/coups-de-coeur.css", "assets/css/pages/passeport.css", "assets/css/pages/annonces.css",
  "assets/css/pages/infos.css", "assets/css/pages/erreur.css",
  "assets/js/config.js", "assets/js/app.js", "assets/js/serveur.js", "assets/js/qr-lecteur.js",
  "assets/js/pages/accueil.js", "assets/js/pages/inscription.js", "assets/js/pages/tableau-de-bord.js",
  "assets/js/pages/scanner.js", "assets/js/pages/programme.js", "assets/js/pages/mon-programme.js",
  "assets/js/plan-fond.js", "assets/js/pages/plan.js", "assets/js/pages/missions.js", "assets/js/pages/collection.js",
  "assets/js/pages/classement.js", "assets/js/pages/roue.js", "assets/js/pages/blind-test.js",
  "assets/js/pages/coups-de-coeur.js", "assets/js/pages/passeport.js", "assets/js/pages/annonces.js",
  "assets/js/pages/infos.js", "assets/js/pages/erreur.js",
  "assets/js/vendor/qrcode-generator.min.js", "assets/js/vendor/jsQR.min.js",
  "assets/fonts/Anton-Regular.woff2",
  "assets/icons/favicon.svg", "assets/icons/icone-192.png", "assets/icons/icone-512.png",
  "data/mock.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    // Un fichier manquant ne doit pas bloquer toute l'installation
    await Promise.all([...PAGES, ...FICHIERS].map((url) =>
      cache.add(new Request(url, { cache: "reload" })).catch(() => console.warn("[sw] non mis en cache :", url))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cles = await caches.keys();
    await Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c)));
    await self.clients.claim();
  })());
});

const avecDelai = (promesse, ms) => Promise.race([
  promesse,
  new Promise((_, rejeter) => setTimeout(() => rejeter(new Error("délai dépassé")), ms))
]);

// Une page n'est gardée qu'UNE fois, sans ses paramètres : chaque scan par
// l'appareil photo (scanner.html?code=…) ajoutait sinon une copie de plus.
const sansParametres = (url) => { const u = new URL(url); u.search = ""; u.hash = ""; return u.href; };

async function pageReseauDabord(requete) {
  const cache = await caches.open(CACHE_APP);
  try {
    const reponse = await avecDelai(fetch(requete), DELAI_RESEAU);
    if (reponse.ok && !reponse.redirected) cache.put(sansParametres(requete.url), reponse.clone());
    if (reponse.status === 404) {
      const page404 = await cache.match("erreur.html");
      if (page404) {
        const chemin = encodeURIComponent(new URL(requete.url).pathname);
        return Response.redirect(new URL(`erreur.html?code=404&chemin=${chemin}`, self.registration.scope).href, 302);
      }
    }
    return reponse;
  } catch (e) {
    const enCache = await cache.match(requete, { ignoreSearch: true });
    if (enCache) return enCache;
    // Redirection (et non réponse directe) pour que les chemins relatifs de la page restent valides
    const retour = encodeURIComponent(new URL(requete.url).pathname.replace(new URL(self.registration.scope).pathname, ""));
    return Response.redirect(new URL(`hors-ligne.html?retour=${retour}`, self.registration.scope).href, 302);
  }
}

async function statiqueCacheDabord(requete) {
  const cache = await caches.open(CACHE_APP);
  const enCache = await cache.match(requete, { ignoreSearch: true });
  const maj = fetch(requete).then((r) => { if (r.ok) cache.put(requete, r.clone()); return r; }).catch(() => null);
  return enCache || (await maj) || new Response("", { status: 504, statusText: "Hors connexion" });
}

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  const url = new URL(requete.url);
  if (requete.method !== "GET" || url.origin !== location.origin) return;
  // Test de connexion de la page hors ligne : toujours le réseau
  if (url.searchParams.has("ping")) return;
  // Console de l'équipe : jamais de copie sur un téléphone (toujours la dernière version)
  if (url.pathname.includes("/admin/")) return;

  if (requete.mode === "navigate") event.respondWith(pageReseauDabord(requete));
  else event.respondWith(statiqueCacheDabord(requete));
});

// La page peut demander l'activation immédiate d'une nouvelle version
self.addEventListener("message", (event) => {
  if (event.data === "activer") self.skipWaiting();
});
