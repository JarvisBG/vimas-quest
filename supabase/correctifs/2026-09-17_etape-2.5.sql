-- ============================================================================
-- Correctif du 17/09/2026 (étape 2.5) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- Déjà inclus dans 00_schema.sql : une base neuve n'en a pas besoin.
-- Appliqué sur le projet domaf-quest (greawdlzcuewlcndddxq) le 17/09/2026.
-- Rejouable sans effet de bord.
-- ============================================================================
begin;

-- 1. Fonctions internes ouvertes à tout compte connecté, sans contrôle de rôle
--    (hérité de la prod Otaku). N'importe qui pouvant se créer un compte,
--    _award_badge permettait de donner un badge à n'importe quel joueur et
--    d'afficher un texte libre sur l'écran géant. Seules les fonctions
--    SECURITY DEFINER s'en servent : elles n'ont pas besoin de ce droit.
revoke all on function public._award_badge(p_player_id uuid, p_pseudo text, p_badge_name text) from public, anon, authenticated;
revoke all on function public._gen_qr_code() from public, anon, authenticated;
revoke all on function public.pass_actif(p_player_id uuid) from public, anon, authenticated;

-- 2. Chemin de recherche fixé (alerte « Function Search Path Mutable »).
alter function public._is_system_badge(p_name text) set search_path to 'public';
alter function public._maj_xp_jour() set search_path to 'public';
alter function public._norm_answer(p text) set search_path to 'public';
alter function public._norm_ticket(p_code text) set search_path to 'public';
alter function public._points_jour(p_xp_jour integer, p_jour date) set search_path to 'public';
alter function public._ticket_code() set search_path to 'public';
alter function public.jour_festival_label(p_jour date) set search_path to 'public';
alter function public.level_for_xp(p_xp integer) set search_path to 'public';
alter function public.profil_options() set search_path to 'public';
alter function public.profil_valeurs(p_champ text) set search_path to 'public';
alter function public.rank_for_level(p_level integer) set search_path to 'public';
alter function public.roi_veille() set search_path to 'public';
alter function public.sortie_options() set search_path to 'public';

commit;
