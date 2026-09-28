// ============================================================
// VIMAS QUEST — Coordonnées de la base Supabase (projet domaf-quest, partagé avec l'ancien DOMAF Quest)
// La clé « publishable » (successeur de la clé « anon ») est publique
// par conception : ce qu'elle a le droit de faire est contrôlé côté
// serveur (RLS + fonctions). JAMAIS de clé secrète (sb_secret_…,
// service_role) dans ce dossier : tout ce qui est ici part en ligne.
// Mêmes noms de constantes qu'Otaku Quest (assets/js/api.js).
// ============================================================
const SUPABASE_URL = 'https://greawdlzcuewlcndddxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fQDV-1i_GFd1rq9tZLqDJA_Kggiz9li';
