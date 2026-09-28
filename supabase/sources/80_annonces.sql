-- ----------------------------------------------------------------------------
-- Annonces (étape 4.10) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- announcements gagne titre, catégorie, lien (page du site) et fin de validité
-- (générateur). Le niveau reste `type` : danger = urgent (épinglée en tête),
-- alerte = important, info / succes = info.
--
-- Les téléphones lisent la table directement (lecture publique d'Otaku, aussi
-- pour les visiteurs sans carte) : les 48 dernières heures, 30 au plus.
-- « Lue » reste sur le téléphone.
--
--   admin_publier_annonce(...)   la console (étape 6) : tous les champs
--   admin_fermer_annonce(id)     fin de validité tout de suite (l'annonce passe
--                                dans « Anciennes » au lieu de disparaître)
-- admin_create_announcement (Otaku : message + type) reste utilisable.
-- ----------------------------------------------------------------------------

-- Les téléphones ne lisent que les annonces récentes
create index announcements_recentes_idx on public.announcements (created_at desc);

create or replace function public.admin_publier_annonce(
  p_titre text, p_message text, p_type text default 'info', p_categorie text default 'pratique',
  p_lien text default null, p_lien_libelle text default null, p_fin timestamptz default null)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_row public.announcements%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if coalesce(trim(p_message), '') = '' then raise exception 'MESSAGE_VIDE'; end if;
  if p_type not in ('info', 'alerte', 'succes', 'danger') then raise exception 'TYPE_INVALIDE'; end if;
  if p_fin is not null and p_fin <= now() then raise exception 'FIN_PASSEE'; end if;
  -- Titre, catégorie, lien : vérifiés par les contraintes de la table
  insert into public.announcements (titre, message, type, categorie, lien, lien_libelle, fin)
  values (nullif(trim(p_titre), ''), trim(p_message), p_type, coalesce(p_categorie, 'pratique'),
          nullif(trim(p_lien), ''), nullif(trim(p_lien_libelle), ''), p_fin)
  returning * into v_row;
  return row_to_json(v_row);
end;
$function$;

revoke all on function public.admin_publier_annonce(p_titre text, p_message text, p_type text, p_categorie text, p_lien text, p_lien_libelle text, p_fin timestamptz) from public, anon, authenticated;
grant execute on function public.admin_publier_annonce(p_titre text, p_message text, p_type text, p_categorie text, p_lien text, p_lien_libelle text, p_fin timestamptz) to authenticated;

create or replace function public.admin_fermer_annonce(p_id uuid)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_row public.announcements%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  update public.announcements set fin = now()
  where id = p_id and (fin is null or fin > now())
  returning * into v_row;
  if v_row.id is null then raise exception 'ANNONCE_INCONNUE'; end if;
  return row_to_json(v_row);
end;
$function$;

revoke all on function public.admin_fermer_annonce(p_id uuid) from public, anon, authenticated;
grant execute on function public.admin_fermer_annonce(p_id uuid) to authenticated;
