-- ----------------------------------------------------------------------------
-- Console : programme du festival (étape 6.4) — propre à DOMAF Quest
-- ----------------------------------------------------------------------------
-- Un écran lu en UN appel : console_programme() (lieux et scènes, artistes,
-- concerts, dédicaces, styles de la fiche fan). Un enregistrement par
-- formulaire, tous les champs d'un coup (décision du 19/09 : fonctions
-- validées plutôt qu'écriture directe dans les tables) :
--   console_lieu_enregistrer · console_artiste_enregistrer
--   console_concert_enregistrer · console_dedicace_enregistrer
--   console_programme_supprimer · console_programme_activer
-- Règles :
--   · une scène = un lieu + sa ligne dans scenes, écrits ensemble ;
--   · l'identifiant lisible (« nova-kassa ») est FIGÉ après la création : les
--     cœurs (coeurs.cible, texte sans clé) et les liens programme.html#id en
--     dépendent. Le nom affiché reste libre ;
--   · le style d'un artiste est un des styles de la fiche fan (profil_options)
--     pour que les suggestions de « mon programme » fonctionnent ;
--   · deux concerts d'une même scène ne se chevauchent pas : le concert gênant
--     est nommé (DETAIL de l'erreur) ;
--   · un concert scanné garde son artiste et sa scène (on peut le décaler) ;
--   · suppression refusée dès qu'il y a une trace (scan, cœur) : on éteint
--     (artiste « pas encore annoncé », lieu retiré du plan) ou on déplace.
-- Le lien lieu ↔ QR et séance ↔ QR se règle dans l'écran QR (6.3) : ici en
-- lecture seulement. Réservées au staff et au GM (pas aux vendeurs).
-- ----------------------------------------------------------------------------

-- Les styles de la fiche fan (valeurs de profil_options)
create or replace function public._genres_artiste()
 returns text[]
 language sql
 stable
 set search_path to 'public'
as $function$
  select array_agg(g ->> 'valeur')
    from json_array_elements(public.profil_options() -> 'genre_prefere') g;
$function$;

-- Une date lue dans le JSON d'un formulaire (null si absente ou illisible)
create or replace function public._json_instant(p jsonb, p_cle text)
 returns timestamptz
 language plpgsql
 stable
 set search_path to 'public'
as $function$
begin
  if trim(coalesce(p ->> p_cle, '')) !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$' then
    return null;
  end if;
  return (p ->> p_cle)::timestamptz;
exception when others then
  return null;
end;
$function$;

-- ===========================================================================
-- Lecture
-- ===========================================================================
create or replace function public.console_programme()
 returns json
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  return json_build_object(
    'lieux', coalesce((
      select json_agg(json_build_object(
        'id', l.id, 'categorie', l.categorie, 'nom', l.nom, 'description', l.description,
        'horaires', l.horaires, 'x', l.x, 'y', l.y, 'pmr', l.pmr, 'ordre', l.ordre, 'actif', l.actif,
        'couleur', s.couleur,
        'qr', case when q.id is not null then json_build_object(
                'id', q.id, 'code', q.code, 'nom', q.label, 'actif', q.active,
                'scans', coalesce((select sum(n) from public.qr_scans_jour t where t.qr_code_id = q.id), 0)) end,
        'coeurs', coalesce(ct.n, 0),
        'concerts', (select count(*) from public.creneaux c where c.scene_id = l.id),
        'dedicaces', (select count(*) from public.dedicaces d where d.lieu_id = l.id))
        order by l.categorie, l.ordre, l.nom)
      from public.lieux l
      left join public.scenes s on s.id = l.id
      left join public.qr_codes q on q.id = l.qr_code_id
      left join public.coeurs_totaux ct on ct.categorie = 'stands' and ct.cible = l.id
    ), '[]'::json),
    'artistes', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'nom', a.nom, 'genre', a.genre, 'bio', a.bio, 'photo_url', a.photo_url,
        'tete_affiche', a.tete_affiche, 'actif', a.actif, 'coeurs', coalesce(ct.n, 0))
        order by a.nom)
      from public.artistes a
      left join public.coeurs_totaux ct on ct.categorie = 'artistes' and ct.cible = a.id
    ), '[]'::json),
    -- scanne : au moins un scan pendant ce concert (index scans_creneau_idx)
    'concerts', coalesce((
      select json_agg(json_build_object(
        'id', c.id, 'artiste_id', c.artiste_id, 'scene_id', c.scene_id, 'debut', c.debut, 'fin', c.fin,
        'favoris', coalesce(f.n, 0),
        'scanne', exists (select 1 from public.scans s where s.creneau_id = c.id))
        order by c.debut)
      from public.creneaux c
      left join (select creneau_id, count(*) as n from public.favoris_programme group by creneau_id) f
        on f.creneau_id = c.id
    ), '[]'::json),
    'dedicaces', coalesce((
      select json_agg(json_build_object(
        'id', d.id, 'artiste_id', d.artiste_id, 'lieu_id', d.lieu_id, 'debut', d.debut, 'fin', d.fin,
        'qr', case when q.id is not null then json_build_object(
                'id', q.id, 'code', q.code, 'nom', q.label, 'actif', q.active) end,
        'scanne', d.qr_code_id is not null
                  and exists (select 1 from public.qr_scans_jour t where t.qr_code_id = d.qr_code_id and t.n > 0))
        order by d.debut)
      from public.dedicaces d
      left join public.qr_codes q on q.id = d.qr_code_id
    ), '[]'::json),
    'genres', public.profil_options() -> 'genre_prefere'
  );
end;
$function$;

-- ===========================================================================
-- Lieux et scènes
-- ===========================================================================
create or replace function public.console_lieu_enregistrer(p_id text, p_lieu jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id       text := nullif(lower(trim(coalesce(p_lieu ->> 'id', ''))), '');
  v_cat      text := nullif(trim(coalesce(p_lieu ->> 'categorie', '')), '');
  v_nom      text := nullif(trim(coalesce(p_lieu ->> 'nom', '')), '');
  v_desc     text := nullif(trim(coalesce(p_lieu ->> 'description', '')), '');
  v_horaires text := nullif(trim(coalesce(p_lieu ->> 'horaires', '')), '');
  v_x        integer := public._json_entier(p_lieu, 'x');
  v_y        integer := public._json_entier(p_lieu, 'y');
  v_pmr      boolean := case p_lieu ->> 'pmr' when 'true' then true when 'false' then false end;
  v_ordre    integer := coalesce(public._json_entier(p_lieu, 'ordre'), 0);
  v_actif    boolean := coalesce((p_lieu ->> 'actif')::boolean, true);
  v_couleur  text := coalesce(nullif(trim(coalesce(p_lieu ->> 'couleur', '')), ''), 'nuit');
  v_avant    public.lieux%rowtype;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_nom is null or char_length(v_nom) > 80 then raise exception 'NOM_MANQUANT'; end if;
  if char_length(coalesce(v_desc, '')) > 400 then raise exception 'DESCRIPTION_TROP_LONGUE'; end if;
  if char_length(coalesce(v_horaires, '')) > 80 then raise exception 'HORAIRES_TROP_LONGS'; end if;
  if v_cat is null or v_cat not in ('scene','stand','food','eau','toilettes','secours','abri','service','entree') then
    raise exception 'CATEGORIE_INVALIDE';
  end if;
  -- Place sur le fond du plan (1000 × 700 unités), les deux ou aucune
  if (v_x is null) <> (v_y is null) or v_x not between 0 and 1000 or v_y not between 0 and 700 then
    raise exception 'POSITION_INVALIDE';
  end if;
  if v_ordre not between -999 and 999 then raise exception 'ORDRE_INVALIDE'; end if;
  if v_couleur not in ('sodium','vert','rose','bleu','nuit','rouge','papier') then raise exception 'COULEUR_INVALIDE'; end if;

  if p_id is null then
    if v_id is null or v_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_id) > 40 then raise exception 'ID_INVALIDE'; end if;
    if exists (select 1 from public.lieux where id = v_id) then raise exception 'ID_PRIS'; end if;
    insert into public.lieux (id, categorie, nom, description, horaires, x, y, pmr, ordre, actif)
    values (v_id, v_cat, v_nom, v_desc, v_horaires, v_x, v_y, v_pmr, v_ordre, v_actif);
    if v_cat = 'scene' then
      insert into public.scenes (id, couleur, ordre) values (v_id, v_couleur, v_ordre);
    end if;
    return json_build_object('id', v_id);
  end if;

  select * into v_avant from public.lieux where id = p_id for update;
  if v_avant.id is null then raise exception 'LIEU_INCONNU'; end if;
  -- Changer de catégorie : jamais pour une scène (ses concerts), ni quand le
  -- lieu a son QR (le type du QR en dépend) ou des cœurs (vote des stands)
  if v_cat <> v_avant.categorie then
    if v_cat = 'scene' or v_avant.categorie = 'scene' then raise exception 'CATEGORIE_SCENE_FIGEE'; end if;
    if v_avant.qr_code_id is not null then raise exception 'CATEGORIE_QR_RELIE'; end if;
    if exists (select 1 from public.coeurs_totaux where categorie = 'stands' and cible = p_id and n > 0) then
      raise exception 'CATEGORIE_COEURS';
    end if;
  end if;
  update public.lieux
     set categorie = v_cat, nom = v_nom, description = v_desc, horaires = v_horaires,
         x = v_x, y = v_y, pmr = v_pmr, ordre = v_ordre, actif = v_actif
   where id = p_id;
  if v_cat = 'scene' then
    update public.scenes set couleur = v_couleur, ordre = v_ordre where id = p_id;
  end if;
  return json_build_object('id', p_id);
end;
$function$;

-- ===========================================================================
-- Artistes
-- ===========================================================================
create or replace function public.console_artiste_enregistrer(p_id text, p_artiste jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id    text := nullif(lower(trim(coalesce(p_artiste ->> 'id', ''))), '');
  v_nom   text := nullif(trim(coalesce(p_artiste ->> 'nom', '')), '');
  v_genre text := nullif(trim(coalesce(p_artiste ->> 'genre', '')), '');
  v_bio   text := nullif(trim(coalesce(p_artiste ->> 'bio', '')), '');
  v_photo text := nullif(trim(coalesce(p_artiste ->> 'photo_url', '')), '');
  v_tete  boolean := coalesce((p_artiste ->> 'tete_affiche')::boolean, false);
  -- Pas encore annoncé par défaut : on l'allume le jour de l'annonce
  v_actif boolean := coalesce((p_artiste ->> 'actif')::boolean, false);
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_nom is null or char_length(v_nom) > 80 then raise exception 'NOM_MANQUANT'; end if;
  if v_genre is not null and not (v_genre = any (public._genres_artiste())) then raise exception 'GENRE_INVALIDE'; end if;
  if char_length(coalesce(v_bio, '')) > 600 then raise exception 'BIO_TROP_LONGUE'; end if;
  -- Un fichier du site (passé par outils/photos.py) ou une adresse https
  if v_photo is not null and v_photo !~ '^assets/photos/[a-z0-9-]+[.](webp|jpg|jpeg|png)$'
     and (v_photo !~ '^https://[^\s"<>]+$' or char_length(v_photo) > 300) then
    raise exception 'PHOTO_INVALIDE';
  end if;

  if p_id is null then
    if v_id is null or v_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_id) > 60 then raise exception 'ID_INVALIDE'; end if;
    if exists (select 1 from public.artistes where id = v_id) then raise exception 'ID_PRIS'; end if;
    insert into public.artistes (id, nom, genre, bio, photo_url, tete_affiche, actif)
    values (v_id, v_nom, v_genre, v_bio, v_photo, v_tete, v_actif);
    return json_build_object('id', v_id);
  end if;

  update public.artistes
     set nom = v_nom, genre = v_genre, bio = v_bio, photo_url = v_photo, tete_affiche = v_tete, actif = v_actif
   where id = p_id;
  if not found then raise exception 'ARTISTE_INCONNU'; end if;
  return json_build_object('id', p_id);
end;
$function$;

-- ===========================================================================
-- Concerts
-- ===========================================================================
create or replace function public.console_concert_enregistrer(p_id uuid, p_concert jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_artiste text := nullif(trim(coalesce(p_concert ->> 'artiste_id', '')), '');
  v_scene   text := nullif(trim(coalesce(p_concert ->> 'scene_id', '')), '');
  v_debut   timestamptz := public._json_instant(p_concert, 'debut');
  v_fin     timestamptz := public._json_instant(p_concert, 'fin');
  v_avant   public.creneaux%rowtype;
  v_gene    record;
  v_id      uuid;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_artiste is null or not exists (select 1 from public.artistes where id = v_artiste) then
    raise exception 'ARTISTE_INCONNU';
  end if;
  if v_scene is null or not exists (select 1 from public.scenes where id = v_scene) then
    raise exception 'SCENE_INCONNUE';
  end if;
  if v_debut is null or v_fin is null then raise exception 'HEURE_INVALIDE'; end if;
  if v_fin <= v_debut or v_fin > v_debut + interval '12 hours' then raise exception 'DUREE_INVALIDE'; end if;

  if p_id is not null then
    select * into v_avant from public.creneaux where id = p_id for update;
    if v_avant.id is null then raise exception 'CONCERT_INCONNU'; end if;
    -- Scanné : les joueurs l'ont « vu » sur cette scène, avec cet artiste
    if (v_artiste <> v_avant.artiste_id or v_scene <> v_avant.scene_id)
       and exists (select 1 from public.scans where creneau_id = p_id) then
      raise exception 'CONCERT_DEJA_SCANNE';
    end if;
  end if;

  -- Même règle que la contrainte creneaux_sans_chevauchement, mais en nommant le concert gênant
  select a.nom, c.debut, c.fin into v_gene
    from public.creneaux c join public.artistes a on a.id = c.artiste_id
   where c.scene_id = v_scene and c.id is distinct from p_id
     and tstzrange(c.debut, c.fin) && tstzrange(v_debut, v_fin)
   order by c.debut limit 1;
  if found then
    raise exception 'CHEVAUCHEMENT' using detail = json_build_object(
      'artiste', v_gene.nom, 'debut', v_gene.debut, 'fin', v_gene.fin)::text;
  end if;

  if p_id is null then
    insert into public.creneaux (artiste_id, scene_id, debut, fin)
    values (v_artiste, v_scene, v_debut, v_fin)
    returning id into v_id;
  else
    update public.creneaux
       set artiste_id = v_artiste, scene_id = v_scene, debut = v_debut, fin = v_fin
     where id = p_id
    returning id into v_id;
  end if;
  return json_build_object('id', v_id);
exception when exclusion_violation then
  -- Enregistré en même temps depuis un autre poste
  raise exception 'CHEVAUCHEMENT';
end;
$function$;

-- ===========================================================================
-- Dédicaces
-- ===========================================================================
create or replace function public.console_dedicace_enregistrer(p_id uuid, p_dedicace jsonb)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_artiste text := nullif(trim(coalesce(p_dedicace ->> 'artiste_id', '')), '');
  v_lieu    text := nullif(trim(coalesce(p_dedicace ->> 'lieu_id', '')), '');
  v_debut   timestamptz := public._json_instant(p_dedicace, 'debut');
  v_fin     timestamptz := public._json_instant(p_dedicace, 'fin');
  v_avant   public.dedicaces%rowtype;
  v_id      uuid;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if v_artiste is null or not exists (select 1 from public.artistes where id = v_artiste) then
    raise exception 'ARTISTE_INCONNU';
  end if;
  if v_lieu is not null and not exists (select 1 from public.lieux where id = v_lieu) then
    raise exception 'LIEU_INCONNU';
  end if;
  if v_debut is null or v_fin is null then raise exception 'HEURE_INVALIDE'; end if;
  if v_fin <= v_debut or v_fin > v_debut + interval '12 hours' then raise exception 'DUREE_INVALIDE'; end if;

  if p_id is null then
    insert into public.dedicaces (artiste_id, lieu_id, debut, fin)
    values (v_artiste, v_lieu, v_debut, v_fin)
    returning id into v_id;
    return json_build_object('id', v_id);
  end if;

  select * into v_avant from public.dedicaces where id = p_id for update;
  if v_avant.id is null then raise exception 'DEDICACE_INCONNUE'; end if;
  -- Son QR scanné : les joueurs ont « vu » CET artiste
  if v_artiste <> v_avant.artiste_id and v_avant.qr_code_id is not null
     and exists (select 1 from public.scans where qr_code_id = v_avant.qr_code_id) then
    raise exception 'DEDICACE_DEJA_SCANNEE';
  end if;
  update public.dedicaces
     set artiste_id = v_artiste, lieu_id = v_lieu, debut = v_debut, fin = v_fin
   where id = p_id;
  return json_build_object('id', p_id);
end;
$function$;

-- ===========================================================================
-- Supprimer, allumer / éteindre
-- ===========================================================================
-- p_quoi : lieu | artiste | concert | dedicace. Renvoie ce qui est parti avec
-- (favoris des joueurs, concerts, séances) pour le message de la console.
create or replace function public.console_programme_supprimer(p_quoi text, p_id text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uuid     uuid;
  v_lieu     public.lieux%rowtype;
  v_favoris  integer := 0;
  v_concerts integer := 0;
  v_seances  integer := 0;
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;

  if p_quoi = 'lieu' then
    select * into v_lieu from public.lieux where id = p_id for update;
    if v_lieu.id is null then raise exception 'LIEU_INCONNU'; end if;
    if exists (select 1 from public.creneaux where scene_id = p_id) then raise exception 'SCENE_A_DES_CONCERTS'; end if;
    -- Son QR scanné : le stand est dans des collections ; des cœurs : dans le palmarès
    if v_lieu.qr_code_id is not null
       and exists (select 1 from public.scans where qr_code_id = v_lieu.qr_code_id) then
      raise exception 'LIEU_DEJA_SCANNE';
    end if;
    if exists (select 1 from public.coeurs_totaux where categorie = 'stands' and cible = p_id and n > 0) then
      raise exception 'LIEU_A_DES_COEURS';
    end if;
    select count(*) into v_seances from public.dedicaces where lieu_id = p_id;
    delete from public.lieux where id = p_id;   -- scène : sa ligne part aussi ; QR, séances : déliés
    return json_build_object('seances', v_seances);

  elsif p_quoi = 'artiste' then
    if not exists (select 1 from public.artistes where id = p_id) then raise exception 'ARTISTE_INCONNU'; end if;
    if exists (select 1 from public.scans s join public.creneaux c on c.id = s.creneau_id where c.artiste_id = p_id)
       or exists (select 1 from public.scans s join public.dedicaces d on d.qr_code_id = s.qr_code_id where d.artiste_id = p_id) then
      raise exception 'ARTISTE_DEJA_VU';
    end if;
    if exists (select 1 from public.coeurs_totaux where categorie = 'artistes' and cible = p_id and n > 0) then
      raise exception 'ARTISTE_A_DES_COEURS';
    end if;
    select count(*) into v_favoris
      from public.favoris_programme f join public.creneaux c on c.id = f.creneau_id where c.artiste_id = p_id;
    select count(*) into v_concerts from public.creneaux where artiste_id = p_id;
    select count(*) into v_seances from public.dedicaces where artiste_id = p_id;
    delete from public.artistes where id = p_id;   -- concerts, séances, favoris : partent avec
    return json_build_object('favoris', v_favoris, 'concerts', v_concerts, 'seances', v_seances);

  elsif p_quoi in ('concert', 'dedicace') then
    v_uuid := public._json_uuid(jsonb_build_object('id', p_id), 'id');
    if p_quoi = 'concert' then
      if v_uuid is null or not exists (select 1 from public.creneaux where id = v_uuid) then raise exception 'CONCERT_INCONNU'; end if;
      if exists (select 1 from public.scans where creneau_id = v_uuid) then raise exception 'CONCERT_DEJA_SCANNE'; end if;
      select count(*) into v_favoris from public.favoris_programme where creneau_id = v_uuid;
      delete from public.creneaux where id = v_uuid;
      return json_build_object('favoris', v_favoris);
    end if;
    if v_uuid is null or not exists (select 1 from public.dedicaces where id = v_uuid) then raise exception 'DEDICACE_INCONNUE'; end if;
    if exists (select 1 from public.dedicaces d join public.scans s on s.qr_code_id = d.qr_code_id where d.id = v_uuid) then
      raise exception 'DEDICACE_DEJA_SCANNEE';
    end if;
    delete from public.dedicaces where id = v_uuid;   -- son QR : délié
    return json_build_object();
  end if;
  raise exception 'QUOI_INVALIDE';
end;
$function$;

-- Interrupteur de la liste : lieu (retiré du plan) ou artiste (annoncé ou non)
create or replace function public.console_programme_activer(p_quoi text, p_id text, p_actif boolean)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_staff() then raise exception 'ACCES_REFUSE'; end if;
  if p_actif is null then raise exception 'ETAT_INVALIDE'; end if;
  if p_quoi = 'lieu' then
    update public.lieux set actif = p_actif where id = p_id;
    if not found then raise exception 'LIEU_INCONNU'; end if;
  elsif p_quoi = 'artiste' then
    update public.artistes set actif = p_actif where id = p_id;
    if not found then raise exception 'ARTISTE_INCONNU'; end if;
  else
    raise exception 'QUOI_INVALIDE';
  end if;
  return json_build_object('id', p_id, 'actif', p_actif);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Droits : comptes connectés seulement, chaque fonction vérifie le rôle
-- ---------------------------------------------------------------------------
revoke all on function public._genres_artiste() from public, anon, authenticated;
revoke all on function public._json_instant(p jsonb, p_cle text) from public, anon, authenticated;
revoke all on function public.console_programme() from public, anon, authenticated;
grant execute on function public.console_programme() to authenticated;
revoke all on function public.console_lieu_enregistrer(p_id text, p_lieu jsonb) from public, anon, authenticated;
grant execute on function public.console_lieu_enregistrer(p_id text, p_lieu jsonb) to authenticated;
revoke all on function public.console_artiste_enregistrer(p_id text, p_artiste jsonb) from public, anon, authenticated;
grant execute on function public.console_artiste_enregistrer(p_id text, p_artiste jsonb) to authenticated;
revoke all on function public.console_concert_enregistrer(p_id uuid, p_concert jsonb) from public, anon, authenticated;
grant execute on function public.console_concert_enregistrer(p_id uuid, p_concert jsonb) to authenticated;
revoke all on function public.console_dedicace_enregistrer(p_id uuid, p_dedicace jsonb) from public, anon, authenticated;
grant execute on function public.console_dedicace_enregistrer(p_id uuid, p_dedicace jsonb) to authenticated;
revoke all on function public.console_programme_supprimer(p_quoi text, p_id text) from public, anon, authenticated;
grant execute on function public.console_programme_supprimer(p_quoi text, p_id text) to authenticated;
revoke all on function public.console_programme_activer(p_quoi text, p_id text, p_actif boolean) from public, anon, authenticated;
grant execute on function public.console_programme_activer(p_quoi text, p_id text, p_actif boolean) to authenticated;
