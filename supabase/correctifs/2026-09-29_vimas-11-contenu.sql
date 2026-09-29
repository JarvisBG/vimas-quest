-- ============================================================================
-- VIMAS QUEST — correctif de contenu (étape 11, recette du 29/09/2026)
-- Décision de Jarvis : « oui, fais les corrections ».
--  1. Styles : « autre » s'affichait « Un autre » dans le programme. On reste
--     dans la liste du profil (_genres_artiste) pour que la console accepte
--     toujours la fiche : Mboa Brass Band → jazz, Lady Soca → zouk (Zouk /
--     Kompa, caribéen), Défilé Wax & Roots → non précisé (un défilé).
--  2. « Brasserie du Port » (nom hérité du DOMAF, Douala) → « Buvette du Majestic »
--     (lieu du plan + QR DQ-VSTBAR). Les cœurs et le plan tiennent à l'id, pas au nom.
-- Contenu seulement : aucune structure, aucun droit ne change.
-- Annulation : mêmes requêtes avec les anciennes valeurs (autre / Brasserie du Port).
-- ============================================================================
begin;

update public.artistes set genre = 'jazz' where id = 'mboa-brass-band' and genre = 'autre';
update public.artistes set genre = 'zouk' where id = 'lady-soca'       and genre = 'autre';
update public.artistes set genre = null   where id = 'defile-wax-roots' and genre = 'autre';

update public.lieux    set nom   = 'Buvette du Majestic' where id   = 'stand-bar'  and nom   = 'Brasserie du Port';
update public.qr_codes set label = 'Buvette du Majestic' where code = 'DQ-VSTBAR' and label = 'Brasserie du Port';

commit;

-- Contrôle : 3 artistes et 2 noms attendus
select 'artiste' as quoi, id as cle, coalesce(genre, '(non précisé)') as valeur
  from public.artistes where id in ('mboa-brass-band', 'lady-soca', 'defile-wax-roots')
union all
select 'lieu', id, nom from public.lieux where id = 'stand-bar'
union all
select 'qr', code, label from public.qr_codes where code = 'DQ-VSTBAR'
order by 1, 2;
