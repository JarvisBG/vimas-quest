-- ============================================================================
-- DOMAF Quest — EFFACER le contenu d'essai (20/09/2026)
-- ----------------------------------------------------------------------------
-- Retire tout ce que contenu_essai.sql a posé : lieux, scènes, artistes,
-- concerts, dédicaces, QR, missions, lots de la roue, annonces et manches de
-- blind test.
--
-- ⚠ Emporte aussi ce que les essais ont produit dessus : effacer un QR efface
-- ses scans (clé étrangère en cascade), effacer un artiste efface ses concerts
-- et les favoris qui s'y rapportent, effacer une mission efface l'avancée des
-- joueurs. Les JOUEURS, eux, restent (leur XP aussi) : pour repartir de zéro,
-- voir la remise à zéro des joueurs d'essai en bas de ce fichier.
--
-- À coller dans l'éditeur SQL de Supabase (projet domaf-quest).
-- ============================================================================
begin;

delete from public.quiz_questions where session_id in
  (select id from public.quiz_sessions where title like 'DOMAF —%');
delete from public.quiz_sessions where title like 'DOMAF —%';

delete from public.dedicaces;
delete from public.creneaux;
delete from public.artistes where id in (
  'charlotte-dipanda','richard-bona','petit-pays','ben-decca','grace-decca','ndedi-eyango',
  'longue-longue','lady-ponce','coco-argentee','mani-bella','salatiel','locko','daphne',
  'blanche-bailly','mr-leo','magasco','tzy-panchak','reniss','x-maleya','dynastie-le-tigre',
  'ewube','mimie','wax-dey','numerica','stanley-enow','ko-c','jovi','maahlox-le-vibeur');

update public.lieux set qr_code_id = null;
delete from public.qr_codes where code like 'DQ-%';
delete from public.lieux where id in (
  'scene-wouri','scene-manguier','scene-bonamoussadi','scene-njangi',
  'stand-green-grass','stand-artisanat','stand-quest','stand-disquaire','stand-radio','stand-pagne',
  'food-ndole','food-soya','food-beignets','food-folere','food-poisson',
  'entree-principale','entree-nord','eau-centre','eau-nord','toilettes-est','toilettes-ouest',
  'secours-poste','abri-tribune','service-info','service-recharge');

delete from public.quests where title in (
  'Échauffement','Tour du propriétaire','Tournée des scènes','Gourmet du festival',
  'Le village en entier','Chasse aux reliques','Autographe','Oreille musicale',
  'Trois manches','Cœur du public','Ambassadeur DOMAF');

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
