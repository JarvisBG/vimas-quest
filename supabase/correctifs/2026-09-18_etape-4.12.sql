-- ============================================================================
-- Correctif du 18/09/2026 (étape 4.12) — pour une base installée AVANT ce jour
-- ----------------------------------------------------------------------------
-- programme_favoris renvoie un objet { favoris, vus, genre } au lieu de la
-- seule liste des favoris : « vu » et suggestions de « mon programme » sans
-- requête de plus. Même signature, mêmes droits. Copiée de 00_schema.sql.
-- À appliquer après 2026-09-18_etape-4.11.sql. Rejouable.
-- ============================================================================
begin;

-- Ce que le programme affiche en plus pour un joueur, en UN appel (étape 4.12) :
--   favoris  concerts de son programme et rappel de chacun
--   vus      artistes vus (même règle que player_collection : scène scannée
--            pendant un de ses concerts, ou QR de sa dédicace)
--   genre    style préféré (profil), pour les suggestions de « mon programme »
create or replace function public.programme_favoris(p_secret_code text)
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_player_id uuid;
begin
  select s.player_id into v_player_id
  from public.player_secrets s
  where s.secret_code = upper(trim(p_secret_code));
  if v_player_id is null then raise exception 'SESSION_INVALIDE'; end if;

  return json_build_object(
    'favoris', coalesce((
      select json_agg(json_build_object('creneau_id', f.creneau_id, 'rappel', f.rappel)
                      order by c.debut)
      from public.favoris_programme f
      join public.creneaux c on c.id = f.creneau_id
      join public.artistes a on a.id = c.artiste_id and a.actif
      where f.player_id = v_player_id), '[]'::json),
    'vus', coalesce((
      select json_agg(distinct v.artiste_id)
      from (
        select cr.artiste_id
        from public.scans sc join public.creneaux cr on cr.id = sc.creneau_id
        where sc.player_id = v_player_id
        union
        select de.artiste_id
        from public.scans sc join public.dedicaces de on de.qr_code_id = sc.qr_code_id
        where sc.player_id = v_player_id
      ) v
      join public.artistes a on a.id = v.artiste_id and a.actif), '[]'::json),
    'genre', (select pp.genre_prefere from public.player_profile pp where pp.player_id = v_player_id));
end;
$function$;

commit;
