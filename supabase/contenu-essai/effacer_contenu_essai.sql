-- ============================================================================
-- Vimas Quest — EFFACER le contenu d'essai (29/09/2026)
-- ----------------------------------------------------------------------------
-- Retire tout ce que contenu_essai.sql a posé : lieux, scènes, artistes,
-- concerts, dédicaces, QR, missions, lots de la roue, annonces et manches de
-- blind test « VIMAS — ».
--
-- ⚠ Emporte aussi ce que les essais ont produit dessus : effacer un QR efface
-- ses scans (clé étrangère en cascade), effacer un artiste efface ses concerts
-- et les favoris qui s'y rapportent, effacer une mission efface l'avancée des
-- joueurs. Les JOUEURS, eux, restent (leur XP aussi) : pour repartir de zéro,
-- voir la remise à zéro des joueurs en bas de ce fichier.
--
-- À coller dans l'éditeur SQL de Supabase (projet domaf-quest).
-- ============================================================================
begin;

delete from public.quiz_questions where session_id in
  (select id from public.quiz_sessions where title like 'VIMAS —%');
delete from public.quiz_sessions where title like 'VIMAS —%';

delete from public.dedicaces;
delete from public.creneaux;
delete from public.artistes;
update public.lieux set qr_code_id = null;
delete from public.qr_codes;
delete from public.scenes;
delete from public.lieux;
delete from public.quests;
delete from public.roulette_prizes;
delete from public.announcements;

commit;

-- ----------------------------------------------------------------------------
-- Et si on veut aussi effacer les joueurs d'essai (à faire séparément, en
-- connaissance de cause : c'est irréversible)
-- ----------------------------------------------------------------------------
-- delete from public.player_secrets where player_id in
--   (select id from public.players where pseudo like 'Essai%' or pseudo like 'Test%');
-- delete from public.players where pseudo like 'Essai%' or pseudo like 'Test%';
